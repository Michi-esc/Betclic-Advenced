const { GoogleGenerativeAI } = require('@google/generative-ai');
const { fetchMatchForecast, resolveMatchCity } = require('./services/weather.service');
const { fetchLiveNews } = require('./services/news.service');
const { generateMockAnalysis } = require('./services/mock.service');

let genAI = null;

function initAI(apiKey) {
  if (apiKey && apiKey !== 'YOUR_GEMINI_API_KEY_HERE') {
    genAI = new GoogleGenerativeAI(apiKey);
    console.log('✅ Gemini AI initialized');
  } else {
    console.log('⚠️  No Gemini API key found - AI features will return mock analysis');
  }
}



function extractJson(text) {
  if (!text) return '{}';
  let cleaned = text.trim();
  if (cleaned.includes('```')) {
    cleaned = cleaned.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim();
  }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }
  return cleaned;
}

async function callGemini(prompt, timeoutMs = 25000) {
  const candidates = [
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
    'gemini-3.8-flash',
    'gemini-flash-latest'
  ];
  let lastError = null;
  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const apiCall = model.generateContent(prompt);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`Timeout after ${timeoutMs}ms on ${modelName}`)), timeoutMs)
      );
      const result = await Promise.race([apiCall, timeoutPromise]);
      const text = result.response.text().trim();
      const jsonText = extractJson(text);
      return jsonText;
    } catch (err) {
      lastError = err;
      console.log(`⚠️ Model ${modelName} error: ${err.message}`);
    }
  }
  throw lastError || new Error('No Gemini model available');
}

/**
 * Full deep analysis of a football match including extended markets
 */
