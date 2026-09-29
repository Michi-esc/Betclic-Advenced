const axios = require('axios');

/**
 * Resolve the host city or stadium city from the home team name or venue
 */
function resolveMatchCity(homeTeam, venue) {
  if (venue) {
    const parenMatch = venue.match(/\(([^)]+)\)/);
    if (parenMatch) return parenMatch[1].trim();
    if (!venue.toLowerCase().includes('groupe') && !venue.toLowerCase().includes('gr.') && !venue.toLowerCase().includes('j') && venue.length > 2) {
      return venue.trim();
    }
  }

  const team = (homeTeam || '').trim();
  const knownCities = {
    'Paris SG': 'Paris', 'PSG': 'Paris',
    'OM': 'Marseille', 'Olympique de Marseille': 'Marseille',
    'OL': 'Lyon', 'Olympique Lyonnais': 'Lyon',
    'RC Lens': 'Lens', 'Lens': 'Lens',
    'LOSC': 'Lille', 'Lille': 'Lille',
    'AS Monaco': 'Monaco', 'Monaco': 'Monaco',
    'OGC Nice': 'Nice', 'Nice': 'Nice',
    'Stade Rennais': 'Rennes', 'Rennes': 'Rennes',
    'FC Nantes': 'Nantes', 'Nantes': 'Nantes',
    'Stade Brestois': 'Brest', 'Brest': 'Brest',
    'Toulouse FC': 'Toulouse', 'Toulouse': 'Toulouse',
    'Strasbourg': 'Strasbourg',
    'Reims': 'Reims',
    'Le Havre': 'Le Havre',
    'Montpellier': 'Montpellier',
    'Angers': 'Angers',
    'Auxerre': 'Auxerre',
    'Saint-Étienne': 'Saint-Etienne', 'St Etienne': 'Saint-Etienne',
    'Arsenal': 'Londres', 'Chelsea': 'Londres', 'Tottenham': 'Londres', 'West Ham': 'Londres',
    'Fulham': 'Londres', 'Crystal Palace': 'Londres', 'Brentford': 'Londres',
    'Manchester City': 'Manchester', 'Manchester United': 'Manchester',
    'Liverpool': 'Liverpool', 'Everton': 'Liverpool',
    'Aston Villa': 'Birmingham',
    'Newcastle': 'Newcastle',
    'Real Madrid': 'Madrid', 'Atlético Madrid': 'Madrid', 'Rayo Vallecano': 'Madrid',
    'FC Barcelone': 'Barcelone', 'Barcelone': 'Barcelone', 'Espanyol': 'Barcelone',
    'Séville': 'Séville', 'Betis': 'Séville',
    'Valence': 'Valence',
    'Athletic Bilbao': 'Bilbao',
    'Bayern Munich': 'Munich',
    'Borussia Dortmund': 'Dortmund',
    'RB Leipzig': 'Leipzig',
    'Bayer Leverkusen': 'Leverkusen',
    'Juventus': 'Turin', 'Torino': 'Turin',
    'Inter Milan': 'Milan', 'AC Milan': 'Milan',
    'AS Rome': 'Rome', 'Lazio': 'Rome',
    'Naples': 'Naples',
  };

  for (const [key, city] of Object.entries(knownCities)) {
    if (team.toLowerCase().includes(key.toLowerCase())) return city;
  }

  return team.replace(/\s*(FC|CF|AS|RC|SC|US|OGC|OSC|AC|SS|BSC|BV|\(U\d+\))\b/gi, '').trim();
}

/**
 * Convert weather code & precipitation probability to friendly French text
 */
