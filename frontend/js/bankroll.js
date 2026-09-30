/* ================================================================
   BANKROLL MANAGER & BET TRACKER
   ================================================================ */

let bankrollData = {
  settings: { initial_bankroll: 1000, current_bankroll: 1000, currency: '€', kelly_fraction: 0.25 },
  stats: {
    initial_bankroll: 1000,
    current_bankroll: 1000,
    currency: '€',
    total_bets: 0,
    pending_count: 0,
    won_count: 0,
    lost_count: 0,
    void_count: 0,
    win_rate: 0,
    total_staked: 0,
    pending_staked: 0,
    total_profit: 0,
    roi: 0,
    growth: 0
  },
  bets: []
};

let activeBankrollFilter = 'all'; // 'all', 'pending', 'settled'
let bankrollViewMode = localStorage.getItem('bankroll_view_mode') || 'table'; // 'table' or 'cards'

function setBankrollView(mode) {
  bankrollViewMode = mode;
  localStorage.setItem('bankroll_view_mode', mode);
  renderBankrollPage();
}

async function loadBankroll() {
  try {
    const res = await fetch(`${API}/bankroll`);
    const data = await res.json();
    if (data.success) {
      bankrollData = data.data;
      renderBankrollPage();
    } else {
      showToast(`Erreur chargement bankroll: ${data.error}`, 'error');
    }
  } catch (err) {
    console.error('loadBankroll error:', err);
    showToast('Erreur connexion bankroll', 'error');
  }
}

function renderBankrollPage() {
  const container = document.getElementById('bankroll-page');
  if (!container) return;

  const { stats, settings, bets } = bankrollData;
  const currency = settings.currency || '€';
  const isProfitPositive = (stats.total_profit || 0) >= 0;

  // Filter bets based on active tab
  let filteredBets = [...bets];
  if (activeBankrollFilter === 'pending') {
    filteredBets = filteredBets.filter(b => b.status === 'pending');
  } else if (activeBankrollFilter === 'settled') {
    filteredBets = filteredBets.filter(b => b.status !== 'pending');
  }

  container.innerHTML = `
    <div class="bankroll-container">
      
      <!-- Top Summary Cards -->
      <div class="bankroll-stats-grid">
        <div class="b-stat-card primary">
          <div class="b-stat-label">Capital Actuel</div>
          <div class="b-stat-value main-balance">${formatMoney(stats.current_bankroll, currency)}</div>
          <div class="b-stat-sub ${stats.growth >= 0 ? 'pos' : 'neg'}">
            ${stats.growth >= 0 ? '▲ +' : '▼ '}${stats.growth}% vs départ (${formatMoney(stats.initial_bankroll, currency)})
          </div>
        </div>

        <div class="b-stat-card">
          <div class="b-stat-label">Bénéfice Net</div>
          <div class="b-stat-value ${isProfitPositive ? 'text-win' : 'text-loss'}">
            ${isProfitPositive ? '+' : ''}${formatMoney(stats.total_profit, currency)}
          </div>
          <div class="b-stat-sub">
            Misé : ${formatMoney(stats.total_staked, currency)}
          </div>
        </div>

        <div class="b-stat-card">
          <div class="b-stat-label">ROI (Rendement)</div>
          <div class="b-stat-value ${stats.roi >= 0 ? 'text-win' : 'text-loss'}">
            ${stats.roi >= 0 ? '+' : ''}${stats.roi}%
          </div>
          <div class="b-stat-sub">Sur paris terminés</div>
        </div>

        <div class="b-stat-card">
          <div class="b-stat-label">Taux de Réussite</div>
          <div class="b-stat-value text-accent">${stats.win_rate}%</div>
          <div class="b-stat-sub">
            ${stats.won_count}V / ${stats.lost_count}D (${stats.pending_count} en cours)
          </div>
        </div>
      </div>

      <!-- Action & Filter Bar -->
      <div class="bankroll-actions-bar">
        <div class="bankroll-filter-chips">
          <button class="b-filter-chip ${activeBankrollFilter === 'all' ? 'active' : ''}" onclick="setBankrollFilter('all')">
            Tous (${bets.length})
          </button>
          <button class="b-filter-chip ${activeBankrollFilter === 'pending' ? 'active' : ''}" onclick="setBankrollFilter('pending')">
            ⏳ En cours (${stats.pending_count})
          </button>
          <button class="b-filter-chip ${activeBankrollFilter === 'settled' ? 'active' : ''}" onclick="setBankrollFilter('settled')">
            ✅ Terminés (${bets.length - stats.pending_count})
          </button>
        </div>

        <div class="bankroll-view-toggle">
          <button class="b-view-btn ${bankrollViewMode === 'table' ? 'active' : ''}" onclick="setBankrollView('table')" title="Affichage tableau simple et structuré">
            📊 Tableau Simple
          </button>
          <button class="b-view-btn ${bankrollViewMode === 'cards' ? 'active' : ''}" onclick="setBankrollView('cards')" title="Affichage en cartes détaillées">
            🗂️ Vue Cartes
          </button>
        </div>

        <div class="bankroll-action-buttons">
          <button class="btn btn-auto-settle" onclick="triggerAutoSettle()" id="btn-auto-settle" title="Vérifier les scores des matchs et solder automatiquement vos paris">
            <span>⚡</span>
            <span>Solder automatiquement</span>
          </button>
          <button class="btn btn-add-bet" onclick="openAddBetModal()">
            <span>➕</span>
            <span>Nouveau Pari</span>
          </button>
        </div>
      </div>

      <!-- Bets List -->
      <div class="bets-list-section">
        ${filteredBets.length === 0 ? `
          <div class="empty-bets-state">
            <div class="empty-bets-icon">💰</div>
            <h3>Aucun pari enregistré</h3>
            <p>Cliquez sur "Nouveau Pari" ou utilisez le bouton "Miser" directement sur un match ou un combiné pour l'ajouter à votre bankroll.</p>
          </div>
        ` : bankrollViewMode === 'table' ? renderBetsTable(filteredBets, currency) : `
          <div class="bets-cards-grid">
            ${filteredBets.map(bet => renderBetItem(bet, currency)).join('')}
          </div>
        `}
      </div>

    </div>
  `;
}

