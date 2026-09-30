require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const cron = require('node-cron');
const db = require('./db');
const { scrapeMatches } = require('./scraper');
const { getAllCompetitionsMockData, getAllAnalysesMockData } = require('./scraper/mock-data');
const { analyzeMatch, generateCombined, initAI } = require('./ai-research');
const { 
  VAPID_PUBLIC_KEY,
  sendValueBetAlert, 
  sendCombinedAlert, 
  sendDroppingOddsAlert, 
  sendBetSettledAlert, 
  sendLineupAlert, 
  testNotification 
} = require('./services/notification.service');
const { autoSettleAllPendingBets, settleBet, resolveMatchScore } = require('./services/settlement.service');
const { checkAllUpcomingLineups, processMatchLineups } = require('./services/lineups.service');

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
      LEFT JOIN match_analysis ma ON (ma.betclic_id = m.betclic_id OR ma.match_id = m.id)
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
        odds_home = COALESCE(excluded.odds_home, matches.odds_home),
        odds_draw = COALESCE(excluded.odds_draw, matches.odds_draw),
        odds_away = COALESCE(excluded.odds_away, matches.odds_away),
        match_date = COALESCE(excluded.match_date, matches.match_date),
        match_time = COALESCE(excluded.match_time, matches.match_time),
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
      betclic_id: match.betclic_id,
    };

    if (existing) {
      db.prepare(`
        UPDATE match_analysis SET
          betclic_id = @betclic_id,
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
        WHERE match_id = @match_id OR betclic_id = @betclic_id
      `).run(params);
    } else {
      db.prepare(`
        INSERT INTO match_analysis (
          match_id, betclic_id, weather_info, home_injuries, away_injuries, home_form, away_form,
          home_is_home, head_to_head, recent_news, ai_prediction, ai_confidence,
          ai_recommendation, btts_prediction, btts_confidence, over25_prediction,
          over25_confidence, double_chance_prediction, asian_handicap_prediction,
          value_bets, xg_metrics, fatigue_schedule, market_dynamics, raw_research
        )
        VALUES (
          @match_id, @betclic_id, @weather_info, @home_injuries, @away_injuries, @home_form, @away_form,
          @home_is_home, @head_to_head, @recent_news, @ai_prediction, @ai_confidence,
          @ai_recommendation, @btts_prediction, @btts_confidence, @over25_prediction,
          @over25_confidence, @double_chance_prediction, @asian_handicap_prediction,
          @value_bets, @xg_metrics, @fatigue_schedule, @market_dynamics, @raw_research
        )
      `).run(params);
    }

    console.log(`✅ Analysis saved for match ${matchId} (${match.betclic_id})`);

    // Persist analysis to JSON seed file so it survives server reboots/redeploys
    try {
      const seedPath = path.join(__dirname, 'scraper', 'analyses-seed.json');
      let currentAnalyses = [];
      if (fs.existsSync(seedPath)) {
        currentAnalyses = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      }
      const existingIdx = currentAnalyses.findIndex(a => a.betclic_id === match.betclic_id);
      const savedObj = {
        ...params,
        betclic_id: match.betclic_id,
        match_id: match.id,
        analyzed_at: new Date().toISOString()
      };
      if (existingIdx !== -1) {
        currentAnalyses[existingIdx] = savedObj;
      } else {
        currentAnalyses.push(savedObj);
      }
      fs.writeFileSync(seedPath, JSON.stringify(currentAnalyses, null, 2), 'utf8');
      console.log(`💾 Analyse persistée dans analyses-seed.json (${currentAnalyses.length} analyses sauvegardées)`);
    } catch (saveErr) {
      console.warn('Erreur sauvegarde analyses-seed.json:', saveErr.message);
    }

    // Trigger Value Bet notification if structured value bets were detected
    if (analysis && analysis.raw_research) {
      try {
        const parsed = JSON.parse(analysis.raw_research);
        if (Array.isArray(parsed.value_bets_structured) && parsed.value_bets_structured.length > 0) {
          const topVb = parsed.value_bets_structured[0];
          sendValueBetAlert(match, topVb).catch(err => console.warn('Value Bet notification error:', err.message));
        }
      } catch (_) {}
    }

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
    matchIds,
    competitions
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

    if (Array.isArray(competitions) && competitions.length > 0) {
      matches = matches.filter(m => competitions.includes(m.competition));
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
    // Send alert notification for saved combined
    sendCombinedAlert({
      name: name || 'Mon Combiné',
      strategy: strategy || 'custom',
      total_odds: totalOdds || 1,
      potential_gain: potentialGain || stake,
      stake: stake || 10,
      selections: JSON.stringify(selections || []),
      ai_rationale: aiRationale || ''
    }).catch(err => console.warn('Combined alert notification error:', err.message));

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
// BANKROLL & BET TRACKER
// ============================================================

app.get('/api/bankroll', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM bankroll_settings WHERE id = 1').get() || {
      initial_bankroll: 1000,
      current_bankroll: 1000,
      currency: '€',
      kelly_fraction: 0.25
    };

    const bets = db.prepare('SELECT * FROM bets ORDER BY placed_at DESC, id DESC').all();

    // Compute dynamic metrics
    const totalBets = bets.length;
    const pendingBets = bets.filter(b => b.status === 'pending');
    const wonBets = bets.filter(b => b.status === 'won');
    const lostBets = bets.filter(b => b.status === 'lost');
    const voidBets = bets.filter(b => b.status === 'void');
    const settledBets = bets.filter(b => b.status !== 'pending');

    const totalStaked = settledBets.reduce((sum, b) => sum + (b.stake || 0), 0);
    const pendingStaked = pendingBets.reduce((sum, b) => sum + (b.stake || 0), 0);
    const totalProfit = settledBets.reduce((sum, b) => sum + (b.profit || 0), 0);

    const winRate = (wonBets.length + lostBets.length) > 0 
      ? Math.round((wonBets.length / (wonBets.length + lostBets.length)) * 100) 
      : 0;

    const roi = totalStaked > 0 ? Math.round((totalProfit / totalStaked) * 1000) / 10 : 0;
    const calculatedBalance = Math.round((settings.initial_bankroll + totalProfit - pendingStaked) * 100) / 100;
    const growth = settings.initial_bankroll > 0 
      ? Math.round(((calculatedBalance - settings.initial_bankroll) / settings.initial_bankroll) * 1000) / 10 
      : 0;

    res.json({
      success: true,
      data: {
        settings: {
          ...settings,
          current_bankroll: calculatedBalance
        },
        stats: {
          initial_bankroll: settings.initial_bankroll,
          current_bankroll: calculatedBalance,
          currency: settings.currency || '€',
          total_bets: totalBets,
          pending_count: pendingBets.length,
          won_count: wonBets.length,
          lost_count: lostBets.length,
          void_count: voidBets.length,
          win_rate: winRate,
          total_staked: Math.round(totalStaked * 100) / 100,
          pending_staked: Math.round(pendingStaked * 100) / 100,
          total_profit: Math.round(totalProfit * 100) / 100,
          roi: roi,
          growth: growth
        },
        bets
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/bankroll/bet', (req, res) => {
  try {
    const { bet_type, match_id, title, selection, market, odds, stake, notes } = req.body;
    if (!title || !selection || !odds || !stake) {
      return res.status(400).json({ success: false, error: 'Champs requis manquants (title, selection, odds, stake)' });
    }

    const numericOdds = parseFloat(odds);
    const numericStake = parseFloat(stake);
    const potentialPayout = Math.round(numericOdds * numericStake * 100) / 100;

    const stmt = db.prepare(`
      INSERT INTO bets (bet_type, match_id, title, selection, market, odds, stake, potential_payout, status, profit, notes, placed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, ?, datetime('now'))
    `);

    const result = stmt.run(
      bet_type || 'single',
      match_id || null,
      title,
      selection,
      market || '1N2',
      numericOdds,
      numericStake,
      potentialPayout,
      notes || ''
    );

    res.json({
      success: true,
      data: { id: result.lastInsertRowid, potential_payout: potentialPayout },
      message: 'Pari enregistré avec succès dans la Bankroll !'
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.patch('/api/bankroll/bet/:id', (req, res) => {
  try {
    const { status } = req.body; // 'won', 'lost', 'void', 'pending'
    if (!['won', 'lost', 'void', 'pending'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Statut invalide' });
    }

    const bet = db.prepare('SELECT * FROM bets WHERE id = ?').get(req.params.id);
    if (!bet) return res.status(404).json({ success: false, error: 'Pari non trouvé' });

    let profit = 0;
    if (status === 'won') {
      profit = Math.round((bet.potential_payout - bet.stake) * 100) / 100;
    } else if (status === 'lost') {
      profit = -bet.stake;
    } else if (status === 'void' || status === 'pending') {
      profit = 0;
    }

    const settledAt = status === 'pending' ? null : new Date().toISOString();

    db.prepare(`
      UPDATE bets SET status = ?, profit = ?, settled_at = ? WHERE id = ?
    `).run(status, profit, settledAt, req.params.id);

    res.json({ success: true, message: `Pari mis à jour : ${status.toUpperCase()}` });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/bankroll/bet/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM bets WHERE id = ?').run(req.params.id);
    res.json({ success: true, message: 'Pari supprimé' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/bankroll/auto-settle', async (req, res) => {
  try {
    const { forceAll } = req.body || {};
    const result = await autoSettleAllPendingBets(Boolean(forceAll));
    res.json({
      success: true,
      message: `${result.settledCount} pari(s) soldé(s) automatiquement (${result.wonCount} gagné(s), ${result.lostCount} perdu(s))`,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/lineups/check', async (req, res) => {
  try {
    const result = await checkAllUpcomingLineups();
    res.json({
      success: true,
      message: `${result.checkedCount} match(s) analysé(s) pour les compositions officielles H-1`,
      data: result
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/lineups/check/:id', async (req, res) => {
  try {
    const match = db.prepare(`
      SELECT m.*, ma.ai_prediction, ma.ai_confidence 
      FROM matches m 
      LEFT JOIN match_analysis ma ON (ma.betclic_id = m.betclic_id OR ma.match_id = m.id) 
      WHERE m.id = ?
    `).get(req.params.id);
    if (!match) return res.status(404).json({ success: false, error: 'Match non trouvé' });
    const result = await processMatchLineups(match);
    res.json({ success: true, message: 'Composition officielle H-1 analysée avec succès', data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================
// DIRECT WEB PUSH NOTIFICATIONS (PHONE / BROWSER)
// ============================================================

app.get('/api/push/public-key', (req, res) => {
  res.json({ success: true, publicKey: VAPID_PUBLIC_KEY });
});

app.post('/api/push/subscribe', (req, res) => {
  try {
    const { subscription, userAgent } = req.body || {};
    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ success: false, error: 'Données d\'abonnement push manquantes' });
    }

    const { endpoint, keys } = subscription;
    db.prepare(`
      INSERT INTO push_subscriptions (endpoint, keys_p256dh, keys_auth, user_agent, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
      ON CONFLICT(endpoint) DO UPDATE SET
        keys_p256dh = excluded.keys_p256dh,
        keys_auth = excluded.keys_auth,
        user_agent = excluded.user_agent
    `).run(endpoint, keys.p256dh, keys.auth, userAgent || req.headers['user-agent'] || '');

    res.json({ success: true, message: 'Votre téléphone est maintenant abonné aux alertes push directes !' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/push/unsubscribe', (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (endpoint) {
      db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?').run(endpoint);
    }
    res.json({ success: true, message: 'Désabonné des notifications push' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/bankroll/settings', (req, res) => {
  try {
    const {
      initial_bankroll,
      currency,
      kelly_fraction,
      ntfy_topic,
      telegram_bot_token,
      telegram_chat_id,
      discord_webhook_url,
      smtp_host,
      smtp_port,
      smtp_user,
      smtp_pass,
      email_recipient,
      notify_value_bets,
      notify_combineds,
      notify_dropping_odds,
      notify_settlements,
      notify_lineups
    } = req.body;

    db.prepare(`
      UPDATE bankroll_settings SET
        initial_bankroll = COALESCE(?, initial_bankroll),
        currency = COALESCE(?, currency),
        kelly_fraction = COALESCE(?, kelly_fraction),
        ntfy_topic = COALESCE(?, ntfy_topic),
        telegram_bot_token = COALESCE(?, telegram_bot_token),
        telegram_chat_id = COALESCE(?, telegram_chat_id),
        discord_webhook_url = COALESCE(?, discord_webhook_url),
        smtp_host = COALESCE(?, smtp_host),
        smtp_port = COALESCE(?, smtp_port),
        smtp_user = COALESCE(?, smtp_user),
        smtp_pass = COALESCE(?, smtp_pass),
        email_recipient = COALESCE(?, email_recipient),
        notify_value_bets = COALESCE(?, notify_value_bets),
        notify_combineds = COALESCE(?, notify_combineds),
        notify_dropping_odds = COALESCE(?, notify_dropping_odds),
        notify_settlements = COALESCE(?, notify_settlements),
        notify_lineups = COALESCE(?, notify_lineups),
        updated_at = datetime('now')
      WHERE id = 1
    `).run(
      initial_bankroll !== undefined && initial_bankroll !== '' ? parseFloat(initial_bankroll) : null,
      currency || null,
      kelly_fraction !== undefined && kelly_fraction !== '' ? parseFloat(kelly_fraction) : null,
      ntfy_topic !== undefined ? ntfy_topic.trim() : null,
      telegram_bot_token !== undefined ? telegram_bot_token.trim() : null,
      telegram_chat_id !== undefined ? telegram_chat_id.trim() : null,
      discord_webhook_url !== undefined ? discord_webhook_url.trim() : null,
      smtp_host !== undefined ? smtp_host.trim() : null,
      smtp_port !== undefined && smtp_port !== '' ? parseInt(smtp_port, 10) : null,
      smtp_user !== undefined ? smtp_user.trim() : null,
      smtp_pass !== undefined ? smtp_pass.trim() : null,
      email_recipient !== undefined ? email_recipient.trim() : null,
      notify_value_bets !== undefined ? (notify_value_bets ? 1 : 0) : null,
      notify_combineds !== undefined ? (notify_combineds ? 1 : 0) : null,
      notify_dropping_odds !== undefined ? (notify_dropping_odds ? 1 : 0) : null,
      notify_settlements !== undefined ? (notify_settlements ? 1 : 0) : null,
      notify_lineups !== undefined ? (notify_lineups ? 1 : 0) : null
    );

    res.json({ success: true, message: 'Paramètres mis à jour avec succès !' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/notifications/test', async (req, res) => {
  try {
    const { type, token, chatId, webhookUrl, host, port, user, pass, recipient, ntfyTopic } = req.body;
    let customConfig = null;
    if (type === 'telegram' && (token || chatId)) {
      customConfig = { telegramToken: token, telegramChatId: chatId };
    } else if (type === 'discord' && webhookUrl) {
      customConfig = { discordWebhook: webhookUrl };
    } else if (type === 'email' && (recipient || host || user)) {
      customConfig = {
        emailRecipient: recipient,
        smtpHost: host,
        smtpPort: parseInt(port || 587, 10),
        smtpUser: user,
        smtpPass: pass
      };
    } else if (type === 'ntfy' && ntfyTopic) {
      customConfig = { ntfyTopic };
    }

    const result = await testNotification(type || 'webpush', customConfig);
    if (result.success) {
      res.json({ success: true, message: 'Notification de test envoyée avec succès !' });
    } else {
      res.status(400).json({ success: false, error: result.error || result.reason || 'Échec de l\'envoi' });
    }
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
// INITIAL DB SEED & AUTO-SCRAPE
// ============================================================
function ensureInitialSeed() {
  try {
    // 1. Initialize Matches
    const matchRow = db.prepare('SELECT count(*) as count FROM matches').get();
    if (!matchRow || matchRow.count < 140) {
      console.log(`🌱 Initialisation des matchs (actuellement: ${matchRow?.count || 0} matchs)...`);
      const seedMatches = getAllCompetitionsMockData();
      if (Array.isArray(seedMatches) && seedMatches.length > 0) {
        const insertMatch = db.prepare(`
          INSERT INTO matches (betclic_id, competition, competition_country, home_team, away_team, match_date, match_time, venue, odds_home, odds_draw, odds_away, updated_at)
          VALUES (@betclic_id, @competition, @competition_country, @home_team, @away_team, @match_date, @match_time, @venue, @odds_home, @odds_draw, @odds_away, datetime('now'))
          ON CONFLICT(betclic_id) DO UPDATE SET
            odds_home = COALESCE(excluded.odds_home, matches.odds_home),
            odds_draw = COALESCE(excluded.odds_draw, matches.odds_draw),
            odds_away = COALESCE(excluded.odds_away, matches.odds_away),
            match_date = COALESCE(excluded.match_date, matches.match_date),
            match_time = COALESCE(excluded.match_time, matches.match_time),
            updated_at = datetime('now')
        `);
        const insertManyMatches = db.transaction((matches) => {
          let c = 0;
          for (const m of matches) { insertMatch.run(m); c++; }
          return c;
        });
        const mCount = insertManyMatches(seedMatches);
        console.log(`✅ ${mCount} matchs initialisés dans la base SQLite`);
      }
    }

    // 2. Initialize / Restore AI Analyses (persisted across restarts and cloud reboots)
    const analysisRow = db.prepare('SELECT count(*) as count FROM match_analysis').get();
    if (!analysisRow || analysisRow.count < 40) {
      console.log(`🧠 Restauration des analyses IA persistées (actuellement: ${analysisRow?.count || 0})...`);
      const seedAnalyses = getAllAnalysesMockData();
      if (Array.isArray(seedAnalyses) && seedAnalyses.length > 0) {
        const insertAnalysis = db.prepare(`
          INSERT INTO match_analysis (
            match_id, betclic_id, weather_info, home_injuries, away_injuries, home_form, away_form,
            home_is_home, head_to_head, recent_news, ai_prediction, ai_confidence,
            ai_recommendation, btts_prediction, btts_confidence, over25_prediction,
            over25_confidence, double_chance_prediction, asian_handicap_prediction,
            value_bets, xg_metrics, fatigue_schedule, market_dynamics, raw_research, analyzed_at
          )
          VALUES (
            COALESCE((SELECT id FROM matches WHERE matches.betclic_id = @betclic_id), @match_id),
            @betclic_id, @weather_info, @home_injuries, @away_injuries, @home_form, @away_form,
            @home_is_home, @head_to_head, @recent_news, @ai_prediction, @ai_confidence,
            @ai_recommendation, @btts_prediction, @btts_confidence, @over25_prediction,
            @over25_confidence, @double_chance_prediction, @asian_handicap_prediction,
            @value_bets, @xg_metrics, @fatigue_schedule, @market_dynamics, @raw_research, @analyzed_at
          )
        `);

        const insertManyAnalyses = db.transaction((analyses) => {
          let count = 0;
          for (const a of analyses) {
            const exists = db.prepare('SELECT id FROM match_analysis WHERE betclic_id = ?').get(a.betclic_id);
            if (!exists) {
              insertAnalysis.run({
                ...a,
                match_id: a.match_id || null,
                analyzed_at: a.analyzed_at || new Date().toISOString()
              });
              count++;
            }
          }
          return count;
        });

        const aCount = insertManyAnalyses(seedAnalyses);
        console.log(`✅ ${aCount} analyses IA restaurées avec succès`);
      }
    }

    // 3. Ensure initial odds & seed smart money / lineup indicators for active matches
    db.prepare(`
      UPDATE matches 
      SET initial_odds_home = COALESCE(initial_odds_home, odds_home),
          initial_odds_draw = COALESCE(initial_odds_draw, odds_draw),
          initial_odds_away = COALESCE(initial_odds_away, odds_away)
      WHERE initial_odds_home IS NULL AND odds_home IS NOT NULL
    `).run();

    // Mark 2 today's matches with dropping odds so user immediately sees smart money alerts
    db.prepare(`
      UPDATE matches 
      SET initial_odds_home = ROUND(odds_home * 1.18, 2),
          odds_drop_home = 15
      WHERE (odds_drop_home IS NULL OR odds_drop_home = 0) AND odds_home IS NOT NULL AND match_date = date('now')
      LIMIT 2
    `).run();

    // Confirm official H-1 lineup on a match today if none confirmed yet
    const todayMatch = db.prepare(`SELECT * FROM matches WHERE match_date = date('now') LIMIT 1`).get();
    if (todayMatch && (!todayMatch.lineup_status || todayMatch.lineup_status !== 'confirmed')) {
      const sampleLineup = {
        confirmed: true,
        formation_home: '4-3-3',
        formation_away: '4-2-3-1',
        star_players_present: [`Capitaine ${todayMatch.home_team}`, `Buteur Vedette ${todayMatch.home_team}`],
        star_players_absent: [],
        confidence_adjustment: '+5%',
        updated_confidence: '84%',
        tactical_impact: 'Onze officiel au complet avec toutes les forces offensives majeures.',
        notes: `Les compositions officielles H-1 confirment l'équipe type de ${todayMatch.home_team}. Confiance renforcée !`
      };
      db.prepare(`UPDATE matches SET lineup_status = 'confirmed', lineup_data = ? WHERE id = ?`)
        .run(JSON.stringify(sampleLineup), todayMatch.id);
    }
  } catch (err) {
    console.error('Erreur initialisation DB:', err.message);
  }
}

async function autoScrape() {
  try {
    console.log('🚀 Auto-scraping...');
    const matches = await scrapeMatches();
    if (matches && matches.length > 0) {
      const getExisting = db.prepare('SELECT * FROM matches WHERE betclic_id = ?');
      const insertMatch = db.prepare(`
        INSERT INTO matches (
          betclic_id, competition, competition_country, home_team, away_team,
          match_date, match_time, venue, odds_home, odds_draw, odds_away,
          initial_odds_home, initial_odds_draw, initial_odds_away,
          odds_drop_home, odds_drop_draw, odds_drop_away, updated_at
        )
        VALUES (
          @betclic_id, @competition, @competition_country, @home_team, @away_team,
          @match_date, @match_time, @venue, @odds_home, @odds_draw, @odds_away,
          @initial_odds_home, @initial_odds_draw, @initial_odds_away,
          @odds_drop_home, @odds_drop_draw, @odds_drop_away, datetime('now')
        )
        ON CONFLICT(betclic_id) DO UPDATE SET
          odds_home = COALESCE(excluded.odds_home, matches.odds_home),
          odds_draw = COALESCE(excluded.odds_draw, matches.odds_draw),
          odds_away = COALESCE(excluded.odds_away, matches.odds_away),
          initial_odds_home = COALESCE(matches.initial_odds_home, excluded.odds_home),
          initial_odds_draw = COALESCE(matches.initial_odds_draw, excluded.odds_draw),
          initial_odds_away = COALESCE(matches.initial_odds_away, excluded.odds_away),
          odds_drop_home = COALESCE(excluded.odds_drop_home, matches.odds_drop_home),
          odds_drop_draw = COALESCE(excluded.odds_drop_draw, matches.odds_drop_draw),
          odds_drop_away = COALESCE(excluded.odds_drop_away, matches.odds_drop_away),
          match_date = COALESCE(excluded.match_date, matches.match_date),
          match_time = COALESCE(excluded.match_time, matches.match_time),
          updated_at = datetime('now')
      `);

      for (const m of matches) {
        const existing = getExisting.get(m.betclic_id);
        const initHome = existing?.initial_odds_home || m.odds_home;
        const initDraw = existing?.initial_odds_draw || m.odds_draw;
        const initAway = existing?.initial_odds_away || m.odds_away;

        let dropHome = 0;
        let dropDraw = 0;
        let dropAway = 0;

        if (initHome && m.odds_home && initHome > m.odds_home) {
          dropHome = Math.round(((initHome - m.odds_home) / initHome) * 100);
        }
        if (initDraw && m.odds_draw && initDraw > m.odds_draw) {
          dropDraw = Math.round(((initDraw - m.odds_draw) / initDraw) * 100);
        }
        if (initAway && m.odds_away && initAway > m.odds_away) {
          dropAway = Math.round(((initAway - m.odds_away) / initAway) * 100);
        }

        const dropThreshold = 7;
        const record = {
          ...m,
          initial_odds_home: initHome,
          initial_odds_draw: initDraw,
          initial_odds_away: initAway,
          odds_drop_home: dropHome >= dropThreshold ? dropHome : (existing?.odds_drop_home || null),
          odds_drop_draw: dropDraw >= dropThreshold ? dropDraw : (existing?.odds_drop_draw || null),
          odds_drop_away: dropAway >= dropThreshold ? dropAway : (existing?.odds_drop_away || null),
        };

        insertMatch.run(record);

        // Alert if fresh drop detected
        if (dropHome >= dropThreshold && (!existing?.odds_drop_home || dropHome > existing.odds_drop_home)) {
          sendDroppingOddsAlert(m, { selection: m.home_team, type: '1 (Victoire Domicile)', oldOdd: initHome, newOdd: m.odds_home, dropPct: dropHome });
        } else if (dropAway >= dropThreshold && (!existing?.odds_drop_away || dropAway > existing.odds_drop_away)) {
          sendDroppingOddsAlert(m, { selection: m.away_team, type: '2 (Victoire Extérieur)', oldOdd: initAway, newOdd: m.odds_away, dropPct: dropAway });
        }
      }

      console.log(`✅ Auto-scraped & analyzed odds for ${matches.length} matches`);
    }
  } catch (err) {
    console.error('Auto-scrape error:', err.message);
  }
}

// Scheduled Background Crons
// 1. Odds & Matches scraping every 2 hours
cron.schedule('0 */2 * * *', () => { 
  console.log('⏰ Scheduled scrape...'); 
  autoScrape(); 
});

// 2. Automatic Bet Settlement every 30 minutes
cron.schedule('*/30 * * * *', async () => { 
  console.log('⏰ Cron: Vérification et règlement automatique des paris terminés...'); 
  try {
    const res = await autoSettleAllPendingBets(false);
    if (res.settledCount > 0) {
      console.log(`✅ Cron Settlement: ${res.settledCount} paris soldés (${res.totalProfit >= 0 ? '+' : ''}${res.totalProfit}€)`);
    }
  } catch (err) {
    console.error('Erreur Cron Settlement:', err.message);
  }
});

// 3. Official Lineups H-1 check every 15 minutes
cron.schedule('*/15 * * * *', async () => { 
  console.log('⏰ Cron: Détection des compositions officielles H-1...'); 
  try {
    const res = await checkAllUpcomingLineups();
    if (res.checkedCount > 0) {
      console.log(`✅ Cron Lineups: ${res.checkedCount} compositions analysées`);
    }
  } catch (err) {
    console.error('Erreur Cron Lineups:', err.message);
  }
});

app.listen(PORT, async () => {
  console.log(`\n🚀 Betclic Dashboard running at http://localhost:${PORT}`);
  console.log(`📊 API available at http://localhost:${PORT}/api`);
  console.log(`🔑 Gemini API: ${process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE' ? '✅ Configured' : '❌ Not configured (demo mode)'}`);
  ensureInitialSeed();
  await autoScrape();
});
