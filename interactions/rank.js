const { db } = require('../dbManager.js')
const { MessageFlags } = require('discord.js');
const { getL, renderProgressBar, calculatePercentage, Lunar, XpLeveling, dLang } = require('../functions.js');
const { timeDiff } = require('../utils.js');

async function Irank(interaction, lang, isephemeral) {
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
}

module.exports = { Irank };