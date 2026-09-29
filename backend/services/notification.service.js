const axios = require('axios');
const db = require('../db');

/**
 * Get active notification settings from DB or process.env
 */
function getNotificationSettings() {
  let dbSettings = {};
  try {
    dbSettings = db.prepare('SELECT * FROM bankroll_settings WHERE id = 1').get() || {};
  } catch (_) {}

  return {
    telegramToken: process.env.TELEGRAM_BOT_TOKEN || dbSettings.telegram_bot_token || '',
    telegramChatId: process.env.TELEGRAM_CHAT_ID || dbSettings.telegram_chat_id || '',
    discordWebhook: process.env.DISCORD_WEBHOOK_URL || dbSettings.discord_webhook_url || '',
    notifyValueBets: dbSettings.notify_value_bets !== 0,
    notifyCombineds: dbSettings.notify_combineds !== 0,
  };
}

/**
 * Send message to Telegram
 */
async function sendTelegram(token, chatId, text) {
  if (!token || !chatId) return { success: false, reason: 'Telegram non configuré' };
  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    await axios.post(url, {
      chat_id: chatId,
      text: text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }, { timeout: 8000 });
    return { success: true };
  } catch (err) {
    const msg = err.response?.data?.description || err.message;
    console.error('Telegram send error:', msg);
    return { success: false, error: msg };
  }
}

/**
 * Send message to Discord Webhook
 */
async function sendDiscord(webhookUrl, content, embeds = []) {
  if (!webhookUrl) return { success: false, reason: 'Discord webhook non configuré' };
  try {
    await axios.post(webhookUrl, {
      content: content,
      embeds: embeds,
    }, { timeout: 8000 });
    return { success: true };
  } catch (err) {
    console.error('Discord send error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Broadcast notification across all enabled channels
 */
async function broadcast(textHtml, textPlain, options = {}) {
  const cfg = getNotificationSettings();
  const results = {};

  if (cfg.telegramToken && cfg.telegramChatId) {
    results.telegram = await sendTelegram(cfg.telegramToken, cfg.telegramChatId, textHtml);
  }

  if (cfg.discordWebhook) {
    results.discord = await sendDiscord(cfg.discordWebhook, textPlain);
  }

  return results;
}

/**
 * Send alert for a detected Value Bet
 */
async function sendValueBetAlert(match, valueBet) {
  const cfg = getNotificationSettings();
  if (!cfg.notifyValueBets) return;

  const html = `🔥 <b>PÉPITE VALUE BET DÉTECTÉE !</b>\n\n`
    + `⚽ <b>${match.home_team} vs ${match.away_team}</b>\n`
    + `🏆 Compétition : ${match.competition}\n`
    + `📅 Date : ${match.match_date} à ${match.match_time || '—'}\n\n`
    + `💎 <b>Sélection :</b> ${valueBet.selection} (${valueBet.market})\n`
    + `📈 <b>Cote Betclic :</b> <code>${valueBet.bookmaker_odds}</code>\n`
    + `📊 <b>Probabilité réelle estimée :</b> ${valueBet.estimated_real_probability}\n`
    + `✨ <b>Avantage mathématique (Edge) :</b> <b>${valueBet.value_edge}</b>\n\n`
    + `💡 <i>${valueBet.rationale || 'Anomalie de cote détectée par l\'IA.'}</i>\n\n`
    + `📲 <i>Accédez à votre dashboard Betclic AI pour placer le pari.</i>`;

  const plain = `🔥 PÉPITE VALUE BET DÉTECTÉE !\n`
    + `${match.home_team} vs ${match.away_team} (${match.competition})\n`
    + `Sélection: ${valueBet.selection} @ ${valueBet.bookmaker_odds} | Edge: ${valueBet.value_edge}\n`
    + `${valueBet.rationale || ''}`;

  return broadcast(html, plain);
}

/**
 * Send alert for a newly generated Combined ticket
 */
async function sendCombinedAlert(combined) {
  const cfg = getNotificationSettings();
  if (!cfg.notifyCombineds) return;

  let selections = [];
  try {
    selections = JSON.parse(combined.selections || '[]');
  } catch (_) {}

  const selListHtml = selections.map(s => `• <b>${s.match}</b> : ${s.selection} @ <code>${s.odds}</code>`).join('\n');
  const selListPlain = selections.map(s => `• ${s.match} : ${s.selection} @ ${s.odds}`).join('\n');

  const html = `⚡ <b>NOUVEAU COMBINÉ IA DISPONIBLE !</b>\n\n`
    + `🎯 <b>${combined.name}</b> (${combined.strategy})\n`
    + `🏆 <b>Cote Totale :</b> <code>${combined.total_odds}</code>\n`
    + `💰 <b>Mise conseillée :</b> ${combined.stake || 10}€ ➔ Gain potentiel : <b>${combined.potential_gain || 0}€</b>\n\n`
    + `📋 <b>Sélections :</b>\n${selListHtml}\n\n`
    + `🧠 <i>${combined.ai_rationale || ''}</i>`;

  const plain = `⚡ NOUVEAU COMBINÉ IA (${combined.name})\n`
    + `Cote: ${combined.total_odds} | Gain pot: ${combined.potential_gain}€\n`
    + `${selListPlain}`;

  return broadcast(html, plain);
}

/**
 * Test notification configuration
 */
async function testNotification(type = 'telegram', customConfig = null) {
  const cfg = customConfig || getNotificationSettings();
  const testHtml = `🚀 <b>TEST NOTIFICATION BETCLIC AI</b>\n\n`
    + `✅ Vos alertes Telegram sont connectées avec succès !\n`
    + `Vous recevrez automatiquement les Value Bets et les meilleurs Combinés ici.`;

  const testPlain = `🚀 TEST NOTIFICATION BETCLIC AI : Vos alertes sont configurées avec succès !`;

  if (type === 'telegram') {
    return sendTelegram(cfg.telegramToken, cfg.telegramChatId, testHtml);
  } else if (type === 'discord') {
    return sendDiscord(cfg.discordWebhook, testPlain);
  }
  return { success: false, error: 'Type de notification inconnu' };
}

module.exports = {
  getNotificationSettings,
  sendTelegram,
  sendDiscord,
  broadcast,
  sendValueBetAlert,
  sendCombinedAlert,
  testNotification,
};
