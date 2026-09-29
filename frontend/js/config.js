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
