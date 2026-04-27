const { db } = require('../dbManager.js')
const { getL, Lunar, supportedlocales, dLang, EInteractions } = require('../functions.js');
const { timeDiff } = require('../utils.js');

async function Ilang(client, interaction, lang) {
    const startTime = Date.now();

    // Check if guild not exist
    const params = EInteractions.loadGuildParam(`admin_cid, lang`, interaction.guildId);
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
        await Lunar.sendEventEmbed(`/lang ${newlang}`, `<@${interaction.user.id}>`, null, `${replycontent}`, interaction.guild, params.admin_cid, params.lang, client);
    }

    await Lunar.editReply(interaction, replycontent);
}

module.exports = { Ilang };