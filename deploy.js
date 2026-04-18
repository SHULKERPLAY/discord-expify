// Require the necessary discord.js classes
const { Client, Events, Routes, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');
const { ExpifyBuiler } = require('./builder.js');

// Deploys actual interactions once shard manager calls this function
async function deployInteractions() {
    try {
        //Convert builder objects to JSON
        const expifyjson = Object.values(ExpifyBuiler).map(command => command.toJSON());
        //Define commands
        const commands = expifyjson;

        //Client setup
        const client = new Client({ intents: [GatewayIntentBits.Guilds] });

        client.once(Events.ClientReady, async (readyClient) => {
            try {
                //app commands registration
                await client.rest.put(Routes.applicationCommands(client.user.id), { body: commands });
                console.log(`Interactions Deployed for ${readyClient.user.tag}!`);
            } catch (error) {
                console.error(`Failed to deploy interactions:`, error.message);
            } finally {
                //End session
                client.destroy();
            }
        });
        //Authorization
        await client.login(token);
    } catch (err) {
        console.error('Critical error:', err.message);
    }
}

module.exports = { deployInteractions };