const { Events } = require('discord.js');

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignorer les messages du bot lui-même
        if (message.author.bot) return;

        // Vérifier si le message contient "quoi" (insensible à la casse)
        const messageContent = message.content.toLowerCase().trim();
        
        // Répondre "FEUR"
        if (messageContent === 'quoi' || messageContent.includes('quoi')) {
            try {
                await message.reply('FEUR');
                console.log(` ${message.author.tag} a dit "${message.content}" → Réponse: FEUR`);
            } catch (error) {
                console.error('Erreur lors de la réponse :', error);
            }
        }
    },
};