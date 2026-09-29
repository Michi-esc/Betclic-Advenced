/* ================================================================
   BETCLIC AI DASHBOARD — Main App Entrypoint
   ================================================================ */

let currentPage = 'matches';

function switchPage(page) {
  currentPage = page;

  // Toggle pages visibility
  const pages = ['matches', 'combined', 'bankroll', 'settings'];
  pages.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.toggle('hidden', p !== page);

    // Desktop nav buttons
    const pnav = document.getElementById(`pnav-${p}`);
    if (pnav) pnav.classList.toggle('active', p === page);

    // Mobile bottom nav buttons
    const bnav = document.getElementById(`bnav-${p}`);
    if (bnav) bnav.classList.toggle('active', p === page);
  });

  // Hide the category & sub-competition filters when not on matches page
  const navPanel = document.querySelector('.navigation-panel');
  if (navPanel) {
    navPanel.style.display = page === 'matches' ? '' : 'none';
  }

  // Page-specific initialization / refresh
  if (page === 'combined') {
    initCombinedPage();
  } else if (page === 'bankroll') {
    loadBankroll();
  } else if (page === 'settings') {
    loadSettings();
  } else if (page === 'matches') {
    renderMatches();
  }

  // Smoothly scroll to top on mobile
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Application Initialization
document.addEventListener('DOMContentLoaded', async () => {
  if (!authToken) {
    showLockScreen();
  } else {
    await loadStats();
    await loadMatches();
    // Preload bankroll stats in background
    if (typeof loadBankroll === 'function') {
      loadBankroll().catch(() => {});
    }
  }
});

