const { Events } = require("discord.js");
const fs = require("fs");
const path = require("path");

// FIX 1 : On utilise un chemin absolu pour être sûr que le bot trouve le fichier
const STATS_FILE = path.resolve(__dirname, "../stats.json");

// FIX 2 : Chargement initial sécurisé
let stats = {};
if (fs.existsSync(STATS_FILE)) {
    try {
        stats = JSON.parse(fs.readFileSync(STATS_FILE, "utf-8"));
    } catch (e) {
        console.error("Erreur lecture stats:", e);
    }
}

// FIX 3 : Sauvegarde automatique toutes les 60 secondes (Optimisation)
// (Cela évite d'écrire dans le fichier à chaque message)
setInterval(() => {
    try {
        fs.writeFileSync(STATS_FILE, JSON.stringify(stats, null, 2));
    } catch (e) {
        console.error("Erreur sauvegarde auto:", e);
    }
}, 60 * 1000);

module.exports = {
    name: Events.MessageCreate,
    async execute(message) {
        // Ignorer les bots
        if (message.author.bot) return;

        // --- PARTIE STATS (Ta tâche) ---
        const userId = message.author.id;
        // On met à jour la mémoire (c'est instantané)
        stats[userId] = (stats[userId] || 0) + 1;
        
        // Petit log pour vérifier dans ton terminal que ça compte bien
        console.log(`[Stats] ${message.author.tag} : ${stats[userId]} messages`);


        // --- PARTIE QUOI-FEUR (On ne touche pas, c'est ton code original) ---
        const messageContent = message.content.toLowerCase().trim();
        // C'est exactement le regex que tu avais dans ta capture d'écran
        if (/\bquoi\b$/i.test(messageContent)) { 
            try {
                await message.reply("FEUR !");
                console.log(`${message.author.tag} a dit "quoi" -> FEUR`);
            } catch (error) {
                console.error("Erreur réponse FEUR :", error);
            }
        }
    },
};