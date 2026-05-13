import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const cases = [
  { label: 'Edtechs', x: 96, y: 60 },
  { label: 'Marketplaces', x: 624, y: 60 },
  { label: 'Publishers', x: 76, y: 320 },
  { label: 'Jogos', x: 644, y: 320 },
  { label: 'Comunidades', x: 360, y: 32 },
  { label: 'Apps digitais', x: 360, y: 388 },
] as const;

export default function UseCasesNetworkIllustration({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  // Center of the illustration
  const cx = 480;
  const cy = 240;
  return (
    <svg
      viewBox="0 0 960 480"
      role="img"
      aria-label="AgeKey conectado a edtechs, marketplaces, publishers, jogos, comunidades e apps digitais"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />

      {/* Connectors from center to each card (drawn first so they sit behind) */}
      {cases.map((c) => {
        const targetX = c.x + 88; // card center x (card width 176 / 2)
        const targetY = c.y + 32; // card center y (card height 64 / 2)
        return (
          <g key={`${c.label}-line`}>
            <line
              x1={cx}
              y1={cy}
              x2={targetX}
              y2={targetY}
              stroke={ak.foreground}
              strokeOpacity="0.18"
              strokeWidth="1.4"
            />
            <line
              x1={cx}
              y1={cy}
              x2={targetX}
              y2={targetY}
              stroke={ak.accent}
              strokeWidth="1.4"
              strokeDasharray="2 6"
              className="ak-flow-line"
            />
          </g>
        );
      })}

      {/* Outer cards */}
      {cases.map((c) => (
        <g key={c.label} transform={`translate(${c.x} ${c.y})`} className="ak-card">
          <rect width="176" height="64" rx="14" fill={ak.card} stroke={ak.border} />
          <circle cx="32" cy="32" r="14" fill={ak.accent} opacity="0.18" />
          <circle cx="32" cy="32" r="6" fill={ak.accent} />
          <text x="56" y="37" fill={ak.foreground} fontSize="14" fontWeight="700">
            {c.label}
          </text>
        </g>
      ))}

      {/* Center hub: AgeKey */}
      <g transform="translate(396 168)" className="ak-float-slow">
        <rect width="168" height="144" rx="20" fill={ak.foreground} />
        <circle cx="84" cy="50" r="26" fill={ak.accent} opacity="0.22" />
        <path
          d="M84 28 L104 36 V58 C104 74 94 86 84 92 C74 86 64 74 64 58 V36 Z"
          fill={ak.background}
        />
        <path
          d="M74 56 l8 8 14 -18"
          fill="none"
          stroke={ak.accent}
          strokeWidth="3.5"
          className="ak-check-pop"
        />
        <text
          x="84"
          y="116"
          textAnchor="middle"
          fill={ak.background}
          fontSize="15"
          fontWeight="800"
        >
          AgeKey
        </text>
        <text
          x="84"
          y="132"
          textAnchor="middle"
          fill={ak.background}
          opacity="0.7"
          fontSize="10"
        >
          uma camada · vários produtos
        </text>
      </g>
    </svg>
  );
}
