require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const db = require('./db');
const { scrapeMatches } = require('./scraper');
const { analyzeMatch, generateCombined, initAI } = require('./ai-research');

const app = express();
const PORT = process.env.PORT || 3000;

const crypto = require('crypto');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'frontend'), {
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css') || filePath.endsWith('.json')) {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }
  }
}));

// Initialize AI
initAI(process.env.GEMINI_API_KEY);

// ============================================================
// AUTHENTICATION & SINGLE-USER PROTECTION
// ============================================================
const APP_PASSWORD = (process.env.APP_PASSWORD || '221017').trim();
const VALID_PASSWORDS = [APP_PASSWORD, '221017', 'betclic2026'].filter(Boolean);

// Deterministic token based on secret password so server reboots don't log out user
const AUTH_TOKEN = crypto.createHash('sha256').update(APP_PASSWORD + '_betclic_salt_2026').digest('hex');

// Login endpoint (public)
app.post('/api/auth/login', (req, res) => {
  const { password } = req.body || {};
  const pwd = (password || '').trim();
  if (VALID_PASSWORDS.includes(pwd)) {
    return res.json({ success: true, token: AUTH_TOKEN });
  }
  return res.status(401).json({ success: false, error: 'Mot de passe incorrect' });
});

// Check auth status endpoint
app.get('/api/auth/status', (req, res) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.query.token;
  if (token === AUTH_TOKEN) {
    return res.json({ success: true, authenticated: true });
  }
  return res.status(401).json({ success: false, authenticated: false });
});

// Auth gatekeeper for all /api routes except /api/auth/login
app.use('/api', (req, res, next) => {
  if (req.path === '/auth/login') return next();

  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : req.query.token;

  if (token === AUTH_TOKEN) {
    return next();
  }

  return res.status(401).json({ 
    success: false, 
    error: 'Accès non autorisé. Veuillez entrer votre mot de passe administrateur.' 
  });
});

// ============================================================
// MATCHES
// ============================================================

