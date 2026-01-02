// events/ready.js
const { Events } = require('discord.js');
const ReminderSystem = require('../services/reminderSystem');
const RecurringEventsManager = require('../services/recurringEvents');
const { scheduleReminders } = require('../commands/utility/ajouter-devoir.js');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`✅ Bot connecté en tant que ${client.user.tag}!`);
    console.log(`🚀 Bot actif sur ${client.guilds.cache.size} serveur(s)`);

    client.user.setActivity('3SIB Server', { type: 3 }); // WATCHING

    // Init systèmes
    client.reminderSystem = new ReminderSystem(client);
    client.recurringEventsManager = new RecurringEventsManager(client);

    // Relance des rappels persistés
    scheduleReminders(client);
  },
};
