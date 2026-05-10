import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

export default function ForbiddenClaimsDiagram({ className, ...props }: SVGProps<SVGSVGElement>) {
  const allowed = ['approved', 'policy', 'method', 'assurance_level', 'expires_at', 'token'];
  const blocked = ['birthdate', 'age', 'document', 'cpf', 'name', 'selfie', 'biometric', 'civil_id'];
  return (
    <svg
      viewBox="0 0 1040 540"
      role="img"
      aria-label="Claims permitidas e proibidas no payload público do AgeKey"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />
      <rect width="1040" height="540" rx="28" fill={ak.background} />
      <g transform="translate(64 96)" className="ak-card">
        <rect width="326" height="348" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="32" y="48" fill={ak.foreground} fontSize="24" fontWeight="800">Payload público permitido</text>
        {allowed.map((label, i) => (
          <g key={label} transform={`translate(32 ${86 + i * 46})`} className={`ak-reveal-${(i % 5) + 1}`}>
            <rect width="220" height="30" rx="9" fill={label === 'token' ? ak.accent : ak.muted} opacity={label === 'token' ? '0.16' : '1'} stroke={ak.border} />
            <circle cx="18" cy="15" r="5" fill={label === 'token' ? ak.accent : ak.success} />
            <text x="36" y="20" fill={ak.foreground} fontSize="14" fontWeight="700">{label}</text>
          </g>
        ))}
      </g>
      <g transform="translate(444 172)" className="ak-float-slow">
        <rect width="152" height="196" rx="20" fill={ak.primary} />
        <circle cx="76" cy="62" r="38" fill={ak.accent} opacity="0.22" />
        <path d="M76 29 L106 42 V70 C106 92 90 108 76 115 C62 108 46 92 46 70 V42 Z" fill={ak.primaryForeground} />
        <text x="76" y="150" fill={ak.primaryForeground} fontSize="19" fontWeight="900" textAnchor="middle">Privacy</text>
        <text x="76" y="174" fill={ak.primaryForeground} fontSize="19" fontWeight="900" textAnchor="middle">Guard</text>
      </g>
      <path d="M390 270 H444" stroke={ak.accent} strokeWidth="2" className="ak-flow-line" />
      <path d="M596 270 H650" stroke={ak.warning} strokeWidth="2" className="ak-flow-line-short" opacity="0.6" />
      <g transform="translate(650 74)" className="ak-card">
        <rect width="326" height="392" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="32" y="48" fill={ak.foreground} fontSize="24" fontWeight="800">Bloqueado</text>
        {blocked.map((label, i) => (
          <g key={label} transform={`translate(32 ${86 + i * 40})`} className={`ak-reveal-${(i % 5) + 1}`}>
            <rect width="220" height="28" rx="9" fill={ak.muted} stroke={ak.border} />
            <path d="M14 14 h18" stroke={ak.warning} strokeWidth="2.2" strokeLinecap="round" />
            <path d="M23 5 v18" stroke={ak.warning} strokeWidth="2.2" strokeLinecap="round" />
            <text x="42" y="19" fill={ak.mutedForeground} fontSize="13.5">{label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
