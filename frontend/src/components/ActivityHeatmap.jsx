import { useState, useMemo } from 'react';

const DAYS = ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'];

function getActivityHeatmapData(byDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 364);

  while (startDate.getDay() !== 1) {
    startDate.setDate(startDate.getDate() - 1);
  }

  const dateMap = {};
  for (const item of byDate) {
    dateMap[item.date] = item.count;
  }

  const weeks = [];
  const current = new Date(startDate);

  while (current <= today) {
    const week = [];
    for (let day = 0; day < 7; day++) {
      const dateStr = current.toISOString().split('T')[0];
      week.push({
        date: dateStr,
        count: dateMap[dateStr] || 0,
        inRange: current <= today
      });
      current.setDate(current.getDate() + 1);
    }
    weeks.push(week);
  }

  return { weeks, startDate, today };
}

function getIntensity(count, accentColor) {
  if (!count) return 'var(--surface)';
  if (count <= 1) return accentColor + '33';
  if (count <= 3) return accentColor + '66';
  if (count <= 5) return accentColor + '99';
  return accentColor;
}

export const ActivityHeatmap = ({ byDate }) => {
  const [tooltip, setTooltip] = useState(null);
  const { weeks, startDate } = useMemo(() => getActivityHeatmapData(byDate), [byDate]);

  if (!byDate.length) {
    return (
      <div className="heatmap-empty">
        No activity data available. Start creating adventures!
      </div>
    );
  }

  const monthLabels = [];
  let lastMonth = -1;
  for (let weekIdx = 0; weekIdx < weeks.length; weekIdx++) {
    const firstDay = weeks[weekIdx][0];
    if (!firstDay.inRange) continue;
    const month = new Date(firstDay.date).getMonth();
    if (month !== lastMonth) {
      monthLabels.push({ month, weekIdx });
      lastMonth = month;
    }
  }

  const tooltipDate = tooltip ? new Date(tooltip.date + 'T00:00:00') : null;
  const tooltipText = tooltipDate
    ? tooltipDate.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '';

  return (
    <div style={{ position: 'relative' }}>
      <div className="heatmap" style={{ overflowX: 'auto', paddingBottom: '8px' }}>
        <div style={{ display: 'inline-block', minWidth: 'fit-content' }}>
          <div style={{ display: 'flex', gap: '3px', marginBottom: '4px', paddingLeft: '32px' }}>
            {monthLabels.map(({ month, weekIdx }) => (
              <div
                key={weekIdx}
                style={{
                  width: '13px',
                  textAlign: 'left',
                  fontSize: '10px',
                  color: 'var(--text-light)',
                  position: 'relative'
                }}
              >
                {new Date(2026, month, 1).toLocaleDateString(undefined, { month: 'short' })}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                <div style={{ width: '28px', fontSize: '10px', color: 'var(--text-light)', textAlign: 'right' }}>
                  {weekIdx % 1 === 0 ? '' : ''}
                </div>
                {week.map((day, dayIdx) => (
                  <div
                    key={dayIdx}
                    className="heatmap-day"
                    style={{
                      width: '13px',
                      height: '13px',
                      borderRadius: '2px',
                      background: getIntensity(day.count, 'var(--accent)'),
                      cursor: 'pointer',
                      opacity: day.inRange ? 1 : 0.2,
                      transition: 'transform 0.1s'
                    }}
                    onMouseEnter={(e) => {
                      setTooltip({ date: day.date, count: day.count, x: e.clientX, y: e.clientY });
                    }}
                    onMouseMove={(e) => {
                      setTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null));
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', marginTop: '8px', fontSize: '10px', color: 'var(--text-light)' }}>
        <span>Less</span>
        {[0, 1, 3, 5, 6].map((level) => (
          <div
            key={level}
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '2px',
              background: getIntensity(level, 'var(--accent)')
            }}
          />
        ))}
        <span>More</span>
      </div>

      {tooltip && (
        <div
          style={{
            position: 'fixed',
            left: tooltip.x + 12,
            top: tooltip.y - 32,
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            padding: '4px 8px',
            fontSize: '12px',
            pointerEvents: 'none',
            zIndex: 1000,
            whiteSpace: 'nowrap',
            boxShadow: 'var(--shadow-md)'
          }}
        >
          {tooltip.count} {tooltip.count === 1 ? 'adventure' : 'adventures'} on {tooltipText}
        </div>
      )}
    </div>
  );
};

export default ActivityHeatmap;
