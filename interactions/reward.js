const { db } = require('../dbManager.js')
const { getL, Lunar, XpLeveling, EInteractions, dLang } = require('../functions.js');
const { timeDiff } = require('../utils.js');

async function IrewardAdd(interaction, lang) {
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
    if (!existing && total >= EInteractions.maxRewards) {
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
}

async function IrewardRemove(interaction, lang, client) {
    const startTime = Date.now();
    let result;
    let status;
    const rewardId = interaction.options.getInteger('id') ?? 0;

    // Check if guild not exist
    const params = db.prepare("SELECT admin_cid, lang FROM guild_params WHERE guild_id = ?").get(`${interaction.guildId}`);
    if (!params) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'guildnotfound')}`) }

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

    // Send notification
    if (params.admin_cid && params.admin_cid !== '0' ) {
        await Lunar.sendEventEmbed(`/reward remove ${rewardId}`, `<@${interaction.user.id}>`, null, `${status}`, interaction.guild, params.admin_cid, params.lang, client);
    };
    
    await Lunar.editReply(interaction, status);
}

async function IrewardList(interaction, lang) {
    const startTime = Date.now();
    const l = (key) => getL(lang ?? dLang, key);
    const rewards = EInteractions.getRewardsEmbedData(interaction, lang);
    const typeName = `🎖️ ${l('rewards')} (${rewards.count}/${EInteractions.maxRewards})`;
    const data = rewards.data;

    //Building response
    const guildName = interaction.guild?.name ?? undefined;
    const guildIcon = interaction.guild?.iconURL() ?? undefined;
    const footer = `⌨️: ${l('textxp')}, 🎙️: ${l('voicexp')}, 🎦: ${l('videoxp')}`
    const getEmbed = Lunar.createEmbed(typeName, data, footer, '716eff', guildName, guildIcon)

    console.log(`GET rewards of ${interaction.guildId}(${timeDiff(startTime)}ms)`)
    await Lunar.editReply(interaction, null, [getEmbed]);
}

async function IrewardMode(interaction, lang, client) {
    const startTime = Date.now();
    let status;

    // Check confirmation
    if (interaction.options.getString('confirmation_1') !== 'Yes' || interaction.options.getString('confirmation_2') !== 'Yes') { return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'guildresetabort')}`); }

    // Check if guild not exist
    const params = db.prepare("SELECT reward_mode, admin_cid, lang FROM guild_params WHERE guild_id = ?").get(`${interaction.guildId}`);
    if (!params) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'guildnotfound')}`) }

    // Get type to set
    let type;
    if (interaction.options.getString('type') === 'all') { type = 0 } else { type = 1 }

    if (EInteractions.updateGuildParam('reward_mode', type, interaction.guildId)) {
        status = `🟢 ${getL(lang ?? dLang, 'updated')}`
    } else {
        status = `🟡 ${getL(lang ?? dLang, 'notupdated')}`
    }

    //Building response
    console.log(`Updated reward_mode for ${interaction.guildId}(${timeDiff(startTime)}ms)`)

    // Send notification
    if (params.admin_cid && params.admin_cid !== '0' ) {
        await Lunar.sendEventEmbed(`/reward mode ${interaction.options.getString('type')}`, `<@${interaction.user.id}>`, null, `${status}`, interaction.guild, params.admin_cid, params.lang, client);
    };

    await Lunar.editReply(interaction, status);
}

module.exports = { IrewardAdd, IrewardRemove, IrewardList, IrewardMode };