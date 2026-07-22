// interactions/feurPanelHandler.js
// Sous-panel "feur" du panel d'administration : liste/ajout/édition/suppression
// des règles, et configuration du cooldown. customId préfixés "admin:feur:".
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

const {
  getGuildConfig,
  updateGuildConfig,
  clampCooldown,
  MIN_COOLDOWN_MINUTES,
  MAX_COOLDOWN_MINUTES,
} = require('../services/guildConfig');

const MAX_RULES = 25; // borne par la limite d'options d'un select menu Discord

function hasMeaningfulContent(str) {
  return /[\p{L}\p{N}]/u.test(str || '');
}

function buildFeurPanel(guild) {
  const cfg = getGuildConfig(guild.id);

  const rulesList = cfg.feur.rules.length === 0
    ? '_Aucune règle configurée._'
    : cfg.feur.rules
        .map((r, i) => `**${i + 1}.** \`${r.trigger}\` → ${r.response}`)
        .join('\n')
        .slice(0, 4000);

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle('🎲 Configuration — Feur')
    .setDescription(
      `État : ${cfg.features.feur ? '🟢 Activé' : '🔴 Désactivé'} (bascule depuis le panel principal)\n` +
      `Cooldown par utilisateur : **${cfg.feur.cooldownMinutes} min**\n\n${rulesList}`,
    )
    .setFooter({ text: `${cfg.feur.rules.length}/${MAX_RULES} règle(s)` })
    .setTimestamp();

  const rowActions = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin:feur:add').setLabel('Ajouter').setEmoji('➕').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('admin:feur:edit:menu').setLabel('Modifier').setEmoji('✏️').setStyle(ButtonStyle.Secondary)
      .setDisabled(cfg.feur.rules.length === 0),
    new ButtonBuilder().setCustomId('admin:feur:delete:menu').setLabel('Supprimer').setEmoji('🗑️').setStyle(ButtonStyle.Danger)
      .setDisabled(cfg.feur.rules.length === 0),
    new ButtonBuilder().setCustomId('admin:feur:cooldown').setLabel('Cooldown').setEmoji('⏱️').setStyle(ButtonStyle.Secondary),
  );
  const rowBack = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin:home').setLabel('Retour').setEmoji('◀️').setStyle(ButtonStyle.Primary),
  );

  return { embeds: [embed], components: [rowActions, rowBack] };
}

function buildRuleSelectMenu(guild, customId, placeholder) {
  const cfg = getGuildConfig(guild.id);
  const menu = new StringSelectMenuBuilder()
    .setCustomId(customId)
    .setPlaceholder(placeholder)
    .addOptions(
      cfg.feur.rules.slice(0, MAX_RULES).map((r) => ({
        label: `${r.trigger}`.slice(0, 100),
        description: `→ ${r.response}`.slice(0, 100),
        value: r.id,
      })),
    );
  const rowBack = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('admin:feur:open').setLabel('Annuler').setStyle(ButtonStyle.Secondary),
  );
  return { embeds: [], components: [new ActionRowBuilder().addComponents(menu), rowBack] };
}

function buildRuleModal(customId, { title, trigger = '', response = '' }) {
  const modal = new ModalBuilder().setCustomId(customId).setTitle(title);

  const triggerInput = new TextInputBuilder()
    .setCustomId('trigger')
    .setLabel('Déclencheur (fin de message)')
    .setStyle(TextInputStyle.Short)
    .setMaxLength(100)
    .setRequired(true)
    .setValue(trigger);

  const responseInput = new TextInputBuilder()
    .setCustomId('response')
    .setLabel('Réponse du bot')
    .setStyle(TextInputStyle.Paragraph)
    .setMaxLength(500)
    .setRequired(true)
    .setValue(response);

  modal.addComponents(
    new ActionRowBuilder().addComponents(triggerInput),
    new ActionRowBuilder().addComponents(responseInput),
  );
  return modal;
}

function buildCooldownModal(currentValue) {
  const modal = new ModalBuilder().setCustomId('admin:feur:cooldown:submit').setTitle('Cooldown feur');
  const input = new TextInputBuilder()
    .setCustomId('cooldown')
    .setLabel(`Minutes entre deux réponses (${MIN_COOLDOWN_MINUTES}-${MAX_COOLDOWN_MINUTES})`)
    .setStyle(TextInputStyle.Short)
    .setMaxLength(5)
    .setRequired(true)
    .setValue(String(currentValue));
  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return modal;
}

