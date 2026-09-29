/* ================================================================
   BETCLIC AI DASHBOARD — Main App Entrypoint
   ================================================================ */

let currentPage = 'matches';

function switchPage(page) {
  currentPage = page;

  // Toggle pages
  document.getElementById('page-matches').classList.toggle('hidden', page !== 'matches');
  document.getElementById('page-combined').classList.toggle('hidden', page !== 'combined');

  // Toggle nav buttons active state
  document.getElementById('pnav-matches').classList.toggle('active', page === 'matches');
  document.getElementById('pnav-combined').classList.toggle('active', page === 'combined');

  // Hide the category/filters nav on combined page
  const navPanel = document.querySelector('.navigation-panel');
  if (navPanel) navPanel.style.display = page === 'combined' ? 'none' : '';

  // Initialize combined page on first visit
  if (page === 'combined') {
    initCombinedPage();
  }
}

// Application Initialization
document.addEventListener('DOMContentLoaded', async () => {
  if (!authToken) {
    showLockScreen();
  } else {
    await loadStats();
    await loadMatches();
  }
});
