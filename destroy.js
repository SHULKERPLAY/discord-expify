const { Client, Routes, Events, GatewayIntentBits } = require('discord.js');
const { token } = require('./config.json');
const { timeDiff } = require('./functions.js');

// Create a new client instance
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

async function destroy() {
    const destroyTime = Date.now()
    //actions as client ready
    client.once(Events.ClientReady, async(readyClient) => {
        try {
            // Clear all interactions
            await client.rest.put(Routes.applicationCommands(client.user.id), { body: [] });
            console.log(`Interactions deleted for ${readyClient.user.tag} (${timeDiff(destroyTime)}ms)!`);
        } catch (error) {
            console.error(`Failed to destroy interactions ${timeDiff(destroyTime)}ms:`, error.message);
        } finally {
            //End session
            client.destroy();
        } 
    });
    // Authorization
    await client.login(token);
}
destroy();