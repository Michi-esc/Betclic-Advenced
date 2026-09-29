const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Fetch live sports headlines via Google News RSS
 */
async function fetchLiveNews(query) {
  try {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=fr&gl=FR&ceid=FR:fr`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 6000
    });
    const $ = cheerio.load(res.data, { xmlMode: true });
    const news = [];
    $('item').each((i, el) => {
      if (i < 4) {
        const title = $(el).find('title').text().trim();
        if (title) news.push(title);
      }
    });
    return news.length > 0 ? news.join('\n- ') : 'Aucun article récent spécifique trouvé';
  } catch (err) {
    return 'Recherche d\'actualités en ligne temporairement indisponible';
  }
}

module.exports = {
  fetchLiveNews
};
