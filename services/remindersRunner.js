// services/remindersRunner.js
const { EmbedBuilder } = require('discord.js');

const { getPendingDue, markSent, cleanupOldSent } = require('./remindersStore');
const { readConfig } = require('./devoirsService');
const { isFeatureEnabled } = require('./guildConfig');

const TYPE_LABELS = {
  devoir: 'Devoir',
  examen: 'Examen',
  projet: 'Projet',
};

const IMPORTANCE_LABELS = {
  faible: 'Peu important',
  important: 'Important',
  tres_important: 'Très important',
};

function getGuildConfig(config, guildId) {
  const g = config?.[guildId] || {};
  return {
    roleId: g.roleId || null,
    reminderChannelId: g.reminderChannelId || null,
  };
}

function buildMention(cfg) {
  return cfg.roleId ? `<@&${cfg.roleId}>` : '@everyone';
}

function buildAllowedMentions(cfg) {
  if (cfg.roleId) return { roles: [cfg.roleId], parse: [] };
  return { parse: ['everyone'] };
}

function getReminderColor(importance, kind) {
  const imp = importance || 'important';
  let color =
    imp === 'tres_important'
      ? 0xe74c3c
      : imp === 'faible'
      ? 0x95a5a6
      : 0xf39c12;

  if (kind === '7d' && imp !== 'tres_important') color = 0xf1c40f;
  return color;
}

function buildDescription(r) {
  const typeLabel = TYPE_LABELS[r.type] || 'Devoir';

  if (r.kind === '7d') {
    return `Le ${typeLabel.toLowerCase()} **${r.title}** est à rendre dans **7 jours** (le ${r.date}).`;
  }
  if (r.kind === '1d-morning' || r.kind === '1d-evening') {
    return `Le ${typeLabel.toLowerCase()} **${r.title}** est à rendre **demain** (${r.date}).`;
  }
  if (r.kind?.startsWith('custom-')) {
    return `Rappel pour le ${typeLabel.toLowerCase()} **${r.title}** (échéance le ${r.date}).`;
  }
  return `Rappel pour le ${typeLabel.toLowerCase()} **${r.title}** (échéance le ${r.date}).`;
}

/**
 * Option A:
 * - salon = cfg.reminderChannelId si défini
 * - sinon fallback = reminder.sourceChannelId
 * - sinon fallback compat = reminder.channelId (anciens reminders)
 */
function resolveTargetChannelId(cfg, reminder) {
  return cfg.reminderChannelId || reminder.sourceChannelId || reminder.channelId || null;
}

function buildDMEmbed(r) {
  const typeLabel = TYPE_LABELS[r.type] || 'Devoir';
  const impKey = r.importance || 'important';
  const impLabel = IMPORTANCE_LABELS[impKey] || 'Important';

  return new EmbedBuilder()
    .setColor(0x3498db)
    .setTitle(`🔔 Rappel (DM) — ${typeLabel}`)
    .setDescription(
      `Tu m’avais demandé un rappel pour :\n\n📘 **${r.title || 'Sans titre'}**\n📅 ${r.date || 'Non définie'}\n📝 ${r.description || 'Aucune'}`
    )
    .addFields({ name: '📍 Importance', value: impLabel, inline: true })
    .setTimestamp();
}

function startRemindersRunner(client, { intervalMs = 30_000 } = {}) {
  console.log(`⏱️ RemindersRunner démarré (interval ${intervalMs}ms)`);

  setInterval(() => {
    try {
      cleanupOldSent(30);
    } catch (e) {
      console.error('cleanupOldSent error:', e);
    }
  }, 6 * 60 * 60 * 1000);

  setInterval(async () => {
    try {
      const due = getPendingDue(Date.now());
      if (due.length === 0) return;

      const config = readConfig();

      for (const r of due) {
        // Rappels suspendus si le système de devoirs est désactivé pour cette guild
        // (ils restent "pending" et repartiront normalement une fois réactivé).
        if (r.guildId && !isFeatureEnabled(r.guildId, 'homework')) continue;

        // ✅ 1) Rappels en DM (persistants)
        if (r.delivery === 'dm') {
          try {
            if (!r.userId) {
              console.warn(`⚠️ Reminder DM sans userId (id=${r.id})`);
              markSent(r.id);
              continue;
            }

            const user = await client.users.fetch(r.userId).catch(() => null);
            if (!user) {
              console.warn(`⚠️ Utilisateur introuvable (${r.userId}) pour reminder DM ${r.id}`);
              markSent(r.id);
              continue;
            }

            await user.send({ embeds: [buildDMEmbed(r)] });
            console.log(`📩 Rappel DM (${r.kind}) envoyé à ${user.tag} pour ${r.title}`);
            markSent(r.id);
          } catch (e) {
            console.error("Erreur envoi DM:", e);
            // Pour éviter retry infini (et spam), on marque sent
            markSent(r.id);
          }
          continue;
        }

        // ✅ 2) Rappels en salon (comportement existant)
        const cfg = getGuildConfig(config, r.guildId);

        const targetChannelId = resolveTargetChannelId(cfg, r);
        if (!targetChannelId) {
          console.warn(`⚠️ Reminder sans salon cible (guild=${r.guildId}, id=${r.id})`);
          markSent(r.id);
          continue;
        }

        const channel = await client.channels.fetch(targetChannelId).catch(() => null);
        if (!channel) {
          console.warn(`⚠️ Salon introuvable (${targetChannelId}) pour reminder ${r.id}`);
          markSent(r.id);
          continue;
        }

        const typeLabel = TYPE_LABELS[r.type] || 'Devoir';
        const impKey = r.importance || 'important';
        const impLabel = IMPORTANCE_LABELS[impKey] || 'Important';

        const embed = new EmbedBuilder()
          .setColor(getReminderColor(impKey, r.kind))
          .setTitle(`📢 Rappel ${typeLabel}`)
          .setDescription(buildDescription(r))
          .addFields(
            { name: '📘 Titre', value: r.title || 'Sans titre' },
            { name: '📅 Date limite', value: r.date || 'Non définie' },
            { name: '📍 Importance', value: impLabel, inline: true },
            { name: '📝 Description', value: r.description || 'Aucune' }
          )
          .setTimestamp();

        const mention = buildMention(cfg);
        const allowedMentions = buildAllowedMentions(cfg);

        await channel.send({
          content: mention,
          embeds: [embed],
          allowedMentions,
        });

        console.log(`Rappel (${r.kind}) envoyé pour ${r.title} dans #${targetChannelId}`);
        markSent(r.id);
      }
    } catch (err) {
      console.error('RemindersRunner error:', err);
    }
  }, intervalMs);
}

module.exports = { startRemindersRunner };
