const fs = require('fs');
const path = require('path');
const { MessageFlags, EmbedBuilder } = require('discord.js');
const { timeDiff } = require('./utils.js');
const { db } = require('./dbManager.js')

/** Supported Locales */
const supportedlocales = ['ru', 'en-US', 'uk', 'de', 'fr'];

/** Default Language code */
const dLang = 'en-US';

//Functions
//loading bot localization
function loadlocale() {
    let locale = {};
    try {
        const locpath = path.join(__dirname, 'locales.json');
        if (fs.existsSync(locpath)) locale = JSON.parse(fs.readFileSync(locpath));
    } catch (e) { console.error('Locale load error:', e); }
    return locale;
};
const locale = loadlocale();

//Get all locales on keyword
function getLoc(pathStr, prefix = '') {
    if (!pathStr) { return undefined };
    const result = {};
    const keys = pathStr.split('.'); // Splits requests like (arg.year)

    supportedlocales.forEach(lang => {
        let value = locale[lang];
        for (const k of keys) {
            value = value ? value[k] : undefined;
        }
        if (value) result[lang] = `${prefix}${value}`;
    });
    return result;
};

// Get Locale key
// Proper use it with this helper after defining lang variable: const l = (key) => getL(lang, key); l('pong');
// lang is a string of langcode (e.g. 'en-us'), key is 'string' inside JSON we want to get
function getL(lang, key) {
    return locale[lang]?.[key] ?? '';
};

// Increase stat counter handled in shard manager (CAN BE USED IN THE FUTURE)
function shardStat(key) {
    // Is this process shard?
    if (process.send) {
        process.send({ type: 'incrementStat', stat: key });
    }
}

/** Creates text progressbar
 * @param {number} percent - Fill percent (0-100)
 * @param {number} length - Progressbar length in symbols
 * @returns {string} String type ▓▓▓░░░ */
function renderProgressBar(percent, length) {
    // Limit percent for safe calculation
    const safePercent = Math.min(Math.max(percent, 0), 100);
    
    // Count filled symbols
    const filledLength = Math.round((safePercent / 100) * length);
    
    // Count empty symbols
    const emptyLength = length - filledLength;

    // Compile string: repeating symbols calculated times
    return "▓".repeat(filledLength) + "░".repeat(emptyLength);
}

/** Calculate percent
 * @param {number} current Current value
 * @param {number} required - Needed value to 100%
 * @returns {number} Percent integer 0-100 */
function calculatePercentage(current, required) {
    if (required <= 0) return 0; // Zero or negative Division protect
    
    const percent = (current / required) * 100;
    
    // Round result and limit to 100
    return Math.min(Math.max(Math.round(percent), 0), 100);
}
/** Client on guild create event
 * @param {guild.id} guildId - `guild.id` */
function guildCreate(guildId) {
    if (!guildId) { return }
    const startTime = Date.now();
    try {
        const stmt = db.prepare(`
            INSERT OR IGNORE INTO guild_params (
                guild_id, text_xp, text_xp_rate, voice_xp, voice_xp_rate, video_xp, video_xp_rate,
                noxp_cid, noxp_uid, noxp_rid, announce_cid, admin_cid, rank_cid, reward_mode, lang
            ) VALUES (?, 1, 20, 1, 10, 1, 20, '', '', '', '0', '0', '0', 0, 'en-US')
        `);
        stmt.run(guildId);
        console.log(`GuildCreate Event ${guildId}(${timeDiff(startTime)}ms)`);
    } catch (err) {
        console.error(`[GuildCreate] Error while processing guildSetup signal:`, err)
    }
}


/** Class with functions to perform leveling calculations.
* With current A and B multipliers recomended maximum XP is 160280000 or 1000 LVL.
* XP gain modification allowed only in range 5-100xp per minute. Default is 10xp.
* With 100xp ~3 years in voice required to get maximum level. With 5xp it increases to ~61 year. */ 
class XpLeveling {
    // Base xp multipliers. Level 1 is (A+B)
    static A = 160
    static B = 280

