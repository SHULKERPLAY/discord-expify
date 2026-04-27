const { db } = require('../dbManager.js')
const { getL, Lunar, XpLeveling, EInteractions, dLang } = require('../functions.js');
const { timeDiff } = require('../utils.js');

async function IxpSet(interaction, lang, client) {
    const startTime = Date.now();
    let userData;

    // Check if guild not exist
    const params = db.prepare("SELECT admin_cid, lang FROM guild_params WHERE guild_id = ?").get(`${interaction.guildId}`);
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
    if (EInteractions.updateUsersXP(interaction.guildId, userid, userData.text_xp, userData.voice_xp, userData.video_xp)) {
        status = `🟢 ${getL(lang ?? dLang, 'updated')}`
    } else {
        status = `🟡 ${getL(lang ?? dLang, 'notupdated')}`
    }
    console.log(`[XP] Replaced ${type} for ${interaction.guildId},${userid}(${timeDiff(startTime)}ms)`)

    // Send notification
    if (params.admin_cid && params.admin_cid !== '0' ) {
        await Lunar.sendEventEmbed(`/xp set-level ${interaction.options.getInteger('level')}`, `<@${interaction.user.id}>`, `<@${userid}>`, `${status}`, interaction.guild, params.admin_cid, params.lang, client);
    };

    await Lunar.editReply(interaction, status);
}

async function IxpAddRemove(interaction, lang, client) {
    const startTime = Date.now();
    
    // Check if guild not exist
    const params = db.prepare("SELECT admin_cid, lang FROM guild_params WHERE guild_id = ?").get(`${interaction.guildId}`);
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
            userData.text_xp = (userData.text_xp + xp) >= EInteractions.maxUserXp ? EInteractions.maxUserXp : (userData.text_xp + xp);
        } else if (type === 'voice_xp') {
            userData.voice_xp = (userData.voice_xp + xp) >= EInteractions.maxUserXp ? EInteractions.maxUserXp : (userData.voice_xp + xp);
        } else if (type === 'video_xp') {
            userData.video_xp = (userData.video_xp + xp) >= EInteractions.maxUserXp ? EInteractions.maxUserXp : (userData.video_xp + xp);
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
    if (EInteractions.updateUsersXP(interaction.guildId, userid, userData.text_xp, userData.voice_xp, userData.video_xp)) {
        status = `🟢 ${getL(lang ?? dLang, 'updated')}`
    } else {
        status = `🟡 ${getL(lang ?? dLang, 'notupdated')}`
    }

    // Send notification
    if (params.admin_cid && params.admin_cid !== '0' ) {
        await Lunar.sendEventEmbed(`/xp ${sub} ${type} ${xp}`, `<@${interaction.user.id}>`, `<@${userid}>`, `${status}`, interaction.guild, params.admin_cid, params.lang, client);
    };

    console.log(`[XP] Replaced ${type} for ${interaction.guildId},${userid}(${timeDiff(startTime)}ms)`)
    await Lunar.editReply(interaction, status);
}

async function IxpCalc(interaction) {
    let result;
    // Get type
    const type = interaction.options.getString('action');

    // Get xp or lvl
    const value = interaction.options.getInteger('quantity');

    // Calculate according limits
    if (type === 'xp') {
        // XP To Level
        const xp = value >= EInteractions.maxUserXp ? EInteractions.maxUserXp : value;
        result = `✅ **${xp}xp = ${XpLeveling.getLevel(xp)}** LVL (+ ${XpLeveling.getLevelProgress(xp)}xp)`
    } else if (type === 'lvl') {
        // Level To XP
        const lvl = value >= EInteractions.maxUserLevel ? EInteractions.maxUserLevel : value;
        result = `✅ **${lvl} LVL = ${XpLeveling.getXpForLevel(lvl)}xp** (+ ${XpLeveling.getXpDiff(lvl)}xp --> ${lvl + 1} LVL)`
    }

    // Sending response
    await Lunar.editReply(interaction, result);
}

async function IxpReset(interaction, lang, client) {
    const startTime = Date.now();

    // Check if guild not exist
    const params = db.prepare("SELECT admin_cid, lang FROM guild_params WHERE guild_id = ?").get(`${interaction.guildId}`);
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

    if (type !== 'none') { result = EInteractions.updateUsersXP(interaction.guildId, userid, userData.text_xp, userData.voice_xp, userData.video_xp) }

    //Write and Building response
    if (result > 0) {
        status = `🟢 ${getL(lang ?? dLang, 'updated')}`
    } else {
        status = `🟡 ${getL(lang ?? dLang, 'notupdated')}`
    }
    console.log(`[XP] Resetted ${type} for ${interaction.guildId},${userid}(${timeDiff(startTime)}ms)`)

    // Send notification
    if (params.admin_cid && params.admin_cid !== '0' ) {
        await Lunar.sendEventEmbed(`/xp reset ${type}`, `<@${interaction.user.id}>`, `<@${userid}>`, `${status}`, interaction.guild, params.admin_cid, params.lang, client);
    };

    await Lunar.editReply(interaction, status);
}

module.exports = { IxpSet, IxpAddRemove, IxpCalc, IxpReset };