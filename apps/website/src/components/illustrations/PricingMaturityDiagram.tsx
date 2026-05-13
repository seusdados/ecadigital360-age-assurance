import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const plans = [
  { title: 'Sandbox', body: 'testar integração', extras: ['ambiente · API básica'] },
  { title: 'Crescimento', body: 'operar verificações', extras: ['SDK · webhooks · suporte'] },
  { title: 'Enterprise', body: 'escala · SLA · compliance', extras: ['white-label · auditoria'], primary: true },
] as const;

export default function PricingMaturityDiagram({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 1000 480"
      role="img"
      aria-label="Progressão de maturidade dos planos AgeKey: sandbox para crescimento e enterprise"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />

      <defs>
        <marker
          id="ak-pm-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerUnits="userSpaceOnUse"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path d="M0 0 L9 5 L0 10 Z" fill={ak.accent} />
        </marker>
      </defs>

      {/* Stair connector */}
      <path
        d="M180 360 L380 320 L380 260 L580 220 L580 160 L820 120"
        fill="none"
        stroke={ak.accent}
        strokeOpacity="0.25"
        strokeWidth="1.6"
      />
      <path
        d="M180 360 L380 320 L380 260 L580 220 L580 160 L820 120"
        fill="none"
        stroke={ak.accent}
        strokeWidth="1.6"
        strokeDasharray="2 6"
        className="ak-flow-line"
        markerEnd="url(#ak-pm-arrow)"
      />

      {plans.map((p, i) => {
        const x = 60 + i * 300;
        const y = 296 - i * 88;
        const height = 160 + i * 16;
        const isPrimary = i === 2;
        return (
          <g key={p.title} transform={`translate(${x} ${y})`} className={`ak-card ak-reveal-${i + 1}`}>
            <rect
              width="244"
              height={height}
              rx="18"
              fill={isPrimary ? ak.foreground : ak.card}
              stroke={isPrimary ? ak.foreground : ak.border}
            />
            <circle cx="40" cy="40" r="18" fill={ak.accent} opacity={isPrimary ? '0.25' : '0.18'} />
            <text
              x="40"
              y="44"
              textAnchor="middle"
              fill={isPrimary ? ak.accentForeground : ak.foreground}
              fontSize="14"
              fontWeight="800"
            >
              {i + 1}
            </text>
            <text
              x="72"
              y="36"
              fill={isPrimary ? ak.background : ak.foreground}
              fontSize="18"
              fontWeight="800"
            >
              {p.title}
            </text>
            <text
              x="72"
              y="56"
              fill={isPrimary ? ak.background : ak.mutedForeground}
              opacity={isPrimary ? '0.7' : '1'}
              fontSize="12"
            >
              {p.body}
            </text>

            {/* Faux preview line */}
            <rect x="24" y="84" width="196" height="32" rx="9" fill={isPrimary ? ak.background : ak.muted} opacity={isPrimary ? '0.1' : '1'} stroke={isPrimary ? ak.accent : ak.border} strokeOpacity={isPrimary ? '0.4' : '1'} />
            <text
              x="122"
              y="104"
              textAnchor="middle"
              fill={isPrimary ? ak.background : ak.foreground}
              fontSize="11"
              fontWeight="600"
            >
              {p.extras[0]}
            </text>

            {/* Maturity badge */}
            <g transform={`translate(24 ${height - 44})`}>
              <rect width="84" height="22" rx="6" fill={isPrimary ? ak.accent : ak.muted} opacity={isPrimary ? '1' : '1'} stroke={ak.border} strokeOpacity={isPrimary ? '0' : '1'} />
              <text x="42" y="15" textAnchor="middle" fill={isPrimary ? ak.accentForeground : ak.foreground} fontSize="10" fontWeight="700">
                nível {i + 1}
              </text>
            </g>
            {isPrimary && (
              <g transform={`translate(120 ${height - 44})`}>
                <rect width="100" height="22" rx="6" fill={ak.background} opacity="0.12" stroke={ak.accent} strokeOpacity="0.4" />
                <text x="50" y="15" textAnchor="middle" fill={ak.background} fontSize="10" fontWeight="700">
                  white-label
                </text>
              </g>
            )}
          </g>
        );
      })}

      {/* Bottom axis labels */}
      <line x1="40" y1="448" x2="960" y2="448" stroke={ak.border} />
      <text x="80" y="468" fill={ak.mutedForeground} fontSize="10" fontWeight="700" letterSpacing="0.08em">
        MENOR MATURIDADE
      </text>
      <text x="920" y="468" textAnchor="end" fill={ak.mutedForeground} fontSize="10" fontWeight="700" letterSpacing="0.08em">
        MAIOR MATURIDADE
      </text>
    </svg>
  );
}