    // Get level int from xp int
    static getLevel(xp = 0) {
        xp = typeof xp === 'string' ? Number(xp) : xp;
        if (xp < (this.A + this.B)) return 0;
        // Solve via discriminant: (-b + sqrt(b^2 - 4ac)) / 2a
        const level = (Math.sqrt(Math.pow(this.B, 2) + 4 * this.A * xp) - this.B) / (2 * this.A);
        return Math.floor(level);
    }
    
    // Get required cumulative xp int for level int
    static getXpForLevel(level = 0) {
        level = typeof level === 'string' ? Number(level) : level;
        if (level <= 0) return 0;
        return this.A * Math.pow(level, 2) + this.B * level;
    }

    // Get total required xp int to get from level to level+1 
    static getXpDiff(level = 0) {
        level = typeof level === 'string' ? Number(level) : level;
        return this.getXpForLevel(level + 1) - this.getXpForLevel(level);
    }

    // Get progress int from start of current level to current xp int
    static getLevelProgress(xp = 0) {
        xp = typeof xp === 'string' ? Number(xp) : xp;
        return (xp) - (this.getXpForLevel(this.getLevel(xp)));
    }
}

// Public functions container
class Lunar {
    static checkephemeral = function(interaction) {
        const isPublic = interaction.options.getBoolean('publicreply') === true;
        if (isPublic) {
            return { publicreplylog: 'public', isephemeral: false };
        };
        return { publicreplylog: '', isephemeral: true };
    };

    // Quick reply: reply(interaction, 'replycontent', true / false, [embed] / null, true / false)
    static reply = async function(interaction, replycontent, isephemeral, embedcontent, hideembeds) {
        try {
            //djs v14.15+ now using flags instead of 'ephemeral: true'
            const replyflag = [];
            const replydata = (replycontent || '').length > 1900 ? replycontent.substring(0, 1900) + "\n......" : replycontent;
            if (isephemeral) replyflag.push(MessageFlags.Ephemeral);
            if (hideembeds) replyflag.push(MessageFlags.SuppressEmbeds);
            await interaction.reply({
                content: replydata || '',
                embeds: embedcontent || [],
                flags: replyflag,
            });
        } catch (error) {
            console.error('Error while sending message:', error.message)
        }
    };

    // Use while editing reply: editReply(interaction, 'If text not needed type null', [embeds]); // Embeds can be null
    static editReply = async function(interaction, replycontent, embedcontent, suppressembeds) {
        const replydata = (replycontent || '').length > 1900 ? replycontent.substring(0, 1900) + "\n......" : replycontent;
        try {
            await interaction.editReply({
                content: replydata || '',
                embeds: embedcontent || [],
                flags: suppressembeds ? [MessageFlags.SuppressEmbeds] : [],
            });
        } catch (error) {
            console.error('Error while editing message:', error.message)
        }
    };

