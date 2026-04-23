// Core can be started only by shard manager
const corever = '26.04.0c';
const startTime = Date.now();

const { getL, Lunar } = require('./functions.js');
const { Expify } = require('./interactions.js');
const { timeDiff } = require('./functions.js');
const { db } = require('./dbManager.js');
const { processXP, messageActivity } = require('./xpProcess.js');
const { processRewards } = require('./rewardProcess.js');

// Require the necessary discord.js classes
const { Client, Events, GatewayIntentBits, ActivityType, MessageFlags} = require('discord.js');
const { token } = require('./config.json');

// Create a new client instance
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildVoiceStates],
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
    } else if (interaction.commandName === 'expify') {
        await interaction.deferReply({ flags: isephemeral ? [MessageFlags.Ephemeral] : [] });
        const sub = interaction.options.getSubcommand();
        if (sub === 'get') {
            await Expify.expifyGet(interaction, lang);
        } else if (sub === 'toggle') {
            await Expify.expifyToggle(interaction, lang);
        } else if (sub === 'gain') {
            await Expify.expifyGain(interaction, lang);
        } else if (sub === 'channels') {
            const type = interaction.options.getString('type');
            await Expify.expifyCIDs(interaction, lang, type);
        } else if (sub === 'warnings') {
            await Expify.expifyCIDs(interaction, lang, 'admin_cid');
        } else if (sub === 'rank') {
            await Expify.expifyCIDs(interaction, lang, 'rank_cid');
        } else if (sub === 'reset') {
            await Expify.expifyReset(interaction, lang);
        } else if (sub === 'migrate') {
            await Expify.expifyMigrate(client, interaction, lang);
        } else if (sub === 'migrate-help') {
            await Expify.expifyMigrateHelp(interaction, lang);
        } else if (sub === 'xp-reset') {
            await Expify.expifyXpReset(client, interaction, lang);
        }
    } else if (interaction.commandName === 'rank') {
        await Expify.rank(interaction, lang, isephemeral);
    } else if (interaction.commandName === 'reward') {
        await interaction.deferReply({ flags: isephemeral ? [MessageFlags.Ephemeral] : [] });
        const sub = interaction.options.getSubcommand();
        if (sub === 'add') {
            await Expify.rewardAdd(interaction, lang);
        } else if (sub === 'remove') {
            await Expify.rewardRemove(interaction, lang);
        } else if (sub === 'list') {
            await Expify.rewardList(interaction, lang);
        } else if (sub === 'mode') {
            await Expify.rewardMode(interaction, lang);
        }
    } else if (interaction.commandName === 'xp') {
        await interaction.deferReply({ flags: isephemeral ? [MessageFlags.Ephemeral] : [] });
        const sub = interaction.options.getSubcommand()
        if (sub === 'set') {
            await Expify.xpSet(interaction, lang);
        } else if (sub === 'add') {
            await Expify.xpAdd(interaction, lang);
        } else if (sub === 'calc') {
            await Expify.xpCalc(interaction, lang);
        } else if (sub === 'reset') {
            await Expify.xpReset(interaction, lang);
        }
    } else if (interaction.commandName === 'noxp') {
        await interaction.deferReply({ flags: isephemeral ? [MessageFlags.Ephemeral] : [] });
        await Expify.noxpIDs(interaction, lang);
    } else if (interaction.commandName === 'top') {
        await interaction.deferReply({ flags: isephemeral ? [MessageFlags.Ephemeral] : [] });
        await Expify.top(interaction, lang);
    }
});

// Send message to XP buffer
client.on('messageCreate', async (message) => {
    // Ignore bots and private DMs
    if (message.author.bot || !message.guild) return;
    messageActivity(message.guild.id, message.author.id, message.channel.id);
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

    // XP processing cycle cooldown
    const xpInterval = 60000;

    // Rewards processing cycle cooldown
    const rewardInterval = 5 * 60 * 1000;
    
    // Loop reward Cycles
    async function runRewardLoop() {
        try {
            await processRewards(client, db);
        } catch (err) {
            console.error('[REWARDS Loop] Error while processing iteration:', err);
        } finally {
            // Recursive call. Wait 300s after finishing past cycle
            setTimeout(runRewardLoop, rewardInterval);
        }
    }

    // Loop XP Cycles
    async function runXpLoop() {
        try {
            await processXP(client, db);
        } catch (err) {
            console.error('[XP Loop] Error while processing iteration:', err);
        } finally {
            // Recursive call. Wait 60s after finishing past cycle
            setTimeout(runXpLoop, xpInterval);
        }
    }

    runXpLoop();
    runRewardLoop();
});

// Log in to Discord with your client's token
client.login(token).catch((err) => {
    throw err
});
