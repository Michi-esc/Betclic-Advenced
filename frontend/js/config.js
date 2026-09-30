/* ================================================================
   CONFIG, GLOBAL STATE & UTILITIES
   ================================================================ */

const API = '/api';

// ================================================================
// AUTHENTICATION & SINGLE-USER STATE
// ================================================================
let authToken = localStorage.getItem('betclic_auth_token') || '';

function setAuthToken(token) {
  authToken = token || '';
  if (token) {
    localStorage.setItem('betclic_auth_token', token);
  } else {
    localStorage.removeItem('betclic_auth_token');
  }
}

function lockApp() {
  localStorage.removeItem('betclic_auth_token');
  authToken = '';
  if (typeof showLockScreen === 'function') {
    showLockScreen();
  } else {
    window.location.reload();
  }
}

// Global fetch wrapper to auto-authenticate all API calls
const _nativeFetch = window.fetch;
window.fetch = async function(resource, init = {}) {
  init = init || {};
  init.headers = init.headers || {};

  const url = typeof resource === 'string' ? resource : (resource ? resource.url : '');

  if (url && (url.startsWith('/api') || url.includes('/api/'))) {
    if (authToken) {
      if (init.headers instanceof Headers) {
        init.headers.set('Authorization', `Bearer ${authToken}`);
      } else {
        init.headers['Authorization'] = `Bearer ${authToken}`;
      }
    }
  }

  const response = await _nativeFetch(resource, init);

  // If unauthenticated and not the login route, show the lock screen
  if (response.status === 401 && url && !url.includes('/api/auth/login')) {
    if (typeof showLockScreen === 'function') {
      showLockScreen();
    }
  }

  return response;
};

// Global Application State
let allMatches = [];
let activeCategory = 'all';
let activeCompetition = 'all';
let sortBy = 'date';
let searchQuery = '';
let currentMatchId = null;

const CATEGORIES = [
  { id: 'all', label: 'Tous les Matchs', icon: '⭐' },
  { id: 'france', label: 'France', icon: '🇫🇷' },
  { id: 'europe_top', label: 'Grands Championnats', icon: '🏆' },
  { id: 'europe_cups', label: 'Coupes d\'Europe', icon: '🇪🇺' },
  { id: 'international', label: 'International & Sélections', icon: '🌍' },
  { id: 'others', label: 'Autres Ligues', icon: '🌎' },
];

function getCompetitionCategory(competition, country) {
  const comp = (competition || '').toLowerCase();
  const ctry = (country || '').toLowerCase();

  // France
  if (comp.includes('ligue 1') || comp.includes('ligue 2') || comp.includes('coupe de france') || comp.includes('trophée des champions') || ctry === 'france') {
    return 'france';
  }

  // European cups
  if (comp.includes('champions') || comp.includes('europa') || comp.includes('conference') || comp.includes('euroligue') || comp.includes('super coupe d\'europe')) {
    return 'europe_cups';
  }

  // Big European Leagues (exclude Wales)
  if (
    (comp.includes('premier league') && !comp.includes('galles')) ||
    comp.includes('laliga') || comp.includes('la liga') ||
    comp.includes('bundesliga') || comp.includes('serie a') || comp.includes('eredivisie') ||
    comp.includes('liga portugal') || ['angleterre', 'espagne', 'allemagne', 'italie', 'portugal'].includes(ctry)
  ) {
    if (comp.includes('galles')) return 'others';
    return 'europe_top';
  }

  // International / Selections
  if (
    comp.includes('nations') || comp.includes('amicaux') || comp.includes('espoir') ||
    comp.includes('qualif') || comp.includes('monde') || comp.includes('euro') ||
    ctry === 'international' || ctry === 'europe'
  ) {
    return 'international';
  }

  return 'others';
}

function getCountryFlag(country) {
  const flags = {
    'france': '🇫🇷',
    'angleterre': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'england': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
    'espagne': '🇪🇸',
    'spain': '🇪🇸',
    'italie': '🇮🇹',
    'italy': '🇮🇹',
    'allemagne': '🇩🇪',
    'germany': '🇩🇪',
    'europe': '🇪🇺',
    'portugal': '🇵🇹',
    'belgique': '🇧🇪',
    'pays-bas': '🇳🇱',
    'netherlands': '🇳🇱',
    'turquie': '🇹🇷',
    'turkey': '🇹🇷',
  };
  return flags[(country || '').toLowerCase()] || '⚽';
}

function getBestOdd(h, d, a) {
  const odds = [h, d, a].filter(o => o && o > 0);
  return odds.length ? Math.max(...odds) : null;
}

function formatMatchDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    const days = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
    const months = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'août', 'sep', 'oct', 'nov', 'déc'];
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
  } catch {
    return dateStr;
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[m]));
}

/**
 * Translates any raw or technical selection into crystal-clear Betclic terminology
 */
