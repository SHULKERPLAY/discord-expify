// Core can be started only by shard manager
const corever = '26.04.2a';
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

    // Commands that don't need to defer reply
    const skipDefer = ['ping', 'about', 'invite', 'rank'];

    // Send defer if not in skiplist
    if (!skipDefer.includes(interaction.commandName)) {
        await interaction.deferReply({ flags: isephemeral ? [MessageFlags.Ephemeral] : [] });
    }
    
    // Use router to perform commands
    const CommandRouter = {
        // Full commands
        ping: (int) => Expify.ping(int, client, lang),
        about: (int) => Expify.about(int, lang, corever),
        invite: (int) => Expify.invite(int, lang),
        rank: (int) => Expify.rank(int, lang, isephemeral),
        noxp: (int) => Expify.noxpIDs(int, lang, client),
        top: (int) => Expify.top(int, lang),
        lang: (int) => Expify.lang(client, int, lang),
        // With subcommands
        expify: async (int) => {
            const sub = int.options.getSubcommand();
            const subCommands = {
                get: () => Expify.expifyGet(int, lang),
                gain: () => Expify.expifyGain(int, lang, client),
                channels: () => Expify.expifyCIDs(int, lang),
                reset: () => Expify.expifyReset(int, lang),
                migrate: () => Expify.expifyMigrate(client, int, lang),
                "migrate-help": () => Expify.expifyMigrateHelp(int, lang),
                "xp-reset": () => Expify.expifyXpReset(client, int, lang),
                "cleanup-rewards": () => Expify.expifyCleanupRewards(client, int, lang),
                toggle: () => Expify.expifyToggle(int, lang, client)
            };
            return subCommands[sub]?.();
        },
        reward: async (int) => {
            const sub = int.options.getSubcommand();
            const subCommands = {
                add: () => Expify.rewardAdd(int, lang),
                remove: () => Expify.rewardRemove(int, lang, client),
                list: () => Expify.rewardList(int, lang),
                mode: () => Expify.rewardMode(int, lang, client)
            };
            return subCommands[sub]?.();
        },
        xp: async (int) => {
            const sub = int.options.getSubcommand();
            const subCommands = {
                "set-level": () => Expify.xpSet(interaction, lang, client),
                add: () => Expify.xpAddRemove(interaction, lang, client),
                remove: () => Expify.xpAddRemove(interaction, lang, client),
                calc: () => Expify.xpCalc(interaction, lang),
                reset: () => Expify.xpReset(interaction, lang, client)
            };
            return subCommands[sub]?.();
        }
    };

    // Perform interaction
    const command = CommandRouter[interaction.commandName];
    if (command) {
        await command(interaction);
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
