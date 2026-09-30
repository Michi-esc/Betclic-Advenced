/* ================================================================
   AI MODAL MANAGEMENT
   ================================================================ */

async function openModal(matchId) {
  currentMatchId = matchId;
  const match = allMatches.find(m => m.id === matchId);
  if (!match) return;

  // Set header info
  document.getElementById('modal-home').textContent = match.home_team;
  document.getElementById('modal-away').textContent = match.away_team;
  document.getElementById('modal-competition').textContent = `${getCountryFlag(match.competition_country)} ${match.competition}`;
  document.getElementById('modal-date').textContent = `${formatMatchDate(match.match_date)} à ${match.match_time || '—'}`;
  document.getElementById('modal-venue').textContent = match.venue || 'Stade non précisé';

  // Show modal
  document.getElementById('modal-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  const hasAnalysis = !!match.ai_prediction;

  if (hasAnalysis) {
    showAnalysisData(match);
    document.getElementById('btn-refresh-analysis').onclick = () => runAnalysis(matchId);
  } else {
    showPrompt(matchId);
  }
}

function showPrompt(matchId) {
  document.getElementById('modal-loading').classList.add('hidden');
  document.getElementById('modal-body').classList.add('hidden');
  document.getElementById('modal-prompt').classList.remove('hidden');

  document.getElementById('btn-analyze-now').onclick = () => runAnalysis(matchId);
}

function showAnalysisData(match) {
  document.getElementById('modal-loading').classList.add('hidden');
  document.getElementById('modal-prompt').classList.add('hidden');
  document.getElementById('modal-body').classList.remove('hidden');

  let raw = {};
  try { raw = JSON.parse(match.raw_research || '{}'); } catch (_) {}

  // ── TABLEAU SYNTHÉTIQUE DES PARIS À PLACER ──
  const existingSummary = document.getElementById('modal-bet-summary-table');
  if (existingSummary) existingSummary.remove();

  const summaryCard = renderBetSummaryTableCard(match, raw);
  const cardPrediction = document.getElementById('card-prediction');
  if (cardPrediction) {
    cardPrediction.before(summaryCard);
  }

  // Prediction card with risk alert
  const cleanPred = formatBetSelectionLabel(match.ai_prediction, '1N2', match.home_team, match.away_team);
  document.getElementById('modal-prediction').textContent = cleanPred || '—';
  document.getElementById('modal-confidence').textContent = match.ai_confidence || '—';

  // Build recommendation + result risk alert
  const recBox = document.getElementById('modal-recommendation');
  let recHtml = escapeHtml(match.ai_recommendation || '—');
  if (raw.result_risk_level) {
    const riskClass = raw.result_risk_level === 'faible' ? 'risk-badge-low'
      : raw.result_risk_level === 'modéré' ? 'risk-badge-medium'
      : 'risk-badge-high';
    recHtml += `<div class="bet-risk-indicator ${riskClass}">`
      + `<span class="risk-label">Risque 1N2: <strong>${escapeHtml(raw.result_risk_level)}</strong></span>`;
    if (raw.result_risk_alert) {
      recHtml += `<div class="risk-alert-text">⚠️ ${escapeHtml(raw.result_risk_alert)}</div>`;
    }
    if (raw.result_avoid) {
      recHtml += `<div class="avoid-badge">🚫 PARI À ÉVITER</div>`;
    }
    recHtml += `</div>`;
  }
  recHtml += `
    <div class="modal-bet-cta-row">
      <button class="btn-modal-bet" onclick="quickBetFromModal(currentMatchId, 'prediction')">
        <span>💰</span>
        <span>Enregistrer ce pronostic dans la Bankroll</span>
      </button>
    </div>
  `;
  recBox.innerHTML = recHtml;

  // Weather at kick-off
  document.getElementById('modal-weather').textContent = match.weather_info || '—';

  // Form
  document.getElementById('form-home-name').textContent = match.home_team;
  document.getElementById('form-away-name').textContent = match.away_team;
  document.getElementById('modal-home-form').innerHTML = renderFormDots(match.home_form);
  document.getElementById('modal-away-form').innerHTML = renderFormDots(match.away_form);

  // Injuries
  document.getElementById('injury-home-label').textContent = match.home_team;
  document.getElementById('injury-away-label').textContent = match.away_team;
  document.getElementById('modal-home-injuries').textContent = match.home_injuries || '—';
  document.getElementById('modal-away-injuries').textContent = match.away_injuries || '—';

  // H2H
  document.getElementById('modal-h2h').textContent = match.head_to_head || '—';

  // News & Advanced Match Notes
  document.getElementById('modal-news').innerHTML = renderMatchNotes(match, raw);

  // ── Extended Markets ──
  const existingMarkets = document.getElementById('modal-extended-markets');
  if (existingMarkets) existingMarkets.remove();

  const hasExtended = match.btts_prediction && match.btts_prediction !== '—';
  if (hasExtended) {
    const marketsDiv = document.createElement('div');
    marketsDiv.id = 'modal-extended-markets';
    marketsDiv.className = 'analysis-card full-width extended-markets-card';

    // Build value bets structured section
    let valueBetsHtml = '';
    if (Array.isArray(raw.value_bets_structured) && raw.value_bets_structured.length > 0) {
      valueBetsHtml = `
        <div class="market-row full value-bets-structured">
          <div class="market-row-icon">💎</div>
          <div class="market-row-body">
            <div class="market-row-title-row">
              <div class="market-row-title">Value Bets Détectés (Edge Mathématique +EV)</div>
              <button class="btn-guide-pill" onclick="openGuideModal('value')" title="Pourquoi un Value Bet est-il mathématiquement rentable ?">
                💡 Comprendre l'Edge (+EV)
              </button>
            </div>
            <div class="vb-clarity-explanation">
              💡 <strong>Ce n'est pas un pari "au hasard" ou "audacieux" :</strong> Betclic a sous-estimé cette probabilité. L'analyse statistique (xG, effectif, calendrier) démontre que l'événement a plus de chances réelles de se produire que ce que reflète la cote du bookmaker. Miser régulièrement sur ce type d'écart garantit un rendement positif sur le volume.
            </div>
            ${raw.value_bets_structured.map(vb => `
              <div class="value-bet-item">
                <div class="vb-main-info">
                  <span class="vb-market">${escapeHtml(vb.market)}</span>
                  <span class="vb-selection">${escapeHtml(vb.selection)}</span>
                  <span class="vb-odds">Cote Betclic: <strong>${vb.bookmaker_odds}</strong></span>
                  <span class="vb-prob">Probabilité Réelle IA: <strong>${escapeHtml(vb.estimated_real_probability)}</strong></span>
                  <span class="vb-edge edge-positive">${escapeHtml(vb.value_edge)}</span>
                </div>
                ${vb.rationale ? `<div class="vb-rationale">${escapeHtml(vb.rationale)}</div>` : ''}
                <div class="vb-action-row">
                  <button class="btn-vb-quick-bet" onclick="quickBetFromModal(currentMatchId, 'value', ${escapeHtml(JSON.stringify(JSON.stringify(vb)))})">
                    💰 Miser ce Value Bet (${escapeHtml(vb.value_edge)})
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    } else if (match.value_bets && match.value_bets !== '—') {
      valueBetsHtml = `
        <div class="market-row full">
          <div class="market-row-icon">💎</div>
          <div class="market-row-body">
            <div class="market-row-title">Paris à valeur (Value Bets)</div>
            <div class="market-row-value value-bets-text">${escapeHtml(match.value_bets)}</div>
          </div>
        </div>
      `;
    }

    marketsDiv.innerHTML = `
      <div class="card-header">
        <span class="card-icon">🎯</span>
        <h3>Marchés Alternatifs — Analyse de Risque & Explications</h3>
        <span class="markets-badge">IA</span>
      </div>
      <div class="extended-markets-grid">
        ${renderMarketRow('🤝', 'Les deux marquent (BTTS)', match.btts_prediction, match.btts_confidence, raw.btts_rationale || 'OUI = les 2 équipes marquent au moins 1 but (1-1, 2-1...) • NON = au moins 1 clean sheet (1-0, 0-0...)', raw.btts_risk_level, raw.btts_risk_alert, raw.btts_avoid, 'btts')}
        ${renderMarketRow('📈', 'Over/Under 2.5 buts', match.over25_prediction, match.over25_confidence, raw.over25_rationale || 'Plus de 2.5 buts = 3 buts ou plus dans le match • Moins de 2.5 = 2 buts ou moins', raw.over25_risk_level, raw.over25_risk_alert, raw.over25_avoid, 'goals')}
        ${renderMarketRow('🛡️', 'Double Chance', match.double_chance_prediction, '', raw.double_chance_rationale || '1X (Dom ou Nul), X2 (Nul ou Ext), 12 (Pas de nul) — Couvre 2 issues sur 3', raw.double_chance_risk_level, raw.double_chance_risk_alert, false, '1n2')}
        ${renderMarketRow('⚖️', 'Handicap Asiatique', match.asian_handicap_prediction, '', raw.asian_handicap_rationale, raw.asian_handicap_risk_level, raw.asian_handicap_risk_alert, false, 'goals')}
        ${valueBetsHtml}
      </div>
    `;

    const footer = document.querySelector('.modal-footer');
    if (footer) footer.before(marketsDiv);
    else document.getElementById('modal-body').querySelector('.analysis-grid').appendChild(marketsDiv);
  }

  // Timestamp
  if (match.analyzed_at) {
    document.getElementById('modal-analyzed-at').textContent =
      `Analysé le ${new Date(match.analyzed_at).toLocaleString('fr-FR')}`;
  }
}

function renderMarketRow(icon, title, value, confidence, rationale, riskLevel, riskAlert, avoid) {
  if (!value || value === '—') return '';

  const riskClass = riskLevel === 'faible' ? 'risk-badge-low'
    : riskLevel === 'modéré' ? 'risk-badge-medium'
    : (riskLevel === 'élevé' || riskLevel === 'très élevé') ? 'risk-badge-high'
    : '';

  let riskHtml = '';
  if (riskLevel) {
    riskHtml = `<div class="market-risk-row ${riskClass}">`;
    riskHtml += `<span class="risk-level-dot"></span><span>Risque: <strong>${escapeHtml(riskLevel)}</strong></span>`;
    if (avoid) riskHtml += `<span class="avoid-tag">🚫 À ÉVITER</span>`;
    riskHtml += `</div>`;
    if (riskAlert) {
      riskHtml += `<div class="market-risk-alert">⚠️ ${escapeHtml(riskAlert)}</div>`;
    }
  }

  return `
    <div class="market-row">
      <div class="market-row-icon">${icon}</div>
      <div class="market-row-body">
        <div class="market-row-title">${title}</div>
        <div class="market-row-value">
          <strong>${escapeHtml(value)}</strong>
          ${confidence ? `<span class="market-conf">${escapeHtml(confidence)}</span>` : ''}
        </div>
        ${riskHtml}
        ${rationale ? `<div class="market-row-rationale">${escapeHtml(rationale)}</div>` : ''}
      </div>
    </div>
  `;
}

function renderMatchNotes(match, raw) {
  const xg = raw.xg_analysis || {};
  const fat = raw.fatigue_analysis || {};
  const lin = raw.lineup_analysis || {};
  const mkt = raw.market_dynamics || {};
  const ref = raw.referee_analysis || {};
  const stk = raw.stakes_analysis || {};

  const hasProModules = xg.home_xg || fat.home_rest_days !== undefined || lin.home_system || mkt.odds_trend;

  let modulesHtml = '';
  if (hasProModules) {
    modulesHtml = `
      <div class="pro-metrics-grid">
        ${xg.home_xg ? `
          <div class="pro-metric-card">
            <div class="pm-header">
              <span class="pm-icon">📊</span>
              <span class="pm-title">Expected Goals (xG)</span>
            </div>
            <div class="pm-comparison">
              <div class="pm-team-stat">
                <span class="pm-team-name">${escapeHtml(match.home_team)}</span>
                <span class="pm-stat-val val-green">${xg.home_xg} xG</span>
                <span class="pm-sub-stat">${xg.home_xga || '—'} xGA</span>
              </div>
              <div class="pm-vs-bar"></div>
              <div class="pm-team-stat">
                <span class="pm-team-name">${escapeHtml(match.away_team)}</span>
                <span class="pm-stat-val val-blue">${xg.away_xg} xG</span>
                <span class="pm-sub-stat">${xg.away_xga || '—'} xGA</span>
              </div>
            </div>
            ${xg.verdict ? `<div class="pm-verdict">${escapeHtml(xg.verdict)}</div>` : ''}
          </div>
        ` : ''}

        ${fat.home_rest_days !== undefined ? `
          <div class="pro-metric-card">
            <div class="pm-header">
              <span class="pm-icon">⚡</span>
              <span class="pm-title">Fatigue & Calendrier</span>
              ${fat.rotation_risk ? `<span class="pm-badge ${fat.rotation_risk === 'élevé' ? 'badge-danger' : 'badge-warn'}">Rotation: ${escapeHtml(fat.rotation_risk)}</span>` : ''}
            </div>
            <div class="pm-rest-row">
              <span>Repos : <strong>${escapeHtml(match.home_team)} (${fat.home_rest_days}j)</strong> vs <strong>${escapeHtml(match.away_team)} (${fat.away_rest_days}j)</strong></span>
            </div>
            ${fat.travel_km ? `<div class="pm-sub-info">✈️ ${escapeHtml(fat.travel_km)}</div>` : ''}
            ${fat.schedule_context ? `<div class="pm-verdict">${escapeHtml(fat.schedule_context)}</div>` : ''}
          </div>
        ` : ''}

        ${lin.home_system ? `
          <div class="pro-metric-card">
            <div class="pm-header">
              <span class="pm-icon">📋</span>
              <span class="pm-title">Dispositifs & Absences</span>
              ${lin.lineup_status ? `<span class="pm-badge">${escapeHtml(lin.lineup_status)}</span>` : ''}
            </div>
            <div class="pm-tactics-row">
              <span class="tactics-pill">${escapeHtml(match.home_team)} : <strong>${escapeHtml(lin.home_system)}</strong></span>
              <span class="tactics-pill">${escapeHtml(match.away_team)} : <strong>${escapeHtml(lin.away_system || 'N/A')}</strong></span>
            </div>
            ${lin.key_absences_impact ? `<div class="pm-verdict">⚠️ ${escapeHtml(lin.key_absences_impact)}</div>` : ''}
          </div>
        ` : ''}

        ${mkt.odds_trend ? `
          <div class="pro-metric-card ${mkt.trap_warning ? 'card-warning-trap' : ''}">
            <div class="pm-header">
              <span class="pm-icon">📈</span>
              <span class="pm-title">Marché & Cotes</span>
              <span class="pm-trend-badge">${escapeHtml(mkt.odds_trend)}</span>
            </div>
            ${mkt.smart_money ? `<div class="pm-sub-info">💼 Smart Money : ${escapeHtml(mkt.smart_money)}</div>` : ''}
            ${mkt.trap_warning ? `<div class="pm-trap-alert">🚨 ${escapeHtml(mkt.trap_warning)}</div>` : ''}
          </div>
        ` : ''}

        ${ref.cards_tendency ? `
          <div class="pro-metric-card">
            <div class="pm-header">
              <span class="pm-icon">👨‍⚖️</span>
              <span class="pm-title">Arbitrage & Discipline</span>
            </div>
            <div class="pm-sub-info">${escapeHtml(ref.referee_name || 'Arbitre')} • <strong>${escapeHtml(ref.cards_tendency)}</strong></div>
            <div class="pm-verdict">Penalties : <strong>${escapeHtml(ref.penalties_rate || 'modéré')}</strong> | Rythme : <strong>${escapeHtml(ref.game_tempo || 'régulier')}</strong></div>
          </div>
        ` : ''}

        ${stk.standings_context ? `
          <div class="pro-metric-card">
            <div class="pm-header">
              <span class="pm-icon">🎯</span>
              <span class="pm-title">Enjeux & Motivation</span>
            </div>
            <div class="pm-sub-info">${escapeHtml(stk.standings_context)}</div>
            <div class="pm-verdict">Motivation : <strong>${escapeHtml(stk.motivation_level || 'standard')}</strong></div>
          </div>
        ` : ''}
      </div>
    `;
  }

  const notesText = match.recent_news || 'Aucune note disponible.';
  return `
    ${modulesHtml}
    <div class="pro-notes-text">${escapeHtml(notesText)}</div>
  `;
}

async function runAnalysis(matchId) {
  // Show loading state
  document.getElementById('modal-prompt').classList.add('hidden');
  document.getElementById('modal-body').classList.add('hidden');
  document.getElementById('modal-loading').classList.remove('hidden');

  // Animate steps
  const steps = document.querySelectorAll('.ai-loader-steps .step');
  let stepIndex = 0;
  const stepInterval = setInterval(() => {
    if (stepIndex > 0) steps[stepIndex - 1].classList.replace('active', 'done');
    if (stepIndex < steps.length) {
      steps[stepIndex].classList.add('active');
      stepIndex++;
    }
  }, 1800);

  try {
    const res = await fetch(`${API}/analyze/${matchId}`, { method: 'POST' });
    const data = await res.json();

    clearInterval(stepInterval);

    if (data.success) {
      // Update match in allMatches
      const idx = allMatches.findIndex(m => m.id === matchId);
      if (idx !== -1) {
        allMatches[idx] = { ...allMatches[idx], ...data.analysis };
      }

      showAnalysisData({ ...allMatches.find(m => m.id === matchId), ...data.analysis });
      showToast('✅ Analyse IA terminée et sauvegardée !', 'success');

      renderMatches();
      loadStats();
    } else {
      document.getElementById('modal-loading').classList.add('hidden');
      document.getElementById('modal-prompt').classList.remove('hidden');
      showToast(`❌ Erreur: ${data.error}`, 'error');
    }
  } catch (err) {
    clearInterval(stepInterval);
    document.getElementById('modal-loading').classList.add('hidden');
    document.getElementById('modal-prompt').classList.remove('hidden');
    showToast('❌ Erreur de connexion', 'error');
  }
}

function closeModal(event) {
  if (event && event.target !== document.getElementById('modal-overlay')) return;
  document.getElementById('modal-overlay').classList.add('hidden');
  document.body.style.overflow = '';
  currentMatchId = null;

  // Reset steps
  document.querySelectorAll('.ai-loader-steps .step').forEach((s, i) => {
    s.classList.remove('active', 'done');
    if (i === 0) s.classList.add('active');
  });
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal({ target: document.getElementById('modal-overlay') });
});

