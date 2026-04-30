const { getL, Lunar, dLang } = require('./functions.js');
const { IexpifyGet, IexpifyToggle, IexpifyGain, IexpifyCIDs, IexpifyReset, IexpifyXpReset, IexpifyMigrate, IexpifyCleanupRewards } = require('./interactions/expify.js');
const { Irank } = require('./interactions/rank.js');
const { Ilang } = require('./interactions/lang.js');
const { InoxpIDs } = require('./interactions/noxp.js');
const { Itop } = require('./interactions/top.js');
const { IxpSet, IxpAddRemove, IxpCalc, IxpReset } = require('./interactions/xp.js')
const { IrewardAdd, IrewardRemove, IrewardList, IrewardMode } = require('./interactions/reward.js')

// Discord User Interactions
class Expify {
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

    static expifyGet = function(interaction, lang) {
        return IexpifyGet(interaction, lang);
    };
    
    static expifyToggle = function(interaction, lang, client) {
        return IexpifyToggle(interaction, lang, client);
    };

    static expifyGain = function(interaction, lang, client) {
        return IexpifyGain(interaction, lang, client);
    };

    static expifyCIDs = function(interaction, lang) {
        return IexpifyCIDs(interaction, lang);
    };

    static expifyReset = function(interaction, lang) {
        return IexpifyReset(interaction, lang);
    };

    static expifyXpReset = function(client, interaction, lang) {
        return IexpifyXpReset(client, interaction, lang);
    };

    static expifyMigrate = function(client, interaction, lang) {
        return IexpifyMigrate(client, interaction, lang)
    };

    static expifyMigrateHelp = async function(interaction, lang, isephemeral) {
        //Building response
        let replycontent = `✅ ${getL(lang ?? dLang, 'expifymigratehelp')}`;
        await Lunar.editReply(interaction, replycontent, null, true);
    };

    static expifyCleanupRewards = function (client, interaction, lang) {
        return IexpifyCleanupRewards(client, interaction, lang);
    };

    static rank = function(interaction, lang, isephemeral) {
        return Irank(interaction, lang, isephemeral);
    };

    static rewardAdd = function(interaction, lang) {
        return IrewardAdd(interaction, lang);
    };

    static rewardRemove = function(interaction, lang, client) {
        return IrewardRemove(interaction, lang, client);
    };

    static rewardList = function(interaction, lang) {
        return IrewardList(interaction, lang);
    };

    static rewardMode = function(interaction, lang, client) {
        return IrewardMode(interaction, lang, client);
    };

    static xpSet = function(interaction, lang, client) {
        return IxpSet(interaction, lang, client);
    };

    static xpAddRemove = function(interaction, lang, client) {
        return IxpAddRemove(interaction, lang, client);
    };

    static xpCalc = function(interaction, lang) {
        return IxpCalc(interaction);
    };

    static xpReset = function(interaction, lang, client) {
        return IxpReset(interaction, lang, client);
    };

    static noxpIDs = function(interaction, lang, client) {
        return InoxpIDs(interaction, lang, client);
    };

    static top = function(interaction, lang) {
        return Itop(interaction, lang)
    };

    static lang = function(client, interaction, lang) {
        return Ilang(client, interaction, lang);
    };
}

module.exports = { Expify, dLang };