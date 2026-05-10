import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const methods = [
  ['Gateway Mode', 'atestadores externos', 84, 96],
  ['Credential Mode', 'credencial verificável', 650, 96],
  ['Proof Mode', 'preparado para provas', 84, 338],
  ['Fallback proporcional', 'fricção por risco', 650, 338],
] as const;

export default function MethodRouterDiagram({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 960 560"
      role="img"
      aria-label="AgeKey Verifier Core roteando gateway, credencial, proof mode e fallback para um resultado mínimo"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />
      <rect width="960" height="560" rx="28" fill={ak.background} />
      {methods.map(([title, subtitle, x, y], i) => (
        <g key={title} transform={`translate(${x} ${y})`} className={`ak-soft-card ak-reveal-${i + 1}`}>
          <rect width="230" height="100" rx="16" fill={ak.card} stroke={ak.border} />
          <circle cx="34" cy="34" r="14" fill={ak.accent} opacity="0.16" />
          <text x="56" y="36" fill={ak.foreground} fontSize="18" fontWeight="800">{title}</text>
          <text x="56" y="62" fill={ak.mutedForeground} fontSize="14">{subtitle}</text>
        </g>
      ))}
      <path d="M314 146 C390 146 392 236 454 252" fill="none" stroke={ak.accent} strokeWidth="2" className="ak-flow-line" />
      <path d="M650 146 C574 146 568 236 506 252" fill="none" stroke={ak.accent} strokeWidth="2" className="ak-flow-line" />
      <path d="M314 388 C390 388 392 308 454 292" fill="none" stroke={ak.accent} strokeWidth="2" className="ak-flow-line" />
      <path d="M650 388 C574 388 568 308 506 292" fill="none" stroke={ak.accent} strokeWidth="2" className="ak-flow-line" />
      <g className="ak-float-slow">
        <rect x="370" y="210" width="220" height="146" rx="18" fill={ak.primary} />
        <circle cx="480" cy="258" r="34" fill={ak.accent} opacity="0.2" />
        <path d="M480 226 L506 236 V260 C506 280 493 296 480 302 C467 296 454 280 454 260 V236 Z" fill={ak.primaryForeground} opacity="0.92" />
        <text x="480" y="332" fill={ak.primaryForeground} fontSize="20" fontWeight="800" textAnchor="middle">Verifier Core</text>
      </g>
      <path d="M480 356 V420" fill="none" stroke={ak.accent} strokeWidth="2.4" className="ak-flow-line-short" />
      <g transform="translate(304 420)" className="ak-card">
        <rect width="352" height="92" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="26" y="38" fill={ak.foreground} fontSize="21" fontWeight="800">Resultado mínimo</text>
        {['policy satisfied', 'assurance_level', 'expires_at', 'signed token'].map((label, i) => (
          <g key={label} transform={`translate(${26 + i * 82} 54)`}>
            <rect width="76" height="22" rx="7" fill={i === 3 ? ak.accent : ak.muted} opacity={i === 3 ? '0.16' : '1'} stroke={ak.border} />
            <text x="38" y="15" textAnchor="middle" fill={ak.mutedForeground} fontSize="9.5">{label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
