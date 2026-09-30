/* ================================================================
   UI RENDERING, CARDS & NOTIFICATIONS
   ================================================================ */

let activeQuickFilter = 'all'; // 'all', 'value', 'today', 'analyzed'

function setQuickFilter(qf) {
  activeQuickFilter = qf;
  document.querySelectorAll('.quick-filter-chip').forEach(c => {
    c.classList.toggle('active', c.dataset.qf === qf);
  });
  renderMatches();
}

function toggleChronoSort() {
  const select = document.getElementById('sort-select');
  const btn = document.getElementById('quick-chrono-btn');
  if (sortBy === 'date' || sortBy === 'date_asc') {
    sortBy = 'date_desc';
    if (select) select.value = 'date_desc';
    if (btn) btn.classList.add('active');
    showToast('🕒 Tri chronologique : Matchs les plus lointains d\'abord', 'info');
  } else {
    sortBy = 'date_asc';
    if (select) select.value = 'date';
    if (btn) btn.classList.add('active');
    showToast('⏰ Tri chronologique : Coups d\'envoi les plus proches d\'abord', 'success');
  }
  renderMatches();
}

function renderMatches() {
  const grid = document.getElementById('matches-grid');
  const emptyState = document.getElementById('empty-state');

  let filtered = [...allMatches];

  // 0. Quick filter (Value Bets, Matchs du Jour, Analysés)
  if (activeQuickFilter === 'value') {
    filtered = filtered.filter(m => {
      let raw = {};
      try { raw = JSON.parse(m.raw_research || '{}'); } catch (_) {}
      return (Array.isArray(raw.value_bets_structured) && raw.value_bets_structured.length > 0) ||
             (m.value_bets && m.value_bets !== '—');
    });
  } else if (activeQuickFilter === 'today') {
    const todayStr = new Date().toISOString().split('T')[0];
    filtered = filtered.filter(m => m.match_date === todayStr);
  } else if (activeQuickFilter === 'analyzed') {
    filtered = filtered.filter(m => !!m.ai_prediction);
  }

  // 1. Filter by category
  if (activeCategory !== 'all') {
    filtered = filtered.filter(m => getCompetitionCategory(m.competition, m.competition_country) === activeCategory);
  }

  // 2. Filter by specific competition
  if (activeCompetition !== 'all') {
    filtered = filtered.filter(m => m.competition === activeCompetition);
  }

  // 3. Filter by search
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(m =>
      m.home_team.toLowerCase().includes(q) ||
      m.away_team.toLowerCase().includes(q) ||
      m.competition.toLowerCase().includes(q)
    );
  }

  // 4. Sort
  filtered.sort((a, b) => {
    if (sortBy === 'date' || sortBy === 'date_asc') {
      const dtA = (a.match_date || '') + ' ' + (a.match_time || '00:00');
      const dtB = (b.match_date || '') + ' ' + (b.match_time || '00:00');
      return dtA.localeCompare(dtB);
    }
    if (sortBy === 'date_desc') {
      const dtA = (a.match_date || '') + ' ' + (a.match_time || '00:00');
      const dtB = (b.match_date || '') + ' ' + (b.match_time || '00:00');
      return dtB.localeCompare(dtA);
    }
    if (sortBy === 'ai_conf') {
      const cA = parseInt(a.ai_confidence) || 0;
      const cB = parseInt(b.ai_confidence) || 0;
      return cB - cA;
    }
    if (sortBy === 'odds_home') return (a.odds_home || 99) - (b.odds_home || 99);
    if (sortBy === 'odds_away') return (a.odds_away || 99) - (b.odds_away || 99);
    if (sortBy === 'competition') return (a.competition || '').localeCompare(b.competition || '');
    return 0;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '';
    emptyState.classList.remove('hidden');
    updateBatchBar();
    return;
  }

  emptyState.classList.add('hidden');
  grid.innerHTML = filtered.map(match => renderMatchCard(match)).join('');
  updateBatchBar();
}

