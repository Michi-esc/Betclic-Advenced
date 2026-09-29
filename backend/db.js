const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'data', 'betclic.db');

// Ensure data directory exists
const fs = require('fs');
const dataDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    betclic_id TEXT UNIQUE,
    competition TEXT NOT NULL,
    competition_country TEXT,
    home_team TEXT NOT NULL,
    away_team TEXT NOT NULL,
    match_date TEXT NOT NULL,
    match_time TEXT,
    venue TEXT,
    odds_home REAL,
    odds_draw REAL,
    odds_away REAL,
    status TEXT DEFAULT 'upcoming',
    scraped_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS match_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    weather_info TEXT,
    home_injuries TEXT,
    away_injuries TEXT,
    home_form TEXT,
    away_form TEXT,
    home_is_home INTEGER DEFAULT 1,
    head_to_head TEXT,
    recent_news TEXT,
    ai_prediction TEXT,
    ai_confidence TEXT,
    ai_recommendation TEXT,
    -- Extended markets analysis
    btts_prediction TEXT,
    btts_confidence TEXT,
    over25_prediction TEXT,
    over25_confidence TEXT,
    double_chance_prediction TEXT,
    asian_handicap_prediction TEXT,
    value_bets TEXT,
    raw_research TEXT,
    analyzed_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS extended_odds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    match_id INTEGER NOT NULL,
    market_type TEXT NOT NULL,
    selection_name TEXT NOT NULL,
    odds_value REAL,
    scraped_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (match_id) REFERENCES matches(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS combineds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    strategy TEXT NOT NULL,
    risk_level TEXT DEFAULT 'medium',
    total_odds REAL,
    potential_gain REAL,
    stake REAL DEFAULT 10,
    status TEXT DEFAULT 'pending',
    ai_rationale TEXT,
    selections TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS scrape_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    status TEXT,
    matches_found INTEGER DEFAULT 0,
    error_message TEXT,
    scraped_at TEXT DEFAULT (datetime('now'))
  );
`);

// Add missing columns to match_analysis if upgrading existing DB
const analysisColumns = db.pragma("table_info(match_analysis)").map(c => c.name);
const newAnalysisCols = [
  { name: 'btts_prediction', type: 'TEXT' },
  { name: 'btts_confidence', type: 'TEXT' },
  { name: 'over25_prediction', type: 'TEXT' },
  { name: 'over25_confidence', type: 'TEXT' },
  { name: 'double_chance_prediction', type: 'TEXT' },
  { name: 'asian_handicap_prediction', type: 'TEXT' },
  { name: 'value_bets', type: 'TEXT' },
  { name: 'xg_metrics', type: 'TEXT' },
  { name: 'fatigue_schedule', type: 'TEXT' },
  { name: 'market_dynamics', type: 'TEXT' },
];

for (const col of newAnalysisCols) {
  if (!analysisColumns.includes(col.name)) {
    db.exec(`ALTER TABLE match_analysis ADD COLUMN ${col.name} ${col.type}`);
    console.log(`✅ Added column match_analysis.${col.name}`);
  }
}

// Add missing columns to combineds if upgrading existing DB
const combinedColumns = db.pragma("table_info(combineds)").map(c => c.name);
const newCombinedCols = [
  { name: 'ev_data', type: 'TEXT' },
  { name: 'cashout_strategy', type: 'TEXT' },
  { name: 'system_bet_data', type: 'TEXT' },
];

for (const col of newCombinedCols) {
  if (!combinedColumns.includes(col.name)) {
    db.exec(`ALTER TABLE combineds ADD COLUMN ${col.name} ${col.type}`);
    console.log(`✅ Added column combineds.${col.name}`);
  }
}

console.log('✅ Database initialized at:', DB_PATH);

module.exports = db;
