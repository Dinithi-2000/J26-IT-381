import { useId } from 'react';

const COLORS = ['#426B53', '#A85A2A', '#527F9A'];
export default function TrendChart({ records, series, label }) {
  const gradientId = useId().replace(/:/g, '');
  if (!records.length) return <p className="chart-empty">No measurement history available for this sample.</p>;
  const allValues = records.flatMap(record => series.map(item => item.read(record))).filter(Number.isFinite);
  if (!allValues.length) return <p>No values available for this measurement.</p>;
  const min = Math.min(...allValues), max = Math.max(...allValues);
  const padding = Math.max((max - min) * 0.25, 0.5);
  const low = min - padding, high = max + padding;
  const y = value => 145 - (value - low) / (high - low) * 130;
  const firstDay = records[0].day, lastDay = records.at(-1).day;
  const x = day => lastDay === firstDay ? 230 : (day - firstDay) / (lastDay - firstDay) * 460;
  const color = (item, index) => item.color || COLORS[index % COLORS.length];
  const ticks = [3, 2, 1, 0].map(index => low + (high - low) * index / 3);
  return <div className="measurement-chart">
    <div className="chart-body">
      <div className="chart-y-axis" aria-label="Value axis">{ticks.map((value, index) => <span key={index}>{Math.abs(value) >= 1000 ? `${(value / 1000).toFixed(1)}k` : value.toFixed(1)}</span>)}</div>
      <div className="chart-plot">
        <svg className="trend-chart" viewBox="0 0 460 160" preserveAspectRatio="none" role="img" aria-label={`${label}. Exact values are available in measurement history.`}>
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color(series[0], 0)} stopOpacity=".16" /><stop offset="100%" stopColor={color(series[0], 0)} stopOpacity=".01" /></linearGradient></defs>
          {ticks.map((value, index) => <line key={index} x1="0" x2="460" y1={y(value)} y2={y(value)} stroke="#D7E0D2" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />)}
          {series.map((item, index) => {
            const valid = records.filter(record => Number.isFinite(item.read(record)));
            const points = valid.map(record => `${x(record.day)},${y(item.read(record))}`).join(' ');
            return <g key={item.name}>
              {series.length === 1 && valid.length > 1 && <polygon points={`${x(valid[0].day)},145 ${points} ${x(valid.at(-1).day)},145`} fill={`url(#${gradientId})`} />}
              <polyline points={points} fill="none" stroke={color(item, index)} strokeWidth="2.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              {valid.map(record => <circle key={record.timestamp} cx={x(record.day)} cy={y(item.read(record))} r="3.5" fill="white" stroke={color(item, index)} strokeWidth="2" vectorEffect="non-scaling-stroke">
                <title>{`${item.name}: ${item.read(record)} · ${record.timestamp} · Day ${record.day}`}</title></circle>)}
            </g>;
          })}
        </svg>
        <div className="chart-x-axis" aria-label="Storage day axis">{records.map(record => <span key={record.timestamp}>Day<span>{record.day}</span></span>)}</div>
      </div>
    </div>
    <div className="chart-legend">{series.map((item, index) => <span key={item.name}><i style={{ background: color(item, index) }} />{item.name}</span>)}</div>
  </div>;
}
