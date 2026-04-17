const { SlashCommandBuilder } = require('discord.js');
const { getLoc } = require('./functions.js');
const { setAvailable, setAdminsOnly, addPublicReply } = require('./helpers.js');

// Slash interactions builder
class ExpifyBuiler {
    static ping = new SlashCommandBuilder()
        .setName('ping')
        .setDescription('🏓 Check Application response time')
        .setDescriptionLocalizations(getLoc('checkping', '🏓 '))

    static about = new SlashCommandBuilder()
        .setName('about')
        .setDescription('📙 About this app')
        .setDescriptionLocalizations(getLoc('aboutapp', '📙 '))

    static invite = new SlashCommandBuilder()
        .setName('invite')
        .setDescription('🔗 Want to install Expify app on your Server?')
        .setDescriptionLocalizations(getLoc('installapp', '🔗 '))   

    // Set default interactions access rules
    static {
        setAvailable(this.ping)
        setAdminsOnly(this.about)
        setAdminsOnly(this.invite)
    }
}; 

module.exports = { ExpifyBuiler };