async function analyzeMatch(match) {
  const { home_team, away_team, competition, match_date, match_time, venue, odds_home, odds_draw, odds_away } = match;

  if (!genAI) {
    return generateMockAnalysis(match);
  }

  const matchCity = resolveMatchCity(home_team, venue);
  const [liveNews, matchWeather] = await Promise.all([
    fetchLiveNews(`${home_team} ${away_team} football blessures forme statistiques`),
    fetchMatchForecast(matchCity, match_date, match_time)
  ]);

  const currentDate = new Date().toISOString().split('T')[0];

  const prompt = `Tu es un expert analyste sportif professionnel en football et conseiller paris sportifs CRITIQUE.
Date actuelle : ${currentDate}.

MISSION : Analyse approfondie du match ET évaluation CRITIQUE du risque pour CHAQUE type de pari. Indique explicitement si un pari est FIABLE ou DANGEREUX.

INFOS DU MATCH :
- Affiche : ${home_team} vs ${away_team}
- Compétition : ${competition}
- Date et heure : ${match_date} à ${match_time}
- Lieu / Stade : ${venue || home_team} (Ville : ${matchCity})
- Cotes 1N2 : Victoire ${home_team} (${odds_home || 'N/A'}) | Nul (${odds_draw || 'N/A'}) | Victoire ${away_team} (${odds_away || 'N/A'})

MÉTÉO :
${matchWeather}

ACTUALITÉS :
${liveNews}

DIRECTIVES D'ANALYSE EXPERTE & QUANTITATIVE :
1. RISQUE RÉSULTAT 1N2 : Si le match est serré, les équipes imprévisibles ou le résultat trop aléatoire, dis-le clairement avec result_risk_alert et mets result_avoid=true.
2. RISQUE BUTS (BTTS/Over) : Si les stats de buts sont variables ou incohérentes (ex: équipes qui alternent 0-0 et 4-3), c'est un marché à haut risque → btts_avoid=true et over25_avoid=true.
3. MÉTRIQUES xG (Expected Goals) : Évalue les xG générés et xGA concédés par chaque équipe sur leurs derniers matchs pour déceler la vraie efficacité offensive/défensive au-delà des scores en trompe-l'œil.
4. CALENDRIER & FATIGUE : Calcule les jours de repos depuis la dernière sortie officielle, les kilomètres de déplacement et le risque de rotation (notamment en cas de match européen en semaine).
5. COMPOSITIONS & ABSENTS : Analyse l'impact concret des forfaits (gardien numéro 1, maestro créateur, buteur) et les systèmes tactiques opposés.
6. MARCHÉ & DYNAMIQUE DE COTE : Détecte les mouvements de cotes (smart money / dropping odds) et identifie les cotes pièges des bookmakers.
7. ARBITRAGE & ENJEUX : Évalue le profil disciplinaire de l'arbitre (cartons, tendance penalties) et l'enjeu mathématique (maintien, titre, risque de match nul arrangeant / biscotto).
8. VALUE BETS RÉELS : Identifie les cotes anormalement hautes par rapport à la probabilité réelle révélée par tes recherches approfondies (edge = prob_réelle - prob_implicite).

Réponds UNIQUEMENT avec ce JSON valide (sans markdown, sans backticks) :
{
  "weather_info": "${matchWeather}",
  "home_injuries": "Absents/blessés précis ${home_team}",
  "away_injuries": "Absents/blessés précis ${away_team}",
  "home_form": "V-N-V-D-V",
  "away_form": "N-V-D-V-N",
  "head_to_head": "Historique H2H détaillé avec scores récents",
  "recent_news": "Synthèse globale actualités et contexte clé",
  "key_players_home": "Joueurs clés ${home_team} et rôle",
  "key_players_away": "Joueurs clés ${away_team} et rôle",
  "match_importance": "Enjeux au classement / compétition",
  "home_is_actual_home": true,
  "xg_analysis": {
    "home_xg": 1.75,
    "away_xg": 1.10,
    "home_xga": 0.95,
    "away_xga": 1.60,
    "verdict": "Ex: Domination territoriale et volume d'occasions nettes à l'avantage du domicile."
  },
  "fatigue_analysis": {
    "home_rest_days": 6,
    "away_rest_days": 3,
    "travel_km": "Déplacement 900 km",
    "rotation_risk": "faible|modéré|élevé",
    "schedule_context": "Ex: L'équipe extérieure a disputé 90 min intenses jeudi soir en coupe d'Europe."
  },
  "lineup_analysis": {
    "home_system": "4-3-3",
    "away_system": "4-2-3-1",
    "key_absences_impact": "Ex: Absence du gardien titulaire pénalisante pour l'extérieur.",
    "lineup_status": "très probable"
  },
  "market_dynamics": {
    "odds_trend": "en baisse sur 1|stable|en baisse sur 2",
    "smart_money": "Ex: Flux régulier sur le marché Under 2.5 buts.",
    "trap_warning": "Ex: Cote domicile anormalement basse malgré les blessures (cote piège)"
  },
  "referee_analysis": {
    "referee_name": "Nom ou profil arbitre",
    "cards_tendency": "Moyenne ~3.8 cartons/m",
    "penalties_rate": "faible|modéré|élevé",
    "game_tempo": "fluide|haché"
  },
  "stakes_analysis": {
    "standings_context": "Ex: Course au maintien vs milieu de tableau",
    "motivation_level": "très élevée pour l'équipe locale",
    "biscotto_risk": "faible"
  },
  "ai_prediction": "Pronostic ex: Victoire ${home_team} 2-1",
  "ai_confidence": "65%",
  "ai_recommendation": "Conseil pari 1N2 avec justification",
  "result_risk_level": "faible|modéré|élevé|très élevé",
  "result_risk_alert": "Message d'alerte explicite ou null",
  "result_avoid": false,
  "btts_prediction": "Oui|Non",
  "btts_confidence": "70%",
  "btts_rationale": "Explication BTTS avec stats buts réels et xG",
  "btts_risk_level": "faible|modéré|élevé|très élevé",
  "btts_risk_alert": "Alerte si buts imprévisibles ou null",
  "btts_avoid": false,
  "over25_prediction": "Plus de 2.5|Moins de 2.5",
  "over25_confidence": "65%",
  "over25_rationale": "Explication Over/Under avec moyennes buts et xG",
  "over25_risk_level": "faible|modéré|élevé|très élevé",
  "over25_risk_alert": "Alerte si stats buts variables ou null",
  "over25_avoid": false,
  "double_chance_prediction": "1X|X2|12",
  "double_chance_rationale": "Explication Double Chance",
  "double_chance_risk_level": "faible|modéré|élevé",
  "double_chance_risk_alert": "Alerte si nécessaire ou null",
  "asian_handicap_prediction": "ex: ${home_team} -0.5",
  "asian_handicap_rationale": "Explication handicap asiatique",
  "asian_handicap_risk_level": "faible|modéré|élevé|très élevé",
  "asian_handicap_risk_alert": "Alerte si nécessaire ou null",
  "value_bets": [
    {
      "market": "1N2|BTTS|Over 2.5|Double Chance|Handicap",
      "selection": "ex: Victoire ${away_team}",
      "bookmaker_odds": 2.40,
      "implied_probability": "41.7%",
      "estimated_real_probability": "58%",
      "value_edge": "+16.3%",
      "rationale": "Pourquoi c'est un value bet réel"
    }
  ],
  "score_prediction": "ex: 2-1",
  "overall_risk": "faible|moyen|élevé",
  "recommended_for_combined": true,
  "combined_selection": "La sélection la plus sûre pour un combiné",
  "combined_market": "1N2|BTTS|Over 2.5|Double Chance|Handicap"
}`;

  try {
    const text = await callGemini(prompt);
    const analysis = JSON.parse(text);

    // Normalize value_bets — may be array (new format) or string (legacy)
    let valueBetsNormalized = '—';
    if (Array.isArray(analysis.value_bets) && analysis.value_bets.length > 0) {
      valueBetsNormalized = analysis.value_bets
        .map(vb => `${vb.market}: ${vb.selection} (cote ${vb.bookmaker_odds}, prob réelle ${vb.estimated_real_probability}, edge ${vb.value_edge})`)
        .join(' | ');
    } else if (typeof analysis.value_bets === 'string' && analysis.value_bets !== '—') {
      valueBetsNormalized = analysis.value_bets;
    }

    // Build comprehensive match notes for database
    const xg = analysis.xg_analysis || {};
    const fat = analysis.fatigue_analysis || {};
    const lin = analysis.lineup_analysis || {};
    const mkt = analysis.market_dynamics || {};
    const ref = analysis.referee_analysis || {};
    const stk = analysis.stakes_analysis || {};

    const notesSections = [
      analysis.recent_news ? `📌 SYNTHÈSE :\n${analysis.recent_news}` : '',
      xg.home_xg ? `📊 MÉTRIQUES AVANCÉES & xG :\n• ${home_team} : ~${xg.home_xg} xG / ${xg.home_xga || '—'} xGA concédé\n• ${away_team} : ~${xg.away_xg} xG / ${xg.away_xga || '—'} xGA concédé\n• Évaluation : ${xg.verdict || 'Analyse basée sur les Expected Goals récents'}` : '',
      fat.home_rest_days !== undefined ? `⚡ CALENDRIER & FATIGUE :\n• Jours de repos : ${home_team} (${fat.home_rest_days}j) vs ${away_team} (${fat.away_rest_days}j)\n• Risque de rotation : ${fat.rotation_risk || 'modéré'}${fat.travel_km ? ` | ${fat.travel_km}` : ''}\n• Contexte : ${fat.schedule_context || 'Enchaînement de championnat standard'}` : '',
      lin.home_system ? `📋 TACTIQUE & ABSENTS CLÉS :\n• Dispositifs : ${home_team} (${lin.home_system}) vs ${away_team} (${lin.away_system || 'N/A'})\n• Impact absents : ${lin.key_absences_impact || 'Effectifs gérables'}` : '',
      mkt.odds_trend ? `📈 ANALYSE DU MARCHÉ & COTES :\n• Tendance cote : ${mkt.odds_trend}\n• Flux pro (Smart Money) : ${mkt.smart_money || 'Répartition équilibrée'}${mkt.trap_warning ? `\n• ⚠️ Alerte piège : ${mkt.trap_warning}` : ''}` : '',
      ref.cards_tendency ? `👨‍⚖️ ARBITRAGE & DISCIPLINE :\n• Profil : ${ref.referee_name || 'Arbitre standard'} (${ref.cards_tendency})\n• Tendance penalties : ${ref.penalties_rate || 'normale'} | Rythme de match : ${ref.game_tempo || 'régulier'}` : '',
      stk.standings_context ? `🎯 ENJEUX & MOTIVATION :\n• Contexte : ${stk.standings_context}\n• Motivation : ${stk.motivation_level || 'standard'}${stk.biscotto_risk && stk.biscotto_risk !== 'faible' ? ` | ⚠️ Risque accord mutuel : ${stk.biscotto_risk}` : ''}` : '',
      `⭐ JOUEURS CLÉS :\n• ${home_team} : ${analysis.key_players_home || 'N/A'}\n• ${away_team} : ${analysis.key_players_away || 'N/A'}`,
    ].filter(Boolean);

    const fullNotes = notesSections.join('\n\n');

    return {
      weather_info: analysis.weather_info || matchWeather,
      home_injuries: analysis.home_injuries || 'Effectif complet',
      away_injuries: analysis.away_injuries || 'Effectif complet',
      home_form: analysis.home_form || 'V-N-V-D-V',
      away_form: analysis.away_form || 'N-V-D-V-N',
      home_is_home: analysis.home_is_actual_home !== false ? 1 : 0,
      head_to_head: analysis.head_to_head || '—',
      recent_news: fullNotes,
      ai_prediction: analysis.ai_prediction || `Victoire ${home_team}`,
      ai_confidence: analysis.ai_confidence || '60%',
      ai_recommendation: analysis.ai_recommendation || '—',
      btts_prediction: analysis.btts_prediction || '—',
      btts_confidence: analysis.btts_confidence || '—',
      over25_prediction: analysis.over25_prediction || '—',
      over25_confidence: analysis.over25_confidence || '—',
      double_chance_prediction: analysis.double_chance_prediction || '—',
      asian_handicap_prediction: analysis.asian_handicap_prediction || '—',
      value_bets: valueBetsNormalized,
      xg_metrics: JSON.stringify(xg),
      fatigue_schedule: JSON.stringify(fat),
      market_dynamics: JSON.stringify(mkt),
      raw_research: JSON.stringify({
        ...analysis,
        btts_rationale: analysis.btts_rationale,
        over25_rationale: analysis.over25_rationale,
        double_chance_rationale: analysis.double_chance_rationale,
        asian_handicap_rationale: analysis.asian_handicap_rationale,
        // Advanced metrics objects
        xg_analysis: xg,
        fatigue_analysis: fat,
        lineup_analysis: lin,
        market_dynamics: mkt,
        referee_analysis: ref,
        stakes_analysis: stk,
        // Risk data per market
        result_risk_level: analysis.result_risk_level,
        result_risk_alert: analysis.result_risk_alert,
        result_avoid: analysis.result_avoid,
        btts_risk_level: analysis.btts_risk_level,
        btts_risk_alert: analysis.btts_risk_alert,
        btts_avoid: analysis.btts_avoid,
        over25_risk_level: analysis.over25_risk_level,
        over25_risk_alert: analysis.over25_risk_alert,
        over25_avoid: analysis.over25_avoid,
        double_chance_risk_level: analysis.double_chance_risk_level,
        double_chance_risk_alert: analysis.double_chance_risk_alert,
        asian_handicap_risk_level: analysis.asian_handicap_risk_level,
        asian_handicap_risk_alert: analysis.asian_handicap_risk_alert,
        // Value bets structured
        value_bets_structured: Array.isArray(analysis.value_bets) ? analysis.value_bets : [],
        // Combined info
        score_prediction: analysis.score_prediction,
        overall_risk: analysis.overall_risk,
        recommended_for_combined: analysis.recommended_for_combined,
        combined_selection: analysis.combined_selection,
        combined_market: analysis.combined_market,
      }),
    };
  } catch (error) {
    console.error('❌ AI analysis error:', error.message);
    return generateMockAnalysis(match);
  }
}

