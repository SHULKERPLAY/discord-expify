const { ShardingManager } = require('discord.js');
const path = require('node:path');
const { token } = require('./config.json');
const { deployInteractions } = require('./deploy.js');
const { timeDiff } = require('./functions.js');

const logPrefix = '[Expify Manager]'
const startTime = Date.now();

// Deploy interactions on start
(async() => {
    const deployTime = Date.now();
    await deployInteractions();
    console.log(`Deploy: ${timeDiff(deployTime)}ms`)
})();

// Shard Manager
const manager = new ShardingManager(path.join(__dirname, 'index.js'), {
    token: token,
    totalShards: 'auto', // Automaticly decide count of shards
    respawn: true       // Respawn fallen shards
});

manager.on('shardCreate', shard => {
    console.log(`${logPrefix} Shard started #${shard.id}`);

    // Listening messages from shard
    shard.on('message', message => {
        const messageTime = Date.now()
        if (message.type === 'bulkXpUpdate') { // Database server: Bulk XP incremention from array
            // TBD
        } else if (message.type === 'updateSetting') { // Database server: Instant settings write
            // TBD
        };
        console.log(`${message.type} (${timeDiff(messageTime)}ms)`)
    });
});

// Start all shards
manager.spawn()
    .then(() => console.log(`${logPrefix} All Shards Online in ${timeDiff(startTime)}ms!`))
    .catch(console.error);