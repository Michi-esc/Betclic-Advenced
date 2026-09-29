/**
 * Parser for Betclic SSR (Server-Side Rendered) HTML & Embedded gRPC JSON State
 */

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

  // Extract competition
  let competition = 'Football';
  let competitionCountry = '';
  const compNameMatch = chunk.match(/"competition":\{"id":"[^"]+","name":"([^"]+)"/);
  if (compNameMatch) competition = compNameMatch[1];
  const countryMatch = chunk.match(/"competition":\{"id":"[^"]+","name":"[^"]+","sport":\{[^}]+\},"countryCode":"([^"]+)"/);
  if (countryMatch) competitionCountry = mapCountryCode(countryMatch[1]);

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
