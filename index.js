// Core can be started only by shard manager
const corever = '26.04.1d';
const startTime = Date.now();

const { getL, Lunar, guildCreate } = require('./functions.js');
const { Expify } = require('./interactions.js');
const { timeDiff } = require('./utils.js');
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
            await Expify.expifyToggle(interaction, lang, client);
        } else if (sub === 'gain') {
            await Expify.expifyGain(interaction, lang, client);
        } else if (sub === 'channels') {
            await Expify.expifyCIDs(interaction, lang);
        } else if (sub === 'reset') {
            await Expify.expifyReset(interaction, lang);
        } else if (sub === 'migrate') {
            await Expify.expifyMigrate(client, interaction, lang);
        } else if (sub === 'migrate-help') {
            await Expify.expifyMigrateHelp(interaction, lang);
        } else if (sub === 'xp-reset') {
            await Expify.expifyXpReset(client, interaction, lang);
        } else if (sub === 'cleanup-rewards') {
            await Expify.expifyCleanupRewards(client, interaction, lang);
        }
    } else if (interaction.commandName === 'rank') {
        await Expify.rank(interaction, lang, isephemeral);
    } else if (interaction.commandName === 'reward') {
        await interaction.deferReply({ flags: isephemeral ? [MessageFlags.Ephemeral] : [] });
        const sub = interaction.options.getSubcommand();
        if (sub === 'add') {
            await Expify.rewardAdd(interaction, lang);
        } else if (sub === 'remove') {
            await Expify.rewardRemove(interaction, lang, client);
        } else if (sub === 'list') {
            await Expify.rewardList(interaction, lang);
        } else if (sub === 'mode') {
            await Expify.rewardMode(interaction, lang, client);
        }
    } else if (interaction.commandName === 'xp') {
        await interaction.deferReply({ flags: isephemeral ? [MessageFlags.Ephemeral] : [] });
        const sub = interaction.options.getSubcommand()
        if (sub === 'set-level') {
            await Expify.xpSet(interaction, lang, client);
        } else if (sub === 'add') {
            await Expify.xpAddRemove(interaction, lang, client);
        } else if (sub === 'remove') {
            await Expify.xpAddRemove(interaction, lang, client);
        } else if (sub === 'calc') {
            await Expify.xpCalc(interaction, lang);
        } else if (sub === 'reset') {
            await Expify.xpReset(interaction, lang, client);
        }
    } else if (interaction.commandName === 'noxp') {
        await interaction.deferReply({ flags: isephemeral ? [MessageFlags.Ephemeral] : [] });
        await Expify.noxpIDs(interaction, lang, client);
    } else if (interaction.commandName === 'top') {
        await interaction.deferReply({ flags: isephemeral ? [MessageFlags.Ephemeral] : [] });
        await Expify.top(interaction, lang);
    } else if (interaction.commandName === 'lang') {
        await interaction.deferReply({ flags: isephemeral ? [MessageFlags.Ephemeral] : [] });
        await Expify.lang(client, interaction, lang);
    }
});

// Send message to XP buffer
client.on('messageCreate', async (message) => {
    // Ignore bots and private DMs
    if (message.author.bot || !message.guild) return;
    messageActivity(message.guild.id, message.author.id, message.channel.id);
});

client.on('guildCreate', (guild) => {
    // Init guild in database
    guildCreate(guild.id)
});

//actions as client ready
client.once(Events.ClientReady, async(readyClient) => {
    //fetch application data
    await readyClient.application.fetch();

    //Login output
    console.log(`Logged in as ${readyClient.user.tag}: Shard ${client.shard.ids[0]} (${timeDiff(startTime)}ms)`);
    
    //index init
    let currentIndex = 0;

    // Time to update presence status
    const presenceInterval = 30 * 60 * 1000;

    function presenceupdate() {
        //check if client ready
        if (!client.user) return;

        // Update presence only by first shard!
        if (client.shard && client.shard.ids[0] !== 0) return;
        
        // Count active users for presence status
        let activeCount;
        if (currentIndex === 1) {
            activeCount = db.prepare(`
                SELECT COUNT(*) as total 
                FROM users 
                WHERE last_updated > ?
            `).get(Date.now() - presenceInterval * 2).total;
        }

        //Bot Presence List
        const presencelist = [
            { name: `🔮 Core Version • ${corever}`, type: ActivityType.Streaming },
            { name: `💥 Users Active • ${activeCount}`, type: ActivityType.Streaming },
            { name: `🏆 Use /rank to check level!`, type: ActivityType.Streaming }
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
    setInterval(presenceupdate, presenceInterval);

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
