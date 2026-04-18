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

    static expifycmd = new SlashCommandBuilder()
        .setName('expify')
        .setDescription('🔗 Administrative Guild Actions')
        .setDescriptionLocalizations(getLoc('expifycmd', '🔗 '))
        .addSubcommand(subcommand =>
            subcommand.setName('reset')
            .setDescription('🔗 Reset Bot settings for this Guild (Not XP reset)')
            .setDescriptionLocalizations(getLoc('expifyreset', '🔗 '))
            .addStringOption(option =>
                option.setName('confirmation_1')
                .setNameLocalizations(getLoc('arg.confirmation_1'))
                .setDescription('Select YES if you want to perform this action')
                .setDescriptionLocalizations(getLoc('confirmationyes'))
                .setRequired(true)
                .addChoices(
                    {name: 'Yes', value: 'Yes', name_localizations:(getLoc('yes'))},
                    {name: 'No', value: 'No', name_localizations:(getLoc('no'))}
                )
            )
            .addStringOption(option =>
                option.setName('confirmation_2')
                .setNameLocalizations(getLoc('arg.confirmation_2'))
                .setDescription('Select YES if you want to perform this action')
                .setDescriptionLocalizations(getLoc('confirmationyes'))
                .setRequired(true)
                .addChoices(
                    {name: 'No', value: 'No', name_localizations:(getLoc('no'))},
                    {name: 'Yes', value: 'Yes', name_localizations:(getLoc('yes'))}
                )
            )
        )

    // Set default interactions access rules
    static {
        setAvailable(this.ping)
        setAdminsOnly(this.about)
        setAdminsOnly(this.invite)
        setAdminsOnly(this.expifycmd)
    }
}; 

module.exports = { ExpifyBuiler };