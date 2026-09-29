/**
 * Parser for Betclic SSR (Server-Side Rendered) HTML & Embedded gRPC JSON State
 */

// Normalise raw Betclic competition names to clean canonical names
function normalizeCompetition(name, country) {
  const n = (name || '').toLowerCase().trim();

  // --- France ---
  if (n.includes('ligue 1') || n.includes('ligue1')) return { competition: 'Ligue 1', country: 'France' };
  if (n.includes('ligue 2')) return { competition: 'Ligue 2', country: 'France' };
  if (n.includes('coupe de france')) return { competition: 'Coupe de France', country: 'France' };
  if (n.includes('national') && n.includes('fr')) return { competition: 'National', country: 'France' };

  // --- Top 5 leagues ---
  if (n.includes('premier league') && !n.includes('galles') && !n.includes('wales')) return { competition: 'Premier League', country: 'Angleterre' };
  if (n.includes('laliga') || n.includes('la liga') || n.includes('primera') || n.includes('liga espagnole')) return { competition: 'LaLiga', country: 'Espagne' };
  if (n.includes('bundesliga') && !n.includes('2')) return { competition: 'Bundesliga', country: 'Allemagne' };
  if (n.includes('2. bundesliga') || n.includes('2.bundesliga')) return { competition: '2. Bundesliga', country: 'Allemagne' };
  if (n.includes('serie a') && !n.includes('brésil')) return { competition: 'Serie A', country: 'Italie' };
  if (n.includes('serie b')) return { competition: 'Serie B', country: 'Italie' };
  if (n.includes('eredivisie')) return { competition: 'Eredivisie', country: 'Pays-Bas' };
  if (n.includes('liga portugal') || n.includes('primeira liga')) return { competition: 'Liga Portugal', country: 'Portugal' };

  // --- European cups ---
  if (n.includes('ligue des champions') || n.includes('champions league') || n.includes('ucl')) return { competition: 'Ligue des Champions', country: 'Europe' };
  if (n.includes('europa league') || n.includes('ligue europa')) return { competition: 'Europa League', country: 'Europe' };
  if (n.includes('conference league') || n.includes('conférence')) return { competition: 'Conference League', country: 'Europe' };
  if (n.includes('super coupe') || n.includes('supercup')) return { competition: 'Super Coupe', country: 'Europe' };

  // --- International ---
  if (n.includes('ligue des nations') || n.includes('nations league') || n.includes('nations uefa')) return { competition: 'Ligue des Nations UEFA', country: 'Europe' };
  if (n.includes('qualif') && (n.includes('monde') || n.includes('world cup'))) return { competition: 'Qualifications Coupe du Monde', country: 'International' };
  if (n.includes('qualif') && n.includes('euro')) return { competition: 'Qualifications Euro', country: 'Europe' };
  if (n.includes('euro espoir') || (n.includes('qualif') && n.includes('espoir'))) return { competition: 'Qualif. Euro Espoirs', country: 'International' };
  if (n.includes('espoir') || n.includes('u21') || n.includes('u20') || n.includes('u19')) return { competition: 'Équipes Espoirs', country: 'International' };
  if (n.includes('amicaux') || n.includes('amical')) return { competition: 'Matchs Amicaux', country: 'International' };
  if (n.includes('concacaf')) return { competition: 'CONCACAF Ligue des nations', country: 'International' };
  if (n.includes('copa america') || n.includes('copa lib')) return { competition: 'Copa América', country: 'Amérique du Sud' };
  if (n.includes('african') || n.includes('can ') || n.includes('afcon')) return { competition: 'CAN', country: 'Afrique' };
  if (n.includes('afc') || n.includes('coupe asie')) return { competition: 'Coupe d\'Asie', country: 'Asie' };
  if (n.includes('coupe du monde') || n.includes('world cup')) return { competition: 'Coupe du Monde FIFA', country: 'International' };

  // Return original if no match
  return { competition: name, country };
}

