const axios = require('axios');

const CACHE = new Map();
const CACHE_MAX = 500;
const DAILY_VARS = 'temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode';

const archiveFetch = (lat, lng, start, end) =>
  axios.get('https://archive-api.open-meteo.com/v1/archive', {
    params: { latitude: lat, longitude: lng, start_date: start, end_date: end, daily: DAILY_VARS, timezone: 'auto' },
    timeout: 8000
  }).then(r => r.data);

// Archive data lags ~5 days; the forecast API fills the recent gap via past_days.
const forecastFetch = (lat, lng, start, end) =>
  axios.get('https://api.open-meteo.com/v1/forecast', {
    params: { latitude: lat, longitude: lng, start_date: start, end_date: end, daily: DAILY_VARS, timezone: 'auto', past_days: 92 },
    timeout: 8000
  }).then(r => r.data);

const toDays = (data) => {
  const d = data && data.daily;
  if (!d || !Array.isArray(d.time) || d.time.length === 0) return [];
  const days = d.time.map((date, i) => ({
    date,
    tmax: d.temperature_2m_max?.[i] ?? null,
    tmin: d.temperature_2m_min?.[i] ?? null,
    rain: d.precipitation_sum?.[i] ?? null,
    wind: d.windspeed_10m_max?.[i] ?? null,
    code: d.weathercode?.[i] ?? null
  }));
  const withData = days.filter(day => day.tmax != null || day.code != null);
  return withData.length ? withData : [];
};

const getWeather = async (lat, lng, start, end = start) => {
  if (lat == null || lng == null || !start) return { available: false };
  const key = `${Number(lat).toFixed(1)}|${Number(lng).toFixed(1)}|${start}|${end}`;
  if (CACHE.has(key)) return { available: true, days: CACHE.get(key) };

  let days = [];
  try {
    days = toDays(await archiveFetch(lat, lng, start, end));
    if (days.length === 0) days = toDays(await forecastFetch(lat, lng, start, end));
  } catch (err) {
    try {
      days = toDays(await forecastFetch(lat, lng, start, end));
    } catch (err2) {
      return { available: false };
    }
  }
  if (days.length === 0) return { available: false };

  while (CACHE.size >= CACHE_MAX) {
    CACHE.delete(CACHE.keys().next().value);
  }
  CACHE.set(key, days);
  return { available: true, days };
};

module.exports = { getWeather };
