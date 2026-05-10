import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const layers = [
  ['Cliente', 'App • site • backend'],
  ['Integração', 'API • Widget • SDK • Webhooks'],
  ['AgeKey Core', 'Verifier Core • Policy Engine • Token Service'],
  ['Trust & Evidence', 'Trust Registry • Evidence Layer • Revocation'],
  ['Infraestrutura', 'Supabase • Vercel • GitHub'],
] as const;

export default function PlatformArchitectureDiagram({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 1040 620"
      role="img"
      aria-label="Arquitetura pública do AgeKey com cliente, integração, core, trust evidence e infraestrutura"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />
      <rect width="1040" height="620" rx="28" fill={ak.background} />
      <path d="M520 96 V520" stroke={ak.accent} strokeWidth="2" className="ak-flow-line" />
      {layers.map(([title, subtitle], i) => (
        <g key={title} transform={`translate(140 ${64 + i * 104})`} className={`ak-card ak-reveal-${i + 1}`}>
          <rect width="760" height="78" rx="18" fill={i === 2 ? ak.primary : ak.card} stroke={i === 2 ? ak.primary : ak.border} />
          <circle cx="44" cy="39" r="18" fill={i === 2 ? ak.accent : ak.accent} opacity={i === 2 ? '0.25' : '0.14'} />
          <text x="78" y="35" fill={i === 2 ? ak.primaryForeground : ak.foreground} fontSize="22" fontWeight="850">{title}</text>
          <text x="78" y="58" fill={i === 2 ? ak.primaryForeground : ak.mutedForeground} opacity={i === 2 ? '0.72' : '1'} fontSize="14">{subtitle}</text>
          {i < layers.length - 1 && <circle cx="380" cy="84" r="7" fill={ak.accent} className="ak-pulse" />}
        </g>
      ))}
      <g transform="translate(716 170)">
        <rect width="172" height="40" rx="12" fill={ak.card} stroke={ak.border} />
        <text x="86" y="25" textAnchor="middle" fill={ak.foreground} fontSize="13" fontWeight="700">retorno token/webhook</text>
      </g>
      <path d="M716 190 C650 190 650 416 716 416" fill="none" stroke={ak.accent} strokeWidth="2" className="ak-flow-line-short" />
    </svg>
  );
}