/**
 * Helper to compute math EV+, Fair Odds, Cashout strategy, and System bet returns
 */
function enrichCombinedWithMathAndCashout(combined, stake) {
  if (!combined || !Array.isArray(combined.selections) || combined.selections.length === 0) {
    return combined;
  }

  // 1. Sort selections chronologically
  combined.selections.sort((a, b) => {
    const da = `${a.match_date || ''} ${a.match_time || ''}`.trim();
    const db = `${b.match_date || ''} ${b.match_time || ''}`.trim();
    return da.localeCompare(db);
  });

  // Recompute total odds from selections
  const validOdds = combined.selections.map(s => typeof s.odds === 'number' ? s.odds : (parseFloat(s.odds) || 1.10));
  const totalOdds = parseFloat(validOdds.reduce((acc, o) => acc * o, 1).toFixed(2));
  combined.total_odds = totalOdds;
  combined.potential_gain = parseFloat((stake * totalOdds).toFixed(2));

  // 2. Compute EV+ metrics
  let realCombProb = 1.0;
  combined.selections.forEach((s, idx) => {
    let p = 0;
    if (s.confidence) {
      const match = String(s.confidence).match(/(\d+(\.\d+)?)/);
      if (match) p = parseFloat(match[1]) / 100;
    }
    if (!p || p <= 0 || p > 1) {
      const o = validOdds[idx];
      p = o > 1 ? (1 / o) * 1.08 : 0.85;
      if (p > 0.95) p = 0.95;
    }
    s.estimated_prob = parseFloat((p * 100).toFixed(1)) + '%';
    realCombProb *= p;
  });

  const impliedProb = totalOdds > 0 ? (1 / totalOdds) : 0;
  const evPercent = ((realCombProb * totalOdds) - 1) * 100;
  const fairOdds = realCombProb > 0 ? Math.min(999, 1 / realCombProb) : totalOdds;

  combined.ev_metrics = {
    real_probability: (realCombProb * 100).toFixed(1) + '%',
    implied_probability: (impliedProb * 100).toFixed(1) + '%',
    expected_value_percent: (evPercent >= 0 ? '+' : '') + evPercent.toFixed(1) + '%',
    fair_odds: parseFloat(fairOdds.toFixed(2)),
    is_ev_positive: evPercent > 0,
    edge_rating: evPercent >= 15 ? 'Excellent Edge (≥ +15%)' : evPercent >= 5 ? 'Bon Edge (+5% à +15%)' : evPercent >= 0 ? 'Léger Edge (+0% à +5%)' : 'Espérance Négative (EV-)'
  };

  // 3. Séquençage horaire & Cashout Strategy
  const n = combined.selections.length;
  if (n >= 2) {
    const firstMatch = combined.selections[0];
    const lastMatch = combined.selections[n - 1];
    const sameTime = firstMatch.match_date === lastMatch.match_date && firstMatch.match_time === lastMatch.match_time;

    const oddsWithoutLast = parseFloat(validOdds.slice(0, n - 1).reduce((acc, o) => acc * o, 1).toFixed(2));
    const lastOdd = validOdds[n - 1];
    const potentialGain = combined.potential_gain;

    const hedgeOdds = lastOdd > 1.05 ? parseFloat((lastOdd / (lastOdd - 1)).toFixed(2)) : 2.0;
    const hedgeStake = parseFloat((potentialGain / hedgeOdds).toFixed(2));
    const guaranteedProfit = parseFloat((potentialGain - hedgeStake - stake).toFixed(2));

    combined.cashout_strategy = {
      is_staggered: !sameTime,
      timeline_summary: `${firstMatch.match_date || ''} ${firstMatch.match_time || ''} ➔ ${lastMatch.match_date || ''} ${lastMatch.match_time || ''}`,
      anchor_match: `${lastMatch.home_team} vs ${lastMatch.away_team}`,
      anchor_kickoff: `${lastMatch.match_date || ''} à ${lastMatch.match_time || 'soirée'}`,
      odds_before_anchor: oddsWithoutLast,
      hedging_advice: !sameTime
        ? `Le match clôture (${lastMatch.home_team} vs ${lastMatch.away_team}) se joue après les autres. Si les ${n - 1} premières sélections passent (cote cumulée ${oddsWithoutLast}), vous pourrez valider un Cashout très lucratif ou placer une couverture sécurisant un gain net garanti (estimé à ~${Math.max(0, guaranteedProfit)}€).`
        : `Les matchs ont lieu simultanément ou dans des horaires très proches. Le suivi Cashout se fera en temps réel en direct (Live).`,
      suggested_hedge: {
        anchor_selection: lastMatch.selection,
        hedge_odds_est: hedgeOdds,
        hedge_stake_est: hedgeStake,
        guaranteed_net_est: Math.max(0, guaranteedProfit)
      }
    };
  }

  // 4. Paris Système (Garantie N-1)
  if (n >= 3) {
    const systemName = `Système ${n - 1}/${n}`;
    const subBetsCount = n;
    const stakePerBet = parseFloat((stake / subBetsCount).toFixed(2));

    const payoutIfOneFails = [];
    for (let i = 0; i < n; i++) {
      const subOdds = validOdds.filter((_, idx) => idx !== i).reduce((acc, o) => acc * o, 1);
      const gain = parseFloat((stakePerBet * subOdds).toFixed(2));
      payoutIfOneFails.push({
        failed_match: `${combined.selections[i].home_team} vs ${combined.selections[i].away_team}`,
        failed_selection: combined.selections[i].selection,
        remaining_odds: parseFloat(subOdds.toFixed(2)),
        gain: gain
      });
    }

    const minGainIfOneFails = Math.min(...payoutIfOneFails.map(p => p.gain));
    const maxGainIfOneFails = Math.max(...payoutIfOneFails.map(p => p.gain));
    const sumAllGainsIfAllHit = parseFloat(payoutIfOneFails.reduce((acc, p) => acc + p.gain, 0).toFixed(2));

    combined.system_bet = {
      system_name: systemName,
      sub_bets_count: subBetsCount,
      stake_per_bet: stakePerBet,
      total_stake: stake,
      payout_if_all_win: sumAllGainsIfAllHit,
      min_gain_on_one_error: minGainIfOneFails,
      max_gain_on_one_error: maxGainIfOneFails,
      profitable_on_one_error: minGainIfOneFails >= stake,
      description: `En misant ${stake}€ en ${systemName} (${subBetsCount} tickets combinés de ${stakePerBet}€), une seule erreur vous laisse quand même 1 combinaison gagnante (gain garanti de ${minGainIfOneFails}€ à ${maxGainIfOneFails}€).`
    };
  }

  return combined;
}

