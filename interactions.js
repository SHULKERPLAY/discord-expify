const { convertGmtToSeconds, getRandomInt, getDateInt, getL, Lunar } = require('./functions.js');

class Expify {
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
}

module.exports = { Expify };