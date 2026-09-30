/* ================================================================
   SETTINGS & MULTI-CHANNEL MOBILE NOTIFICATIONS (NO BOT REQUIRED)
   ================================================================ */

let appSettings = {
  initial_bankroll: 1000,
  current_bankroll: 1000,
  currency: '€',
  kelly_fraction: 0.25,
  ntfy_topic: 'betclic-micha-alertes',
  email_recipient: '',
  smtp_host: '',
  smtp_port: 587,
  smtp_user: '',
  smtp_pass: '',
  discord_webhook_url: '',
  telegram_bot_token: '',
  telegram_chat_id: '',
  notify_value_bets: 1,
  notify_combineds: 1,
  notify_dropping_odds: 1,
  notify_settlements: 1,
  notify_lineups: 1
};

let isPushSubscribed = false;

async function loadSettings() {
  try {
    const res = await fetch(`${API}/bankroll`);
    const data = await res.json();
    if (data.success && data.data.settings) {
      appSettings = { ...appSettings, ...data.data.settings };
      await checkPushSubscriptionStatus();
      renderSettingsPage();
    }
  } catch (err) {
    console.error('loadSettings error:', err);
  }
}

async function checkPushSubscriptionStatus() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    isPushSubscribed = false;
    return;
  }
  try {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (reg) {
      const sub = await reg.pushManager.getSubscription();
      isPushSubscribed = !!sub;
    }
  } catch (_) {
    isPushSubscribed = false;
  }
}