function renderBetsTable(bets, currency) {
  return `
    <div class="bankroll-table-wrapper">
      <table class="pro-bankroll-table">
        <thead>
          <tr>
            <th>Date & Statut</th>
            <th>Match / Événement</th>
            <th>Pari à Jouer sur Betclic</th>
            <th>Marché</th>
            <th>Cote</th>
            <th>Mise</th>
            <th>Gain Pot. / Bénéfice Net</th>
            <th>Actions Rapides</th>
          </tr>
        </thead>
        <tbody>
          ${bets.map(bet => {
            const isPending = bet.status === 'pending';
            const isWon = bet.status === 'won';
            const isLost = bet.status === 'lost';
            const isVoid = bet.status === 'void';

            const statusBadge = isPending 
              ? '<span class="bet-badge pending">⏳ En cours</span>'
              : isWon
              ? '<span class="bet-badge won">✅ Gagné</span>'
              : isLost
              ? '<span class="bet-badge lost">❌ Perdu</span>'
              : '<span class="bet-badge void">⚪ Annulé</span>';

            const dateFormatted = new Date(bet.placed_at || Date.now()).toLocaleDateString('fr-FR', {
              day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
            });

            const cleanSel = formatBetSelectionLabel(bet.selection, bet.market);
            const cleanMkt = cleanMarketLabel(bet.market);

            let profitCell = '';
            if (isPending) {
              const potProfit = bet.potential_payout - bet.stake;
              profitCell = `<span class="tbl-profit pending" title="Gain potentiel si gagné">+${formatMoney(potProfit, currency)}</span>`;
            } else if (isWon) {
              profitCell = `<span class="tbl-profit won">+${formatMoney(bet.profit, currency)}</span>`;
            } else if (isLost) {
              profitCell = `<span class="tbl-profit lost">${formatMoney(bet.profit, currency)}</span>`;
            } else {
              profitCell = `<span class="tbl-profit void">0.00 ${currency}</span>`;
            }

            return `
              <tr class="bankroll-row ${bet.status}">
                <td class="tbl-date-status">
                  <div class="tbl-status-wrap">${statusBadge}</div>
                  <div class="tbl-date-sub">${dateFormatted}</div>
                </td>
                <td class="tbl-match-cell">
                  <div class="tbl-match-title" title="${escapeHtml(bet.title)}">${escapeHtml(bet.title)}</div>
                  <span class="tbl-type-pill ${bet.bet_type}">${bet.bet_type === 'combined' ? '⚡ Combiné' : '⚽ Simple'}</span>
                  ${bet.notes ? `<div class="tbl-notes-snippet" title="${escapeHtml(bet.notes)}">💡 ${escapeHtml(bet.notes)}</div>` : ''}
                </td>
                <td class="tbl-sel-cell">
                  <strong class="tbl-bet-name">${escapeHtml(cleanSel)}</strong>
                </td>
                <td class="tbl-market-cell">
                  <span class="table-market-tag">${escapeHtml(cleanMkt)}</span>
                </td>
                <td class="tbl-odds-cell">
                  <span class="table-odd-pill">${Number(bet.odds).toFixed(2)}</span>
                </td>
                <td class="tbl-stake-cell">
                  <span class="tbl-stake-val">${formatMoney(bet.stake, currency)}</span>
                </td>
                <td class="tbl-result-cell">
                  ${profitCell}
                </td>
                <td class="tbl-actions-cell">
                  <div class="tbl-actions-btn-group">
                    ${isPending ? `
                      <button class="btn-tbl-action win" onclick="settleBet(${bet.id}, 'won')" title="Marquer comme gagné">✅</button>
                      <button class="btn-tbl-action loss" onclick="settleBet(${bet.id}, 'lost')" title="Marquer comme perdu">❌</button>
                      <button class="btn-tbl-action void" onclick="settleBet(${bet.id}, 'void')" title="Annulé / Remboursé">⚪</button>
                    ` : `
                      <button class="btn-tbl-action re-pending" onclick="settleBet(${bet.id}, 'pending')" title="Remettre en cours">↩️</button>
                    `}
                    <button class="btn-tbl-action delete" onclick="deleteBet(${bet.id})" title="Supprimer ce pari">🗑️</button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderBetItem(bet, currency) {
  const isPending = bet.status === 'pending';
  const isWon = bet.status === 'won';
  const isLost = bet.status === 'lost';
  const isVoid = bet.status === 'void';

  const statusBadge = isPending 
    ? '<span class="bet-badge pending">⏳ En attente</span>'
    : isWon
    ? '<span class="bet-badge won">✅ Gagné</span>'
    : isLost
    ? '<span class="bet-badge lost">❌ Perdu</span>'
    : '<span class="bet-badge void">⚪ Annulé</span>';

  const profitDisplay = isPending
    ? `<span class="profit-pending">Gain pot. : +${formatMoney(bet.potential_payout - bet.stake, currency)}</span>`
    : isWon
    ? `<span class="profit-won">+${formatMoney(bet.profit, currency)}</span>`
    : isLost
    ? `<span class="profit-lost">${formatMoney(bet.profit, currency)}</span>`
    : `<span class="profit-void">0.00 ${currency}</span>`;

  const dateFormatted = new Date(bet.placed_at || Date.now()).toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
  });

  const cleanSel = formatBetSelectionLabel(bet.selection, bet.market);
  const cleanMkt = cleanMarketLabel(bet.market);

  return `
    <div class="bet-card ${bet.status}">
      <div class="bet-card-header">
        <div class="bet-type-title">
          <span class="bet-type-tag ${bet.bet_type}">
            ${bet.bet_type === 'combined' ? '⚡ Combiné' : '⚽ Simple'}
          </span>
          <h4 class="bet-match-title" title="${escapeHtml(bet.title)}">${escapeHtml(bet.title)}</h4>
        </div>
        ${statusBadge}
      </div>

      <div class="bet-card-body">
        <div class="bet-selection-row">
          <span class="bet-sel-label">Sélection :</span>
          <span class="bet-sel-value"><strong>${escapeHtml(cleanSel)}</strong></span>
          ${cleanMkt ? `<span class="bet-market-pill">${escapeHtml(cleanMkt)}</span>` : ''}
        </div>

        <div class="bet-numbers-row">
          <div class="bet-num-col">
            <span class="num-lbl">Cote</span>
            <span class="num-val odds-val">${Number(bet.odds).toFixed(2)}</span>
          </div>
          <div class="bet-num-col">
            <span class="num-lbl">Mise</span>
            <span class="num-val">${formatMoney(bet.stake, currency)}</span>
          </div>
          <div class="bet-num-col">
            <span class="num-lbl">${isPending ? 'Gain pot.' : 'Résultat'}</span>
            <span class="num-val payout-val">${profitDisplay}</span>
          </div>
        </div>

        ${bet.notes ? `<div class="bet-notes-snippet">💡 ${escapeHtml(bet.notes)}</div>` : ''}
      </div>

      <div class="bet-card-footer">
        <span class="bet-date">${dateFormatted}</span>
        
        <div class="bet-actions-group">
          ${isPending ? `
            <button class="btn-bet-action win" onclick="settleBet(${bet.id}, 'won')" title="Marquer comme gagné">
              ✅ Gagné
            </button>
            <button class="btn-bet-action loss" onclick="settleBet(${bet.id}, 'lost')" title="Marquer comme perdu">
              ❌ Perdu
            </button>
            <button class="btn-bet-action void" onclick="settleBet(${bet.id}, 'void')" title="Annulé / Remboursé">
              ⚪
            </button>
          ` : `
            <button class="btn-bet-action re-pending" onclick="settleBet(${bet.id}, 'pending')" title="Remettre en cours">
              ↩️ Rouvrir
            </button>
          `}
          <button class="btn-bet-action delete" onclick="deleteBet(${bet.id})" title="Supprimer ce pari">
            🗑️
          </button>
        </div>
      </div>
    </div>
  `;
}

