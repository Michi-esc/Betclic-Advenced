/* ================================================================
   COMBINÉS IA — Logic & Rendering
   ================================================================ */

// State
let combinedState = {
  activeTab: 'generate',       // 'generate' | 'builder' | 'history'
  strategy: 'balanced',        // 'safe' | 'balanced' | 'aggressive'
  riskLevel: 'medium',         // 'low' | 'medium' | 'high' | 'max'
  stake: 10,
  targetOddsRange: 'all',     // 'all' | '2-5' | '5-10' | '10-25' | '25+'
  preferredMarkets: 'all',    // 'all' | 'safe_dc' | 'goals' | 'no_1n2'
  cashoutOptimized: true,     // true | false
  selectedMatchIds: [],        // for builder mode
  isGenerating: false,
  currentResult: null,
  savedCombineds: [],
};

// ============================================================
// INIT
// ============================================================
async function initCombinedPage() {
  await loadCombinedHistory();
  renderCombinedPage();
}

// ============================================================
// TABS
// ============================================================
function switchCombinedTab(tab) {
  combinedState.activeTab = tab;
  document.querySelectorAll('.combined-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  document.querySelectorAll('.combined-section').forEach(s => {
    s.classList.toggle('hidden', s.dataset.section !== tab);
  });

  if (tab === 'builder') renderBuilderMatchList();
  if (tab === 'history') renderCombinedHistory();
}

// ============================================================
// MAIN PAGE RENDER
// ============================================================
function renderCombinedPage() {
  const container = document.getElementById('combined-page');
  if (!container) return;

  container.innerHTML = `
    <!-- ===== COMBINED HEADER ===== -->
    <div class="combined-hero">
      <div class="combined-hero-icon">⚡</div>
      <div class="combined-hero-text">
        <h1 class="combined-hero-title">Combinés <span class="gradient-text">IA</span></h1>
        <p class="combined-hero-sub">L'intelligence artificielle analyse vos matchs et construit les meilleurs combinés</p>
      </div>
      <div class="combined-stats-bar">
        <div class="cstat">
          <span class="cstat-value" id="cstat-analyzed">—</span>
          <span class="cstat-label">Matchs analysés</span>
        </div>
        <div class="cstat">
          <span class="cstat-value" id="cstat-combineds">—</span>
          <span class="cstat-label">Combinés créés</span>
        </div>
      </div>
    </div>

    <!-- ===== SUB-TABS ===== -->
    <div class="combined-tabs-bar">
      <button class="combined-tab active" data-tab="generate" onclick="switchCombinedTab('generate')">
        <span>🤖</span> Génération IA
      </button>
      <button class="combined-tab" data-tab="builder" onclick="switchCombinedTab('builder')">
        <span>🛠️</span> Constructeur Manuel
      </button>
      <button class="combined-tab" data-tab="history" onclick="switchCombinedTab('history')">
        <span>📋</span> Mes Combinés
      </button>
    </div>

    <!-- ===== SECTION: AI GENERATION ===== -->
    <div class="combined-section" data-section="generate">
      ${renderGenerateSection()}
    </div>

    <!-- ===== SECTION: MANUAL BUILDER ===== -->
    <div class="combined-section hidden" data-section="builder">
      ${renderBuilderSection()}
    </div>

    <!-- ===== SECTION: HISTORY ===== -->
    <div class="combined-section hidden" data-section="history">
      <div id="combined-history-list">
        <div class="combined-empty">
          <span>📋</span>
          <p>Aucun combiné sauvegardé</p>
        </div>
      </div>
    </div>
  `;

  // Load stats
  loadCombinedStats();
}

