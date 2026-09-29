const axios = require('axios');
const { parseSSRMatches } = require('./scraper/parser');
const { getAllCompetitionsMockData } = require('./scraper/mock-data');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'fr-FR,fr;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
  'Connection': 'keep-alive',
};

const BETCLIC_PAGES = [
  { url: 'https://www.betclic.fr/football-s1', label: 'Football (Matchs du Jour)' },
  { url: 'https://www.betclic.fr/football-s1/ligue-1-mcdonald-s-c4', label: 'Ligue 1' },
  { url: 'https://www.betclic.fr/football-s1/premier-league-c3', label: 'Premier League' },
  { url: 'https://www.betclic.fr/football-s1/la-liga-c14', label: 'La Liga' },
  { url: 'https://www.betclic.fr/football-s1/serie-a-c16', label: 'Serie A' },
  { url: 'https://www.betclic.fr/football-s1/bundesliga-c7', label: 'Bundesliga' },
  { url: 'https://www.betclic.fr/football-s1/ligue-des-champions-c5', label: 'Ligue des Champions' },
  { url: 'https://www.betclic.fr/football-s1/europa-league-c79', label: 'Europa League' },
  { url: 'https://www.betclic.fr/football-s1/conference-league-c1070', label: 'Conference League' },
  { url: 'https://www.betclic.fr/football-s1/ligue-des-nations-uefa-c22676', label: 'Ligue des Nations UEFA' },
];

/**
 * Scrape a single Betclic page and parse SSR matches
 */
async function scrapePage(url) {
  const response = await axios.get(url, { headers: HEADERS, timeout: 15000 });
  return parseSSRMatches(response.data);
}

/**
 * Main scraping function that scans all configured football pages
 */
async function scrapeMatches() {
  console.log('🔍 Scraping Betclic.fr pour les vrais matchs et cotes...');

  const allMatchesMap = new Map();

  for (const page of BETCLIC_PAGES) {
    try {
      const matches = await scrapePage(page.url);
      for (const m of matches) {
        if (!allMatchesMap.has(m.betclic_id)) {
          allMatchesMap.set(m.betclic_id, m);
        }
      }
      if (matches.length > 0) {
        console.log(`  ✅ ${page.label}: ${matches.length} matchs`);
      }
    } catch (err) {
      console.log(`  ⚠️  ${page.label}: ${err.message}`);
    }
  }

  const results = [...allMatchesMap.values()];

  if (results.length > 0) {
    // Sort so closest upcoming matches appear first
    results.sort((a, b) => (a.match_date + a.match_time).localeCompare(b.match_date + b.match_time));
    const withOdds = results.filter(m => m.odds_home !== null).length;
    console.log(`\n✅ ${results.length} matchs trouvés (${withOdds} avec cotes)`);
    return results;
  }

  console.log('⚠️  Scraping échoué — utilisation des données démo');
  return getAllCompetitionsMockData();
}

module.exports = { scrapeMatches };