function renderMatchCard(match) {
  const isAnalyzed = !!match.ai_prediction;
  const flag = getCountryFlag(match.competition_country);
  const dateFormatted = formatMatchDate(match.match_date);
  const bestOdd = getBestOdd(match.odds_home, match.odds_draw, match.odds_away);

  const todayStr = new Date().toISOString().split('T')[0];
  const isToday = match.match_date === todayStr;

  let raw = {};
  try { raw = JSON.parse(match.raw_research || '{}'); } catch (_) {}

  const hasValueBet = Array.isArray(raw.value_bets_structured) && raw.value_bets_structured.length > 0;
  const topVb = hasValueBet ? raw.value_bets_structured[0] : null;

  // Dropping Odds / Smart Money detection
  const maxDrop = Math.max(match.odds_drop_home || 0, match.odds_drop_away || 0, match.odds_drop_draw || 0);
  const hasDroppingOdds = maxDrop >= 7;

  // Lineup H-1 status
  const isLineupConfirmed = match.lineup_status === 'confirmed';
  let lineupData = null;
  if (isLineupConfirmed && match.lineup_data) {
    try { lineupData = typeof match.lineup_data === 'string' ? JSON.parse(match.lineup_data) : match.lineup_data; } catch (_) {}
  }

  // Final score if match finished
  const hasFinalScore = match.score_home !== null && match.score_home !== undefined &&
                        match.score_away !== null && match.score_away !== undefined;

  return `
    <div class="match-card ${isAnalyzed ? 'analyzed' : ''} ${hasValueBet ? 'has-value-bet' : ''} ${hasDroppingOdds ? 'has-dropping-odds' : ''}" 
         id="card-${match.id}" 
         onclick="openModal(${match.id})" 
         style="cursor: pointer;">
      <div class="card-competition">
        <div class="competition-badge">
          <span class="competition-flag">${flag}</span>
          <span class="competition-name">${escapeHtml(match.competition)}</span>
        </div>
        <div class="match-datetime">
          ${hasFinalScore ? `<span class="badge-final-score">🏁 ${match.score_home}-${match.score_away}</span>` : ''}
          ${hasDroppingOdds ? `<span class="badge-drop-pulse">📉 -${maxDrop}% COTE</span>` : ''}
          ${isLineupConfirmed ? `<span class="badge-lineup-confirmed" title="11 titulaires officiels confirmés">📋 Compos H-1</span>` : ''}
          ${isToday && !hasFinalScore ? `<span class="badge-today">⏰ Aujourd'hui</span>` : ''}
          ${hasValueBet ? `<span class="badge-value-pulse" onclick="event.stopPropagation(); openGuideModal('value')" title="Cliquez pour comprendre le calcul mathématique (+EV)">💎 VALUE BET (+${escapeHtml(topVb.value_edge)}) ℹ️</span>` : ''}
          <span class="match-date-text">${dateFormatted}</span>
          <span class="match-time-text">${match.match_time || '—'}</span>
        </div>
      </div>

      <div class="card-teams">
        <div class="team home">
          <div class="team-name" title="${escapeHtml(match.home_team)}">${escapeHtml(match.home_team)}</div>
          <span class="team-badge home-badge">🏠 Domicile</span>
        </div>
        <div class="vs-separator">
          <span class="vs-text">VS</span>
          <div class="vs-line"></div>
        </div>
        <div class="team away">
          <div class="team-name" title="${escapeHtml(match.away_team)}">${escapeHtml(match.away_team)}</div>
          <span class="team-badge away-badge">✈️ Extérieur</span>
        </div>
      </div>

      <div class="card-odds">
        <div class="odd-box ${match.odds_drop_home >= 7 ? 'has-drop' : ''}" onclick="handleOddTap(${match.id}, '1', ${match.odds_home}, event)" title="1 = Victoire Domicile (${escapeHtml(match.home_team)}) sur 90 min">
          <div class="odd-label-col">
            <span class="odd-label">1</span>
            <span class="odd-sublabel">Dom</span>
          </div>
          <span class="odd-value ${bestOdd === match.odds_home ? 'best-odd' : ''}">${match.odds_home ? match.odds_home.toFixed(2) : '—'}</span>
          ${match.odds_drop_home >= 7 ? `<span class="odd-drop-tag">📉 -${match.odds_drop_home}%</span>` : ''}
        </div>
        <div class="odd-box ${match.odds_drop_draw >= 7 ? 'has-drop' : ''}" onclick="handleOddTap(${match.id}, 'N', ${match.odds_draw}, event)" title="N = Match nul sur 90 min">
          <div class="odd-label-col">
            <span class="odd-label">N</span>
            <span class="odd-sublabel">Nul</span>
          </div>
          <span class="odd-value ${bestOdd === match.odds_draw ? 'best-odd' : ''}">${match.odds_draw ? match.odds_draw.toFixed(2) : '—'}</span>
          ${match.odds_drop_draw >= 7 ? `<span class="odd-drop-tag">📉 -${match.odds_drop_draw}%</span>` : ''}
        </div>
        <div class="odd-box ${match.odds_drop_away >= 7 ? 'has-drop' : ''}" onclick="handleOddTap(${match.id}, '2', ${match.odds_away}, event)" title="2 = Victoire Extérieur (${escapeHtml(match.away_team)}) sur 90 min">
          <div class="odd-label-col">
            <span class="odd-label">2</span>
            <span class="odd-sublabel">Ext</span>
          </div>
          <span class="odd-value ${bestOdd === match.odds_away ? 'best-odd' : ''}">${match.odds_away ? match.odds_away.toFixed(2) : '—'}</span>
          ${match.odds_drop_away >= 7 ? `<span class="odd-drop-tag">📉 -${match.odds_drop_away}%</span>` : ''}
        </div>
      </div>

      ${isAnalyzed ? (() => {
        const tags = [];
        if (isLineupConfirmed) {
          tags.push(`<span class="card-tag tag-lineup">📋 H-1 : ${escapeHtml(lineupData?.confidence_adjustment || 'Stars confirmées')}</span>`);
        }
        if (hasDroppingOdds) {
          tags.push(`<span class="card-tag tag-drop">📉 Smart Money : Cote en chute (-${maxDrop}%)</span>`);
        }
        if (raw.result_avoid) {
          tags.push(`<span class="card-tag tag-danger">🚫 1N2 À ÉVITER</span>`);
        } else if (raw.result_risk_level === 'élevé') {
          tags.push(`<span class="card-tag tag-warn">⚠️ Risque 1N2 élevé</span>`);
        }
        if (raw.btts_avoid) {
          tags.push(`<span class="card-tag tag-danger">🚫 BTTS À ÉVITER</span>`);
        }
        if (raw.over25_avoid) {
          tags.push(`<span class="card-tag tag-danger">🚫 Buts imprévisibles</span>`);
        }
        if (hasValueBet) {
          tags.push(`<span class="card-tag tag-value" onclick="event.stopPropagation(); openGuideModal('value')" style="cursor:pointer;" title="Cliquez pour comprendre ce que signifie un Value Bet">💎 ${raw.value_bets_structured.length} Value Bet(s) ℹ️</span>`);
        }
        const cleanCardPred = formatBetSelectionLabel(match.ai_prediction, '1N2', match.home_team, match.away_team);
        const cardOdd = getOddForSelection(match.ai_prediction, '1N2', match);

        return `
          <div class="card-ai-preview">
            <div class="ai-preview-header">
              <span class="ai-pill">🎯 À JOUER</span>
              <span class="ai-pred-text"><strong>${escapeHtml(cleanCardPred)}</strong> @ ${cardOdd.toFixed(2)}</span>
              <span class="ai-conf-badge">${match.ai_confidence || ''}</span>
            </div>
            ${match.ai_recommendation ? `<p class="ai-rec-text">${escapeHtml(match.ai_recommendation)}</p>` : ''}
            ${tags.length > 0 ? `<div class="card-ai-tags">${tags.join('')}</div>` : ''}
          </div>
        `;
      })() : ''}

      <div class="card-footer">
        ${isAnalyzed ? `
          <div class="analyzed-tag">
            <div class="analyzed-dot"></div>
            <span>Analysé par IA</span>
          </div>
        ` : `
          <span class="card-venue" title="${escapeHtml(match.venue || match.competition_country || '—')}">
            📍 ${escapeHtml(match.venue || match.competition_country || '—')}
          </span>
        `}
        <div class="card-footer-buttons">
          <button class="btn-card-quick-bet" onclick="quickBetFromMatch(${match.id}, event)" title="Enregistrer dans ma Bankroll">
            💰 Miser
          </button>
          <button class="btn-analyze ${isAnalyzed ? 'analyzed' : ''}"
                  onclick="event.stopPropagation(); openModal(${match.id})"
                  id="analyze-btn-${match.id}">
            ${isAnalyzed ? '🧠 Voir l\'analyse' : '🤖 Analyser avec l\'IA'}
          </button>
        </div>
      </div>
    </div>
  `;
}

function handleOddTap(matchId, pick, odd, event) {
  if (event) event.stopPropagation();
  if (!odd || isNaN(odd)) return;

  const match = allMatches.find(m => m.id === matchId);
  if (!match) return;

  quickBetFromMatch(matchId, event, pick);
}

function quickBetFromMatch(matchId, event, preferredPick = null) {
  if (event) event.stopPropagation();
  const match = allMatches.find(m => m.id === matchId);
  if (!match) return;

  let raw = {};
  try { raw = JSON.parse(match.raw_research || '{}'); } catch (_) {}

  // If a specific odd was tapped (1, N, 2)
  if (preferredPick) {
    let sel = formatBetSelectionLabel('1', '1N2', match.home_team, match.away_team);
    let oddVal = match.odds_home || 1.85;
    if (preferredPick === 'N') {
      sel = 'Match Nul';
      oddVal = match.odds_draw || 3.20;
    } else if (preferredPick === '2') {
      sel = formatBetSelectionLabel('2', '1N2', match.home_team, match.away_team);
      oddVal = match.odds_away || 2.10;
    }

    if (typeof openAddBetModal === 'function') {
      openAddBetModal({
        title: `${match.home_team} vs ${match.away_team}`,
        selection: sel,
        market: '1N2',
        odds: oddVal,
        stake: 20,
        bet_type: 'single',
        match_id: match.id,
        notes: `Cote sélectionnée directement depuis la carte (${preferredPick})`
      });
    }
    return;
  }

  // If match has a value bet, prefill with value bet!
  if (Array.isArray(raw.value_bets_structured) && raw.value_bets_structured.length > 0) {
    const vb = raw.value_bets_structured[0];
    const cleanVbSel = formatBetSelectionLabel(vb.selection, vb.market, match.home_team, match.away_team);
    if (typeof openAddBetModal === 'function') {
      openAddBetModal({
        title: `${match.home_team} vs ${match.away_team}`,
        selection: cleanVbSel,
        market: cleanMarketLabel(vb.market || 'Value Bet'),
        odds: Number(vb.bookmaker_odds) || match.odds_home || 1.85,
        stake: 25,
        bet_type: 'single',
        match_id: match.id,
        notes: `Value Bet Edge ${vb.value_edge} — ${vb.rationale || ''}`
      });
    }
    return;
  }

  // Otherwise prefill with AI prediction or home win
  const cleanPred = formatBetSelectionLabel(match.ai_prediction, '1N2', match.home_team, match.away_team);
  const correctOdd = getOddForSelection(match.ai_prediction, '1N2', match);

  if (typeof openAddBetModal === 'function') {
    openAddBetModal({
      title: `${match.home_team} vs ${match.away_team}`,
      selection: cleanPred,
      market: '1N2',
      odds: correctOdd,
      stake: 20,
      bet_type: 'single',
      match_id: match.id,
      notes: match.ai_recommendation || ''
    });
  }
}

function renderFormDots(formStr) {
  if (!formStr) return '<span style="color:var(--text-muted)">—</span>';

  const parts = formStr.replace(/[-,\s]/g, '').split('');
  const letters = parts.filter(p => ['V', 'W', 'D', 'N', 'L'].includes(p.toUpperCase()));

  if (letters.length === 0) {
    return `<span style="color:var(--text-secondary); font-size:12px">${formStr}</span>`;
  }

  return letters.slice(0, 5).map(l => {
    const upper = l.toUpperCase();
    let cls = '';
    let label = upper;
    if (upper === 'V' || upper === 'W') { cls = 'W'; label = 'V'; }
    else if (upper === 'D' || upper === 'N') { cls = 'N'; label = 'N'; }
    else if (upper === 'L') { cls = 'L'; label = 'D'; }
    return `<div class="form-dot ${cls}">${label}</div>`;
  }).join('');
}

function formatTimeAgo(date) {
  const now = new Date();
  const diff = Math.floor((now - date) / 1000);

  if (diff < 60) return 'À l\'instant';
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)}min`;
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`;
  return `Il y a ${Math.floor(diff / 86400)}j`;
}

function showLoading(show) {
  const loadingEl = document.getElementById('loading-state');
  const gridEl = document.getElementById('matches-grid');
  const emptyEl = document.getElementById('empty-state');

  if (show) {
    loadingEl.style.display = 'flex';
    gridEl.innerHTML = '';
    emptyEl.classList.add('hidden');
  } else {
    loadingEl.style.display = 'none';
  }
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('out');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

/* ================================================================
   BATCH ANALYSIS FOR CURRENT CATEGORY
   ================================================================ */

let batchAnalysisState = {
  isRunning: false,
  shouldStop: false,
  total: 0,
  current: 0,
  successCount: 0,
  errorCount: 0
};

function getCurrentFilteredMatches() {
  let filtered = [...allMatches];
  if (activeCategory !== 'all') {
    filtered = filtered.filter(m => getCompetitionCategory(m.competition, m.competition_country) === activeCategory);
  }
  if (activeCompetition !== 'all') {
    filtered = filtered.filter(m => m.competition === activeCompetition);
  }
  if (searchQuery && searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(m =>
      m.home_team.toLowerCase().includes(q) ||
      m.away_team.toLowerCase().includes(q) ||
      m.competition.toLowerCase().includes(q)
    );
  }
  return filtered;
}

function getCurrentCategoryLabel() {
  if (activeCompetition !== 'all') return activeCompetition;
  if (activeCategory !== 'all') {
    const cat = CATEGORIES.find(c => c.id === activeCategory);
    return cat ? cat.label : activeCategory;
  }
  return 'Tous les matchs';
}

function updateBatchBar() {
  const bar = document.getElementById('batch-bar');
  if (!bar) return;

  const btn = document.getElementById('btn-batch-analyze');
  const btnText = document.getElementById('batch-btn-text');
  const checkbox = document.getElementById('batch-force-re-eval');
  const matches = getCurrentFilteredMatches();
  const catLabel = getCurrentCategoryLabel();

  if (matches.length === 0) {
    if (btn) btn.disabled = true;
    if (btnText) btnText.textContent = `Aucun match (${catLabel})`;
    return;
  }

  if (batchAnalysisState.isRunning) {
    if (btn) btn.disabled = true;
    return;
  }

  if (btn) btn.disabled = false;
  const forceReEval = checkbox ? checkbox.checked : false;
  const unanalyzedCount = matches.filter(m => !m.ai_prediction).length;

  if (forceReEval) {
    if (btnText) btnText.textContent = `⚡ Tout réévaluer (${matches.length} matchs - ${catLabel})`;
  } else {
    if (unanalyzedCount > 0) {
      if (btnText) btnText.textContent = `⚡ Analyser les non-analysés (${unanalyzedCount}/${matches.length} - ${catLabel})`;
    } else {
      if (btnText) btnText.textContent = `✅ Tous analysés (${matches.length}/${matches.length} - ${catLabel})`;
    }
  }
}

async function startBatchAnalysis() {
  if (batchAnalysisState.isRunning) return;

  const matches = getCurrentFilteredMatches();
  const checkbox = document.getElementById('batch-force-re-eval');
  const forceReEval = checkbox ? checkbox.checked : false;

  const targetMatches = forceReEval
    ? matches
    : matches.filter(m => !m.ai_prediction);

  if (targetMatches.length === 0) {
    if (matches.length === 0) {
      showToast('Aucun match disponible dans cette catégorie.', 'info');
    } else {
      showToast('Tous les matchs de cette catégorie sont déjà analysés ! Cochez "Réévaluer ceux déjà analysés" pour forcer une mise à jour.', 'info');
    }
    return;
  }

  batchAnalysisState.isRunning = true;
  batchAnalysisState.shouldStop = false;
  batchAnalysisState.total = targetMatches.length;
  batchAnalysisState.current = 0;
  batchAnalysisState.successCount = 0;
  batchAnalysisState.errorCount = 0;

  const statusEl = document.getElementById('batch-status');
  const leftControlsEl = document.querySelector('.batch-bar-left');
  if (statusEl) statusEl.classList.remove('hidden');
  if (leftControlsEl) leftControlsEl.classList.add('disabled-dim');

  showToast(`🚀 Démarrage de l'analyse un par un (${targetMatches.length} matchs)...`, 'info');

  for (let i = 0; i < targetMatches.length; i++) {
    if (batchAnalysisState.shouldStop) {
      showToast(`⏹️ Analyse par lot arrêtée (${i}/${targetMatches.length} effectués).`, 'warning');
      break;
    }

    const match = targetMatches[i];
    batchAnalysisState.current = i + 1;
    updateBatchStatusUI(match, i + 1, targetMatches.length);

    const cardEl = document.getElementById(`card-${match.id}`);
    if (cardEl) {
      cardEl.classList.add('card-analyzing-now');
      cardEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    try {
      const res = await fetch(`${API}/analyze/${match.id}`, { method: 'POST' });
      const data = await res.json();
      if (data.success && data.analysis) {
        const idx = allMatches.findIndex(m => m.id === match.id);
        if (idx !== -1) {
          allMatches[idx] = { ...allMatches[idx], ...data.analysis };
          updateSingleMatchCard(allMatches[idx]);
        }
        batchAnalysisState.successCount++;
        loadStats();
      } else {
        batchAnalysisState.errorCount++;
        console.warn(`Analyse non réussie pour match #${match.id}:`, data.error);
      }
    } catch (err) {
      batchAnalysisState.errorCount++;
      console.error(`Erreur réseau match #${match.id}:`, err);
    } finally {
      const updatedCardEl = document.getElementById(`card-${match.id}`);
      if (updatedCardEl) {
        updatedCardEl.classList.remove('card-analyzing-now');
      }
    }

    if (i < targetMatches.length - 1 && !batchAnalysisState.shouldStop) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  batchAnalysisState.isRunning = false;
  if (statusEl) statusEl.classList.add('hidden');
  if (leftControlsEl) leftControlsEl.classList.remove('disabled-dim');

  showToast(`✅ Analyse terminée : ${batchAnalysisState.successCount} match(s) analysé(s) avec succès !`, 'success');
  updateBatchBar();
  loadStats();
}

function stopBatchAnalysis() {
  if (!batchAnalysisState.isRunning) return;
  batchAnalysisState.shouldStop = true;
  const statusText = document.getElementById('batch-status-text');
  if (statusText) statusText.textContent = 'Arrêt en cours...';
}

function updateBatchStatusUI(match, current, total) {
  const percent = Math.round((current / total) * 100);
  const fill = document.getElementById('batch-progress-fill');
  const title = document.getElementById('batch-status-text');
  const sub = document.getElementById('batch-status-sub');

  if (fill) fill.style.width = `${percent}%`;
  if (title) title.textContent = `Analyse en cours : ${current} / ${total} (${percent}%)`;
  if (sub) sub.textContent = `Match actuel : ${match.home_team} vs ${match.away_team} (${match.competition})`;
}

function updateSingleMatchCard(match) {
  const cardEl = document.getElementById(`card-${match.id}`);
  if (cardEl) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = renderMatchCard(match);
    const newCard = tempDiv.firstElementChild;
    cardEl.replaceWith(newCard);
  }
}

// ================================================================
// LOCK SCREEN & AUTHENTICATION UI
// ================================================================

function showLockScreen() {
  const modal = document.getElementById('lock-screen-modal');
  if (modal) {
    modal.classList.remove('hidden');
    const input = document.getElementById('lock-password-input');
    if (input) {
      input.value = '';
      setTimeout(() => input.focus(), 150);
    }
    const err = document.getElementById('lock-error-msg');
    if (err) err.textContent = '';
  }
}

function hideLockScreen() {
  const modal = document.getElementById('lock-screen-modal');
  if (modal) modal.classList.add('hidden');
}

async function submitUnlock(e) {
  if (e && e.preventDefault) e.preventDefault();
  const input = document.getElementById('lock-password-input');
  const btn = document.getElementById('btn-lock-submit');
  const err = document.getElementById('lock-error-msg');
  const password = input ? input.value.trim() : '';

  if (!password) {
    if (err) err.textContent = 'Veuillez saisir votre mot de passe.';
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Vérification...';
  }
  if (err) err.textContent = '';

  try {
    const res = await _nativeFetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();

    if (data.success && data.token) {
      setAuthToken(data.token);
      hideLockScreen();
      showToast('🔓 Accès déverrouillé !', 'success');
      // Reload active data
      await loadStats();
      await loadMatches();
      if (typeof currentPage !== 'undefined' && currentPage === 'combined') {
        initCombinedPage();
      }
    } else {
      if (err) {
        err.textContent = data.error || 'Mot de passe incorrect.';
        input.classList.add('shake');
        setTimeout(() => input.classList.remove('shake'), 500);
      }
    }
  } catch (error) {
    if (err) err.textContent = 'Erreur réseau de connexion.';
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Déverrouiller';
    }
  }
}