// Sports that are NOT football — used to filter out non-football matches
const NON_FOOTBALL_KEYWORDS = [
  'euroligue', 'nba', 'basket', 'basketball', 'euroleague', 'bbl', 'ncaa',
  'tennis', 'rugby', 'nfl', 'nhl', 'hockey', 'golf', 'handball', 'volleyball',
  'baseball', 'cricket', 'formula', 'moto', 'cyclisme', 'snooker', 'darts',
  'fléchette', 'boxing', 'ufc', 'mma', 'combat',
];

function isFootball(competition) {
  const comp = (competition || '').toLowerCase();
  return !NON_FOOTBALL_KEYWORDS.some(kw => comp.includes(kw));
}

function mapCountryCode(code) {
  const map = {
    FR: 'France', EN: 'Angleterre', ES: 'Espagne', DE: 'Allemagne',
    IT: 'Italie', EU: 'Europe', PT: 'Portugal', NL: 'Pays-Bas',
    BE: 'Belgique', ZZ: 'International', TR: 'Turquie',
    BR: 'Brésil', AR: 'Argentine', US: 'États-Unis', GB: 'Angleterre',
    NZ: 'Nouvelle-Zélande',
  };
  return map[code] || code || '';
}

function formatDate(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  try { return new Date(dateStr).toISOString().split('T')[0]; } catch { return dateStr; }
}

