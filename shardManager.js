const { ShardingManager } = require('discord.js');
const path = require('node:path');
const { token } = require('./config.json');
const { deployInteractions } = require('./deploy.js');
const { timeDiff } = require('./utils.js');
const { db, dbSaveOnExit, dbSave, initializeDB } = require('./dbManager.js')

const logPrefix = '[Expify Manager]';
const startTime = Date.now();

// Deploy interactions on start
(async() => {
    const deployTime = Date.now();
    await deployInteractions();
    console.log(`Deploy: ${timeDiff(deployTime)}ms`)
})();

// Database Init
initializeDB()

// Catch Ctrl + C
process.on('SIGINT', dbSaveOnExit);

// Catch SIGTERM interrupt
process.on('SIGTERM', dbSaveOnExit);

// Database Autosaving
setInterval(dbSave, 60 * 60 * 1000); // Per 1 hour

// Shard Manager
const manager = new ShardingManager(path.join(__dirname, 'index.js'), {
    token: token,
    totalShards: 'auto', // Automaticly decide count of shards
    respawn: true       // Respawn fallen shards
});

manager.on('shardCreate', shard => {
    console.log(`${logPrefix} Shard started #${shard.id}`);
// Listening messages from shard
//shard.on('message', message => {
//});
});

// Start all shards
manager.spawn()
    .then(() => console.log(`${logPrefix} All Shards Online in ${timeDiff(startTime)}ms!`))
    .catch(console.error);