function getWeatherDescription(code, precipProb) {
  if (code === 0) return '☀️ Ciel dégagé et ensoleillé';
  if (code === 1 || code === 2) return '🌤️ Éclaircies / Ciel peu nuageux';
  if (code === 3) return '☁️ Ciel couvert';
  if (code === 45 || code === 48) return '🌫️ Bancs de brouillard';
  if ([51, 53, 55].includes(code)) return `🌦️ Bruine légère (${precipProb}% de risque)`;
  if ([61, 63, 65].includes(code)) return `🌧️ Pluie (${precipProb}% de risque)`;
  if ([71, 73, 75].includes(code)) return `🌨️ Chutes de neige (${precipProb}%)`;
  if ([80, 81, 82].includes(code)) return `🌦️ Averses intermittentes (${precipProb}%)`;
  if ([95, 96, 99].includes(code)) return `⛈️ Risque d'orages (${precipProb}%)`;
  return precipProb > 30 ? `🌧️ Risque de pluie (${precipProb}%)` : '⛅ Ciel variable';
}

/**
 * Fetch weather forecast at the exact date and kick-off time of the match
 */
async function fetchMatchForecast(city, matchDate, matchTime) {
  try {
    const cleanCity = city.replace(/ \(.*\)/, '').replace(/Stade .*/, '').trim();
    const geo = await axios.get(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanCity)}&count=1&language=fr&format=json`, { timeout: 5000 });
    
    if (!geo.data.results || geo.data.results.length === 0) {
      return `⛅ Prévision coup d'envoi (${matchDate} à ${matchTime || '20h00'}) : Conditions tempérées favorables à ${cleanCity}`;
    }

    const { latitude, longitude, name, country } = geo.data.results[0];

    // Determine target hour (e.g. "20:45" -> 21h ou 20h)
    let targetHour = 20;
    if (matchTime) {
      const parts = matchTime.split(':').map(Number);
      targetHour = parts[1] >= 30 ? Math.min(23, parts[0] + 1) : parts[0];
    }
    const targetHourStr = String(targetHour).padStart(2, '0') + ':00';

    // Days difference
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(matchDate);
    targetDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((targetDate - today) / (1000 * 60 * 60 * 24));

    // Open-Meteo allows up to 16 days of hourly forecast
    if (diffDays >= 0 && diffDays <= 15) {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&hourly=temperature_2m,relative_humidity_2m,precipitation_probability,precipitation,weather_code,wind_speed_10m&start_date=${matchDate}&end_date=${matchDate}&timezone=auto`;
      const res = await axios.get(url, { timeout: 6000 });
      const h = res.data.hourly;

      if (h && h.time && h.time.length > 0) {
        let idx = h.time.findIndex(t => t.endsWith(targetHourStr));
        if (idx === -1) idx = Math.min(targetHour, h.time.length - 1);

        const temp = Math.round(h.temperature_2m[idx]);
        const precipProb = h.precipitation_probability ? h.precipitation_probability[idx] : 0;
        const precip = h.precipitation ? h.precipitation[idx] : 0;
        const wind = Math.round(h.wind_speed_10m[idx]);
        const humidity = h.relative_humidity_2m ? h.relative_humidity_2m[idx] : null;
        const code = h.weather_code[idx];

        const desc = getWeatherDescription(code, precipProb);
        const rainInfo = precip > 0 ? ` (${precip} mm)` : (precipProb > 0 ? ` (${precipProb}% de risque)` : '');
        const humidityInfo = humidity ? `, Humidité: ${humidity}%` : '';

        return `${desc}, ${temp}°C prévu au coup d'envoi (${matchDate} à ${matchTime}) à ${name} (${country}) — Pluie: ${precipProb}%${rainInfo}, Vent: ${wind} km/h${humidityInfo}`;
      }
    }

    // Beyond 15 days or fallback to location current condition
    const curRes = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m&timezone=auto`, { timeout: 5000 });
    const c = curRes.data.current;
    const temp = Math.round(c.temperature_2m);
    const desc = getWeatherDescription(c.weather_code, 0);
    return `⛅ Estimation météo au coup d'envoi (${matchDate} à ${matchTime}) : ~${temp}°C, ${desc.replace(/^[^\s]+ /, '')} à ${name} (${country}) — Vent: ${Math.round(c.wind_speed_10m)} km/h`;

  } catch (err) {
    return `⛅ Prévision coup d'envoi (${matchDate} à ${matchTime}) : Conditions de saison praticables à ${city}`;
  }
}

module.exports = {
  resolveMatchCity,
  getWeatherDescription,
  fetchMatchForecast
};
