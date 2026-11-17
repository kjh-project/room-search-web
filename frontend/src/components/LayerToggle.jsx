/** 매물·교통·편의시설 레이어 토글 (SFR-003) */
import { INFRA_STYLE } from './KakaoMap.jsx';
import { track } from '../lib/analytics.js';

const ITEMS = [
  { key: 'listing', icon: '🏠', label: '매물' },
  ...Object.entries(INFRA_STYLE).map(([key, s]) => ({ key, icon: s.icon, label: s.label })),
];

export default function LayerToggle({ layers, counts, onChange }) {
  return (
    <div className="layer-toggle" role="group" aria-label="지도 레이어">
      {ITEMS.map(({ key, icon, label }) => (
        <button
          key={key}
          className={`chip${layers[key] ? ' on' : ''}`}
          aria-pressed={layers[key]}
          onClick={() => {
            const next = { ...layers, [key]: !layers[key] };
            onChange(next);
            track('toggle_layer', { layer: key, on: next[key] });
          }}
        >
          {icon} {label}
          {counts?.[key] != null && <span className="count">{counts[key]}</span>}
        </button>
      ))}
    </div>
  );
}
