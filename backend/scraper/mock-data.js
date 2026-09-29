/**
 * Fallback demo matches if Betclic scraping fails or network is disconnected
 */

function getDateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function getAllCompetitionsMockData() {
  return [
    {
      betclic_id: 'mock_ln_1', competition: 'Ligue des Nations UEFA', competition_country: 'Europe',
      home_team: 'Tchéquie', away_team: 'Angleterre',
      match_date: getDateOffset(0), match_time: '20:45', venue: 'Gr. A3, J2',
      odds_home: 9.25, odds_draw: 5.40, odds_away: 1.26,
    },
    {
      betclic_id: 'mock_ln_2', competition: 'Ligue des Nations UEFA', competition_country: 'Europe',
      home_team: 'Espagne', away_team: 'Croatie',
      match_date: getDateOffset(0), match_time: '20:45', venue: 'Gr. A3, J2',
      odds_home: 1.19, odds_draw: 6.40, odds_away: 11.00,
    },
    {
      betclic_id: 'mock_ln_3', competition: 'Ligue des Nations UEFA', competition_country: 'Europe',
      home_team: 'Écosse', away_team: 'Suisse',
      match_date: getDateOffset(0), match_time: '20:45', venue: 'Gr. B1, J2',
      odds_home: 3.95, odds_draw: 3.40, odds_away: 1.84,
    },
    {
      betclic_id: 'mock_l1_1', competition: 'Ligue 1', competition_country: 'France',
      home_team: 'Paris Saint-Germain', away_team: 'Olympique de Marseille',
      match_date: getDateOffset(4), match_time: '21:00', venue: 'Parc des Princes',
      odds_home: 1.55, odds_draw: 4.20, odds_away: 5.50,
    },
    {
      betclic_id: 'mock_pl_1', competition: 'Premier League', competition_country: 'Angleterre',
      home_team: 'Arsenal', away_team: 'Manchester City',
      match_date: getDateOffset(3), match_time: '16:30', venue: 'Emirates Stadium',
      odds_home: 2.80, odds_draw: 3.50, odds_away: 2.40,
    },
  ];
}

module.exports = {
  getAllCompetitionsMockData,
  getDateOffset
};
