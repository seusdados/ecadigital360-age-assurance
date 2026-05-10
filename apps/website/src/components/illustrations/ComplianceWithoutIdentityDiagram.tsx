import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

export default function ComplianceWithoutIdentityDiagram({ className, ...props }: SVGProps<SVGSVGElement>) {
  const layers = ['Política aplicada', 'Decisão registrada', 'Auditoria minimizada'];
  const blocked = ['nome', 'documento', 'data de nascimento', 'selfie'];
  return (
    <svg
      viewBox="0 0 960 540"
      role="img"
      aria-label="Compliance com política aplicada, decisão registrada e auditoria minimizada sem identidade civil no payload público"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />
      <rect width="960" height="540" rx="28" fill={ak.background} />
      <g transform="translate(80 106)">
        {layers.map((label, i) => (
          <g key={label} transform={`translate(${i * 38} ${i * 92})`} className={`ak-card ak-reveal-${i + 1}`}>
            <rect width="430" height="78" rx="18" fill={i === 2 ? ak.primary : ak.card} stroke={i === 2 ? ak.primary : ak.border} />
            <circle cx="42" cy="39" r="17" fill={ak.accent} opacity={i === 2 ? '0.25' : '0.15'} />
            <text x="72" y="46" fill={i === 2 ? ak.primaryForeground : ak.foreground} fontSize="23" fontWeight="850">{label}</text>
          </g>
        ))}
      </g>
      <path d="M565 270 H622" stroke={ak.accent} strokeWidth="2" className="ak-flow-line" />
      <g transform="translate(622 116)" className="ak-card">
        <rect width="280" height="312" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="30" y="50" fill={ak.foreground} fontSize="25" fontWeight="850">Sem payload civil</text>
        <text x="30" y="78" fill={ak.mutedForeground} fontSize="14">decisão auditável sem identidade</text>
        {blocked.map((label, i) => (
          <g key={label} transform={`translate(30 ${116 + i * 44})`} className={`ak-reveal-${i + 1}`}>
            <rect width="210" height="30" rx="9" fill={ak.muted} stroke={ak.border} />
            <path d="M15 15 h18" stroke={ak.warning} strokeWidth="2" strokeLinecap="round" />
            <text x="44" y="20" fill={ak.mutedForeground} fontSize="13.5">{label}</text>
          </g>
        ))}
        <g transform="translate(30 274)">
          <rect width="162" height="30" rx="15" fill={ak.accent} opacity="0.16" />
          <text x="81" y="20" fill={ak.foreground} textAnchor="middle" fontSize="13" fontWeight="800">privacy by design</text>
        </g>
      </g>
    </svg>
  );
}
