const axios = require('axios');
const nodemailer = require('nodemailer');
const webpush = require('web-push');
const db = require('../db');

// VAPID keys for direct Web Push notifications (PWA / Mobile / Desktop)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BL-sAx19qoVET4ZsIurUYn8geoHwYviyzND82afUDIZqBoWezte7H_NVG2ffBW-cUpMQktR2GLYA1FS66IHoeLI';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'tlE6zD_L4Hni1xvnmkI_wX1Cb0tLDPYsfQFkNBFps50';

webpush.setVapidDetails(
  'mailto:contact@betclic-ai.pro',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

/**
 * Get active notification settings from DB or process.env
 */
function getNotificationSettings() {
  let dbSettings = {};
  try {
    dbSettings = db.prepare('SELECT * FROM bankroll_settings WHERE id = 1').get() || {};
  } catch (_) {}

  return {
    ntfyTopic: process.env.NTFY_TOPIC || dbSettings.ntfy_topic || '',
    emailRecipient: process.env.EMAIL_RECIPIENT || dbSettings.email_recipient || '',
    smtpHost: process.env.SMTP_HOST || dbSettings.smtp_host || '',
    smtpPort: parseInt(process.env.SMTP_PORT || dbSettings.smtp_port || 587, 10),
    smtpUser: process.env.SMTP_USER || dbSettings.smtp_user || '',
    smtpPass: process.env.SMTP_PASS || dbSettings.smtp_pass || '',
    discordWebhook: process.env.DISCORD_WEBHOOK_URL || dbSettings.discord_webhook_url || '',
    telegramToken: process.env.TELEGRAM_BOT_TOKEN || dbSettings.telegram_bot_token || '',
    telegramChatId: process.env.TELEGRAM_CHAT_ID || dbSettings.telegram_chat_id || '',
    notifyValueBets: dbSettings.notify_value_bets !== 0,
    notifyCombineds: dbSettings.notify_combineds !== 0,
    notifyDroppingOdds: dbSettings.notify_dropping_odds !== 0,
    notifySettlements: dbSettings.notify_settlements !== 0,
    notifyLineups: dbSettings.notify_lineups !== 0,
  };
}

/**
 * Send Direct Web Push notification to all registered phones/devices
 */
async function sendWebPush(title, body, url = '/') {
  let subscriptions = [];
  try {
    subscriptions = db.prepare('SELECT * FROM push_subscriptions').all();
  } catch (err) {
    console.error('Error reading push subscriptions:', err.message);
  }

  if (!subscriptions || subscriptions.length === 0) {
    return { success: true, sent: 0, reason: 'Aucun appareil abonné au Web Push' };
  }

  const notificationPayload = JSON.stringify({
    title,
    body,
    url,
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    timestamp: Date.now()
  });

  let sent = 0;
  for (const sub of subscriptions) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        p256dh: sub.keys_p256dh,
        auth: sub.keys_auth
      }
    };

    try {
      await webpush.sendNotification(pushSubscription, notificationPayload);
      sent++;
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(sub.endpoint);
        console.log(`Cleaned up expired push subscription: ${sub.id}`);
      } else {
        console.error(`Web Push error on device #${sub.id}:`, err.message);
      }
    }
  }

  console.log(`📲 Web Push envoyé à ${sent}/${subscriptions.length} appareil(s) (Smartphone / PC)`);
  return { success: true, sent };
}

/**
 * Send instant mobile push notification via ntfy.sh (No account, no bot required)
 */
