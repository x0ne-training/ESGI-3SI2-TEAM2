const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignorer les messages du bot lui-même
        if (message.author.bot) return;

        const messageContent = message.content.toLowerCase().trim();

        // Utiliser une regex pour vérifier si le dernier mot finit par "quoi"
        if (/\b\w*quoi\b$/i.test(messageContent)) {
            try {
                await message.reply('FEUR');
                console.log(` ${message.author.tag} a dit "${message.content}" → Réponse: FEUR`);
            } catch (error) {
                console.error('Erreur lors de la réponse :', error);
            }
        }
    },
};