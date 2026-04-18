const { timeDiff, getL, Lunar } = require('./functions.js');
const { db } = require('./dbManager.js')

// Discord User Interactions
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

    static expifyGet = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };
    
    static expifyToggle = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };

    static expifyGain = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };

    static expifyAnnouncement = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };

    static expifyWarnings = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };

    static expifyReset = async function(interaction, lang) {
        let status;
        if (interaction.options.getString('confirmation_1') === 'Yes' && interaction.options.getString('confirmation_2') === 'Yes') {
            const resetTime = Date.now();
            console.log(`Defaulting Guild ${interaction.guildId}`)
            try {
                const setDefault = db.prepare(`
                    INSERT INTO guild_params (
                        guild_id, text_xp, text_xp_rate, voice_xp, voice_xp_rate, video_xp, video_xp_rate,
                        noxp_cid, noxp_uid, noxp_rid, announce_cid, admin_cid, reward_mode
                    ) VALUES (
                        @guild_id, @text_xp, @text_xp_rate, @voice_xp, @voice_xp_rate, @video_xp, @video_xp_rate,
                        @noxp_cid, @noxp_uid, @noxp_rid, @announce_cid, @admin_cid, @reward_mode
                    )
                    ON CONFLICT(guild_id) DO UPDATE SET
                        text_xp = excluded.text_xp,
                        text_xp_rate = excluded.text_xp_rate,
                        voice_xp = excluded.voice_xp,
                        voice_xp_rate = excluded.voice_xp_rate,
                        video_xp = excluded.video_xp,
                        video_xp_rate = excluded.video_xp_rate,
                        noxp_cid = excluded.noxp_cid,
                        noxp_uid = excluded.noxp_uid,
                        noxp_rid = excluded.noxp_rid,
                        announce_cid = excluded.announce_cid,
                        admin_cid = excluded.admin_cid,
                        reward_mode = excluded.reward_mode
                `);

                const resetRewards = db.prepare(`DELETE FROM role_rewards WHERE guild_id = ?`)

                setDefault.run({
                    guild_id: `${interaction.guildId ?? 0}`, text_xp: 1, text_xp_rate: 20, voice_xp: 1, voice_xp_rate: 10,
                    video_xp: 1, video_xp_rate: 20, noxp_cid: '', noxp_uid: '', noxp_rid: '', announce_cid: '0', admin_cid: '0', reward_mode: 0
                });
                resetRewards.run(`${interaction.guildId}`)
                console.log(`${resetRewards.changes} reward records deleted`)
                status = 'guildresetok'
            } catch (err) {
                status = 'guildreseterr'
                console.error(`Error while resetting Guild ${interaction.guildId}:`, err)
            }

            console.log(`Reset Guild ${interaction.guildId} (${timeDiff(resetTime)}ms)`)
        } else {status = 'guildresetabort'}

        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, `${status}`)}`;
        } else {
            replycontent = `${getL('ru', `${status}`)}`;
        }
        await Lunar.editReply(interaction, replycontent);
    };

    static expifyMigrate = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };

    static rank = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };

    static xpSet = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };

    static xpCalc = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };

    static xpReset = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };

    static noxpCID = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };

    static noxpUID = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };

    static noxpRID = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };

    static top = async function(interaction, lang) {
        //Building response
        let replycontent;
        if (lang) {
            replycontent = `${getL(lang, 'indev')}`;
        } else {
            replycontent = `Work in progress`;
        }
        await Lunar.reply(interaction, replycontent, true, undefined, true);
    };
}

module.exports = { Expify };