// ============================================================
// SECTION: AI GENERATION
// ============================================================
function renderGenerateSection() {
  return `
    <div class="generate-layout">
      <!-- Strategy Panel -->
      <div class="generate-config">
        <h2 class="config-title">⚙️ Paramétrage du Combiné</h2>

        <!-- Strategy Selection -->
        <div class="config-group">
          <label class="config-label">Stratégie</label>
          <div class="strategy-cards">
            <div class="strategy-card ${combinedState.strategy === 'safe' ? 'active' : ''}" 
                 onclick="setCombinedStrategy('safe')">
              <div class="strategy-icon">🛡️</div>
              <div class="strategy-name">Sécurisé</div>
              <div class="strategy-desc">Sélections haute probabilité (>65%), cotes 1.30-1.80</div>
              <div class="strategy-risk risk-low">Risque faible</div>
            </div>
            <div class="strategy-card ${combinedState.strategy === 'balanced' ? 'active' : ''}" 
                 onclick="setCombinedStrategy('balanced')">
              <div class="strategy-icon">⚖️</div>
              <div class="strategy-name">Équilibré</div>
              <div class="strategy-desc">Mélange résultat + marchés alternatifs, cotes 1.50-2.50</div>
              <div class="strategy-risk risk-medium">Risque modéré</div>
            </div>
            <div class="strategy-card ${combinedState.strategy === 'aggressive' ? 'active' : ''}" 
                 onclick="setCombinedStrategy('aggressive')">
              <div class="strategy-icon">🚀</div>
              <div class="strategy-name">Agressif</div>
              <div class="strategy-desc">Maximiser les gains, paris valeur, cotes 2.00-4.00</div>
              <div class="strategy-risk risk-high">Risque élevé</div>
            </div>
          </div>
        </div>

        <!-- Risk Level -->
        <div class="config-group">
          <label class="config-label">Nombre de sélections souhaité</label>
          <div class="risk-pills">
            <button class="risk-pill ${combinedState.riskLevel === 'low' ? 'active' : ''}" 
                    onclick="setCombinedRisk('low')">2-4 sélections</button>
            <button class="risk-pill ${combinedState.riskLevel === 'medium' ? 'active' : ''}" 
                    onclick="setCombinedRisk('medium')">3-6 sélections</button>
            <button class="risk-pill ${combinedState.riskLevel === 'high' ? 'active' : ''}" 
                    onclick="setCombinedRisk('high')">5-10 sélections</button>
            <button class="risk-pill ${combinedState.riskLevel === 'max' ? 'active' : ''}" 
                    onclick="setCombinedRisk('max')">🚀 Jusqu'à 15 (Max)</button>
          </div>
        </div>

        <!-- Target Odds Range -->
        <div class="config-group">
          <label class="config-label">🎯 Objectif Cote Totale</label>
          <div class="risk-pills">
            <button class="risk-pill target-odds-pill ${combinedState.targetOddsRange === 'all' ? 'active' : ''}" 
                    data-range="all" onclick="setTargetOddsRange('all')">Auto / Libre</button>
            <button class="risk-pill target-odds-pill ${combinedState.targetOddsRange === '2-5' ? 'active' : ''}" 
                    data-range="2-5" onclick="setTargetOddsRange('2-5')">2.00 - 5.00 (Sécurisé)</button>
            <button class="risk-pill target-odds-pill ${combinedState.targetOddsRange === '5-10' ? 'active' : ''}" 
                    data-range="5-10" onclick="setTargetOddsRange('5-10')">5.00 - 10.00 (Équilibré)</button>
            <button class="risk-pill target-odds-pill ${combinedState.targetOddsRange === '10-25' ? 'active' : ''}" 
                    data-range="10-25" onclick="setTargetOddsRange('10-25')">10.00 - 25.00 (Boosté)</button>
            <button class="risk-pill target-odds-pill ${combinedState.targetOddsRange === '25+' ? 'active' : ''}" 
                    data-range="25+" onclick="setTargetOddsRange('25+')">🚀 25.00+ (Jackpot)</button>
          </div>
        </div>

        <!-- Preferred Markets Filter -->
        <div class="config-group">
          <label class="config-label">🛡️ Filtre de Marchés</label>
          <div class="risk-pills">
            <button class="risk-pill market-filter-pill ${combinedState.preferredMarkets === 'all' ? 'active' : ''}" 
                    data-market="all" onclick="setPreferredMarkets('all')">Tous les marchés</button>
            <button class="risk-pill market-filter-pill ${combinedState.preferredMarkets === 'safe_dc' ? 'active' : ''}" 
                    data-market="safe_dc" onclick="setPreferredMarkets('safe_dc')">🛡️ Double Chance & Sécurité</button>
            <button class="risk-pill market-filter-pill ${combinedState.preferredMarkets === 'goals' ? 'active' : ''}" 
                    data-market="goals" onclick="setPreferredMarkets('goals')">⚽ Buts & Over/Under</button>
            <button class="risk-pill market-filter-pill ${combinedState.preferredMarkets === 'no_1n2' ? 'active' : ''}" 
                    data-market="no_1n2" onclick="setPreferredMarkets('no_1n2')">🚫 Sans 1N2 sec</button>
          </div>
        </div>

        <!-- Cashout & Hedging Toggle -->
        <div class="config-group">
          <label class="config-label">⏱️ Stratégie Cashout & Couverture</label>
          <div class="cashout-toggle-card ${combinedState.cashoutOptimized ? 'active' : ''}" id="cashout-toggle-card" onclick="toggleCashoutOptimized()">
            <div class="toggle-icon">🕒</div>
            <div class="toggle-info">
              <div class="toggle-title">Échelonner les coups d'envoi chronologiquement</div>
              <div class="toggle-desc">Permet de valider les premiers matchs et d'assurer un Cashout / Couverture garantie sur le dernier match décisif.</div>
            </div>
            <div class="toggle-switch ${combinedState.cashoutOptimized ? 'on' : ''}"></div>
          </div>
        </div>

        <!-- Stake -->
        <div class="config-group">
          <label class="config-label">Mise (€)</label>
          <div class="stake-input-row">
            <button class="stake-btn" onclick="adjustStake(-5)">-5€</button>
            <input type="number" class="stake-input" id="stake-input" value="${combinedState.stake}" 
                   min="1" max="500" onchange="setStake(this.value)" />
            <button class="stake-btn" onclick="adjustStake(5)">+5€</button>
          </div>
          <div class="stake-presets">
            ${[5, 10, 20, 50].map(v => `<button class="stake-preset ${combinedState.stake === v ? 'active' : ''}" onclick="setStake(${v})">${v}€</button>`).join('')}
          </div>
        </div>

        <!-- Market Info -->
        <div class="markets-info-box">
          <div class="markets-info-title">🎯 Marchés analysés par l'IA</div>
          <div class="markets-grid">
            <div class="market-chip">1N2 — Résultat final</div>
            <div class="market-chip">BTTS — Les deux marquent</div>
            <div class="market-chip">Over/Under 2.5 buts</div>
            <div class="market-chip">Double Chance</div>
            <div class="market-chip">Handicap Asiatique</div>
            <div class="market-chip">Paris à valeur</div>
          </div>
        </div>

        <!-- Generate Button -->
        <button class="btn-generate-combined" id="btn-generate" onclick="triggerGenerateCombined()">
          <span class="generate-icon">🤖</span>
          <span id="generate-btn-text">Générer le Combiné IA</span>
        </button>
      </div>

      <!-- Result Panel -->
      <div class="generate-result">
        <div id="combined-result-area">
          <div class="result-placeholder">
            <div class="placeholder-icon">⚡</div>
            <h3>Prêt à construire votre combiné</h3>
            <p>Configurez votre stratégie et cliquez sur <strong>Générer</strong>. L'IA analysera tous les matchs disponibles et construira le meilleur combiné selon vos critères.</p>
            <div class="analyzed-matches-hint" id="analyzed-hint">
              Chargement des matchs analysés...
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// SECTION: MANUAL BUILDER
// ============================================================
function renderBuilderSection() {
  return `
    <div class="builder-layout">
      <div class="builder-left">
        <h2 class="config-title">🛠️ Sélectionnez vos matchs</h2>
        <p class="builder-hint">Cliquez sur un match analysé pour l'ajouter à votre combiné. Choisissez ensuite le marché et la sélection.</p>
        <div id="builder-match-list">
          <div class="combined-empty"><span>⏳</span><p>Chargement des matchs analysés...</p></div>
        </div>
      </div>
      <div class="builder-right">
        <div class="builder-slip">
          <h2 class="config-title">📝 Mon Combiné</h2>
          <div id="builder-slip-items">
            <div class="slip-empty">
              <span>➕</span>
              <p>Ajoutez des matchs depuis la liste</p>
            </div>
          </div>
          <div class="slip-summary" id="slip-summary" style="display:none">
            <div class="slip-row">
              <span>Cote totale</span>
              <span class="slip-odds" id="slip-total-odds">1.00</span>
            </div>
            <div class="slip-row">
              <span>Mise</span>
              <div class="stake-input-row">
                <input type="number" class="stake-input small" id="builder-stake" value="10" min="1" />
                <span>€</span>
              </div>
            </div>
            <div class="slip-row gain-row">
              <span>Gain potentiel</span>
              <span class="slip-gain" id="slip-gain">—</span>
            </div>
            <input type="text" class="combined-name-input" id="combined-name-input" placeholder="Nom de mon combiné..." />
            <button class="btn-save-combined" onclick="saveManualCombined()">💾 Sauvegarder ce combiné</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ============================================================
// MATCH SELECTION IN BUILDER
// ============================================================
let builderSelections = {}; // { matchId: { market, selection, odds } }

function renderBuilderMatchList() {
  const container = document.getElementById('builder-match-list');
  if (!container) return;

  const analyzed = allMatches.filter(m => m.ai_prediction);
  if (analyzed.length === 0) {
    container.innerHTML = `<div class="combined-empty"><span>🔍</span><p>Aucun match analysé. Allez dans l'onglet Matchs et lancez des analyses IA d'abord.</p></div>`;
    return;
  }

  container.innerHTML = analyzed.map(m => {
    let raw = {};
    try { raw = JSON.parse(m.raw_research || '{}'); } catch (_) {}
    const isSelected = !!builderSelections[m.id];

    const markets = buildMarketOptions(m, raw);

    // Build per-market risk summary
    const marketRisks = [
      raw.result_risk_level && raw.result_risk_level !== 'faible'
        ? `<span class="builder-risk-chip ${raw.result_avoid ? 'chip-danger' : 'chip-warn'}">1N2: ${raw.result_risk_level}${raw.result_avoid ? ' 🚫' : ''}</span>`
        : '',
      raw.btts_risk_level && raw.btts_risk_level !== 'faible'
        ? `<span class="builder-risk-chip ${raw.btts_avoid ? 'chip-danger' : 'chip-warn'}">BTTS: ${raw.btts_risk_level}${raw.btts_avoid ? ' 🚫' : ''}</span>`
        : '',
      raw.over25_risk_level && raw.over25_risk_level !== 'faible'
        ? `<span class="builder-risk-chip ${raw.over25_avoid ? 'chip-danger' : 'chip-warn'}">O/U: ${raw.over25_risk_level}${raw.over25_avoid ? ' 🚫' : ''}</span>`
        : '',
    ].filter(Boolean).join('');

    // Value bet indicator
    const hasValueBets = Array.isArray(raw.value_bets_structured) && raw.value_bets_structured.length > 0;
    const valueBetBadge = hasValueBets
      ? `<span class="builder-value-badge">💎 VALUE BET</span>`
      : '';

    return `
      <div class="builder-match-card ${isSelected ? 'selected' : ''}" id="bm-${m.id}">
        <div class="bm-header" onclick="toggleBuilderMatch(${m.id})">
          <div class="bm-teams">
            <span class="bm-home">${escapeHtml(m.home_team)}</span>
            <span class="bm-vs">vs</span>
            <span class="bm-away">${escapeHtml(m.away_team)}</span>
          </div>
          <div class="bm-meta">
            <span class="bm-comp">${escapeHtml(m.competition)}</span>
            <span class="bm-date">${formatMatchDate(m.match_date)} ${m.match_time}</span>
            ${m.ai_confidence ? `<span class="bm-conf">${m.ai_confidence}</span>` : ''}
          </div>
          <div class="bm-ai-summary">
            <span class="bm-pred-pill">IA: ${escapeHtml(m.ai_prediction || '—')}</span>
            ${raw.overall_risk ? `<span class="bm-risk risk-${raw.overall_risk === 'faible' ? 'low' : raw.overall_risk === 'élevé' ? 'high' : 'medium'}">${raw.overall_risk}</span>` : ''}
            ${valueBetBadge}
          </div>
          ${marketRisks ? `<div class="bm-market-risks">${marketRisks}</div>` : ''}
        </div>
        <div class="bm-markets ${isSelected ? '' : 'hidden'}" id="bm-markets-${m.id}">
          <div class="bm-markets-title">Choisir un marché :</div>
          <div class="market-options">
            ${markets.map(opt => `
              <button class="market-option ${builderSelections[m.id]?.selection === opt.selection ? 'active' : ''} ${opt.avoid ? 'market-option-avoid' : ''}"
                      onclick="selectBuilderMarket(${m.id}, '${escapeHtml(opt.market)}', '${escapeHtml(opt.selection)}', ${opt.odds})">
                <span class="mo-market">${opt.market}</span>
                <span class="mo-selection">${opt.selection}</span>
                <span class="mo-odds">${opt.odds.toFixed(2)}</span>
                ${opt.recommended ? '<span class="mo-rec">⭐ IA</span>' : ''}
                ${opt.isValueBet ? '<span class="mo-value">💎 VALUE</span>' : ''}
                ${opt.avoid ? '<span class="mo-avoid">🚫 RISQUÉ</span>' : ''}
                ${opt.riskLabel ? `<span class="mo-risk-label ${opt.riskLevel === 'faible' ? 'risk-label-low' : opt.riskLevel === 'modéré' ? 'risk-label-medium' : 'risk-label-high'}">${opt.riskLabel}</span>` : ''}
              </button>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function buildMarketOptions(m, raw) {
  const options = [];

  // 1N2
  if (m.odds_home) options.push({
    market: '1N2', selection: `🏠 ${m.home_team}`, odds: m.odds_home,
    recommended: raw.recommended_for_combined && m.ai_prediction?.includes(m.home_team),
    riskLevel: raw.result_risk_level, riskLabel: raw.result_risk_level,
    avoid: raw.result_avoid, isValueBet: false,
  });
  if (m.odds_draw) options.push({
    market: '1N2', selection: '🤝 Match nul', odds: m.odds_draw,
    recommended: false, riskLevel: raw.result_risk_level, riskLabel: raw.result_risk_level,
    avoid: raw.result_avoid, isValueBet: false,
  });
  if (m.odds_away) options.push({
    market: '1N2', selection: `✈️ ${m.away_team}`, odds: m.odds_away,
    recommended: raw.recommended_for_combined && m.ai_prediction?.includes(m.away_team),
    riskLevel: raw.result_risk_level, riskLabel: raw.result_risk_level,
    avoid: raw.result_avoid, isValueBet: false,
  });

  // Double Chance
  if (m.odds_home && m.odds_draw) options.push({
    market: 'Double Chance',
    selection: `1X (${m.home_team} ou Nul)`,
    odds: Math.max(1.05, parseFloat(((m.odds_home * m.odds_draw) / (m.odds_home + m.odds_draw)).toFixed(2)) || 1.25),
    recommended: m.double_chance_prediction === '1X',
    riskLevel: raw.double_chance_risk_level, riskLabel: raw.double_chance_risk_level,
    avoid: false, isValueBet: false,
  });
  if (m.odds_away && m.odds_draw) options.push({
    market: 'Double Chance',
    selection: `X2 (Nul ou ${m.away_team})`,
    odds: Math.max(1.05, parseFloat(((m.odds_away * m.odds_draw) / (m.odds_away + m.odds_draw)).toFixed(2)) || 1.30),
    recommended: m.double_chance_prediction === 'X2',
    riskLevel: raw.double_chance_risk_level, riskLabel: raw.double_chance_risk_level,
    avoid: false, isValueBet: false,
  });

  // BTTS
  if (m.btts_prediction && m.btts_prediction !== '—') {
    const bttsOdds = m.btts_prediction === 'Oui' ? 1.75 : 1.55;
    // Check if it's a value bet
    const bttsVb = Array.isArray(raw.value_bets_structured)
      ? raw.value_bets_structured.find(vb => vb.market === 'BTTS') : null;
    options.push({
      market: 'BTTS',
      selection: `Les deux marquent: ${m.btts_prediction}`,
      odds: bttsVb ? bttsVb.bookmaker_odds : bttsOdds,
      recommended: true,
      riskLevel: raw.btts_risk_level, riskLabel: raw.btts_risk_level,
      avoid: raw.btts_avoid,
      isValueBet: !!bttsVb,
    });
  }

  // Over/Under 2.5
  if (m.over25_prediction && m.over25_prediction !== '—') {
    const overOdds = m.over25_prediction?.includes('Plus') ? 1.85 : 1.65;
    const overVb = Array.isArray(raw.value_bets_structured)
      ? raw.value_bets_structured.find(vb => vb.market === 'Over 2.5' || vb.market === 'Under 2.5') : null;
    options.push({
      market: 'Over/Under',
      selection: m.over25_prediction,
      odds: overVb ? overVb.bookmaker_odds : overOdds,
      recommended: !raw.over25_avoid,
      riskLevel: raw.over25_risk_level, riskLabel: raw.over25_risk_level,
      avoid: raw.over25_avoid,
      isValueBet: !!overVb,
    });
  }

  // Handicap
  if (m.asian_handicap_prediction && m.asian_handicap_prediction !== '—') {
    const ahVb = Array.isArray(raw.value_bets_structured)
      ? raw.value_bets_structured.find(vb => vb.market === 'Handicap') : null;
    options.push({
      market: 'Handicap Asiatique',
      selection: m.asian_handicap_prediction,
      odds: ahVb ? ahVb.bookmaker_odds : 1.90,
      recommended: false,
      riskLevel: raw.asian_handicap_risk_level, riskLabel: raw.asian_handicap_risk_level,
      avoid: false,
      isValueBet: !!ahVb,
    });
  }

  return options;
}

function toggleBuilderMatch(matchId) {
  const marketsEl = document.getElementById(`bm-markets-${matchId}`);
  if (marketsEl) marketsEl.classList.toggle('hidden');
}

function selectBuilderMarket(matchId, market, selection, odds) {
  builderSelections[matchId] = { matchId, market, selection, odds };

  const card = document.getElementById(`bm-${matchId}`);
  if (card) card.classList.add('selected');

  // Mark button active
  const marketsEl = document.getElementById(`bm-markets-${matchId}`);
  if (marketsEl) {
    marketsEl.querySelectorAll('.market-option').forEach(btn => {
      btn.classList.toggle('active', btn.querySelector('.mo-selection')?.textContent === selection);
    });
  }

  updateBuilderSlip();
}

function removeBuilderSelection(matchId) {
  delete builderSelections[matchId];
  const card = document.getElementById(`bm-${matchId}`);
  if (card) card.classList.remove('selected');
  updateBuilderSlip();
}

function updateBuilderSlip() {
  const items = Object.values(builderSelections);
  const slipItemsEl = document.getElementById('builder-slip-items');
  const slipSummary = document.getElementById('slip-summary');
  const slipOddsEl = document.getElementById('slip-total-odds');
  const slipGainEl = document.getElementById('slip-gain');

  if (!slipItemsEl) return;

  if (items.length === 0) {
    slipItemsEl.innerHTML = `<div class="slip-empty"><span>➕</span><p>Ajoutez des matchs depuis la liste</p></div>`;
    if (slipSummary) slipSummary.style.display = 'none';
    return;
  }

  const totalOdds = items.reduce((acc, s) => acc * s.odds, 1);
  const stake = parseFloat(document.getElementById('builder-stake')?.value || 10);
  const gain = (stake * totalOdds).toFixed(2);

  slipItemsEl.innerHTML = items.map(s => {
    const match = allMatches.find(m => m.id === s.matchId);
    return `
      <div class="slip-item">
        <div class="slip-item-info">
          <span class="slip-match">${match ? `${escapeHtml(match.home_team)} vs ${escapeHtml(match.away_team)}` : 'Match'}</span>
          <span class="slip-market-tag">${s.market}</span>
          <span class="slip-selection">${escapeHtml(s.selection)}</span>
        </div>
        <div class="slip-item-right">
          <span class="slip-item-odds">${s.odds.toFixed(2)}</span>
          <button class="slip-remove" onclick="removeBuilderSelection(${s.matchId})">✕</button>
        </div>
      </div>
    `;
  }).join('');

  if (slipSummary) slipSummary.style.display = 'block';
  if (slipOddsEl) slipOddsEl.textContent = totalOdds.toFixed(2);
  if (slipGainEl) slipGainEl.textContent = `${gain}€`;
}

async function saveManualCombined() {
  const items = Object.values(builderSelections);
  if (items.length === 0) { showToast('Ajoutez au moins un match', 'warning'); return; }

  const name = document.getElementById('combined-name-input')?.value || `Mon Combiné (${new Date().toLocaleDateString('fr-FR')})`;
  const stake = parseFloat(document.getElementById('builder-stake')?.value || 10);
  const totalOdds = items.reduce((acc, s) => acc * s.odds, 1);

  const selections = items.map(s => {
    const match = allMatches.find(m => m.id === s.matchId);
    return {
      match_id: s.matchId,
      home_team: match?.home_team || '?',
      away_team: match?.away_team || '?',
      competition: match?.competition || '?',
      match_date: match?.match_date,
      match_time: match?.match_time,
      market: s.market,
      selection: s.selection,
      odds: s.odds,
      confidence: match?.ai_confidence || '—',
      rationale: 'Sélection manuelle',
    };
  });

  try {
    const res = await fetch(`${API}/combineds/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, strategy: 'custom', stake, selections, totalOdds, potentialGain: stake * totalOdds }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(`✅ Combiné "${name}" sauvegardé !`, 'success');
      builderSelections = {};
      await loadCombinedHistory();
      renderBuilderMatchList();
      updateBuilderSlip();
    } else {
      showToast(`❌ Erreur: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast('❌ Erreur de connexion', 'error');
  }
}

// ============================================================
// AI GENERATION
// ============================================================
function setCombinedStrategy(strategy) {
  combinedState.strategy = strategy;
  document.querySelectorAll('.strategy-card').forEach(c => {
    c.classList.toggle('active', c.getAttribute('onclick')?.includes(strategy));
  });
}

function setCombinedRisk(level) {
  combinedState.riskLevel = level;
  document.querySelectorAll('.risk-pill').forEach(p => {
    p.classList.toggle('active', p.getAttribute('onclick')?.includes(level));
  });
}

function setStake(value) {
  combinedState.stake = Math.max(1, parseFloat(value) || 10);
  const input = document.getElementById('stake-input');
  if (input) input.value = combinedState.stake;
  document.querySelectorAll('.stake-preset').forEach(p => {
    p.classList.toggle('active', parseInt(p.textContent) === combinedState.stake);
  });
}

function adjustStake(delta) {
  setStake(combinedState.stake + delta);
}

function setTargetOddsRange(range) {
  combinedState.targetOddsRange = range;
  document.querySelectorAll('.target-odds-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.range === range);
  });
}

function setPreferredMarkets(market) {
  combinedState.preferredMarkets = market;
  document.querySelectorAll('.market-filter-pill').forEach(p => {
    p.classList.toggle('active', p.dataset.market === market);
  });
}

function toggleCashoutOptimized() {
  combinedState.cashoutOptimized = !combinedState.cashoutOptimized;
  const card = document.getElementById('cashout-toggle-card');
  if (card) {
    card.classList.toggle('active', combinedState.cashoutOptimized);
    const sw = card.querySelector('.toggle-switch');
    if (sw) sw.classList.toggle('on', combinedState.cashoutOptimized);
  }
}

async function triggerGenerateCombined() {
  if (combinedState.isGenerating) return;

  const btn = document.getElementById('btn-generate');
  const btnText = document.getElementById('generate-btn-text');
  const resultArea = document.getElementById('combined-result-area');

  combinedState.isGenerating = true;
  if (btn) btn.disabled = true;
  if (btnText) btnText.textContent = 'Génération en cours...';

  // Show loading
  if (resultArea) {
    resultArea.innerHTML = `
      <div class="combined-loading">
        <div class="combined-loading-brain">🤖</div>
        <div class="combined-loading-title">L'IA construit votre combiné expert...</div>
        <div class="combined-loading-steps">
          <div class="cstep active">📊 Filtrage des pièges & xG...</div>
          <div class="cstep">🎯 Calcul mathématique de l'Edge EV+...</div>
          <div class="cstep">⚡ Optimisation chronologique & Cashout...</div>
          <div class="cstep">🛡️ Calcul de la garantie Système N-1...</div>
        </div>
        <div class="ai-loader-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;

    // Animate steps
    const steps = resultArea.querySelectorAll('.cstep');
    let stepIdx = 0;
    const stepInterval = setInterval(() => {
      if (stepIdx > 0 && steps[stepIdx - 1]) steps[stepIdx - 1].classList.replace('active', 'done');
      if (stepIdx < steps.length && steps[stepIdx]) { steps[stepIdx].classList.add('active'); stepIdx++; }
    }, 1500);

    try {
      const res = await fetch(`${API}/combineds/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategy: combinedState.strategy,
          riskLevel: combinedState.riskLevel,
          stake: combinedState.stake,
          targetOddsRange: combinedState.targetOddsRange !== 'all' ? combinedState.targetOddsRange : null,
          preferredMarkets: combinedState.preferredMarkets,
          cashoutOptimized: combinedState.cashoutOptimized,
        }),
      });
      clearInterval(stepInterval);

      const data = await res.json();
      if (data.success) {
        combinedState.currentResult = data.data;
        renderCombinedResult(data.data, resultArea);
        await loadCombinedStats();
        await loadCombinedHistory();
        showToast(`✅ Combiné "${data.data.name}" généré !`, 'success');
      } else {
        resultArea.innerHTML = `
          <div class="result-error">
            <span>❌</span>
            <h3>Erreur de génération</h3>
            <p>${data.error}</p>
            <small>Assurez-vous d'avoir des matchs analysés (onglet Matchs → Analyser avec l'IA)</small>
          </div>
        `;
        showToast(`❌ ${data.error}`, 'error');
      }
    } catch (err) {
      clearInterval(stepInterval);
      resultArea.innerHTML = `<div class="result-error"><span>❌</span><h3>Erreur de connexion</h3><p>${err.message}</p></div>`;
      showToast('❌ Erreur de connexion', 'error');
    }
  }

  combinedState.isGenerating = false;
  if (btn) btn.disabled = false;
  if (btnText) btnText.textContent = 'Générer le Combiné IA';
}