function setBankrollFilter(filter) {
  activeBankrollFilter = filter;
  renderBankrollPage();
}

async function settleBet(betId, status) {
  try {
    const res = await fetch(`${API}/bankroll/bet/${betId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      await loadBankroll();
    } else {
      showToast(`Erreur: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast('Erreur de mise à jour du pari', 'error');
  }
}

async function deleteBet(betId) {
  if (!confirm('Supprimer définitivement ce pari de votre bankroll ?')) return;
  try {
    const res = await fetch(`${API}/bankroll/bet/${betId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Pari supprimé', 'info');
      await loadBankroll();
    } else {
      showToast(`Erreur: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast('Erreur suppression du pari', 'error');
  }
}

// Add Bet modal handlers
function openAddBetModal(prefill = {}) {
  let modal = document.getElementById('add-bet-modal');
  if (!modal) {
    modal = createAddBetModal();
  }

  const cleanSel = formatBetSelectionLabel(prefill.selection || '', prefill.market || '1N2');
  const cleanMkt = cleanMarketLabel(prefill.market || '1N2');

  // Pre-fill fields if triggered from a match card or combined
  document.getElementById('ab-title').value = prefill.title || '';
  document.getElementById('ab-selection').value = cleanSel || '';
  document.getElementById('ab-market').value = cleanMkt || '1N2';
  document.getElementById('ab-odds').value = prefill.odds ? Number(prefill.odds).toFixed(2) : '';
  document.getElementById('ab-stake').value = prefill.stake || '20';
  document.getElementById('ab-type').value = prefill.bet_type || 'single';
  document.getElementById('ab-match-id').value = prefill.match_id || '';
  document.getElementById('ab-notes').value = prefill.notes || '';

  modal.classList.remove('hidden');
}

function closeAddBetModal() {
  const modal = document.getElementById('add-bet-modal');
  if (modal) modal.classList.add('hidden');
}

async function submitAddBet(e) {
  if (e && e.preventDefault) e.preventDefault();

  const title = document.getElementById('ab-title').value.trim();
  const selection = document.getElementById('ab-selection').value.trim();
  const market = document.getElementById('ab-market').value.trim();
  const odds = parseFloat(document.getElementById('ab-odds').value);
  const stake = parseFloat(document.getElementById('ab-stake').value);
  const bet_type = document.getElementById('ab-type').value;
  const match_id = document.getElementById('ab-match-id').value || null;
  const notes = document.getElementById('ab-notes').value.trim();

  if (!title || !selection || !odds || !stake) {
    showToast('Veuillez remplir tous les champs obligatoires.', 'warning');
    return;
  }

  try {
    const res = await fetch(`${API}/bankroll/bet`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title, selection, market, odds, stake, bet_type, match_id, notes
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('💰 Pari ajouté à votre Bankroll !', 'success');
      closeAddBetModal();
      await loadBankroll();
    } else {
      showToast(`Erreur: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast('Erreur ajout du pari', 'error');
  }
}

function createAddBetModal() {
  const div = document.createElement('div');
  div.id = 'add-bet-modal';
  div.className = 'modal-overlay hidden';
  div.onclick = (e) => { if (e.target === div) closeAddBetModal(); };

  div.innerHTML = `
    <div class="modal add-bet-card">
      <button class="modal-close" onclick="closeAddBetModal()">✕</button>
      <div class="modal-header">
        <h3 class="add-bet-modal-title">💰 Enregistrer un Pari</h3>
        <p class="add-bet-modal-sub">Ajoutez ce pari à votre gestion de bankroll et suivez votre retour sur investissement.</p>
      </div>

      <form onsubmit="submitAddBet(event)" class="add-bet-form">
        <input type="hidden" id="ab-match-id" />
        <input type="hidden" id="ab-type" value="single" />

        <div class="form-group">
          <label>Événement / Match *</label>
          <input type="text" id="ab-title" class="modal-input" placeholder="Ex: Arsenal vs Chelsea" required />
        </div>

        <div class="form-row">
          <div class="form-group flex-2">
            <label>Sélection *</label>
            <input type="text" id="ab-selection" class="modal-input" placeholder="Ex: Victoire Arsenal" required />
          </div>
          <div class="form-group flex-1">
            <label>Marché</label>
            <input type="text" id="ab-market" class="modal-input" placeholder="1N2, BTTS..." />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group flex-1">
            <label>Cote *</label>
            <input type="number" step="0.01" min="1.01" id="ab-odds" class="modal-input" placeholder="1.85" required />
          </div>
          <div class="form-group flex-1">
            <label>Mise (€) *</label>
            <input type="number" step="1" min="1" id="ab-stake" class="modal-input" placeholder="20" required />
          </div>
        </div>

        <div class="form-group">
          <label>Notes / Justification IA (optionnel)</label>
          <input type="text" id="ab-notes" class="modal-input" placeholder="Ex: Value Bet +12% EV détecté par Gemini" />
        </div>

        <div class="modal-actions-bar">
          <button type="button" class="btn btn-secondary" onclick="closeAddBetModal()">Annuler</button>
          <button type="submit" class="btn btn-primary-gradient">✅ Confirmer & Enregistrer</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(div);
  return div;
}

function formatMoney(amount, currency = '€') {
  const val = typeof amount === 'number' ? amount : parseFloat(amount || 0);
  return `${val.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

async function triggerAutoSettle(forceAll = false) {
  const btn = document.getElementById('btn-auto-settle');
  if (btn) {
    btn.disabled = true;
    btn.classList.add('loading');
    btn.innerHTML = '<span>⏳</span><span>Vérification scores...</span>';
  }

  showToast('⚡ Vérification des scores finaux et règlement automatique...', 'info');

  try {
    const res = await fetch(`${API}/bankroll/auto-settle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ forceAll })
    });
    const data = await res.json();

    if (data.success) {
      const { settledCount, wonCount, lostCount, totalProfit } = data.data;
      if (settledCount > 0) {
        const sign = totalProfit >= 0 ? '+' : '';
        showToast(`🎉 ${settledCount} pari(s) soldé(s) automatiquement : ${wonCount} Gagné(s), ${lostCount} Perdu(s) (${sign}${totalProfit}€) !`, 'success');
      } else {
        showToast('ℹ️ Aucun match terminé à solder pour l\'instant. Le cron surveille automatiquement 24h/24 !', 'info');
      }
      await loadBankroll();
    } else {
      showToast(`Erreur: ${data.error}`, 'error');
    }
  } catch (err) {
    console.error('Auto settle error:', err);
    showToast('Erreur lors du règlement automatique des paris', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.innerHTML = '<span>⚡</span><span>Solder automatiquement</span>';
    }
  }
}
