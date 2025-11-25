const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
} = require("discord.js");
const fs = require("fs");
const path = require("path");

const DATA_FILE = path.join(__dirname, "../../data/devoirs.json");

// Lecture / écriture des devoirs
function readDevoirs() {
  if (!fs.existsSync(DATA_FILE)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.error("Erreur lecture devoirs.json :", e);
    return [];
  }
}

function writeDevoirs(list) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(list, null, 2), "utf-8");
  } catch (e) {
    console.error("Erreur écriture devoirs.json :", e);
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ajouter-devoir")
    .setDescription("Ajoute un devoir avec une date limite.")
    .addStringOption((option) =>
      option
        .setName("titre")
        .setDescription("Titre du devoir")
        .setRequired(true)
        .setMaxLength(100)
    )
    .addStringOption((option) =>
      option
        .setName("date")
        .setDescription("Date limite (format AAAA-MM-JJ)")
        .setRequired(true)
    )
    .addStringOption((option) =>
      option
        .setName("description")
        .setDescription("Description du devoir")
        .setRequired(false)
        .setMaxLength(1000)
    ),
  emoji: "🧾",

  async execute(interaction) {
    const titre = interaction.options.getString("titre", true);
    const dateStr = interaction.options.getString("date", true);
    const description = interaction.options.getString("description") || "";

    // Vérification de la date
    const deadline = new Date(dateStr);
    if (isNaN(deadline.getTime())) {
      return interaction.reply({
        content:
          "❌ Format de date invalide. Utilise le format **AAAA-MM-JJ**.",
        ephemeral: true,
      });
    }

    // Sauvegarde du devoir
    const devoirs = readDevoirs();
    const newDevoir = {
      id: Date.now(),
      titre,
      date: dateStr,
      description,
    };
    devoirs.push(newDevoir);
    writeDevoirs(devoirs);

    // Confirmation
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle("✅ Devoir ajouté")
      .addFields(
        { name: "📘 Titre", value: titre },
        { name: "📅 Date limite", value: dateStr },
        { name: "📝 Description", value: description || "Aucune" }
      )
      .setFooter({
        text: "Bot Discord 3SIB",
        iconURL: interaction.client.user.displayAvatarURL(),
      })
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: 64 });
  },
};