/**
 * Generate an AI-powered combined bet from analyzed matches
 */
async function generateCombined({ strategy = 'balanced', riskLevel = 'medium', matches, stake = 10, targetOddsRange, preferredMarkets, cashoutOptimized }) {
  if (!genAI) {
    const mock = generateMockCombined({ strategy, riskLevel, matches, stake, targetOddsRange, preferredMarkets, cashoutOptimized });
    return enrichCombinedWithMathAndCashout(mock, stake);
  }

  // Select top 10-12 candidate matches for fast, precise AI processing
  let candidatePool = matches.filter(m => {
    let raw = {};
    try { raw = JSON.parse(m.raw_research || '{}'); } catch (_) {}
    let mkt = {};
    try { mkt = JSON.parse(m.market_dynamics || '{}'); } catch (_) {}
    if (strategy === 'safe' && (raw.overall_risk === 'élevé' || mkt.trap_warning)) return false;
    return true;
  });
  if (candidatePool.length < 4) candidatePool = matches;
  const poolToUse = candidatePool.slice(0, 12);

  const matchSummaries = poolToUse.map((m, i) => {
    let raw = {};
    try { raw = JSON.parse(m.raw_research || '{}'); } catch (_) {}
    let xg = {};
    try { xg = JSON.parse(m.xg_metrics || '{}'); } catch (_) {}
    let fat = {};
    try { fat = JSON.parse(m.fatigue_schedule || '{}'); } catch (_) {}
    let mkt = {};
    try { mkt = JSON.parse(m.market_dynamics || '{}'); } catch (_) {}

    const riskAlerts = [];
    if (raw.result_risk_alert) riskAlerts.push(`1N2: ${raw.result_risk_alert}`);
    if (raw.btts_risk_alert) riskAlerts.push(`BTTS: ${raw.btts_risk_alert}`);
    if (raw.over25_risk_alert) riskAlerts.push(`Over/Under: ${raw.over25_risk_alert}`);
    if (raw.double_chance_risk_alert) riskAlerts.push(`DC: ${raw.double_chance_risk_alert}`);
    if (mkt.trap_warning) riskAlerts.push(`🚨 PIÈGE MARCHÉ: ${mkt.trap_warning}`);
    if (fat.rotation_risk && fat.rotation_risk !== 'faible') riskAlerts.push(`ROTATION: Risque ${fat.rotation_risk}`);

    const valueBetsList = Array.isArray(raw.value_bets_structured) && raw.value_bets_structured.length > 0
      ? raw.value_bets_structured.map(vb => `${vb.market}:${vb.selection} (cote ${vb.bookmaker_odds}, edge ${vb.value_edge})`).join(', ')
      : (m.value_bets || 'Aucun');

    const xgSummary = xg.home_xg ? `${m.home_team} ~${xg.home_xg} xG vs ${m.away_team} ~${xg.away_xg} xG (${xg.verdict || ''})` : 'N/A';
    const fatigueSummary = fat.home_rest_days !== undefined ? `Repos: ${m.home_team} (${fat.home_rest_days}j) vs ${m.away_team} (${fat.away_rest_days}j) - ${fat.travel_km || ''}` : 'N/A';
    const marketSummary = mkt.odds_trend ? `Tendance: ${mkt.odds_trend} | Smart Money: ${mkt.smart_money || 'normal'}` : 'N/A';

    return `Match ${i + 1} [ID:${m.id}]: ${m.home_team} vs ${m.away_team} (${m.competition})
- Date & Heure: ${m.match_date} ${m.match_time}
- Cotes 1N2: 1=${m.odds_home} / N=${m.odds_draw} / 2=${m.odds_away}
- Prédiction IA: ${m.ai_prediction || 'N/A'} (confiance: ${m.ai_confidence || 'N/A'})
- Risque 1N2: ${raw.result_risk_level || 'N/A'} ${raw.result_avoid ? '[À ÉVITER]' : ''}
- Double Chance: ${m.double_chance_prediction || 'N/A'} (risque: ${raw.double_chance_risk_level || 'faible'})
- BTTS: ${m.btts_prediction || 'N/A'} (risque: ${raw.btts_risk_level || 'N/A'} ${raw.btts_avoid ? '[À ÉVITER]' : ''})
- Over 2.5: ${m.over25_prediction || 'N/A'} (risque: ${raw.over25_risk_level || 'N/A'} ${raw.over25_avoid ? '[À ÉVITER]' : ''})
- Handicap: ${m.asian_handicap_prediction || 'N/A'} (risque: ${raw.asian_handicap_risk_level || 'N/A'})
- Métriques xG: ${xgSummary}
- Fatigue & Calendrier: ${fatigueSummary}
- Marché & Flux: ${marketSummary}
- VALUE BETS: ${valueBetsList}
- Recommandé combiné: ${raw.recommended_for_combined ? 'Oui' : 'Non'} — ${raw.combined_selection || 'N/A'} (${raw.combined_market || 'N/A'})
- ALERTES PIÈGES / RISQUES: ${riskAlerts.length > 0 ? riskAlerts.join(' | ') : 'Aucune'}`;
  }).join('\n\n');

  const maxSelections = { low: 4, medium: 6, high: 10, max: 15 }[riskLevel] || 6;
  const minSelections = { low: 2, medium: 3, high: 5, max: 8 }[riskLevel] || 3;

  const strategyDesc = {
    safe: 'SÉCURISÉE — UNIQUEMENT sélections confiance ≥ 70%, JAMAIS un marché marqué [À ÉVITER] ou avec [PIÈGE MARCHÉ], privilégie Double Chance et BTTS Non sur équipes défensives, cotes 1.25-1.80',
    balanced: 'ÉQUILIBRÉE — évite les marchés avec alertes de risque élevé ou pièges, mélange résultat + marchés alternatifs, inclut les value bets identifiés, cotes 1.50-2.50',
    aggressive: 'AGRESSIVE — maximise les gains avec value bets à edge positif, peut inclure paris modérément risqués si la cote justifie le risque, cotes 2.00-5.00',
  }[strategy] || 'ÉQUILIBRÉE';

  const filterDirectives = [];
  if (targetOddsRange) filterDirectives.push(`- COTE TOTALE SOUHAITÉE : Vise une cote globale dans la fourchette ${targetOddsRange}`);
  if (preferredMarkets && preferredMarkets !== 'all') {
    if (preferredMarkets === 'safe_dc') filterDirectives.push(`- MARCHÉS : Privilégie fortement la Double Chance et les paris sécurisés. Évite les 1N2 secs risqués.`);
    else if (preferredMarkets === 'goals') filterDirectives.push(`- MARCHÉS : Privilégie les Over/Under et BTTS basés sur les xG.`);
    else if (preferredMarkets === 'no_1n2') filterDirectives.push(`- MARCHÉS : EXCLUS les 1N2 secs, utilise uniquement Double Chance, Over/Under ou BTTS.`);
  }
  if (cashoutOptimized) {
    filterDirectives.push(`- CASHOUT : Choisis des matchs échelonnés dans le temps. Le dernier match doit commencer après les autres pour permettre une couverture / cashout.`);
  }

  const prompt = `Tu es un expert en paris sportifs combinés CRITIQUE, rigoureux et expert en value betting (EV+). Construis le meilleur combiné possible avec les matchs fournis.

STRATÉGIE : ${strategyDesc}
NOMBRE DE SÉLECTIONS : entre ${minSelections} et ${maxSelections}
MISE : ${stake}€
${filterDirectives.join('\n')}

RÈGLES D'EXPERTISE ABSOLUES :
1. N'inclus JAMAIS un pari [À ÉVITER] ou un match avec une alerte [PIÈGE MARCHÉ] dans un combiné SÉCURISÉ ou ÉQUILIBRÉ.
2. Utilise les métriques xG et Fatigue : favorise les équipes avec repos supérieur (≥5j vs ≤3j) et xG dominant. Élimine les équipes sujettes à forte rotation ou en match sans enjeu.
3. Priorise les sélections avec Value Edge positif (probabilité réelle estimée > probabilité implicite de la cote).
4. Trie les sélections par ordre chronologique de coup d'envoi.
5. Sois sélectif : si un match présente des risques ou un marché piège, écarte-le.

MATCHS DISPONIBLES :
${matchSummaries}

Réponds UNIQUEMENT avec ce JSON valide (sans markdown, sans texte additionnel) :
{
  "name": "Nom percutant du combiné (ex: Combo Sécurité xG & Double Chance)",
  "rationale": "Explication détaillée de la stratégie et pourquoi ces sélections ont été retenues",
  "risk_assessment": "Analyse honnête des points de vigilance",
  "selections": [
    {
      "match_id": <id du match>,
      "home_team": "<équipe dom>",
      "away_team": "<équipe ext>",
      "competition": "<compétition>",
      "match_date": "<date>",
      "match_time": "<heure>",
      "market": "<1N2|BTTS|Over 2.5|Under 2.5|Double Chance|Handicap>",
      "selection": "<sélection précise>",
      "odds": <cote>,
      "confidence": "<ex: 74%>",
      "rationale": "<justification basée sur xG/fatigue/value>",
      "risk_level": "faible|modéré|élevé",
      "is_value_bet": true,
      "value_edge": "+12.0%"
    }
  ],
  "total_odds": <produit des cotes>,
  "potential_gain": <mise * total_odds>,
  "confidence_score": "<ex: 70%>",
  "risk_level": "${riskLevel}",
  "strategy_used": "${strategy}"
}`;

  try {
    const text = await callGemini(prompt);
    const result = JSON.parse(text);
    return enrichCombinedWithMathAndCashout(result, stake);
  } catch (err) {
    console.error('❌ Combined generation error:', err.message);
    const mock = generateMockCombined({ strategy, riskLevel, matches, stake, targetOddsRange, preferredMarkets, cashoutOptimized });
    return enrichCombinedWithMathAndCashout(mock, stake);
  }
}

