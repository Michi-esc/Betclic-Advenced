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

  if (tab === 'builder') renderBuilderSectionContent();
  if (tab === 'system') renderSystemSectionContent();
  if (tab === 'hedging') renderHedgingSectionContent();
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
        <h1 class="combined-hero-title">Combinés <span class="gradient-text">IA & Systèmes</span></h1>
        <p class="combined-hero-sub">L'intelligence artificielle analyse vos matchs, crée vos combinés optimaux, calcule les paris système et simule votre Cashout / Couverture</p>
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
        <span>⚡</span> Créateur de Combinés & Paris
      </button>
      <button class="combined-tab" data-tab="system" onclick="switchCombinedTab('system')">
        <span>🛡️</span> Paris Système (2/3, 3/4, Yankee...)
      </button>
      <button class="combined-tab" data-tab="hedging" onclick="switchCombinedTab('hedging')">
        <span>⚖️</span> Simulateur Cashout & Couverture
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
    <div class="combined-section hidden" data-section="builder" id="builder-section-container">
      ${renderBuilderSection()}
    </div>

    <!-- ===== SECTION: SYSTEM BETS ===== -->
    <div class="combined-section hidden" data-section="system" id="system-section-container">
      ${renderSystemSection()}
    </div>

    <!-- ===== SECTION: HEDGING & CASHOUT SIMULATOR ===== -->
    <div class="combined-section hidden" data-section="hedging" id="hedging-section-container">
      ${renderHedgingSection()}
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
// SECTION: REFONTE CRÉATEUR DE COMBINÉS & LISTES DE PARIS
// ============================================================

let builderState = {
  riskFilter: 'all',             // 'all' | 'safe' | 'balanced' | 'moderate'
  sortBy: 'success_desc',        // 'success_desc' | 'success_asc' | 'odds_asc' | 'odds_desc' | 'date_asc' | 'ev_desc'
  selectedCompetitions: [],      // [] means all, or array of strings
  searchQuery: '',
  activeView: 'matches',         // 'matches' | 'catalog'
  activeMatchTab: {},            // { [matchId]: 'result' | 'goals' | 'security' | 'specials' }
  stake: 10,
  selections: {},                // { [betId]: betObject } (supporte plusieurs sélections sur le même match / MyBet)
};

// Global alias for compatibility
let builderSelections = builderState.selections;

function renderBuilderSection() {
  return `<div id="builder-section-inner" class="builder-section-inner"></div>`;
}

