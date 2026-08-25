import React, { useState, useEffect } from 'react';
import api from '../services/api';

const describeCode = (code) => {
  if (code == null) return { icon: '🌡️' };
  if (code === 0) return { icon: '☀️' };
  if (code <= 2) return { icon: '🌤️' };
  if (code === 3) return { icon: '☁️' };
  if (code === 45 || code === 48) return { icon: '🌫️' };
  if (code <= 57) return { icon: '🌦️' };
  if (code <= 67) return { icon: '🌧️' };
  if (code <= 77) return { icon: '🌨️' };
  if (code <= 82) return { icon: '🌧️' };
  if (code <= 86) return { icon: '❄️' };
  return { icon: '⛈️' };
};

const fmt = (v, unit) => (v == null ? '' : `${Math.round(v)}${unit}`);

export default function WeatherStrip({ adventureId }) {
  const [days, setDays] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api.get(`/adventures/${adventureId}/weather`)
      .then(r => {
        if (!cancelled && r.data.weather?.available) setDays(r.data.weather.days);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [adventureId]);

  if (!days || days.length === 0) return null;

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      flexWrap: 'wrap',
      marginTop: '10px'
    }}>
      {days.map(day => {
        const w = describeCode(day.code);
        return (
          <div key={day.date} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '999px',
            fontSize: '0.85rem'
          }} title={new Date(day.date).toLocaleDateString()}>
            <span>{w.icon}</span>
            <span>{fmt(day.tmax, '°')} / {fmt(day.tmin, '°')}</span>
            {day.rain != null && <span style={{ color: 'var(--text-light)' }}>💧 {fmt(day.rain, ' mm')}</span>}
            {day.wind != null && <span style={{ color: 'var(--text-light)' }}>💨 {fmt(day.wind, ' km/h')}</span>}
          </div>
        );
      })}
    </div>
  );
}
