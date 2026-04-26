const { timeDiff, getL, renderProgressBar, calculatePercentage, Lunar, XpLeveling, supportedlocales, dLang } = require('./functions.js');
const { MessageFlags } = require('discord.js');
const { db } = require('./dbManager.js')
const { manageRoles } = require('./rewardProcess.js')

// Discord User Interactions
class Expify {

    //Defaults
    /** Default Text XP gain */
    static defaultTextXP = 20;
    /** Default Voice XP gain */
    static defaultVoiceXP = 10;
    /** Default Video XP gain */
    static defaultVideoXP = 20;

    // Limits
    /** Max rewards per guild */
    static maxRewards = 30;
    /** Max NoXP Channels */
    static maxNoxpCid = 10;
    /** Max NoXP Users */
    static maxNoxpUid = 10;
    /** Max NoXP Roles */
    static maxNoxpRid = 5;
    /** Maximum XP */
    static maxUserXp = 160280000;
    /** Maximum LVL */
    static maxUserLevel = XpLeveling.getLevel(this.maxUserXp);
    /** Migrate cooldown */
    static cooldownMigrate = 3600000 * 24 * 7;
    /** Reward Cleanup cooldown */
    static cooldownRewardCleanup = 3600000 * 24 * 7;

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

    /** Toggles ID of Channel/User/Role in NoXP list
     * @param {string} guildId - interaction.GuildId
     * @param {string} type - Type in Database
     * @param {string} UID - ID to add or remove
     * @param {number} limit - Limit ID entries 
     * @param {boolean} reset - Reset type if true */
    static toggleIgnoreChannel(guildId, type, UID, limit = 10, reset = false) {
        // Get current database value
        const row = db.prepare(`SELECT ${type} FROM guild_params WHERE guild_id = ?`).get(guildId);
        if (!row) { return { success: false, reason: 'guild_missing' } };

        let updatedValue;
        let currentCids;
        let isPresent = true;
        if (reset) {
            // Reset value
            updatedValue = '';
        } else {
            // if not exist create new object
            currentCids = row?.[type] ? row[type].split(',') : [];

            isPresent = currentCids.includes(UID);

            // Toggle Logic
            if (isPresent) {
                // Remove ID if existing
                currentCids = currentCids.filter(id => id !== UID);
            } else {
                // Check if limited
                if (currentCids.length >= limit) { return { success: false, reason: 'limit_reached' } };

                // Add ID if not found
                currentCids.push(UID);
            }

            // Formatting string
            updatedValue = currentCids.filter(id => id.length > 0).join(',');
        }

        // Save changes to Database
        db.prepare(`
            INSERT INTO guild_params (guild_id, ${type}) 
            VALUES (?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET ${type} = excluded.${type}
        `).run(guildId, updatedValue);

        return { success: true, added: !isPresent }; // Return true if added, and false if deleted
    };

