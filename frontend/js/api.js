/* ================================================================
   API CLIENT
   ================================================================ */

async function loadMatches() {
  showLoading(true);

  try {
    const res = await fetch(`${API}/matches`);
    const data = await res.json();

    if (!data.success) throw new Error(data.error);

    allMatches = data.data || [];

    if (allMatches.length === 0) {
      showLoading(false);
      document.getElementById('empty-state').classList.remove('hidden');
      return;
    }

    buildCategoryTabs();
    buildCompetitionFilters();
    renderMatches();
    showLoading(false);
  } catch (err) {
    console.error('loadMatches error:', err);
    showLoading(false);
    document.getElementById('empty-state').classList.remove('hidden');
    showToast('Erreur de connexion au serveur', 'error');
  }
}

async function loadStats() {
  try {
    const res = await fetch(`${API}/stats`);
    const data = await res.json();

    if (data.success) {
      document.getElementById('stat-total').textContent = data.data.totalMatches || '0';
      document.getElementById('stat-analyzed').textContent = data.data.analyzedMatches || '0';

      if (data.data.lastScrape) {
        const d = new Date(data.data.lastScrape);
        document.getElementById('stat-update').textContent = formatTimeAgo(d);
      } else {
        document.getElementById('stat-update').textContent = 'Jamais';
      }
    }
  } catch (err) {
    console.error('loadStats error:', err);
  }
}

async function triggerScrape() {
  const btn = document.getElementById('btn-scrape');
  btn.classList.add('loading');
  btn.disabled = true;
  btn.querySelector('span:last-child').textContent = 'Scraping...';

  try {
    showToast('🔄 Scraping Betclic en cours...', 'info');
    const res = await fetch(`${API}/scrape`, { method: 'POST' });
    const data = await res.json();

    if (data.success) {
      showToast(`✅ ${data.inserted} matchs récupérés !`, 'success');
      await loadStats();
      await loadMatches();
    } else {
      showToast(`❌ Erreur: ${data.error}`, 'error');
    }
  } catch (err) {
    showToast('❌ Impossible de contacter le serveur', 'error');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
    btn.querySelector('span:last-child').textContent = 'Actualiser';
  }
}
