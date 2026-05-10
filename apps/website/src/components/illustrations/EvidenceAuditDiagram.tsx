import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

export default function EvidenceAuditDiagram({ className, ...props }: SVGProps<SVGSVGElement>) {
  const allowed = ['tenant_id', 'policy_id', 'timestamp', 'method', 'result', 'artifact_hash', 'expires_at'];
  const blocked = ['documento bruto', 'selfie', 'nome civil', 'data de nascimento'];
  return (
    <svg
      viewBox="0 0 1040 560"
      role="img"
      aria-label="Evidence Layer registra evidências minimizadas para auditoria sem armazenar documento bruto ou identidade civil"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />
      <rect width="1040" height="560" rx="28" fill={ak.background} />
      <g transform="translate(86 88)" className="ak-card">
        <rect width="260" height="108" rx="18" fill={ak.card} stroke={ak.border} />
        <circle cx="48" cy="54" r="20" fill={ak.success} opacity="0.14" />
        <path d="M38 54 l10 10 22 -28" fill="none" stroke={ak.success} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <text x="84" y="50" fill={ak.foreground} fontSize="22" fontWeight="800">Verificação</text>
        <text x="84" y="76" fill={ak.mutedForeground} fontSize="14">concluída</text>
      </g>
      <path d="M346 142 C430 142 444 236 480 256" stroke={ak.accent} strokeWidth="2" fill="none" className="ak-flow-line" />
      <g transform="translate(384 202)" className="ak-card">
        <rect width="312" height="250" rx="20" fill={ak.primary} />
        <text x="156" y="48" fill={ak.primaryForeground} fontSize="25" fontWeight="900" textAnchor="middle">Evidence Layer</text>
        <text x="156" y="74" fill={ak.primaryForeground} opacity="0.72" fontSize="14" textAnchor="middle">auditoria sem identidade civil</text>
        {allowed.map((label, i) => (
          <g key={label} transform={`translate(${34 + (i % 2) * 148} ${104 + Math.floor(i / 2) * 38})`} className={`ak-reveal-${(i % 5) + 1}`}>
            <rect width="128" height="26" rx="8" fill={ak.primaryForeground} opacity="0.1" stroke={ak.accent} />
            <text x="64" y="18" textAnchor="middle" fill={ak.primaryForeground} fontSize="11.5">{label}</text>
          </g>
        ))}
      </g>
      <path d="M696 326 C760 326 778 382 828 396" stroke={ak.accent} strokeWidth="2" fill="none" className="ak-flow-line" />
      <g transform="translate(780 360)" className="ak-card">
        <rect width="210" height="108" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="28" y="46" fill={ak.foreground} fontSize="22" fontWeight="800">Relatório</text>
        <text x="28" y="72" fill={ak.mutedForeground} fontSize="14">auditável</text>
        <circle cx="170" cy="54" r="18" fill={ak.accent} opacity="0.16" className="ak-pulse" />
      </g>
      <g transform="translate(70 314)" className="ak-card">
        <rect width="276" height="154" rx="18" fill={ak.card} stroke={ak.border} />
        <text x="26" y="42" fill={ak.foreground} fontSize="20" fontWeight="800">Não armazenado no core</text>
        {blocked.map((label, i) => (
          <g key={label} transform={`translate(26 ${64 + i * 30})`}>
            <rect width="206" height="22" rx="7" fill={ak.muted} stroke={ak.border} />
            <path d="M14 11 h18" stroke={ak.warning} strokeWidth="2" strokeLinecap="round" />
            <text x="42" y="15" fill={ak.mutedForeground} fontSize="12">{label}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}
