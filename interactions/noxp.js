const { db } = require('../dbManager.js')
const { getL, Lunar, EInteractions,  dLang } = require('../functions.js');
const { timeDiff } = require('../utils.js');

async function InoxpIDs(interaction, lang, client) {
    const startTime = Date.now();

    // Check if guild not exist
    const probe = EInteractions.loadGuildParam(`admin_cid, lang`, interaction.guildId);
    if (!probe) { return await Lunar.editReply(interaction, `${getL( lang ?? dLang, 'guildnotfound')}`) }

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
        if (EInteractions.checkConfirmation(interaction)) { return await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'guildresetabort')}`); }
        const resetedType = interaction.options.getString('type') ?? 'all';
        if (resetedType === 'all') {
            type = 'all'
            EInteractions.toggleIgnoreChannel(interaction.guildId, 'noxp_cid', 0, 10, true);
            EInteractions.toggleIgnoreChannel(interaction.guildId, 'noxp_uid', 0, 10, true);
            result = EInteractions.toggleIgnoreChannel(interaction.guildId, 'noxp_rid', 0, 10, true);
        } else {
            type = resetedType
            result = EInteractions.toggleIgnoreChannel(interaction.guildId, resetedType, 0, 10, true);
        }
    } else if (sub === 'list') {
        const request = await EInteractions.getNoxpData(interaction, lang);
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
        result = EInteractions.toggleIgnoreChannel(interaction.guildId, type, objectId, limit);
    }

    // Building response
    let status;
    if (result.success) {
        console.log(`[noXP] Updated ${type} for ${interaction.guildId}(${timeDiff(startTime)}ms)`)
        if (result.added) {
            status = `🟢 ${getL(lang ?? dLang, 'added')}`
            await Lunar.editReply(interaction, status)
        } else {
            status = `🟢 ${getL(lang ?? dLang, 'removed')}`
            await Lunar.editReply(interaction, status)
        }

        // Send notification
        if (probe.admin_cid && probe.admin_cid !== '0' ) {
            await Lunar.sendEventEmbed(`/noxp ${sub}`, `<@${interaction.user.id}>`, null, status, interaction.guild, probe.admin_cid, probe.lang, client);
        };
    } else {
        console.log(`[noXP] Rejected ${type} for ${interaction.guildId}: ${result.reason}(${timeDiff(startTime)}ms)`)
        if (result.reason === 'limit_reached') {
            await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'noxplimit')}`)
        } else if (result.reason === 'guild_missing') {
            await Lunar.editReply(interaction, `${getL(lang ?? dLang, 'guildnotfound')}`)
        }
    }
}

module.exports = { InoxpIDs };