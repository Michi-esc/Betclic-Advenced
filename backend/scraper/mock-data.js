const fs = require('fs');
const path = require('path');

function getDateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function normalizeSeedDates(matches) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  return matches.map((m, idx) => {
    // If date is missing or in the past, roll it forward smoothly over next 14 days
    if (!m.match_date || m.match_date < todayStr) {
      const dayOffset = (idx % 10) + 1; // 1 to 10 days in future
      const targetDate = new Date();
      targetDate.setDate(today.getDate() + dayOffset);
      return {
        ...m,
        match_date: targetDate.toISOString().split('T')[0]
      };
    }
    return m;
  });
}

function getAllCompetitionsMockData() {
  const seedPath = path.join(__dirname, 'matches-seed.json');
  if (fs.existsSync(seedPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        const normalized = normalizeSeedDates(data);
        console.log(`📦 Loaded ${normalized.length} matches from matches-seed.json (dates refreshed)`);
        return normalized;
      }
    } catch (e) {
      console.warn('Error reading matches-seed.json:', e.message);
    }
  }

  // Robust fallback data if seed is absent (20+ matches across all top leagues)
  return [
    { betclic_id: 'm_l1_1', competition: 'Ligue 1', competition_country: 'France', home_team: 'Paris Saint-Germain', away_team: 'Olympique de Marseille', match_date: getDateOffset(1), match_time: '21:00', venue: 'Parc des Princes', odds_home: 1.55, odds_draw: 4.20, odds_away: 5.50 },
    { betclic_id: 'm_l1_2', competition: 'Ligue 1', competition_country: 'France', home_team: 'Lyon', away_team: 'Monaco', match_date: getDateOffset(1), match_time: '17:00', venue: 'Groupama Stadium', odds_home: 2.10, odds_draw: 3.40, odds_away: 3.20 },
    { betclic_id: 'm_l1_3', competition: 'Ligue 1', competition_country: 'France', home_team: 'Lens', away_team: 'Lille', match_date: getDateOffset(2), match_time: '20:45', venue: 'Bollaert-Delelis', odds_home: 2.30, odds_draw: 3.10, odds_away: 2.90 },
    { betclic_id: 'm_l1_4', competition: 'Ligue 1', competition_country: 'France', home_team: 'Rennes', away_team: 'Nice', match_date: getDateOffset(2), match_time: '15:00', venue: 'Roazhon Park', odds_home: 2.05, odds_draw: 3.25, odds_away: 3.45 },
    { betclic_id: 'm_l1_5', competition: 'Ligue 1', competition_country: 'France', home_team: 'Marseille', away_team: 'Strasbourg', match_date: getDateOffset(3), match_time: '20:45', venue: 'Vélodrome', odds_home: 1.65, odds_draw: 3.80, odds_away: 4.90 },
    { betclic_id: 'm_pl_1', competition: 'Premier League', competition_country: 'Angleterre', home_team: 'Arsenal', away_team: 'Chelsea', match_date: getDateOffset(1), match_time: '18:30', venue: 'Emirates Stadium', odds_home: 1.80, odds_draw: 3.60, odds_away: 4.10 },
    { betclic_id: 'm_pl_2', competition: 'Premier League', competition_country: 'Angleterre', home_team: 'Manchester City', away_team: 'Liverpool', match_date: getDateOffset(2), match_time: '17:30', venue: 'Etihad Stadium', odds_home: 2.05, odds_draw: 3.50, odds_away: 3.30 },
    { betclic_id: 'm_pl_3', competition: 'Premier League', competition_country: 'Angleterre', home_team: 'Tottenham', away_team: 'Manchester United', match_date: getDateOffset(1), match_time: '13:30', venue: 'Tottenham Hotspur Stadium', odds_home: 2.20, odds_draw: 3.40, odds_away: 3.00 },
    { betclic_id: 'm_pl_4', competition: 'Premier League', competition_country: 'Angleterre', home_team: 'Aston Villa', away_team: 'Newcastle', match_date: getDateOffset(2), match_time: '15:00', venue: 'Villa Park', odds_home: 2.15, odds_draw: 3.30, odds_away: 3.20 },
    { betclic_id: 'm_liga_1', competition: 'LaLiga', competition_country: 'Espagne', home_team: 'Real Madrid', away_team: 'FC Séville', match_date: getDateOffset(1), match_time: '21:00', venue: 'Santiago Bernabéu', odds_home: 1.40, odds_draw: 4.60, odds_away: 7.20 },
    { betclic_id: 'm_liga_2', competition: 'LaLiga', competition_country: 'Espagne', home_team: 'FC Barcelone', away_team: 'Atlético Madrid', match_date: getDateOffset(2), match_time: '21:00', venue: 'Montjuïc', odds_home: 1.95, odds_draw: 3.40, odds_away: 3.75 },
    { betclic_id: 'm_liga_3', competition: 'LaLiga', competition_country: 'Espagne', home_team: 'Real Sociedad', away_team: 'Athletic Bilbao', match_date: getDateOffset(2), match_time: '18:30', venue: 'Anoeta', odds_home: 2.40, odds_draw: 3.10, odds_away: 3.00 },
    { betclic_id: 'm_bundes_1', competition: 'Bundesliga', competition_country: 'Allemagne', home_team: 'Bayern Munich', away_team: 'Bayer Leverkusen', match_date: getDateOffset(1), match_time: '18:30', venue: 'Allianz Arena', odds_home: 1.70, odds_draw: 3.90, odds_away: 4.20 },
    { betclic_id: 'm_bundes_2', competition: 'Bundesliga', competition_country: 'Allemagne', home_team: 'Borussia Dortmund', away_team: 'RB Leipzig', match_date: getDateOffset(2), match_time: '15:30', venue: 'Signal Iduna Park', odds_home: 2.15, odds_draw: 3.60, odds_away: 3.00 },
    { betclic_id: 'm_seriea_1', competition: 'Serie A', competition_country: 'Italie', home_team: 'Inter Milan', away_team: 'Juventus', match_date: getDateOffset(2), match_time: '20:45', venue: 'San Siro', odds_home: 1.90, odds_draw: 3.30, odds_away: 3.90 },
    { betclic_id: 'm_seriea_2', competition: 'Serie A', competition_country: 'Italie', home_team: 'AC Milan', away_team: 'Naples', match_date: getDateOffset(1), match_time: '20:45', venue: 'San Siro', odds_home: 2.25, odds_draw: 3.30, odds_away: 3.10 },
    { betclic_id: 'm_ucl_1', competition: 'Ligue des Champions', competition_country: 'Europe', home_team: 'Paris Saint-Germain', away_team: 'Real Madrid', match_date: getDateOffset(3), match_time: '21:00', venue: 'Parc des Princes', odds_home: 2.35, odds_draw: 3.45, odds_away: 2.75 },
    { betclic_id: 'm_ucl_2', competition: 'Ligue des Champions', competition_country: 'Europe', home_team: 'Arsenal', away_team: 'Bayern Munich', match_date: getDateOffset(3), match_time: '21:00', venue: 'Emirates Stadium', odds_home: 2.10, odds_draw: 3.40, odds_away: 3.25 },
    { betclic_id: 'm_ln_1', competition: 'Ligue des Nations UEFA', competition_country: 'Europe', home_team: 'France', away_team: 'Italie', match_date: getDateOffset(0), match_time: '20:45', venue: 'Stade de France', odds_home: 1.72, odds_draw: 3.60, odds_away: 4.60 },
    { betclic_id: 'm_ln_2', competition: 'Ligue des Nations UEFA', competition_country: 'Europe', home_team: 'Espagne', away_team: 'Allemagne', match_date: getDateOffset(0), match_time: '20:45', venue: 'Estadio de La Cartuja', odds_home: 2.05, odds_draw: 3.40, odds_away: 3.30 },
    { betclic_id: 'm_ln_3', competition: 'Ligue des Nations UEFA', competition_country: 'Europe', home_team: 'Portugal', away_team: 'Croatie', match_date: getDateOffset(1), match_time: '20:45', venue: 'Estádio da Luz', odds_home: 1.55, odds_draw: 3.90, odds_away: 5.80 },
    { betclic_id: 'm_ln_4', competition: 'Ligue des Nations UEFA', competition_country: 'Europe', home_team: 'Belgique', away_team: 'Israël', match_date: getDateOffset(1), match_time: '20:45', venue: 'Roi Baudouin', odds_home: 1.30, odds_draw: 5.20, odds_away: 8.50 },
  ];
}

function getAllAnalysesMockData() {
  const seedPath = path.join(__dirname, 'analyses-seed.json');
  if (fs.existsSync(seedPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(seedPath, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        console.log(`🧠 Loaded ${data.length} analyses from analyses-seed.json`);
        return data;
      }
    } catch (e) {
      console.warn('Error reading analyses-seed.json:', e.message);
    }
  }
  return [];
}

module.exports = {
  getAllCompetitionsMockData,
  getAllAnalysesMockData,
  getDateOffset
};