function formatBetSelectionLabel(selection, market = '1N2', homeTeam = '', awayTeam = '') {
  if (!selection) return 'Sélection non précisée';
  let s = String(selection).trim();
  const m = String(market || '').toLowerCase();
  const h = homeTeam || '';
  const a = awayTeam || '';

  // 1. Shorthand 1, N, 2
  if (s === '1' || s.toLowerCase() === 'domicile') return `Victoire de ${h || 'l\'équipe 1'}`;
  if (s === 'N' || s.toLowerCase() === 'nul' || s.toLowerCase() === 'match nul' || s.toLowerCase() === 'x') return 'Match Nul';
  if (s === '2' || s.toLowerCase() === 'extérieur') return `Victoire de ${a || 'l\'équipe 2'}`;

  // 2. Double Chance
  if (s === '1N' || s === '1X' || s.toLowerCase() === '1n' || s.toLowerCase() === '1x') {
    return `${h || 'Équipe 1'} ou Nul (Double Chance)`;
  }
  if (s === 'N2' || s === 'X2' || s.toLowerCase() === 'n2' || s.toLowerCase() === 'x2') {
    return `Nul ou ${a || 'Équipe 2'} (Double Chance)`;
  }
  if (s === '12' || s.toLowerCase() === '12') {
    return `${h || 'Équipe 1'} ou ${a || 'Équipe 2'} (Pas de Nul)`;
  }

  // 3. Over / Under (Total Buts)
  if (m.includes('over') || m.includes('under') || m.includes('but') || s.includes('+') || s.includes('-')) {
    if (s.includes('+') || s.toLowerCase().includes('plus') || s.toLowerCase().includes('over')) {
      const num = s.match(/[0-9]+\.?[0-9]*/);
      return `Plus de ${num ? num[0] : '2,5'} Buts dans le match`;
    }
    if (s.includes('-') || s.toLowerCase().includes('moins') || s.toLowerCase().includes('under')) {
      const num = s.match(/[0-9]+\.?[0-9]*/);
      return `Moins de ${num ? num[0] : '2,5'} Buts dans le match`;
    }
  }

  // 4. BTTS (Les 2 marquent)
  if (m.includes('btts') || m.includes('deux') || m.includes('marquent')) {
    if (s.toLowerCase().includes('oui') || s.toLowerCase().includes('yes')) return 'Les 2 équipes marquent : OUI';
    if (s.toLowerCase().includes('non') || s.toLowerCase().includes('no')) return 'Les 2 équipes marquent : NON';
  }

  // 5. Draw No Bet (Remboursé si nul)
  if (m.includes('dnb') || m.includes('remboursé') || s.toLowerCase().includes('remboursé')) {
    if (s.includes('1') || (h && s.includes(h))) return `${h} (Remboursé si match nul)`;
    if (s.includes('2') || (a && s.includes(a))) return `${a} (Remboursé si match nul)`;
  }

  // Clean common raw prefixes
  s = s.replace(/^Victoire de /i, 'Victoire ').replace(/^Victoire du /i, 'Victoire ');
  return s;
}

function cleanMarketLabel(market) {
  const m = (market || '1N2').toLowerCase();
  if (m.includes('1n2') || m.includes('résultat')) return 'Résultat du Match (1N2)';
  if (m.includes('double')) return 'Double Chance (1N, N2, 12)';
  if (m.includes('over') || m.includes('under') || m.includes('total') || m.includes('but')) return 'Total Buts (+/- 2.5)';
  if (m.includes('btts') || m.includes('deux') || m.includes('marquent')) return 'Les deux équipes marquent';
  if (m.includes('dnb') || m.includes('remboursé')) return 'Remboursé si Nul (DNB)';
  if (m.includes('value')) return 'Pépite Value Bet (Edge +)';
  return market || '1N2';
}

/**
 * Calculates or extracts the best odd value for a given selection and match
 */
function getOddForSelection(selection, market = '1N2', match = null) {
  if (!match) return 1.85;
  const s = String(selection || '').toLowerCase();
  const h = (match.home_team || '').toLowerCase();
  const a = (match.away_team || '').toLowerCase();
  const m = String(market || '').toLowerCase();

  // 1N2
  if (s === '1' || s === 'domicile' || (h && s.includes(h))) {
    return match.odds_home || 1.85;
  }
  if (s === 'n' || s === 'nul' || s === 'match nul' || s === 'x') {
    return match.odds_draw || 3.20;
  }
  if (s === '2' || s === 'extérieur' || (a && s.includes(a))) {
    return match.odds_away || 2.10;
  }

  // Double Chance approximation if not provided
  if (m.includes('double') || s.includes('double') || s.includes('ou nul')) {
    if (s.includes('1n') || (h && s.includes(h))) {
      const p1 = 1 / (match.odds_home || 2.0);
      const pn = 1 / (match.odds_draw || 3.2);
      return Number(Math.max(1.15, (1 / (p1 + pn)) * 0.95).toFixed(2));
    }
    if (s.includes('n2') || (a && s.includes(a))) {
      const p2 = 1 / (match.odds_away || 2.5);
      const pn = 1 / (match.odds_draw || 3.2);
      return Number(Math.max(1.15, (1 / (p2 + pn)) * 0.95).toFixed(2));
    }
  }

  // Default fallback
  return match.odds_home || 1.85;
}

