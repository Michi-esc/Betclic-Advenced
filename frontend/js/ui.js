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
    if (sortBy === 'date') {
      return (a.match_date + a.match_time).localeCompare(b.match_date + b.match_time);
    }
    if (sortBy === 'odds_home') return (a.odds_home || 99) - (b.odds_home || 99);
    if (sortBy === 'odds_away') return (a.odds_away || 99) - (b.odds_away || 99);
    if (sortBy === 'competition') return a.competition.localeCompare(b.competition);
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

  return `
    <div class="match-card ${isAnalyzed ? 'analyzed' : ''} ${hasValueBet ? 'has-value-bet' : ''}" id="card-${match.id}">
      <div class="card-competition">
        <div class="competition-badge">
          <span class="competition-flag">${flag}</span>
          <span class="competition-name">${escapeHtml(match.competition)}</span>
        </div>
        <div class="match-datetime">
          ${isToday ? `<span class="badge-today">⏰ Aujourd'hui</span>` : ''}
          ${hasValueBet ? `<span class="badge-value-pulse">💎 VALUE (${escapeHtml(topVb.value_edge)})</span>` : ''}
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
        <div class="odd-box" title="${escapeHtml(match.home_team)}">
          <span class="odd-label">1</span>
          <span class="odd-value ${bestOdd === match.odds_home ? 'best-odd' : ''}">${match.odds_home ? match.odds_home.toFixed(2) : '—'}</span>
        </div>
        <div class="odd-box" title="Match nul">
          <span class="odd-label">N</span>
          <span class="odd-value ${bestOdd === match.odds_draw ? 'best-odd' : ''}">${match.odds_draw ? match.odds_draw.toFixed(2) : '—'}</span>
        </div>
        <div class="odd-box" title="${escapeHtml(match.away_team)}">
          <span class="odd-label">2</span>
          <span class="odd-value ${bestOdd === match.odds_away ? 'best-odd' : ''}">${match.odds_away ? match.odds_away.toFixed(2) : '—'}</span>
        </div>
      </div>

      ${isAnalyzed ? (() => {
        const tags = [];
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
          tags.push(`<span class="card-tag tag-value">💎 ${raw.value_bets_structured.length} Value Bet(s)</span>`);
        }
        return `
          <div class="card-ai-preview">
            <div class="ai-preview-header">
              <span class="ai-pill">✨ IA</span>
              <span class="ai-pred-text">${escapeHtml(match.ai_prediction)}</span>
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
                  onclick="openModal(${match.id})"
                  id="analyze-btn-${match.id}">
            ${isAnalyzed ? '🧠 Voir l\'analyse' : '🤖 Analyser avec l\'IA'}
          </button>
        </div>
      </div>
    </div>
  `;
}

function quickBetFromMatch(matchId, event) {
  if (event) event.stopPropagation();
  const match = allMatches.find(m => m.id === matchId);
  if (!match) return;

  let raw = {};
  try { raw = JSON.parse(match.raw_research || '{}'); } catch (_) {}

  // If match has a value bet, prefill with value bet!
  if (Array.isArray(raw.value_bets_structured) && raw.value_bets_structured.length > 0) {
    const vb = raw.value_bets_structured[0];
    if (typeof openAddBetModal === 'function') {
      openAddBetModal({
        title: `${match.home_team} vs ${match.away_team}`,
        selection: vb.selection,
        market: vb.market || 'Value Bet',
        odds: vb.bookmaker_odds || match.odds_home || 1.85,
        stake: 25,
        bet_type: 'single',
        match_id: match.id,
        notes: `Value Bet Edge ${vb.value_edge} — ${vb.rationale || ''}`
      });
    }
    return;
  }

  // Otherwise prefill with AI prediction or home win
  if (typeof openAddBetModal === 'function') {
    openAddBetModal({
      title: `${match.home_team} vs ${match.away_team}`,
      selection: match.ai_prediction || `Victoire ${match.home_team}`,
      market: '1N2',
      odds: match.odds_home || 1.85,
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

