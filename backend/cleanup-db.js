const db = require('./db');

const NON_FOOTBALL_KEYWORDS = [
  'euroligue', 'nba', 'basket', 'basketball', 'euroleague', 'bbl', 'ncaa',
  'tennis', 'rugby', 'nfl', 'nhl', 'hockey', 'golf', 'handball', 'volleyball',
  'baseball', 'cricket', 'formula', 'moto', 'cyclisme', 'snooker', 'darts',
];

const allMatches = db.prepare('SELECT id, competition FROM matches').all();
const toDelete = allMatches.filter(m => 
  NON_FOOTBALL_KEYWORDS.some(kw => (m.competition || '').toLowerCase().includes(kw))
);

console.log('Non-football matches to delete:', toDelete.length);
toDelete.forEach(m => console.log(' -', m.id, m.competition));

if (toDelete.length > 0) {
  const ids = toDelete.map(m => m.id).join(',');
  const delAnalysis = db.prepare(`DELETE FROM match_analysis WHERE match_id IN (${ids})`).run();
  const delMatches = db.prepare(`DELETE FROM matches WHERE id IN (${ids})`).run();
  console.log(`\n✅ Deleted ${delMatches.changes} non-football matches`);
  console.log(`✅ Deleted ${delAnalysis.changes} related analyses`);
}

// Show remaining counts
const remaining = db.prepare('SELECT COUNT(*) as cnt FROM matches').get();
console.log('\nRemaining matches in DB:', remaining.cnt);

const comps = db.prepare('SELECT DISTINCT competition FROM matches ORDER BY competition').all();
comps.forEach(c => console.log(' -', c.competition));
