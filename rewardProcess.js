const { Lunar, getL, dLang } = require('./functions.js');
const { timeDiff } = require('./utils.js');
const logprefix = '[Reward Process]'

/** Parse XP string "text,voice,video" into object */
function parseXP(xpString) {
    const [text, voice, video] = xpString.split(',').map(Number);
    return { text, voice, video };
}

/**
 * Checking reward type: 
 * returns 'text', 'voice' or 'video', if only one type was added.
 * returns 'combined', if was added multiple types.
 */
function getRewardType(xp) {
    const types = [];
    if (xp.text > 0) types.push('text');
    if (xp.voice > 0) types.push('voice');
    if (xp.video > 0) types.push('video');
    
    return types.length === 1 ? types[0] : 'combined';
}

/** Safe role management with Rate Limit protect */
async function manageRoles(member, addIds, removeIds, retries = 5, client, admin_cid, lang) {
    if (addIds.length === 0 && removeIds.length === 0) return;

    try {
        // Perform actions. Discord allows to add/remove roles with array.
        if (removeIds.length > 0) await member.roles.remove(removeIds);
        if (addIds.length > 0) await member.roles.add(addIds);
    } catch (error) {
        if ((error.status === 429 || error.message.includes('rate limited')) && retries > 0) {
            const wait = (error.retry_after || error.data.retry_after || 1) * 1000;
            await new Promise(r => setTimeout(r, wait));
            return manageRoles(member, addIds, removeIds, retries - 1, client, admin_cid);
        }
        console.error(`${logprefix} Failed to update roles of ${member.id}:`, error.message);
        if (admin_cid && admin_cid !== '0' ) {
            await Lunar.sendEvent(client, admin_cid, `⚠️ ${getL(lang ?? dLang, 'rewardupdateerr')} <@${member.id}>!`);
        }
    }
}

async function processRewards(client, db) {
    const startTime = Date.now();
    const checkTime = Date.now() - 6 * 60 * 1000; // Last 6 minutes

    // 1. Collecting active guild list
    const activeGuilds = db.prepare(`
        SELECT DISTINCT guild_id FROM users WHERE last_updated > ?
    `).all(checkTime);
    
    let guildTime;

    for (const { guild_id } of activeGuilds) {
        guildTime = Date.now();
        console.log(`${logprefix} Check ${guild_id}`)

        const guild = client.guilds.cache.get(guild_id);
        if (!guild) continue;

        // 2. Load params and rewards of the guild
        const params = db.prepare("SELECT admin_cid, announce_cid, reward_mode, lang FROM guild_params WHERE guild_id = ?").get(guild_id);
        if (!params) continue;

        const allRewards = db.prepare("SELECT * FROM role_rewards WHERE guild_id = ?").all(guild_id);
        if (allRewards.length === 0) continue;

        // Preprocess rewards for fast logic
        const rewards = allRewards.map(r => {
            const xpReq = parseXP(r.xp_required);
            return {
                ...r,
                xp: xpReq,
                type: getRewardType(xpReq)
            };
        });

        // 3. Load active members of a guild
        const activeUsers = db.prepare(`
            SELECT * FROM users WHERE guild_id = ? AND last_updated > ?
        `).all(guild_id, checkTime);

        // Log collector for announcement: { userId: [roleId1, roleId2] }
        const rewardLogs = [];

        for (const userData of activeUsers) {
            try {
                const member = await guild.members.fetch(userData.user_id).catch(() => null);
                if (!member) continue;

                // Checking which rewards user earned
                const earnedRewards = rewards.filter(r => 
                    userData.text_xp >= r.xp.text &&
                    userData.voice_xp >= r.xp.voice &&
                    userData.video_xp >= r.xp.video
                );

                // Skip if no rewards available
                if (earnedRewards.length === 0) continue;

                let finalTargetRoleIds = [];
                let rolesToRemove = [];

                // Replacement mode (reward_mode = 1)
                if (params.reward_mode === 1) {
                    const types = ['text', 'voice', 'video'];
                    
                    // Add all combined type roles (They always added)
                    const combinedRoles = earnedRewards.filter(r => r.type === 'combined');
                    finalTargetRoleIds.push(...combinedRoles.map(r => r.role_id));

                    types.forEach(type => {
                        // Searching for all rewards with the same type (Not combined)
                        const singleTypeEarned = earnedRewards.filter(r => r.type === type);
                        
                        if (singleTypeEarned.length > 0) {
                            // Search for the highest reward of this type
                            const highestReward = singleTypeEarned.reduce((prev, current) => 
                                (prev.xp[type] > current.xp[type]) ? prev : current
                            );

                            // In the final list comes only greatest role
                            finalTargetRoleIds.push(highestReward.role_id);

                            // Send all other rewards of this type to deletion
                            singleTypeEarned.forEach(r => {
                                if (r.role_id !== highestReward.role_id && member.roles.cache.has(r.role_id)) {
                                    rolesToRemove.push(r.role_id);
                                }
                            });
                        }
                    });
                } else {
                    // Save all rewards
                    finalTargetRoleIds = earnedRewards.map(r => r.role_id);
                }

                // Selecting what to add (Only if user not have so)
                const rolesToAdd = finalTargetRoleIds.filter(id => !member.roles.cache.has(id));

                if (rolesToAdd.length > 0 || rolesToRemove.length > 0) {
                    // Processing changes
                    await manageRoles(member, rolesToAdd, rolesToRemove, 5, client, params.admin_cid, params.lang);

                    // Add to log only roles that was actually added
                    if (rolesToAdd.length > 0) {
                        rewardLogs.push({
                            userId: member.id,
                            roles: rolesToAdd.map(id => `<@&${id}>`)
                        });
                    }
                }
            } catch (err) {
                console.error(`[RewardProcessError] User ${userData.user_id}:`, err);
            }
        }
        // Send rewards announce
        if (params.announce_cid && params.announce_cid !== '0' && rewardLogs.length > 0) {
            try {
                const guildName = guild?.name ?? undefined;
                const guildIcon = guild?.iconURL() ?? undefined;
                const description = rewardLogs.map(log => `⭐ <@${log.userId}>\n🏆 ${log.roles.join(', ')}`).join('\n\n');             
                const rewardembed = Lunar.createEmbed(`✨ ${getL(params.lang ?? dLang, 'earnednewreward')}`, description, null, Lunar.getRandomAestheticColor(), guildName, guildIcon);
                await Lunar.sendEvent(client, params.announce_cid, null, [rewardembed]);
            } catch (e) {
                console.error(`${logprefix} Error while announce ${guild_id} in ${params.announce_cid}:`, e.message);
            }
        }
        console.log(`${logprefix} DONE ${guild.id}(${timeDiff(guildTime)}ms)`)
    }
    console.log(`${logprefix} Rewarded in ${timeDiff(startTime)}ms`);
}

module.exports = { processRewards, manageRoles };