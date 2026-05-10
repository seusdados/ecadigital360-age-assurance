import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

export default function WebhookEventsFlow({ className, ...props }: SVGProps<SVGSVGElement>) {
  const events = ['verification.approved', 'verification.denied', 'verification.expired', 'proof.revoked', 'issuer.untrusted'];
  return (
    <svg
      viewBox="0 0 980 520"
      role="img"
      aria-label="Fluxo de webhooks assinados do AgeKey para o backend do cliente"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />
      <rect width="980" height="520" rx="28" fill={ak.background} />
      <g transform="translate(74 160)" className="ak-card">
        <rect width="230" height="180" rx="18" fill={ak.primary} />
        <text x="115" y="66" fill={ak.primaryForeground} fontSize="26" fontWeight="900" textAnchor="middle">AgeKey</text>
        <text x="115" y="94" fill={ak.primaryForeground} opacity="0.72" fontSize="15" textAnchor="middle">Events</text>
        <circle cx="115" cy="128" r="24" fill={ak.accent} opacity="0.22" className="ak-pulse" />
      </g>
      <path d="M304 250 H420" stroke={ak.accent} strokeWidth="2.2" className="ak-flow-line" />
      <g transform="translate(420 82)" className="ak-card">
        <rect width="270" height="344" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="30" y="48" fill={ak.foreground} fontSize="24" fontWeight="800">Eventos</text>
        {events.map((event, i) => (
          <g key={event} transform={`translate(30 ${82 + i * 52})`} className={`ak-reveal-${i + 1}`}>
            <rect width="210" height="34" rx="9" fill={ak.muted} stroke={ak.border} />
            <circle cx="18" cy="17" r="5" fill={i === 0 ? ak.success : ak.accent} />
            <text x="34" y="22" fill={ak.foreground} fontSize="13.5" fontWeight="650">{event}</text>
          </g>
        ))}
        <g transform="translate(30 294)">
          <rect width="170" height="30" rx="9" fill={ak.accent} opacity="0.16" />
          <text x="85" y="20" textAnchor="middle" fill={ak.foreground} fontSize="13" fontWeight="800">signed event</text>
        </g>
      </g>
      <path d="M690 250 H806" stroke={ak.accent} strokeWidth="2.2" className="ak-flow-line" />
      <g transform="translate(806 160)" className="ak-card">
        <rect width="136" height="180" rx="18" fill={ak.card} stroke={ak.border} />
        <circle cx="68" cy="62" r="26" fill={ak.accent} opacity="0.14" />
        <path d="M45 72 h46 M68 38 v46" stroke={ak.foreground} strokeWidth="2.4" strokeLinecap="round" />
        <text x="68" y="124" fill={ak.foreground} fontSize="18" fontWeight="800" textAnchor="middle">Backend</text>
        <text x="68" y="148" fill={ak.mutedForeground} fontSize="13" textAnchor="middle">do cliente</text>
      </g>
    </svg>
  );
}
