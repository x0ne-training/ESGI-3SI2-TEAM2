// interactions/homeworkPanelHandler.js
// Sous-panel "devoirs" du panel d'administration : affichage, ajout,
// suppression et gestion des timings personnalisés. Réutilise entièrement
// services/devoirsService.js (même logique que /ajouter-devoir) pour ne pas
// dupliquer la validation/planification des rappels. customId préfixés
// "admin:hw:".
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
} = require('discord.js');

const devoirsService = require('../services/devoirsService');

const { TYPE_LABELS, IMPORTANCE_LABELS } = devoirsService
const MAX_LIST = 25; // borne select menu Discord

function buildHomeworkPanel(guild) {
  const devoirs = devoirsService.listDevoirs({ guildId: guild.id });
  const boardCfg = devoirsService.getGuildConfig(guild.id);

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('📚 Configuration — Devoirs')
    .setDescription(
      `Éléments actifs : **${devoirs.length}**\n` +
      `Salon du tableau : ${boardCfg.boardChannelId ? `<#${boardCfg.boardChannelId}>` : 'non configuré (`/devoir-salon-liste`)'}\n` +
      `Salon des rappels : ${boardCfg.reminderChannelId ? `<#${boardCfg.reminderChannelId}>` : 'salon d\'origine de chaque devoir'}`,
    )
    .setTimestamp();

  const rowActions = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin:hw:list').setLabel('Afficher').setEmoji('📋').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin:hw:add').setLabel('Ajouter').setEmoji('➕').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('admin:hw:delete:menu').setLabel('Supprimer').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
      .setDisabled(devoirs.length === 0),
    new ButtonBuilder().setCustomId('admin:hw:timings:menu').setLabel('Timings').setEmoji('⏱️').setStyle(ButtonStyle.Secondary)
      .setDisabled(devoirs.length === 0),
  );
  const rowNav = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin:hw:refresh').setLabel('Actualiser le tableau').setEmoji('🔄').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('admin:home').setLabel('Retour').setEmoji('◀️').setStyle(ButtonStyle.Primary),
  );

  return { embeds: [embed], components: [rowActions, rowNav] };
}

function buildDevoirsListView(guild) {
  const devoirs = devoirsService.listDevoirs({ guildId: guild.id }).slice(0, 20);

  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle('📋 Devoirs / examens / projets')
    .setDescription(
      devoirs.length === 0
        ? '📭 Aucun élément pour le moment.'
        : devoirs
            .map((d, i) => {
              const typeLabel = TYPE_LABELS[d.type] || 'Devoir';
              const impLabel = IMPORTANCE_LABELS[d.importance] || 'Important';
              return `**${i + 1}. ${d.titre}** (${typeLabel}) — 📅 ${d.date} — 📍 ${impLabel}`;
            })
            .join('\n'),
    )
    .setTimestamp();

  const rowBack = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin:hw:open').setLabel('Retour').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [rowBack] };
}

function buildDevoirSelectMenu(guild, customId, placeholder) {
  const devoirs = devoirsService.listDevoirs({ guildId: guild.id }).slice(0, MAX_LIST);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .addOptions(
      devoirs.map((d) => ({
        label: `${d.titre}`.slice(0, 100),
        description: `${TYPE_LABELS[d.type] || 'Devoir'} — ${d.date}`.slice(0, 100),
        value: String(d.id),
      })),
    );
  const rowBack = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin:hw:open').setLabel('Annuler').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [], components: [new ActionRowBuilder().addComponents(menu), rowBack] };
}

