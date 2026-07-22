// events/ready.js
const { Events } = require('discord.js');
const devoirsService = require('../services/devoirsService');
const { startRemindersRunner } = require('../services/remindersRunner');
const { initDevoirBoard } = require('../services/devoir-board');
const { startRssRunner } = require('../services/rssRunner');
const { startRecurringEvents } = require('../services/recurringEvents');
const { startEventReminders } = require('../services/reminderSystem');
const { startCooldownCleanup } = require('../services/feurEngine');

let started = false;

module.exports = {
  name: Events.ClientReady,
  once: true,
  execute(client) {
    console.log(`✅ Bot connecté en tant que ${client.user.tag}!`);
    console.log(`🚀 Bot actif sur ${client.guilds.cache.size} serveur(s)`);

    client.user.setActivity('3SIB Server', { type: 3 }); // WATCHING

    // Le event Events.ClientReady peut théoriquement refeu (reconnect) selon les
    // versions de discord.js ; { once: true } le garantit déjà côté index.js,
    // mais on double-verrouille ici pour ne jamais démarrer deux fois les runners.
    if (started) return;
    started = true;

    // Rebuild reminders depuis devoirs.json -> reminders.json
    const { devoirsCount, createdCount } = devoirsService.rebuildAllReminders();
    console.log(`✅ Reminders JSON rebuild: ${createdCount} rappel(s) pending créé(s) pour ${devoirsCount} élément(s).`);

    // Runner persistant (salons + DM)
    startRemindersRunner(client, { intervalMs: 30_000 });

    initDevoirBoard(client);

    const rssIntervalMs = Number(process.env.RSS_INTERVAL_MS);
    startRssRunner(client, Number.isFinite(rssIntervalMs) && rssIntervalMs > 0 ? { intervalMs: rssIntervalMs } : undefined);

    startEventReminders(client);
    startRecurringEvents(client);

    startCooldownCleanup();
  },
};
