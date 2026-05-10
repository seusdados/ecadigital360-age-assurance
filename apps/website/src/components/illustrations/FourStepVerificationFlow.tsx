import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const steps = [
  ['1', 'Criar sessão', 'policy + contexto'],
  ['2', 'Escolher método', 'gateway, credencial, proof ou fallback'],
  ['3', 'Provar necessário', 'sem identidade civil'],
  ['4', 'Receber resultado', 'token + decisão mínima'],
] as const;

export default function FourStepVerificationFlow({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 1080 520"
      role="img"
      aria-label="Fluxo AgeKey em quatro passos: criar sessão, escolher método, provar necessário e receber resultado mínimo"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />
      <rect width="1080" height="520" rx="28" fill={ak.background} />
      <path d="M150 260 H930" fill="none" stroke={ak.accent} strokeWidth="2.2" className="ak-flow-line" opacity="0.75" />
      {steps.map(([n, title, body], i) => {
        const x = 70 + i * 260;
        return (
          <g key={n} transform={`translate(${x} 96)`} className={`ak-card ak-reveal-${i + 1}`}>
            <rect width="210" height="300" rx="18" fill={ak.card} stroke={ak.border} />
            <circle cx="38" cy="38" r="18" fill={ak.primary} />
            <text x="38" y="45" textAnchor="middle" fill={ak.primaryForeground} fontSize="18" fontWeight="800">{n}</text>
            <text x="28" y="104" fill={ak.foreground} fontSize="23" fontWeight="800">{title}</text>
            <text x="28" y="135" fill={ak.mutedForeground} fontSize="15">{body}</text>
            <g transform="translate(38 190)">
              <circle cx="67" cy="38" r="48" fill={i === 3 ? ak.success : ak.accent} opacity="0.12" className="ak-pulse-slow" />
              {i === 0 && <path d="M36 22 h72 v58 h-72z M50 38 h42 M50 54 h58" fill="none" stroke={ak.foreground} strokeWidth="2.4" strokeLinecap="round" />}
              {i === 1 && <path d="M67 18 l44 24 -44 24 -44 -24z M67 66 v32 M35 82 h64" fill="none" stroke={ak.foreground} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
              {i === 2 && <path d="M67 14 L106 30 V64 C106 94 86 114 67 122 C48 114 28 94 28 64 V30 Z" fill="none" stroke={ak.foreground} strokeWidth="3" />}
              {i === 3 && <path d="M36 64 l22 22 54 -58" fill="none" stroke={ak.success} strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" className="ak-check-pop" />}
            </g>
            {i === 3 && (
              <g transform="translate(26 262)">
                <rect width="72" height="22" rx="7" fill={ak.success} opacity="0.12" />
                <text x="36" y="15" textAnchor="middle" fill={ak.foreground} fontSize="11" fontWeight="700">approved</text>
                <rect x="78" width="72" height="22" rx="7" fill={ak.muted} stroke={ak.border} />
                <text x="114" y="15" textAnchor="middle" fill={ak.mutedForeground} fontSize="11">denied</text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}
