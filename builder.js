const { SlashCommandBuilder, ChannelType } = require('discord.js');
const { getLoc } = require('./functions.js');
const { setAvailable, setAdminsOnly, addPublicReply, addSimpleChoice, addXpTypeOption, addTextChannelOption } = require('./helpers.js');

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
                    addSimpleChoice('Yes', 'Yes', 'yes'), addSimpleChoice('No', 'No', 'no')
                )
            )
            .addStringOption(option =>
                option.setName('confirmation_2')
                .setNameLocalizations(getLoc('arg.confirmation_2'))
                .setDescription('Select YES if you want to perform this action')
                .setDescriptionLocalizations(getLoc('confirmationyes'))
                .setRequired(true)
                .addChoices(
                    addSimpleChoice('No', 'No', 'no'), addSimpleChoice('Yes', 'Yes', 'yes')
                )
            )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('get')
            .setDescription('🔗 Get your server settings data')
            .setDescriptionLocalizations(getLoc('expifyget', '🔗 '))
            .addStringOption(option =>
                option.setName('type')
                .setNameLocalizations(getLoc('arg.type'))
                .setDescription('Select which data to display')
                .setDescriptionLocalizations(getLoc('expifygettype'))
                .setRequired(true)
                .addChoices(
                    addSimpleChoice('XP Gaining', 'gain', 'xpgaining'),
                    addSimpleChoice('Channels', 'cid', 'channels'),
                    addSimpleChoice('NoXP entities', 'noxp', 'noxpentities'),
                    addSimpleChoice('Rewards', 'reward', 'rewards')
                )
            )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('toggle')
            .setDescription('🔗 Toggles available types of XP for your server')
            .setDescriptionLocalizations(getLoc('expifytoggle', '🔗 '))
            .addStringOption(addXpTypeOption('Select which type of XP you want to toggle', 'expifytogglesel', true))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('gain')
            .setDescription('🔗 Change how many XP users get per minute')
            .setDescriptionLocalizations(getLoc('expifygain', '🔗 '))
            .addStringOption(addXpTypeOption('Select XP type to change', 'expifygaintype', true))
            .addIntegerOption(option =>
                option.setName('quantity')
                .setNameLocalizations(getLoc('arg.quantity'))
                .setDescription('Type integer in range 5-100xp/min. Blank to default')
                .setDescriptionLocalizations(getLoc('expifygainquantity'))
                .setMinValue(5)
                .setMaxValue(100)
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('channels')
            .setDescription('🔗 Set Channel for ... . Leave blank to disable')
            .setDescriptionLocalizations(getLoc('expifychannelfor', '🔗 '))
            .addStringOption(option =>
                option.setName('type')
                .setNameLocalizations(getLoc('arg.type'))
                .setDescription('Select channel type to set or disable')
                .setDescriptionLocalizations(getLoc('expifychannelwhich'))
                .setRequired(true)
                .addChoices(
                    addSimpleChoice('Reward announcement', 'announce_cid', 'expifyannouncement'),
                    addSimpleChoice('Administrative warnings', 'admin_cid', 'expifywarnings'),
                    addSimpleChoice('Allow to public check rank only in specified channel', 'rank_cid', 'expifyrank')
                )
            )
            .addChannelOption(addTextChannelOption('Select channel', 'selectchannel', false))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('migrate-help')
            .setDescription('🔗 RECOMENDED TO READ IF YOU WANT TO USE (/expify migrate)!')
            .setDescriptionLocalizations(getLoc('expifymigratehelpdesc', '🔗 '))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('migrate')
            .setDescription('🔗 Set XP according to existing rewards to all users (Read /expify migrate-help first)')
            .setDescriptionLocalizations(getLoc('expifymigratedesc', '🔗 '))
            .addStringOption(option =>
                option.setName('confirmation_1')
                .setNameLocalizations(getLoc('arg.confirmation_1'))
                .setDescription('Select YES if you want to perform this action')
                .setDescriptionLocalizations(getLoc('confirmationyes'))
                .setRequired(true)
                .addChoices(
                    addSimpleChoice('Yes', 'Yes', 'yes'), addSimpleChoice('No', 'No', 'no')
                )
            )
            .addStringOption(option =>
                option.setName('confirmation_2')
                .setNameLocalizations(getLoc('arg.confirmation_2'))
                .setDescription('Select YES if you want to perform this action')
                .setDescriptionLocalizations(getLoc('confirmationyes'))
                .setRequired(true)
                .addChoices(
                    addSimpleChoice('No', 'No', 'no'), addSimpleChoice('Yes', 'Yes', 'yes')
                )
            )
        )

    static rewardcmd = new SlashCommandBuilder()
        .setName('reward')
        .setDescription('🔗 Manage Guild rewards')
        .setDescriptionLocalizations(getLoc('rewardscmd', '🔗 '))
        .addSubcommand(subcommand =>
            subcommand.setName('add')
            .setDescription('🔗 Add Reward for reaching one or multiple level conditions. Select assigned role reward to update')
            .setDescriptionLocalizations(getLoc('rewardsadd', '🔗 '))
            .addRoleOption(option =>
                option.setName('role')
                .setNameLocalizations(getLoc('arg.role'))
                .setDescription('Select role which will be assigned as reward')
                .setDescriptionLocalizations(getLoc('rewardsaddrole'))
                .setRequired(true)
            )
            .addIntegerOption(option =>
                option.setName('text_level')
                .setNameLocalizations(getLoc('arg.text_level'))
                .setDescription('Type required level for your reward')
                .setDescriptionLocalizations(getLoc('rewardstypelevel'))
                .setMinValue(1)
                .setMaxValue(1000)
                .setRequired(false)
            )
            .addIntegerOption(option =>
                option.setName('voice_level')
                .setNameLocalizations(getLoc('arg.voice_level'))
                .setDescription('Type required level for your reward')
                .setDescriptionLocalizations(getLoc('rewardstypelevel'))
                .setMinValue(1)
                .setMaxValue(1000)
                .setRequired(false)
            )
            .addIntegerOption(option =>
                option.setName('video_level')
                .setNameLocalizations(getLoc('arg.video_level'))
                .setDescription('Type required level for your reward')
                .setDescriptionLocalizations(getLoc('rewardstypelevel'))
                .setMinValue(1)
                .setMaxValue(1000)
                .setRequired(false)
            )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('remove')
            .setDescription('🔗 Remove reward by ID (You can check ID with: /reward list)')
            .setDescriptionLocalizations(getLoc('rewardsremove', '🔗 '))
            .addIntegerOption(option =>
                option.setName('id')
                .setDescription('Type reward ID')
                .setDescriptionLocalizations(getLoc('rewardsremoveid'))
                .setMinValue(1)
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('list')
            .setDescription('🔗 Get all rewards list')
            .setDescriptionLocalizations(getLoc('rewardslist', '🔗 '))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('mode')
            .setDescription('🔗 Change reward mode')
            .setDescriptionLocalizations(getLoc('rewardmodedesc', '🔗 '))
            .addStringOption(option =>
                option.setName('type')
                .setNameLocalizations(getLoc('arg.type'))
                .setDescription('Select reward mode')
                .setDescriptionLocalizations(getLoc('rewardmodedesc'))
                .setRequired(true)
                .addChoices(
                    addSimpleChoice('Save all rewards (Default)', 'all', 'rewardmodeall'),
                    addSimpleChoice('Save rewards for multiple xp types and only top rewards for single xp type', 'top', 'rewardmodetoponly')
                )
            )
            .addStringOption(option =>
                option.setName('confirmation')
                .setNameLocalizations(getLoc('arg.confirmation_1'))
                .setDescription('Select YES if you want to perform this action')
                .setDescriptionLocalizations(getLoc('confirmationyes'))
                .setRequired(true)
                .addChoices(
                    addSimpleChoice('No', 'No', 'no'), addSimpleChoice('Yes', 'Yes', 'yes')
                )
            )
        )


    static rankcmd = new SlashCommandBuilder()
        .setName('rank')
        .setDescription('🔗 Check your or another user rank')
        .setDescriptionLocalizations(getLoc('rankcmd', '🔗 '))
        .addUserOption(option =>
            option.setName('user')
            .setNameLocalizations(getLoc('arg.user'))
            .setDescription('Выберите пользователя, ранг которого вы хотите узнать')
            .setDescriptionLocalizations(getLoc('rankuser'))
            .setRequired(false)
        )
        .addBooleanOption(addPublicReply())
    
    // Set default interactions access rules
    static {
        setAvailable(this.ping)
        setAdminsOnly(this.about)
        setAdminsOnly(this.invite)
        setAdminsOnly(this.expifycmd)
        setAdminsOnly(this.rankcmd)
        setAdminsOnly(this.rewardcmd)
    }
}; 

module.exports = { ExpifyBuiler };