function buildAddDevoirModal() {
  const modal = new ModalBuilder().setCustomId('admin:hw:add:submit').setTitle('Ajouter un devoir');

  const titre = new TextInputBuilder().setCustomId('titre').setLabel('Titre').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(true);
  const date = new TextInputBuilder().setCustomId('date').setLabel('Date limite (AAAA-MM-JJ)').setStyle(TextInputStyle.Short).setRequired(true);
  const type = new TextInputBuilder().setCustomId('type').setLabel('Type (devoir / examen / projet)').setStyle(TextInputStyle.Short).setValue('devoir').setRequired(true);
  const importance = new TextInputBuilder().setCustomId('importance').setLabel('Importance (faible/important/tres_important)').setStyle(TextInputStyle.Short).setValue('important').setRequired(false);
  const description = new TextInputBuilder().setCustomId('description').setLabel('Description').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(false);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titre),
    new ActionRowBuilder().addComponents(date),
    new ActionRowBuilder().addComponents(type),
    new ActionRowBuilder().addComponents(importance),
    new ActionRowBuilder().addComponents(description),
  );
  return modal;
}

function buildTimingsView(guild, devoirId) {
  const devoirs = devoirsService.readDevoirs();
  const devoir = devoirs.find((d) => d.id === devoirId);

  if (!devoir) {
    return { embeds: [new EmbedBuilder().setColor(0xe74c3c).setDescription('❌ Ce devoir n\'existe plus.')], components: [] };
  }

  const timings = Array.isArray(devoir.customTimings) ? devoir.customTimings : [];
  const embed = new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`⏱️ Timings — ${devoir.titre}`)
    .setDescription(
      timings.length === 0
        ? '_Aucun timing personnalisé pour ce devoir._'
        : timings.map((t, i) => `**${i + 1}.** ${t.label} (${devoirsService.formatDuration(t.offsetMs)} avant l'échéance)`).join('\n'),
    );

  const rowActions = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`admin:hw:timings:add:${devoirId}`).setLabel('Ajouter').setEmoji('➕').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`admin:hw:timings:remove:menu:${devoirId}`).setLabel('Supprimer').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
      .setDisabled(timings.length === 0),
    new ButtonBuilder().setCustomId('admin:hw:timings:menu').setLabel('Retour').setEmoji('◀️').setStyle(ButtonStyle.Secondary),
  );

  return { embeds: [embed], components: [rowActions] };
}

function buildTimingModal(devoirId) {
  const modal = new ModalBuilder().setCustomId(`admin:hw:timings:add:submit:${devoirId}`).setTitle('Ajouter un timing');
  const label = new TextInputBuilder().setCustomId('label').setLabel('Libellé (ex: "3 jours avant")').setStyle(TextInputStyle.Short).setMaxLength(50).setRequired(true);
  const delai = new TextInputBuilder().setCustomId('delai').setLabel('Délai avant échéance (ex: 3j, 12h, 45m)').setStyle(TextInputStyle.Short).setMaxLength(20).setRequired(true);
  modal.addComponents(new ActionRowBuilder().addComponents(label), new ActionRowBuilder().addComponents(delai));
  return modal;
}

function buildTimingRemoveMenu(guild, devoirId) {
  const devoirs = devoirsService.readDevoirs();
  const devoir = devoirs.find((d) => d.id === devoirId);
  const timings = devoir && Array.isArray(devoir.customTimings) ? devoir.customTimings : [];

  const menu = new StringSelectMenuBuilder()
    .setCustomId(`admin:hw:timings:remove:select:${devoirId}`)
    .setPlaceholder('Choisir un timing à supprimer...')
    .addOptions(
      timings.slice(0, MAX_LIST).map((t, i) => ({
        label: `${t.label}`.slice(0, 100),
        description: devoirsService.formatDuration(t.offsetMs),
        value: String(i),
      })),
    );
  const rowBack = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`admin:hw:timings:select:${devoirId}`).setLabel('Annuler').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [], components: [new ActionRowBuilder().addComponents(menu), rowBack] };
}

async function refreshBoard(interaction) {
  if (typeof interaction.client.forceDevoirBoardUpdate === 'function') {
    await interaction.client.forceDevoirBoardUpdate().catch(() => null);
  }
}