function renderBuilderSectionContent() {
  const container = document.getElementById('builder-section-inner');
  if (!container) return;

  const analyzed = allMatches.filter(m => m.ai_prediction);
  if (analyzed.length === 0) {
    container.innerHTML = `
      <div class="combined-empty">
        <span style="font-size:3rem">🔍</span>
        <h3>Aucun match analysé disponible</h3>
        <p>Veuillez vous rendre dans l'onglet <strong>Matchs</strong> et lancer des analyses IA pour pouvoir construire vos combinés.</p>
        <button class="btn btn-primary" onclick="switchPage('matches')">Aller aux Matchs</button>
      </div>
    `;
    return;
  }

  // Extract all unique competitions with counts
  const compCounts = {};
  analyzed.forEach(m => {
    const comp = m.competition || 'Autre';
    compCounts[comp] = (compCounts[comp] || 0) + 1;
  });
  const allComps = Object.keys(compCounts).sort();

  // Filter matches based on competition and search query
  let filteredMatches = analyzed.filter(m => {
    if (builderState.selectedCompetitions.length > 0 && !builderState.selectedCompetitions.includes(m.competition)) {
      return false;
    }
    if (builderState.searchQuery) {
      const q = builderState.searchQuery.toLowerCase();
      const matchText = `${m.home_team} ${m.away_team} ${m.competition}`.toLowerCase();
      if (!matchText.includes(q)) return false;
    }
    return true;
  });

  // Generate catalog of bets for each filtered match
  const matchCatalogs = filteredMatches.map(m => ({
    match: m,
    bets: generateAllBetsForMatch(m),
  }));

  // Filter bets inside catalogs according to risk profile if selected
  const filteredCatalogs = matchCatalogs.map(item => {
    let bets = item.bets;
    if (builderState.riskFilter !== 'all') {
      bets = bets.filter(b => b.riskProfile === builderState.riskFilter);
    }
    return { match: item.match, bets };
  });

  // Sort matches or bets
  sortCatalogs(filteredCatalogs);

  // Render HTML structure
  container.innerHTML = `
    <!-- Top Hero / Control Header -->
    <div class="builder-hero-panel">
      <div class="bhp-top">
        <div class="bhp-info">
          <h2 class="bhp-title">⚡ Créateur de Combinés & Listes de Paris</h2>
          <p class="bhp-sub">Filtrez vos paris par profil de risque (Sécurisé, Équilibré, Modéré), triez par chance de réussite et explorez tous les marchés par match.</p>
        </div>
        <div class="bhp-actions">
          <button class="btn-builder-magic" onclick="autoFillTopBets()" title="Ajoute automatiquement les 4 meilleurs paris selon vos filtres actuels">
            <span>⚡</span> Remplir Automatiquement (Top 4)
          </button>
        </div>
      </div>

      <!-- 1. SÉLECTEUR DE COMPÉTITIONS -->
      <div class="builder-filter-block">
        <div class="bfb-header">
          <span class="bfb-label">🏆 Compétitions</span>
          <span class="bfb-sub">${builderState.selectedCompetitions.length === 0 ? 'Toutes sélectionnées' : `${builderState.selectedCompetitions.length} sélectionnée(s)`}</span>
        </div>
        <div class="comp-pills-bar">
          <button class="comp-pill ${builderState.selectedCompetitions.length === 0 ? 'active' : ''}" onclick="toggleCompetitionFilter(null)">
            <span>🌟</span> Toutes (${analyzed.length})
          </button>
          ${allComps.map(comp => {
            const isSel = builderState.selectedCompetitions.includes(comp);
            return `
              <button class="comp-pill ${isSel ? 'active' : ''}" onclick="toggleCompetitionFilter('${escapeHtml(comp)}')">
                <span>${getCompetitionFlag(comp)}</span>
                <span>${escapeHtml(comp)}</span>
                <span class="comp-pill-count">${compCounts[comp]}</span>
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- 2. PROFILS DE RISQUE (Sécurisé / Équilibré / Modéré) -->
      <div class="builder-filter-block">
        <div class="bfb-header">
          <span class="bfb-label">🛡️ Profil de Risque des Paris</span>
          <span class="bfb-sub">Filtrez les sélections selon votre appétence au risque</span>
        </div>
        <div class="risk-filter-tabs">
          <button class="rft-tab ${builderState.riskFilter === 'all' ? 'active' : ''}" onclick="setBuilderRiskFilter('all')">
            <span class="rft-icon">🌟</span>
            <div class="rft-text">
              <span class="rft-name">Tous les paris</span>
              <span class="rft-desc">Toutes les cotes & opportunités</span>
            </div>
          </button>
          <button class="rft-tab safe-tab ${builderState.riskFilter === 'safe' ? 'active' : ''}" onclick="setBuilderRiskFilter('safe')">
            <span class="rft-icon">🟢</span>
            <div class="rft-text">
              <span class="rft-name">Sécurisé</span>
              <span class="rft-desc">≥ 70% de chance • Cotes 1.15 à 1.48</span>
            </div>
          </button>
          <button class="rft-tab balanced-tab ${builderState.riskFilter === 'balanced' ? 'active' : ''}" onclick="setBuilderRiskFilter('balanced')">
            <span class="rft-icon">🟡</span>
            <div class="rft-text">
              <span class="rft-name">Équilibré</span>
              <span class="rft-desc">55% à 70% de chance • Cotes 1.48 à 2.05</span>
            </div>
          </button>
          <button class="rft-tab moderate-tab ${builderState.riskFilter === 'moderate' ? 'active' : ''}" onclick="setBuilderRiskFilter('moderate')">
            <span class="rft-icon">🟠</span>
            <div class="rft-text">
              <span class="rft-name">Modéré / Audacieux</span>
              <span class="rft-desc">40% à 55% de chance • Cotes 2.05 à 3.50+</span>
            </div>
          </button>
        </div>
      </div>

      <!-- 3. BARRE DE CONTRÔLE (Tri, Vue, Recherche) -->
      <div class="builder-toolbar">
        <div class="toolbar-left">
          <div class="toolbar-group">
            <label class="toolbar-label">🎯 Trier par</label>
            <div class="sort-action-row">
              <select class="toolbar-select" id="builder-sort-select" onchange="setBuilderSort(this.value)">
                <option value="date_asc" ${builderState.sortBy === 'date_asc' ? 'selected' : ''}>⏰ Chronologique (Plus proches d'abord)</option>
                <option value="date_desc" ${builderState.sortBy === 'date_desc' ? 'selected' : ''}>🕒 Chronologique (Plus lointains d'abord)</option>
                <option value="success_desc" ${builderState.sortBy === 'success_desc' ? 'selected' : ''}>🎯 Chance de réussite (Décroissante : 90% → 40%)</option>
                <option value="success_asc" ${builderState.sortBy === 'success_asc' ? 'selected' : ''}>📉 Chance de réussite (Croissante : 40% → 90%)</option>
                <option value="odds_asc" ${builderState.sortBy === 'odds_asc' ? 'selected' : ''}>📈 Cotes les plus basses (1.15 → 3.50)</option>
                <option value="odds_desc" ${builderState.sortBy === 'odds_desc' ? 'selected' : ''}>💰 Cotes les plus hautes (3.50 → 1.15)</option>
                <option value="ev_desc" ${builderState.sortBy === 'ev_desc' ? 'selected' : ''}>💎 Meilleure Valeur (Value Bet EV+)</option>
              </select>
              <button class="btn-builder-chrono ${builderState.sortBy.startsWith('date') ? 'active' : ''}" onclick="toggleBuilderChronoSort()" title="Basculer le tri chronologique par date et heure">
                <span>⏰</span> <span>Chronologique</span>
              </button>
            </div>
          </div>

          <div class="toolbar-group">
            <label class="toolbar-label">👁️ Affichage</label>
            <div class="view-mode-toggle">
              <button class="vmt-btn ${builderState.activeView === 'matches' ? 'active' : ''}" onclick="setBuilderView('matches')" title="Afficher les matchs avec leurs onglets de marchés">
                🏟️ Par Matchs
              </button>
              <button class="vmt-btn ${builderState.activeView === 'catalog' ? 'active' : ''}" onclick="setBuilderView('catalog')" title="Afficher la liste directe de tous les paris triés">
                📑 Catalogue Direct
              </button>
            </div>
          </div>
        </div>

        <div class="toolbar-right">
          <div class="search-box-wrap">
            <span class="sb-icon">🔍</span>
            <input type="text" class="sb-input" placeholder="Filtrer une équipe..." value="${escapeHtml(builderState.searchQuery)}" oninput="setBuilderSearch(this.value)" />
          </div>
        </div>
      </div>
    </div>

    <!-- MAIN GRID: FEED ON LEFT, SLIP ON RIGHT -->
    <div class="builder-main-grid">
      <div class="builder-feed-col">
        ${builderState.activeView === 'matches' 
          ? renderMatchesWithTabs(filteredCatalogs)
          : renderDirectCatalog(filteredCatalogs)}
      </div>

      <div class="builder-slip-col">
        ${renderBuilderSlipHtml()}
      </div>
    </div>
  `;

  // Attach slip events
  updateSlipMetricsUi();
}

// ============================================================
// MARKET BETS GENERATOR PER MATCH
// ============================================================
function generateAllBetsForMatch(m) {
  let raw = {};
  try { raw = JSON.parse(m.raw_research || '{}'); } catch (_) {}
  let xg = {};
  try { xg = JSON.parse(m.xg_metrics || '{}'); } catch (_) {}

  const homeTeam = m.home_team || 'Domicile';
  const awayTeam = m.away_team || 'Extérieur';
  const oddsHome = Number(m.odds_home) || 2.00;
  const oddsDraw = Number(m.odds_draw) || 3.30;
  const oddsAway = Number(m.odds_away) || 3.50;

  // Implied & AI probabilities
  const aiConfHome = (m.ai_prediction && m.ai_prediction.includes(homeTeam)) ? (parseInt(m.ai_confidence) || 68) : null;
  const aiConfAway = (m.ai_prediction && m.ai_prediction.includes(awayTeam)) ? (parseInt(m.ai_confidence) || 62) : null;

  const probHome = aiConfHome || Math.min(88, Math.max(12, Math.round((1 / oddsHome) * 88)));
  const probAway = aiConfAway || Math.min(88, Math.max(12, Math.round((1 / oddsAway) * 88)));
  const probDraw = Math.min(45, Math.max(15, Math.round((1 / oddsDraw) * 85)));

  // Double chance odds
  const odds1X = Math.max(1.05, parseFloat(((oddsHome * oddsDraw) / (oddsHome + oddsDraw)).toFixed(2)) || 1.22);
  const oddsX2 = Math.max(1.05, parseFloat(((oddsAway * oddsDraw) / (oddsAway + oddsDraw)).toFixed(2)) || 1.30);
  const odds12 = Math.max(1.05, parseFloat(((oddsHome * oddsAway) / (oddsHome + oddsAway)).toFixed(2)) || 1.25);

  const prob1X = Math.min(94, Math.round(probHome + probDraw * 0.75));
  const probX2 = Math.min(94, Math.round(probAway + probDraw * 0.75));
  const prob12 = Math.min(94, Math.round(probHome + probAway * 0.85));

  const bets = [];

  function classifyRisk(prob, odds) {
    if (prob >= 70 || odds <= 1.48) return { profile: 'safe', label: 'Sécurisé' };
    if (prob >= 54 && odds <= 2.05) return { profile: 'balanced', label: 'Équilibré' };
    return { profile: 'moderate', label: 'Modéré' };
  }

  // 1. ONGLET 1N2 & DOUBLE CHANCE
  const rHome = classifyRisk(probHome, oddsHome);
  bets.push({
    id: `m-${m.id}-1n2-1`,
    matchId: m.id,
    match: m,
    marketGroup: 'result',
    market: '1N2',
    selection: `🏠 Victoire ${homeTeam}`,
    odds: oddsHome,
    probability: probHome,
    riskProfile: rHome.profile,
    riskLabel: rHome.label,
    isRecommended: m.ai_prediction && m.ai_prediction.includes(homeTeam),
    rationale: `Forme domicile et avantage terrain pour ${homeTeam}`
  });

  const rDraw = classifyRisk(probDraw, oddsDraw);
  bets.push({
    id: `m-${m.id}-1n2-N`,
    matchId: m.id,
    match: m,
    marketGroup: 'result',
    market: '1N2',
    selection: `🤝 Match Nul`,
    odds: oddsDraw,
    probability: probDraw,
    riskProfile: rDraw.profile,
    riskLabel: rDraw.label,
    isRecommended: m.ai_prediction && m.ai_prediction.toLowerCase().includes('nul'),
    rationale: 'Deux équipes équilibrées avec tendance au partage des points'
  });

  const rAway = classifyRisk(probAway, oddsAway);
  bets.push({
    id: `m-${m.id}-1n2-2`,
    matchId: m.id,
    match: m,
    marketGroup: 'result',
    market: '1N2',
    selection: `✈️ Victoire ${awayTeam}`,
    odds: oddsAway,
    probability: probAway,
    riskProfile: rAway.profile,
    riskLabel: rAway.label,
    isRecommended: m.ai_prediction && m.ai_prediction.includes(awayTeam),
    rationale: `Avantage dynamique pour ${awayTeam}`
  });

  const r1X = classifyRisk(prob1X, odds1X);
  bets.push({
    id: `m-${m.id}-dc-1x`,
    matchId: m.id,
    match: m,
    marketGroup: 'result',
    market: 'Double Chance',
    selection: `🛡️ 1X (${homeTeam} ou Nul)`,
    odds: odds1X,
    probability: prob1X,
    riskProfile: r1X.profile,
    riskLabel: r1X.label,
    isRecommended: m.double_chance_prediction === '1X' || (m.ai_prediction && m.ai_prediction.includes(homeTeam)),
    rationale: `${homeTeam} invaincu ou sécurisé par le nul`
  });

  const rX2 = classifyRisk(probX2, oddsX2);
  bets.push({
    id: `m-${m.id}-dc-x2`,
    matchId: m.id,
    match: m,
    marketGroup: 'result',
    market: 'Double Chance',
    selection: `🛡️ X2 (Nul ou ${awayTeam})`,
    odds: oddsX2,
    probability: probX2,
    riskProfile: rX2.profile,
    riskLabel: rX2.label,
    isRecommended: m.double_chance_prediction === 'X2' || (m.ai_prediction && m.ai_prediction.includes(awayTeam)),
    rationale: `${awayTeam} évite la défaite`
  });

  const r12 = classifyRisk(prob12, odds12);
  bets.push({
    id: `m-${m.id}-dc-12`,
    matchId: m.id,
    match: m,
    marketGroup: 'result',
    market: 'Double Chance',
    selection: `⚡ 12 (Pas de Match Nul)`,
    odds: odds12,
    probability: prob12,
    riskProfile: r12.profile,
    riskLabel: r12.label,
    isRecommended: false,
    rationale: 'Match ouvert sans compromis'
  });

  // 2. ONGLET BUTS & OVER/UNDER
  // Over 1.5
  bets.push({
    id: `m-${m.id}-goals-o15`,
    matchId: m.id,
    match: m,
    marketGroup: 'goals',
    market: 'Total Buts',
    selection: `⚽ Plus de 1.5 Buts`,
    odds: 1.22,
    probability: 82,
    riskProfile: 'safe',
    riskLabel: 'Sécurisé',
    isRecommended: true,
    rationale: 'Forte probabilité de voir au moins 2 buts dans la rencontre'
  });

  // Over 2.5
  const isOverRec = m.over25_prediction && m.over25_prediction.includes('Plus');
  const probOver25 = isOverRec ? (parseInt(m.over25_confidence) || 64) : 46;
  const oddsOver25 = isOverRec ? 1.78 : 2.05;
  const rO25 = classifyRisk(probOver25, oddsOver25);
  bets.push({
    id: `m-${m.id}-goals-o25`,
    matchId: m.id,
    match: m,
    marketGroup: 'goals',
    market: 'Total Buts',
    selection: `⚽ Plus de 2.5 Buts`,
    odds: oddsOver25,
    probability: probOver25,
    riskProfile: rO25.profile,
    riskLabel: rO25.label,
    isRecommended: isOverRec && !raw.over25_avoid,
    rationale: 'Statistiques offensives et xG favorables aux buts'
  });

  // Under 2.5
  const isUnderRec = m.over25_prediction && m.over25_prediction.includes('Moins');
  const probUnder25 = isUnderRec ? (parseInt(m.over25_confidence) || 63) : 48;
  const oddsUnder25 = isUnderRec ? 1.72 : 1.95;
  const rU25 = classifyRisk(probUnder25, oddsUnder25);
  bets.push({
    id: `m-${m.id}-goals-u25`,
    matchId: m.id,
    match: m,
    marketGroup: 'goals',
    market: 'Total Buts',
    selection: `🛑 Moins de 2.5 Buts`,
    odds: oddsUnder25,
    probability: probUnder25,
    riskProfile: rU25.profile,
    riskLabel: rU25.label,
    isRecommended: isUnderRec && !raw.over25_avoid,
    rationale: 'Défenses solides et jeu fermé attendu'
  });

  // Under 3.5
  bets.push({
    id: `m-${m.id}-goals-u35`,
    matchId: m.id,
    match: m,
    marketGroup: 'goals',
    market: 'Total Buts',
    selection: `🛡️ Moins de 3.5 Buts`,
    odds: 1.35,
    probability: 77,
    riskProfile: 'safe',
    riskLabel: 'Sécurisé',
    isRecommended: true,
    rationale: 'Filet de sécurité élevé sur le total de buts'
  });

  // BTTS Oui
  const isBttsYes = m.btts_prediction === 'Oui';
  const probBttsYes = isBttsYes ? (parseInt(m.btts_confidence) || 64) : 45;
  const oddsBttsYes = isBttsYes ? 1.75 : 2.05;
  const rBttsYes = classifyRisk(probBttsYes, oddsBttsYes);
  bets.push({
    id: `m-${m.id}-btts-yes`,
    matchId: m.id,
    match: m,
    marketGroup: 'goals',
    market: 'Les 2 Marquent',
    selection: `🤝 Les deux équipes marquent : OUI`,
    odds: oddsBttsYes,
    probability: probBttsYes,
    riskProfile: rBttsYes.profile,
    riskLabel: rBttsYes.label,
    isRecommended: isBttsYes && !raw.btts_avoid,
    rationale: 'Capacité des deux équipes à trouver le chemin des filets'
  });

  // BTTS Non
  const isBttsNo = m.btts_prediction === 'Non';
  const probBttsNo = isBttsNo ? (parseInt(m.btts_confidence) || 62) : 48;
  const oddsBttsNo = isBttsNo ? 1.80 : 1.95;
  const rBttsNo = classifyRisk(probBttsNo, oddsBttsNo);
  bets.push({
    id: `m-${m.id}-btts-no`,
    matchId: m.id,
    match: m,
    marketGroup: 'goals',
    market: 'Les 2 Marquent',
    selection: `🚫 Les deux équipes marquent : NON`,
    odds: oddsBttsNo,
    probability: probBttsNo,
    riskProfile: rBttsNo.profile,
    riskLabel: rBttsNo.label,
    isRecommended: isBttsNo && !raw.btts_avoid,
    rationale: 'Clean sheet probable pour l’une des deux formations'
  });

  // 3. ONGLET PARIS SÉCURISÉS & IA
  // Draw No Bet (Remboursé si Nul)
  const dnbOddsHome = Math.max(1.10, parseFloat((oddsHome * ((oddsDraw - 1) / oddsDraw)).toFixed(2)) || 1.35);
  const probDnbHome = Math.min(90, Math.round(probHome * 1.15));
  const rDnb = classifyRisk(probDnbHome, dnbOddsHome);
  bets.push({
    id: `m-${m.id}-sec-dnb-1`,
    matchId: m.id,
    match: m,
    marketGroup: 'security',
    market: 'Remboursé si Nul (DNB)',
    selection: `🛡️ ${homeTeam} (Remboursé si Nul)`,
    odds: dnbOddsHome,
    probability: probDnbHome,
    riskProfile: rDnb.profile,
    riskLabel: rDnb.label,
    isRecommended: probHome > probAway,
    rationale: `Sécurité maximale : gain si ${homeTeam} gagne, mise remboursée en cas de match nul.`
  });

  // Also mirror safe selections in security group
  bets.push({
    ...bets.find(b => b.id === `m-${m.id}-goals-o15`),
    marketGroup: 'security',
    id: `m-${m.id}-sec-o15`,
  });

  const bestDc = prob1X >= probX2 ? bets.find(b => b.id === `m-${m.id}-dc-1x`) : bets.find(b => b.id === `m-${m.id}-dc-x2`);
  if (bestDc) {
    bets.push({
      ...bestDc,
      marketGroup: 'security',
      id: `m-${m.id}-sec-best-dc`,
      isRecommended: true
    });
  }

  // 4. ONGLET SPÉCIAUX & VALUE BETS
  if (m.asian_handicap_prediction && m.asian_handicap_prediction !== '—') {
    bets.push({
      id: `m-${m.id}-spec-ah`,
      matchId: m.id,
      match: m,
      marketGroup: 'specials',
      market: 'Handicap',
      selection: `⚡ Handicap : ${m.asian_handicap_prediction}`,
      odds: 1.88,
      probability: 53,
      riskProfile: 'moderate',
      riskLabel: 'Modéré',
      isRecommended: true,
      rationale: 'Handicap calculé sur les métriques xG et différentiel de niveau'
    });
  }

  // Value bets from IA
  if (Array.isArray(raw.value_bets_structured) && raw.value_bets_structured.length > 0) {
    raw.value_bets_structured.forEach((vb, idx) => {
      const odd = Number(vb.bookmaker_odds) || 2.10;
      bets.push({
        id: `m-${m.id}-spec-vb-${idx}`,
        matchId: m.id,
        match: m,
        marketGroup: 'specials',
        market: 'Value Bet',
        selection: `💎 ${vb.market} : ${vb.selection}`,
        odds: odd,
        probability: Math.min(85, Math.max(30, Math.round((1 / odd) * 105))),
        riskProfile: odd <= 1.50 ? 'safe' : odd <= 2.10 ? 'balanced' : 'moderate',
        riskLabel: odd <= 1.50 ? 'Sécurisé' : odd <= 2.10 ? 'Équilibré' : 'Modéré',
        isValueBet: true,
        edge: vb.value_edge || '+5.5%',
        isRecommended: true,
        rationale: `Détection d'un Edge mathématique positif (+EV) par l'algorithme.`
      });
    });
  }

  return bets;
}

// ============================================================
// SORTING LOGIC
// ============================================================
function sortCatalogs(catalogs) {
  const sortBy = builderState.sortBy;

  catalogs.sort((a, b) => {
    if (sortBy === 'date_asc') {
      const dateA = `${a.match.match_date || ''} ${a.match.match_time || '00:00'}`;
      const dateB = `${b.match.match_date || ''} ${b.match.match_time || '00:00'}`;
      return dateA.localeCompare(dateB);
    }
    if (sortBy === 'date_desc') {
      const dateA = `${a.match.match_date || ''} ${a.match.match_time || '00:00'}`;
      const dateB = `${b.match.match_date || ''} ${b.match.match_time || '00:00'}`;
      return dateB.localeCompare(dateA);
    }

    const maxProbA = a.bets.length > 0 ? Math.max(...a.bets.map(x => x.probability)) : 0;
    const maxProbB = b.bets.length > 0 ? Math.max(...b.bets.map(x => x.probability)) : 0;

    const minOddA = a.bets.length > 0 ? Math.min(...a.bets.map(x => x.odds)) : 999;
    const minOddB = b.bets.length > 0 ? Math.min(...b.bets.map(x => x.odds)) : 999;

    if (sortBy === 'success_desc') return maxProbB - maxProbA;
    if (sortBy === 'success_asc') return maxProbA - maxProbB;
    if (sortBy === 'odds_asc') return minOddA - minOddB;
    if (sortBy === 'odds_desc') return minOddB - minOddA;
    if (sortBy === 'ev_desc') {
      const vbA = a.bets.filter(x => x.isValueBet).length;
      const vbB = b.bets.filter(x => x.isValueBet).length;
      return vbB - vbA;
    }
    return 0;
  });
}

// ============================================================
// VIEW 1: MATCH CARDS WITH MARKET TABS
// ============================================================
function renderMatchesWithTabs(catalogs) {
  if (catalogs.length === 0) {
    return `
      <div class="combined-empty">
        <span>🔍</span>
        <p>Aucun match ne correspond à vos filtres actuels.</p>
        <button class="btn btn-secondary btn-sm" onclick="resetBuilderFilters()">Réinitialiser les filtres</button>
      </div>
    `;
  }

  return catalogs.map(({ match, bets }) => {
    const matchSelections = Object.values(builderState.selections).filter(s => s.matchId === match.id);
    const isMatchSelected = matchSelections.length > 0;

    // Default tab for this match if not set
    const activeTab = builderState.activeMatchTab[match.id] || 'result';

    // Group bets for tabs
    const tabBets = {
      result: bets.filter(b => b.marketGroup === 'result'),
      goals: bets.filter(b => b.marketGroup === 'goals'),
      security: bets.filter(b => b.marketGroup === 'security'),
      specials: bets.filter(b => b.marketGroup === 'specials'),
    };

    const currentTabBets = tabBets[activeTab] || [];

    return `
      <div class="bm-card ${isMatchSelected ? 'has-selection' : ''}" id="bm-card-${match.id}">
        
        <!-- Header -->
        <div class="bm-card-head">
          <div class="bm-head-left">
            <div class="bm-league-row">
              <span class="bm-comp-tag">${getCompetitionFlag(match.competition)} ${escapeHtml(match.competition)}</span>
              <span class="bm-kickoff">🕒 ${formatMatchDate(match.match_date)} à ${match.match_time}</span>
            </div>
            <div class="bm-teams-row">
              <span class="bm-team-name">${escapeHtml(match.home_team)}</span>
              <span class="bm-vs-pill">VS</span>
              <span class="bm-team-name">${escapeHtml(match.away_team)}</span>
            </div>
          </div>

          <div class="bm-head-right">
            ${match.ai_confidence ? `
              <div class="bm-ai-badge">
                <span class="bm-ai-lbl">Confiance IA</span>
                <span class="bm-ai-pct">${match.ai_confidence}</span>
              </div>
            ` : ''}
            ${isMatchSelected ? `
              <div class="bm-selected-chip ${matchSelections.length > 1 ? 'chip-mybet' : ''}" title="${matchSelections.map(s => `${s.selection} (@${s.odds.toFixed(2)})`).join(' • ')}">
                ${matchSelections.length > 1 
                  ? `<span>⚡ MyBet :</span> <strong>${matchSelections.length} paris choisis</strong>` 
                  : `<span>✓</span> ${escapeHtml(matchSelections[0].selection)} (@${matchSelections[0].odds.toFixed(2)})`
                }
              </div>
            ` : ''}
          </div>
        </div>

        <!-- AI Advice strip -->
        ${match.ai_prediction ? `
          <div class="bm-ai-strip">
            <span class="bm-ai-icon">🧠</span>
            <span class="bm-ai-pred">Pronostic IA : <strong>${escapeHtml(match.ai_prediction)}</strong></span>
            ${match.ai_recommendation ? `<span class="bm-ai-desc">— ${escapeHtml(match.ai_recommendation)}</span>` : ''}
          </div>
        ` : ''}

        <!-- TABS BAR FOR THIS MATCH -->
        <div class="bm-tabs-bar">
          <button class="bm-tab-btn ${activeTab === 'result' ? 'active' : ''}" onclick="setMatchActiveTab(${match.id}, 'result')">
            <span>🏆</span> 1N2 & Double Chance (${tabBets.result.length})
          </button>
          <button class="bm-tab-btn ${activeTab === 'goals' ? 'active' : ''}" onclick="setMatchActiveTab(${match.id}, 'goals')">
            <span>⚽</span> Buts & Totaux (${tabBets.goals.length})
          </button>
          <button class="bm-tab-btn ${activeTab === 'security' ? 'active' : ''}" onclick="setMatchActiveTab(${match.id}, 'security')">
            <span>🛡️</span> Sécurité & IA (${tabBets.security.length})
          </button>
          <button class="bm-tab-btn ${activeTab === 'specials' ? 'active' : ''}" onclick="setMatchActiveTab(${match.id}, 'specials')">
            <span>💎</span> Spéciaux & Value (${tabBets.specials.length})
          </button>
        </div>

        <!-- CONTEXTUAL HELP BANNER FOR ACTIVE TAB -->
        <div class="bm-tab-explainer">
          ${activeTab === 'result' ? `
            <div class="tab-explainer-item" onclick="openGuideModal('1n2')">
              <span>🏆 <strong>1N2</strong> : Résultat sur 90 min (1=Dom, N=Nul, 2=Ext). <em>Double Chance (1N, N2, 12)</em> couvre 2 issues sur 3.</span>
              <button class="btn-tab-help-link" type="button">ℹ️ Guide 1N2</button>
            </div>
          ` : activeTab === 'goals' ? `
            <div class="tab-explainer-item" onclick="openGuideModal('btts')">
              <span>⚽ <strong>Buts</strong> : <em>Over 2.5</em> = 3 buts ou plus • <em>BTTS</em> = OUI (les 2 marquent min 1-1) / NON (clean sheet).</span>
              <button class="btn-tab-help-link" type="button">ℹ️ Guide Buts</button>
            </div>
          ` : activeTab === 'security' ? `
            <div class="tab-explainer-item" onclick="openGuideModal('1n2')">
              <span>🛡️ <strong>Sécurité</strong> : Sélections haute fiabilité (65%+) idéales pour socle de combiné sans trop de volatilité.</span>
              <button class="btn-tab-help-link" type="button">ℹ️ Conseils</button>
            </div>
          ` : `
            <div class="tab-explainer-item" onclick="openGuideModal('value')">
              <span>💎 <strong>Value Bet</strong> : Cote Betclic surévaluée par rapport aux stats réelles IA (+EV long terme).</span>
              <button class="btn-tab-help-link" type="button">ℹ️ Calcul +EV</button>
            </div>
          `}
        </div>

        <!-- ACTIVE TAB BETS GRID -->
        <div class="bm-bets-content">
          ${currentTabBets.length === 0 ? `
            <div class="bm-tab-empty">
              <span>ℹ️</span> Aucun pari de ce marché ne correspond au profil de risque actuel (${builderState.riskFilter}).
            </div>
          ` : `
            <div class="bm-bets-grid">
              ${currentTabBets.map(b => renderBetTile(b, match)).join('')}
            </div>
          `}
        </div>

      </div>
    `;
  }).join('');
}

// ============================================================
// VIEW 2: DIRECT CATALOG (FLAT SORTED LIST OF BETS)
// ============================================================
function renderDirectCatalog(catalogs) {
  // Flatten all bets
  let allBets = [];
  catalogs.forEach(item => {
    allBets.push(...item.bets);
  });

  if (allBets.length === 0) {
    return `
      <div class="combined-empty">
        <span>🔍</span>
        <p>Aucun pari ne correspond à vos filtres actuels.</p>
        <button class="btn btn-secondary btn-sm" onclick="resetBuilderFilters()">Réinitialiser les filtres</button>
      </div>
    `;
  }

  // Sort flat list directly by criteria
  const sortBy = builderState.sortBy;
  allBets.sort((a, b) => {
    if (sortBy === 'success_desc') return b.probability - a.probability;
    if (sortBy === 'success_asc') return a.probability - b.probability;
    if (sortBy === 'odds_asc') return a.odds - b.odds;
    if (sortBy === 'odds_desc') return b.odds - a.odds;
    if (sortBy === 'date_asc') {
      const dA = `${a.match_date || ''} ${a.match_time || '00:00'}`;
      const dB = `${b.match_date || ''} ${b.match_time || '00:00'}`;
      return dA.localeCompare(dB);
    }
    if (sortBy === 'date_desc') {
      const dA = `${a.match_date || ''} ${a.match_time || '00:00'}`;
      const dB = `${b.match_date || ''} ${b.match_time || '00:00'}`;
      return dB.localeCompare(dA);
    }
    if (sortBy === 'ev_desc') {
      return (b.isValueBet ? 1 : 0) - (a.isValueBet ? 1 : 0);
    }
    return 0;
  });

  return `
    <div class="catalog-table-wrap">
      <div class="catalog-summary-bar">
        <span>📊 <strong>${allBets.length} paris</strong> trouvés et triés selon vos critères</span>
      </div>

      <div class="catalog-list">
        ${allBets.map(b => {
          const isSelected = !!builderState.selections[b.id];
          return `
            <div class="cat-row ${isSelected ? 'selected' : ''}" id="cat-row-${b.id}">
              <div class="cat-col-match">
                <span class="cat-comp">${getCompetitionFlag(b.competition)} ${escapeHtml(b.competition)}</span>
                <span class="cat-match-title">${escapeHtml(b.home_team)} vs ${escapeHtml(b.away_team)}</span>
                <span class="cat-time">🕒 ${formatMatchDate(b.match_date)} ${b.match_time}</span>
              </div>

              <div class="cat-col-bet">
                <span class="cat-market-pill">${b.market}</span>
                <span class="cat-bet-name">${escapeHtml(b.selection)}</span>
                ${b.isRecommended ? '<span class="mo-rec">⭐ IA</span>' : ''}
                ${b.isValueBet ? `<span class="mo-value">💎 VALUE (${b.edge})</span>` : ''}
              </div>

              <div class="cat-col-prob">
                <div class="prob-num-row">
                  <span class="prob-num ${b.probability >= 70 ? 'text-win' : b.probability >= 54 ? 'text-warn' : ''}">${b.probability}%</span>
                  <span class="prob-lbl">chance</span>
                </div>
                <div class="prob-bar-track">
                  <div class="prob-bar-fill ${b.riskProfile}" style="width: ${b.probability}%"></div>
                </div>
              </div>

              <div class="cat-col-risk">
                <span class="risk-badge ${b.riskProfile}">${b.riskLabel}</span>
              </div>

              <div class="cat-col-odds">
                <span class="cat-odd-pill">${b.odds.toFixed(2)}</span>
              </div>

              <div class="cat-col-action">
                <button class="btn-toggle-bet ${isSelected ? 'active' : ''}" onclick="toggleBetSelection('${escapeHtml(b.id)}')">
                  ${isSelected ? '✓ Ajouté' : '+ Ajouter'}
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

// ============================================================
// SINGLE BET TILE COMPONENT (USED IN MATCH CARDS)
// ============================================================
function renderBetTile(b, match) {
  const isSelected = !!builderState.selections[b.id];

  return `
    <div class="bet-tile ${isSelected ? 'selected' : ''}" id="tile-${b.id}" onclick="toggleBetSelection('${escapeHtml(b.id)}')">
      <div class="bt-top">
        <span class="bt-market">${b.market}</span>
        <span class="bt-odd">${b.odds.toFixed(2)}</span>
      </div>

      <div class="bt-selection">${escapeHtml(b.selection)}</div>

      <div class="bt-prob-row">
        <span class="bt-prob-tag ${b.riskProfile}">
          ${b.riskProfile === 'safe' ? '🟢' : b.riskProfile === 'balanced' ? '🟡' : '🟠'}
          ${b.probability}% de chance
        </span>
        <span class="bt-risk-pill ${b.riskProfile}">${b.riskLabel}</span>
      </div>

      ${b.isRecommended ? '<div class="bt-badge-rec">⭐ Recommandé par l’IA</div>' : ''}
      ${b.isValueBet ? `<div class="bt-badge-vb">💎 Value Bet (${b.edge})</div>` : ''}

      <div class="bt-action-indicator">
        ${isSelected ? '<span class="text-win">✓ Sélectionné dans le combiné</span>' : '<span>+ Cliquer pour ajouter</span>'}
      </div>
    </div>
  `;
}

// ============================================================
// BETTING SLIP (PANIER DU COMBINÉ EN DIRECT)
// ============================================================
function renderBuilderSlipHtml() {
  const items = Object.values(builderState.selections);
  const totalOdds = items.reduce((acc, s) => acc * s.odds, 1);
  const totalProb = items.length > 0 
    ? items.reduce((acc, s) => acc * (s.probability / 100), 1) * 100 
    : 0;

  // Group by match to count matches and detect MyBets
  const matchGroups = {};
  items.forEach(s => {
    if (!matchGroups[s.matchId]) matchGroups[s.matchId] = [];
    matchGroups[s.matchId].push(s);
  });
  const uniqueMatchCount = Object.keys(matchGroups).length;
  const hasMyBet = items.some(s => matchGroups[s.matchId]?.length > 1);

  const stake = builderState.stake;
  const potentialGain = (stake * totalOdds).toFixed(2);
  const netProfit = (stake * totalOdds - stake).toFixed(2);

  return `
    <div class="builder-slip-card" id="builder-slip-card">
      <div class="bsc-head">
        <div class="bsc-title-row">
          <span class="bsc-icon">📝</span>
          <h3 class="bsc-title">Mon Combiné en Direct</h3>
        </div>
        ${items.length > 0 ? `
          <button class="bsc-clear-btn" onclick="clearBuilderSelections()" title="Vider le combiné">🗑️ Vider</button>
        ` : ''}
      </div>

      <!-- Selections List -->
      <div class="bsc-items-list" id="bsc-items-list">
        ${items.length === 0 ? `
          <div class="slip-empty-box">
            <span style="font-size:2.5rem">➕</span>
            <p>Cliquez sur n'importe quel pari dans la liste pour l'ajouter à votre combiné.</p>
            <button class="btn btn-secondary btn-sm" onclick="autoFillTopBets()">⚡ Remplir automatiquement</button>
          </div>
        ` : items.map(s => `
          <div class="slip-item-card ${matchGroups[s.matchId]?.length > 1 ? 'is-mybet-item' : ''}">
            <div class="sic-info">
              <span class="sic-match">${escapeHtml(s.home_team)} vs ${escapeHtml(s.away_team)}</span>
              <span class="sic-sel">${escapeHtml(s.selection)}</span>
              <div class="sic-meta">
                <span class="sic-comp">${getCompetitionFlag(s.competition)} ${escapeHtml(s.competition)}</span>
                <span class="sic-prob">${s.probability}% de chance</span>
                ${matchGroups[s.matchId]?.length > 1 ? '<span class="sic-mybet-tag">⚡ Même Match (MyBet)</span>' : ''}
              </div>
            </div>
            <div class="sic-right">
              <span class="sic-odd">${s.odds.toFixed(2)}</span>
              <button class="sic-del" onclick="removeBuilderBetSelection('${escapeHtml(s.id)}')" title="Retirer ce pari">✕</button>
            </div>
          </div>
        `).join('')}
      </div>

      ${items.length > 0 ? `
        <!-- Live Totals & Metrics -->
        <div class="bsc-metrics-box">
          <div class="bsc-metric-row">
            <span class="bmr-label">Nombre de sélections :</span>
            <span class="bmr-val">
              <strong>${items.length} sélection${items.length > 1 ? 's' : ''}</strong>
              <span class="bmr-sub">(${uniqueMatchCount} match${uniqueMatchCount > 1 ? 's' : ''}${hasMyBet ? ' • ⚡ MyBet' : ''})</span>
            </span>
          </div>

          <div class="bsc-metric-row">
            <span class="bmr-label">Cote Totale Combinée :</span>
            <span class="bmr-val odd-highlight">${totalOdds.toFixed(2)}</span>
          </div>

          <div class="bsc-metric-row">
            <span class="bmr-label">Probabilité Cumulée :</span>
            <span class="bmr-val">${totalProb.toFixed(1)}%</span>
          </div>
          <div class="slip-prob-track">
            <div class="slip-prob-fill" style="width: ${Math.min(100, totalProb * 1.5)}%"></div>
          </div>

          <!-- Stake Row -->
          <div class="bsc-stake-row">
            <span class="bsr-label">Mise :</span>
            <div class="bsr-input-wrap">
              <button class="stake-btn-mini" onclick="adjustBuilderStake(-5)">-5€</button>
              <input type="number" id="builder-stake-input" class="slip-stake-input" value="${stake}" min="1" step="1" oninput="setBuilderStake(this.value)" />
              <button class="stake-btn-mini" onclick="adjustBuilderStake(5)">+5€</button>
            </div>
          </div>
          <div class="stake-quick-presets">
            ${[5, 10, 20, 50].map(v => `
              <button class="sqp-btn ${stake === v ? 'active' : ''}" onclick="setBuilderStake(${v})">${v}€</button>
            `).join('')}
          </div>

          <!-- Payout Row -->
          <div class="bsc-payout-box">
            <div class="payout-row">
              <span>Gain Potentiel Brut :</span>
              <strong class="text-win">${potentialGain} €</strong>
            </div>
            <div class="payout-row sub">
              <span>Bénéfice Net :</span>
              <span class="text-win">+${netProfit} €</span>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="bsc-actions">
          <button class="btn-slip-save" onclick="saveManualCombined()">
            <span>💾</span> Sauvegarder ce combiné
          </button>
          
          <button class="btn-slip-action system-btn" onclick="transferBuilderToSystem()" title="Créer un combiné avec tolérance d'erreur (Trixie, Yankee, 3/4...)">
            <span>🛡️</span> Convertir en Paris Système (3/4, Yankee...)
          </button>

          <button class="btn-slip-action hedge-btn" onclick="transferBuilderToHedging()" title="Calculer la couverture sur le dernier match">
            <span>⚖️</span> Simuler Cashout & Couverture
          </button>

          <button class="btn-slip-action bankroll-btn" onclick="addBuilderToBankroll()">
            <span>💰</span> Enregistrer dans ma Bankroll
          </button>
        </div>
      ` : ''}

    </div>
  `;
}

// ============================================================
// INTERACTIONS & STATE HANDLERS
// ============================================================
function toggleCompetitionFilter(comp) {
  if (!comp) {
    builderState.selectedCompetitions = [];
  } else {
    const idx = builderState.selectedCompetitions.indexOf(comp);
    if (idx >= 0) {
      builderState.selectedCompetitions.splice(idx, 1);
    } else {
      builderState.selectedCompetitions.push(comp);
    }
  }
  renderBuilderSectionContent();
}

function setBuilderRiskFilter(filter) {
  builderState.riskFilter = filter;
  renderBuilderSectionContent();
}

function setBuilderSort(sort) {
  builderState.sortBy = sort;
  renderBuilderSectionContent();
}

function toggleBuilderChronoSort() {
  if (builderState.sortBy === 'date_asc') {
    builderState.sortBy = 'date_desc';
    showToast('🕒 Tri chronologique : Matchs les plus lointains d\'abord', 'info');
  } else {
    builderState.sortBy = 'date_asc';
    showToast('⏰ Tri chronologique : Coups d\'envoi les plus proches d\'abord', 'success');
  }
  renderBuilderSectionContent();
}

function setBuilderView(view) {
  builderState.activeView = view;
  renderBuilderSectionContent();
}

function setBuilderSearch(query) {
  builderState.searchQuery = query;
  renderBuilderSectionContent();
}

function setMatchActiveTab(matchId, tabKey) {
  builderState.activeMatchTab[matchId] = tabKey;
  renderBuilderSectionContent();
}

function resetBuilderFilters() {
  builderState.riskFilter = 'all';
  builderState.sortBy = 'success_desc';
  builderState.selectedCompetitions = [];
  builderState.searchQuery = '';
  renderBuilderSectionContent();
}

function toggleBetSelection(betId) {
  // Find bet by looking across all matches
  let foundBet = null;
  const analyzed = allMatches.filter(m => m.ai_prediction);
  for (const m of analyzed) {
    const bets = generateAllBetsForMatch(m);
    const b = bets.find(x => x.id === betId);
    if (b) { foundBet = b; break; }
  }

  if (!foundBet) return;

  if (builderState.selections[foundBet.id]) {
    // Deselect this exact bet
    delete builderState.selections[foundBet.id];
    showToast(`Pari retiré : ${foundBet.selection}`, 'info');
  } else {
    // Check if there are other bets on this same match
    const existingOnMatch = Object.values(builderState.selections).filter(s => s.matchId === foundBet.matchId);

    // Conflict resolution for mutually exclusive selections within the SAME market:
    // (e.g. 1 vs N vs 2 on the same match, or Over 2.5 vs Under 2.5, or BTTS Oui vs Non)
    if (foundBet.market === '1N2') {
      const conflict = existingOnMatch.find(s => s.market === '1N2');
      if (conflict) {
        delete builderState.selections[conflict.id];
        showToast(`Remplacement 1N2 : ${foundBet.selection}`, 'info');
      }
    } else if (foundBet.market === 'Double Chance') {
      const conflict = existingOnMatch.find(s => s.market === 'Double Chance');
      if (conflict) {
        delete builderState.selections[conflict.id];
      }
    } else if (foundBet.market === 'Total Buts (+/- 2.5)') {
      const conflict = existingOnMatch.find(s => s.market === 'Total Buts (+/- 2.5)');
      if (conflict) {
        delete builderState.selections[conflict.id];
      }
    } else if (foundBet.market === 'Les deux équipes marquent') {
      const conflict = existingOnMatch.find(s => s.market === 'Les deux équipes marquent');
      if (conflict) {
        delete builderState.selections[conflict.id];
      }
    }

    // Add selection by unique bet ID (allows multiple bets on same match / MyBet)
    builderState.selections[foundBet.id] = {
      id: foundBet.id,
      matchId: foundBet.matchId,
      home_team: foundBet.home_team,
      away_team: foundBet.away_team,
      competition: foundBet.competition,
      match_date: foundBet.match_date,
      match_time: foundBet.match_time,
      market: foundBet.market,
      selection: foundBet.selection,
      odds: foundBet.odds,
      probability: foundBet.probability,
      riskProfile: foundBet.riskProfile,
      riskLabel: foundBet.riskLabel,
    };

    const countOnMatch = Object.values(builderState.selections).filter(s => s.matchId === foundBet.matchId).length;
    if (countOnMatch > 1) {
      showToast(`⚡ MyBet combiné sur ${foundBet.home_team} vs ${foundBet.away_team} (${countOnMatch} paris) !`, 'success');
    } else {
      showToast(`✅ Ajouté : ${foundBet.selection} (@${foundBet.odds.toFixed(2)})`, 'success');
    }
  }

  // Sync alias
  builderSelections = builderState.selections;

  renderBuilderSectionContent();
}

function removeBuilderBetSelection(betId) {
  if (builderState.selections[betId]) {
    const name = builderState.selections[betId].selection;
    delete builderState.selections[betId];
    builderSelections = builderState.selections;
    showToast(`Pari retiré : ${name}`, 'info');
    renderBuilderSectionContent();
  }
}

function removeBuilderMatchSelection(matchId) {
  let count = 0;
  Object.keys(builderState.selections).forEach(k => {
    if (builderState.selections[k].matchId === matchId) {
      delete builderState.selections[k];
      count++;
    }
  });
  builderSelections = builderState.selections;
  if (count > 0) showToast(`${count} pari(s) retiré(s) sur ce match`, 'info');
  renderBuilderSectionContent();
}

function clearBuilderSelections() {
  builderState.selections = {};
  builderSelections = builderState.selections;
  renderBuilderSectionContent();
}

function setBuilderStake(val) {
  const v = parseFloat(val);
  if (!isNaN(v) && v > 0) {
    builderState.stake = v;
    updateSlipMetricsUi();
  }
}

function adjustBuilderStake(delta) {
  builderState.stake = Math.max(1, builderState.stake + delta);
  updateSlipMetricsUi();
}

function updateSlipMetricsUi() {
  const items = Object.values(builderState.selections);
  const input = document.getElementById('builder-stake-input');
  if (input) input.value = builderState.stake;

  const totalOdds = items.reduce((acc, s) => acc * s.odds, 1);
  const stake = builderState.stake;
  const gain = (stake * totalOdds).toFixed(2);
  const net = (stake * totalOdds - stake).toFixed(2);

  document.querySelectorAll('.sqp-btn').forEach(btn => {
    btn.classList.toggle('active', parseInt(btn.textContent) === stake);
  });
}

function autoFillTopBets() {
  const analyzed = allMatches.filter(m => m.ai_prediction);
  if (analyzed.length === 0) return;

  // Filter by competition if any
  let matches = analyzed;
  if (builderState.selectedCompetitions.length > 0) {
    matches = matches.filter(m => builderState.selectedCompetitions.includes(m.competition));
  }
  if (matches.length === 0) matches = analyzed;

  // For each match, pick best bet according to risk filter
  const candidates = [];
  matches.forEach(m => {
    let bets = generateAllBetsForMatch(m);
    if (builderState.riskFilter !== 'all') {
      bets = bets.filter(b => b.riskProfile === builderState.riskFilter);
    }
    // Sort bets of this match by probability
    bets.sort((a, b) => b.probability - a.probability);
    if (bets.length > 0) {
      candidates.push(bets[0]);
    }
  });

  // Sort candidate matches by probability
  candidates.sort((a, b) => b.probability - a.probability);

  // Take top 4
  const top4 = candidates.slice(0, 4);
  if (top4.length === 0) {
    showToast('Aucun pari ne correspond à ce profil de risque.', 'warning');
    return;
  }

  builderState.selections = {};
  top4.forEach(b => {
    builderState.selections[b.id] = {
      id: b.id,
      matchId: b.matchId,
      home_team: b.home_team,
      away_team: b.away_team,
      competition: b.competition,
      match_date: b.match_date,
      match_time: b.match_time,
      market: b.market,
      selection: b.selection,
      odds: b.odds,
      probability: b.probability,
      riskProfile: b.riskProfile,
      riskLabel: b.riskLabel,
    };
  });
  builderSelections = builderState.selections;

  showToast(`⚡ ${top4.length} meilleurs paris sélectionnés automatiquement !`, 'success');
  renderBuilderSectionContent();
}

function transferBuilderToSystem() {
  const items = Object.values(builderState.selections);
  if (items.length < 3) {
    showToast('Veuillez ajouter au moins 3 sélections pour créer un Paris Système (Trixie, Yankee, 3/4...).', 'warning');
    return;
  }

  systemState.selections = items.map((s, idx) => ({
    id: s.id || `sys-${idx}`,
    matchId: s.matchId,
    home_team: s.home_team,
    away_team: s.away_team,
    selection: s.selection,
    market: s.market,
    odds: s.odds
  }));
  systemState.totalStake = builderState.stake || 20;

  showToast(`✅ ${items.length} sélections envoyées vers le module Paris Système !`, 'success');
  switchCombinedTab('system');
}

function transferBuilderToHedging() {
  const items = Object.values(builderState.selections);
  if (items.length < 2) {
    showToast('Veuillez ajouter au moins 2 sélections pour simuler la couverture.', 'warning');
    return;
  }

  const n = items.length;
  hedgingState.initialStake = builderState.stake || 20;
  hedgingState.selections = items.map((s, idx) => ({
    id: s.id || `hedge-${idx}`,
    matchId: s.matchId,
    home: s.home_team,
    away: s.away_team,
    selection: s.selection,
    odds: s.odds,
    status: idx < n - 1 ? 'won' : 'pending',
    hedgeSelection: `Double Chance adverse (${s.away_team} ou Nul)`,
    hedgeOdds: 2.10
  }));
  hedgingState.customHedgeStake = null;

  showToast(`✅ Combiné transféré dans le Simulateur Cashout & Couverture !`, 'success');
  switchCombinedTab('hedging');
}

function addBuilderToBankroll() {
  const items = Object.values(builderState.selections);
  if (items.length === 0) {
    showToast('Votre ticket est vide.', 'warning');
    return;
  }

  const totalOdds = items.reduce((acc, s) => acc * s.odds, 1);
  const stake = builderState.stake;
  const title = `Combiné Manuel (${items.length} sélections)`;
  const desc = items.map(s => `${s.home_team.split(' ')[0]}: ${s.selection} @${s.odds}`).join(' | ');

  if (typeof openAddBetModal === 'function') {
    openAddBetModal({
      title,
      selection: `${items.length} sélections combinées`,
      market: 'Combiné',
      odds: parseFloat(totalOdds.toFixed(2)),
      stake: stake,
      bet_type: 'combined',
      notes: `Sélections : ${desc}`
    });
  }
}

async function saveManualCombined() {
  const items = Object.values(builderState.selections);
  if (items.length === 0) { showToast('Ajoutez au moins un match', 'warning'); return; }

  const name = `Combiné Expert (${items.length} matchs - ${new Date().toLocaleDateString('fr-FR')})`;
  const stake = builderState.stake;
  const totalOdds = items.reduce((acc, s) => acc * s.odds, 1);

  const selections = items.map(s => ({
    match_id: s.matchId,
    home_team: s.home_team,
    away_team: s.away_team,
    competition: s.competition,
    match_date: s.match_date,
    match_time: s.match_time,
    market: s.market,
    selection: s.selection,
    odds: s.odds,
    confidence: `${s.probability}%`,
    rationale: `Sélection profil ${s.riskLabel}`,
  }));

  try {
    const res = await fetch(`${API}/combineds/save`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, strategy: 'custom', stake, selections, totalOdds, potentialGain: stake * totalOdds }),
    });
    const data = await res.json();
    if (data.success) {
      showToast(`✅ Combiné "${name}" sauvegardé avec succès !`, 'success');
      builderState.selections = {};
      builderSelections = builderState.selections;
      await loadCombinedHistory();
      renderBuilderSectionContent();
    } else {
      showToast(`❌ Erreur: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast('❌ Erreur de connexion', 'error');
  }
}

function getCompetitionFlag(comp) {
  if (!comp) return '⚽';
  const c = comp.toLowerCase();
  if (c.includes('ligue 1') || c.includes('france')) return '🇫🇷';
  if (c.includes('premier') || c.includes('angleterre') || c.includes('championship')) return '🏴󠁧󠁢󠁥󠁮󠁧󠁿';
  if (c.includes('liga') || c.includes('espagne')) return '🇪🇸';
  if (c.includes('serie a') || c.includes('italie')) return '🇮🇹';
  if (c.includes('bundesliga') || c.includes('allemagne')) return '🇩🇪';
  if (c.includes('champions') || c.includes('europa') || c.includes('conference')) return '🇪🇺';
  if (c.includes('eredivisie') || c.includes('pays-bas')) return '🇳🇱';
  if (c.includes('portugal') || c.includes('primeira')) return '🇵🇹';
  return '⚽';
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
          <div class="rc-action-row">
            <button class="btn-jump-hedging" onclick="openHedgingSimulatorWithCurrent()">
              <span>⚖️</span>
              <span>Ouvrir dans le Simulateur Interactif de Couverture & Cashout</span>
            </button>
          </div>
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
          <div class="rs-action-row">
            <button class="btn-jump-system" onclick="openSystemWithCurrent()">
              <span>🛡️</span>
              <span>Personnaliser ce Système (Trixie, Yankee, 2/4...)</span>
            </button>
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
  const selSummary = selections.map(s => `${(s.home_team || '').split(' ')[0]} vs ${(s.away_team || '').split(' ')[0]}: ${formatBetSelectionLabel(s.selection, s.market, s.home_team, s.away_team)} @${Number(s.odds).toFixed(2)}`).join(' | ');

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

// ================================================================
// SYSTEM BETS ENGINE (TRIXIE, YANKEE, 2/3, 3/4, PATENT, CANADIAN)
// ================================================================

const SYSTEM_DEFINITIONS = {
  // 3 selections
  '2/3': { name: 'Système 2/3', minSel: 3, maxSel: 3, k: [2], label: '3 doubles (Gagne dès 2 bons résultats sur 3)' },
  'trixie': { name: 'Trixie', minSel: 3, maxSel: 3, k: [2, 3], label: '3 doubles + 1 triple = 4 paris (Dès 2/3)' },
  'patent': { name: 'Patent', minSel: 3, maxSel: 3, k: [1, 2, 3], label: '3 simples + 3 doubles + 1 triple = 7 paris (Dès 1/3)' },

  // 4 selections
  '3/4': { name: 'Système 3/4', minSel: 4, maxSel: 4, k: [3], label: '4 triples (Encaisse même avec 1 erreur sur 4 !)' },
  '2/4': { name: 'Système 2/4', minSel: 4, maxSel: 4, k: [2], label: '6 doubles (Encaisse dès 2 bons résultats sur 4)' },
  'yankee': { name: 'Yankee', minSel: 4, maxSel: 4, k: [2, 3, 4], label: '6 doubles + 4 triples + 1 quadruple = 11 paris' },
  'lucky15': { name: 'Lucky 15', minSel: 4, maxSel: 4, k: [1, 2, 3, 4], label: '4 simples + 6 doubles + 4 triples + 1 quadruple = 15 paris' },

  // 5 selections
  '4/5': { name: 'Système 4/5', minSel: 5, maxSel: 5, k: [4], label: '5 quadruples (Tolère 1 erreur sur 5)' },
  '3/5': { name: 'Système 3/5', minSel: 5, maxSel: 5, k: [3], label: '10 triples (Tolère 2 erreurs sur 5)' },
  'canadian': { name: 'Canadian / Super Yankee', minSel: 5, maxSel: 5, k: [2, 3, 4, 5], label: '10 doubles + 10 triples + 5 quadruples + 1 quintuple = 26 paris' },

  // 6 selections
  '5/6': { name: 'Système 5/6', minSel: 6, maxSel: 6, k: [5], label: '6 combinés de 5 (Tolère 1 erreur sur 6)' },
  '4/6': { name: 'Système 4/6', minSel: 6, maxSel: 6, k: [4], label: '15 quadruples (Tolère 2 erreurs sur 6)' },
  'heinz': { name: 'Heinz', minSel: 6, maxSel: 6, k: [2, 3, 4, 5, 6], label: '57 combinaisons de 2 à 6 sélections' },

  // Default auto
  'auto': { name: 'Formule Optimale (N-1 / N)', minSel: 3, maxSel: 12, k: null, label: 'Formule réductrice standard N-1' }
};

let systemState = {
  selections: [],
  systemKey: 'auto',
  totalStake: 20
};

function getCombinations(array, k) {
  if (k === 0) return [[]];
  if (array.length === 0) return [];
  const head = array[0];
  const tail = array.slice(1);
  const withHead = getCombinations(tail, k - 1).map(c => [head, ...c]);
  const withoutHead = getCombinations(tail, k);
  return [...withHead, ...withoutHead];
}

function calculateSystemBet(selections, systemKey, totalStake) {
  const n = selections.length;
  if (n < 3) return null;

  let sysDef = SYSTEM_DEFINITIONS[systemKey];
  if (!sysDef || (sysDef.minSel && (n < sysDef.minSel || n > sysDef.maxSel))) {
    sysDef = { name: `Système ${n - 1}/${n}`, k: [n - 1], label: `${n} combinaisons de ${n - 1} sélections` };
  }

  const kList = sysDef.k || [n - 1];
  let allSubBets = [];
  kList.forEach(k => {
    if (k <= n) {
      const combs = getCombinations(selections.map((s, idx) => ({ ...s, _origIdx: idx })), k);
      allSubBets.push(...combs);
    }
  });

  const totalBetsCount = allSubBets.length;
  if (totalBetsCount === 0) return null;

  const stakePerBet = parseFloat((totalStake / totalBetsCount).toFixed(2));
  const effectiveTotalStake = parseFloat((stakePerBet * totalBetsCount).toFixed(2));

  let maxPayout = 0;
  const detailedBets = allSubBets.map((comb, i) => {
    const oddsProduct = comb.reduce((acc, s) => acc * (Number(s.odds) || 1), 1);
    const payout = parseFloat((stakePerBet * oddsProduct).toFixed(2));
    maxPayout += payout;
    return {
      index: i + 1,
      size: comb.length,
      selections: comb,
      odds: parseFloat(oddsProduct.toFixed(2)),
      stake: stakePerBet,
      payout: payout
    };
  });
  maxPayout = parseFloat(maxPayout.toFixed(2));

  // 1-Error scenarios
  const oneErrorScenarios = selections.map((sel, failedIdx) => {
    let payoutIfFails = 0;
    let winningTicketsCount = 0;
    detailedBets.forEach(bet => {
      const containsFailed = bet.selections.some(s => s._origIdx === failedIdx);
      if (!containsFailed) {
        payoutIfFails += bet.payout;
        winningTicketsCount++;
      }
    });
    payoutIfFails = parseFloat(payoutIfFails.toFixed(2));
    return {
      failedIdx,
      failedMatch: `${sel.home_team || ''} vs ${sel.away_team || ''}`,
      failedSelection: formatBetSelectionLabel(sel.selection, sel.market, sel.home_team, sel.away_team),
      winningTicketsCount,
      payout: payoutIfFails,
      profit: parseFloat((payoutIfFails - effectiveTotalStake).toFixed(2)),
      isProfitable: payoutIfFails >= effectiveTotalStake
    };
  });

  const minPayout1Error = Math.min(...oneErrorScenarios.map(s => s.payout));
  const maxPayout1Error = Math.max(...oneErrorScenarios.map(s => s.payout));
  const allProfitable1Error = oneErrorScenarios.every(s => s.isProfitable);

  // 2-Errors scenarios
  let twoErrorScenarios = [];
  if (kList.some(k => k <= n - 2)) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let payout = 0;
        let count = 0;
        detailedBets.forEach(bet => {
          const containsAnyFailed = bet.selections.some(s => s._origIdx === i || s._origIdx === j);
          if (!containsAnyFailed) {
            payout += bet.payout;
            count++;
          }
        });
        twoErrorScenarios.push({
          failedMatches: [`${selections[i].home_team || ''}`, `${selections[j].home_team || ''}`],
          winningTicketsCount: count,
          payout: parseFloat(payout.toFixed(2))
        });
      }
    }
  }

  const minPayout2Error = twoErrorScenarios.length ? Math.min(...twoErrorScenarios.map(s => s.payout)) : 0;
  const maxPayout2Error = twoErrorScenarios.length ? Math.max(...twoErrorScenarios.map(s => s.payout)) : 0;

  return {
    systemName: sysDef.name,
    systemKey,
    totalBetsCount,
    stakePerBet,
    totalStake: effectiveTotalStake,
    maxPayout,
    maxProfit: parseFloat((maxPayout - effectiveTotalStake).toFixed(2)),
    maxRoi: parseFloat((((maxPayout - effectiveTotalStake) / effectiveTotalStake) * 100).toFixed(1)),
    oneErrorScenarios,
    minPayout1Error,
    maxPayout1Error,
    allProfitable1Error,
    hasTwoErrorProtection: twoErrorScenarios.length > 0 && maxPayout2Error > 0,
    minPayout2Error,
    maxPayout2Error,
    detailedBets
  };
}

function renderSystemSection() {
  return `<div id="system-content-root"></div>`;
}

function renderSystemSectionContent() {
  const container = document.getElementById('system-content-root');
  if (!container) return;

  // Auto-init with AI combined or top matches if empty
  if (systemState.selections.length === 0) {
    if (combinedState.currentResult && Array.isArray(combinedState.currentResult.selections) && combinedState.currentResult.selections.length >= 3) {
      systemState.selections = [...combinedState.currentResult.selections];
    } else {
      const analyzed = allMatches.filter(m => m.ai_prediction).slice(0, 4);
      if (analyzed.length >= 3) {
        systemState.selections = analyzed.map(m => {
          const cleanSel = formatBetSelectionLabel(m.ai_prediction, '1N2', m.home_team, m.away_team);
          const odd = getOddForSelection(m.ai_prediction, '1N2', m);
          return {
            id: m.id,
            home_team: m.home_team,
            away_team: m.away_team,
            selection: cleanSel,
            market: '1N2',
            odds: odd
          };
        });
      }
    }
  }

  const n = systemState.selections.length;
  const availableSystems = Object.keys(SYSTEM_DEFINITIONS).filter(k => {
    if (k === 'auto') return true;
    const def = SYSTEM_DEFINITIONS[k];
    return n >= def.minSel && n <= def.maxSel;
  });

  const calc = n >= 3 ? calculateSystemBet(systemState.selections, systemState.systemKey, systemState.totalStake) : null;

  container.innerHTML = `
    <div class="system-section-layout">
      
      <!-- Top Hero Explanation -->
      <div class="system-hero-card">
        <div class="sh-icon">🛡️</div>
        <div class="sh-body">
          <div class="sh-title">Paris Système & Tolérance à l'Erreur</div>
          <div class="sh-desc">
            Ne perdez plus votre combiné à cause d'un seul match qui échoue ! Un pari système découpe vos sélections en sous-tickets pour vous <strong>garantir des gains même avec 1 ou 2 fautes</strong>.
          </div>
        </div>
        <div class="sh-actions">
          <button class="btn-sh-load-ai" onclick="loadAICombinedIntoSystem()">
            <span>⚡</span> <span>Charger Combiné IA Actuel</span>
          </button>
        </div>
      </div>

      <!-- Match Selector Card -->
      <div class="system-card">
        <div class="sc-header">
          <div class="sc-title">
            <span>🎯</span>
            <h3>Sélections du Système (${n} matchs)</h3>
          </div>
          <div class="sc-header-actions">
            <select class="sc-add-select" id="system-match-picker" onchange="addMatchToSystem(this.value)">
              <option value="">➕ Ajouter un match au système...</option>
              ${allMatches.filter(m => !systemState.selections.some(s => s.id === m.id)).map(m => `
                <option value="${m.id}">${escapeHtml(m.home_team)} vs ${escapeHtml(m.away_team)} (${m.ai_prediction || '1N2'})</option>
              `).join('')}
            </select>
          </div>
        </div>

        ${n === 0 ? `
          <div class="combined-empty">
            <span>🔍</span>
            <p>Aucun match sélectionné. Cliquez sur "Charger Combiné IA" ou ajoutez des matchs ci-dessus (minimum 3 sélections requis).</p>
          </div>
        ` : `
          <div class="system-selections-grid">
            ${systemState.selections.map((sel, idx) => `
              <div class="system-sel-pill">
                <span class="ssp-num">${idx + 1}</span>
                <div class="ssp-info">
                  <div class="ssp-teams">${escapeHtml(sel.home_team || 'Équipe 1')} vs ${escapeHtml(sel.away_team || 'Équipe 2')}</div>
                  <div class="ssp-sel">${escapeHtml(sel.selection || 'Victoire')}</div>
                </div>
                <div class="ssp-odd">@${Number(sel.odds || 1.80).toFixed(2)}</div>
                <button class="ssp-remove" onclick="removeMatchFromSystem(${idx})" title="Retirer ce match">✕</button>
              </div>
            `).join('')}
          </div>
        `}
      </div>

      ${n < 3 ? `
        <div class="system-warning-box">
          ⚠️ <strong>3 sélections minimum</strong> sont requises pour composer un pari système (Trixie, 2/3, 3/4...). Veuillez ajouter au moins ${3 - n} match supplémentaire.
        </div>
      ` : `
        <!-- Configuration & Controls -->
        <div class="system-config-grid">
          
          <div class="system-card">
            <h4 class="config-subtitle">⚙️ Formule de Système</h4>
            <div class="system-type-picker">
              ${availableSystems.map(k => {
                const def = SYSTEM_DEFINITIONS[k];
                const isActive = systemState.systemKey === k;
                return `
                  <div class="sys-type-card ${isActive ? 'active' : ''}" onclick="setSystemType('${k}')">
                    <div class="stc-title">${escapeHtml(def.name)}</div>
                    <div class="stc-label">${escapeHtml(def.label)}</div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <div class="system-card">
            <h4 class="config-subtitle">💰 Mise Totale & Répartition</h4>
            <div class="system-stake-controls">
              <div class="stake-field-wrap">
                <label>Mise Totale (€)</label>
                <input type="number" id="sys-total-stake" value="${systemState.totalStake}" min="1" step="1" oninput="setSystemTotalStake(this.value)" class="modal-input" />
              </div>
              <div class="stake-calc-wrap">
                <span class="scw-label">Combinaisons :</span>
                <span class="scw-val">${calc ? calc.totalBetsCount : 0} sous-paris</span>
              </div>
              <div class="stake-calc-wrap">
                <span class="scw-label">Mise par pari :</span>
                <span class="scw-val">${calc ? calc.stakePerBet.toFixed(2) : 0} €</span>
              </div>
            </div>
          </div>

        </div>

        ${calc ? `
          <!-- Key Results Cards -->
          <div class="system-metrics-grid">
            <div class="sys-metric-card primary">
              <span class="sm-label">Gain Maximum (0 faute)</span>
              <span class="sm-val win">${calc.maxPayout.toFixed(2)} €</span>
              <span class="sm-sub">Bénéfice Net : +${calc.maxProfit.toFixed(2)} € (${calc.maxRoi >= 0 ? '+' : ''}${calc.maxRoi}%)</span>
            </div>

            <div class="sys-metric-card ${calc.allProfitable1Error ? 'success' : 'warn'}">
              <span class="sm-label">Gain Garanti avec 1 Erreur</span>
              <span class="sm-val ${calc.allProfitable1Error ? 'win' : 'text-warn'}">
                ${calc.minPayout1Error.toFixed(2)} € à ${calc.maxPayout1Error.toFixed(2)} €
              </span>
              <span class="sm-sub">
                ${calc.allProfitable1Error 
                  ? '🟢 Rentabilité 100% garantie avec 1 erreur !' 
                  : '🟡 Capital partiellement amorti selon le match perdu'}
              </span>
            </div>

            ${calc.hasTwoErrorProtection ? `
              <div class="sys-metric-card">
                <span class="sm-label">Gain si 2 Erreurs</span>
                <span class="sm-val">${calc.minPayout2Error.toFixed(2)} € à ${calc.maxPayout2Error.toFixed(2)} €</span>
                <span class="sm-sub">Protection supplémentaire active</span>
              </div>
            ` : ''}
          </div>

          <!-- Scenario Breakdown Table -->
          <div class="system-card">
            <div class="sc-header">
              <div class="sc-title">
                <span>📋</span>
                <h3>Scénarios Réels : Que se passe-t-il si un match échoue ?</h3>
              </div>
            </div>
            <div class="table-responsive">
              <table class="pro-bet-table">
                <thead>
                  <tr>
                    <th>Scénario</th>
                    <th>Match qui échoue</th>
                    <th>Tickets Gagnants</th>
                    <th>Gain Brut</th>
                    <th>Bénéfice Net</th>
                    <th>Verdict</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="background: rgba(16,185,129,0.06);">
                    <td><strong>👑 100% Réussi</strong></td>
                    <td><em>Aucun (Sans faute)</em></td>
                    <td>${calc.totalBetsCount} sur ${calc.totalBetsCount}</td>
                    <td><strong class="text-win">${calc.maxPayout.toFixed(2)} €</strong></td>
                    <td><strong class="text-win">+${calc.maxProfit.toFixed(2)} €</strong></td>
                    <td><span class="conf-pill pill-high">Jackpot Total</span></td>
                  </tr>
                  ${calc.oneErrorScenarios.map(sc => `
                    <tr>
                      <td><span class="role-badge role-secure">1 Erreur</span></td>
                      <td><strong>${escapeHtml(sc.failedMatch)}</strong></td>
                      <td>${sc.winningTicketsCount} ticket(s)</td>
                      <td><span class="table-odd-pill">${sc.payout.toFixed(2)} €</span></td>
                      <td><span class="${sc.profit >= 0 ? 'text-win' : 'text-loss'}">${sc.profit >= 0 ? '+' : ''}${sc.profit.toFixed(2)} €</span></td>
                      <td>
                        <span class="conf-pill ${sc.isProfitable ? 'pill-high' : 'pill-medium'}">
                          ${sc.isProfitable ? '🟢 Bénéfice garanti' : '🟡 Mise amortie'}
                        </span>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>

            <div class="system-save-row">
              <button class="btn-system-bankroll" onclick="saveSystemBetToBankroll()">
                <span>💰</span> <span>Enregistrer ce Système dans la Bankroll</span>
              </button>
            </div>
          </div>
        ` : ''}
      `}

    </div>
  `;
}

function loadAICombinedIntoSystem() {
  if (combinedState.currentResult && Array.isArray(combinedState.currentResult.selections) && combinedState.currentResult.selections.length >= 3) {
    systemState.selections = [...combinedState.currentResult.selections];
    showToast('✅ Sélections du combiné IA importées dans le mode Système !', 'success');
  } else {
    // Pick top 4 matches
    const analyzed = allMatches.filter(m => m.ai_prediction).slice(0, 4);
    if (analyzed.length >= 3) {
      systemState.selections = analyzed.map(m => ({
        id: m.id,
        home_team: m.home_team,
        away_team: m.away_team,
        selection: formatBetSelectionLabel(m.ai_prediction, '1N2', m.home_team, m.away_team),
        market: '1N2',
        odds: getOddForSelection(m.ai_prediction, '1N2', m)
      }));
      showToast('✅ 4 matchs analysés chargés dans le Système !', 'success');
    } else {
      showToast('Veuillez analyser au moins 3 matchs au préalable.', 'warning');
    }
  }
  renderSystemSectionContent();
}

function addMatchToSystem(matchId) {
  if (!matchId) return;
  const m = allMatches.find(x => x.id == matchId);
  if (!m) return;
  const cleanSel = formatBetSelectionLabel(m.ai_prediction, '1N2', m.home_team, m.away_team);
  const odd = getOddForSelection(m.ai_prediction, '1N2', m);
  systemState.selections.push({
    id: m.id,
    home_team: m.home_team,
    away_team: m.away_team,
    selection: cleanSel,
    market: '1N2',
    odds: odd
  });
  renderSystemSectionContent();
}

function removeMatchFromSystem(idx) {
  systemState.selections.splice(idx, 1);
  renderSystemSectionContent();
}

function setSystemType(key) {
  systemState.systemKey = key;
  renderSystemSectionContent();
}

function setSystemTotalStake(val) {
  const v = parseFloat(val);
  if (!isNaN(v) && v > 0) {
    systemState.totalStake = v;
    renderSystemSectionContent();
  }
}

function openSystemWithCurrent() {
  if (combinedState.currentResult && Array.isArray(combinedState.currentResult.selections) && combinedState.currentResult.selections.length >= 3) {
    systemState.selections = [...combinedState.currentResult.selections];
  }
  switchCombinedTab('system');
}

function saveSystemBetToBankroll() {
  const calc = calculateSystemBet(systemState.selections, systemState.systemKey, systemState.totalStake);
  if (!calc) return;

  const title = `Pari Système ${calc.systemName} (${systemState.selections.length} matchs)`;
  const selSummary = systemState.selections.map(s => `${(s.home_team || '').split(' ')[0]}: ${s.selection} @${s.odds}`).join(' | ');

  if (typeof openAddBetModal === 'function') {
    openAddBetModal({
      title,
      selection: `${calc.systemName} : ${calc.totalBetsCount} combinaisons de ${calc.stakePerBet}€`,
      market: 'Pari Système',
      odds: parseFloat((calc.maxPayout / calc.totalStake).toFixed(2)),
      stake: calc.totalStake,
      bet_type: 'combined',
      notes: `Système tolérant l'erreur. Gain max: ${calc.maxPayout}€ • Garanti si 1 erreur: ${calc.minPayout1Error}€ à ${calc.maxPayout1Error}€. Détail: ${selSummary}`
    });
  }
}

// ================================================================
// HEDGING & CASHOUT SIMULATOR (COUVERTURE EN DIRECT)
// ================================================================

let hedgingState = {
  initialStake: 20,
  selections: [
    { id: 1, home: 'Paris SG', away: 'Lens', selection: 'Victoire de Paris SG', odds: 1.80, status: 'won' },
    { id: 2, home: 'Real Madrid', away: 'FC Séville', selection: 'Victoire de Real Madrid', odds: 1.75, status: 'won' },
    { id: 3, home: 'Arsenal', away: 'Chelsea', selection: 'Plus de 2,5 Buts', odds: 1.90, status: 'won' },
    { id: 4, home: 'Marseille', away: 'Nice', selection: 'Victoire de Marseille', odds: 1.85, status: 'pending', hedgeSelection: 'Nice ou Nul (Double Chance)', hedgeOdds: 2.05 }
  ],
  customHedgeOdds: 2.05,
  customHedgeStake: null
};

function calculateHedgingParams() {
  const S = Number(hedgingState.initialStake) || 20;
  const sels = hedgingState.selections;

  const totalOdds = sels.reduce((acc, s) => acc * (Number(s.odds) || 1), 1);
  const initialGain = parseFloat((S * totalOdds).toFixed(2));

  const wonSels = sels.filter(s => s.status === 'won');
  const pendingSels = sels.filter(s => s.status === 'pending');
  const lostSels = sels.filter(s => s.status === 'lost');

  const wonOdds = wonSels.reduce((acc, s) => acc * (Number(s.odds) || 1), 1);

  const lastPending = pendingSels.length === 1 ? pendingSels[0] : null;
  const Oh = Math.max(1.05, Number(hedgingState.customHedgeOdds) || 2.05);
  const Or = lastPending ? Math.max(1.05, Number(lastPending.odds) || 1.85) : 1.85;

  // Strategy 1: Perfect Equal Net Profit (Risk-free Arbitrage)
  const equalHedgeStake = parseFloat((initialGain / Oh).toFixed(2));
  const equalNetProfit = parseFloat((initialGain - S - equalHedgeStake).toFixed(2));
  const equalRoi = parseFloat(((equalNetProfit / (S + equalHedgeStake)) * 100).toFixed(1));

  // Strategy 2: Capital Security (Guaranteed initial stake refund)
  const refundHedgeStake = parseFloat((S / (Oh - 1)).toFixed(2));
  const refundGainIfWin = parseFloat((initialGain - S - refundHedgeStake).toFixed(2));

  // Strategy 3: Estimated Betclic Cashout offer
  const fairCashout = initialGain / Or;
  const estimatedCashout = parseFloat((fairCashout * 0.88).toFixed(2));
  const cashoutProfit = parseFloat((estimatedCashout - S).toFixed(2));
  const hedgingBonus = parseFloat((equalNetProfit - cashoutProfit).toFixed(2));

  // Custom slider value
  const chosenHedge = hedgingState.customHedgeStake !== null ? Number(hedgingState.customHedgeStake) : equalHedgeStake;
  const customNetIfWin = parseFloat((initialGain - S - chosenHedge).toFixed(2));
  const customNetIfHedge = parseFloat((chosenHedge * Oh - S - chosenHedge).toFixed(2));

  return {
    initialStake: S,
    totalOdds: parseFloat(totalOdds.toFixed(2)),
    initialGain,
    wonCount: wonSels.length,
    pendingCount: pendingSels.length,
    lostCount: lostSels.length,
    wonOdds: parseFloat(wonOdds.toFixed(2)),
    lastPending,
    hedgeOdds: Oh,
    equalHedgeStake,
    equalNetProfit,
    equalRoi,
    refundHedgeStake,
    refundGainIfWin,
    estimatedCashout,
    cashoutProfit,
    hedgingBonus,
    chosenHedge,
    customNetIfWin,
    customNetIfHedge
  };
}

function renderHedgingSection() {
  return `<div id="hedging-content-root"></div>`;
}

function renderHedgingSectionContent() {
  const container = document.getElementById('hedging-content-root');
  if (!container) return;

  const h = calculateHedgingParams();
  const lastMatch = h.lastPending;

  container.innerHTML = `
    <div class="hedging-section-layout">
      
      <!-- Top Hero Card -->
      <div class="hedging-hero-card">
        <div class="hh-icon">⚖️</div>
        <div class="hh-body">
          <div class="hh-title">Simulateur de Cashout & Couverture (Hedging)</div>
          <div class="hh-desc">
            Vos premiers matchs sont passés ? <strong>Ne laissez plus le dernier match anéantir votre combiné !</strong>
            Notre algorithme calcule la mise exacte à placer sur le marché opposé sur Betclic pour verrouiller un bénéfice 100% garanti quoi qu'il arrive.
          </div>
        </div>
        <div class="hh-actions">
          <button class="btn-sh-load-ai" onclick="loadAICombinedIntoHedging()">
            <span>⚡</span> <span>Charger Combiné IA</span>
          </button>
        </div>
      </div>

      <!-- Ticket Tracking Card -->
      <div class="system-card">
        <div class="sc-header">
          <div class="sc-title">
            <span>🎫</span>
            <h3>Suivi des Sélections de votre Combiné</h3>
          </div>
          <div class="hedging-ticket-meta">
            <span>Mise initiale : <strong>${h.initialStake}€</strong></span>
            <span>Cote totale : <strong>${h.totalOdds}</strong></span>
            <span class="text-win">Gain potentiel : <strong>${h.initialGain.toFixed(2)}€</strong></span>
          </div>
        </div>

        <p class="hedging-help-text">
          Cliquez sur les badges de statut pour indiquer l'état réel de vos matchs :
        </p>

        <div class="hedging-matches-list">
          ${hedgingState.selections.map((s, idx) => {
            const isWon = s.status === 'won';
            const isPending = s.status === 'pending';
            const isLost = s.status === 'lost';

            return `
              <div class="hedging-match-row ${s.status}">
                <div class="hm-idx">${idx + 1}</div>
                <div class="hm-teams">
                  <strong>${escapeHtml(s.home || '')} vs ${escapeHtml(s.away || '')}</strong>
                  <span class="hm-sel">${escapeHtml(s.selection || '')}</span>
                </div>
                <div class="hm-odd">@${Number(s.odds).toFixed(2)}</div>
                <div class="hm-status-toggles">
                  <button class="hm-btn-status ${isWon ? 'active won' : ''}" onclick="setHedgingMatchStatus(${idx}, 'won')">
                    ✅ Passé
                  </button>
                  <button class="hm-btn-status ${isPending ? 'active pending' : ''}" onclick="setHedgingMatchStatus(${idx}, 'pending')">
                    ⏳ En cours
                  </button>
                  <button class="hm-btn-status ${isLost ? 'active lost' : ''}" onclick="setHedgingMatchStatus(${idx}, 'lost')">
                    ❌ Perdu
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>

      ${h.lostCount > 0 ? `
        <div class="system-warning-box">
          ❌ <strong>Ce combiné compte déjà un match perdu.</strong> La couverture n'est plus applicable sur ce ticket. Modifiez les statuts ou chargez un autre combiné.
        </div>
      ` : h.pendingCount !== 1 ? `
        <div class="system-warning-box">
          ℹ️ <strong>Pour activer la couverture optimale</strong>, validez les matchs déjà passés en cliquant sur "✅ Passé" afin de laisser exactement <strong>1 seul match restant</strong> en attente.
        </div>
      ` : `
        <!-- Hedging Active Calculator -->
        <div class="hedging-active-card">
          
          <div class="hac-header">
            <span class="hac-badge">🎯 Opportunité de Couverture Détectée !</span>
            <div class="hac-summary">
              ${h.wonCount} matchs sur ${hedgingState.selections.length} déjà validés (Cote cumulée sécurisée : <strong>${h.wonOdds}</strong>)
            </div>
          </div>

          <div class="hac-match-focus">
            <div class="hmf-label">Dernier match décisif à couvrir :</div>
            <div class="hmf-match">
              ${escapeHtml(lastMatch.home)} vs ${escapeHtml(lastMatch.away)} — Pari initial : <strong>${escapeHtml(lastMatch.selection)} @ ${lastMatch.odds}</strong>
            </div>
            
            <div class="hmf-opposing-row">
              <div class="hmf-opp-field">
                <label>Pari de Couverture à Jouer sur Betclic :</label>
                <input type="text" class="modal-input" id="hedge-sel-name" value="${escapeHtml(lastMatch.hedgeSelection || 'Double Chance adverse')}" onchange="setHedgeSelectionName(this.value)" />
              </div>
              <div class="hmf-opp-field odds-field">
                <label>Cote de la couverture :</label>
                <input type="number" class="modal-input" id="hedge-odds-input" value="${h.hedgeOdds}" step="0.05" min="1.05" oninput="setHedgeOdds(this.value)" />
              </div>
            </div>
          </div>

          <!-- 3 Strategies Breakdown -->
          <div class="hedging-modes-grid">
            
            <div class="hedge-mode-card highlight">
              <div class="hmc-tag">🛡️ STRATÉGIE CONSEILLÉE</div>
              <div class="hmc-title">Bénéfice Garanti Identique (Arbitrage Parfait)</div>
              <p class="hmc-sub">Verrouillez le même gain net quel que soit le résultat du match, sans aucun stress.</p>
              
              <div class="hmc-metric">
                <span class="hmc-m-label">Mise de couverture exacte :</span>
                <span class="hmc-m-val text-accent">${h.equalHedgeStake} €</span>
              </div>
              <div class="hmc-metric profit-metric">
                <span class="hmc-m-label">Bénéfice Net 100% Assuré :</span>
                <span class="hmc-m-val text-win">+${h.equalNetProfit} €</span>
              </div>
              <div class="hmc-metric">
                <span class="hmc-m-label">Rendement Garanti :</span>
                <span class="hmc-m-val">+${h.equalRoi}%</span>
              </div>
            </div>

            <div class="hedge-mode-card">
              <div class="hmc-tag">💰 SÉCURITÉ MISE</div>
              <div class="hmc-title">Remboursement Intégral du Ticket</div>
              <p class="hmc-sub">Récupérez 100% de votre mise initiale en cas d'échec, tout en conservant le gros lot.</p>
              
              <div class="hmc-metric">
                <span class="hmc-m-label">Mise de couverture mini :</span>
                <span class="hmc-m-val">${h.refundHedgeStake} €</span>
              </div>
              <div class="hmc-metric">
                <span class="hmc-m-label">Gain si le combiné gagne :</span>
                <span class="hmc-m-val text-win">+${h.refundGainIfWin} €</span>
              </div>
              <div class="hmc-metric">
                <span class="hmc-m-label">Si le combiné perd :</span>
                <span class="hmc-m-val text-win">0.00 € (Mise remboursée)</span>
              </div>
            </div>

            <div class="hedge-mode-card cashout-compare">
              <div class="hmc-tag">⚡ CASH-OUT BETCLIC</div>
              <div class="hmc-title">Comparatif avec le Cashout Bookmaker</div>
              <p class="hmc-sub">Le bouton Cashout Betclic applique une marge défavorable. Faites le calcul :</p>
              
              <div class="hmc-metric">
                <span class="hmc-m-label">Cashout estimé Betclic :</span>
                <span class="hmc-m-val">~${h.estimatedCashout} €</span>
              </div>
              <div class="hmc-metric">
                <span class="hmc-m-label">Bénéfice via Cashout Betclic :</span>
                <span class="hmc-m-val">+${h.cashoutProfit} €</span>
              </div>
              <div class="hmc-metric profit-metric">
                <span class="hmc-m-label">Gain supplémentaire en Hedging :</span>
                <span class="hmc-m-val text-win">+${h.hedgingBonus} € (+12% à +15%)</span>
              </div>
            </div>

          </div>

          <!-- Interactive Slider -->
          <div class="hedging-slider-card">
            <div class="hsc-header">
              <h4>🎛️ Curseur Interactif : Personnalisez votre niveau de couverture</h4>
              <span class="hsc-stake-badge">Mise choisie : <strong>${h.chosenHedge} €</strong></span>
            </div>
            
            <input type="range" class="hedging-range-slider" min="0" max="${Math.round(h.equalHedgeStake * 1.5)}" step="1" value="${h.chosenHedge}" oninput="setHedgeSliderStake(this.value)" />

            <div class="hsc-bars-grid">
              <div class="hsc-bar-card ${h.customNetIfWin >= 0 ? 'pos' : 'neg'}">
                <div class="hsc-scenario">Si votre combiné passe (Marseille gagne)</div>
                <div class="hsc-res ${h.customNetIfWin >= 0 ? 'text-win' : 'text-loss'}">
                  ${h.customNetIfWin >= 0 ? '+' : ''}${h.customNetIfWin} € NET
                </div>
              </div>
              <div class="hsc-bar-card ${h.customNetIfHedge >= 0 ? 'pos' : 'neg'}">
                <div class="hsc-scenario">Si la couverture passe (Nice ou Nul)</div>
                <div class="hsc-res ${h.customNetIfHedge >= 0 ? 'text-win' : 'text-loss'}">
                  ${h.customNetIfHedge >= 0 ? '+' : ''}${h.customNetIfHedge} € NET
                </div>
              </div>
            </div>
          </div>

          <!-- Action Button -->
          <div class="hedging-save-row">
            <button class="btn-hedging-bankroll" onclick="saveHedgeBetToBankroll()">
              <span>💰</span> <span>Enregistrer le Pari de Couverture dans ma Bankroll (${h.chosenHedge} € @ ${h.hedgeOdds})</span>
            </button>
          </div>

        </div>
      `}

    </div>
  `;
}

function setHedgingMatchStatus(idx, status) {
  if (hedgingState.selections[idx]) {
    hedgingState.selections[idx].status = status;
    renderHedgingSectionContent();
  }
}

function setHedgeOdds(val) {
  const v = parseFloat(val);
  if (!isNaN(v) && v > 1) {
    hedgingState.customHedgeOdds = v;
    renderHedgingSectionContent();
  }
}

function setHedgeSelectionName(val) {
  const last = hedgingState.selections.find(s => s.status === 'pending');
  if (last) last.hedgeSelection = val;
}

function setHedgeSliderStake(val) {
  hedgingState.customHedgeStake = parseFloat(val);
  renderHedgingSectionContent();
}

function loadAICombinedIntoHedging() {
  if (combinedState.currentResult && Array.isArray(combinedState.currentResult.selections) && combinedState.currentResult.selections.length >= 2) {
    const sels = combinedState.currentResult.selections;
    const n = sels.length;
    hedgingState.initialStake = combinedState.stake || 20;
    hedgingState.selections = sels.map((s, idx) => ({
      id: s.id || idx,
      home: s.home_team || 'Équipe 1',
      away: s.away_team || 'Équipe 2',
      selection: formatBetSelectionLabel(s.selection, s.market, s.home_team, s.away_team),
      odds: Number(s.odds) || 1.80,
      status: idx < n - 1 ? 'won' : 'pending',
      hedgeSelection: `Double Chance adverse (${s.away_team || 'Extérieur'} ou Nul)`,
      hedgeOdds: 2.05
    }));
    hedgingState.customHedgeStake = null;
    showToast('✅ Combiné IA importé : 3 premiers matchs simulés comme gagnés !', 'success');
  } else {
    showToast('Combiné de démonstration initialisé avec 3/4 matchs validés.', 'info');
  }
  renderHedgingSectionContent();
}

function openHedgingSimulatorWithCurrent() {
  loadAICombinedIntoHedging();
  switchCombinedTab('hedging');
}

function saveHedgeBetToBankroll() {
  const h = calculateHedgingParams();
  if (!h || !h.lastPending) return;

  const title = `Couverture Combiné : ${h.lastPending.home} vs ${h.lastPending.away}`;
  const sel = h.lastPending.hedgeSelection || 'Double Chance (Couverture)';

  if (typeof openAddBetModal === 'function') {
    openAddBetModal({
      title,
      selection: sel,
      market: 'Couverture / Hedging',
      odds: h.hedgeOdds,
      stake: h.chosenHedge,
      bet_type: 'single',
      notes: `Couverture de combiné pour gain garanti. Si passe : +${h.customNetIfHedge}€ Net • Si combiné passe : +${h.customNetIfWin}€ Net.`
    });
  }
}


