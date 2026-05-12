// This addon requires Dropbox and better-sqlite3 to be installed (npm i dropbox better-sqlite3)
// Creates a backup() of sqliteDB and verify integrity. 
// Then upload it to /BACKUP_DIR folder of app and clearing older than MAX_AGE_MS backups.
// REQUIRES Generated access token FROM dropbox.com/developers/apps AS argument (node this.js "token")

const Database = require('better-sqlite3');
const { Dropbox } = require('dropbox');
const fs = require('fs');
const path = require('path');

// Config
const DB_PATH = './expify.db';
const BACKUP_DIR = './backups';
const DROPBOX_TOKEN = process.argv[2];
const MAX_AGE_MS = 12 * 7 * 24 * 60 * 60 * 1000; // Delete all files from cloud directory older than ms
const MAX_RETRIES = 5; // Upload retries
const RETRY_DELAY = 60000; // Retry Pause (60s)
const logprefix = '[EXPIFY BACKUP]';

const dbx = new Dropbox({ accessToken: DROPBOX_TOKEN });

// Sleep func
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function runBackup() {
    const timestamp = Date.now();
    const backupFileName = `expify-${timestamp}.db`;
    const localPath = path.join(BACKUP_DIR, backupFileName);

    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

    try {
        console.log(`${logprefix} [${new Date().toISOString()}] Backup started...`);

        // Create Backup
        const db = new Database(DB_PATH);
        await db.backup(localPath);
        db.close();
        console.log(`${logprefix} Backup created`);

        // Integrity Check
        const checkDb = new Database(localPath);
        const check = checkDb.pragma('integrity_check');
        checkDb.close();
        if (check[0].integrity_check !== 'ok') throw new Error('Integrity check failed');
        console.log(`${logprefix} Integrity check completed`);

        // 3. ReadStr upload with retries
        await uploadWithRetry(localPath, backupFileName);

        // Clear old dropbox backups
        await cleanupDropbox('/backups');

        // Remove local backup
        fs.unlinkSync(localPath);
        console.log(`${logprefix} Temporary files cleared. Task complete`);

    } catch (error) {
        console.error(`${logprefix} CRITICAL ERROR WHILE BACKUP:`, error.message);
        if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
        process.exit(1);
    }
}

/** File upload with ReadStream and retries */
async function uploadWithRetry(localPath, fileName, attempt = 1) {
    try {
        console.log(`${logprefix} Uploading... Try (${attempt}/${MAX_RETRIES})`);
        
        // Create ReadStream
        const fileStream = fs.createReadStream(localPath);

        // In Dropbox SDK filesUpload accepts ReadableStream
        await dbx.filesUpload({
            path: `/backups/${fileName}`,
            contents: fileStream,
            mode: 'add'
        });

        console.log(`${logprefix} File successfully uploaded!`);
    } catch (error) {
        console.error(`${logprefix} ERROR on try ${attempt}:`, error.summary || error.message);

        if (attempt < MAX_RETRIES) {
            console.log(`${logprefix} Waiting ${RETRY_DELAY / 1000}s to retry...`);
            await sleep(RETRY_DELAY);
            return uploadWithRetry(localPath, fileName, attempt + 1);
        } else {
            throw new Error(`${logprefix} ERROR: BACKUP RETRIES LIMIT EXCEEDED`);
        }
    }
}

/** Remove files older than 12 weeks in Dropbox */
async function cleanupDropbox(folderPath) {
    try {
        const response = await dbx.filesListFolder({ path: folderPath });
        const now = Date.now();

        for (const entry of response.result.entries) {
            if (entry['.tag'] !== 'file') continue;

            const modifiedTime = new Date(entry.client_modified).getTime();
            if (now - modifiedTime > MAX_AGE_MS) {
                await dbx.filesDeleteV2({ path: entry.path_lower });
                console.log(`${logprefix} Removed old backup: ${entry.name}`);
            }
        }
    } catch (error) {
        console.error(`${logprefix} ERROR while clearing Dropbox:`, error.message);
    }
}

runBackup();