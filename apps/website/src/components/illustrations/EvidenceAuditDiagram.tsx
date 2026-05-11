import type { SVGProps } from 'react';
import { MotionStyle } from './MotionStyle';
import { ak, svgText } from './theme';

const stored = [
  'inquilino',
  'identificador da regra',
  'data e hora',
  'método',
  'resultado',
  'resumo do artefato',
  'expiração',
];

const blocked = ['documento bruto', 'foto', 'nome civil', 'data de nascimento'];

export default function EvidenceAuditDiagram({
  className,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 1040 480"
      role="img"
      aria-label="Evidence Layer registra apenas dados minimizados para auditoria, sem armazenar identidade civil ou documento bruto"
      className={`ak-svg-root h-auto w-full ${className ?? ''}`}
      style={svgText}
      {...props}
    >
      <MotionStyle />

      <defs>
        <marker
          id="ak-ev-arrow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerUnits="userSpaceOnUse"
          markerWidth="8"
          markerHeight="8"
          orient="auto"
        >
          <path d="M0 0 L9 5 L0 10 Z" fill={ak.foreground} />
        </marker>
      </defs>

      {/* ── LEFT: verificação concluída ─────────────────────── */}
      <g className="ak-card">
        <rect x="32" y="64" width="248" height="120" rx="14" fill={ak.card} stroke={ak.border} />
        <g transform="translate(56 88)">
          <circle cx="22" cy="22" r="20" fill={ak.success} opacity="0.16" />
          <path
            d="M12 24 l8 8 16 -22"
            fill="none"
            stroke={ak.success}
            strokeWidth="4"
          />
        </g>
        <text x="120" y="106" fill={ak.foreground} fontSize="15" fontWeight="800">
          Verificação
        </text>
        <text x="120" y="126" fill={ak.mutedForeground} fontSize="12">
          concluída
        </text>
        <text x="56" y="160" fill={ak.mutedForeground} fontSize="11">
          decisão emitida há instantes
        </text>
      </g>

      {/* connector to evidence */}
      <path
        d="M280 124 C336 124 336 224 376 240"
        fill="none"
        stroke={ak.foreground}
        strokeOpacity="0.25"
        strokeWidth="1.5"
      />
      <path
        d="M280 124 C336 124 336 224 376 240"
        fill="none"
        stroke={ak.accent}
        strokeWidth="1.5"
        strokeDasharray="2 5"
        className="ak-flow-line"
        markerEnd="url(#ak-ev-arrow)"
      />

      {/* ── CENTER: Evidence Layer ──────────────────────────── */}
      <g transform="translate(376 152)" className="ak-card">
        <rect width="288" height="240" rx="20" fill={ak.foreground} />
        <text
          x="144"
          y="44"
          textAnchor="middle"
          fill={ak.background}
          fontSize="16"
          fontWeight="800"
        >
          Evidence Layer
        </text>
        <text
          x="144"
          y="64"
          textAnchor="middle"
          fill={ak.background}
          opacity="0.7"
          fontSize="11"
        >
          auditoria sem identidade civil
        </text>
        <g transform="translate(20 88)">
          {stored.map((label, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            return (
              <g key={label} transform={`translate(${col * 130} ${row * 36})`}>
                <rect
                  width="120"
                  height="26"
                  rx="7"
                  fill={ak.background}
                  opacity="0.1"
                  stroke={ak.accent}
                  strokeOpacity="0.3"
                />
                <text
                  x="60"
                  y="17"
                  textAnchor="middle"
                  fill={ak.background}
                  fontSize="10"
                  fontWeight="600"
                >
                  {label}
                </text>
              </g>
            );
          })}
        </g>
      </g>

      {/* connector from evidence to report */}
      <path
        d="M664 272 C720 272 720 372 760 384"
        fill="none"
        stroke={ak.foreground}
        strokeOpacity="0.25"
        strokeWidth="1.5"
      />
      <path
        d="M664 272 C720 272 720 372 760 384"
        fill="none"
        stroke={ak.accent}
        strokeWidth="1.5"
        strokeDasharray="2 5"
        className="ak-flow-line"
        markerEnd="url(#ak-ev-arrow)"
      />

      {/* ── BOTTOM RIGHT: relatório auditável ───────────────── */}
      <g transform="translate(760 348)" className="ak-card">
        <rect width="240" height="84" rx="14" fill={ak.card} stroke={ak.border} />
        <text x="24" y="36" fill={ak.foreground} fontSize="14" fontWeight="800">
          Relatório
        </text>
        <text x="24" y="58" fill={ak.mutedForeground} fontSize="12">
          auditável · sem PII
        </text>
        <circle cx="208" cy="42" r="14" fill={ak.accent} opacity="0.18" className="ak-pulse" />
        <path
          d="M203 42 l4 4 10 -10"
          fill="none"
          stroke={ak.accent}
          strokeWidth="2.6"
        />
      </g>

      {/* ── BOTTOM LEFT: não armazenado ─────────────────────── */}
      <g transform="translate(32 308)" className="ak-card">
        <rect width="288" height="124" rx="14" fill={ak.card} stroke={ak.border} />
        <text x="24" y="36" fill={ak.foreground} fontSize="13" fontWeight="800">
          Não armazenado no core
        </text>
        <g transform="translate(24 52)">
          {blocked.map((label, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            return (
              <g key={label} transform={`translate(${col * 124} ${row * 28})`}>
                <rect
                  width="116"
                  height="22"
                  rx="6"
                  fill={ak.muted}
                  stroke={ak.border}
                />
                <path d="M10 11 h12" stroke={ak.warning} strokeWidth="2" strokeLinecap="round" />
                <text x="28" y="15" fill={ak.mutedForeground} fontSize="10">
                  {label}
                </text>
              </g>
            );
          })}
        </g>
      </g>
    </svg>
  );
}
