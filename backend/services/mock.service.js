/**
 * Generate mock analysis when AI is not configured or unavailable
 */
function generateMockAnalysis(match) {
  const forms = ['V-V-N-V-D', 'D-V-V-N-V', 'V-N-V-V-D', 'N-V-D-V-V', 'V-V-V-N-D'];
  const randomForm = () => forms[Math.floor(Math.random() * forms.length)];

  const homeWinProb = match.odds_home ? (1 / match.odds_home) : 0.45;
  const isHomeFavorite = homeWinProb >= 0.50;

  const aiPrediction = isHomeFavorite
    ? `Victoire ${match.home_team} 2-1`
    : `Double Chance 1X ou Nul`;

  const xgAnalysis = {
    home_xg: isHomeFavorite ? 1.82 : 1.25,
    away_xg: isHomeFavorite ? 0.95 : 1.40,
    home_xga: isHomeFavorite ? 0.88 : 1.45,
    away_xga: isHomeFavorite ? 1.70 : 1.10,
    verdict: isHomeFavorite
      ? `Volume de frappes et xG nettement en faveur de ${match.home_team} à domicile.`
      : `Opposition très équilibrée au niveau des Expected Goals générés.`
  };

  const fatigueAnalysis = {
    home_rest_days: 6,
    away_rest_days: isHomeFavorite ? 3 : 5,
    travel_km: `Déplacement de ~750 km`,
    rotation_risk: isHomeFavorite ? 'modéré' : 'faible',
    schedule_context: isHomeFavorite
      ? `L'extérieur a joué un match à haute intensité en milieu de semaine.`
      : `Semaine d'entraînement complète pour les deux formations.`
  };

  const lineupAnalysis = {
    home_system: '4-3-3',
    away_system: '4-2-3-1',
    key_absences_impact: `Absences limitées, charnières défensives titulaires en place.`,
    lineup_status: 'très probable'
  };

  const marketDynamics = {
    odds_trend: isHomeFavorite ? 'en baisse sur 1' : 'stable',
    smart_money: isHomeFavorite
      ? `Flux modéré en faveur de ${match.home_team} et Double Chance.`
      : `Mises réparties de façon homogène sur le 1N2.`,
    trap_warning: null
  };

  const refereeAnalysis = {
    referee_name: 'Arbitre FFF / UEFA Pro',
    cards_tendency: 'Moyenne ~3.7 cartons/match',
    penalties_rate: 'modéré',
    game_tempo: 'fluide'
  };

  const stakesAnalysis = {
    standings_context: `Match clé pour la dynamique de qualification et le classement.`,
    motivation_level: 'très élevée des deux côtés',
    biscotto_risk: 'faible'
  };

  const notesSections = [
    `📌 SYNTHÈSE :\nPréparation active des deux équipes avant cette confrontation décisive. Match disputé dans de bonnes conditions.`,
    `📊 MÉTRIQUES AVANCÉES & xG :\n• ${match.home_team} : ~${xgAnalysis.home_xg} xG / ${xgAnalysis.home_xga} xGA concédé\n• ${match.away_team} : ~${xgAnalysis.away_xg} xG / ${xgAnalysis.away_xga} xGA concédé\n• Évaluation : ${xgAnalysis.verdict}`,
    `⚡ CALENDRIER & FATIGUE :\n• Jours de repos : ${match.home_team} (${fatigueAnalysis.home_rest_days}j) vs ${match.away_team} (${fatigueAnalysis.away_rest_days}j)\n• Risque de rotation : ${fatigueAnalysis.rotation_risk} | ${fatigueAnalysis.travel_km}\n• Contexte : ${fatigueAnalysis.schedule_context}`,
    `📋 TACTIQUE & ABSENTS CLÉS :\n• Dispositifs : ${match.home_team} (${lineupAnalysis.home_system}) vs ${match.away_team} (${lineupAnalysis.away_system})\n• Impact absents : ${lineupAnalysis.key_absences_impact}`,
    `📈 ANALYSE DU MARCHÉ & COTES :\n• Tendance cote : ${marketDynamics.odds_trend}\n• Flux pro (Smart Money) : ${marketDynamics.smart_money}`,
    `👨‍⚖️ ARBITRAGE & DISCIPLINE :\n• Profil : ${refereeAnalysis.referee_name} (${refereeAnalysis.cards_tendency})\n• Tendance penalties : ${refereeAnalysis.penalties_rate} | Rythme : ${refereeAnalysis.game_tempo}`,
    `🎯 ENJEUX & MOTIVATION :\n• Contexte : ${stakesAnalysis.standings_context}\n• Motivation : ${stakesAnalysis.motivation_level}`,
  ];

  const fullNotes = notesSections.join('\n\n');

  const rawResearch = {
    weather_info: `⛅ Prévision coup d'envoi (${match.match_date} à ${match.match_time}) : ~17°C, vent modéré 12 km/h, pelouse praticable`,
    home_injuries: `Aucun forfait majeur pour ${match.home_team}`,
    away_injuries: `1 incertitude au milieu pour ${match.away_team}`,
    home_form: randomForm(),
    away_form: randomForm(),
    head_to_head: `Historique équilibré entre ${match.home_team} et ${match.away_team}`,
    recent_news: fullNotes,
    ai_prediction: aiPrediction,
    ai_confidence: '68%',
    ai_recommendation: isHomeFavorite
      ? `Légère supériorité à domicile, mais match pouvant être piégeux.`
      : `Résultat incertain, prudence recommandée sur le 1N2 sec.`,
    result_risk_level: isHomeFavorite ? 'modéré' : 'élevé',
    result_risk_alert: isHomeFavorite ? null : 'Match très indécis, les deux équipes ont un niveau très proche. Éviter le 1N2 sec.',
    result_avoid: !isHomeFavorite,
    btts_prediction: 'Oui',
    btts_confidence: '72%',
    btts_rationale: 'Les deux équipes ont marqué lors de 4 de leurs 5 dernières confrontations.',
    btts_risk_level: 'faible',
    btts_risk_alert: null,
    btts_avoid: false,
    over25_prediction: 'Plus de 2.5 buts',
    over25_confidence: '64%',
    over25_rationale: 'Moyenne de 2.8 buts par match sur les confrontations directes récentes.',
    over25_risk_level: 'modéré',
    over25_risk_alert: null,
    over25_avoid: false,
    double_chance_prediction: '1X',
    double_chance_rationale: `${match.home_team} invaincu à domicile lors de ses 4 derniers matchs.`,
    double_chance_risk_level: 'faible',
    double_chance_risk_alert: null,
    asian_handicap_prediction: `${match.home_team} (0)`,
    asian_handicap_rationale: 'Sécurité en cas de match nul (remboursé).',
    asian_handicap_risk_level: 'faible',
    asian_handicap_risk_alert: null,
    xg_analysis: xgAnalysis,
    fatigue_analysis: fatigueAnalysis,
    lineup_analysis: lineupAnalysis,
    market_dynamics: marketDynamics,
    referee_analysis: refereeAnalysis,
    stakes_analysis: stakesAnalysis,
    value_bets_structured: [
      {
        market: 'BTTS',
        selection: 'Les deux marquent : Oui',
        bookmaker_odds: 1.85,
        implied_probability: '54.0%',
        estimated_real_probability: '68.0%',
        value_edge: '+14.0%',
        rationale: 'Cote anormalement haute par rapport au profil offensif et aux faiblesses défensives observées.'
      }
    ],
    score_prediction: '2-1',
    overall_risk: 'moyen',
    recommended_for_combined: true,
    combined_selection: '1X (Double Chance)',
    combined_market: 'Double Chance'
  };

  return {
    weather_info: rawResearch.weather_info,
    home_injuries: rawResearch.home_injuries,
    away_injuries: rawResearch.away_injuries,
    home_form: rawResearch.home_form,
    away_form: rawResearch.away_form,
    home_is_home: 1,
    head_to_head: rawResearch.head_to_head,
    recent_news: fullNotes,
    ai_prediction: rawResearch.ai_prediction,
    ai_confidence: rawResearch.ai_confidence,
    ai_recommendation: rawResearch.ai_recommendation,
    btts_prediction: rawResearch.btts_prediction,
    btts_confidence: rawResearch.btts_confidence,
    over25_prediction: rawResearch.over25_prediction,
    over25_confidence: rawResearch.over25_confidence,
    double_chance_prediction: rawResearch.double_chance_prediction,
    asian_handicap_prediction: rawResearch.asian_handicap_prediction,
    value_bets: 'BTTS: Les deux marquent : Oui (cote 1.85, prob réelle 68.0%, edge +14.0%)',
    xg_metrics: JSON.stringify(xgAnalysis),
    fatigue_schedule: JSON.stringify(fatigueAnalysis),
    market_dynamics: JSON.stringify(marketDynamics),
    raw_research: JSON.stringify(rawResearch),
  };
}

module.exports = {
  generateMockAnalysis
};
