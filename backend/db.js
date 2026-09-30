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

  CREATE TABLE IF NOT EXISTS bets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bet_type TEXT NOT NULL DEFAULT 'single',
    match_id INTEGER,
    title TEXT NOT NULL,
    selection TEXT NOT NULL,
    market TEXT DEFAULT '1N2',
    odds REAL NOT NULL,
    stake REAL NOT NULL,
    potential_payout REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    profit REAL DEFAULT 0,
    notes TEXT,
    placed_at TEXT DEFAULT (datetime('now')),
    settled_at TEXT
  );

  CREATE TABLE IF NOT EXISTS bankroll_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    initial_bankroll REAL DEFAULT 1000,
    current_bankroll REAL DEFAULT 1000,
    currency TEXT DEFAULT '€',
    kelly_fraction REAL DEFAULT 0.25,
    telegram_bot_token TEXT,
    telegram_chat_id TEXT,
    discord_webhook_url TEXT,
    notify_value_bets INTEGER DEFAULT 1,
    notify_combineds INTEGER DEFAULT 1,
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

// Initialize bankroll settings row if missing
db.exec(`
  INSERT OR IGNORE INTO bankroll_settings (id, initial_bankroll, current_bankroll, currency, kelly_fraction)
  VALUES (1, 1000, 1000, '€', 0.25);
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
  { name: 'betclic_id', type: 'TEXT' },
];

for (const col of newAnalysisCols) {
  if (!analysisColumns.includes(col.name)) {
    db.exec(`ALTER TABLE match_analysis ADD COLUMN ${col.name} ${col.type}`);
    console.log(`✅ Added column match_analysis.${col.name}`);
  }
}

// Populate betclic_id in match_analysis from matches table if empty
try {
  db.exec(`
    UPDATE match_analysis 
    SET betclic_id = (SELECT betclic_id FROM matches WHERE matches.id = match_analysis.match_id)
    WHERE betclic_id IS NULL;
  `);
} catch (_) {}

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

// Add missing columns to matches for dropping odds, lineups & scores
const matchColumns = db.pragma("table_info(matches)").map(c => c.name);
const newMatchCols = [
  { name: 'initial_odds_home', type: 'REAL' },
  { name: 'initial_odds_draw', type: 'REAL' },
  { name: 'initial_odds_away', type: 'REAL' },
  { name: 'odds_drop_home', type: 'REAL' },
  { name: 'odds_drop_draw', type: 'REAL' },
  { name: 'odds_drop_away', type: 'REAL' },
  { name: 'lineup_status', type: 'TEXT' },
  { name: 'lineup_data', type: 'TEXT' },
  { name: 'score_home', type: 'INTEGER' },
  { name: 'score_away', type: 'INTEGER' },
  { name: 'match_status', type: 'TEXT DEFAULT "upcoming"' },
];

for (const col of newMatchCols) {
  if (!matchColumns.includes(col.name)) {
    db.exec(`ALTER TABLE matches ADD COLUMN ${col.name} ${col.type}`);
    console.log(`✅ Added column matches.${col.name}`);
  }
}

// Add missing columns to bankroll_settings for email and new alerts
const bankrollColumns = db.pragma("table_info(bankroll_settings)").map(c => c.name);
const newBankrollCols = [
  { name: 'smtp_host', type: 'TEXT' },
  { name: 'smtp_port', type: 'INTEGER DEFAULT 587' },
  { name: 'smtp_user', type: 'TEXT' },
  { name: 'smtp_pass', type: 'TEXT' },
  { name: 'email_recipient', type: 'TEXT' },
  { name: 'notify_dropping_odds', type: 'INTEGER DEFAULT 1' },
  { name: 'notify_settlements', type: 'INTEGER DEFAULT 1' },
  { name: 'notify_lineups', type: 'INTEGER DEFAULT 1' },
  { name: 'ntfy_topic', type: 'TEXT' },
];

for (const col of newBankrollCols) {
  if (!bankrollColumns.includes(col.name)) {
    db.exec(`ALTER TABLE bankroll_settings ADD COLUMN ${col.name} ${col.type}`);
    console.log(`✅ Added column bankroll_settings.${col.name}`);
  }
}

// Push Subscriptions table for Direct Web Push notifications on phone / browser
db.exec(`
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT UNIQUE NOT NULL,
    keys_p256dh TEXT NOT NULL,
    keys_auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TEXT DEFAULT (datetime('now'))
  );
`);

console.log('✅ Database initialized at:', DB_PATH);

module.exports = db;
