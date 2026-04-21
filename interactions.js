const { timeDiff, getL, renderProgressBar, calculatePercentage, Lunar, XpLeveling } = require('./functions.js');
const { MessageFlags } = require('discord.js');
const { db } = require('./dbManager.js')

// Discord User Interactions
class Expify {

    //Defaults
    // Default Text XP gain
    static defaultTextXP = 20;
    // Default Voice XP gain
    static defaultVoiceXP = 10;
    // Default Video XP gain
    static defaultVideoXP = 20;

    // Limits
    // Max rewards per guild
    static maxRewards = 30;
    // Max NoXP Channels
    static maxNoxpCid = 10;
    // Max NoXP Users
    static maxNoxpUid = 10;
    // Max NoXP Roles
    static maxNoxpRid = 5;
    // Maximum XP
    static maxUserXp = 160280000;
    // Maximum LVL
    static maxUserLevel = XpLeveling.getLevel(this.maxUserXp);
    // Migrate cooldown
    static cooldownMigrate = 3600000 * 24 * 7;

    /** Update guild_params object in database
     * @param {string} type - Column Name (example: 'text_xp')
     * @param {number|string} value - New Value
     * @param {string} guildId - GuildID */
    static updateGuildParam(type, value, guildId) {
        let result;
        try {
            const stmt = db.prepare(`UPDATE guild_params SET ${type} = ? WHERE guild_id = ?`);
            result = stmt.run(value, guildId);
        } catch (err) {
            console.error(`[GuildParam] Error while updating object ${type} in ${guildId}:`, err)
        }

        return !!result?.changes; // Return true if updated
    }

    /** Update users object in database. last_updated replaced automaticly
     * @param {string} guildId - Guild ID
     * @param {string} userId - User ID
     * @param {number} textXp - text_xp to write
     * @param {number} voiceXp - voice_xp to write
     * @param {number} videoXp - video_xp to write */
    static updateUsersXP(guildId, userId, textXp, voiceXp, videoXp) {
        let result;
        const updated = Date.now();
        try {
            const stmt = db.prepare(`
                INSERT INTO users (guild_id, user_id, text_xp, voice_xp, video_xp, last_updated) 
                VALUES (@guild_id, @user_id, @text_xp, @voice_xp, @video_xp, @last_updated)
                ON CONFLICT(guild_id, user_id) DO UPDATE SET 
                    text_xp = excluded.text_xp,
                    voice_xp = excluded.voice_xp,
                    video_xp = excluded.video_xp,
                    last_updated = excluded.last_updated
            `)
            result = stmt.run({
                guild_id: guildId,
                user_id: userId,
                text_xp: textXp,
                voice_xp: voiceXp,
                video_xp: videoXp,
                last_updated: updated
            });
        } catch (err) {
            console.error(`[USERS] Error while updating object in ${guildId},${userId}:`, err)
        }

        return !!result?.changes; // Return true if updated
    }

    /* Common method for getting all guild rewards for description field of embed message.
     * Usage is: data = Expify.getRewardsEmbedData(interaction, lang) */
    static getRewardsEmbedData(interaction, lang) {
        let getRewards;
        let rewards;
        let data;

        // Check if guild not exist
        const params = db.prepare("SELECT reward_mode FROM guild_params WHERE guild_id = ?").get(`${interaction.guildId}`);
        if (!params) { return `${getL( lang ?? 'ru', 'guildnotfound')}` }

        try {
            // Get rewards for guild
            getRewards = db.prepare(`SELECT * FROM role_rewards WHERE guild_id = ?`);
            rewards = getRewards.all(`${interaction.guildId}`)
        } catch (err) {
            console.error(`[GET] Error while loading guild rewards:`, err)
        }
        // Empty list when no data
        if (rewards.length === 0) {
            data = `${(lang !== null) ? getL(lang, 'listempty') : 'List Empty'}`;
        } else {
            // Formatting data
            data = rewards.map(row => {
                // Split XP types
                const [textXp, voiceXp, videoXp] = row.xp_required.split(',').map(Number);
                
                // Compile an array only if condition > 0
                const conditions = [];
                if (textXp > 0) conditions.push(`(⌨️ ${XpLeveling.getLevel(textXp)} LVL)`);
                if (voiceXp > 0) conditions.push(`(🎙️ ${XpLeveling.getLevel(voiceXp)} LVL)`);
                if (videoXp > 0) conditions.push(`(🎦 ${XpLeveling.getLevel(videoXp)} LVL)`);

                // Join conditions
                const conditionsText = conditions.join(' + ');

                // Return a string
                return `**ID: ${row.id}** - <@&${row.role_id}> ${conditionsText}`;
            }).join('\n');
        }

        return `${data}\n### ${getL( lang ?? 'ru', 'rewardmode')}\n${(params.reward_mode > 0) ? getL( lang ?? 'ru', 'rewardmodetoponly') : getL( lang ?? 'ru', 'rewardmodeall')}`;
    }
    
    static fetchMembersWithRetry = async function(guild, retries = 5) {
        try {
            return await guild.members.fetch({ force: true, time: 120000 });
        } catch (error) {
            // Check if ratelimited
            if (error.status === 429 || error.message.includes('rate limited')) {
                // Taking retry after or default retry
                const waitTime = (error.data.retry_after || 1) * 1000;

                console.warn(`[RateLimit] Limit reached. Waiting ${waitTime}ms...`);

                // Waiting
                await new Promise(resolve => setTimeout(resolve, waitTime));

                // Retry
                if (retries > 0) {
                    return await Expify.fetchMembersWithRetry(guild, retries - 1);
                }
            }
            console.error(`Error while fetching members of ${guild.id}:`, error.message); // If no left retries or other error
        }
    }

    static ping = async function(interaction, client, lang) {
        //Counting latency
        const latency = Date.now() - interaction.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);

