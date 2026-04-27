const { db } = require('../dbManager.js')
const { manageRoles } = require('../rewardProcess.js')
const { getL, Lunar, EInteractions, dLang } = require('../functions.js');
const { timeDiff } = require('../utils.js');

async function IexpifyGet(interaction, lang) {
    const startTime = Date.now();
    const type = interaction.options.getString('type');
    let data;
    let typeName;
    let footer;

    if (type === 'gain') {
        typeName = `${getL(lang ?? dLang, 'xpgaining')}`;

        // Get server settings
        const guildParams = EInteractions.loadGuildParam(`text_xp, text_xp_rate, voice_xp, voice_xp_rate, video_xp, video_xp_rate`, interaction.guildId);
        if (!guildParams) {
            console.log(`[GET] Guild ${interaction.guildId} not found in DB`);
            return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'guildnotfound')}`)
        }

        const l = (key) => getL(lang ?? dLang, key);
        data = [
            `${l('gainmultipliers')}`, 
            `## ⌨️ ${l('textxp')}`,
            `${(guildParams.text_xp > 0) ? '🟢' : '🔴'} ${(l('textxp')) + ': ' + ((guildParams.text_xp > 0) ? l('enabled') : l('disabled'))}`,
            `📈 ${guildParams.text_xp_rate}xp/${l('minute')} (${Math.floor(guildParams.text_xp_rate * 0.8)}-${Math.floor(guildParams.text_xp_rate * 1.2)}xp/${l('minute')})`,
            `## 🎙️ ${l('voicexp')}`,
            `${(guildParams.voice_xp > 0) ? '🟢' : '🔴'} ${(l('voicexp')) + ': ' + ((guildParams.voice_xp > 0) ? l('enabled') : l('disabled'))}`,
            `📈 ${guildParams.voice_xp_rate}xp/${l('minute')} (${Math.floor(guildParams.voice_xp_rate * 0.8)}-${Math.floor(guildParams.voice_xp_rate * 1.2)}xp/${l('minute')})`,
            `## 🎦 ${l('videoxp')}`,
            `${(guildParams.video_xp > 0) ? '🟢' : '🔴'} ${(l('videoxp')) + ': ' + ((guildParams.video_xp > 0) ? l('enabled') : l('disabled'))}`,
            `📈 ${guildParams.video_xp_rate}xp/${l('minute')} (${Math.floor((guildParams.video_xp_rate * 0.8) * 0.25)}-${(Math.floor(guildParams.video_xp_rate * 1.2) * 1.25)}xp/${l('minute')})`
        ]
        .join('\n');
    } else if (type === 'cid') {
        typeName = `${getL(lang ?? dLang, 'channels')}`;

        // Load Guild data
        const guildParams = EInteractions.loadGuildParam(`announce_cid, admin_cid, rank_cid`, interaction.guildId);
        if (!guildParams) {
            console.log(`[GET] Guild ${interaction.guildId} not found in DB`);
            return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'guildnotfound')}`)
        }

        const l = (key) => getL(lang ?? dLang, key);
        data = [
            `📢 ${l('announcementchannel')} - ${(guildParams.announce_cid !== '0') ? `<#${guildParams.announce_cid}>` : `${l('disabled')}`}`,
            `⚠️ ${l('warningchannel')} - ${(guildParams.admin_cid !== '0') ? `<#${guildParams.admin_cid}>` : `${l('disabled')}`}`,
            `📨 ${l('rankchannel')} - ${(guildParams.rank_cid !== '0') ? `<#${guildParams.rank_cid}>` : `${l('disabled')}`}`
        ]
        .join('\n');
    } else if (type === 'noxp') {
        const request = await EInteractions.getNoxpData(interaction, lang);
        if (!request.result) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'operationerr')}`); }
        if (request.result === 'guildnotfound') { return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'guildnotfound')}`) }
        data = request.result;
        typeName = request.type;
    } else if (type === 'reward') {
        const l = (key) => getL(lang ?? dLang, key);
        const rewards = EInteractions.getRewardsEmbedData(interaction, lang); 
        typeName = `🎖️ ${`${l('rewards')}`} (${rewards.count}/${EInteractions.maxRewards})`;
        footer = `⌨️: ${l('textxp')}, 🎙️: ${l('voicexp')}, 🎦: ${l('videoxp')}`
        data = rewards.data;
    }

    //Building response
    const guildName = interaction.guild?.name ?? undefined;
    const guildIcon = interaction.guild?.iconURL() ?? undefined;
    const getEmbed = Lunar.createEmbed(typeName, data, footer, 'ffc06e', guildName, guildIcon)
    console.log(`GET ${type} of ${interaction.guildId}(${timeDiff(startTime)}ms)`)
    await Lunar.editReply(interaction, null, [getEmbed]);
}

async function IexpifyToggle(interaction, lang, client) {
    const startTime = Date.now();
    const type = interaction.options.getString('type');
    try {
        // Invert value
        const update = db.prepare(`UPDATE guild_params SET ${type} = 1 - ${type} WHERE guild_id = ?`);
        update.run(interaction.guildId);
    } catch (err) {
        console.error(`[TOGGLE] Error while toggling xp on ${interaction.guildId}:`, err.message)
    }

    // Get new state for reply
    const newState = EInteractions.loadGuildParam(`${type}, admin_cid, lang`, interaction.guildId);

    // Check if undefined
    if (!newState) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'guildnotfound')}`) }
    
    //Building response
    let ltype;
    const l = (key) => getL(lang ?? dLang, key);
    if (type === 'text_xp') {ltype = 'textxp'} else if (type === 'voice_xp') {ltype = 'voicexp'} else if (type === 'video_xp') {ltype = 'videoxp'}
    const replycontent = `${(newState[type] > 0) ? '🟢' : '🔴'} ${l(ltype)} ${(newState[type] > 0) ? `${l('enabled')}` : `${l('disabled')}`}!`
    console.log(`Toggle ${type} for ${interaction.guildId}(${timeDiff(startTime)}ms)`)

    // Send notification
    if (newState.admin_cid && newState.admin_cid !== '0' ) {
        await Lunar.sendEventEmbed(`/expify toggle ${type}`, `<@${interaction.user.id}>`, null, `${replycontent}`, interaction.guild, newState.admin_cid, newState.lang, client);
    };

    await Lunar.editReply(interaction, replycontent);
}

