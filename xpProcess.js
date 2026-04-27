const { timeDiff } = require('./utils.js');
const logprefix = '[XP Process]'

// Activity Buffer (Stores unique strings type 'guildId|userId|channelId')
let textActivityBuffer = new Set();

function messageActivity(gId, uId, cId) {
    // Write message data for processing. Set automaticly removes duplicate records
    textActivityBuffer.add(`${gId}|${uId}|${cId}`);
}

// Get member with retry if Rate Limited
async function safeFetchMember(guild, userId, retries = 5) {
    // Search in RAM to reduce API requests
    const cachedMember = guild.members.cache.get(userId);
    if (cachedMember) return cachedMember;

    try {
        return await guild.members.fetch({ user: userId, force: true });
    } catch (error) {
        // If ratelimited
        if ((error.status === 429 || error.message.includes('rate limited')) && retries > 0) {
            const waitTime = (error.retry_after || error.data.retry_after || 1) * 1000;
            console.warn(`${logprefix} Ratelimited! Waiting ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
            return safeFetchMember(guild, userId, retries - 1); 
        }
        return null; // If no retries left or guild member leave
    }
}

// XP counting iterations
async function processXP(client, db) {
    const startTime = Date.now();
    let guildTime;
    // 1. Swap buffer
    // Copy and clearing Set for new messages to arrive
    const currentTextData = Array.from(textActivityBuffer);
    textActivityBuffer.clear();

    if (currentTextData.length === 0 && client.guilds.cache.size === 0) return;

    // 2. Iteration random multiplier
    const randomMultiplier = 0.8 + Math.random() * 0.4;
    
    // Storage to write in DB: { "guildId|userId": { text: 0, voice: 0, video: 0 } }
    const xpUpdates = new Map();

    const addXp = (gId, uId, type, amount) => {
        const key = `${gId}|${uId}`;
        if (!xpUpdates.has(key)) xpUpdates.set(key, { text: 0, voice: 0, video: 0 });
        xpUpdates.get(key)[type] += Math.round(amount); // Without decimals
    };

    // 3. Process all guilds
    for (const guild of client.guilds.cache.values()) {
        guildTime = Date.now();
        console.log(`${logprefix} Check ${guild.id}`)
        const params = db.prepare(`SELECT * FROM guild_params WHERE guild_id = ?`).get(guild.id);
        if (!params) continue; // SKIP if guild not setted up

        // Preparing noXP lists
        const noxp_cid = params.noxp_cid ? params.noxp_cid.split(',').filter(Boolean) : [];
        const noxp_uid = params.noxp_uid ? params.noxp_uid.split(',').filter(Boolean) : [];
        const noxp_rid = params.noxp_rid ? params.noxp_rid.split(',').filter(Boolean) : [];

        // --- PHASE 1: TEXT XP ---
        if (Number(params.text_xp) !== 0) {
            // Look for messages only for the current guild
            const guildTextActivity = currentTextData.filter(str => str.startsWith(guild.id));
            
            for (const entry of guildTextActivity) {
                const [, userId, channelId] = entry.split('|');

                if (noxp_cid.includes(channelId) || noxp_uid.includes(userId)) continue;

                const member = await safeFetchMember(guild, userId);
                if (!member) continue;

                const hasBlockedRole = member.roles.cache.some(role => noxp_rid.includes(role.id));
                if (hasBlockedRole) continue;

                const gainedXp = params.text_xp_rate * randomMultiplier;
                addXp(guild.id, userId, 'text', gainedXp);
            }
        }

        // --- PHASE 2: VOICE AND VIDEO XP ---
        if (Number(params.voice_xp) !== 0 || Number(params.video_xp) !== 0) {
            // Group users to voice channels excluding bots
            const channelsWithMembers = new Map();
            for (const state of guild.voiceStates.cache.values()) {
                if (!state.channelId || state.member?.user.bot) continue;
                if (!channelsWithMembers.has(state.channelId)) channelsWithMembers.set(state.channelId, []);
                channelsWithMembers.get(state.channelId).push(state);
            }

            for (const [channelId, states] of channelsWithMembers.entries()) {
                if (noxp_cid.includes(channelId)) continue;
                if (states.length <= 1) continue; // More than 1 member required (not bots)

                // Count how many users in the channel not muted
                const unmutedCount = states.filter(s => !s.mute && !s.selfMute && !s.serverMute).length;

                // If everyone in the channel is muted
                if (unmutedCount <= 1) continue;

                for (const state of states) {
                    const userId = state.id;
                    if (noxp_uid.includes(userId)) continue;

                    const member = state.member;
                    if (!member) continue; // In case of cache miss

                    const hasBlockedRole = member.roles.cache.some(role => noxp_rid.includes(role.id));
                    if (hasBlockedRole) continue;
                    
                    // Check if muted
                    if (state.mute || state.selfMute || state.serverMute) continue;

                    if (Number(params.voice_xp) !== 0) {
                        // Add Voice XP
                        const voiceXp = params.voice_xp_rate * randomMultiplier;
                        addXp(guild.id, userId, 'voice', voiceXp);
                    }

                    // --- WEBCAM / STREAM XP ---
                    if (Number(params.video_xp) !== 0) {
                        let videoXpGained = 0;
                        
                        if (state.selfVideo) {
                            videoXpGained += params.video_xp_rate * randomMultiplier;
                        }
                        if (state.streaming) {
                            videoXpGained += (params.video_xp_rate * 0.25) * randomMultiplier;
                        }

                        if (videoXpGained > 0) {
                            addXp(guild.id, userId, 'video', videoXpGained);
                        }
                    }
                }
            }
        }
        console.log(`${logprefix} DONE ${guild.id}(${timeDiff(guildTime)}ms)`)
    }

    // 4. Write in DB using fast transaction
    if (xpUpdates.size > 0) {
        const updateDb = db.transaction((updates) => {
            const stmt = db.prepare(`
                INSERT INTO users (guild_id, user_id, text_xp, voice_xp, video_xp, last_updated)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(guild_id, user_id) DO UPDATE SET 
                    text_xp = text_xp + excluded.text_xp,
                    voice_xp = voice_xp + excluded.voice_xp,
                    video_xp = video_xp + excluded.video_xp,
                    last_updated = excluded.last_updated
            `);

            const now = Date.now();
            for (const [key, xpInfo] of updates.entries()) {
                const [guildId, userId] = key.split('|');
                stmt.run(guildId, userId, xpInfo.text, xpInfo.voice, xpInfo.video, now);
            }
        });

        updateDb(xpUpdates);
        console.log(`${logprefix} Updated Users: ${xpUpdates.size}(${timeDiff(startTime)}ms)`);
    }
};

module.exports = { processXP, messageActivity };