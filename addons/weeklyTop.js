// This addon requires DiscordJS and better-sqlite3 to be installed (npm i discordjs better-sqlite3)
// Sending messages of XP top of requested server in reqested channel
// REMOVES ALL CURRENT BOT MESSAGES WITHIN LAST 100 MESSAGES AND LAST 14 DAYS! RECOMMENDED TO USE FOR CALLING TOPS IN DEDICATED CHANNEL! (User messages will not be removed)
// Requires to locate in main folder with bot. In same directory as config.json
// Bot token reads from config.json and cannot be passed by arguments

// ARGS FOR CALLING: node weeklyTop.js [Guild ID] [Channel ID] [Number of pages for TOP TEXT] [Number of pages for TOP TEXT] [Number of pages for TOP TEXT]

const fs = require('fs');
const path = require('path');
const { Client, Events, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const { token } = require('./config.json');
const Database = require('better-sqlite3');
const db = new Database(path.join(__dirname, 'expify.db'));

// Config
const dLang = 'ru'
const ARG_GID = process.argv[2];
const ARG_CID = process.argv[3];
const ARG_TEXT_PAGES = validateNumber(process.argv[4]);
const ARG_VOICE_PAGES = validateNumber(process.argv[5]);
const ARG_VIDEO_PAGES = validateNumber(process.argv[6]);
const logprefix = '[EXPIFY TOP ON DEMAND]';

// Check if one of arguments are empty
if (!ARG_GID || !ARG_CID || ARG_TEXT_PAGES < 0 || ARG_VOICE_PAGES < 0 || ARG_VIDEO_PAGES < 0) {
    console.error("ONE OR MORE ARGUMENTS NOT SPECIFIED")
    process.exit(1)
}

//Client setup
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

//Functions
// Sleep func
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function validateNumber(num) {
    // Force convert to number
    num = Number(num)

    // Check if numbers are valid
    if (isNaN(num) || !isFinite(num) || num < 0) {
        console.error(`Error, wrong integer (${num}). Resetting to 1`);
        num = 1; // Safe default
    }

    return num
};

//loading bot localization
function loadlocale() {
    let locale = {};
    try {
        const locpath = path.join(__dirname, 'locales.json');
        if (fs.existsSync(locpath)) locale = JSON.parse(fs.readFileSync(locpath));
    } catch (e) { console.error(`${logprefix} Locale load error:`, e); }
    return locale;
};
const locale = loadlocale();

// Get Locale key
// Proper use it with this helper after defining lang variable: const l = (key) => getL(lang, key); l('pong');
// lang is a string of langcode (e.g. 'en-us'), key is 'string' inside JSON we want to get
function getL(lang, key) {
    return locale[lang]?.[key] ?? '';
};

//Embed constructor
function createEmbed(title, data, footer, color, author, authorIcon) {
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

/** Load any value from Guild Params by GuildId
 * @param {string} types - What to load (`*` or `admin_cid, lang, ...`)
 * @param {string} guildId - GuildID */
function loadGuildParam(types, guildId) {
    let data;
    try {
        data = db.prepare(`SELECT ${types} FROM guild_params WHERE guild_id = ?`).get(`${guildId}`);
    } catch (err) {
        console.error(`${logprefix} [DB] Error while loading guild_params '${types}' of ${guildId}:`, err)
    }
    return data;
}

// Create and send top with params: lang ('ru'), type ('voice_xp'), page (1), guild (Discord JS guild object), channelId. 
async function localTop(lang, type, page = 1, guild, channelId) {
    const limit = 20;
    let topUsers;

    // Check if guild not exist
    const params = loadGuildParam(`text_xp, voice_xp, video_xp`, guild.id);
    if (!params) {
        console.error(`${logprefix} ${getL(lang ?? dLang, 'guildnotfound')}`)
        return
    };

    // Reply if this XP type is disabled
    let disabledxp;
    if (type === 'text_xp') { disabledxp = params.text_xp } else if (type === 'voice_xp') { disabledxp = params.voice_xp } else if (type === 'video_xp') { disabledxp = params.video_xp }
    if (disabledxp == 0) {
        console.error(`${logprefix} ${getL( lang ?? dLang, 'somerankdisabled')}`)
        return
    };

    // Get total count of pages
    const { total } = db.prepare(`
        SELECT COUNT(*) as total FROM users 
        WHERE guild_id = ? AND ${type} > 0
    `).get(guild.id);

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
        `).all(guild.id, limit, offset);
    } catch (err) {
        console.error(`${logprefix} [TOP] Error while loading user data:`, err);
        return
    }

    if (topUsers.length === 0) {
        console.error(`${logprefix} ${getL( lang ?? dLang, 'topempty')}`)
        return
    };

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
    const guildName = guild?.name ?? undefined;
    const guildIcon = guild?.iconURL() ?? undefined;
    const getEmbed = createEmbed(`${getL( lang ?? dLang, 'topserver')}: ${mapType[type]} (${page}/${totalPages})`, leaderboard, null, color, guildName, guildIcon)

    console.log(`${logprefix} Sent TOP ${type} of ${guild.id}`)
    await sendEvent(client, channelId, null, [getEmbed]);
}

/** REQUIRED client AS FIRST ARG! Send message to specific channel. Return true if success */
async function sendEvent(client, channelId, content, embedcontent, hideembeds) {
    if (!channelId) { return false }
    const contentdata = (content || '').length > 1900 ? content.substring(0, 1900) + "\n......" : content;
    try {
        const channel = await client.channels.fetch(channelId);
        
        if (!channel) return console.warn(`${logprefix} Channel ${channelId} not found`);
        
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
        console.error(`${logprefix} Error while sending message:`, error.message);
        return false;
    }
}

// Clear current bot messages from channel within last 100 messages for last 14 days
async function clearRecentMessages(channelId) {
  try {
    // Fetch current channel
    const channel = await client.channels.fetch(channelId);

    // Get last 100 messages from channel
    const fetched = await channel.messages.fetch({ limit: 100 });
    
    // Filter to only bot own messages
    const botMessages = fetched.filter(msg => msg.author.id === client.user.id);
    
    if (botMessages.size > 0) {
      // Remove all current bot messages sent for last 14 days
      const deleted = await channel.bulkDelete(botMessages, true);
      console.log(`${logprefix} Removed self messages: ${deleted.size}`);
    } else {
      console.log(`${logprefix} Self messages not found in last 100 messages`);
    }
  } catch (error) {
    console.error(`${logprefix} Error removing self messages:`, error.message);
  }
}

client.once(Events.ClientReady, async (readyClient) => {
    console.log(`${logprefix} Ready! Logged in as ${readyClient.user.tag}`);

    // Key actions
    // Fetch guild object
    const guild = client.guilds.cache.get(ARG_GID);
    if (!guild) {
        console.error(`${logprefix} Failed to fetch guild ${ARG_GID}`)
        process.exit(1)
    };

    // Clear last messages from bot
    await clearRecentMessages(ARG_CID)

    // Parse params and send tops
    // Text XP
    for (let i = 1; i <= ARG_TEXT_PAGES; i++) {
        await localTop('ru', 'text_xp', i, guild, ARG_CID)
        await sleep(500);
    }
    // Voice XP
    for (let i = 1; i <= ARG_VOICE_PAGES; i++) {
        await localTop('ru', 'voice_xp', i, guild, ARG_CID)
        await sleep(500);
    }
    // Video XP
    for (let i = 1; i <= ARG_VIDEO_PAGES; i++) {
        await localTop('ru', 'video_xp', i, guild, ARG_CID)
        await sleep(500);
    }
    //End session
    client.destroy();
    process.exit(0)
})

// Log in to Discord with your client's token
client.login(token).catch((err) => {
    throw err
});