async function IexpifyGain(interaction, lang, client) {
    const startTime = Date.now();
    const type = interaction.options.getString('type');
    let quantity = interaction.options.getInteger('quantity');
    let dbtype;
    let status;

    // Check if guild not exist
    const probe = EInteractions.loadGuildParam(`admin_cid, lang`, interaction.guildId);
    if (!probe) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'guildnotfound')}`) }

    // To XP rate
    if (type === 'text_xp') {dbtype = 'text_xp_rate'} else if (type === 'voice_xp') {dbtype = 'voice_xp_rate'} else if (type === 'video_xp') {dbtype = 'video_xp_rate'}

    // Default if not provided
    if (!quantity) { 
        if (type === 'text_xp') {quantity = EInteractions.defaultTextXP} else if (type === 'voice_xp') {quantity = EInteractions.defaultVoiceXP} else if (type === 'video_xp') {quantity = EInteractions.defaultVideoXP}
    }

    if (EInteractions.updateGuildParam(dbtype, quantity, interaction.guildId)) {
        status = `🟢 ${getL(lang ?? dLang, 'updated')}`
    } else {
        status = `🟡 ${getL(lang ?? dLang, 'notupdated')}`
    }

    //Building response
    console.log(`Updated ${type} for ${interaction.guildId}(${timeDiff(startTime)}ms)`)

    // Send notification
    if (probe.admin_cid && probe.admin_cid !== '0' ) {
        await Lunar.sendEventEmbed(`/expify gain ${type} ${quantity}`, `<@${interaction.user.id}>`, null, `${status}`, interaction.guild, probe.admin_cid, probe.lang, client);
    };

    await Lunar.editReply(interaction, status);
}

async function IexpifyCIDs(interaction, lang) {
    const startTime = Date.now();
    const type = interaction.options.getString('type');
    const channel = interaction.options.getChannel('channel');
    let status;

    // Check if guild not exist
    const probe = EInteractions.loadGuildParam(`text_xp_rate`, interaction.guildId);
    if (!probe) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'guildnotfound')}`) }

    // Reset settings
    if (!channel) {
        if (EInteractions.updateGuildParam(type, '0', interaction.guildId)) {
            status = `🟢 ${getL(lang ?? dLang, 'updated')}`
        } else {
            status = `🟡 ${getL(lang ?? dLang, 'notupdated')}`
        }
        console.log(`Reset ${type} for ${interaction.guildId}(${timeDiff(startTime)}ms)`)
        return await Lunar.editReply(interaction, status);
    }

    // Check if channel not on the same server
    if (channel.guild.id !== interaction.guildId) {
        return await Lunar.editReply(interaction, `⛔ ${getL(lang ?? dLang, 'servermismatch')}`);
    }

    // Check if we have access to channel
    const permissions = channel.permissionsFor(interaction.client.user);
    if (!permissions.has(['SendMessages'])) {
        return await Lunar.editReply(interaction, `⛔ ${getL(lang ?? dLang, 'missingpermissions')}`);
    }

    // Get object ID
    const channelId = channel.id;
    if (EInteractions.updateGuildParam(type, `${channelId}`, interaction.guildId)) {
        status = `🟢 ${getL(lang ?? dLang, 'updated')}`
    } else {
        status = `🟡 ${getL(lang ?? dLang, 'notupdated')}`
    }

    console.log(`Updated ${type} for ${interaction.guildId}(${timeDiff(startTime)}ms)`)
    await Lunar.editReply(interaction, status);
}

