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
    // Max NoXP Channels
    static maxNoxpCid = 10;
    // Max NoXP Users
    static maxNoxpUid = 10;
    // Max NoXP Roles
    static maxNoxpRid = 5;

    /** Update guild_params object in database
     * @param {string} type - Column Name (example: 'text_xp')
     * @param {number|string} value - New Value
     * @param {string} guildId - GuildID */
    static updateGuildParam(type, value, guildId) {
        let result;
        try {
            const statement = db.prepare(`UPDATE guild_params SET ${type} = ? WHERE guild_id = ?`);
            result = statement.run(value, guildId);
        } catch (err) {
            console.error(`[GuildParam] Error while updating object ${type} in ${guildId}:`, err)
        }

        return result.changes > 0; // Return true if updated
    }

    /* Common method for getting all guild rewards for description field of embed message.
     * Usage is: data = Expify.getRewardsEmbedData(interaction, lang) */
    static getRewardsEmbedData(interaction, lang) {
        let getRewards;
        let rewards;
        let data;
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
                if (textXp > 0) conditions.push(`⌨️: ${XpLeveling.getLevel(textXp)}LVL`);
                if (voiceXp > 0) conditions.push(`🎙️: ${XpLeveling.getLevel(voiceXp)}LVL`);
                if (videoXp > 0) conditions.push(`🎦: ${XpLeveling.getLevel(videoXp)}LVL`);

                // Join conditions
                const conditionsText = conditions.join(', ');

                // Return a string
                return `ID: ${row.id} [ ${conditionsText} ] ${(lang !== null) ? getL(lang, 'rewards') : 'Rewards'}: <@&${row.role_id}>`;
            }).join('\n');
        }

        return data;
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
            data = Expify.getRewardsEmbedData(interaction, lang);
        }

        //Building response
        const guildName = interaction.guild?.name ?? undefined;
        const guildIcon = interaction.guild?.iconURL() ?? undefined;
        const getEmbed = Lunar.createEmbed(typeName, data, null, 'ffc06e', guildName, guildIcon)
        console.log(`GET ${type} of ${interaction.guildId} (${timeDiff(startTime)}ms)`)
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
        const { [type]: newState } = db.prepare(`SELECT ${type} FROM guild_params WHERE guild_id = ?`).get(interaction.guildId);
        
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
        if (interaction.options.getString('confirmation_1') === 'Yes' && interaction.options.getString('confirmation_2') === 'Yes') {
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
                console.log(`${resetRewards.changes ?? 0} reward records deleted`)
                status = 'guildresetok'
            } catch (err) {
                status = 'operationerr'
                console.error(`Error while resetting Guild ${interaction.guildId}:`, err)
            }

            console.log(`Reset Guild ${interaction.guildId} (${timeDiff(resetTime)}ms)`)
        } else {status = 'guildresetabort'}

        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, `${status}`)}`;
        } else {
            replycontent = `${getL('ru', `${status}`)}`;
        }
        await Lunar.editReply(interaction, replycontent);
    };

    static expifyMigrate = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
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
            return await Lunar.reply(interaction, `${getL('ru', 'guildnotfound')}`, isephemeral)
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
            console.error(`[RANK] Error while loading user data:`, err)
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

    static xpSet = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };

    static xpCalc = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };

    static xpReset = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };

    static noxpCID = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };

    static noxpUID = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };

    static noxpRID = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };

    static top = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };
}

module.exports = { Expify };