// Scroll to top FAB listener
window.addEventListener('scroll', () => {
  const fab = document.getElementById('fab-scroll-top');
  if (fab) {
    if (window.scrollY > 300) {
      fab.classList.add('visible');
    } else {
      fab.classList.remove('visible');
    }
  }
}, { passive: true });

// ================================================================
// GUIDE & LEXIQUE DES PARIS (1N2, BTTS, VALUE BETS...)
// ================================================================

let activeGuideTab = '1n2';

function openGuideModal(tab = '1n2') {
  activeGuideTab = tab;
  const overlay = document.getElementById('guide-modal-overlay');
  if (!overlay) return;

  overlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  switchGuideTab(tab);
}

function closeGuideModal(event) {
  if (event && event.target && event.target.id !== 'guide-modal-overlay' && !event.target.classList.contains('modal-close')) {
    return;
  }
  const overlay = document.getElementById('guide-modal-overlay');
  if (overlay) overlay.classList.add('hidden');
  document.body.style.overflow = '';
}

function switchGuideTab(tabKey) {
  activeGuideTab = tabKey;
  document.querySelectorAll('.g-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.gtab === tabKey);
  });

  const content = document.getElementById('guide-modal-content');
  if (content) {
    content.innerHTML = renderGuideContent(tabKey);
  }
}

