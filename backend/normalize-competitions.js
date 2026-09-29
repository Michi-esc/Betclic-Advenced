const db = require('./db');

// Normalization mapping: [pattern to search (lowercase), new competition, new country]
const NORMALIZATIONS = [
  // France
  ['ligue 1', 'Ligue 1', 'France'],
  ['ligue 2', 'Ligue 2', 'France'],
  ['coupe de france', 'Coupe de France', 'France'],

  // Top 5 leagues
  ['premier league', 'Premier League', 'Angleterre'],
  ['laliga', 'LaLiga', 'Espagne'],
  ['la liga', 'LaLiga', 'Espagne'],
  ['espagne laliga', 'LaLiga', 'Espagne'],
  ['bundesliga', 'Bundesliga', 'Allemagne'],
  ['serie a', 'Serie A', 'Italie'],
  ['eredivisie', 'Eredivisie', 'Pays-Bas'],
  ['liga portugal', 'Liga Portugal', 'Portugal'],

  // European cups
  ['champions', 'Ligue des Champions', 'Europe'],
  ['europa league', 'Europa League', 'Europe'],
  ['conference league', 'Conference League', 'Europe'],

  // International
  ['ligue des nations', 'Ligue des Nations UEFA', 'Europe'],
  ['nations uefa', 'Ligue des Nations UEFA', 'Europe'],
  ['qualif. euro espoirs', 'Qualif. Euro Espoirs', 'International'],
  ['qualif', 'Qualifications', 'International'],
  ['amicaux', 'Matchs Amicaux', 'International'],
  ['concacaf', 'CONCACAF Ligue des nations', 'International'],
  ['colombie primera', 'Primera A Colombie', 'Colombie'],
  ['galles premier league', 'Cymru Premier', 'Galles'],
];

const allMatches = db.prepare('SELECT id, competition, competition_country FROM matches').all();
let updated = 0;

for (const match of allMatches) {
  const comp = (match.competition || '').toLowerCase();
  
  for (const [pattern, newComp, newCountry] of NORMALIZATIONS) {
    if (comp.includes(pattern) && match.competition !== newComp) {
      db.prepare('UPDATE matches SET competition = ?, competition_country = ? WHERE id = ?')
        .run(newComp, newCountry, match.id);
      updated++;
      break;
    }
  }
}

console.log(`✅ Normalized ${updated} match competition names`);

const comps = db.prepare('SELECT DISTINCT competition, competition_country, COUNT(*) as cnt FROM matches GROUP BY competition ORDER BY competition').all();
console.log('\nFinal competition list:');
comps.forEach(c => console.log(` [${c.cnt}] ${c.competition} (${c.competition_country})`));