    /** Common method for getting all guild rewards for description field of embed message.
     * Usage is: data = Expify.getRewardsEmbedData(interaction, lang)
     * Returns { data: description, count: rewards.count } */
    static getRewardsEmbedData(interaction, lang) {
        let getRewards;
        let rewards;
        let data;

        // Check if guild not exist
        const params = db.prepare("SELECT reward_mode FROM guild_params WHERE guild_id = ?").get(`${interaction.guildId}`);
        if (!params) { return { data: `${getL( lang ?? dLang, 'guildnotfound')}`, count: 0 }}

        try {
            // Get rewards for guild
            getRewards = db.prepare(`SELECT * FROM role_rewards WHERE guild_id = ?`);
            rewards = getRewards.all(`${interaction.guildId}`)
        } catch (err) {
            console.error(`[GET] Error while loading guild rewards:`, err)
        }
        // Empty list when no data
        if (rewards.length === 0) {
            data = `${getL(lang ?? dLang, 'listempty')}`;
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

        return { data: `${data}\n### ⚡ ${getL( lang ?? dLang, 'rewardmode')}\n${(params.reward_mode > 0) ? getL( lang ?? dLang, 'rewardmodetoponly') : getL( lang ?? dLang, 'rewardmodeall')}`, count: rewards.length };
    }

    static getNoxpData = async function(interaction, lang) {
        let data;
        let typeName;

        typeName = `${getL(lang ?? dLang, 'noxpentities')}`;
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
            console.error(`[noXP Data] Error while loading guild configuration:`, err)
        }

        if (!guildParams) {
            console.log(`[noXP Data] Guild ${interaction.guildId} not found in DB`);
            return { result: 'guildnotfound', type: 0 };
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
            cids = `${getL(lang ?? dLang, 'listempty')}`;
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
            uids = `${getL(lang ?? dLang, 'listempty')}`;
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
            rids = `${getL(lang ?? dLang, 'listempty')}`;
            ridCnt = 0
        }

        data = [
            `## 💬 ${getL(lang ?? dLang, 'channels')} (${cidCnt}/${Expify.maxNoxpCid})`,
            cids,
            `## 👥 ${getL(lang ?? dLang, 'users')} (${uidCnt}/${Expify.maxNoxpUid})`,
            uids,
            `## 🏷️ ${getL(lang ?? dLang, 'roles')} (${ridCnt}/${Expify.maxNoxpRid})`,
            rids
        ]
        .join('\n');

        return { result: data, type: typeName };
    };
    
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
    };

    static guildCreate = function(guildId) {
        if (!guildId) { return }
        const startTime = Date.now();
        try {
            const stmt = db.prepare(`
                INSERT OR IGNORE INTO guild_params (
                    guild_id, text_xp, text_xp_rate, voice_xp, voice_xp_rate, video_xp, video_xp_rate,
                    noxp_cid, noxp_uid, noxp_rid, announce_cid, admin_cid, rank_cid, reward_mode
                ) VALUES (?, 1, 20, 1, 10, 1, 20, '', '', '', '0', '0', '0', 0)
            `);
            stmt.run(guildId);
            console.log(`GuildCreate Event ${guildId}(${timeDiff(startTime)}ms)`);
        } catch (err) {
            console.error(`[GuildCreate] Error while processing guildSetup signal:`, err)
        }
    }

    static ping = async function(interaction, client, lang) {
        //Counting latency
        const latency = Date.now() - interaction.createdTimestamp;
        const apiLatency = Math.round(client.ws.ping);
        //Building response

        // Helper to resolve locales
        const l = (key) => getL(lang ?? dLang, key);
        
        let replycontent = `:ping_pong: *${l('pong')}!* ${l('latency')} ${latency} ${l('milliseconds')}! ${l('apilatency')} ${apiLatency} ${l('milliseconds')}.`;
        await Lunar.reply(interaction, replycontent, true);
    };

    static about = async function(interaction, lang, corever) {
        //Building response
        const l = (key) => getL(lang ?? dLang, key);
        
        let replycontent = `${l('aboutcmd')}\n\n✨ ${l('coreversion')} ${corever}\n\n${l('aboutanounce')}\n\n${l('aboutfooter')}`;
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };

    static invite = async function(interaction, lang) {
        //Building response     
        let replycontent = `${getL(lang ?? dLang, 'invitecmd')}`;
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };

    static expifyGet = async function(interaction, lang) {
        const startTime = Date.now();
        const type = interaction.options.getString('type');
        let data;
        let typeName;
        let footer;

        if (type === 'gain') {
            typeName = `${getL(lang ?? dLang, 'xpgaining')}`;

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
            const request = await Expify.getNoxpData(interaction, lang);
            if (!request.result) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'operationerr')}`); }
            if (request.result === 'guildnotfound') { return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'guildnotfound')}`) }
            data = request.result;
            typeName = request.type;
        } else if (type === 'reward') {
            const l = (key) => getL(lang ?? dLang, key);
            const rewards = Expify.getRewardsEmbedData(interaction, lang); 
            typeName = `🎖️ ${`${l('rewards')}`} (${rewards.count}/${Expify.maxRewards})`;
            footer = `⌨️: ${l('textxp')}, 🎙️: ${l('voicexp')}, 🎦: ${l('videoxp')}`
            data = rewards.data;
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
        // Get new state for reply
        const newState = db.prepare(`SELECT ${type} FROM guild_params WHERE guild_id = ?`).get(interaction.guildId);

        // Check if undefined
        if (!newState) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'guildnotfound')}`) }
        
        //Building response
        let ltype;
        const l = (key) => getL(lang ?? dLang, key);
        if (type === 'text_xp') {ltype = 'textxp'} else if (type === 'voice_xp') {ltype = 'voicexp'} else if (type === 'video_xp') {ltype = 'videoxp'}
        const replycontent = `${(newState[type] > 0) ? '🟢' : '🔴'} ${l(ltype)} ${(newState[type] > 0) ? `${l('enabled')}` : `${l('disabled')}`}!`
        console.log(`Toggle ${type} for ${interaction.guildId}(${timeDiff(startTime)}ms)`)
        await Lunar.editReply(interaction, replycontent);
    };

    static expifyGain = async function(interaction, lang) {
        const startTime = Date.now();
        const type = interaction.options.getString('type');
        let quantity = interaction.options.getInteger('quantity');
        let dbtype;
        let status;

        // Check if guild not exist
        const probe = db.prepare("SELECT text_xp_rate FROM guild_params WHERE guild_id = ?").get(`${interaction.guildId}`);
        if (!probe) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'guildnotfound')}`) }

        // To XP rate
        if (type === 'text_xp') {dbtype = 'text_xp_rate'} else if (type === 'voice_xp') {dbtype = 'voice_xp_rate'} else if (type === 'video_xp') {dbtype = 'video_xp_rate'}

        // Default if not provided
        if (!quantity) { 
            if (type === 'text_xp') {quantity = Expify.defaultTextXP} else if (type === 'voice_xp') {quantity = Expify.defaultVoiceXP} else if (type === 'video_xp') {quantity = Expify.defaultVideoXP}
        }

        if (Expify.updateGuildParam(dbtype, quantity, interaction.guildId)) {
            status = `🟢 ${getL(lang ?? dLang, 'updated')}`
        } else {
            status = `🟡 ${getL(lang ?? dLang, 'notupdated')}`
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
        if (!probe) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'guildnotfound')}`) }

        // Reset settings
        if (!channel) {
            if (Expify.updateGuildParam(type, '0', interaction.guildId)) {
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
        if (Expify.updateGuildParam(type, `${channelId}`, interaction.guildId)) {
            status = `🟢 ${getL(lang ?? dLang, 'updated')}`
        } else {
            status = `🟡 ${getL(lang ?? dLang, 'notupdated')}`
        }

        console.log(`Updated ${type} for ${interaction.guildId}(${timeDiff(startTime)}ms)`)
        await Lunar.editReply(interaction, status);
    };

    static expifyReset = async function(interaction, lang) {
        let status;

        // Check confirmation
        if (interaction.options.getString('confirmation_1') !== 'Yes' || interaction.options.getString('confirmation_2') !== 'Yes') { return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'guildresetabort')}`); }

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
    };

    static expifyXpReset = async function(client, interaction, lang) {
        let status;

        // Check confirmation
        if (interaction.options.getString('confirmation_1') !== 'Yes' || interaction.options.getString('confirmation_2') !== 'Yes' || interaction.options.getString('confirmation_3') !== 'Yes') { return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'guildresetabort')}`); }
        
        const resetTime = Date.now();

        // Check if guild not exist
        const probe = db.prepare("SELECT admin_cid, lang FROM guild_params WHERE guild_id = ?").get(`${interaction.guildId}`);
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
            await Lunar.sendEvent(client, probe.admin_cid, `⚠️ <@${interaction.user.id}>: ${getL(probe.lang ?? dLang, 'resetxpcallback')}`);
        }

        //Building response
        let replycontent = `${getL(lang ?? dLang, `${status}`)}`;
        await Lunar.editReply(interaction, replycontent);
    };

    static expifyMigrate = async function(client, interaction, lang) {
        // Check confirmation
        if (interaction.options.getString('confirmation_1') !== 'Yes' || interaction.options.getString('confirmation_2') !== 'Yes') { return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'guildresetabort')}`); }

        const startTime = Date.now();

        // Check if guild not exist
        const probe = db.prepare("SELECT admin_cid, lang FROM guild_params WHERE guild_id = ?").get(`${interaction.guildId}`);
        if (!probe) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'guildnotfound')}`) }

        // Check if cooldown
        const migrate = db.prepare(`SELECT migrate_1 FROM guild_limits WHERE guild_id = ?`).get(interaction.guildId);
        const lastMigration = migrate?.migrate_1 ?? 0;
        if (lastMigration && lastMigration + Expify.cooldownMigrate > startTime) { return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'cooldowndetected')} <t:${Math.floor((lastMigration + Expify.cooldownMigrate) / 1000)}:F>`); }

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
        members = await Expify.fetchMembersWithRetry(interaction.guild);

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
        if (!errorcnt) {
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
        const l = (key) => getL(lang ?? dLang, key);
        let replycontent = `✅ ${l('migratecomplete')} **${usersToUpdate.length}**! ${(errorcnt) ? `\n\n${l('operationerr')}: ${errorcnt}` : ' '}`;

        console.log(`[MIGRATE] Updated ${usersToUpdate.length} users in ${interaction.guildId}(${timeDiff(startTime)}ms)`);

        // Send notification
        if (probe.admin_cid && probe.admin_cid !== '0' ) {
            const ld = (key) => getL(probe.lang ?? dLang, key);
            await Lunar.sendEvent(client, probe.admin_cid, `⚠️ <@${interaction.user.id}>\n✅ ${ld('migratecomplete')} **${usersToUpdate.length}**! ${(errorcnt) ? `\n\n${ld('operationerr')}: ${errorcnt}` : ' '}`);
        }

        await Lunar.editReply(interaction, replycontent);
    };

    static expifyMigrateHelp = async function(interaction, lang, isephemeral) {
        //Building response
        let replycontent = `✅ ${getL(lang ?? dLang, 'expifymigratehelp')}`;
        await Lunar.editReply(interaction, replycontent, null, true);
    };

    /** Check and remove roles from users that not match requirements */
    static expifyCleanupRewards = async function (client, interaction, lang) {
        const startTime = Date.now();

        // Check confirmation
        if (interaction.options.getString('confirmation_1') !== 'Yes' || interaction.options.getString('confirmation_2') !== 'Yes') { return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'guildresetabort')}`); }
        const guild = interaction.guild;

        // Check if guild not exist
        const probe = db.prepare("SELECT admin_cid, lang FROM guild_params WHERE guild_id = ?").get(`${interaction.guildId}`);
        if (!probe) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'guildnotfound')}`) }

        // Check if cooldown
        const cooldown = db.prepare(`SELECT reward_cleanup FROM guild_limits WHERE guild_id = ?`).get(interaction.guildId);
        const lastCleanup = cooldown?.reward_cleanup ?? 0;
        if (lastCleanup && lastCleanup + Expify.cooldownRewardCleanup > startTime) { return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'cooldowndetected')} <t:${Math.floor((lastCleanup + Expify.cooldownRewardCleanup) / 1000)}:F>`); }

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
        members = await Expify.fetchMembersWithRetry(guild);

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
        if (!errorcnt) {
            try {
                db.prepare(`
                    INSERT INTO guild_limits (guild_id, reward_cleanup)
                    VALUES (?, ?)
                    ON CONFLICT(guild_id) DO UPDATE SET 
                        reward_cleanup = excluded.reward_cleanup
                `).run(`${guild.id}`, startTime);
            } catch (err) {
                console.error(`[LIMITS] Error in guild_limits updating reward_cleanup ${guild.id}:`, err)
            }
        }

        //Building response
        const l = (key) => getL(lang ?? dLang, key);
        let replycontent = `✅ ${l('cleanupcomplete')} **${removedCount}**! ${(errorcnt) ? `\n\n${l('operationerr')}: ${errorcnt}` : ' '}`;

        console.log(`[CLEANUP] Updated ${removedCount} users in ${guild.id}(${timeDiff(startTime)}ms)`);

        // Send notification
        if (probe.admin_cid && probe.admin_cid !== '0' ) {
            const ld = (key) => getL(probe.lang ?? dLang, key);
            await Lunar.sendEvent(client, probe.admin_cid, `⚠️ <@${interaction.user.id}>\n✅ ${ld('cleanupcomplete')} **${removedCount}**! ${(errorcnt) ? `\n\n${ld('operationerr')}: ${errorcnt}` : ' '}`);
        }

        await Lunar.editReply(interaction, replycontent);
    };

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
            return await Lunar.reply(interaction, `${getL( lang ?? dLang, 'guildnotfound')}`, isephemeral)
        }

        // If restricted and interaction not from allowed channel. Else default ephemeral behaviour
        if (guildParams.rank_cid && `${guildParams.rank_cid}` != '0' && `${guildParams.rank_cid}` != `${interaction.channelId}`) {
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
            (guildParams.text_xp < 1 && guildParams.voice_xp < 1 && guildParams.video_xp < 1) ? `${getL(lang ?? dLang, 'rankdisabled')}` : null
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

        // Check if guild not exist
        const params = db.prepare("SELECT reward_mode FROM guild_params WHERE guild_id = ?").get(`${interaction.guildId}`);
        if (!params) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'guildnotfound')}`) }

        // Check if record already exists 
        const existing = db.prepare("SELECT id FROM role_rewards WHERE guild_id = ? AND role_id = ?")
            .get(interaction.guildId, rewardRoleId);

        // Total rewards count
        const { total = 0 } = db.prepare("SELECT COUNT(*) as total FROM role_rewards WHERE guild_id = ?")
            .get(interaction.guildId);

        // Limit check
        if (!existing && total >= Expify.maxRewards) {
            return await Lunar.editReply(interaction, `⛔ ${getL(lang ?? dLang, 'rewardslimit')}`);
        }

        // Check if role not on same server
        if (rewardRole.guild.id !== interaction.guildId) {
            return await Lunar.editReply(interaction, `⛔ ${getL(lang ?? dLang, 'servermismatch')}`);
        }

        // Check if missing conditions
        if (!textLevel && !voiceLevel && !videoLevel) {
            return await Lunar.editReply(interaction, `⛔ ${getL(lang ?? dLang, 'rewardsaddnull')}`);
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
        const replycontent = (existing) ? `🟡 ${getL(lang ?? dLang, 'rewardupdated')} (ID: ${newId.id})` : `🟢 ${getL(lang ?? dLang, 'rewardadded')} (ID: ${newId.id})`;
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
            status = `🟢 ${getL(lang ?? dLang, 'removed')}`
            console.log(`Removed reward ${rewardId} for ${interaction.guildId}(${timeDiff(startTime)}ms)`)
        } else {
            status = `🟡 ${getL(lang ?? dLang, 'notremoved')}`
            console.log(`Reward ${rewardId} not removed for ${interaction.guildId}(${timeDiff(startTime)}ms)`)
        }
        await Lunar.editReply(interaction, status);
    };

    static rewardList = async function(interaction, lang) {
        const startTime = Date.now();
        const l = (key) => getL(lang ?? dLang, key);
        const rewards = Expify.getRewardsEmbedData(interaction, lang);
        const typeName = `🎖️ ${l('rewards')} (${rewards.count}/${Expify.maxRewards})`;
        const data = rewards.data;

        //Building response
        const guildName = interaction.guild?.name ?? undefined;
        const guildIcon = interaction.guild?.iconURL() ?? undefined;
        const footer = `⌨️: ${l('textxp')}, 🎙️: ${l('voicexp')}, 🎦: ${l('videoxp')}`
        const getEmbed = Lunar.createEmbed(typeName, data, footer, '716eff', guildName, guildIcon)

        console.log(`GET rewards of ${interaction.guildId}(${timeDiff(startTime)}ms)`)
        await Lunar.editReply(interaction, null, [getEmbed]);
    };

    static rewardMode = async function(interaction, lang) {
        const startTime = Date.now();
        let status;

        // Check confirmation
        if (interaction.options.getString('confirmation_1') !== 'Yes' || interaction.options.getString('confirmation_2') !== 'Yes') { return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'guildresetabort')}`); }

        // Check if guild not exist
        const params = db.prepare("SELECT reward_mode FROM guild_params WHERE guild_id = ?").get(`${interaction.guildId}`);
        if (!params) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'guildnotfound')}`) }

        // Get type to set
        let type;
        if (interaction.options.getString('type') === 'all') { type = 0 } else { type = 1 }

        if (Expify.updateGuildParam('reward_mode', type, interaction.guildId)) {
            status = `🟢 ${getL(lang ?? dLang, 'updated')}`
        } else {
            status = `🟡 ${getL(lang ?? dLang, 'notupdated')}`
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
        if (!params) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'guildnotfound')}`) };

        const userid = interaction.options.getUser('user')?.id;
        let status;

        try {
            // Get User data
            userData = db.prepare("SELECT text_xp, voice_xp, video_xp FROM users WHERE guild_id = ? AND user_id = ?")
                .get(`${interaction.guildId}`, `${userid}`) || {text_xp: 0,voice_xp: 0,video_xp: 0}; // Null data protect
        } catch (err) {
            console.error(`[XP] Error while loading user data:`, err);
            return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'operationerr')}`);
        }

        // Get type
        const type = interaction.options.getString('type');

        // Convert level to xp
        const xp = XpLeveling.getXpForLevel(interaction.options.getInteger('level'));

        // Set xp
        if (type === 'text_xp') { userData.text_xp = xp } else if (type === 'voice_xp') { userData.voice_xp = xp } else if (type === 'video_xp') { userData.video_xp = xp }

        //Write and Building response
        if (Expify.updateUsersXP(interaction.guildId, userid, userData.text_xp, userData.voice_xp, userData.video_xp)) {
            status = `🟢 ${getL(lang ?? dLang, 'updated')}`
        } else {
            status = `🟡 ${getL(lang ?? dLang, 'notupdated')}`
        }
        console.log(`[XP] Replaced ${type} for ${interaction.guildId},${userid}(${timeDiff(startTime)}ms)`)
        await Lunar.editReply(interaction, status);
    };

    static xpAddRemove = async function(interaction, lang) {
        const startTime = Date.now();
        
        // Check if guild not exist
        const params = db.prepare("SELECT reward_mode FROM guild_params WHERE guild_id = ?").get(`${interaction.guildId}`);
        if (!params) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'guildnotfound')}`) };

        const userid = interaction.options.getUser('user')?.id;
        let status;
        let userData;

        try {
            // Get User data
            userData = db.prepare("SELECT text_xp, voice_xp, video_xp FROM users WHERE guild_id = ? AND user_id = ?")
                .get(`${interaction.guildId}`, `${userid}`) || {text_xp: 0,voice_xp: 0,video_xp: 0}; // Null data protect
        } catch (err) {
            console.error(`[XP] Error while loading user data:`, err);
            return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'operationerr')}`);
        }

        // Get type
        const type = interaction.options.getString('type');

        // Get xp
        const xp = interaction.options.getInteger('xp');

        // Get Action
        const sub = interaction.options.getSubcommand();

        // Add xp
        if (sub === 'add') {
            if (type === 'text_xp') { 
                userData.text_xp = (userData.text_xp + xp) >= Expify.maxUserXp ? Expify.maxUserXp : (userData.text_xp + xp);
            } else if (type === 'voice_xp') {
                userData.voice_xp = (userData.voice_xp + xp) >= Expify.maxUserXp ? Expify.maxUserXp : (userData.voice_xp + xp);
            } else if (type === 'video_xp') {
                userData.video_xp = (userData.video_xp + xp) >= Expify.maxUserXp ? Expify.maxUserXp : (userData.video_xp + xp);
            }
        } else if (sub === 'remove') {
            if (type === 'text_xp') { 
                userData.text_xp = (userData.text_xp - xp) <= 0 ? 0 : (userData.text_xp - xp);
            } else if (type === 'voice_xp') {
                userData.voice_xp = (userData.voice_xp - xp) <= 0 ? 0 : (userData.voice_xp - xp);
            } else if (type === 'video_xp') {
                userData.video_xp = (userData.video_xp - xp) <= 0 ? 0 : (userData.video_xp - xp);
            }
        }

        //Write and Building response
        if (Expify.updateUsersXP(interaction.guildId, userid, userData.text_xp, userData.voice_xp, userData.video_xp)) {
            status = `🟢 ${getL(lang ?? dLang, 'updated')}`
        } else {
            status = `🟡 ${getL(lang ?? dLang, 'notupdated')}`
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
        if (!params) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'guildnotfound')}`) };

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
                return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'operationerr')}`);
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
            status = `🟢 ${getL(lang ?? dLang, 'updated')}`
        } else {
            status = `🟡 ${getL(lang ?? dLang, 'notupdated')}`
        }
        console.log(`[XP] Resetted ${type} for ${interaction.guildId},${userid}(${timeDiff(startTime)}ms)`)
        await Lunar.editReply(interaction, status);
    };

    static noxpIDs = async function(interaction, lang) {
        const startTime = Date.now();

        let object;
        let type;
        let limit;
        let skipCheck = false;
        let result;
        let objectId;
        const sub = interaction.options.getSubcommand();
        if (sub === 'channel') {
            type = 'noxp_cid'
            object = interaction.options.getChannel('channel');
            limit = 10;
        } else if (sub === 'user') {
            type = 'noxp_uid' 
            object = interaction.options.getUser('user');
            limit = 10;
            skipCheck = true;
        } else if (sub === 'role') {
            type = 'noxp_rid'
            object = interaction.options.getRole('role');
            limit = 5;
        } else if (sub === 'reset') {
            skipCheck = true;

            // Check confirmation
            if (interaction.options.getString('confirmation_1') !== 'Yes') { return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'guildresetabort')}`); }
            const resetedType = interaction.options.getString('type') ?? 'all';
            if (resetedType === 'all') {
                type = 'all'
                Expify.toggleIgnoreChannel(interaction.guildId, 'noxp_cid', 0, 10, true);
                Expify.toggleIgnoreChannel(interaction.guildId, 'noxp_uid', 0, 10, true);
                result = Expify.toggleIgnoreChannel(interaction.guildId, 'noxp_rid', 0, 10, true);
            } else {
                type = resetedType
                result = Expify.toggleIgnoreChannel(interaction.guildId, resetedType, 0, 10, true);
            }
        } else if (sub === 'list') {
            const request = await Expify.getNoxpData(interaction, lang);
            if (!request.result) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'operationerr')}`); }
            if (request.result === 'guildnotfound') { return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'guildnotfound')}`) }
            const data = request.result;
            const typeName = request.type;

            //Building response
            const guildName = interaction.guild?.name ?? undefined;
            const guildIcon = interaction.guild?.iconURL() ?? undefined;
            const getEmbed = Lunar.createEmbed(typeName, data, null, 'ff6e6e', guildName, guildIcon)
            console.log(`[noXP] GET noXP of ${interaction.guildId}(${timeDiff(startTime)}ms)`)
            return await Lunar.editReply(interaction, null, [getEmbed]);
        }
        
        if (!skipCheck) {
            // Check if object not on the same server
            if (object.guild.id !== interaction.guildId) {
                return await Lunar.editReply(interaction, `⛔ ${getL(lang ?? dLang, 'servermismatch')}`);
            }
        }

        // If not reset
        if (sub !== 'reset'){
            // Object ID
            objectId = object.id;

            // Write in database
            result = Expify.toggleIgnoreChannel(interaction.guildId, type, objectId, limit);
        }

        // Building response
        if (result.success) {
            console.log(`[noXP] Updated ${type} for ${interaction.guildId}(${timeDiff(startTime)}ms)`)
            if (result.added) {
                await Lunar.editReply(interaction, `🟢 ${getL(lang ?? dLang, 'added')}`)
            } else {
                await Lunar.editReply(interaction, `🟢 ${getL(lang ?? dLang, 'removed')}`)
            }
        } else {
            console.log(`[noXP] Rejected ${type} for ${interaction.guildId}: ${result.reason}(${timeDiff(startTime)}ms)`)
            if (result.reason === 'limit_reached') {
                await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'noxplimit')}`)
            } else if (result.reason === 'guild_missing') {
                await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'guildnotfound')}`)
            }
        }
    };

    static top = async function(interaction, lang) {
        const startTime = Date.now();
        const type = interaction.options.getString('type');
        let page = interaction.options.getInteger('page') || 1;
        const limit = 10;
        let topUsers;

        // Check if guild not exist
        const params = db.prepare("SELECT text_xp, voice_xp, video_xp FROM guild_params WHERE guild_id = ?").get(`${interaction.guildId}`);
        if (!params) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'guildnotfound')}`) };

        // Reply if this XP type is disabled
        let disabledxp;
        if (type === 'text_xp') { disabledxp = params.text_xp } else if (type === 'voice_xp') { disabledxp = params.voice_xp } else if (type === 'video_xp') { disabledxp = params.video_xp }
        if (disabledxp == 0) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'somerankdisabled')}`) }

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
            return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'operationerr')}`);
        }

        if (topUsers.length === 0) {return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'topempty')}`) };

        // Building list
        const mapType = {
            text_xp: `⌨️ ${getL( lang ?? dLang, 'textxp')}`,
            voice_xp: `🎙️ ${getL( lang ?? dLang, 'voicexp')}`,
            video_xp: `🎦 ${getL( lang ?? dLang, 'videoxp')}`
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
        const getEmbed = Lunar.createEmbed(`${getL( lang ?? dLang, 'topserver')}: ${mapType[type]} (${page}/${totalPages})`, leaderboard, null, color, guildName, guildIcon)

        console.log(`Sent TOP ${type} of ${interaction.guildId}(${timeDiff(startTime)}ms)`)
        await Lunar.editReply(interaction, null, [getEmbed]);
    };

    static lang = async function(client, interaction, lang) {
        const startTime = Date.now();

        // Check if guild not exist
        const params = db.prepare("SELECT admin_cid, lang FROM guild_params WHERE guild_id = ?").get(`${interaction.guildId}`);
        if (!params) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'guildnotfound')}`) };

        const newlang = interaction.options.getString('lang') ?? interaction.locale;

        // Refuse if not supported
        if (!supportedlocales.includes(newlang)) { return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'langnotsupported')}`, null, true) };

        // Save changes to Database
        db.prepare(`
            INSERT INTO guild_params (guild_id, lang) 
            VALUES (?, ?)
            ON CONFLICT(guild_id) DO UPDATE SET lang = excluded.lang
        `).run(interaction.guildId, newlang);
        
        //Building response
        const l = (key) => getL(newlang ?? dLang, key);
        let replycontent = `✅ ${l('langsuccess')}`;

        console.log(`[LANG] Set '${newlang}' in ${interaction.guildId}(${timeDiff(startTime)}ms)`);

        // Send notification
        if (params.admin_cid && params.admin_cid !== '0' ) {
            await Lunar.sendEvent(client, params.admin_cid, `⚠️ <@${interaction.user.id}>\n${replycontent}`);
        }

        await Lunar.editReply(interaction, replycontent);
    };
}

module.exports = { Expify, dLang };