async function sendNtfy(topic, title, message, tags = 'soccer', priority = 'default') {
  if (!topic) return { success: false, reason: 'Topic ntfy non renseigné' };
  try {
    const cleanTopic = encodeURIComponent(topic.trim().replace(/^https?:\/\/ntfy\.sh\//, ''));
    await axios.post(`https://ntfy.sh/${cleanTopic}`, message, {
      headers: {
        'Title': title,
        'Priority': priority,
        'Tags': tags,
      },
      timeout: 8000
    });
    console.log(`🔔 Alerte ntfy.sh envoyée au topic : ${cleanTopic}`);
    return { success: true };
  } catch (err) {
    console.error('ntfy send error:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Send email via nodemailer
 */
async function sendEmail(subject, htmlText, plainText, customCfg = null) {
  const cfg = customCfg || getNotificationSettings();
  if (!cfg.emailRecipient || !cfg.smtpHost || !cfg.smtpUser || !cfg.smtpPass) {
    return { success: false, reason: 'Configuration Email/SMTP incomplète' };
  }

  try {
    const transporter = nodemailer.createTransport({
      host: cfg.smtpHost,
      port: cfg.smtpPort,
      secure: cfg.smtpPort === 465,
      auth: {
        user: cfg.smtpUser,
        pass: cfg.smtpPass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    await transporter.sendMail({
      from: `"Betclic AI Pro" <${cfg.smtpUser}>`,
      to: cfg.emailRecipient,
      subject: subject,
      text: plainText,
      html: htmlText,
    });

    console.log(`📧 Email envoyé à ${cfg.emailRecipient} : ${subject}`);
    return { success: true };
  } catch (err) {
    console.error('Email send error:', err.message);
    return { success: false, error: err.message };
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
 * Send message to Telegram (optional fallback)
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
 * Broadcast notification across all enabled channels (Web Push, ntfy.sh, Email, Discord)
 */
async function broadcast(textHtml, textPlain, subject = 'Alerte Betclic AI Pro', meta = {}) {
  const cfg = getNotificationSettings();
  const results = {};

  // 1. Direct Web Push on Mobile & PC (Native Browser Notification)
  results.webpush = await sendWebPush(subject, textPlain, meta.url || '/');

  // 2. ntfy.sh mobile app (Instant push without account/bot)
  if (cfg.ntfyTopic) {
    results.ntfy = await sendNtfy(cfg.ntfyTopic, subject, textPlain, meta.tags || 'soccer', meta.priority || 'high');
  }

  // 3. Email notifications
  if (cfg.emailRecipient && cfg.smtpHost && cfg.smtpUser) {
    results.email = await sendEmail(subject, textHtml.replace(/\n/g, '<br>'), textPlain);
  }

  // 4. Discord Webhook
  if (cfg.discordWebhook) {
    results.discord = await sendDiscord(cfg.discordWebhook, textPlain);
  }

  // 5. Telegram (optional fallback)
  if (cfg.telegramToken && cfg.telegramChatId) {
    results.telegram = await sendTelegram(cfg.telegramToken, cfg.telegramChatId, textHtml);
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

  return broadcast(html, plain, `🔥 Value Bet : ${match.home_team} vs ${match.away_team} (${valueBet.value_edge})`, { tags: 'gem,moneybag', priority: 'high' });
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

  return broadcast(html, plain, `⚡ Nouveau Combiné IA (${combined.strategy}) @ ${combined.total_odds}`, { tags: 'zap,dart', priority: 'default' });
}

/**
 * Send alert when a sharp odds drop occurs (Dropping Odds / Smart Money)
 */
async function sendDroppingOddsAlert(match, dropInfo) {
  const cfg = getNotificationSettings();
  if (!cfg.notifyDroppingOdds) return;

  const html = `📉 <b>ALERTE COTE EN FORTE CHUTE (SMART MONEY) !</b>\n\n`
    + `⚽ <b>${match.home_team} vs ${match.away_team}</b>\n`
    + `🏆 ${match.competition} (${match.match_date} à ${match.match_time || '—'})\n\n`
    + `🎯 <b>Sélection :</b> ${dropInfo.selection} (${dropInfo.type})\n`
    + `📉 <b>Chute :</b> <strike>${dropInfo.oldOdd.toFixed(2)}</strike> ➔ <b>${dropInfo.newOdd.toFixed(2)}</b> (<b>-${dropInfo.dropPct}%</b>)\n\n`
    + `⚠️ <i>Les gros volumes misés ou des infos de vestiaires de dernière minute font chuter cette cote.</i>\n\n`
    + `📲 <i>Consultez votre Betclic AI Dashboard.</i>`;

  const plain = `📉 COTE EN FORTE CHUTE (-${dropInfo.dropPct}%)\n`
    + `${match.home_team} vs ${match.away_team}\n`
    + `${dropInfo.selection} : ${dropInfo.oldOdd.toFixed(2)} ➔ ${dropInfo.newOdd.toFixed(2)}`;

  return broadcast(html, plain, `📉 Cote en chute (-${dropInfo.dropPct}%) : ${match.home_team} vs ${match.away_team}`, { tags: 'chart_with_downwards_trend,rotating_light', priority: 'high' });
}

/**
 * Send alert when a bet is automatically settled (Won / Lost)
 */
async function sendBetSettledAlert(bet, match, won, score) {
  const cfg = getNotificationSettings();
  if (!cfg.notifySettlements) return;

  const profitStr = won ? `+${bet.profit.toFixed(2)}€` : `${bet.profit.toFixed(2)}€`;
  const emoji = won ? '🎉' : '❌';
  const statusStr = won ? 'PARI GAGNÉ !' : 'PARI PERDU';

  const html = `${emoji} <b>RÈGLEMENT DE PARI : ${statusStr}</b>\n\n`
    + `⚽ <b>${bet.title}</b>\n`
    + `🏁 <b>Score Final :</b> <b>${score.home} - ${score.away}</b>\n`
    + `🎯 <b>Sélection :</b> ${bet.selection} @ <code>${bet.odds.toFixed(2)}</code>\n`
    + `💶 <b>Mise :</b> ${bet.stake.toFixed(2)}€ ➔ <b>Résultat net : ${profitStr}</b>\n\n`
    + `📊 <i>Votre Bankroll et vos statistiques de ROI ont été mis à jour automatiquement.</i>`;

  const plain = `${emoji} RÈGLEMENT DE PARI : ${statusStr}\n`
    + `${bet.title} (Score: ${score.home}-${score.away})\n`
    + `Sélection: ${bet.selection} @ ${bet.odds} | Résultat: ${profitStr}`;

  return broadcast(html, plain, `${emoji} Pari ${statusStr} : ${bet.title} (${profitStr})`, { tags: won ? 'tada,white_check_mark' : 'x', priority: 'default' });
}

/**
 * Send alert when official H-1 lineups are confirmed with star player impact
 */
async function sendLineupAlert(match, lineupData) {
  const cfg = getNotificationSettings();
  if (!cfg.notifyLineups) return;

  const html = `📋 <b>COMPOS OFFICIELLES H-1 CONFIRMÉES !</b>\n\n`
    + `⚽ <b>${match.home_team} vs ${match.away_team}</b>\n`
    + `🏆 ${match.competition} • Coup d'envoi dans moins d'une heure\n\n`
    + `⭐ <b>Impact Joueurs Clés :</b>\n${lineupData.notes || 'Les 11 titulaires officiels sont confirmés.'}\n\n`
    + `🎯 <b>Avis IA Réévalué :</b> ${lineupData.prediction || match.ai_prediction || 'Inchangé'}\n\n`
    + `📲 <i>Dernier moment pour placer votre pari avant le coup d'envoi.</i>`;

  const plain = `📋 COMPOS OFFICIELLES H-1 : ${match.home_team} vs ${match.away_team}\n`
    + `${lineupData.notes || 'Compositions officielles validées.'}\n`
    + `Confiance : ${lineupData.updated_confidence || '80%'}`;

  return broadcast(html, plain, `📋 Compos H-1 : ${match.home_team} vs ${match.away_team}`, { tags: 'clipboard,star', priority: 'high' });
}

/**
 * Test notification configuration
 */
async function testNotification(type = 'webpush', customConfig = null) {
  const cfg = customConfig || getNotificationSettings();

  if (type === 'webpush') {
    return sendWebPush(
      '🚀 Test Push Betclic AI',
      'Les notifications push directes sont configurées et actives sur votre appareil ! 🎉'
    );
  } else if (type === 'ntfy') {
    const topic = customConfig?.ntfyTopic || cfg.ntfyTopic || 'betclic-alerts';
    return sendNtfy(
      topic,
      '🚀 Test Mobile Betclic AI',
      'Vos alertes mobiles instantanées sont prêtes et fonctionnent sans aucun bot ! 🎉',
      'rocket,bell',
      'high'
    );
  } else if (type === 'email') {
    const testSubject = `🚀 Test Notification Betclic AI Pro`;
    const testHtml = `<h2>✅ Vos notifications par Email sont activées !</h2><p>Vous recevrez les alertes de <b>Value Bets</b>, <b>Cotes en chute</b> et <b>Paris réglés</b> directement sur votre smartphone.</p>`;
    const testPlain = `Vos notifications par Email Betclic AI sont activées avec succès !`;
    return sendEmail(testSubject, testHtml, testPlain, cfg);
  } else if (type === 'discord') {
    return sendDiscord(customConfig?.discordWebhook || cfg.discordWebhook, '🚀 TEST NOTIFICATION BETCLIC AI : Vos alertes Discord fonctionnent parfaitement !');
  } else if (type === 'telegram') {
    return sendTelegram(customConfig?.telegramToken || cfg.telegramToken, customConfig?.telegramChatId || cfg.telegramChatId, '🚀 <b>TEST NOTIFICATION BETCLIC AI</b> : Alertes Telegram actives.');
  }

  return { success: false, error: 'Type de notification inconnu' };
}

module.exports = {
  VAPID_PUBLIC_KEY,
  getNotificationSettings,
  sendWebPush,
  sendNtfy,
  sendEmail,
  sendDiscord,
  sendTelegram,
  broadcast,
  sendValueBetAlert,
  sendCombinedAlert,
  sendDroppingOddsAlert,
  sendBetSettledAlert,
  sendLineupAlert,
  testNotification,
};
