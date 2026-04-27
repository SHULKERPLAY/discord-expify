const { SlashCommandBuilder } = require('discord.js');
const { getLoc } = require('./functions.js');
const { setDefaultContext, setAvailable, setAdminOnly, setOwnerOnly, setModeratorOnly, setModeratorLite, addPublicReply, addConfirmationOption, addSimpleChoice, addXpTypeOption, addTextChannelOption } = require('./helpers.js');

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
        .setDescription('🚀 Want to install Expify app on your Server?')
        .setDescriptionLocalizations(getLoc('installapp', '🚀 '))   

    static expifycmd = new SlashCommandBuilder()
        .setName('expify')
        .setDescription('🛠️ Administrative Guild Actions')
        .setDescriptionLocalizations(getLoc('expifycmd', '🛠️ '))
        .addSubcommand(subcommand =>
            addConfirmationOption(
                subcommand
                    .setName('reset')
                    .setDescription('🗑️ Reset Bot settings for this Guild (Not XP reset)')
                    .setDescriptionLocalizations(getLoc('expifyreset', '🗑️ ')),
                2
            )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('get')
            .setDescription('🧩 Get your server settings data')
            .setDescriptionLocalizations(getLoc('expifyget', '🧩 '))
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
            .setDescription('🧪 Toggles available types of XP for your server')
            .setDescriptionLocalizations(getLoc('expifytoggle', '🧪 '))
            .addStringOption(addXpTypeOption('Select which type of XP you want to toggle', 'expifytogglesel', true))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('gain')
            .setDescription('💰 Change how many XP users get per minute')
            .setDescriptionLocalizations(getLoc('expifygain', '💰 '))
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
            .setDescription('⚙️ Set Channel for ... . Leave blank to disable')
            .setDescriptionLocalizations(getLoc('expifychannelfor', '⚙️ '))
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
            .setDescription('❗❗ RECOMENDED TO READ IF YOU WANT TO USE (/expify migrate)!')
            .setDescriptionLocalizations(getLoc('expifymigratehelpdesc', '❗❗ '))
        )
        .addSubcommand(subcommand =>
            addConfirmationOption(
                subcommand
                    .setName('migrate')
                    .setDescription('📤 Set XP according to existing rewards to all users (Read /expify migrate-help first)')
                    .setDescriptionLocalizations(getLoc('expifymigratedesc', '📤 ')),
                2
            )
        )
        .addSubcommand(subcommand =>
            addConfirmationOption(
                subcommand
                    .setName('xp-reset')
                    .setDescription('☢️ Reset XP for all members (DANGEROUS!)')
                    .setDescriptionLocalizations(getLoc('expifyxpreset', '☢️ ')),
                3
            )
        )
        .addSubcommand(subcommand =>
            addConfirmationOption(
                subcommand
                    .setName('cleanup-rewards')
                    .setDescription('🧹 Remove undeserved rewards from all users (Useful after big rewards updates or xp-reset)')
                    .setDescriptionLocalizations(getLoc('expifycleanupdesc', '🧹 ')),
                2
            )
        )

    static rewardcmd = new SlashCommandBuilder()
        .setName('reward')
        .setDescription('🏆 Manage Guild rewards')
        .setDescriptionLocalizations(getLoc('rewardscmd', '🏆 '))
        .addSubcommand(subcommand =>
            subcommand.setName('add')
            .setDescription('🏆 Add Reward for reaching one or multiple level conditions. Select assigned role reward to update')
            .setDescriptionLocalizations(getLoc('rewardsadd', '🏆 '))
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
            .setDescription('🗑️ Remove reward by ID (You can check ID with: /reward list)')
            .setDescriptionLocalizations(getLoc('rewardsremove', '🗑️ '))
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
            .setDescription('📜 Get all rewards list')
            .setDescriptionLocalizations(getLoc('rewardslist', '📜 '))
        )
        .addSubcommand(subcommand =>
            addConfirmationOption(
                subcommand
                    .setName('mode')
                    .setDescription('🔄 Change reward mode')
                    .setDescriptionLocalizations(getLoc('rewardmodedesc', '🔄 '))
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
                    ),
                2
            )
        )

    static xpcmd = new SlashCommandBuilder()
        .setName('xp')
        .setDescription('🔗 XP related operations')
        .setDescriptionLocalizations(getLoc('xprelated', '🔗 '))
        .addSubcommand(subcommand =>
            subcommand.setName('set-level')
            .setDescription('🎯 Set user Level')
            .setDescriptionLocalizations(getLoc('xpset', '🎯 '))
            .addUserOption(option =>
                option.setName('user')
                .setNameLocalizations(getLoc('arg.user'))
                .setDescription('Select user')
                .setDescriptionLocalizations(getLoc('selectuser'))
                .setRequired(true)
            )
            .addStringOption(addXpTypeOption('Select XP type to change', 'expifygaintype', true))
            .addIntegerOption(option =>
                option.setName('level')
                .setNameLocalizations(getLoc('arg.level'))
                .setDescription('Type integer')
                .setDescriptionLocalizations(getLoc('quantityinteger'))
                .setMinValue(0)
                .setMaxValue(1000)
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('add')
            .setDescription('✨ Add XP to user')
            .setDescriptionLocalizations(getLoc('xpadd', '✨ '))
            .addUserOption(option =>
                option.setName('user')
                .setNameLocalizations(getLoc('arg.user'))
                .setDescription('Select user')
                .setDescriptionLocalizations(getLoc('selectuser'))
                .setRequired(true)
            )
            .addStringOption(addXpTypeOption('Select XP type to change', 'expifygaintype', true))
            .addIntegerOption(option =>
                option.setName('xp')
                .setNameLocalizations(getLoc('arg.xp'))
                .setDescription('Type integer')
                .setDescriptionLocalizations(getLoc('quantityinteger'))
                .setMinValue(0)
                .setMaxValue(160280000)
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('remove')
            .setDescription('✘ Remove XP from user')
            .setDescriptionLocalizations(getLoc('xpremove', '✘ '))
            .addUserOption(option =>
                option.setName('user')
                .setNameLocalizations(getLoc('arg.user'))
                .setDescription('Select user')
                .setDescriptionLocalizations(getLoc('selectuser'))
                .setRequired(true)
            )
            .addStringOption(addXpTypeOption('Select XP type to change', 'expifygaintype', true))
            .addIntegerOption(option =>
                option.setName('xp')
                .setNameLocalizations(getLoc('arg.xp'))
                .setDescription('Type integer')
                .setDescriptionLocalizations(getLoc('quantityinteger'))
                .setMinValue(0)
                .setMaxValue(160280000)
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('reset')
            .setDescription('🗑️ Reset XP of user. Do not specify type to reset all types')
            .setDescriptionLocalizations(getLoc('xpreset', '🗑️ '))
            .addUserOption(option =>
                option.setName('user')
                .setNameLocalizations(getLoc('arg.user'))
                .setDescription('Select user')
                .setDescriptionLocalizations(getLoc('selectuser'))
                .setRequired(true)
            )
            .addStringOption(addXpTypeOption('Select XP type to change', 'expifygaintype', false))
        )
        .addSubcommand(subcommand =>
            subcommand.setName('calc')
            .setDescription('♾️ Calculate XP to Level or Level to XP')
            .setDescriptionLocalizations(getLoc('xpcalc', '♾️ '))
            .addStringOption(option =>
                option.setName('action')
                .setNameLocalizations(getLoc('arg.action'))
                .setDescription('Select Action')
                .setDescriptionLocalizations(getLoc('selectaction'))
                .setRequired(true)
                .addChoices(
                    addSimpleChoice('Calculate Level from XP', 'xp', 'xptolevel'), addSimpleChoice('Calculate XP from Level', 'lvl', 'xpfromlevel')
                )
            )
            .addIntegerOption(option =>
                option.setName('quantity')
                .setNameLocalizations(getLoc('arg.quantity'))
                .setDescription('Type integer')
                .setDescriptionLocalizations(getLoc('quantityinteger'))
                .setMinValue(0)
                .setMaxValue(160280000)
                .setRequired(true)
            )
        )

    static rankcmd = new SlashCommandBuilder()
        .setName('rank')
        .setDescription('📊 Check your or another user rank')
        .setDescriptionLocalizations(getLoc('rankcmd', '📊 '))
        .addUserOption(option =>
            option.setName('user')
            .setNameLocalizations(getLoc('arg.user'))
            .setDescription('Select user for display rank')
            .setDescriptionLocalizations(getLoc('rankuser'))
            .setRequired(false)
        )
        .addBooleanOption(addPublicReply())

    static topcmd = new SlashCommandBuilder()
        .setName('top')
        .setDescription('🥇 Display top XP Users')
        .setDescriptionLocalizations(getLoc('topcmd', '🥇 '))
        .addStringOption(addXpTypeOption('Select XP type', 'xptype', true))
        .addIntegerOption(option =>
            option.setName('page')
            .setNameLocalizations(getLoc('arg.page'))
            .setDescription('Select Page')
            .setDescriptionLocalizations(getLoc('selectpage'))
            .setMinValue(1)
            .setRequired(false)
        )
        .addBooleanOption(addPublicReply())

    static noxpcmd = new SlashCommandBuilder()
        .setName('noxp')
        .setDescription('⛔ Set Objects which needed to exclude from gaining XP')
        .setDescriptionLocalizations(getLoc('noxpcmd', '⛔ '))
        .addSubcommand(subcommand =>
            subcommand.setName('channel')
            .setDescription('⛔ Add NoXP channel. Select same for removing it from NoXP list')
            .setDescriptionLocalizations(getLoc('noxpchannel', '⛔ '))
            .addChannelOption(option =>
                option.setName('channel')
                .setNameLocalizations(getLoc('arg.channel'))
                .setDescription('Select channel')
                .setDescriptionLocalizations(getLoc('selectchannel'))
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('user')
            .setDescription('⛔ Add NoXP User. Select same for removing it from NoXP list')
            .setDescriptionLocalizations(getLoc('noxpuser', '⛔ '))
            .addUserOption(option =>
                option.setName('user')
                .setNameLocalizations(getLoc('arg.user'))
                .setDescription('Select user')
                .setDescriptionLocalizations(getLoc('selectuser'))
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('role')
            .setDescription('⛔ Add NoXP Role. Select same for removing it from NoXP list')
            .setDescriptionLocalizations(getLoc('noxprole', '⛔ '))
            .addRoleOption(option =>
                option.setName('role')
                .setNameLocalizations(getLoc('arg.role'))
                .setDescription('Select role')
                .setDescriptionLocalizations(getLoc('selectrole'))
                .setRequired(true)
            )
        )
        .addSubcommand(subcommand =>
            addConfirmationOption(
                subcommand
                    .setName('reset')
                    .setDescription('🗑️ Reset selected list of NoXP objects')
                    .setDescriptionLocalizations(getLoc('noxpreset', '🗑️ '))
                    .addStringOption(option =>
                        option.setName('type')
                        .setNameLocalizations(getLoc('arg.type'))
                        .setDescription('Select which list needed to reset')
                        .setDescriptionLocalizations(getLoc('noxpresetobj'))
                        .setRequired(true)
                        .addChoices(
                            addSimpleChoice('Channels', 'noxp_cid', 'channels'),
                            addSimpleChoice('Users', 'noxp_uid', 'users'),
                            addSimpleChoice('Roles', 'noxp_rid', 'roles'),
                            addSimpleChoice('All', 'all', 'all'),
                        )
                    ),
                1
            )
        )
        .addSubcommand(subcommand =>
            subcommand.setName('list')
            .setDescription('📝 Get noXP objects list')
            .setDescriptionLocalizations(getLoc('noxplist', '📝 '))
        )

    static langcmd = new SlashCommandBuilder()
        .setName('lang')
        .setDescription('🌎 Change language of automatic messages (leave blank to use language of your UI)')
        .setDescriptionLocalizations(getLoc('langcmd', '🌎 '))  
        .addStringOption(option =>
            option.setName('lang')
            .setNameLocalizations(getLoc('arg.lang'))
            .setDescription('Select Language')
            .setDescriptionLocalizations(getLoc('selectlanguage'))
            .setRequired(false)
            .addChoices(
                addSimpleChoice('🇷🇺 Русский', 'ru'),
                addSimpleChoice('🇺🇸 English', 'en-US'),
                addSimpleChoice('🇺🇦 Українська', 'uk'),
                addSimpleChoice('🇩🇪 Deutsch', 'de'),
                addSimpleChoice('🇫🇷 Français', 'fr'),
            )
        )

    // Set default interactions access rules
    static {
        setAvailable(this.ping);
        setAvailable(this.about);
        setAvailable(this.invite);
        setAvailable(this.rankcmd);
        setModeratorLite(this.topcmd);
        setModeratorOnly(this.langcmd);
        setModeratorOnly(this.rewardcmd);
        setModeratorOnly(this.xpcmd);
        setModeratorOnly(this.noxpcmd);
        setAdminOnly(this.expifycmd);

        //Set Context
        setDefaultContext(this.ping);
        setDefaultContext(this.about);
        setDefaultContext(this.invite);
        setDefaultContext(this.expifycmd);
        setDefaultContext(this.rankcmd);
        setDefaultContext(this.rewardcmd);
        setDefaultContext(this.xpcmd);
        setDefaultContext(this.topcmd);
        setDefaultContext(this.noxpcmd);
        setDefaultContext(this.langcmd);
    }
}; 

module.exports = { ExpifyBuiler };