async function IexpifyReset(interaction, lang) {
    let status;

    // Check confirmation
    if (EInteractions.checkConfirmation(interaction)) { return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'guildresetabort')}`); }

    const resetTime = Date.now();
    console.log(`Defaulting Guild ${interaction.guildId}`)
    try {
        const setDefault = db.prepare(`
            INSERT INTO guild_params (
                guild_id, text_xp, text_xp_rate, voice_xp, voice_xp_rate, video_xp, video_xp_rate,
                noxp_cid, noxp_uid, noxp_rid, announce_cid, admin_cid, rank_cid, reward_mode
            ) VALUES (
                @guild_id, @text_xp, @text_xp_rate, @voice_xp, @voice_xp_rate, @video_xp, @video_xp_rate,
                @noxp_cid, @noxp_uid, @noxp_rid, @announce_cid, @admin_cid, @rank_cid, @reward_mode
            )
            ON CONFLICT(guild_id) DO UPDATE SET
                text_xp = excluded.text_xp,
                text_xp_rate = excluded.text_xp_rate,
                voice_xp = excluded.voice_xp,
                voice_xp_rate = excluded.voice_xp_rate,
                video_xp = excluded.video_xp,
                video_xp_rate = excluded.video_xp_rate,
                noxp_cid = excluded.noxp_cid,
                noxp_uid = excluded.noxp_uid,
                noxp_rid = excluded.noxp_rid,
                announce_cid = excluded.announce_cid,
                admin_cid = excluded.admin_cid,
                rank_cid = excluded.rank_cid,
                reward_mode = excluded.reward_mode
        `);

        const resetRewards = db.prepare(`DELETE FROM role_rewards WHERE guild_id = ?`)

        setDefault.run({
            guild_id: `${interaction.guildId ?? 0}`, text_xp: 1, text_xp_rate: 20, voice_xp: 1, voice_xp_rate: 10,
            video_xp: 1, video_xp_rate: 20, noxp_cid: '', noxp_uid: '', noxp_rid: '', announce_cid: '0', admin_cid: '0', rank_cid: '0', reward_mode: 0
        });
        resetRewards.run(`${interaction.guildId}`)
        status = 'guildresetok'
    } catch (err) {
        status = 'operationerr'
        console.error(`Error while resetting Guild ${interaction.guildId}:`, err)
    }

    console.log(`Reset Guild ${interaction.guildId} (${timeDiff(resetTime)}ms)`)

    //Building response
    let replycontent = `${getL(lang ?? dLang, `${status}`)}`;
    await Lunar.editReply(interaction, replycontent);
}

async function IexpifyXpReset(client, interaction, lang) {
    let status;

    // Check confirmation
    if (EInteractions.checkConfirmation(interaction)) { return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'guildresetabort')}`); }
    
    const resetTime = Date.now();

    // Check if guild not exist
    const probe = EInteractions.loadGuildParam(`admin_cid, lang`, interaction.guildId);
    if (!probe) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'guildnotfound')}`) };

    console.log(`Resetting user progress of ${interaction.guildId} by ${interaction.user.id}`)
    try {
        const resetRewards = db.prepare(`DELETE FROM users WHERE guild_id = ?`);
        resetRewards.run(`${interaction.guildId}`);
        status = 'operationok'
    } catch (err) {
        status = 'operationerr'
        console.error(`Error while resetting Guild ${interaction.guildId}:`, err);
    }
    console.log(`Reset user progress ${interaction.guildId}(${timeDiff(resetTime)}ms)`)

    if (status === 'operationok' && probe.admin_cid && probe.admin_cid !== '0' ) {
        await Lunar.sendEventEmbed(`/expify xp-reset`, `<@${interaction.user.id}>`, null, `${getL(probe.lang ?? dLang, 'resetxpcallback')}`, interaction.guild, probe.admin_cid, probe.lang, client)
    }

    //Building response
    let replycontent = `${getL(lang ?? dLang, `${status}`)}`;
    await Lunar.editReply(interaction, replycontent);
}

async function IexpifyMigrate(client, interaction, lang) {
    // Check confirmation
    if (EInteractions.checkConfirmation(interaction)) { return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'guildresetabort')}`); }

    const startTime = Date.now();

    // Check if guild not exist
    const probe = EInteractions.loadGuildParam(`admin_cid, lang`, interaction.guildId);
    if (!probe) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'guildnotfound')}`) }

    // Check if cooldown
    const migrate = EInteractions.loadGuildLimit(`migrate_1`, interaction.guildId);
    const lastMigration = migrate?.migrate_1 ?? 0;
    if (lastMigration && lastMigration + EInteractions.cooldownMigrate > startTime) { return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'cooldowndetected')} <t:${Math.floor((lastMigration + EInteractions.cooldownMigrate) / 1000)}:F>`); }

    const guildId = interaction.guildId;
    let errorcnt = 0;
    let rewards;
    let rewardsMap;
    let members;

    // Get all guild rewards
    try {  
        rewards = db.prepare("SELECT role_id, xp_required FROM role_rewards WHERE guild_id = ?").all(guildId);
    } catch (err) {
        console.error(`[MIGRATE] Error while reading role_rewards ${guildId}:`, err);
        errorcnt = ++errorcnt;
    }
    
    // Check if no rewards
    if (rewards.length === 0) {
        return await Lunar.editReply(interaction, `❌ ${getL(lang ?? dLang, 'rewardsempty')}`);
    }

    try {
        // Parse rewards in Map for fast search
        // Result example: { 'role_id': { text: 0, voice: 250, video: 0 }, ... }
        rewardsMap = new Map();
        for (const reward of rewards) {
            const [text, voice, video] = reward.xp_required.split(',').map(Number);
            rewardsMap.set(reward.role_id, { text, voice, video });
        }
    } catch (err) {
        console.error(`[MIGRATE] Error while mapping rewards ${guildId}:`, err);
        errorcnt = ++errorcnt;
    }

    // Fetch ALL Guild members
    members = await EInteractions.fetchMembersWithRetry(interaction.guild);

    // Check if members missing
    if (!members) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'operationerr')}`); }

    // Collecting Userdata into array
    const usersToUpdate = [];
    
    for (const [memberId, member] of members) {
        try {
            if (member.user.bot) continue; // Bots are noXP

            let maxText = 0;
            let maxVoice = 0;
            let maxVideo = 0;
            let hasRewardRole = false;

            // Check every user role
            for (const roleId of member.roles.cache.keys()) {
                if (rewardsMap.has(roleId)) {
                    hasRewardRole = true;
                    const reqs = rewardsMap.get(roleId);
                    
                    // For less linear top use xp multiplier from x1 to x1.025 for every type
                    const multiplier = () => { const random = Math.random() * (1.0250 - 1.0) + 1.0;
                        return random;
                    }

                    // Select maximum integer of every type
                    maxText = Math.floor(Math.max(maxText, reqs.text) * multiplier());
                    maxVoice = Math.floor(Math.max(maxVoice, reqs.voice) * multiplier());
                    maxVideo = Math.floor(Math.max(maxVideo, reqs.video) * multiplier());
                }
            }

            // If user have at least one role reward, preparing to write it
            if (hasRewardRole) {
                usersToUpdate.push({
                    guild_id: guildId,
                    user_id: memberId,
                    text_xp: maxText,
                    voice_xp: maxVoice,
                    video_xp: maxVideo
                });
            }
        } catch (err) {
            console.error(`[MIGRATE] Error in userdata array ${guildId}:`, err);
            errorcnt = ++errorcnt;
        }
    }

    // Write all collected data into database using transaction
    const syncUsers = db.transaction((users) => {
        try {
            const stmt = db.prepare(`
                INSERT INTO users (guild_id, user_id, text_xp, voice_xp, video_xp)
                VALUES (@guild_id, @user_id, @text_xp, @voice_xp, @video_xp)
                ON CONFLICT(guild_id, user_id) DO UPDATE SET 
                    text_xp = MAX(users.text_xp, excluded.text_xp),
                    voice_xp = MAX(users.voice_xp, excluded.voice_xp),
                    video_xp = MAX(users.video_xp, excluded.video_xp)
            `);
            
            for (const user of users) {
                stmt.run(user);
            }
        } catch (err) {
            console.error(`[MIGRATE] Error while performing transaction for ${guildId}:`, err);
            errorcnt = ++errorcnt;
        }
    });

    // Start transaction
    syncUsers(usersToUpdate);

    // Set last migration date
    if (!errorcnt) { EInteractions.setGuildLimit(`migrate_1`, guildId, startTime) }

    //Building response
    const l = (key) => getL(lang ?? dLang, key);
    let replycontent = `✅ ${l('migratecomplete')} **${usersToUpdate.length}**! ${(errorcnt) ? `\n\n${l('operationerr')}: ${errorcnt}` : ' '}`;

    console.log(`[MIGRATE] Updated ${usersToUpdate.length} users in ${interaction.guildId}(${timeDiff(startTime)}ms)`);

    // Send notification
    const mentionString = Array.from(rewardsMap.keys())
        .map(roleId => `<@&${roleId}>`)
        .join(', ');
    if (probe.admin_cid && probe.admin_cid !== '0' ) {
        const ld = (key) => getL(probe.lang ?? dLang, key);
        await Lunar.sendEventEmbed(`/expify migrate`, `<@${interaction.user.id}>`, mentionString, `✅ ${ld('migratecomplete')} **${usersToUpdate.length}**! ${(errorcnt) ? `\n\n${ld('operationerr')}: ${errorcnt}` : ' '}`, interaction.guild, probe.admin_cid, probe.lang, client);
    }

    await Lunar.editReply(interaction, replycontent);
}

/** Check and remove roles from users that not match requirements */
async function IexpifyCleanupRewards(client, interaction, lang) {
    const startTime = Date.now();

    // Check confirmation
    if (EInteractions.checkConfirmation(interaction)) { return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'guildresetabort')}`); }
    const guild = interaction.guild;

    // Check if guild not exist
    const probe = EInteractions.loadGuildParam(`admin_cid, lang`, interaction.guildId);
    if (!probe) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'guildnotfound')}`) }

    // Check if cooldown
    const cooldown = EInteractions.loadGuildLimit(`reward_cleanup`, interaction.guildId);
    const lastCleanup = cooldown?.reward_cleanup ?? 0;
    if (lastCleanup && lastCleanup + EInteractions.cooldownRewardCleanup > startTime) { return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'cooldowndetected')} <t:${Math.floor((lastCleanup + EInteractions.cooldownRewardCleanup) / 1000)}:F>`); }

    let errorcnt = 0;
    let allRewards;
    let parsedRewards;
    let rewardRoleIds;
    let members;

    try {
        // Preload guild rewards
        allRewards = db.prepare("SELECT * FROM role_rewards WHERE guild_id = ?").all(guild.id);
    } catch (err) {
        console.error(`[CLEANUP] Error while reading role_rewards ${guild.id}:`, err);
        errorcnt = ++errorcnt;
    }
        
    // Check if no rewards
    if (allRewards.length === 0) { return await Lunar.editReply(interaction, `❌ ${getL(lang ?? dLang, 'rewardsempty')}`); }

    try {
        // Parse rewards and their requirements
        parsedRewards = allRewards.map(r => {
            const [text, voice, video] = r.xp_required.split(',').map(Number);
            return { role_id: r.role_id, req: { text, voice, video } };
        });
        rewardRoleIds = new Set(parsedRewards.map(r => r.role_id));
    } catch (err) {
        console.error(`[CLEANUP] Error while mapping rewards ${guild.id}:`, err);
        errorcnt = ++errorcnt;
    }

    // Fetch ALL Guild members
    members = await EInteractions.fetchMembersWithRetry(guild);

    // Check if members missing
    if (!members) { return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'operationerr')}`); }

    let removedCount = 0;

    // Prepare request for gathering user XP
    const getUserStmt = db.prepare("SELECT text_xp, voice_xp, video_xp FROM users WHERE guild_id = ? AND user_id = ?");

    // Check every member
    for (const [memberId, member] of members) {
            // Skip bots
            if (member.user.bot) continue;
        try {
            // Get user XP
            const userData = getUserStmt.get(guild.id, memberId) || { text_xp: 0, voice_xp: 0, video_xp: 0 };

            // Decide which role requirements user matches
            const earnedRoleIds = new Set();
            for (const reward of parsedRewards) {
                if (userData.text_xp >= reward.req.text && 
                    userData.voice_xp >= reward.req.voice && 
                    userData.video_xp >= reward.req.video) {
                    earnedRoleIds.add(reward.role_id);
                }
            }

            // Find roles that need to be removed
            // If member has a role that set as reward and user does not have required xp to have this role
            const rolesToRemove = [];
            for (const roleId of member.roles.cache.keys()) {
                if (rewardRoleIds.has(roleId) && !earnedRoleIds.has(roleId)) {
                    rolesToRemove.push(roleId);
                }
            }

            // Remove roles if find at least one
            if (rolesToRemove.length > 0) {
                // Use rewards module to remove roles with array
                await manageRoles(member, [], rolesToRemove, 5, client, probe.admin_cid, probe.lang);
                ++removedCount;
            }
        } catch (err) {
            console.error(`[CLEANUP] Error while updating user ${memberId}:`, err);
        }
    };

    // Set last cleanup date
    if (!errorcnt) { EInteractions.setGuildLimit(`reward_cleanup`, guild.id, startTime) }

    //Building response
    const l = (key) => getL(lang ?? dLang, key);
    let replycontent = `✅ ${l('cleanupcomplete')} **${removedCount}**! ${(errorcnt) ? `\n\n${l('operationerr')}: ${errorcnt}` : ' '}`;

    console.log(`[CLEANUP] Updated ${removedCount} users in ${guild.id}(${timeDiff(startTime)}ms)`);

    // Send notification
    if (probe.admin_cid && probe.admin_cid !== '0' ) {
        const ld = (key) => getL(probe.lang ?? dLang, key);
        await Lunar.sendEventEmbed(`/expify cleanup-rewards`, `<@${interaction.user.id}>`, null, `✅ ${ld('cleanupcomplete')} **${removedCount}**! ${(errorcnt) ? `\n\n${ld('operationerr')}: ${errorcnt}` : ' '}`, interaction.guild, probe.admin_cid, probe.lang, client);
    }

    await Lunar.editReply(interaction, replycontent);
}

module.exports = { IexpifyGet, IexpifyToggle, IexpifyGain, IexpifyCIDs, IexpifyReset, IexpifyXpReset, IexpifyMigrate, IexpifyCleanupRewards };