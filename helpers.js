const { getLoc } = require('./functions.js');

//Helpers
//.setDefaultMemberPermissions(0) restricts usage to admins only. 
//.setContexts(0, 1, 2) 0 - Can be used in server channels, 1 - Can be used in DM with app's bot user, 2 - Can be used in private channels without inviting the bot
//.setIntegrationTypes(0, 1) - 0 - Can be used with bot installed on server, 1 - can be used with bot installed as User App
const setAvailable = (builder) => builder.setIntegrationTypes(0).setContexts(0);
const setAdminsOnly = (builder) => builder.setIntegrationTypes(0).setContexts(0).setDefaultMemberPermissions(0);


//decide if reply be ephemeral (publicreply: false / true)
const addPublicReply = () => (option) => {
    option.setName('publicreply')
    .setDescription('Make the result visible to everyone in the chat')
    .setDescriptionLocalizations(getLoc('publicreply'))
    .setRequired(false);
    return option;
};

//export
module.exports = { setAvailable, setAdminsOnly, addPublicReply };