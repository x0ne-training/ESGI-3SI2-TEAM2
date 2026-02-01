// events/ready.js
const { Events } = require('discord.js');
const { scheduleReminders } = require('../commands/utility/ajouter-devoir.js');
const { startRemindersRunner } = require('../services/remindersRunner');
const { initDevoirBoard } = require('../services/devoir-board');

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`✅ Bot connecté en tant que ${client.user.tag}!`);
    console.log(`🚀 Bot actif sur ${client.guilds.cache.size} serveur(s)`);

    client.user.setActivity('3SIB Server', { type: 3 }); // WATCHING

    // Rebuild reminders depuis devoirs.json -> reminders.json
    scheduleReminders(client);

    // Runner persistant (salons + DM)
    startRemindersRunner(client, { intervalMs: 30_000 });

    initDevoirBoard(client);
  },
};