        let replycontent;
        if (lang) {
            // Helper to resolve locales
            const l = (key) => getL(lang, key);

            //Building response
            replycontent = `:ping_pong: *${l('pong')}!* ${l('latency')} ${latency} ${l('milliseconds')}! ${l('apilatency')} ${apiLatency} ${l('milliseconds')}.`;
        } else {
            //if locale not supported
            replycontent = `:ping_pong: *Pong!* Latency ${latency} ms! API Latency ${apiLatency} ms.`;
        }
        await Lunar.reply(interaction, replycontent, true);
    };

    static about = async function(interaction, lang, corever) {
        //Building response
        let replycontent;
        if (lang) {
            const l = (key) => getL(lang, key);
            replycontent = `${l('aboutcmd')} \n:sparkles: ${l('coreversion')} ${corever} \n\n ${l('aboutanounce')}`;
        } else {
            replycontent = `:knot: Expify - Локальное продвинутое серверное приложение для честного рассчёта опыта за активность на сервере\n:sparkles: Версия ядра: ${corever} \n\n${getL('ru', 'aboutanounce')}`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };

    static invite = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'invitecmd')}`;
        } else {
            replycontent = `:gift_heart: Expify пока-что является приватным приложением. Свяжитесь с владельцем <@459657842895486977>`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };

    static expifyGet = async function(interaction, lang) {
        const startTime = Date.now();
        const type = interaction.options.getString('type');
        let data;
        let typeName;
        let footer;

        if (type === 'gain') {
            typeName = (lang !== null) ? `${getL(lang, 'xpgaining')}` : 'XP Gaining';

            let getSettings;
            let guildParams;
            try {
                // Get server settings
                getSettings = db.prepare(`
                    SELECT text_xp, text_xp_rate, voice_xp, voice_xp_rate, video_xp, video_xp_rate
                    FROM guild_params WHERE guild_id = ?
                `);
                guildParams = getSettings.get(`${interaction.guildId}`)
            } catch (err) {
                console.error(`[GET] Error while loading guild configuration:`, err)
            }

            if (!guildParams) {
                console.log(`[GET] Guild ${interaction.guildId} not found in DB`);
                return await Lunar.editReply(interaction, `${getL('ru', 'guildnotfound')}`)
            }

            data = [
                (lang !== null) ? `${getL(lang, 'gainmultipliers')}` : `Default multipliers per minute for all types are random: ~0.8x-1.2x.\n\nStreams gives user (0.25x)VideoXP while Webcam gives full VideoXP. VideoXP is also combined when webcam and steam enabled (So max video multiplier is 1.25x)`, 
                (lang !== null) ? `## ⌨️ ${getL(lang, 'textxp')}` : '## ⌨️ Text XP',
                `${(guildParams.text_xp > 0) ? '🟢' : '🔴'} ${(lang !== null) ? (getL(lang, 'textxp')) + ': ' + ((guildParams.text_xp > 0) ? getL(lang, 'enabled') : getL(lang, 'disabled')) : 'Text XP ' + ((guildParams.text_xp > 0) ? 'Enabled' : 'Disabled')}`,
                `📈 ${guildParams.text_xp_rate}xp/${(lang !== null) ? getL(lang, 'minute') : 'minute'} (${Math.floor(guildParams.text_xp_rate * 0.8)}-${Math.floor(guildParams.text_xp_rate * 1.2)}xp/${(lang !== null) ? getL(lang, 'minute') : 'minute'})`,
                (lang !== null) ? `## 🎙️ ${getL(lang, 'voicexp')}` : '## 🎙️ Voice XP',
                `${(guildParams.voice_xp > 0) ? '🟢' : '🔴'} ${(lang !== null) ? (getL(lang, 'voicexp')) + ': ' + ((guildParams.voice_xp > 0) ? getL(lang, 'enabled') : getL(lang, 'disabled')) : 'Voice XP ' + ((guildParams.voice_xp > 0) ? 'Enabled' : 'Disabled')}`,
                `📈 ${guildParams.voice_xp_rate}xp/${(lang !== null) ? getL(lang, 'minute') : 'minute'} (${Math.floor(guildParams.voice_xp_rate * 0.8)}-${Math.floor(guildParams.voice_xp_rate * 1.2)}xp/${(lang !== null) ? getL(lang, 'minute') : 'minute'})`,
                (lang !== null) ? `## 🎦 ${getL(lang, 'videoxp')}` : '## 🎦 Video XP',
                `${(guildParams.video_xp > 0) ? '🟢' : '🔴'} ${(lang !== null) ? (getL(lang, 'videoxp')) + ': ' + ((guildParams.video_xp > 0) ? getL(lang, 'enabled') : getL(lang, 'disabled')) : 'Video XP ' + ((guildParams.video_xp > 0) ? 'Enabled' : 'Disabled')}`,
                `📈 ${guildParams.video_xp_rate}xp/${(lang !== null) ? getL(lang, 'minute') : 'minute'} (${Math.floor((guildParams.video_xp_rate * 0.8) * 0.25)}-${(Math.floor(guildParams.video_xp_rate * 1.2) * 1.25)}xp/${(lang !== null) ? getL(lang, 'minute') : 'minute'})`
            ]
            .join('\n');
        } else if (type === 'cid') {
            typeName = (lang !== null) ? `${getL(lang, 'channels')}` : 'Channels';
            let getSettings;
            let guildParams;
            try {
                // Get server settings
                getSettings = db.prepare(`
                    SELECT announce_cid, admin_cid, rank_cid
                    FROM guild_params WHERE guild_id = ?
                `);
                guildParams = getSettings.get(`${interaction.guildId}`)
            } catch (err) {
                console.error(`[GET] Error while loading guild configuration:`, err)
            }

            if (!guildParams) {
                console.log(`[GET] Guild ${interaction.guildId} not found in DB`);
                return await Lunar.editReply(interaction, `${getL('ru', 'guildnotfound')}`)
            }

            data = [
                `📢 ${(lang !== null) ? getL(lang, 'announcementchannel') : 'Announcement Channel'} - ${(guildParams.announce_cid !== '0') ? `<#${guildParams.announce_cid}>` : `${(lang !== null) ? getL(lang, 'disabled') : 'Disabled'}`}`,
                `⚠️ ${(lang !== null) ? getL(lang, 'warningchannel') : 'Admin Warnings Channel'} - ${(guildParams.admin_cid !== '0') ? `<#${guildParams.admin_cid}>` : `${(lang !== null) ? getL(lang, 'disabled') : 'Disabled'}`}`,
                `📨 ${(lang !== null) ? getL(lang, 'rankchannel') : 'Public Rank Check Channel'} - ${(guildParams.rank_cid !== '0') ? `<#${guildParams.rank_cid}>` : `${(lang !== null) ? getL(lang, 'disabled') : 'Disabled'}`}`
            ]
            .join('\n');
        } else if (type === 'noxp') {
            typeName = (lang !== null) ? `${getL(lang, 'noxpentities')}` : 'NoXP entities';
            let getSettings;
            let guildParams;
            try {
                // Get server settings
                getSettings = db.prepare(`
                    SELECT noxp_cid, noxp_uid, noxp_rid
                    FROM guild_params WHERE guild_id = ?
                `);
                guildParams = getSettings.get(`${interaction.guildId}`)
            } catch (err) {
                console.error(`[GET] Error while loading guild configuration:`, err)
            }

            if (!guildParams) {
                console.log(`[GET] Guild ${interaction.guildId} not found in DB`);
                return await Lunar.editReply(interaction, `${getL('ru', 'guildnotfound')}`)
            }

            // Channels Data
            let cids;
            let cidCnt;
            if (guildParams.noxp_cid && guildParams.noxp_cid.trim() !== '') {
                // Split by ',' and join with newline
                cids = guildParams.noxp_cid
                .split(',')
                .map(id => id.trim()) // Erase spaces
                .filter(id => id.length > 0) // Remove null
                .map(id => `<#${id}>`) // Format mention
                .join('\n');
                cidCnt = guildParams.noxp_cid.split(',').length;
            } else {
                cids = `${(lang !== null) ? getL(lang, 'listempty') : 'List Empty'}`;
                cidCnt = 0
            }

            // Users Data
            let uids;
            let uidCnt;
            if (guildParams.noxp_uid && guildParams.noxp_uid.trim() !== '') {
                // Split by ',' and join with newline
                uids = guildParams.noxp_uid
                .split(',')
                .map(id => id.trim()) // Erase spaces
                .filter(id => id.length > 0) // Remove null
                .map(id => `<@${id}>`) // Format mention
                .join('\n');
                uidCnt = guildParams.noxp_uid.split(',').length;
            } else {
                uids = `${(lang !== null) ? getL(lang, 'listempty') : 'List Empty'}`;
                uidCnt = 0
            }

            // Roles Data
            let rids;
            let ridCnt;
            if (guildParams.noxp_rid && guildParams.noxp_rid.trim() !== '') {
                // Split by ',', make mentionable format and join with newline
                rids = guildParams.noxp_rid
                .split(',')
                .map(id => id.trim()) // Erase spaces
                .filter(id => id.length > 0) // Remove null
                .map(id => `<@&${id}>`) // Format mention
                .join('\n');
                ridCnt = guildParams.noxp_rid.split(',').length;
            } else {
                rids = `${(lang !== null) ? getL(lang, 'listempty') : 'List Empty'}`;
                ridCnt = 0
            }

            data = [
                `## 💬 ${(lang !== null) ? getL(lang, 'channels') : 'Channels'} (${cidCnt}/${Expify.maxNoxpCid})`,
                cids,
                `## 👥 ${(lang !== null) ? getL(lang, 'users') : 'Users'} (${uidCnt}/${Expify.maxNoxpUid})`,
                uids,
                `## 🏷️ ${(lang !== null) ? getL(lang, 'roles') : 'Roles'} (${ridCnt}/${Expify.maxNoxpRid})`,
                rids
            ]
            .join('\n');
        } else if (type === 'reward') {
            typeName = (lang !== null) ? `${getL(lang, 'rewards')}` : 'Rewards';
            footer = `⌨️: ${(lang !== null) ? getL(lang, 'textxp') : 'Text XP'}, 🎙️: ${(lang !== null) ? getL(lang, 'voicexp') : 'Voice XP'}, 🎦: ${(lang !== null) ? getL(lang, 'videoxp') : 'Video XP'}`
            data = Expify.getRewardsEmbedData(interaction, lang);
        }

        //Building response
        const guildName = interaction.guild?.name ?? undefined;
        const guildIcon = interaction.guild?.iconURL() ?? undefined;
        const getEmbed = Lunar.createEmbed(typeName, data, footer, 'ffc06e', guildName, guildIcon)
        console.log(`GET ${type} of ${interaction.guildId}(${timeDiff(startTime)}ms)`)
        await Lunar.editReply(interaction, null, [getEmbed]);
    };
    
    static expifyToggle = async function(interaction, lang) {
        const startTime = Date.now();
        const type = interaction.options.getString('type');
        try {
            // Invert value
            const update = db.prepare(`UPDATE guild_params SET ${type} = 1 - ${type} WHERE guild_id = ?`);
            update.run(interaction.guildId);
        } catch (err) {
            console.error(`[TOGGLE] Error while toggling xp on ${interaction.guildId}:`, err)
        }
        // Get new state for reply. Returns [object Object] so we need to get new state as { [type]: newState } to get integer
        const newState = db.prepare(`SELECT ${type} FROM guild_params WHERE guild_id = ?`).get(interaction.guildId);

        // Check if undefined
        if (!newState) { return await Lunar.editReply(interaction, `${getL( lang ?? 'ru', 'guildnotfound')}`) }
        
        //Building response
        let ltype;
        if (type === 'text_xp') {ltype = 'textxp'} else if (type === 'voice_xp') {ltype = 'voicexp'} else if (type === 'video_xp') {ltype = 'videoxp'}
        const replycontent = `${(newState > 0) ? '🟢' : '🔴'} ${(lang !== null) ? getL(lang, ltype) : getL('ru', ltype)} ${(newState > 0) ? `${(lang !== null) ? getL(lang, 'enabled') : 'Enabled'}` : `${(lang !== null) ? getL(lang, 'disabled') : 'Disabled'}`}!`
        console.log(`Toggle ${type} for ${interaction.guildId}(${timeDiff(startTime)}ms)`)
        await Lunar.editReply(interaction, replycontent);
    };

    static expifyGain = async function(interaction, lang) {
        const startTime = Date.now();
        const type = interaction.options.getString('type');
        let quantity = interaction.options.getInteger('quantity');
        let dbtype;
        let status;

        // To XP rate
        if (type === 'text_xp') {dbtype = 'text_xp_rate'} else if (type === 'voice_xp') {dbtype = 'voice_xp_rate'} else if (type === 'video_xp') {dbtype = 'video_xp_rate'}

        // Default if not provided
        if (!quantity) { 
            if (type === 'text_xp') {quantity = Expify.defaultTextXP} else if (type === 'voice_xp') {quantity = Expify.defaultVoiceXP} else if (type === 'video_xp') {quantity = Expify.defaultVideoXP}
        }

        if (Expify.updateGuildParam(dbtype, quantity, interaction.guildId)) {
            status = `🟢 ${(lang !== null) ? getL(lang, 'updated') : `Value successfuly updated!`}`
        } else {
            status = `🟡 ${(lang !== null) ? getL(lang, 'notupdated') : `Value was not updated!`}`
        }

        //Building response
        console.log(`Updated ${type} for ${interaction.guildId}(${timeDiff(startTime)}ms)`)
        await Lunar.editReply(interaction, status);
    };

    /** Interaction for managing guild_params CIDs
     * @param {interaction} interaction - Interaction object
     * @param {string|null} lang - Language code string. Null if language missing in locales 
     * @param {string} type - 'any_cid' column in guild_params table */
    static expifyCIDs = async function(interaction, lang, type) {
        const startTime = Date.now();
        const channel = interaction.options.getChannel('channel');
        let status;

        // Check if guild not exist
        const probe = db.prepare("SELECT text_xp_rate FROM guild_params WHERE guild_id = ?").get(`${interaction.guildId}`);
        if (!probe) { return await Lunar.editReply(interaction, `${getL( lang ?? 'ru', 'guildnotfound')}`) }

        // Reset settings
        if (!channel) {
            if (Expify.updateGuildParam(type, '0', interaction.guildId)) {
                status = `🟢 ${(lang !== null) ? getL(lang, 'updated') : `Value successfuly updated!`}`
            } else {
                status = `🟡 ${(lang !== null) ? getL(lang, 'notupdated') : `Value was not updated!`}`
            }
            console.log(`Reset ${type} for ${interaction.guildId}(${timeDiff(startTime)}ms)`)
            return await Lunar.editReply(interaction, status);
        }

        // Check if channel not on the same server
        if (channel.guild.id !== interaction.guildId) {
            return await Lunar.editReply(interaction, `⛔ ${(lang !== null) ? getL(lang, 'servermismatch') : 'Adding only objects from current server is allowed!'}`);
        }

        // Check if we have access to channel
        const permissions = channel.permissionsFor(interaction.client.user);
        if (!permissions.has(['SendMessages'])) {
            return await Lunar.editReply(interaction, `⛔ ${(lang !== null) ? getL(lang, 'missingpermissions') : 'Missing permissions to access this channel!'}`);
        }

        // Get object ID
        const channelId = channel.id;
        if (Expify.updateGuildParam(type, `${channelId}`, interaction.guildId)) {
            status = `🟢 ${(lang !== null) ? getL(lang, 'updated') : `Value successfuly updated!`}`
        } else {
            status = `🟡 ${(lang !== null) ? getL(lang, 'notupdated') : `Value was not updated!`}`
        }

        console.log(`Updated ${type} for ${interaction.guildId}(${timeDiff(startTime)}ms)`)
        await Lunar.editReply(interaction, status);
    };

    static expifyReset = async function(interaction, lang) {
        let status;

        // Check confirmation
        if (interaction.options.getString('confirmation_1') !== 'Yes' || interaction.options.getString('confirmation_2') !== 'Yes') { return await Lunar.editReply(interaction, `${getL(lang ?? 'ru', 'guildresetabort')}`); }

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
        let replycontent = `${getL(lang ?? 'ru', `${status}`)}`;
        await Lunar.editReply(interaction, replycontent);
    };

    static expifyMigrate = async function(interaction, lang) {
        // Check confirmation
        if (interaction.options.getString('confirmation_1') !== 'Yes' || interaction.options.getString('confirmation_2') !== 'Yes') { return await Lunar.editReply(interaction, `${getL(lang ?? 'ru', 'guildresetabort')}`); }

        const startTime = Date.now();

        // Check if cooldown
        const migrate = db.prepare(`SELECT migrate_1 FROM guild_limits WHERE guild_id = ?`).get(interaction.guildId);
        const lastMigration = migrate?.migrate_1 ?? 0;
        if (lastMigration && lastMigration + Expify.cooldownMigrate > startTime) { return await Lunar.editReply(interaction, `${getL(lang ?? 'ru', 'cooldowndetected')} <t:${Math.floor((lastMigration + Expify.cooldownMigrate) / 1000)}:F>`); }

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
            return await Lunar.editReply(interaction, `❌ ${(lang !== null) ? getL(lang, 'rewardsempty') : `No rewards found for this server!`}`);
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
        members = await Expify.fetchMembersWithRetry(interaction.guild);

        // Collecting Userdata into array
        const usersToUpdate = [];
        try {
            for (const [memberId, member] of members) {
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
                        
                        // Select maximum integer of every type
                        maxText = Math.max(maxText, reqs.text);
                        maxVoice = Math.max(maxVoice, reqs.voice);
                        maxVideo = Math.max(maxVideo, reqs.video);
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
            }
        } catch (err) {
            console.error(`[MIGRATE] Error in userdata array ${guildId}:`, err);
            errorcnt = ++errorcnt;
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
        if (errorcnt) {
            try {
                db.prepare(`
                    INSERT INTO guild_limits (guild_id, migrate_1)
                    VALUES (?, ?)
                    ON CONFLICT(guild_id) DO UPDATE SET 
                        migrate_1 = excluded.migrate_1
                `).run(`${guildId}`, startTime);
            } catch (err) {
                console.error(`[LIMITS] Error in guild_limits updating migrate_1 ${guildId}:`, err)
            }
        }

        //Building response
        let replycontent;
        if (lang) {
            const l = (key) => getL(lang, key);
            replycontent = `✅ ${l('migratecomplete')} **${usersToUpdate.length}**! ${(errorcnt) ? `\n\n${l('operationerr')}: ${errorcnt}` : ' '}`;
        } else {
            replycontent = `✅ Sync Users XP with rewards completed! Users updated: **${usersToUpdate.length}**! ${(errorcnt) ? `\n\n🔴 Operation completed with errors: ${errorcnt}` : ' '}`;
        }
        console.log(`[MIGRATE] Updated ${usersToUpdate.length} users in ${interaction.guildId}(${timeDiff(startTime)}ms)`)
        await Lunar.editReply(interaction, replycontent);
    };

    static expifyMigrateHelp = async function(interaction, lang, isephemeral) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `✅ ${getL(lang, 'expifymigratehelp')}`;
        } else {
            replycontent = `✅ ${getL('ru', 'expifymigratehelp')}`;
        }
        await Lunar.editReply(interaction, replycontent, null, true);
    }

    static rank = async function(interaction, lang, isephemeral) {
        const rankTime = Date.now()
        let ephemeral;
        let getSettings;
        let guildParams;
        let getUser;
        let userData;
        try {
            // Check is guild settings restricted rank
            getSettings = db.prepare("SELECT text_xp, voice_xp, video_xp, rank_cid FROM guild_params WHERE guild_id = ?");
            guildParams = getSettings.get(`${interaction.guildId}`)
        } catch (err) {
            console.error(`[RANK] Error while loading guild configuration:`, err)
        }

        // If server not found in DB
        if (!guildParams) {
            console.log(`[RANK] Guild ${interaction.guildId} not found in DB`);
            return await Lunar.reply(interaction, `${getL( lang ?? 'ru', 'guildnotfound')}`, isephemeral)
        }

        // If restricted and interaction not from allowed channel. Else default ephemeral behaviour
        if (`${guildParams.rank_cid}` !== '0' && `${guildParams.rank_cid}` !== `${interaction.channelId}`) {
            ephemeral = true
        } else if (`${guildParams.rank_cid}` === `${interaction.channelId}`) {
            ephemeral = false
        } else { ephemeral = isephemeral }

        // Deferred Reply
        await interaction.deferReply({ flags: ephemeral ? [MessageFlags.Ephemeral] : [] });

        // Get interaction data
        const userid = interaction.options.getUser('user')?.id ?? interaction.user.id;
        const userName = interaction.options.getUser('user')?.username ?? interaction.user.username;
        const userDisplayName = interaction.options.getUser('user')?.displayName ?? interaction.user.displayName;

        try {
            // Get User data
            getUser = db.prepare("SELECT * FROM users WHERE guild_id = ? AND user_id = ?");
            userData = getUser.get(`${interaction.guildId}`, `${userid}`) || {text_xp: 0,voice_xp: 0,video_xp: 0}; // Null data protect
        } catch (err) {
            console.error(`[RANK] Error while loading user data (${interaction.guildId},${userid}):`, err)
        }

        const guildName = interaction.guild?.name ?? undefined;
        const guildIcon = interaction.guild?.iconURL() ?? undefined;

        // Build Data for embed

        // Text
        let textlevel;
        let textcurrent;
        let textmax;
        let textpercent;
        if (guildParams.text_xp > 0) {
            textlevel = XpLeveling.getLevel(userData.text_xp);
            textcurrent = XpLeveling.getLevelProgress(userData.text_xp);
            textmax = XpLeveling.getXpDiff(textlevel);
            textpercent = calculatePercentage(textcurrent, textmax)
        }

        // Voice
        let voicelevel;
        let voicecurrent;
        let voicemax;
        let voicepercent;
        if (guildParams.voice_xp > 0) {
            voicelevel = XpLeveling.getLevel(userData.voice_xp);
            voicecurrent = XpLeveling.getLevelProgress(userData.voice_xp);
            voicemax = XpLeveling.getXpDiff(voicelevel);
            voicepercent = calculatePercentage(voicecurrent, voicemax)
        }

        // Video
        let videolevel;
        let videocurrent;
        let videomax;
        let videopercent;
        if (guildParams.video_xp > 0) {
            videolevel = XpLeveling.getLevel(userData.video_xp);
            videocurrent = XpLeveling.getLevelProgress(userData.video_xp);
            videomax = XpLeveling.getXpDiff(videolevel);
            videopercent = calculatePercentage(videocurrent, videomax)
        }

        // Cunstructing message without disabled XP types
        const decription = [
            guildParams.text_xp > 0 ? `⌨️ (${userData.text_xp}xp) **${textlevel}LVL** [ ${renderProgressBar(textpercent, 20)} ] ${textcurrent}/${textmax} (${textpercent}%)` : null,
            guildParams.voice_xp > 0 ? `🎙️ (${userData.voice_xp}xp) **${voicelevel}LVL** [ ${renderProgressBar(voicepercent, 20)} ] ${voicecurrent}/${voicemax} (${voicepercent}%)` : null,
            guildParams.video_xp > 0 ? `🎦 (${userData.video_xp}xp) **${videolevel}LVL** [ ${renderProgressBar(videopercent, 20)} ] ${videocurrent}/${videomax} (${videopercent}%)` : null,
            (guildParams.text_xp < 1 && guildParams.voice_xp < 1 && guildParams.video_xp < 1) ? `${getL('ru', 'rankdisabled')}` : null
        ]
        .filter(line => line !== null) // Removing null elements
        .join('\n');

        const rankembed = Lunar.createEmbed(`${userDisplayName} (@${userName})`, decription, null, '8bff6e', guildName, guildIcon)

        //Building response
        console.log(`Sent RANK [${userName}] (${timeDiff(rankTime)}ms)`)
        await Lunar.editReply(interaction, null, [rankembed]);
    };

    static rewardAdd = async function(interaction, lang) {
        const startTime = Date.now();
        const textLevel = interaction.options.getInteger('text_level') ?? 0;
        const voiceLevel = interaction.options.getInteger('voice_level') ?? 0;
        const videoLevel = interaction.options.getInteger('video_level') ?? 0;
        const rewardRole = interaction.options.getRole('role');
        const rewardRoleId = rewardRole.id
        let newId;

        // Check if record already exists 
        const existing = db.prepare("SELECT id FROM role_rewards WHERE guild_id = ? AND role_id = ?")
            .get(interaction.guildId, rewardRoleId);

        // Total rewards count
        const { total = 0 } = db.prepare("SELECT COUNT(*) as total FROM role_rewards WHERE guild_id = ?")
            .get(interaction.guildId);

        // Limit check
        if (!existing && total >= Expify.maxRewards) {
            return await Lunar.editReply(interaction, `⛔ ${(lang !== null) ? getL(lang, 'rewardslimit') : 'You reached the rewards limit. Remove old reward before adding new!'}`);
        }

        // Check if role not on same server
        if (rewardRole.guild.id !== interaction.guildId) {
            return await Lunar.editReply(interaction, `⛔ ${(lang !== null) ? getL(lang, 'servermismatch') : 'Adding only objects from current server is allowed!'}`);
        }

        // Check if missing conditions
        if (!textLevel && !voiceLevel && !videoLevel) {
            return await Lunar.editReply(interaction, `⛔ ${(lang !== null) ? getL(lang, 'rewardsaddnull') : 'Specify at least one condition!'}`);
        }

        // UPSERT rewards data
        try {
            db.prepare(`
                INSERT INTO role_rewards (guild_id, xp_required, role_id) 
                VALUES (@guild_id, @xp_required, @role_id)
                ON CONFLICT(guild_id, role_id) DO UPDATE SET 
                    xp_required = excluded.xp_required
            `).run({
                guild_id: interaction.guildId,
                role_id: `${rewardRoleId}`,
                xp_required: `${XpLeveling.getXpForLevel(textLevel)},${XpLeveling.getXpForLevel(voiceLevel)},${XpLeveling.getXpForLevel(videoLevel)}`
            });

            // Get record ID
            newId = db.prepare("SELECT id FROM role_rewards WHERE guild_id = ? AND role_id = ?")
                .get(interaction.guildId, rewardRoleId);
        } catch (err) {
            console.error(`[REWARD] Error while upserting data for ${interaction.guildId}:`, err)
        }

        //Building response
        const replycontent = `${(existing) ? `🟡 ${(lang !== null) ? `${getL(lang, 'rewardupdated')} (ID: ${newId.id})` : `Reward updated! (ID: ${newId.id})`}` : `🟢 ${(lang !== null) ? `${getL(lang, 'rewardadded')} (ID: ${newId.id})` : `New reward added! (ID: ${newId.id})`}`}`
        console.log(`${(existing) ? 'Updated' : 'Added'} reward ${newId.id} for ${interaction.guildId}(${timeDiff(startTime)}ms)`)
        await Lunar.editReply(interaction, replycontent);
    };

    static rewardRemove = async function(interaction, lang) {
        const startTime = Date.now();
        let result;
        let status;
        const rewardId = interaction.options.getInteger('id') ?? 0;

        try {
            // Remove reward by ID if it in the same guild
            const statement = db.prepare(`
                DELETE FROM role_rewards 
                WHERE id = ? AND guild_id = ?
            `);

            result = statement.run(rewardId, interaction.guildId);
        } catch (err) {
            console.error(`[REWARD] Error while deleting ID:${rewardId} for ${interaction.guildId}:`, err)
        }

        //Building response
        if (result.changes > 0) {
            status = `🟢 ${(lang !== null) ? getL(lang, 'removed') : `Value successfuly removed!`}`
            console.log(`Removed reward ${rewardId} for ${interaction.guildId}(${timeDiff(startTime)}ms)`)
        } else {
            status = `🟡 ${(lang !== null) ? getL(lang, 'notremoved') : `Value was not removed!`}`
            console.log(`Reward ${rewardId} not removed for ${interaction.guildId}(${timeDiff(startTime)}ms)`)
        }
        await Lunar.editReply(interaction, status);
    };

    static rewardList = async function(interaction, lang) {
        const startTime = Date.now();
        const typeName = (lang !== null) ? `${getL(lang, 'rewards')}` : 'Rewards';
        const data = Expify.getRewardsEmbedData(interaction, lang);

        //Building response
        const guildName = interaction.guild?.name ?? undefined;
        const guildIcon = interaction.guild?.iconURL() ?? undefined;
        const footer = `⌨️: ${(lang !== null) ? getL(lang, 'textxp') : 'Text XP'}, 🎙️: ${(lang !== null) ? getL(lang, 'voicexp') : 'Voice XP'}, 🎦: ${(lang !== null) ? getL(lang, 'videoxp') : 'Video XP'}`
        const getEmbed = Lunar.createEmbed(typeName, data, footer, '716eff', guildName, guildIcon)

        console.log(`GET rewards of ${interaction.guildId}(${timeDiff(startTime)}ms)`)
        await Lunar.editReply(interaction, null, [getEmbed]);
    };

    static rewardMode = async function(interaction, lang) {
        const startTime = Date.now();
        let status;

        // Check confirmation
        if (interaction.options.getString('confirmation') !== 'Yes') { return await Lunar.editReply(interaction, `${getL(lang ?? 'ru', 'guildresetabort')}`); }

        // Check if guild not exist
        const params = db.prepare("SELECT reward_mode FROM guild_params WHERE guild_id = ?").get(`${interaction.guildId}`);
        if (!params) { return await Lunar.editReply(interaction, `${getL( lang ?? 'ru', 'guildnotfound')}`) }

        // Get type to set
        let type;
        if (interaction.options.getString('type') === 'all') { type = 0 } else { type = 1 }

        if (Expify.updateGuildParam('reward_mode', type, interaction.guildId)) {
            status = `🟢 ${(lang !== null) ? getL(lang, 'updated') : `Value successfuly updated!`}`
        } else {
            status = `🟡 ${(lang !== null) ? getL(lang, 'notupdated') : `Value was not updated!`}`
        }

        //Building response
        console.log(`Updated reward_mode for ${interaction.guildId}(${timeDiff(startTime)}ms)`)
        await Lunar.editReply(interaction, status);
    };

    static xpSet = async function(interaction, lang) {
        const startTime = Date.now();
        let userData;

        // Check if guild not exist
        const params = db.prepare("SELECT reward_mode FROM guild_params WHERE guild_id = ?").get(`${interaction.guildId}`);
        if (!params) { return await Lunar.editReply(interaction, `${getL( lang ?? 'ru', 'guildnotfound')}`) };

        const userid = interaction.options.getUser('user')?.id;
        let status;

        try {
            // Get User data
            userData = db.prepare("SELECT text_xp, voice_xp, video_xp FROM users WHERE guild_id = ? AND user_id = ?")
                .get(`${interaction.guildId}`, `${userid}`) || {text_xp: 0,voice_xp: 0,video_xp: 0}; // Null data protect
        } catch (err) {
            console.error(`[XP] Error while loading user data:`, err);
            return await Lunar.editReply(interaction, `${getL( lang ?? 'ru', 'operationerr')}`);
        }

        // Get type
        const type = interaction.options.getString('type');

        // Convert level to xp
        const xp = XpLeveling.getXpForLevel(interaction.options.getInteger('level'));

        // Set xp
        if (type === 'text_xp') { userData.text_xp = xp } else if (type === 'voice_xp') { userData.voice_xp = xp } else if (type === 'video_xp') { userData.video_xp = xp }

        //Write and Building response
        if (Expify.updateUsersXP(interaction.guildId, userid, userData.text_xp, userData.voice_xp, userData.video_xp)) {
            status = `🟢 ${(lang !== null) ? getL(lang, 'updated') : `Value successfuly updated!`}`
        } else {
            status = `🟡 ${(lang !== null) ? getL(lang, 'notupdated') : `Value was not updated!`}`
        }
        console.log(`[XP] Replaced ${type} for ${interaction.guildId},${userid}(${timeDiff(startTime)}ms)`)
        await Lunar.editReply(interaction, status);
    };

    static xpAdd = async function(interaction, lang) {
        const startTime = Date.now();
        
        // Check if guild not exist
        const params = db.prepare("SELECT reward_mode FROM guild_params WHERE guild_id = ?").get(`${interaction.guildId}`);
        if (!params) { return await Lunar.editReply(interaction, `${getL( lang ?? 'ru', 'guildnotfound')}`) };

        const userid = interaction.options.getUser('user')?.id;
        let status;
        let userData;

        try {
            // Get User data
            userData = db.prepare("SELECT text_xp, voice_xp, video_xp FROM users WHERE guild_id = ? AND user_id = ?")
                .get(`${interaction.guildId}`, `${userid}`) || {text_xp: 0,voice_xp: 0,video_xp: 0}; // Null data protect
        } catch (err) {
            console.error(`[XP] Error while loading user data:`, err);
            return await Lunar.editReply(interaction, `${getL( lang ?? 'ru', 'operationerr')}`);
        }

        // Get type
        const type = interaction.options.getString('type');

        // Get xp
        const xp = interaction.options.getInteger('xp');

        // Update xp
        if (type === 'text_xp') { 
            userData.text_xp = (userData.text_xp + xp) >= Expify.maxUserXp ? Expify.maxUserXp : (userData.text_xp + xp);
        } else if (type === 'voice_xp') {
            userData.voice_xp = (userData.voice_xp + xp) >= Expify.maxUserXp ? Expify.maxUserXp : (userData.voice_xp + xp);
        } else if (type === 'video_xp') {
            userData.video_xp = (userData.video_xp + xp) >= Expify.maxUserXp ? Expify.maxUserXp : (userData.video_xp + xp);
        }

        //Write and Building response
        if (Expify.updateUsersXP(interaction.guildId, userid, userData.text_xp, userData.voice_xp, userData.video_xp)) {
            status = `🟢 ${(lang !== null) ? getL(lang, 'updated') : `Value successfuly updated!`}`
        } else {
            status = `🟡 ${(lang !== null) ? getL(lang, 'notupdated') : `Value was not updated!`}`
        }
        console.log(`[XP] Replaced ${type} for ${interaction.guildId},${userid}(${timeDiff(startTime)}ms)`)
        await Lunar.editReply(interaction, status);
    };

    static xpCalc = async function(interaction, lang) {
        let result;
        // Get type
        const type = interaction.options.getString('action');

        // Get xp or lvl
        const value = interaction.options.getInteger('quantity');

        // Calculate according limits
        if (type === 'xp') {
            // XP To Level
            const xp = value >= Expify.maxUserXp ? Expify.maxUserXp : value;
            result = `✅ **${xp}xp = ${XpLeveling.getLevel(xp)}** LVL (+ ${XpLeveling.getLevelProgress(xp)}xp)`
        } else if (type === 'lvl') {
            // Level To XP
            const lvl = value >= Expify.maxUserLevel ? Expify.maxUserLevel : value;
            result = `✅ **${lvl} LVL = ${XpLeveling.getXpForLevel(lvl)}xp** (+ ${XpLeveling.getXpDiff(lvl)}xp --> ${lvl + 1} LVL)`
        }

        // Sending response
        await Lunar.editReply(interaction, result);
    };

    static xpReset = async function(interaction, lang) {
        const startTime = Date.now();

        // Check if guild not exist
        const params = db.prepare("SELECT reward_mode FROM guild_params WHERE guild_id = ?").get(`${interaction.guildId}`);
        if (!params) { return await Lunar.editReply(interaction, `${getL( lang ?? 'ru', 'guildnotfound')}`) };

        const userid = interaction.options.getUser('user')?.id;
        let status;
        let result;
        let userData;
        const xp = 0;

        // Get type
        const type = interaction.options.getString('type') ?? 'none';

        if (type !== 'none') {
            try {
                // Get User data if needed
                userData = db.prepare("SELECT text_xp, voice_xp, video_xp FROM users WHERE guild_id = ? AND user_id = ?")
                    .get(`${interaction.guildId}`, `${userid}`) || {text_xp: 0,voice_xp: 0,video_xp: 0}; // Null data protect
            } catch (err) {
                console.error(`[XP] Error while loading user data:`, err);
                return await Lunar.editReply(interaction, `${getL( lang ?? 'ru', 'operationerr')}`);
            }
        }

        // Update xp
        if (type === 'text_xp') { 
            userData.text_xp = xp;
        } else if (type === 'voice_xp') {
            userData.voice_xp = xp;
        } else if (type === 'video_xp') {
            userData.video_xp = xp;
        } else if (type === 'none') {
            try {
                // Reset user data
                const stmt = db.prepare(`DELETE FROM users WHERE guild_id = ? AND user_id = ?`);
                const run = stmt.run(interaction.guildId, userid);
                result = !!run?.changes;
            } catch (err) {
                console.error(`[XP] Error while deleting user data:`, err.message)
            }
        }

        if (type !== 'none') { result = Expify.updateUsersXP(interaction.guildId, userid, userData.text_xp, userData.voice_xp, userData.video_xp) }

        //Write and Building response
        if (result > 0) {
            status = `🟢 ${(lang !== null) ? getL(lang, 'updated') : `Value successfuly updated!`}`
        } else {
            status = `🟡 ${(lang !== null) ? getL(lang, 'notupdated') : `Value was not updated!`}`
        }
        console.log(`[XP] Resetted ${type} for ${interaction.guildId},${userid}(${timeDiff(startTime)}ms)`)
        await Lunar.editReply(interaction, status);
    };

    static noxpCID = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.editReply(interaction, replycontent);
    };

    static noxpUID = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.editReply(interaction, replycontent);
    };

    static noxpRID = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.editReply(interaction, replycontent);
    };

    static top = async function(interaction, lang) {
        const startTime = Date.now();
        const type = interaction.options.getString('type');
        let page = interaction.options.getInteger('page') || 1;
        const limit = 10;
        let topUsers;

        // Check if guild not exist
        const params = db.prepare("SELECT text_xp, voice_xp, video_xp FROM guild_params WHERE guild_id = ?").get(`${interaction.guildId}`);
        if (!params) { return await Lunar.editReply(interaction, `${getL( lang ?? 'ru', 'guildnotfound')}`) };

        // Reply if this XP type is disabled
        let disabledxp;
        if (type === 'text_xp') { disabledxp = params.text_xp } else if (type === 'voice_xp') { disabledxp = params.voice_xp } else if (type === 'video_xp') { disabledxp = params.video_xp }
        if (disabledxp = 0) { return await Lunar.editReply(interaction, `${getL( lang ?? 'ru', 'somerankdisabled')}`) }

        // Get total count of pages
        const { total } = db.prepare(`
            SELECT COUNT(*) as total FROM users 
            WHERE guild_id = ? AND ${type} > 0
        `).get(interaction.guildId);

        const totalPages = Math.ceil(total / limit) || 1;
        
        // Latest page
        if (page > totalPages) {
            page = totalPages;
        }

        // Offset for database
        const offset = (page - 1) * limit;

        // Collecting top
        // Using type as column name
        try {
            topUsers = db.prepare(`
                SELECT user_id, ${type} as xp 
                FROM users 
                WHERE guild_id = ? AND ${type} > 0 
                ORDER BY ${type} DESC 
                LIMIT ? OFFSET ?
            `).all(interaction.guildId, limit, offset);
        } catch (err) {
            console.error(`[TOP] Error while loading user data:`, err);
            return await Lunar.editReply(interaction, `${getL( lang ?? 'ru', 'operationerr')}`);
        }

        if (topUsers.length === 0) {return await Lunar.editReply(interaction, `${getL( lang ?? 'ru', 'topempty')}`) };

        // Building list
        const mapType = {
            text_xp: `⌨️ ${getL( lang ?? 'ru', 'textxp')}`,
            voice_xp: `🎙️ ${getL( lang ?? 'ru', 'voicexp')}`,
            video_xp: `🎦 ${getL( lang ?? 'ru', 'videoxp')}`
        };

        const leaderboard = topUsers.map((user, index) => {
            const rank = offset + index + 1;
            return `**#${rank}** <@${user.user_id}> XP: \`${user.xp}\``;
        }).join('\n');

        // Color from type
        let color;
        if (type === 'text_xp') { color = '7cff98'} else if (type === 'voice_xp') { color = '7caeff'} else if (type === 'video_xp') { color = 'ffaa7c'}

        // Create Embed
        const guildName = interaction.guild?.name ?? undefined;
        const guildIcon = interaction.guild?.iconURL() ?? undefined;
        const getEmbed = Lunar.createEmbed(`${getL( lang ?? 'ru', 'topserver')}: ${mapType[type]} (${page}/${totalPages})`, leaderboard, null, color, guildName, guildIcon)

        console.log(`Sent TOP ${type} of ${interaction.guildId}(${timeDiff(startTime)}ms)`)
        await Lunar.editReply(interaction, null, [getEmbed]);
    };
}

module.exports = { Expify };