function renderBetSummaryTableCard(match, raw) {
  const card = document.createElement('div');
  card.id = 'modal-bet-summary-table';
  card.className = 'analysis-card full-width bet-summary-table-card';

  const rows = [];

  // 1. Pari Principal (1N2)
  if (match.ai_prediction && match.ai_prediction !== '—') {
    const cleanPred = formatBetSelectionLabel(match.ai_prediction, '1N2', match.home_team, match.away_team);
    const odd = getOddForSelection(match.ai_prediction, '1N2', match);
    let confBadge = `<span class="conf-pill pill-high">🟢 ${escapeHtml(match.ai_confidence || '70%')}</span>`;
    if (raw.result_avoid) {
      confBadge = `<span class="conf-pill pill-danger">🚫 Déconseillé</span>`;
    } else if (raw.result_risk_level === 'élevé') {
      confBadge = `<span class="conf-pill pill-medium">🟡 Risqué (${escapeHtml(match.ai_confidence || '60%')})</span>`;
    }

    rows.push({
      role: '🔥 Pari Principal',
      roleClass: 'role-main',
      selection: cleanPred,
      market: 'Résultat (1N2)',
      odds: odd,
      confBadge: confBadge,
      actionPayload: { selection: cleanPred, market: '1N2', odds: odd, notes: match.ai_recommendation || 'Pari Principal IA' }
    });
  }

  // 2. Option Sécurisée (Double Chance)
  if (match.double_chance_prediction && match.double_chance_prediction !== '—') {
    const cleanDc = formatBetSelectionLabel(match.double_chance_prediction, 'Double Chance', match.home_team, match.away_team);
    const oddDc = getOddForSelection(match.double_chance_prediction, 'Double Chance', match);
    rows.push({
      role: '🛡️ Option Sécurité',
      roleClass: 'role-secure',
      selection: cleanDc,
      market: 'Double Chance',
      odds: oddDc,
      confBadge: `<span class="conf-pill pill-secure">🛡️ Sécurisé</span>`,
      actionPayload: { selection: cleanDc, market: 'Double Chance', odds: oddDc, notes: 'Option Sécurisée Double Chance' }
    });
  }

  // 3. Total de Buts
  if (match.over25_prediction && match.over25_prediction !== '—') {
    const cleanOver = formatBetSelectionLabel(match.over25_prediction, 'Over/Under', match.home_team, match.away_team);
    let confBadge = `<span class="conf-pill pill-high">🟢 ${escapeHtml(match.over25_confidence || 'Fiable')}</span>`;
    if (raw.over25_avoid) {
      confBadge = `<span class="conf-pill pill-danger">🚫 Déconseillé</span>`;
    }
    const oddGoals = raw.over25_odds || 1.80;
    rows.push({
      role: '⚽ Total Buts',
      roleClass: 'role-goals',
      selection: cleanOver,
      market: 'Total Buts (+/- 2.5)',
      odds: oddGoals,
      confBadge: confBadge,
      actionPayload: { selection: cleanOver, market: 'Total Buts (+/- 2.5)', odds: oddGoals, notes: raw.over25_rationale || 'Total Buts IA' }
    });
  }

  // 4. Les 2 Équipes Marquent (BTTS)
  if (match.btts_prediction && match.btts_prediction !== '—') {
    const cleanBtts = formatBetSelectionLabel(match.btts_prediction, 'BTTS', match.home_team, match.away_team);
    let confBadge = `<span class="conf-pill pill-high">🟢 ${escapeHtml(match.btts_confidence || 'Fiable')}</span>`;
    if (raw.btts_avoid) {
      confBadge = `<span class="conf-pill pill-danger">🚫 Déconseillé</span>`;
    }
    const oddBtts = raw.btts_odds || 1.75;
    rows.push({
      role: '🤝 Les 2 Marquent',
      roleClass: 'role-btts',
      selection: cleanBtts,
      market: 'Les 2 Équipes Marquent',
      odds: oddBtts,
      confBadge: confBadge,
      actionPayload: { selection: cleanBtts, market: 'Les deux équipes marquent', odds: oddBtts, notes: raw.btts_rationale || 'BTTS IA' }
    });
  }

  // 5. Value Bets détectés
  if (Array.isArray(raw.value_bets_structured)) {
    raw.value_bets_structured.forEach(vb => {
      const cleanVbSel = formatBetSelectionLabel(vb.selection, vb.market, match.home_team, match.away_team);
      const mktLabel = cleanMarketLabel(vb.market);
      rows.push({
        role: `💎 Value Bet (+${vb.value_edge})`,
        roleClass: 'role-value',
        selection: cleanVbSel,
        market: mktLabel,
        odds: vb.bookmaker_odds || 2.00,
        confBadge: `<span class="conf-pill pill-value">💎 Edge ${escapeHtml(vb.value_edge)}</span>`,
        actionPayload: { selection: cleanVbSel, market: mktLabel, odds: vb.bookmaker_odds, notes: `Value Bet Edge ${vb.value_edge} — ${vb.rationale || ''}` }
      });
    });
  }

  card.innerHTML = `
    <div class="card-header bet-table-header">
      <div class="header-left-title">
        <span class="card-icon">📋</span>
        <h3>Quels paris placer sur Betclic ? — Tableau Synthétique</h3>
      </div>
      <span class="badge-clarity">✨ Synthèse Simple</span>
    </div>
    <p class="bet-table-sub">
      Tableau clair et sans jargon : repérez directement quoi jouer sur votre application Betclic avec le niveau de fiabilité associé.
    </p>

    <div class="table-responsive">
      <table class="pro-bet-table">
        <thead>
          <tr>
            <th>Rôle du Pari</th>
            <th>Intitulé exact sur Betclic</th>
            <th>Marché</th>
            <th>Cote</th>
            <th>Fiabilité / Risque</th>
            <th>Action 1-Clic</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r => `
            <tr>
              <td><span class="role-badge ${r.roleClass}">${r.role}</span></td>
              <td class="table-sel-cell"><span class="bet-exact-name">${escapeHtml(r.selection)}</span></td>
              <td class="table-market-cell"><span class="table-market-tag">${escapeHtml(r.market)}</span></td>
              <td><span class="table-odd-pill">${Number(r.odds).toFixed(2)}</span></td>
              <td>${r.confBadge}</td>
              <td>
                <button class="btn-table-bet" onclick="quickBetFromModal(${match.id}, 'row', ${escapeHtml(JSON.stringify(JSON.stringify(r.actionPayload)))})" title="Ajouter directement ce pari à ma Bankroll">
                  <span>💰</span> <span>Miser</span>
                </button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="bet-table-quick-guide">
      <div class="quick-guide-header">
        <span class="qg-title">💡 Lexique Rapide des Intitulés Betclic</span>
        <button class="btn-open-guide-link" onclick="openGuideModal('1n2')">📖 Ouvrir le Guide & Lexique Complet</button>
      </div>
      <div class="quick-guide-grid">
        <div class="qg-item" onclick="openGuideModal('1n2')">
          <span class="qg-badge">1N2</span>
          <p><strong>1</strong> = Victoire Domicile • <strong>N</strong> = Nul • <strong>2</strong> = Victoire Extérieur (sur 90 min + arrêts de jeu uniquement, hors prolongations).</p>
        </div>
        <div class="qg-item" onclick="openGuideModal('btts')">
          <span class="qg-badge">BTTS</span>
          <p><strong>Les deux équipes marquent</strong> : <em>OUI</em> = score min 1-1, 2-1... <em>NON</em> = au moins un 0 (ex: 1-0, 0-0, 0-2...).</p>
        </div>
        <div class="qg-item" onclick="openGuideModal('value')">
          <span class="qg-badge">Value Bet</span>
          <p><strong>Erreur de cote Betclic</strong> : Cote trop haute payant plus que la probabilité réelle de l'événement (Espérance de gain positive mathématique +EV).</p>
        </div>
      </div>
    </div>
  `;

  return card;
}

function quickBetFromModal(matchId, type, customData) {
  const match = allMatches.find(m => m.id === matchId);
  if (!match) return;

  if (typeof openAddBetModal !== 'function') return;

  // Direct table row action
  if (type === 'row' && customData) {
    let betInfo = customData;
    if (typeof customData === 'string') {
      try { betInfo = JSON.parse(customData); } catch (_) {}
    }
    openAddBetModal({
      title: `${match.home_team} vs ${match.away_team}`,
      selection: betInfo.selection,
      market: betInfo.market || '1N2',
      odds: Number(betInfo.odds) || 1.85,
      stake: betInfo.stake || 20,
      bet_type: 'single',
      match_id: match.id,
      notes: betInfo.notes || `Conseil IA (${betInfo.role || 'Pari'})`
    });
    return;
  }

  if (type === 'value' && customData) {
    let vb = customData;
    if (typeof customData === 'string') {
      try { vb = JSON.parse(customData); } catch (_) {}
    }
    const cleanSel = formatBetSelectionLabel(vb.selection, vb.market, match.home_team, match.away_team);
    openAddBetModal({
      title: `${match.home_team} vs ${match.away_team}`,
      selection: cleanSel,
      market: cleanMarketLabel(vb.market || 'Value Bet'),
      odds: Number(vb.bookmaker_odds) || match.odds_home || 1.85,
      stake: 25,
      bet_type: 'single',
      match_id: match.id,
      notes: `Value Bet Edge ${vb.value_edge} — ${vb.rationale || ''}`
    });
    return;
  }

  // Type prediction
  const cleanSel = formatBetSelectionLabel(match.ai_prediction, '1N2', match.home_team, match.away_team);
  const correctOdd = getOddForSelection(match.ai_prediction, '1N2', match);

  openAddBetModal({
    title: `${match.home_team} vs ${match.away_team}`,
    selection: cleanSel,
    market: '1N2',
    odds: correctOdd,
    stake: 20,
    bet_type: 'single',
    match_id: match.id,
    notes: match.ai_recommendation || ''
  });
}