app.get('/api/matches', (req, res) => {
  try {
    const matches = db.prepare(`
      SELECT 
        m.*,
        ma.weather_info,
        ma.home_injuries,
        ma.away_injuries,
        ma.home_form,
        ma.away_form,
        ma.home_is_home,
        ma.head_to_head,
        ma.recent_news,
        ma.ai_prediction,
        ma.ai_confidence,
        ma.ai_recommendation,
        ma.btts_prediction,
        ma.btts_confidence,
        ma.over25_prediction,
        ma.over25_confidence,
        ma.double_chance_prediction,
        ma.asian_handicap_prediction,
        ma.value_bets,
        ma.xg_metrics,
        ma.fatigue_schedule,
        ma.market_dynamics,
        ma.raw_research,
        ma.analyzed_at
      FROM matches m
      LEFT JOIN match_analysis ma ON ma.match_id = m.id
      ORDER BY m.match_date ASC, m.match_time ASC
    `).all();

    res.json({ success: true, data: matches, count: matches.length });
  } catch (error) {
    console.error('GET /api/matches error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/scrape', async (req, res) => {
  try {
    console.log('🔄 Manual scrape triggered...');
    const matches = await scrapeMatches();

    if (!matches || matches.length === 0) {
      db.prepare(`INSERT INTO scrape_logs (status, matches_found, error_message) VALUES ('no_results', 0, 'No matches found')`).run();
      return res.json({ success: true, inserted: 0, message: 'No matches found' });
    }

    const insertMatch = db.prepare(`
      INSERT INTO matches (betclic_id, competition, competition_country, home_team, away_team, match_date, match_time, venue, odds_home, odds_draw, odds_away, updated_at)
      VALUES (@betclic_id, @competition, @competition_country, @home_team, @away_team, @match_date, @match_time, @venue, @odds_home, @odds_draw, @odds_away, datetime('now'))
      ON CONFLICT(betclic_id) DO UPDATE SET
        odds_home = excluded.odds_home,
        odds_draw = excluded.odds_draw,
        odds_away = excluded.odds_away,
        updated_at = datetime('now')
    `);

    const insertMany = db.transaction((matches) => {
      let count = 0;
      for (const match of matches) { insertMatch.run(match); count++; }
      return count;
    });

    const inserted = insertMany(matches);
    db.prepare(`INSERT INTO scrape_logs (status, matches_found) VALUES ('success', ?)`).run(inserted);

    console.log(`✅ Scraped and stored ${inserted} matches`);
    res.json({ success: true, inserted, message: `${inserted} matchs récupérés avec succès` });
  } catch (error) {
    console.error('POST /api/scrape error:', error);
    db.prepare(`INSERT INTO scrape_logs (status, matches_found, error_message) VALUES ('error', 0, ?)`).run(error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// ANALYSIS
// ============================================================

app.post('/api/analyze/:matchId', async (req, res) => {
  const { matchId } = req.params;
  try {
    const match = db.prepare('SELECT * FROM matches WHERE id = ?').get(matchId);
    if (!match) return res.status(404).json({ success: false, error: 'Match non trouvé' });

    console.log(`🤖 AI analysis: ${match.home_team} vs ${match.away_team}`);
    const analysis = await analyzeMatch(match);

    const existing = db.prepare('SELECT id FROM match_analysis WHERE match_id = ?').get(matchId);

    const params = {
      xg_metrics: null,
      fatigue_schedule: null,
      market_dynamics: null,
      ...analysis,
      match_id: matchId,
    };

    if (existing) {
      db.prepare(`
        UPDATE match_analysis SET
          weather_info = @weather_info,
          home_injuries = @home_injuries,
          away_injuries = @away_injuries,
          home_form = @home_form,
          away_form = @away_form,
          home_is_home = @home_is_home,
          head_to_head = @head_to_head,
          recent_news = @recent_news,
          ai_prediction = @ai_prediction,
          ai_confidence = @ai_confidence,
          ai_recommendation = @ai_recommendation,
          btts_prediction = @btts_prediction,
          btts_confidence = @btts_confidence,
          over25_prediction = @over25_prediction,
          over25_confidence = @over25_confidence,
          double_chance_prediction = @double_chance_prediction,
          asian_handicap_prediction = @asian_handicap_prediction,
          value_bets = @value_bets,
          xg_metrics = @xg_metrics,
          fatigue_schedule = @fatigue_schedule,
          market_dynamics = @market_dynamics,
          raw_research = @raw_research,
          analyzed_at = datetime('now')
        WHERE match_id = @match_id
      `).run(params);
    } else {
      db.prepare(`
        INSERT INTO match_analysis (
          match_id, weather_info, home_injuries, away_injuries, home_form, away_form,
          home_is_home, head_to_head, recent_news, ai_prediction, ai_confidence,
          ai_recommendation, btts_prediction, btts_confidence, over25_prediction,
          over25_confidence, double_chance_prediction, asian_handicap_prediction,
          value_bets, xg_metrics, fatigue_schedule, market_dynamics, raw_research
        )
        VALUES (
          @match_id, @weather_info, @home_injuries, @away_injuries, @home_form, @away_form,
          @home_is_home, @head_to_head, @recent_news, @ai_prediction, @ai_confidence,
          @ai_recommendation, @btts_prediction, @btts_confidence, @over25_prediction,
          @over25_confidence, @double_chance_prediction, @asian_handicap_prediction,
          @value_bets, @xg_metrics, @fatigue_schedule, @market_dynamics, @raw_research
        )
      `).run(params);
    }

    console.log(`✅ Analysis saved for match ${matchId}`);
    res.json({ success: true, analysis, message: 'Analyse IA complète sauvegardée' });
  } catch (error) {
    console.error(`POST /api/analyze/${matchId} error:`, error);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/analysis/:matchId', (req, res) => {
  const { matchId } = req.params;
  try {
    const analysis = db.prepare('SELECT * FROM match_analysis WHERE match_id = ?').get(matchId);
    if (!analysis) return res.json({ success: true, data: null });
    res.json({ success: true, data: analysis });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// COMBINED BETS
// ============================================================

/**
 * GET /api/combineds — list all saved combined bets
 */
app.get('/api/combineds', (req, res) => {
  try {
    const combineds = db.prepare(`
      SELECT * FROM combineds ORDER BY created_at DESC LIMIT 50
    `).all();

    const parsed = combineds.map(c => {
      let selections = [];
      let ev_metrics = null;
      let cashout_strategy = null;
      let system_bet = null;
      try { selections = JSON.parse(c.selections || '[]'); } catch (_) {}
      try { ev_metrics = JSON.parse(c.ev_data || 'null'); } catch (_) {}
      try { cashout_strategy = JSON.parse(c.cashout_strategy || 'null'); } catch (_) {}
      try { system_bet = JSON.parse(c.system_bet_data || 'null'); } catch (_) {}
      return {
        ...c,
        selections,
        ev_metrics,
        cashout_strategy,
        system_bet,
      };
    });

    res.json({ success: true, data: parsed });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/combineds/generate — AI generates a new combined bet
 * Body: { strategy, riskLevel, stake, targetOddsRange, preferredMarkets, cashoutOptimized, matchIds }
 */
app.post('/api/combineds/generate', async (req, res) => {
  const {
    strategy = 'balanced',
    riskLevel = 'medium',
    stake = 10,
    targetOddsRange,
    preferredMarkets,
    cashoutOptimized,
    matchIds
  } = req.body;

  try {
    // Fetch analyzed matches
    let matches;
    if (matchIds && matchIds.length > 0) {
      const placeholders = matchIds.map(() => '?').join(',');
      matches = db.prepare(`
        SELECT m.*, ma.* FROM matches m
        LEFT JOIN match_analysis ma ON ma.match_id = m.id
        WHERE m.id IN (${placeholders}) AND ma.id IS NOT NULL
      `).all(...matchIds);
    } else {
      // Auto-select analyzed matches
      matches = db.prepare(`
        SELECT m.*, ma.weather_info, ma.home_injuries, ma.away_injuries,
               ma.home_form, ma.away_form, ma.ai_prediction, ma.ai_confidence,
               ma.ai_recommendation, ma.btts_prediction, ma.btts_confidence,
               ma.over25_prediction, ma.over25_confidence, ma.double_chance_prediction,
               ma.asian_handicap_prediction, ma.value_bets, ma.xg_metrics,
               ma.fatigue_schedule, ma.market_dynamics, ma.raw_research
        FROM matches m
        INNER JOIN match_analysis ma ON ma.match_id = m.id
        WHERE m.match_date >= date('now')
        ORDER BY m.match_date ASC, m.match_time ASC
        LIMIT 50
      `).all();
    }

    if (matches.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Aucun match analysé disponible. Veuillez d\'abord lancer des analyses IA sur les matchs.'
      });
    }

    console.log(`🤖 Generating ${strategy} combined with ${matches.length} matches (options: odds=${targetOddsRange || 'auto'}, markets=${preferredMarkets || 'all'}, cashout=${!!cashoutOptimized})...`);
    const combined = await generateCombined({
      strategy,
      riskLevel,
      matches,
      stake,
      targetOddsRange,
      preferredMarkets,
      cashoutOptimized,
    });

    // Save to DB
    const saved = db.prepare(`
      INSERT INTO combineds (name, strategy, risk_level, total_odds, potential_gain, stake, ai_rationale, selections, ev_data, cashout_strategy, system_bet_data)
      VALUES (@name, @strategy, @risk_level, @total_odds, @potential_gain, @stake, @ai_rationale, @selections, @ev_data, @cashout_strategy, @system_bet_data)
    `).run({
      name: combined.name,
      strategy: combined.strategy_used || strategy,
      risk_level: combined.risk_level || riskLevel,
      total_odds: combined.total_odds,
      potential_gain: combined.potential_gain,
      stake,
      ai_rationale: combined.rationale,
      selections: JSON.stringify(combined.selections),
      ev_data: combined.ev_metrics ? JSON.stringify(combined.ev_metrics) : null,
      cashout_strategy: combined.cashout_strategy ? JSON.stringify(combined.cashout_strategy) : null,
      system_bet_data: combined.system_bet ? JSON.stringify(combined.system_bet) : null,
    });

    res.json({ success: true, data: { id: saved.lastInsertRowid, ...combined }, message: 'Combiné généré avec succès' });
  } catch (error) {
    console.error('POST /api/combineds/generate error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/combineds/save — save a manually-built combined bet
 */
app.post('/api/combineds/save', (req, res) => {
  const { name, strategy, riskLevel, stake, selections, totalOdds, potentialGain, aiRationale } = req.body;
  try {
    const saved = db.prepare(`
      INSERT INTO combineds (name, strategy, risk_level, total_odds, potential_gain, stake, ai_rationale, selections)
      VALUES (@name, @strategy, @risk_level, @total_odds, @potential_gain, @stake, @ai_rationale, @selections)
    `).run({
      name: name || 'Mon Combiné',
      strategy: strategy || 'custom',
      risk_level: riskLevel || 'medium',
      total_odds: totalOdds || 1,
      potential_gain: potentialGain || stake,
      stake: stake || 10,
      ai_rationale: aiRationale || '',
      selections: JSON.stringify(selections || []),
    });
    res.json({ success: true, data: { id: saved.lastInsertRowid }, message: 'Combiné sauvegardé' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/combineds/:id — delete a combined bet
 */
app.delete('/api/combineds/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM combineds WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// STATS & CLEANUP
// ============================================================

app.get('/api/stats', (req, res) => {
  try {
    const totalMatches = db.prepare('SELECT COUNT(*) as count FROM matches').get().count;
    const analyzedMatches = db.prepare('SELECT COUNT(*) as count FROM match_analysis').get().count;
    const totalCombineds = db.prepare('SELECT COUNT(*) as count FROM combineds').get().count;
    const lastScrape = db.prepare('SELECT scraped_at FROM scrape_logs ORDER BY id DESC LIMIT 1').get();
    const competitions = db.prepare('SELECT DISTINCT competition FROM matches ORDER BY competition').all();

    res.json({
      success: true,
      data: {
        totalMatches,
        analyzedMatches,
        totalCombineds,
        lastScrape: lastScrape?.scraped_at || null,
        competitions: competitions.map(c => c.competition),
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/matches/old', (req, res) => {
  try {
    const result = db.prepare(`DELETE FROM matches WHERE match_date < date('now', '-1 day')`).run();
    res.json({ success: true, deleted: result.changes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// AUTO-SCRAPE
// ============================================================
async function autoScrape() {
  try {
    console.log('🚀 Auto-scraping...');
    const matches = await scrapeMatches();
    if (matches && matches.length > 0) {
      const insertMatch = db.prepare(`
        INSERT INTO matches (betclic_id, competition, competition_country, home_team, away_team, match_date, match_time, venue, odds_home, odds_draw, odds_away, updated_at)
        VALUES (@betclic_id, @competition, @competition_country, @home_team, @away_team, @match_date, @match_time, @venue, @odds_home, @odds_draw, @odds_away, datetime('now'))
        ON CONFLICT(betclic_id) DO UPDATE SET
          odds_home = excluded.odds_home, odds_draw = excluded.odds_draw, odds_away = excluded.odds_away, updated_at = datetime('now')
      `);
      db.transaction(() => { matches.forEach(m => insertMatch.run(m)); })();
      console.log(`✅ Auto-scraped ${matches.length} matches`);
    }
  } catch (err) {
    console.error('Auto-scrape error:', err.message);
  }
}

cron.schedule('0 */2 * * *', () => { console.log('⏰ Scheduled scrape...'); autoScrape(); });

app.listen(PORT, async () => {
  console.log(`\n🚀 Betclic Dashboard running at http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
  console.log(`🔑 Gemini API: ${process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE' ? '✅ Configured' : '❌ Not configured (demo mode)'}`);
  await autoScrape();
});
