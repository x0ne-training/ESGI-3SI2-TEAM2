const { SlashCommandBuilder, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../../data/devoirs.json");

function readDevoirs() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
  } catch {
    return [];
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("mp-rappel-devoir")
    .setDescription("Planifie un rappel privé sur un devoir à une date et heure précises.")
    .addStringOption(o =>
      o
        .setName("devoir")
        .setDescription("Nom du devoir (filtré automatiquement)")
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addStringOption(o =>
      o
        .setName("date")
        .setDescription("Format AAAA-MM-JJ")
        .setRequired(true)
    )
    .addStringOption(o =>
      o
        .setName("heure")
        .setDescription("Format HH:mm")
        .setRequired(true)
    ),

  async execute(interaction) {
    const devoirId = Number(interaction.options.getString("devoir", true));
    const dateStr = interaction.options.getString("date", true);
    const heureStr = interaction.options.getString("heure", true);

    const d = readDevoirs().find(d => d.id === devoirId);
    if (!d) {
      return interaction.reply({
        content: "Aucun devoir trouvé.",
        flags: 64
      });
    }

    const target = new Date(`${dateStr}T${heureStr}:00`);
    if (isNaN(target.getTime())) {
      return interaction.reply({
        content: "Format de date/heure invalide.",
        flags: 64
      });
    }

    const now = Date.now();
    const when = target.getTime();

    if (when <= now) {
      return interaction.reply({
        content: "Le rappel doit être dans le futur.",
        flags: 64
      });
    }

    setTimeout(async () => {
      try {
        const dm = await interaction.user.createDM();
        await dm.send({
          embeds: [
            new EmbedBuilder()
              .setColor(0x3498db)
              .setTitle("🔔 Rappel")
              .setDescription(
                `Tu m'avais demandé de te rappeler ce devoir :\n\n📘 **${d.titre}**\n📅 ${d.date}\n📝 ${
                  d.description || "Aucune"
                }`
              )
              .setTimestamp()
          ]
        });
      } catch (err) {
        console.error("Impossible d'envoyer un DM :", err);
      }
    }, when - now);

    return interaction.reply({
      content: `Je te rappellerai **${d.titre}** le **${dateStr}** à **${heureStr}**.`,
      flags: 64
    });
  },

  // Autocomplete
  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const devoirs = readDevoirs();

    const list = devoirs
      .filter(d => d.titre.toLowerCase().includes(focused))
      .slice(0, 25)
      .map(d => ({
        name: `${d.titre} (${d.date})`,
        value: String(d.id)
      }));

    await interaction.respond(list);
  }
};
