const fs = require('fs');
const path = require('path');
const { MessageFlags, EmbedBuilder } = require('discord.js');

//Supported Locales
const supportedlocales = ['ru'];

//Functions
//loading bot localization
function loadlocale() {
    let locale = {};
    try {
        const locpath = path.join(__dirname, 'locales.json');
        if (fs.existsSync(locpath)) locale = JSON.parse(fs.readFileSync(locpath));
    } catch (e) { console.error('Locale load error:', e); }
    return locale;
};
const locale = loadlocale();

//Get all locales on keyword
function getLoc(pathStr, prefix = '') {
    const result = {};
    const keys = pathStr.split('.'); // Splits requests like (arg.year)

    supportedlocales.forEach(lang => {
        let value = locale[lang];
        for (const k of keys) {
            value = value ? value[k] : undefined;
        }
        if (value) result[lang] = `${prefix}${value}`;
    });
    return result;
};

// Get Locale key
// Proper use it with this helper after defining lang variable: const l = (key) => getL(lang, key); l('pong');
// lang is a string of langcode (e.g. 'en-us'), key is 'string' inside JSON we want to get
function getL(lang, key) {
    return locale[lang]?.[key] ?? '';
};

// Increase stat counter handled in shard manager (CAN BE USED IN THE FUTURE)
function shardStat(key) {
    // Is this process shard?
    if (process.send) {
        process.send({ type: 'incrementStat', stat: key });
    }
}

function timeDiff(time1, time2) {
    return (time2 ?? Date.now()) - (time1 ?? Date.now())
}

/** Class with functions to perform leveling calculations.
* With current A and B multipliers recomended maximum XP is 160280000 or 1000 LVL.
* XP gain modification allowed only in range 5-100xp per minute. Default is 10xp.
* With 100xp ~3 years in voice required to get maximum level. With 5xp it increases to ~61 year. */ 
class XpLeveling {
    // Base xp multipliers. Level 1 is (A+B)
    static A = 160
    static B = 280

    // Get level int from xp int
    static getLevel(xp = 0) {
        if (xp < (this.A + this.B)) return 0;
        // Solve via discriminant: (-b + sqrt(b^2 - 4ac)) / 2a
        const level = (Math.sqrt(Math.pow(this.B, 2) + 4 * this.A * xp) - this.B) / (2 * this.A);
        return Math.floor(level);
    }

    // Get required cumulative xp int for level int
    static getXpForLevel(level = 0) {
        if (level <= 0) return 0;
        return this.A * Math.pow(level, 2) + this.B * level;
    }

    // Get total required xp int to get from level to level+1 
    static getXpDiff(level = 0) {
        return this.getXpForLevel(level + 1) - this.getXpForLevel(level);
    }

    // Get progress int from start of current level to current xp int
    static getLevelProgress(xp = 0) {
        return (xp) - (this.getXpForLevel(this.getLevel(xp)));
    }
}

// Public functions container
class Lunar {
    static checkephemeral = function(interaction) {
        const isPublic = interaction.options.getBoolean('publicreply') === true;
        if (isPublic) {
            return { publicreplylog: 'public', isephemeral: false };
        };
        return { publicreplylog: '', isephemeral: true };
    };

    // Quick reply: reply(interaction, 'replycontent', true / false, [embed] / null, true / false)
    static reply = async function(interaction, replycontent, isephemeral, embedcontent, hideembeds) {
        try {
            //djs v14.15+ now using flags instead of 'ephemeral: true'
            const replyflag = [];
            const replydata = (replycontent || '').length > 1900 ? replycontent.substring(0, 1900) + "...\n```\nОтображаемый контент превышает 1900 символов!" : replycontent;
            if (isephemeral) replyflag.push(MessageFlags.Ephemeral);
            if (hideembeds) replyflag.push(MessageFlags.SuppressEmbeds);
            await interaction.reply({
                content: replydata || '',
                embeds: embedcontent || [],
                flags: replyflag,
            });
        } catch (error) {
            console.error('Error while sending message:', error.message)
        }
    };

    // Use while editing reply: editReply(interaction, 'If text not needed type null', [embeds]); // Embeds can be null
    static editReply = async function(interaction, replycontent, embedcontent) {
        const replydata = (replycontent || '').length > 1900 ? replycontent.substring(0, 1900) + "...\n```\nОтображаемый контент превышает 1900 символов!" : replycontent;
        try {
            await interaction.editReply({
                content: replydata || '',
                embeds: embedcontent || [],
            });
        } catch (error) {
            console.error('Error while editing message:', error.message)
        }
    };

    //Embed constructor
    static createEmbed(title, data, footer, color) {
        // const authoricon = 'https://lunarcreators.ru/discordiconmini.webp'
        // const authorurl = 'https://discord.com'
        
        //Check message length and truncate if necessary
        const descriptioncontent = (data || '').length > 3800 ? data.substring(0, 3800) + "...\n```\nОтображаемый контент превышает 3800 символов!" : data;

        const newembed = new EmbedBuilder()
            .setColor(color.trim() || '00c8ff')
            .setTitle(title)
            .setDescription(descriptioncontent)
            // .setAuthor({ name: 'Expify', iconURL: authoricon, url: authorurl })
            // .setTimestamp()
            .setFooter({ text: footer || 'С любовью, @Expify#7920' });
        return newembed;
    };
}

//Integer randomizer
//effective range: getRandomInt(-999999999999999, 999999999999999));
//for date: getRandomInt(-62135596800000, 62135596800000)
function getRandomInt(min, max) {
    //null test
    min = min ?? -999999999999999;
    max = max ?? 999999999999999;
    return Math.floor(Math.random() * (max - min + 1)) + min;
};

//export
module.exports = { getRandomInt, getLoc, getL, shardStat, timeDiff, Lunar, XpLeveling };