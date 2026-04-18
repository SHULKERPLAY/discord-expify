const { ShardingManager } = require('discord.js');
const path = require('node:path');
const { token } = require('./config.json');
const { deployInteractions } = require('./deploy.js');
const { timeDiff } = require('./functions.js');
const { db } = require('./dbManager.js')

const logPrefix = '[Expify Manager]';
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
        } else if (message.type === 'guildSetup') {
            const stmt = db.prepare(`
                INSERT OR IGNORE INTO guild_params (
                guild_id, voice_xp, voice_xp_rate, text_xp, text_xp_rate, 
                video_xp, video_xp_rate, noxp_cid, noxp_uid, announce_cid, reward_mode
                ) VALUES (?, 1, 10, 1, 10, 1, 10, '', '', '0', 0)
            `);
            stmt.run(message.guildId);
        };
        console.log(`${message.type} (${timeDiff(messageTime)}ms)`)
    });
});

// Start all shards
manager.spawn()
    .then(() => console.log(`${logPrefix} All Shards Online in ${timeDiff(startTime)}ms!`))
    .catch(console.error);