function renderGuideContent(tabKey) {
  if (tabKey === '1n2') {
    return `
      <div class="guide-panel-fade">
        <div class="guide-hero-banner">
          <div class="ghb-icon">⚽</div>
          <div class="ghb-text">
            <h3>Le pari « 1N2 » & les Doubles Chances</h3>
            <p>Le pari reine du football : prédire l'issue de la rencontre à la fin du temps réglementaire.</p>
          </div>
        </div>

        <div class="guide-grid-3">
          <div class="guide-card-tile">
            <div class="gct-badge gct-home">1</div>
            <h4>Victoire Domicile</h4>
            <p>L'équipe qui reçoit remporte le match (ex: PSG gagne contre Lens 2-1).</p>
          </div>

          <div class="guide-card-tile">
            <div class="gct-badge gct-draw">N</div>
            <h4>Match Nul</h4>
            <p>Score d'égalité au coup de sifflet final (ex: 0-0, 1-1, 2-2...).</p>
          </div>

          <div class="guide-card-tile">
            <div class="gct-badge gct-away">2</div>
            <h4>Victoire Extérieur</h4>
            <p>L'équipe en déplacement gagne la rencontre (ex: Lens gagne 0-1 à Paris).</p>
          </div>
        </div>

        <div class="guide-rule-box">
          <span class="grb-icon">⚠️</span>
          <div class="grb-content">
            <strong>Règle d'or absolue des 90 minutes :</strong>
            <p>Le résultat 1N2 est validé <strong>exclusivement sur les 90 minutes de jeu officiel + le temps additionnel</strong>. Les prolongations et séances de tirs au but en match de coupe NE COMPTENT PAS. Si deux équipes font 1-1 à la 90e minute et qu'une équipe gagne 2-1 en prolongations, le pari gagnant 1N2 reste le <strong>N (Match Nul)</strong>.</p>
          </div>
        </div>

        <div class="guide-section-block">
          <h4 class="gsb-title">🛡️ Les « Doubles Chances » pour sécuriser vos paris</h4>
          <p class="gsb-desc">La Double Chance permet de couvrir <strong>2 résultats possibles sur 3</strong> en un seul pari :</p>

          <div class="guide-table-wrap">
            <table class="guide-table">
              <thead>
                <tr>
                  <th>Sélection</th>
                  <th>Signification</th>
                  <th>Scénarios Gagnants</th>
                  <th>Usage Recommandé</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong class="text-win">1X</strong></td>
                  <td>Équipe Domicile OU Match Nul</td>
                  <td>Victoire Domicile ou Nul (seule la défaite fait perdre)</td>
                  <td>Favori à domicile ou match serré avec avantage terrain</td>
                </tr>
                <tr>
                  <td><strong class="text-win">X2</strong></td>
                  <td>Match Nul OU Équipe Extérieur</td>
                  <td>Match Nul ou Victoire Extérieur</td>
                  <td>Outsider coriace en déplacement ou favori qui voyage</td>
                </tr>
                <tr>
                  <td><strong class="text-win">12</strong></td>
                  <td>Pas de Match Nul</td>
                  <td>Une des deux équipes gagne impérativement</td>
                  <td>Matchs très ouverts et offensifs sans compromis</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  if (tabKey === 'btts') {
    return `
      <div class="guide-panel-fade">
        <div class="guide-hero-banner">
          <div class="ghb-icon">🥅</div>
          <div class="ghb-text">
            <h3>Le « BTTS » — Les Deux Équipes Marquent</h3>
            <p>Acronyme anglais de <em>Both Teams To Score</em>. Ce marché est l'un des plus appréciés car <strong>il ne dépend pas du vainqueur</strong> !</p>
          </div>
        </div>

        <div class="guide-grid-2">
          <div class="guide-card-tile positive">
            <div class="gct-badge gct-btts-yes">BTTS : OUI</div>
            <h4>Les deux équipes marquent au moins 1 but</h4>
            <p>Peu importe le résultat final ou qui gagne le match.</p>
            <div class="gct-examples">
              <span class="ex-tag win">✅ 1 - 1</span>
              <span class="ex-tag win">✅ 2 - 1</span>
              <span class="ex-tag win">✅ 1 - 3</span>
              <span class="ex-tag win">✅ 4 - 2</span>
            </div>
            <div class="gct-note">Dès que le match passe à 1-1, votre pari est gagné, même à la 15e minute !</div>
          </div>

          <div class="guide-card-tile neutral">
            <div class="gct-badge gct-btts-no">BTTS : NON</div>
            <h4>Au moins une des deux équipes ne marque pas</h4>
            <p>Il suffit qu'une seule équipe garde sa cage inviolée (Clean Sheet).</p>
            <div class="gct-examples">
              <span class="ex-tag win">✅ 0 - 0</span>
              <span class="ex-tag win">✅ 1 - 0</span>
              <span class="ex-tag win">✅ 2 - 0</span>
              <span class="ex-tag win">✅ 0 - 3</span>
            </div>
            <div class="gct-note text-warn">Si le score devient 1-1, le pari est définitivement perdu.</div>
          </div>
        </div>

        <div class="guide-section-block">
          <h4 class="gsb-title">💡 Quand faut-il jouer le BTTS selon l'IA ?</h4>
          <ul class="guide-bullet-list">
            <li><strong>BTTS OUI</strong> : À privilégier lorsque deux formations ont une attaque performante (xG &gt; 1.6) mais des défenses fragiles ou des titulaires défensifs blessés.</li>
            <li><strong>BTTS NON</strong> : Idéal sur les matchs tactiques, les confrontations aller-retour frileuses, ou lorsqu'un cador affronte une équipe incapable de marquer à l'extérieur.</li>
          </ul>
        </div>
      </div>
    `;
  }

  if (tabKey === 'value') {
    return `
      <div class="guide-panel-fade">
        <div class="guide-hero-banner value-banner">
          <div class="ghb-icon">💎</div>
          <div class="ghb-text">
            <h3>Qu'est-ce qu'un « Value Bet » (Edge Mathématique +EV) ?</h3>
            <p>Bien plus qu'un simple pronostic "facile" ou "risqué" : c'est <strong>la seule méthode mathématiquement prouvée</strong> pour battre les bookmakers sur le long terme.</p>
          </div>
        </div>

        <div class="guide-formula-card">
          <div class="gfc-header">
            <span>📐</span> <strong>Le Principe Fondamental de la Cote et de la Probabilité</strong>
          </div>
          <p>Toute cote Betclic correspond à une probabilité estimée par le bookmaker :</p>
          <div class="math-formula-box">
            Probabilité implicite du bookmaker = (1 / Cote) × 100%
          </div>
          <div class="formula-examples-row">
            <span>Exemple : Cote à <strong>2.00</strong> = 50% de chances</span>
            <span>Cote à <strong>2.50</strong> = 40% de chances</span>
            <span>Cote à <strong>1.40</strong> = 71.4% de chances</span>
          </div>
        </div>

        <div class="guide-section-block">
          <h4 class="gsb-title">🎯 Comment l'IA détecte une « Valeur » (Edge) ?</h4>
          <p class="gsb-desc">L'IA ne se contente pas des classements. Elle analyse les données profondes (xG réels, blessures clés, fatigue du calendrier, météo et flux de cotes Smart Money). Elle calcule la <strong>vraie probabilité statistique</strong> de l'événement :</p>

          <div class="value-comparison-box">
            <div class="vcb-col">
              <span class="vcb-title">Estimation Betclic</span>
              <span class="vcb-val text-muted">Cote 2.50</span>
              <span class="vcb-sub">Betclic pense qu'il n'y a que <strong>40% de chances</strong></span>
            </div>

            <div class="vcb-vs">VS</div>

            <div class="vcb-col highlight">
              <span class="vcb-title">Probabilité Réelle IA</span>
              <span class="vcb-val text-win">55% Réels</span>
              <span class="vcb-sub">L'analyse démontre <strong>55% de chances</strong></span>
            </div>

            <div class="vcb-col edge">
              <span class="vcb-title">Avantage Mathématique</span>
              <span class="vcb-val text-win">+37.5% d'Edge</span>
              <span class="vcb-sub">Espérance de gain positive (+EV)</span>
            </div>
          </div>
        </div>

        <div class="guide-section-block">
          <h4 class="gsb-title">📊 Démonstration sur 100 paris (Pourquoi vous gagnez à coup sûr)</h4>
          <p class="gsb-desc">Imaginez miser 10 € sur 100 matchs présentant ce type de Value Bet :</p>

          <div class="simu-results-grid">
            <div class="srg-card">
              <span class="srg-num win">55 victoires</span>
              <span class="srg-desc">55 × (10€ × 2.50) = <strong>1 375 € de gains bruts</strong></span>
            </div>
            <div class="srg-card">
              <span class="srg-num loss">45 défaites</span>
              <span class="srg-desc">45 × 10€ = <strong>450 € de pertes</strong></span>
            </div>
            <div class="srg-card total">
              <span class="srg-num total">+375 € NET</span>
              <span class="srg-desc"><strong>+37.5% de Rendement (ROI)</strong> Garanti sur le volume !</span>
            </div>
          </div>

          <div class="guide-warning-note">
            <strong>❌ Le piège du "Pari Sécurisé sans valeur" :</strong>
            Parier sur un grand favori à cote 1.20 n'est PAS un bon pari si sa vraie probabilité n'est que de 70%. Même s'il gagne souvent, vous perdrez 16% de votre capital sur la durée ! C'est pour cela que l'algorithme privilégie toujours l'<strong>Edge mathématique (+EV)</strong>.
          </div>
        </div>
      </div>
    `;
  }

  if (tabKey === 'goals') {
    return `
      <div class="guide-panel-fade">
        <div class="guide-hero-banner">
          <div class="ghb-icon">📊</div>
          <div class="ghb-text">
            <h3>Over / Under & Remboursé si Nul (DNB)</h3>
            <p>Les marchés de protection idéaux pour booster vos combinés avec une variance minimale.</p>
          </div>
        </div>

        <div class="guide-grid-2">
          <div class="guide-card-tile">
            <h4>⚽ Plus de 1.5 Buts (Over 1.5)</h4>
            <p>Il suffit qu'au moins 2 buts soient marqués au total dans le match (1-1, 2-0, 0-2...).</p>
            <div class="gct-note text-win">Taux de réussite moyen : 80% à 85% dans les grands championnats.</div>
          </div>

          <div class="guide-card-tile">
            <h4>🛑 Moins de 3.5 Buts (Under 3.5)</h4>
            <p>Le match doit compter 3 buts ou moins au total (0-0, 1-0, 2-1, 3-0...).</p>
            <div class="gct-note text-win">Filet de sécurité exceptionnel pour les combinés sans faute.</div>
          </div>
        </div>

        <div class="guide-section-block">
          <h4 class="gsb-title">🛡️ Remboursé si Nul (Draw No Bet / DNB)</h4>
          <p class="gsb-desc">Vous pariez sur la victoire d'une équipe, mais si la rencontre se termine sur un match nul, <strong>votre mise vous est intégralement restituée (cote de 1.00)</strong> :</p>
          <ul class="guide-bullet-list">
            <li>Victoire de votre équipe : <strong>Pari Gagné</strong>.</li>
            <li>Match Nul : <strong>Mise Remboursée à 100%</strong> (aucune perte).</li>
            <li>Défaite de votre équipe : <strong>Pari Perdu</strong>.</li>
          </ul>
        </div>
      </div>
    `;
  }

  return '';
}


