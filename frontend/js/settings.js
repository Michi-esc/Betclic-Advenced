/* ================================================================
   SETTINGS & NOTIFICATIONS CONFIGURATION
   ================================================================ */

let appSettings = {
  initial_bankroll: 1000,
  current_bankroll: 1000,
  currency: '€',
  kelly_fraction: 0.25,
  telegram_bot_token: '',
  telegram_chat_id: '',
  discord_webhook_url: '',
  notify_value_bets: 1,
  notify_combineds: 1
};

async function loadSettings() {
  try {
    const res = await fetch(`${API}/bankroll`);
    const data = await res.json();
    if (data.success && data.data.settings) {
      appSettings = data.data.settings;
      renderSettingsPage();
    }
  } catch (err) {
    console.error('loadSettings error:', err);
  }
}

function renderSettingsPage() {
  const container = document.getElementById('settings-page');
  if (!container) return;

  container.innerHTML = `
    <div class="settings-container">
      
      <div class="settings-header">
        <h2>⚙️ Paramètres & Alertes Pro</h2>
        <p>Configurez votre capital de départ, vos alertes instantanées Telegram et vos critères de mise.</p>
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

      <!-- Telegram & Discord Notifications -->
      <div class="settings-card">
        <div class="settings-card-title">
          <span class="sc-icon">📲</span>
          <h3>Alertes Automatiques Telegram & Discord (24h/24)</h3>
        </div>
        <p class="sc-desc">Recevez les meilleures pépites Value Bets et les tickets combinés dès que le serveur les détecte, même téléphone verrouillé.</p>

        <form onsubmit="saveNotificationSettings(event)" class="settings-form">
          
          <div class="telegram-section">
            <h4 class="sub-section-title">✈️ Bot Telegram</h4>
            
            <div class="form-group">
              <label>Token du Bot Telegram</label>
              <input type="text" id="set-telegram-token" class="modal-input" placeholder="Ex: 123456789:ABCdefGhIJKlmNoPQRstuVWXyz" value="${appSettings.telegram_bot_token || ''}" />
              <span class="form-hint">Obtenez un bot gratuit en 1 min via @BotFather sur Telegram.</span>
            </div>

            <div class="form-group">
              <label>Votre Chat ID Telegram</label>
              <input type="text" id="set-telegram-chatid" class="modal-input" placeholder="Ex: 987654321" value="${appSettings.telegram_chat_id || ''}" />
              <span class="form-hint">Trouvez votre ID en envoyant un message à @userinfobot sur Telegram.</span>
            </div>

            <button type="button" class="btn btn-test-channel" onclick="testNotificationChannel('telegram')">
              <span>✈️</span>
              <span>Tester la notification Telegram</span>
            </button>
          </div>

          <hr class="settings-divider" />

          <div class="discord-section">
            <h4 class="sub-section-title">🎮 Webhook Discord (Optionnel)</h4>
            <div class="form-group">
              <label>URL du Webhook Discord</label>
              <input type="url" id="set-discord-webhook" class="modal-input" placeholder="https://discord.com/api/webhooks/..." value="${appSettings.discord_webhook_url || ''}" />
            </div>

            <button type="button" class="btn btn-test-channel" onclick="testNotificationChannel('discord')">
              <span>🎮</span>
              <span>Tester la notification Discord</span>
            </button>
          </div>

          <hr class="settings-divider" />

          <div class="email-section">
            <h4 class="sub-section-title">📧 Notifications Email & Téléphone (Smartphone)</h4>
            <p class="sc-desc" style="margin-bottom: 12px; font-size: 0.85rem;">
              Recevez vos alertes de cotes en chute, compositions officielles et résultats de paris directement par notification push mail sur votre smartphone.
            </p>

            <div class="form-group">
              <label>Votre Adresse Email de Réception *</label>
              <input type="email" id="set-email-recipient" class="modal-input" placeholder="mon-adresse@gmail.com" value="${appSettings.email_recipient || ''}" />
              <span class="form-hint">L'email sur lequel vous avez vos notifications activées sur votre smartphone.</span>
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
                <label>Utilisateur / Email SMTP</label>
                <input type="text" id="set-smtp-user" class="modal-input" placeholder="mon-compte@gmail.com" value="${appSettings.smtp_user || ''}" />
              </div>
              <div class="form-group flex-1">
                <label>Mot de passe / App Password</label>
                <input type="password" id="set-smtp-pass" class="modal-input" placeholder="••••••••••••" value="${appSettings.smtp_pass || ''}" />
              </div>
            </div>

            <button type="button" class="btn btn-test-channel" onclick="testNotificationChannel('email')">
              <span>📧</span>
              <span>Tester l'envoi d'Email</span>
            </button>
          </div>

          <hr class="settings-divider" />

          <div class="toggles-section">
            <h4 class="sub-section-title">🔔 Événements & Détecteurs Automatiques</h4>
            
            <label class="setting-toggle-item">
              <input type="checkbox" id="set-notify-vb" ${appSettings.notify_value_bets !== 0 ? 'checked' : ''} />
              <span class="toggle-custom"></span>
              <span class="toggle-label">💎 Alerte immédiate quand un <strong>Value Bet (+10% EV)</strong> est détecté</span>
            </label>

            <label class="setting-toggle-item">
              <input type="checkbox" id="set-notify-comb" ${appSettings.notify_combineds !== 0 ? 'checked' : ''} />
              <span class="toggle-custom"></span>
              <span class="toggle-label">⚡ Alerte quand un <strong>nouveau Combiné du Jour</strong> est généré</span>
            </label>

            <label class="setting-toggle-item">
              <input type="checkbox" id="set-notify-drop" ${appSettings.notify_dropping_odds !== 0 ? 'checked' : ''} />
              <span class="toggle-custom"></span>
              <span class="toggle-label">📉 Détecteur de <strong>Cotes en Chute / Smart Money</strong> (baisse soudaine &gt;= 7%)</span>
            </label>

            <label class="setting-toggle-item">
              <input type="checkbox" id="set-notify-settle" ${appSettings.notify_settlements !== 0 ? 'checked' : ''} />
              <span class="toggle-custom"></span>
              <span class="toggle-label">🎯 Résolution automatique : Alerte quand un <strong>pari est soldé (Gagné / Perdu)</strong></span>
            </label>

            <label class="setting-toggle-item">
              <input type="checkbox" id="set-notify-lineup" ${appSettings.notify_lineups !== 0 ? 'checked' : ''} />
              <span class="toggle-custom"></span>
              <span class="toggle-label">📋 Mode <strong>Compos d'équipes officielles (H-1)</strong> : Réévaluation IA 1h avant coup d'envoi</span>
            </label>
          </div>

          <button type="submit" class="btn btn-save-settings">
            <span>💾</span>
            <span>Enregistrer les Alertes & Détecteurs</span>
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
  const token = document.getElementById('set-telegram-token')?.value?.trim();
  const chatId = document.getElementById('set-telegram-chatid')?.value?.trim();
  const webhook = document.getElementById('set-discord-webhook')?.value?.trim();
  const emailRecipient = document.getElementById('set-email-recipient')?.value?.trim();
  const smtpHost = document.getElementById('set-smtp-host')?.value?.trim();
  const smtpPort = parseInt(document.getElementById('set-smtp-port')?.value || 587, 10);
  const smtpUser = document.getElementById('set-smtp-user')?.value?.trim();
  const smtpPass = document.getElementById('set-smtp-pass')?.value?.trim();

  const notifyVb = document.getElementById('set-notify-vb')?.checked;
  const notifyComb = document.getElementById('set-notify-comb')?.checked;
  const notifyDrop = document.getElementById('set-notify-drop')?.checked;
  const notifySettle = document.getElementById('set-notify-settle')?.checked;
  const notifyLineup = document.getElementById('set-notify-lineup')?.checked;

  try {
    const res = await fetch(`${API}/bankroll/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telegram_bot_token: token,
        telegram_chat_id: chatId,
        discord_webhook_url: webhook,
        email_recipient: emailRecipient,
        smtp_host: smtpHost,
        smtp_port: smtpPort,
        smtp_user: smtpUser,
        smtp_pass: smtpPass,
        notify_value_bets: notifyVb,
        notify_combineds: notifyComb,
        notify_dropping_odds: notifyDrop,
        notify_settlements: notifySettle,
        notify_lineups: notifyLineup
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('✅ Paramètres d\'alertes et détecteurs enregistrés !', 'success');
    } else {
      showToast(`Erreur: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast('Erreur enregistrement alertes', 'error');
  }
}

async function testNotificationChannel(type) {
  showToast(`Test d'envoi d'alerte ${type}...`, 'info');
  const token = document.getElementById('set-telegram-token')?.value?.trim();
  const chatId = document.getElementById('set-telegram-chatid')?.value?.trim();
  const webhookUrl = document.getElementById('set-discord-webhook')?.value?.trim();
  const recipient = document.getElementById('set-email-recipient')?.value?.trim();
  const host = document.getElementById('set-smtp-host')?.value?.trim();
  const port = document.getElementById('set-smtp-port')?.value?.trim();
  const user = document.getElementById('set-smtp-user')?.value?.trim();
  const pass = document.getElementById('set-smtp-pass')?.value?.trim();

  try {
    const res = await fetch(`${API}/notifications/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, token, chatId, webhookUrl, recipient, host, port, user, pass })
    });
    const data = await res.json();
    if (data.success) {
      showToast('🎉 Notification envoyée avec succès ! Regardez votre messagerie.', 'success');
    } else {
      showToast(`❌ Échec : ${data.error}`, 'error');
    }
  } catch (err) {
    showToast('Erreur envoi du test', 'error');
  }
}
