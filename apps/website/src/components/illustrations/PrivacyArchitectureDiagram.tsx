import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

export default function PrivacyArchitectureDiagram({ className, ...props }: SVGProps<SVGSVGElement>) {
  const inputs = ['prova', 'atestado', 'credencial', 'challenge'];
  const blocked = ['nome', 'documento', 'selfie', 'data de nascimento', 'idade exata'];
  const allowed = ['approved', 'policy', 'method', 'assurance_level', 'expires_at', 'token'];
  return (
    <svg
      viewBox="0 0 980 560"
      role="img"
      aria-label="Privacy Guard bloqueia dados civis e permite apenas campos mínimos no payload público"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />
      <rect width="980" height="560" rx="28" fill={ak.background} />
      <g transform="translate(64 116)" className="ak-card">
        <rect width="246" height="312" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="30" y="48" fill={ak.foreground} fontSize="24" fontWeight="800">Entradas</text>
        <text x="30" y="76" fill={ak.mutedForeground} fontSize="15">artefatos abstratos</text>
        {inputs.map((label, i) => (
          <g key={label} transform={`translate(30 ${120 + i * 48})`} className={`ak-reveal-${i + 1}`}>
            <rect width="182" height="32" rx="9" fill={ak.muted} stroke={ak.border} />
            <circle cx="20" cy="16" r="5" fill={ak.accent} />
            <text x="38" y="21" fill={ak.foreground} fontSize="15" fontWeight="650">{label}</text>
          </g>
        ))}
      </g>
      <path d="M310 276 H406" fill="none" stroke={ak.accent} strokeWidth="2" className="ak-flow-line" />
      <g transform="translate(406 136)" className="ak-float-slow">
        <rect width="202" height="284" rx="22" fill={ak.primary} />
        <circle cx="101" cy="86" r="48" fill={ak.accent} opacity="0.2" />
        <path d="M101 42 L139 58 V94 C139 124 121 145 101 154 C81 145 63 124 63 94 V58 Z" fill={ak.primaryForeground} />
        <path d="M84 96 l14 14 30 -42" fill="none" stroke={ak.accent} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
        <text x="101" y="198" fill={ak.primaryForeground} fontSize="23" fontWeight="800" textAnchor="middle">Privacy Guard</text>
        <text x="101" y="226" fill={ak.primaryForeground} opacity="0.72" fontSize="14" textAnchor="middle">filtra claims públicas</text>
      </g>
      <path d="M608 276 H704" fill="none" stroke={ak.accent} strokeWidth="2" className="ak-flow-line" />
      <g transform="translate(704 86)" className="ak-card">
        <rect width="246" height="394" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="28" y="48" fill={ak.foreground} fontSize="24" fontWeight="800">Payload público</text>
        <text x="28" y="76" fill={ak.mutedForeground} fontSize="15">apenas dados minimizados</text>
        {allowed.map((label, i) => (
          <g key={label} transform={`translate(28 ${116 + i * 42})`} className={`ak-reveal-${(i % 5) + 1}`}>
            <rect width="190" height="28" rx="8" fill={i === 5 ? ak.accent : ak.muted} opacity={i === 5 ? '0.15' : '1'} stroke={ak.border} />
            <circle cx="18" cy="14" r="4" fill={i === 5 ? ak.accent : ak.success} />
            <text x="34" y="19" fill={ak.foreground} fontSize="13" fontWeight="650">{label}</text>
          </g>
        ))}
      </g>
      <g transform="translate(286 458)">
        <rect width="394" height="42" rx="12" fill={ak.card} stroke={ak.border} />
        {blocked.map((label, i) => (
          <g key={label} transform={`translate(${16 + i * 76} 10)`}>
            <rect width="68" height="22" rx="7" fill={ak.muted} stroke={ak.border} />
            <text x="34" y="15" textAnchor="middle" fill={ak.mutedForeground} fontSize="9.5">{label}</text>
          </g>
        ))}
        <path d="M18 21 H374" stroke={ak.warning} strokeWidth="2" strokeLinecap="round" opacity="0.55" className="ak-scan" />
      </g>
    </svg>
  );
}
