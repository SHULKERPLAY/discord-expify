const { db } = require('../dbManager.js')
const { getL, Lunar, dLang } = require('../functions.js');
const { timeDiff } = require('../utils.js');

async function Itop(interaction, lang) {
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
}

module.exports = { Itop };