function renderSettingsPage() {
  const container = document.getElementById('settings-page');
  if (!container) return;

  container.innerHTML = `
    <div class="settings-container">
      
      <div class="settings-header">
        <h2>⚙️ Paramètres & Alertes Smartphone</h2>
        <p>Recevez vos alertes de cotes en chute, compositions officielles et règlements de paris directement sur votre smartphone (sans bot Telegram).</p>
      </div>

      <!-- Bankroll Settings Form -->
      <div class="settings-card">
        <div class="settings-card-title">
          <span class="sc-icon">💰</span>
          <h3>Gestion de Capital & Bankroll</h3>
        </div>
        <p class="sc-desc">Définissez votre capital de départ et la rigueur de vos mises automatiques.</p>

        <form onsubmit="saveBankrollSettings(event)" class="settings-form">
          <div class="form-row">
            <div class="form-group flex-2">
              <label>Capital Initial (Bankroll de départ) *</label>
              <input type="number" step="10" min="10" id="set-initial-bankroll" class="modal-input" value="${appSettings.initial_bankroll || 1000}" required />
            </div>
            <div class="form-group flex-1">
              <label>Devise</label>
              <select id="set-currency" class="modal-input">
                <option value="€" ${appSettings.currency === '€' ? 'selected' : ''}>EUR (€)</option>
                <option value="$" ${appSettings.currency === '$' ? 'selected' : ''}>USD ($)</option>
                <option value="£" ${appSettings.currency === '£' ? 'selected' : ''}>GBP (£)</option>
                <option value="CHF" ${appSettings.currency === 'CHF' ? 'selected' : ''}>CHF</option>
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Fraction du Critère de Kelly (Gestion du Risque)</label>
            <select id="set-kelly-fraction" class="modal-input">
              <option value="0.25" ${appSettings.kelly_fraction == 0.25 ? 'selected' : ''}>1/4 Kelly (Prudent & Recommandé pour le Foot)</option>
              <option value="0.5" ${appSettings.kelly_fraction == 0.5 ? 'selected' : ''}>1/2 Kelly (Modéré / Agressif)</option>
              <option value="1.0" ${appSettings.kelly_fraction == 1.0 ? 'selected' : ''}>Plein Kelly (Risque Élevé)</option>
            </select>
            <span class="form-hint">Le critère de Kelly calcule la mise mathématiquement optimale selon la valeur (EV+) détectée.</span>
          </div>

          <button type="submit" class="btn btn-save-settings">
            <span>💾</span>
            <span>Enregistrer la Bankroll</span>
          </button>
        </form>
      </div>

      <!-- Smartphone Push Notifications (NO BOT REQUIRED) -->
      <div class="settings-card highlight-card">
        <div class="settings-card-title">
          <span class="sc-icon">📲</span>
          <h3>1. Notifications Push Directes sur ce Téléphone (1 Clic)</h3>
        </div>
        <p class="sc-desc">
          Le moyen le plus simple et sans aucun compte : activez les notifications directement dans votre navigateur. Vous recevrez une alerte native sur votre écran même lorsque le site est fermé !
        </p>

        <div class="push-activation-box">
          <div class="push-status-indicator">
            <span class="status-dot ${isPushSubscribed ? 'online' : 'offline'}"></span>
            <span class="status-text">${isPushSubscribed ? '✅ Notifications Push ACTIVES sur cet appareil' : '⚪ Notifications Push NON activées sur cet appareil'}</span>
          </div>

          <div class="push-buttons-row">
            <button type="button" class="btn btn-primary-gradient" onclick="subscribeDeviceToWebPush()">
              <span>🔔</span>
              <span>${isPushSubscribed ? 'Réactiver / Synchroniser ce téléphone' : 'Activer les notifications sur ce téléphone'}</span>
            </button>
            <button type="button" class="btn btn-test-channel" onclick="testNotificationChannel('webpush')">
              <span>🧪</span>
              <span>Tester la notification push</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ntfy.sh Instant Mobile Push (NO ACCOUNT / NO BOT) -->
      <div class="settings-card">
        <div class="settings-card-title">
          <span class="sc-icon">🔔</span>
          <h3>2. Alertes sur Application Mobile Dédiée (ntfy.sh)</h3>
        </div>
        <p class="sc-desc">
          Téléchargez l'application gratuite <strong>ntfy</strong> (disponible sur <a href="https://apps.apple.com/app/ntfy/id1625396347" target="_blank" style="color: var(--accent-blue); text-decoration: underline;">iPhone (App Store)</a> et <a href="https://play.google.com/store/apps/details?id=io.heckel.ntfy" target="_blank" style="color: var(--accent-blue); text-decoration: underline;">Android (Google Play)</a>). Entrez simplement votre nom de canal privé pour recevoir les alertes instantanées avec son et vibration !
        </p>

        <form onsubmit="saveNotificationSettings(event)" class="settings-form">
          <div class="form-group">
            <label>Nom de votre canal privé ntfy *</label>
            <div class="ntfy-input-group">
              <span class="ntfy-prefix">ntfy.sh/</span>
              <input type="text" id="set-ntfy-topic" class="modal-input" placeholder="betclic-micha-alertes" value="${appSettings.ntfy_topic || 'betclic-micha-alertes'}" required />
            </div>
            <span class="form-hint">Dans l'application ntfy sur votre téléphone, cliquez sur ➕ et abonnez-vous à ce même nom de canal.</span>
          </div>

          <button type="button" class="btn btn-test-channel" onclick="testNotificationChannel('ntfy')">
            <span>🚀</span>
            <span>Tester l'envoi vers mon application mobile ntfy</span>
          </button>
        </form>
      </div>

      <!-- Email Notifications -->
      <div class="settings-card">
        <div class="settings-card-title">
          <span class="sc-icon">📧</span>
          <h3>3. Alertes par Email (Push Mail sur Smartphone)</h3>
        </div>
        <p class="sc-desc">Recevez un résumé complet par email pour chaque cote en chute ou pari soldé.</p>

        <form onsubmit="saveNotificationSettings(event)" class="settings-form">
          <div class="form-group">
            <label>Votre Adresse Email de Réception</label>
            <input type="email" id="set-email-recipient" class="modal-input" placeholder="mon-adresse@gmail.com" value="${appSettings.email_recipient || ''}" />
            <span class="form-hint">Vous recevrez les notifications push de votre messagerie directement sur votre smartphone.</span>
          </div>

          <div class="form-row">
            <div class="form-group flex-2">
              <label>Serveur SMTP</label>
              <input type="text" id="set-smtp-host" class="modal-input" placeholder="smtp.gmail.com" value="${appSettings.smtp_host || ''}" />
            </div>
            <div class="form-group flex-1">
              <label>Port SMTP</label>
              <input type="number" id="set-smtp-port" class="modal-input" placeholder="587" value="${appSettings.smtp_port || 587}" />
            </div>
          </div>

          <div class="form-row">
            <div class="form-group flex-1">
              <label>Utilisateur SMTP</label>
              <input type="text" id="set-smtp-user" class="modal-input" placeholder="mon-compte@gmail.com" value="${appSettings.smtp_user || ''}" />
            </div>
            <div class="form-group flex-1">
              <label>Mot de passe SMTP / App Password</label>
              <input type="password" id="set-smtp-pass" class="modal-input" placeholder="••••••••••••" value="${appSettings.smtp_pass || ''}" />
            </div>
          </div>

          <button type="button" class="btn btn-test-channel" onclick="testNotificationChannel('email')">
            <span>📧</span>
            <span>Tester l'envoi d'Email</span>
          </button>
        </form>
      </div>

      <!-- Event Toggles & Preferences -->
      <div class="settings-card">
        <div class="settings-card-title">
          <span class="sc-icon">🔔</span>
          <h3>Événements & Détecteurs à Notifier</h3>
        </div>
        <p class="sc-desc">Choisissez les types d'alertes à envoyer automatiquement sur votre téléphone 24h/24.</p>

        <form onsubmit="saveNotificationSettings(event)" class="settings-form">
          <div class="toggles-section">
            <label class="setting-toggle-item">
              <input type="checkbox" id="set-notify-drop" ${appSettings.notify_dropping_odds !== 0 ? 'checked' : ''} />
              <span class="toggle-custom"></span>
              <span class="toggle-label">📉 Détecteur de <strong>Cotes en Chute / Smart Money</strong> (alerte baisse soudaine &gt;= 7%)</span>
            </label>

            <label class="setting-toggle-item">
              <input type="checkbox" id="set-notify-settle" ${appSettings.notify_settlements !== 0 ? 'checked' : ''} />
              <span class="toggle-custom"></span>
              <span class="toggle-label">⚡ Résolution automatique : Alerte quand un <strong>pari est soldé (Gagné / Perdu)</strong></span>
            </label>

            <label class="setting-toggle-item">
              <input type="checkbox" id="set-notify-lineup" ${appSettings.notify_lineups !== 0 ? 'checked' : ''} />
              <span class="toggle-custom"></span>
              <span class="toggle-label">📋 Mode <strong>Compos d'équipes officielles (H-1)</strong> : Réévaluation IA 1h avant coup d'envoi</span>
            </label>

            <label class="setting-toggle-item">
              <input type="checkbox" id="set-notify-vb" ${appSettings.notify_value_bets !== 0 ? 'checked' : ''} />
              <span class="toggle-custom"></span>
              <span class="toggle-label">💎 Alerte quand une <strong>Pépite Value Bet (+10% EV)</strong> est détectée</span>
            </label>

            <label class="setting-toggle-item">
              <input type="checkbox" id="set-notify-comb" ${appSettings.notify_combineds !== 0 ? 'checked' : ''} />
              <span class="toggle-custom"></span>
              <span class="toggle-label">⚡ Alerte quand un <strong>nouveau Combiné du Jour</strong> est généré</span>
            </label>
          </div>

          <button type="submit" class="btn btn-save-settings">
            <span>💾</span>
            <span>Enregistrer mes Préférences d'Alertes</span>
          </button>
        </form>
      </div>

    </div>
  `;
}