function formatTime(dateStr) {
  if (!dateStr) return '00:00';
  try {
    const d = new Date(dateStr);
    const offset = isDST(d) ? 2 : 1; // CEST / CET
    const localH = (d.getUTCHours() + offset) % 24;
    return `${String(localH).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  } catch { return '00:00'; }
}

function isDST(date) {
  const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  return Math.max(jan, jul) !== date.getTimezoneOffset();
}

function buildMatch(matchId, matchName, matchDateUtc, chunk) {
  const dashIdx = matchName.lastIndexOf(' - ');
  if (dashIdx === -1) return null;
  const homeTeam = matchName.substring(0, dashIdx).trim();
  const awayTeam = matchName.substring(dashIdx + 3).trim();

  // Extract raw competition name & country code
  let rawCompetition = 'Football';
  let rawCountry = '';
  const compNameMatch = chunk.match(/"competition":\{"id":"[^"]+","name":"([^"]+)"/);
  if (compNameMatch) rawCompetition = compNameMatch[1];
  const countryMatch = chunk.match(/"competition":\{"id":"[^"]+","name":"[^"]+","sport":\{[^}]+\},"countryCode":"([^"]+)"/);
  if (countryMatch) rawCountry = mapCountryCode(countryMatch[1]);

  // Also try to detect sport type from SSR JSON to filter non-football
  const sportMatch = chunk.match(/"sport":\{"id":"[^"]+","name":"([^"]+)"/);
  if (sportMatch) {
    const sport = sportMatch[1].toLowerCase();
    if (sport !== 'football' && sport !== 'soccer' && sport !== 'foot') {
      // Not football — skip
      return null;
    }
  }

  // Check competition name against known non-football keywords
  if (!isFootball(rawCompetition)) return null;

  // Normalize competition name to canonical form
  const normalized = normalizeCompetition(rawCompetition, rawCountry);
  const competition = normalized.competition;
  const competitionCountry = normalized.country || rawCountry;

  // Extract odds — look for mainSelections array with odds values
  let oddsHome = null, oddsDraw = null, oddsAway = null;

  const selIdx = chunk.indexOf('"mainSelections":[');
  if (selIdx !== -1) {
    let depth = 0;
    let inArray = false;
    let arrayStart = selIdx + '"mainSelections":'.length;
    let arrayEnd = arrayStart;

    for (let i = arrayStart; i < Math.min(chunk.length, arrayStart + 3000); i++) {
      if (chunk[i] === '[') { depth++; inArray = true; }
      else if (chunk[i] === ']') {
        depth--;
        if (inArray && depth === 0) { arrayEnd = i + 1; break; }
      }
    }

    const selectionsStr = chunk.substring(arrayStart, arrayEnd);
    const oddsMatches = [...selectionsStr.matchAll(/"odds":([\d.]+)/g)];
    if (oddsMatches.length >= 1) oddsHome = parseFloat(oddsMatches[0][1]);
    if (oddsMatches.length >= 2) oddsDraw = parseFloat(oddsMatches[1][1]);
    if (oddsMatches.length >= 3) oddsAway = parseFloat(oddsMatches[2][1]);
  }

  // If still no odds, try market block
  if (oddsHome === null) {
    const marketIdx = chunk.indexOf('"market":{');
    if (marketIdx !== -1) {
      const marketChunk = chunk.substring(marketIdx, marketIdx + 3000);
      const oddsMatches = [...marketChunk.matchAll(/"odds":([\d.]+)/g)];
      if (oddsMatches.length >= 1) oddsHome = parseFloat(oddsMatches[0][1]);
      if (oddsMatches.length >= 2) oddsDraw = parseFloat(oddsMatches[1][1]);
      if (oddsMatches.length >= 3) oddsAway = parseFloat(oddsMatches[2][1]);
    }
  }

  // Round info from competitionInfo
  let venue = '';
  const roundMatch = chunk.match(/"competitionInfo":\{"roundName":"([^"]+)"/);
  if (roundMatch) venue = roundMatch[1];

  return {
    betclic_id: `bc_${matchId}`,
    competition,
    competition_country: competitionCountry,
    home_team: homeTeam,
    away_team: awayTeam,
    match_date: formatDate(matchDateUtc),
    match_time: formatTime(matchDateUtc),
    venue,
    odds_home: oddsHome,
    odds_draw: oddsDraw,
    odds_away: oddsAway,
  };
}


function formatDate(dateStr) {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  try { return new Date(dateStr).toISOString().split('T')[0]; } catch { return dateStr; }
}

function formatTime(dateStr) {
  if (!dateStr) return '00:00';
  try {
    const d = new Date(dateStr);
    const offset = isDST(d) ? 2 : 1; // CEST / CET
    const localH = (d.getUTCHours() + offset) % 24;
    return `${String(localH).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  } catch { return '00:00'; }
}

function isDST(date) {
  const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  return Math.max(jan, jul) !== date.getTimezoneOffset();
}

/**

 * Parse the Angular SSR JSON state embedded in the page HTML.
 */
function parseSSRMatches(html) {
  const matches = [];
  const seen = new Set();

  let jsonBlob = null;
  const scriptMatch = html.match(/<script[^>]*>\s*(\{[\s\S]*?)\s*<\/script>/);
  if (scriptMatch) {
    jsonBlob = scriptMatch[1];
  }

  if (!jsonBlob) {
    const idx = html.indexOf('"matchDateUtc"');
    if (idx === -1) return [];
    jsonBlob = html.substring(Math.max(0, idx - 200000), idx + 200000);
  }

  const matchPattern = /"matchId":"(\d+)","name":"([^"]+)","matchDateUtc":"([^"]+)","isLive":(true|false)/g;
  let m;

  while ((m = matchPattern.exec(jsonBlob)) !== null) {
    const matchId = m[1];
    if (seen.has(matchId)) continue;
    seen.add(matchId);

    const matchName = m[2];
    const matchDateUtc = m[3];
    const isLive = m[4] === 'true';
    if (isLive) continue; // Skip live matches

    const chunkStart = m.index;
    const chunkEnd = Math.min(jsonBlob.length, chunkStart + 5000);
    const chunk = jsonBlob.substring(chunkStart, chunkEnd);

    try {
      const match = buildMatch(matchId, matchName, matchDateUtc, chunk);
      if (match) matches.push(match);
    } catch (e) {
      // Skip
    }
  }

  return matches;
}

module.exports = {
  parseSSRMatches,
  buildMatch,
  mapCountryCode,
  formatDate,
  formatTime
};
