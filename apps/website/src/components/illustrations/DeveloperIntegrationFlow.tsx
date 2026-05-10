import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const nodes = [
  'Client App',
  'POST /session',
  'Widget ou Redirect',
  'Verificação',
  'Callback/Webhook',
  'verify token',
  'Liberar recurso',
] as const;

export default function DeveloperIntegrationFlow({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 1120 470"
      role="img"
      aria-label="Fluxo de integração técnica com API, widget, callback, webhook e validação de token"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />
      <rect width="1120" height="470" rx="28" fill={ak.background} />
      <path d="M118 236 H996" fill="none" stroke={ak.accent} strokeWidth="2.2" className="ak-flow-line" />
      {nodes.map((label, i) => {
        const x = 42 + i * 154;
        return (
          <g key={label} transform={`translate(${x} 132)`} className={`ak-soft-card ak-reveal-${(i % 5) + 1}`}>
            <rect width="126" height="156" rx="16" fill={ak.card} stroke={ak.border} />
            <circle cx="63" cy="48" r="28" fill={i === 6 ? ak.success : ak.accent} opacity="0.14" />
            {i === 0 && <path d="M45 40 h36 v32 h-36z M51 78 h24" fill="none" stroke={ak.foreground} strokeWidth="2.4" strokeLinecap="round" />}
            {i === 1 && <text x="63" y="54" textAnchor="middle" fill={ak.foreground} fontSize="17" fontWeight="800">API</text>}
            {i === 2 && <path d="M43 38 h40 v48 h-40z M50 50 h26 M50 62 h20" fill="none" stroke={ak.foreground} strokeWidth="2.4" strokeLinecap="round" />}
            {i === 3 && <path d="M63 28 L88 39 V64 C88 83 75 96 63 101 C51 96 38 83 38 64 V39 Z" fill="none" stroke={ak.foreground} strokeWidth="2.8" />}
            {i === 4 && <path d="M38 47 h48 M67 31 l18 16 -18 16 M85 71 h-48 M56 55 l-18 16 18 16" fill="none" stroke={ak.foreground} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />}
            {i === 5 && <g><rect x="38" y="36" width="50" height="42" rx="8" fill="none" stroke={ak.foreground} strokeWidth="2.4"/><path d="M49 58 h27" stroke={ak.accent} strokeWidth="3" strokeLinecap="round" /></g>}
            {i === 6 && <path d="M45 58 l15 15 35 -42" fill="none" stroke={ak.success} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" className="ak-check-pop" />}
            <text x="63" y="122" textAnchor="middle" fill={ak.foreground} fontSize="13.5" fontWeight="750">{label}</text>
          </g>
        );
      })}
      <g transform="translate(426 332)" className="ak-card">
        <rect width="268" height="48" rx="13" fill={ak.primary} />
        <circle cx="34" cy="24" r="10" fill={ak.accent} className="ak-pulse" />
        <text x="58" y="29" fill={ak.primaryForeground} fontSize="15" fontWeight="800">signed token + resultado mínimo</text>
      </g>
    </svg>
  );
}
