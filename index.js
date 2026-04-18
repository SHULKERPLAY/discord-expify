// Core can be started only by shard manager
const corever = 'indev 03';
const startTime = Date.now();

const { getL, Lunar } = require('./functions.js');
const { Expify } = require('./interactions.js');
const { timeDiff } = require('./functions.js');

// Require the necessary discord.js classes
const { Client, Events, GatewayIntentBits, ActivityType } = require('discord.js');
const { token } = require('./config.json');

// Create a new client instance
const client = new Client({
    intents: [GatewayIntentBits.Guilds],
    rest: { timeout: 60000 } 
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    //decide if reply be ephemeral (publicreply: false / true)
    let { publicreplylog, isephemeral } = Lunar.checkephemeral(interaction);

    //Get locale obj and null if not found
    const lang = getL(interaction.locale, 'hello') ? `${interaction.locale}` : null;

    //get commandName
    if (interaction.commandName === 'ping') {
        await Expify.ping(interaction, client, lang);
    } else if (interaction.commandName === 'about') {
        await Expify.about(interaction, lang, corever);
    } else if (interaction.commandName === 'invite') {
        await Expify.invite(interaction, lang);
    }
});

//actions as client ready
client.once(Events.ClientReady, async(readyClient) => {
    //fetch application data
    await readyClient.application.fetch();

    //Login output
    console.log(`Logged in as ${readyClient.user.tag}: Shard ${client.shard.ids[0]} (${timeDiff(startTime)}ms)`);
    
    //index init
    let currentIndex = 0;

    function presenceupdate() {
        //check if client ready
        if (!client.user) return;

        // Update presence only by first shard!
        if (client.shard && client.shard.ids[0] !== 0) return;

        //Bot Presence List
        const presencelist = [
            { name: `🔮 Версия ядра • ${corever}`, type: ActivityType.Streaming },
            { name: `🔮 Индекс • ${currentIndex}`, type: ActivityType.Streaming }
        ];

        //Set Presence
        client.user.setPresence({
            activities: [presencelist[currentIndex]],
            status: 'online',
        });

        //next index (0 in the end)
        currentIndex = (currentIndex + 1) % presencelist.length;
    };
    
    //Update presence on Login
    presenceupdate();
    //Update presence every (x, ms)
    setInterval(presenceupdate, 1800000);
});

// Log in to Discord with your client's token
client.login(token).catch((err) => {
    throw err
});
