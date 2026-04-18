const { timeDiff } = require('./functions.js');

const path = require('node:path');
const Database = require('better-sqlite3');
const db = new Database(path.join(__dirname, 'expify.db'));

// Enable WAL mode for multiple r/w operations
db.pragma('journal_mode = WAL');

// Save Database on process interruption
const shutdown = () => {
    console.log('\n[Expify Database] Catch Interrupt... Saving database.');
    try {
        // Force checkpoint
        db.pragma('wal_checkpoint(RESTART)');
        
        // Close DB connection
        db.close();
        
        console.log('[Expify Database] Closed. Datasync complete.');
    } catch (err) {
        console.error('[Expify Database ERROR] Error while saving database on exit:', err);
    }
    process.exit(0);
};

// Catch Ctrl + C
process.on('SIGINT', shutdown);

// Catch SIGTERM interrupt
process.on('SIGTERM', shutdown);

// Database Autosaving
setInterval(() => {
    try {
        // PASSIVE mode not blocking R/W operations
        db.pragma('wal_checkpoint(PASSIVE)');
        console.log('[Expify Database] WAL checkpoint complete.');
    } catch (err) {
        console.error('[Expify Database ERROR] Error while autosaving:', err);
    }
}, 60 * 60 * 1000); // Per 1 hour

/** Restore missing columns
 * @param {string} tableName - Table Name ('users')
 * @param {Object} columns - Object type { column_name: "DATATYPE" } */
function checkColumns(tableName, columns) {
    const checkTime = Date.now();
    // Get data structure
    const existingColumns = db.prepare(`PRAGMA table_info(${tableName})`)
        .all()
        .map(col => col.name);

    for (const [columnName, definition] of Object.entries(columns)) {
        if (!existingColumns.includes(columnName)) {
            try {
                db.prepare(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${definition}`).run();
                console.log(`[ExpifyDB Column Check] Added column ${tableName} in table: ${columnName}`);
            } catch (err) {
                console.error(`[ExpifyDB Column Check Error] Failed to add column ${columnName}:`, err.message);
            }
        }
    }

    console.log(`[ExpifyDB Column Check] ${tableName} checked in ${timeDiff(checkTime)}ms`)
}

const checkDB = () => {
    // Check users table
    checkColumns('users', {
        'guild_id': 'TEXT',
        'user_id': 'TEXT',
        'text_xp': 'INTEGER DEFAULT 0',
        'voice_xp': 'INTEGER DEFAULT 0',
        'video_xp': 'INTEGER DEFAULT 0'
    });

    // Check guild_params table
    checkColumns('guild_params', {
        'text_xp': 'INTEGER DEFAULT 1',
        'text_xp_rate': 'INTEGER DEFAULT 20',
        'voice_xp': 'INTEGER DEFAULT 1',
        'voice_xp_rate': 'INTEGER DEFAULT 10',
        'video_xp': 'INTEGER DEFAULT 1',
        'video_xp_rate': 'INTEGER DEFAULT 20',
        'noxp_cid': "TEXT DEFAULT ''",
        'noxp_uid': "TEXT DEFAULT ''",
        'announce_cid': "TEXT DEFAULT '0'",
        'admin_cid': "TEXT DEFAULT '0'",
        'reward_mode': 'INTEGER DEFAULT 0'
    });

    // Check role_rewards table
    checkColumns('role_rewards', {
        'guild_id': 'TEXT',
        'xp_required': 'TEXT',
        'xp_class': 'INTEGER',
        'role_id': 'TEXT'
    });

    // Check guild_limits table
    checkColumns('guild_limits', {
        'migrate_1': 'INTEGER',
        'migrage_2': 'INTEGER'
    });
};

// Check and create Database
const initializeDB = () => {
    const initTime = Date.now();
    // User progress (Composite primary key)
    db.prepare(`
        CREATE TABLE IF NOT EXISTS users (
            guild_id TEXT,
            user_id TEXT,
            text_xp INTEGER DEFAULT 0,
            voice_xp INTEGER DEFAULT 0,
            video_xp INTEGER DEFAULT 0,
            PRIMARY KEY (guild_id, user_id)
        )
    `).run();

    /* Guilds settings
     * noxp_cid - ChannelsID with "," separator
     * noxp_uid - UsersID with "," separator 
     * reward_mode: 0 - All Roles, 1 - Only Highest Reward Role */
    db.prepare(`
        CREATE TABLE IF NOT EXISTS guild_params (
            guild_id TEXT PRIMARY KEY,
            text_xp INTEGER DEFAULT 1,
            text_xp_rate INTEGER DEFAULT 20,
            voice_xp INTEGER DEFAULT 1,
            voice_xp_rate INTEGER DEFAULT 10,
            video_xp INTEGER DEFAULT 1,
            video_xp_rate INTEGER DEFAULT 20,
            noxp_cid TEXT DEFAULT '',
            noxp_uid TEXT DEFAULT '',
            announce_cid TEXT DEFAULT '0',
            admin_cid TEXT DEFAULT '0',
            reward_mode INTEGER DEFAULT 0
        )
    `).run();

    /* Role rewards data (xp_required: 'text,voice,video').
     * xp_class need to placed with rule creation. 
     * xp_class 0 means that only single XP type used to give a reward. (xp_required: '0,500,0' or '500,0,0').
     * xp_class 1 means that rule contains multiple conditions (xp_required: '200,500,400' or '500,0,600').
     * Guild setting 'reward_mode: 1' will ignore rules with 'xp_class: 1'.
     * Users can only recreate rule. Modifying restricted. */
    db.prepare(`
        CREATE TABLE IF NOT EXISTS role_rewards (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT,
            xp_required TEXT,
            xp_class INTEGER,
            role_id TEXT
        )
    `).run();

    /* Guild Interaction Limits.
     * INTEGER values like 'migrate' stores Date.now() timestamp of last interaction 
     * to check if month is passed since last usage.
     * Here can be stored other limitation data in the future. */
    db.prepare(`
        CREATE TABLE IF NOT EXISTS guild_limits (
            guild_id TEXT PRIMARY KEY,
            migrate_1 INTEGER,
            migrage_2 INTEGER
        )
    `).run();

    // Check Database
    checkDB();

    console.log(`[Expify Database] Database Init Completed (${timeDiff(initTime)}ms).`);
};

// Initialize start
initializeDB();

module.exports = { db };