function renderCombinedResult(combined, container) {
  const riskColor = { low: 'var(--accent-green)', medium: 'var(--accent-gold)', high: 'var(--accent-red)' }[combined.risk_level] || 'var(--accent-blue)';
  const strategyIcon = { safe: '🛡️', balanced: '⚖️', aggressive: '🚀' }[combined.strategy_used] || '⚡';
  const selections = combined.selections || [];
  const n = selections.length;

  container.innerHTML = `
    <div class="combined-result-card">
      <!-- Result Header -->
      <div class="result-header">
        <div class="result-title-row">
          <span class="result-strategy-icon">${strategyIcon}</span>
          <h2 class="result-name">${escapeHtml(combined.name)}</h2>
          <span class="result-conf-badge">${combined.confidence_score || '—'}</span>
        </div>
        <p class="result-rationale">${escapeHtml(combined.rationale)}</p>
      </div>

      <!-- EV+ Banner -->
      ${combined.ev_metrics ? `
        <div class="result-ev-banner ${combined.ev_metrics.is_ev_positive ? 'ev-positive' : 'ev-neutral'}">
          <div class="ev-banner-icon">${combined.ev_metrics.is_ev_positive ? '💎' : '⚖️'}</div>
          <div class="ev-banner-content">
            <div class="ev-banner-title">
              Espérance Mathématique (EV+) : <strong>${combined.ev_metrics.expected_value_percent}</strong>
              <span class="ev-edge-badge">${escapeHtml(combined.ev_metrics.edge_rating)}</span>
            </div>
            <div class="ev-banner-sub">
              Cote juste estimée : <strong>${combined.ev_metrics.fair_odds}</strong> (Bookmaker : ${combined.total_odds?.toFixed(2)}) • 
              Probabilité réelle : <strong>${combined.ev_metrics.real_probability}</strong> vs Implicite : <strong>${combined.ev_metrics.implied_probability}</strong>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Key Metrics -->
      <div class="result-metrics">
        <div class="result-metric">
          <span class="rm-label">Cote Totale</span>
          <span class="rm-value odds-value">${combined.total_odds?.toFixed(2) || '—'}</span>
        </div>
        <div class="result-metric">
          <span class="rm-label">Mise</span>
          <span class="rm-value">${combinedState.stake}€</span>
        </div>
        <div class="result-metric gain-metric">
          <span class="rm-label">Gain Potentiel</span>
          <span class="rm-value gain-value">${combined.potential_gain?.toFixed(2) || '—'}€</span>
        </div>
        <div class="result-metric">
          <span class="rm-label">Nb Sélections</span>
          <span class="rm-value">${selections.length}</span>
        </div>
      </div>

      <!-- Selections -->
      <div class="result-selections">
        <h3 class="selections-title">🎯 Sélections (Ordonnées Chronologiquement)</h3>
        ${selections.map((sel, i) => {
          const isLast = (i === n - 1 && n > 1);
          return `
            <div class="result-selection-row ${sel.is_value_bet ? 'is-value-bet' : ''} ${sel.risk_level === 'faible' ? '' : sel.risk_level === 'modéré' ? 'sel-risk-medium' : 'sel-risk-high'} ${isLast ? 'sel-anchor-match' : ''}">
              <div class="sel-number">${i + 1}</div>
              <div class="sel-body">
                <div class="sel-match">
                  ${escapeHtml(sel.home_team)} vs ${escapeHtml(sel.away_team)}
                  ${isLast ? `<span class="anchor-badge" title="Dernier match échelonné : clé du Cashout">🔒 Match Clôture</span>` : ''}
                </div>
                <div class="sel-meta">
                  <span class="sel-comp">${escapeHtml(sel.competition || '')}</span>
                  <span class="sel-date">⏱️ ${sel.match_date ? formatMatchDate(sel.match_date) : ''} ${sel.match_time || ''}</span>
                </div>
                <div class="sel-market-row">
                  <span class="sel-market-tag">${escapeHtml(sel.market || '')}</span>
                  <span class="sel-selection-text">${escapeHtml(sel.selection || '')}</span>
                  ${sel.is_value_bet ? `<span class="sel-value-badge">💎 VALUE ${sel.value_edge || ''}</span>` : ''}
                </div>
                ${sel.rationale ? `<div class="sel-rationale">${escapeHtml(sel.rationale)}</div>` : ''}
                ${sel.risk_level && sel.risk_level !== 'faible' ? `<div class="sel-risk-row"><span class="sel-risk-chip ${sel.risk_level === 'modéré' ? 'chip-warn' : 'chip-danger'}">Risque: ${escapeHtml(sel.risk_level)}</span></div>` : ''}
              </div>
              <div class="sel-right">
                <div class="sel-odds">${typeof sel.odds === 'number' ? sel.odds.toFixed(2) : sel.odds}</div>
                <div class="sel-conf">${sel.confidence || ''}</div>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <!-- Cashout & Séquençage Horaire -->
      ${combined.cashout_strategy ? `
        <div class="result-cashout-box">
          <div class="rc-header">
            <span class="rc-icon">⏱️</span>
            <div>
              <div class="rc-title">Séquençage Chronologique & Stratégie Cashout</div>
              <div class="rc-timeline">${escapeHtml(combined.cashout_strategy.timeline_summary)}</div>
            </div>
          </div>
          <p class="rc-advice">${escapeHtml(combined.cashout_strategy.hedging_advice)}</p>
          ${combined.cashout_strategy.is_staggered ? `
            <div class="rc-hedge-grid">
              <div class="rc-hedge-card">
                <span class="rh-label">Match de Clôture (Dernier match)</span>
                <span class="rh-val">${escapeHtml(combined.cashout_strategy.anchor_match)}</span>
              </div>
              <div class="rc-hedge-card">
                <span class="rh-label">Cote cumulée avant ce match</span>
                <span class="rh-val">${combined.cashout_strategy.odds_before_anchor}</span>
              </div>
              <div class="rc-hedge-card highlight">
                <span class="rh-label">Gain net garanti estimé (Hedging)</span>
                <span class="rh-val">+${combined.cashout_strategy.suggested_hedge?.guaranteed_net_est}€</span>
              </div>
            </div>
          ` : ''}
        </div>
      ` : ''}

      <!-- Mode Système Garanti N-1 -->
      ${combined.system_bet ? `
        <div class="result-system-box">
          <div class="rs-header">
            <span class="rs-icon">🛡️</span>
            <div>
              <div class="rs-title">Formule Réductrice : ${escapeHtml(combined.system_bet.system_name)} (Gagner même avec 1 Faute)</div>
              <div class="rs-sub">${escapeHtml(combined.system_bet.description)}</div>
            </div>
          </div>
          <div class="rs-metrics">
            <div class="rs-metric">
              <span class="rsm-label">Mise par combinaison</span>
              <span class="rsm-val">${combined.system_bet.stake_per_bet}€ (${combined.system_bet.sub_bets_count} tickets)</span>
            </div>
            <div class="rs-metric ${combined.system_bet.profitable_on_one_error ? 'profitable' : ''}">
              <span class="rsm-label">Gain garanti si 1 faute</span>
              <span class="rsm-val">${combined.system_bet.min_gain_on_one_error}€ à ${combined.system_bet.max_gain_on_one_error}€</span>
            </div>
            <div class="rs-metric highlight">
              <span class="rsm-label">Gain si sans faute (100%)</span>
              <span class="rsm-val">${combined.system_bet.payout_if_all_win}€</span>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- Risk Assessment -->
      ${combined.risk_assessment ? `
        <div class="result-risk-box">
          <span class="risk-box-icon">⚠️</span>
          <div class="risk-box-text">
            <strong>Évaluation des risques & Sécurité</strong>
            <p>${escapeHtml(combined.risk_assessment)}</p>
          </div>
        </div>
      ` : ''}

      <!-- Actions -->
      <div class="result-actions">
        <button class="btn-copy-ticket" onclick="copyCombinedTicket(combinedState.currentResult)">📋 Copier le ticket</button>
        <button class="btn-bankroll-bet" onclick="saveCombinedToBankroll(combinedState.currentResult)">💰 Enregistrer dans la Bankroll</button>
        <button class="btn-regen" onclick="triggerGenerateCombined()">🔄 Regénérer</button>
        <button class="btn-view-history" onclick="switchCombinedTab('history')">📋 Mes combinés</button>
      </div>
    </div>
  `;
}

// ============================================================
// HISTORY
// ============================================================
async function loadCombinedHistory() {
  try {
    const res = await fetch(`${API}/combineds`);
    const data = await res.json();
    if (data.success) combinedState.savedCombineds = data.data;
  } catch (_) {}
}

function renderCombinedHistory() {
  const container = document.getElementById('combined-history-list');
  if (!container) return;

  if (combinedState.savedCombineds.length === 0) {
    container.innerHTML = `<div class="combined-empty"><span>📋</span><p>Aucun combiné sauvegardé. Générez-en un depuis l'onglet IA !</p></div>`;
    return;
  }

  container.innerHTML = `
    <div class="history-grid">
      ${combinedState.savedCombineds.map(c => {
        let selections = Array.isArray(c.selections) ? c.selections : [];
        if (typeof c.selections === 'string') {
          try { selections = JSON.parse(c.selections || '[]'); } catch (_) {}
        }
        const strategyIcon = { safe: '🛡️', balanced: '⚖️', aggressive: '🚀', custom: '🛠️' }[c.strategy] || '⚡';
        const riskClass = { low: 'risk-low', medium: 'risk-medium', high: 'risk-high' }[c.risk_level] || 'risk-medium';

        return `
          <div class="history-card">
            <div class="history-card-header">
              <span class="h-strategy-icon">${strategyIcon}</span>
              <div class="h-title-area">
                <h3 class="h-name">${escapeHtml(c.name)}</h3>
                <span class="h-date">${new Date(c.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <button class="h-delete" onclick="deleteCombined(${c.id})" title="Supprimer">🗑️</button>
            </div>

            <div class="h-metrics">
              <div class="h-metric">
                <span>Cote</span>
                <strong class="h-odds">${c.total_odds?.toFixed(2) || '—'}</strong>
              </div>
              <div class="h-metric">
                <span>Mise</span>
                <strong>${c.stake}€</strong>
              </div>
              <div class="h-metric gain-metric">
                <span>Gain potentiel</span>
                <strong class="h-gain">${c.potential_gain?.toFixed(2) || '—'}€</strong>
              </div>
              <div class="h-metric">
                <span class="badge ${riskClass}">${c.risk_level}</span>
              </div>
            </div>

            ${c.ev_metrics ? `
              <div class="h-ev-badge">
                <span>💎 EV+ ${c.ev_metrics.expected_value_percent}</span>
                <small>Cote juste: ${c.ev_metrics.fair_odds}</small>
              </div>
            ` : ''}

            ${c.ai_rationale ? `<p class="h-rationale">${escapeHtml(c.ai_rationale)}</p>` : ''}

            <div class="h-selections">
              ${selections.slice(0, 3).map(s => `
                <div class="h-sel-row">
                  <span class="h-sel-match">${escapeHtml(s.home_team || '?')} vs ${escapeHtml(s.away_team || '?')}</span>
                  <span class="h-sel-market">${escapeHtml(s.market || '')}</span>
                  <span class="h-sel-odds">${typeof s.odds === 'number' ? s.odds.toFixed(2) : (s.odds || '—')}</span>
                </div>
              `).join('')}
              ${selections.length > 3 ? `<div class="h-more">+${selections.length - 3} sélections</div>` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

async function deleteCombined(id) {
  try {
    const res = await fetch(`${API}/combineds/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('🗑️ Combiné supprimé', 'info');
      await loadCombinedHistory();
      renderCombinedHistory();
      loadCombinedStats();
    }
  } catch (_) {
    showToast('Erreur de suppression', 'error');
  }
}

// ============================================================
// STATS
// ============================================================
async function loadCombinedStats() {
  try {
    const res = await fetch(`${API}/stats`);
    const data = await res.json();
    if (data.success) {
      const analyzedEl = document.getElementById('cstat-analyzed');
      const combinedsEl = document.getElementById('cstat-combineds');
      if (analyzedEl) analyzedEl.textContent = data.data.analyzedMatches || '0';
      if (combinedsEl) combinedsEl.textContent = data.data.totalCombineds || '0';

      // Also update the hint
      const hintEl = document.getElementById('analyzed-hint');
      if (hintEl) {
        const count = data.data.analyzedMatches || 0;
        hintEl.innerHTML = count > 0
          ? `<span class="hint-count">${count} matchs analysés</span> disponibles pour la génération`
          : `<span class="hint-warn">⚠️ Aucun match analysé — allez dans l'onglet Matchs et lancez des analyses IA</span>`;
      }
    }
  } catch (_) {}
}

function copyCombinedTicket(combined) {
  if (!combined) return;
  const selections = combined.selections || [];
  const lines = [
    `🎯 TICKET COMBINÉ BETCLIC AI`,
    `⚡ ${combined.name || 'Combiné IA'}`,
    `🏆 Cote Totale : ${typeof combined.total_odds === 'number' ? combined.total_odds.toFixed(2) : combined.total_odds}`,
    `💰 Mise : ${combinedState.stake || combined.stake || 10}€ ➔ Gain potentiel : ${combined.potential_gain?.toFixed(2) || ((combinedState.stake || 10) * combined.total_odds).toFixed(2)}€`,
    `--------------------------------`,
    ...selections.map((s, idx) => `${idx + 1}. ${s.home_team} vs ${s.away_team} : ${s.selection} (${s.market || '1N2'}) @ ${s.odds}`),
    `--------------------------------`,
    combined.rationale || combined.ai_rationale ? `🧠 Analyse IA : ${combined.rationale || combined.ai_rationale}` : ''
  ].filter(Boolean);

  const text = lines.join('\n');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast('📋 Ticket copié dans le presse-papier !', 'success');
    }).catch(() => fallbackCopyText(text));
  } else {
    fallbackCopyText(text);
  }
}

function fallbackCopyText(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    showToast('📋 Ticket copié dans le presse-papier !', 'success');
  } catch (_) {
    showToast('Erreur copie presse-papier', 'error');
  }
  document.body.removeChild(textarea);
}

function saveCombinedToBankroll(combined) {
  if (!combined) return;
  const totalOdds = typeof combined.total_odds === 'number' ? parseFloat(combined.total_odds.toFixed(2)) : parseFloat(combined.total_odds);
  const stake = combinedState.stake || combined.stake || 10;
  const selections = Array.isArray(combined.selections) ? combined.selections : [];
  const selSummary = selections.map(s => `${(s.home_team || '').split(' ')[0]} vs ${(s.away_team || '').split(' ')[0]}: ${s.selection} @${s.odds}`).join(' | ');

  if (typeof openAddBetModal === 'function') {
    openAddBetModal({
      title: combined.name || `Combiné IA (${selections.length} sélections)`,
      selection: selSummary || 'Sélections combinées',
      market: 'Combiné',
      odds: totalOdds,
      stake: stake,
      bet_type: 'combined',
      notes: combined.rationale || combined.ai_rationale || `Combiné ${combined.strategy_used || ''}`
    });
  } else {
    showToast('Module bankroll en chargement...', 'info');
  }
}