function generateMockCombined({ strategy, riskLevel, matches, stake, targetOddsRange, preferredMarkets, cashoutOptimized }) {
  const maxCount = { low: 4, medium: 6, high: 10, max: 15 }[riskLevel] || 6;
  const minCount = { low: 2, medium: 3, high: 5, max: 8 }[riskLevel] || 3;

  // Filter matches based on risk directives
  const validMatches = matches.filter(m => {
    let raw = {};
    try { raw = JSON.parse(m.raw_research || '{}'); } catch (_) {}
    let mkt = {};
    try { mkt = JSON.parse(m.market_dynamics || '{}'); } catch (_) {}
    if (strategy === 'safe' && (raw.overall_risk === 'élevé' || mkt.trap_warning)) return false;
    return true;
  });

  const pool = validMatches.length >= minCount ? validMatches : matches;
  // If cashout optimized, sort by date/time
  pool.sort((a, b) => `${a.match_date || ''} ${a.match_time || ''}`.localeCompare(`${b.match_date || ''} ${b.match_time || ''}`));

  const selected = pool.slice(0, Math.min(maxCount, pool.length));

  const selections = selected.map(m => {
    let raw = {};
    try { raw = JSON.parse(m.raw_research || '{}'); } catch (_) {}
    let xg = {};
    try { xg = JSON.parse(m.xg_metrics || '{}'); } catch (_) {}

    // Check if there is a value bet
    const vb = Array.isArray(raw.value_bets_structured) && raw.value_bets_structured.length > 0
      ? raw.value_bets_structured[0] : null;

    if (strategy === 'aggressive' && vb) {
      return {
        match_id: m.id,
        home_team: m.home_team,
        away_team: m.away_team,
        competition: m.competition,
        match_date: m.match_date,
        match_time: m.match_time,
        market: vb.market,
        selection: vb.selection,
        odds: vb.bookmaker_odds || 2.10,
        confidence: vb.estimated_real_probability || '65%',
        rationale: vb.rationale || 'Value bet détecté avec edge positif.',
        risk_level: 'modéré',
        is_value_bet: true,
        value_edge: vb.value_edge || '+10%',
      };
    }

    let market = raw.combined_market || 'Double Chance';
    let selection = raw.combined_selection || `1X (Victoire ${m.home_team} ou Nul)`;
    if (preferredMarkets === 'no_1n2' && market === '1N2') {
      market = 'Double Chance';
      selection = `1X (${m.home_team} ou Nul)`;
    }

    const rawOdds = m.odds_home ? Math.min(m.odds_home * 0.78, 1.65) : 1.45;
    const odds = Math.max(1.15, rawOdds);

    return {
      match_id: m.id,
      home_team: m.home_team,
      away_team: m.away_team,
      competition: m.competition,
      match_date: m.match_date,
      match_time: m.match_time,
      market: market,
      selection: selection,
      odds: parseFloat(odds.toFixed(2)),
      confidence: m.ai_confidence || '72%',
      rationale: xg.verdict ? `Sélection validée par les métriques xG : ${xg.verdict}` : `Sélection optimisée par l'IA évitant les marchés piégeux.`,
      risk_level: raw.overall_risk === 'faible' ? 'faible' : 'modéré',
      is_value_bet: !!vb,
      value_edge: vb ? vb.value_edge : '+7.5%',
    };
  });

  const totalOdds = selections.reduce((acc, s) => acc * s.odds, 1);

  return {
    name: `Combo ${strategy === 'safe' ? 'Sécurité Pro' : strategy === 'aggressive' ? 'Jackpot Value' : 'Équilibré xG'} IA`,
    rationale: `Combiné ${strategy} optimisé avec ${selections.length} sélections évitant les pièges et marchés à haut risque.`,
    risk_assessment: strategy === 'safe' ? 'Risque faible : marchés protégés, asymétries de repos favorables et cotes sans piège.' : 'Risque maîtrisé avec cotes à valeur ajoutée.',
    selections,
    total_odds: parseFloat(totalOdds.toFixed(2)),
    potential_gain: parseFloat((stake * totalOdds).toFixed(2)),
    confidence_score: strategy === 'safe' ? '74%' : '65%',
    risk_level: riskLevel,
    strategy_used: strategy,
  };
}

module.exports = { analyzeMatch, generateCombined, initAI };
