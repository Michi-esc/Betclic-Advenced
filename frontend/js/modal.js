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

  // Prediction card with risk alert
  document.getElementById('modal-prediction').textContent = match.ai_prediction || '—';
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
            <div class="market-row-title">Value Bets détectés (edge positif)</div>
            ${raw.value_bets_structured.map(vb => `
              <div class="value-bet-item">
                <span class="vb-market">${escapeHtml(vb.market)}</span>
                <span class="vb-selection">${escapeHtml(vb.selection)}</span>
                <span class="vb-odds">Cote: <strong>${vb.bookmaker_odds}</strong></span>
                <span class="vb-prob">Prob réelle: ${escapeHtml(vb.estimated_real_probability)}</span>
                <span class="vb-edge edge-positive">${escapeHtml(vb.value_edge)}</span>
                ${vb.rationale ? `<div class="vb-rationale">${escapeHtml(vb.rationale)}</div>` : ''}
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
        <h3>Marchés Alternatifs — Analyse de Risque</h3>
        <span class="markets-badge">IA</span>
      </div>
      <div class="extended-markets-grid">
        ${renderMarketRow('🤝', 'Les deux marquent (BTTS)', match.btts_prediction, match.btts_confidence, raw.btts_rationale, raw.btts_risk_level, raw.btts_risk_alert, raw.btts_avoid)}
        ${renderMarketRow('📈', 'Over/Under 2.5 buts', match.over25_prediction, match.over25_confidence, raw.over25_rationale, raw.over25_risk_level, raw.over25_risk_alert, raw.over25_avoid)}
        ${renderMarketRow('🛡️', 'Double Chance', match.double_chance_prediction, '', raw.double_chance_rationale, raw.double_chance_risk_level, raw.double_chance_risk_alert, false)}
        ${renderMarketRow('⚖️', 'Handicap Asiatique', match.asian_handicap_prediction, '', raw.asian_handicap_rationale, raw.asian_handicap_risk_level, raw.asian_handicap_risk_alert, false)}
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