async function route(interaction, parts) {
  const [action, sub, subSub, maybeId] = parts;

  if (interaction.isButton()) {
    if (action === 'open') return interaction.update(buildHomeworkPanel(interaction.guild));
    if (action === 'list') return interaction.update(buildDevoirsListView(interaction.guild));

    if (action === 'add') {
      return interaction.showModal(buildAddDevoirModal());
    }

    if (action === 'delete' && sub === 'menu') {
      return interaction.update(buildDevoirSelectMenu(interaction.guild, 'admin:hw:delete:select', 'Choisir un devoir à supprimer...'));
    }

    if (action === 'timings' && sub === 'menu') {
      return interaction.update(buildDevoirSelectMenu(interaction.guild, 'admin:hw:timings:select', 'Choisir un devoir...'));
    }

    if (action === 'timings' && sub === 'select') {
      // customId: admin:hw:timings:select:<id> (bouton "Retour" depuis la vue timing)
      const devoirId = Number(subSub);
      return interaction.update(buildTimingsView(interaction.guild, devoirId));
    }

    if (action === 'timings' && sub === 'add') {
      const devoirId = Number(subSub);
      return interaction.showModal(buildTimingModal(devoirId));
    }

    if (action === 'timings' && sub === 'remove' && subSub === 'menu') {
      const devoirId = Number(maybeId);
      return interaction.update(buildTimingRemoveMenu(interaction.guild, devoirId));
    }

    if (action === 'refresh') {
      await refreshBoard(interaction);
      return interaction.update(buildHomeworkPanel(interaction.guild));
    }
  }

  if (interaction.isStringSelectMenu()) {
    const selectedValue = interaction.values?.[0];

    if (action === 'delete' && sub === 'select') {
      const id = Number(selectedValue);
      devoirsService.deleteDevoir(id);
      await refreshBoard(interaction);
      return interaction.update(buildHomeworkPanel(interaction.guild));
    }

    if (action === 'timings' && sub === 'select') {
      const devoirId = Number(selectedValue);
      return interaction.update(buildTimingsView(interaction.guild, devoirId));
    }

    if (action === 'timings' && sub === 'remove' && subSub === 'select') {
      const devoirId = Number(maybeId);
      const index = Number(selectedValue);
      devoirsService.removeCustomTiming(devoirId, index);
      await refreshBoard(interaction);
      return interaction.update(buildTimingsView(interaction.guild, devoirId));
    }
  }

  if (interaction.isModalSubmit()) {
    if (action === 'add' && sub === 'submit') {
      const titre = interaction.fields.getTextInputValue('titre');
      const date = interaction.fields.getTextInputValue('date');
      const type = interaction.fields.getTextInputValue('type').trim().toLowerCase();
      const importance = (interaction.fields.getTextInputValue('importance') || 'important').trim().toLowerCase();
      const description = interaction.fields.getTextInputValue('description') || '';

      const result = devoirsService.addDevoir({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        titre,
        date,
        description,
        type,
        importance,
        timingsStr: '',
      });

      if (!result.ok) {
        return interaction.reply({ content: `❌ ${result.error}`, flags: MessageFlags.Ephemeral });
      }

      await refreshBoard(interaction);
      return interaction.update(buildHomeworkPanel(interaction.guild));
    }

    if (action === 'timings' && sub === 'add' && subSub === 'submit') {
      const devoirId = Number(maybeId);
      const label = interaction.fields.getTextInputValue('label');
      const delai = interaction.fields.getTextInputValue('delai');

      const result = devoirsService.addCustomTiming(devoirId, label, delai);
      if (!result.ok) {
        return interaction.reply({ content: `❌ ${result.error}`, flags: MessageFlags.Ephemeral });
      }

      return interaction.update(buildTimingsView(interaction.guild, devoirId));
    }
  }

  return interaction.isRepliable() ? interaction.update(buildHomeworkPanel(interaction.guild)) : null;
}

module.exports = { route, buildHomeworkPanel };
