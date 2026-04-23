const { getLoc } = require('./functions.js');
const { ChannelType, PermissionFlagsBits } = require('discord.js');

//Helpers
//.setDefaultMemberPermissions(0) restricts usage to admins only. 
//.setContexts(0, 1, 2) 0 - Can be used in server channels, 1 - Can be used in DM with app's bot user, 2 - Can be used in private channels without inviting the bot
//.setIntegrationTypes(0, 1) - 0 - Can be used with bot installed on server, 1 - can be used with bot installed as User App
const setDefaultContext = (builder) => builder.setIntegrationTypes(0).setContexts(0);
const setAvailable = (builder) => builder.setDefaultMemberPermissions(null);
const setOwnerOnly = (builder) => builder.setDefaultMemberPermissions(0);
const setAdminOnly = (builder) => builder.setDefaultMemberPermissions(PermissionFlagsBits.Administrator);
const setModeratorOnly = (builder) => builder.setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles);
const setModeratorLite = (builder) => builder.setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages);


//decide if reply be ephemeral (publicreply: false / true)
const addPublicReply = () => (option) => {
    option.setName('publicreply')
    .setNameLocalizations(getLoc('arg.public'))
    .setDescription('Make the result visible to everyone in the chat')
    .setDescriptionLocalizations(getLoc('publicreply'))
    .setRequired(false);
    return option;
};

/** Simplified code to create .addChoices objects
 * @param {string} name - Default Displayed name
 * @param {string} value - Coded value of choice
 * @param {string} localeskey - name_localizations parsed by 'key'
 * @param {string} localeprefix - Prefix added to Displayed name in all locales
 * @returns {object} Object{} of choice */
function addSimpleChoice(name, value, localeskey, localeprefix){
    return {name: name, value: value, name_localizations:(getLoc(localeskey, localeprefix))}
}

// XP Type option
const addXpTypeOption = (description = ' ', descriptionKey = ' ', isrequired = false) => (option) => {
    option.setName('type')
    .setNameLocalizations(getLoc('arg.type'))
    .setDescription(description)
    .setDescriptionLocalizations(getLoc(descriptionKey))
    .setRequired(isrequired)
    .addChoices(
        addSimpleChoice('Text XP', 'text_xp', 'textxp'),
        addSimpleChoice('Voice XP', 'voice_xp', 'voicexp'),
        addSimpleChoice('Video XP', 'video_xp', 'videoxp')
    )
    return option;
};

// Confirmation option
const addConfirmationOption = (builder, count = 1, description = 'Select YES if you want to perform this action', descriptionKey = 'confirmationyes', isrequired = true) => {
    if (count > 0) {
        builder.addStringOption(option =>
            option.setName('confirmation_1')
            .setNameLocalizations(getLoc('arg.confirmation_1'))
            .setDescription(`${description}`)
            .setDescriptionLocalizations(getLoc(`${descriptionKey}`))
            .setRequired(isrequired)
            .addChoices(
                addSimpleChoice('No', 'No', 'no'), addSimpleChoice('Yes', 'Yes', 'yes')
            )
        )
    };
    if (count > 1) {
        builder.addStringOption(option =>
            option.setName('confirmation_2')
            .setNameLocalizations(getLoc('arg.confirmation_2'))
            .setDescription(`${description}`)
            .setDescriptionLocalizations(getLoc(`${descriptionKey}`))
            .setRequired(isrequired)
            .addChoices(
                addSimpleChoice('Yes', 'Yes', 'yes'), addSimpleChoice('No', 'No', 'no')
            )
        )
    };
    if (count > 2) {
        builder.addStringOption(option =>
            option.setName('confirmation_3')
            .setNameLocalizations(getLoc('arg.confirmation_3'))
            .setDescription(`${description}`)
            .setDescriptionLocalizations(getLoc(`${descriptionKey}`))
            .setRequired(isrequired)
            .addChoices(
                addSimpleChoice('No', 'No', 'no'), addSimpleChoice('Yes', 'Yes', 'yes')
            )
        )
    };
    
    return builder;
};

// Text Channel Options
const addTextChannelOption = (description = ' ', descriptionKey = ' ', isrequired = false) => (option) => {
    option.setName('channel')
    .setNameLocalizations(getLoc('arg.channel'))
    .setDescription(description)
    .setDescriptionLocalizations(getLoc(descriptionKey))
    .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement, ChannelType.GuildForum)
    .setRequired(isrequired)

    return option;
};

//export
module.exports = { setDefaultContext, setAvailable, setAdminOnly, setOwnerOnly, setModeratorOnly, setModeratorLite, addPublicReply, addConfirmationOption, addSimpleChoice, addXpTypeOption, addTextChannelOption };