async function route(interaction, parts) {
  const [action, sub, ruleId] = parts;

  if (interaction.isButton()) {
    if (action === 'open') {
      return interaction.update(buildFeurPanel(interaction.guild));
    }
    if (action === 'add') {
      const cfg = getGuildConfig(interaction.guildId);
      if (cfg.feur.rules.length >= MAX_RULES) {
        return interaction.reply({ content: `❌ Limite de ${MAX_RULES} règles atteinte.`, flags: MessageFlags.Ephemeral });
      }
      return interaction.showModal(buildRuleModal('admin:feur:add:submit', { title: 'Nouvelle règle feur' }));
    }
    if (action === 'edit' && sub === 'menu') {
      return interaction.update(buildRuleSelectMenu(interaction.guild, 'admin:feur:edit:select', 'Choisir une règle à modifier...'));
    }
    if (action === 'delete' && sub === 'menu') {
      return interaction.update(buildRuleSelectMenu(interaction.guild, 'admin:feur:delete:select', 'Choisir une règle à supprimer...'));
    }
    if (action === 'cooldown') {
      const cfg = getGuildConfig(interaction.guildId);
      return interaction.showModal(buildCooldownModal(cfg.feur.cooldownMinutes));
    }
  }

  if (interaction.isStringSelectMenu()) {
    const selectedId = interaction.values?.[0];
    const cfg = getGuildConfig(interaction.guildId);
    const rule = cfg.feur.rules.find((r) => r.id === selectedId);

    if (action === 'edit' && sub === 'select') {
      if (!rule) return interaction.update(buildFeurPanel(interaction.guild));
      return interaction.showModal(
        buildRuleModal(`admin:feur:edit:submit:${rule.id}`, { title: 'Modifier la règle', trigger: rule.trigger, response: rule.response }),
      );
    }

    if (action === 'delete' && sub === 'select') {
      if (rule) {
        updateGuildConfig(interaction.guildId, (c) => {
          c.feur.rules = c.feur.rules.filter((r) => r.id !== selectedId);
          return c;
        });
      }
      return interaction.update(buildFeurPanel(interaction.guild));
    }
  }

  if (interaction.isModalSubmit()) {
    if (action === 'add' && sub === 'submit') {
      const trigger = interaction.fields.getTextInputValue('trigger').trim();
      const response = interaction.fields.getTextInputValue('response').trim();

      const validationError = validateRuleInput(trigger, response);
      if (validationError) {
        return interaction.reply({ content: `❌ ${validationError}`, flags: MessageFlags.Ephemeral });
      }

      updateGuildConfig(interaction.guildId, (c) => {
        if (c.feur.rules.length >= MAX_RULES) return c;
        c.feur.rules.push({ id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, trigger, response });
        return c;
      });

      return interaction.update(buildFeurPanel(interaction.guild));
    }

    if (action === 'edit' && sub === 'submit') {
      const trigger = interaction.fields.getTextInputValue('trigger').trim();
      const response = interaction.fields.getTextInputValue('response').trim();

      const validationError = validateRuleInput(trigger, response);
      if (validationError) {
        return interaction.reply({ content: `❌ ${validationError}`, flags: MessageFlags.Ephemeral });
      }

      updateGuildConfig(interaction.guildId, (c) => {
        const target = c.feur.rules.find((r) => r.id === ruleId);
        if (target) {
          target.trigger = trigger;
          target.response = response;
        }
        return c;
      });

      return interaction.update(buildFeurPanel(interaction.guild));
    }

    if (action === 'cooldown' && sub === 'submit') {
      const raw = interaction.fields.getTextInputValue('cooldown').trim();
      const value = Number(raw);
      if (!Number.isFinite(value) || value < MIN_COOLDOWN_MINUTES || value > MAX_COOLDOWN_MINUTES) {
        return interaction.reply({
          content: `❌ Valeur invalide. Utilise un nombre entre ${MIN_COOLDOWN_MINUTES} et ${MAX_COOLDOWN_MINUTES}.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      updateGuildConfig(interaction.guildId, (c) => {
        c.feur.cooldownMinutes = clampCooldown(value);
        return c;
      });

      return interaction.update(buildFeurPanel(interaction.guild));
    }
  }

  // Fallback : réaffiche le sous-panel feur
  return interaction.isRepliable() ? interaction.update(buildFeurPanel(interaction.guild)) : null;
}

function validateRuleInput(trigger, response) {
  if (!trigger) return 'Le déclencheur est requis.';
  if (!response) return 'La réponse est requise.';
  if (!hasMeaningfulContent(trigger)) return 'Le déclencheur ne peut pas être composé uniquement de ponctuation.';
  if (trigger.length > 100) return 'Le déclencheur est trop long (100 caractères max).';
  if (response.length > 500) return 'La réponse est trop longue (500 caractères max).';
  return null;
}

module.exports = { route, buildFeurPanel };