async function saveBankrollSettings(e) {
  if (e && e.preventDefault) e.preventDefault();
  const initial = parseFloat(document.getElementById('set-initial-bankroll').value);
  const currency = document.getElementById('set-currency').value;
  const kelly = parseFloat(document.getElementById('set-kelly-fraction').value);

  try {
    const res = await fetch(`${API}/bankroll/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        initial_bankroll: initial,
        currency: currency,
        kelly_fraction: kelly
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ Paramètres de Bankroll enregistrés !', 'success');
      await loadBankroll();
    } else {
      showToast(`Erreur: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast('Erreur enregistrement paramètres', 'error');
  }
}

async function saveNotificationSettings(e) {
  if (e && e.preventDefault) e.preventDefault();
  const ntfyTopic = document.getElementById('set-ntfy-topic')?.value?.trim();
  const emailRecipient = document.getElementById('set-email-recipient')?.value?.trim();
  const smtpHost = document.getElementById('set-smtp-host')?.value?.trim();
  const smtpPort = parseInt(document.getElementById('set-smtp-port')?.value || 587, 10);
  const smtpUser = document.getElementById('set-smtp-user')?.value?.trim();
  const smtpPass = document.getElementById('set-smtp-pass')?.value?.trim();

  const notifyDrop = document.getElementById('set-notify-drop')?.checked;
  const notifySettle = document.getElementById('set-notify-settle')?.checked;
  const notifyLineup = document.getElementById('set-notify-lineup')?.checked;
  const notifyVb = document.getElementById('set-notify-vb')?.checked;
  const notifyComb = document.getElementById('set-notify-comb')?.checked;

  try {
    const res = await fetch(`${API}/bankroll/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ntfy_topic: ntfyTopic,
        email_recipient: emailRecipient,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_user: smtpUser,
        smtp_pass: smtpPass,
        notify_dropping_odds: notifyDrop,
        notify_settlements: notifySettle,
        notify_lineups: notifyLineup,
        notify_value_bets: notifyVb,
        notify_combineds: notifyComb
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ Paramètres d\'alertes mobiles enregistrés !', 'success');
    } else {
      showToast(`Erreur: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast('Erreur enregistrement alertes', 'error');
  }
}

async function subscribeDeviceToWebPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    showToast('❌ Le Web Push n\'est pas supporté par ce navigateur', 'error');
    return;
  }

  try {
    showToast('Demande d\'autorisation des notifications push...', 'info');
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      showToast('❌ Permission refusée. Activez les notifications dans votre navigateur.', 'warn');
      return;
    }

    const reg = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const keyRes = await fetch(`${API}/push/public-key`);
    const keyData = await keyRes.json();
    if (!keyData.success || !keyData.publicKey) {
      throw new Error('Impossible de récupérer la clé VAPID du serveur');
    }

    const applicationServerKey = urlBase64ToUint8Array(keyData.publicKey);
    const subscription = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey
    });

    const subRes = await fetch(`${API}/push/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription, userAgent: navigator.userAgent })
    });
    const subResult = await subRes.json();

    if (subResult.success) {
      isPushSubscribed = true;
      showToast('🎉 Notifications push activées sur ce téléphone !', 'success');
      renderSettingsPage();
    } else {
      showToast(`Erreur: ${subResult.error}`, 'error');
    }
  } catch (err) {
    console.error('Push subscribe error:', err);
    showToast(`Erreur activation push: ${err.message}`, 'error');
  }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function testNotificationChannel(type) {
  showToast(`Test d'envoi d'alerte ${type}...`, 'info');
  const ntfyTopic = document.getElementById('set-ntfy-topic')?.value?.trim();
  const recipient = document.getElementById('set-email-recipient')?.value?.trim();
  const host = document.getElementById('set-smtp-host')?.value?.trim();
  const port = document.getElementById('set-smtp-port')?.value?.trim();
  const user = document.getElementById('set-smtp-user')?.value?.trim();
  const pass = document.getElementById('set-smtp-pass')?.value?.trim();

  try {
    const res = await fetch(`${API}/notifications/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ntfyTopic, recipient, host, port, user, pass })
    });
    const data = await res.json();
    if (data.success) {
      showToast('🎉 Notification envoyée avec succès ! Regardez votre smartphone.', 'success');
    } else {
      showToast(`❌ Échec : ${data.error}`, 'error');
    }
  } catch (err) {
    showToast('Erreur envoi du test', 'error');
  }
}