    /** REQUIRED client AS FIRST ARG! Send message to specific channel. Return true if success */
    static sendEvent = async function(client, channelId, content, embedcontent, hideembeds) {
        if (!channelId) { return false }
        const contentdata = (content || '').length > 1900 ? content.substring(0, 1900) + "\n......" : content;
        try {
            const channel = await client.channels.fetch(channelId);
            
            if (!channel) return console.warn(`Channel ${channelId} not found`);
            
            // Check if channel text based
            if (channel.isTextBased()) {
                await channel.send({
                    content: contentdata || '',
                    embeds: embedcontent || [],
                    flags: hideembeds ? [MessageFlags.SuppressEmbeds] : [],
                });
            }
            return true;
        } catch (error) {
            console.error("Error while sending message:", error.message);
            return false;
        }
    }
    static hslToHex = function(h, s, l) {
        l /= 100;
        const a = s * Math.min(l, 1 - l) / 100;
        const f = n => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color).toString(16).padStart(2, '0');
        };
        return `${f(0)}${f(8)}${f(4)}`;
    };

    /** Get random cool color for embed in hsl */
    static getRandomAestheticColor() {
        // Hue: 0 to 360 (spectre)
        const h = Math.floor(Math.random() * 360);
        // Saturation
        const s = 100;
        // Lightness
        const l = 70;

        // Return string for EmbedBuilder().setColor()
        return this.hslToHex(h, s, l);
    };

    //Embed constructor
    static createEmbed(title, data, footer, color, author, authorIcon) {
        // const authoricon = 'https://lunarcreators.ru/discordiconmini.webp'
        // const authorurl = 'https://discord.com'
        
        //Check message length and truncate if necessary
        const descriptioncontent = (data || '').length > 3800 ? data.substring(0, 3800) + "\n......" : data;

        const newembed = new EmbedBuilder()
            .setColor(color.trim() || '00c8ff')
            .setTitle(title)
            .setDescription(descriptioncontent)
            // .setAuthor({ name: 'Expify', iconURL: authoricon, url: authorurl })
            // .setTimestamp()
            .setFooter({ text: footer || '❤️ @Expify#7920' });

            // Author field only if specified
            if (author) { newembed.setAuthor({ name: author, iconURL: authorIcon || undefined })}

        return newembed;
    };
    /** Send admin events in embed
     * @param {string} event - Name of event. It displays in embed title as `Event: ${event}`
     * @param {string} issuer - Mention of issuer as `<@123456789>`
     * @param {string} object - Mention of edited object as `<@987654321>`
     * @param {string} status - Interaction callback
     * @param {interaction.guild} guild - interaction.guild object
     * @param {string} cid - admin_cid or another channel id to send notify
     * @param {string} lang - guild_params `lang` object
     * @param {client} client - DJS Client object is required to send message */
    static sendEventEmbed = async function(event, issuer, object, status, guild, cid, lang, client) {
        if (!client || !lang || !cid) return;
        const l = (key) => getL(lang ?? dLang, key);
        const title = `⚠️ ${l('event')}: \`${event}\``;

        // Cunstructing message without undefined parts
        const data = [
            issuer ? `### 🚩 ${l('executedby')}\n${issuer}` : null,
            object ? `### 📌 ${l('object')}\n${object}` : null,
            status ? `### ℹ️ ${l('status')}\n${status}` : null
        ]
        .filter(line => line !== null) // Removing null elements
        .join('\n');

        const guildName = guild?.name ?? undefined;
        const guildIcon = guild?.iconURL() ?? undefined;

        // Construct embed
        const embed = Lunar.createEmbed(title, data, null, Lunar.getRandomAestheticColor(), guildName, guildIcon);

        // Send message
        await Lunar.sendEvent(client, cid, null, [embed]);
    };
}

//Integer randomizer
//effective range: getRandomInt(-999999999999999, 999999999999999));
//for date: getRandomInt(-62135596800000, 62135596800000)
function getRandomInt(min, max) {
    //null test
    min = min ?? -999999999999999;
    max = max ?? 999999999999999;
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

/** Class with functions and values to help execute user interactions. 
 * Contains various functions, default values and limit ranges */
class EInteractions {
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
     * Usage is: data = EInteractions.getRewardsEmbedData(interaction, lang)
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
            `## 💬 ${getL(lang ?? dLang, 'channels')} (${cidCnt}/${EInteractions.maxNoxpCid})`,
            cids,
            `## 👥 ${getL(lang ?? dLang, 'users')} (${uidCnt}/${EInteractions.maxNoxpUid})`,
            uids,
            `## 🏷️ ${getL(lang ?? dLang, 'roles')} (${ridCnt}/${EInteractions.maxNoxpRid})`,
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
                    return await EInteractions.fetchMembersWithRetry(guild, retries - 1);
                }
            }
            console.error(`Error while fetching members of ${guild.id}:`, error.message); // If no left retries or other error
        }
    };
}

//export
module.exports = { getRandomInt, getLoc, getL, supportedlocales, dLang, shardStat, timeDiff, renderProgressBar, calculatePercentage, Lunar, XpLeveling, EInteractions, guildCreate };