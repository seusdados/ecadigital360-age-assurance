import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

export default function TokenAnatomyDiagram({ className, ...props }: SVGProps<SVGSVGElement>) {
  const allowed = ['approved', 'policy_id', 'threshold', 'method', 'assurance_level', 'expires_at', 'jti', 'signature'];
  const forbidden = ['birthdate', 'age', 'document', 'cpf', 'name', 'selfie', 'civil_id'];
  return (
    <svg
      viewBox="0 0 1040 540"
      role="img"
      aria-label="Anatomia do AgeKey Token com claims permitidas e claims proibidas"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />
      <rect width="1040" height="540" rx="28" fill={ak.background} />
      <g transform="translate(60 86)" className="ak-card">
        <rect width="282" height="368" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="28" y="46" fill={ak.foreground} fontSize="24" fontWeight="800">Claims permitidas</text>
        {allowed.map((label, i) => (
          <g key={label} transform={`translate(28 ${82 + i * 38})`} className={`ak-reveal-${(i % 5) + 1}`}>
            <rect width="206" height="26" rx="8" fill={i === 7 ? ak.accent : ak.muted} opacity={i === 7 ? '0.16' : '1'} stroke={ak.border} />
            <circle cx="17" cy="13" r="4" fill={i === 7 ? ak.accent : ak.success} />
            <text x="33" y="18" fill={ak.foreground} fontSize="13" fontWeight="650">{label}</text>
          </g>
        ))}
      </g>
      <g transform="translate(400 94)" className="ak-float-slow">
        <rect width="240" height="352" rx="20" fill={ak.primary} />
        <rect x="24" y="32" width="192" height="220" rx="14" fill={ak.primaryForeground} opacity="0.08" stroke={ak.accent} />
        <text x="120" y="74" fill={ak.primaryForeground} fontSize="28" fontWeight="900" textAnchor="middle">AgeKey</text>
        <text x="120" y="106" fill={ak.primaryForeground} opacity="0.75" fontSize="15" textAnchor="middle">Result Token</text>
        <g transform="translate(56 142)">
          <rect width="128" height="34" rx="9" fill={ak.accent} />
          <text x="64" y="23" fill={ak.accentForeground} textAnchor="middle" fontSize="15" fontWeight="800">signed</text>
        </g>
        <path d="M76 232 l24 24 62 -78" fill="none" stroke={ak.accent} strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" className="ak-check-pop" />
        <text x="120" y="314" fill={ak.primaryForeground} opacity="0.8" fontSize="14" textAnchor="middle">policy 18+ é regra,</text>
        <text x="120" y="334" fill={ak.primaryForeground} opacity="0.8" fontSize="14" textAnchor="middle">não idade do usuário</text>
      </g>
      <g transform="translate(700 86)" className="ak-card">
        <rect width="282" height="368" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="28" y="46" fill={ak.foreground} fontSize="24" fontWeight="800">Claims proibidas</text>
        {forbidden.map((label, i) => (
          <g key={label} transform={`translate(28 ${86 + i * 42})`} className={`ak-reveal-${(i % 5) + 1}`}>
            <rect width="206" height="28" rx="8" fill={ak.muted} stroke={ak.border} />
            <path d="M14 14 h18" stroke={ak.warning} strokeWidth="2.2" strokeLinecap="round" />
            <path d="M23 5 v18" stroke={ak.warning} strokeWidth="2.2" strokeLinecap="round" />
            <text x="42" y="19" fill={ak.mutedForeground} fontSize="13">{label}</text>
          </g>
        ))}
      </g>
      <path d="M342 270 H400" stroke={ak.accent} strokeWidth="2" className="ak-flow-line" />
      <path d="M640 270 H700" stroke={ak.warning} strokeWidth="2" className="ak-flow-line-short" opacity="0.55" />
    </svg>
  );
}
