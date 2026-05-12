export function MotionStyle() {
  return (
    <style>{`
      /* ── Render quality ────────────────────────────────────────────── */
      .ak-svg-root {
        shape-rendering: geometricPrecision;
        text-rendering: geometricPrecision;
      }
      .ak-svg-root * { vector-effect: non-scaling-stroke; }
      .ak-svg-root path,
      .ak-svg-root line,
      .ak-svg-root polyline {
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      .ak-svg-root text {
        font-feature-settings: "cv02", "cv03", "cv11", "ss01";
        letter-spacing: -0.005em;
      }

      /* ── Card depth ────────────────────────────────────────────────── */
      .ak-card      { filter: drop-shadow(0 12px 24px rgb(20 22 30 / 0.09)); }
      .ak-soft-card { filter: drop-shadow(0 6px 14px rgb(20 22 30 / 0.05)); }

      /* ── Connector dash patterns ──────────────────────────────────── */
      .ak-flow-line       { stroke-dasharray: 6 8; }
      .ak-flow-line-short { stroke-dasharray: 3 6; }

      /* Scale/rotate animations must pivot from their own bbox center. */
      .ak-pulse, .ak-pulse-slow, .ak-check-pop, .ak-rotate-slow {
        transform-box: fill-box;
        transform-origin: center;
      }

      /* Easings (crafted, not the default ease/ease-in-out) */
      /* expoOut: smooth deceleration into rest */
      /* quartInOut: refined symmetric */
      /* backOut: gentle overshoot for "pop" feel */

      @media (prefers-reduced-motion: no-preference) {
        .ak-flow-line {
          animation: ak-dash 2.4s linear infinite;
        }
        .ak-flow-line-short {
          animation: ak-dash 1.8s linear infinite;
        }

        /* Pulse: organic in/out instead of mechanical ease-in-out */
        .ak-pulse {
          animation: ak-pulse 2.4s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        .ak-pulse-slow {
          animation: ak-pulse 3.6s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }

        /* Float: longer rest at top + bottom, like a real hover */
        .ak-float {
          animation: ak-float 4.4s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }
        .ak-float-slow {
          animation: ak-float-slow 6s cubic-bezier(0.45, 0, 0.55, 1) infinite;
        }

        /* Breathe: extra-smooth, asymmetric to feel alive */
        .ak-breathe {
          animation: ak-breathe 5.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }

        /* Scan: quartInOut for refined sweep */
        .ak-scan {
          animation: ak-scan 3.2s cubic-bezier(0.76, 0, 0.24, 1) infinite;
        }

        /* Reveal: anticipation + settle */
        .ak-reveal-1 { animation: ak-reveal 4.6s cubic-bezier(0.34, 1.56, 0.64, 1) infinite; }
        .ak-reveal-2 { animation: ak-reveal 4.6s cubic-bezier(0.34, 1.56, 0.64, 1) .35s infinite; }
        .ak-reveal-3 { animation: ak-reveal 4.6s cubic-bezier(0.34, 1.56, 0.64, 1) .7s  infinite; }
        .ak-reveal-4 { animation: ak-reveal 4.6s cubic-bezier(0.34, 1.56, 0.64, 1) 1.05s infinite; }
        .ak-reveal-5 { animation: ak-reveal 4.6s cubic-bezier(0.34, 1.56, 0.64, 1) 1.4s infinite; }

        /* Rotate: linear stays linear, but faster */
        .ak-rotate-slow {
          animation: ak-rotate 14s linear infinite;
        }

        /* Check pop: back-out for satisfying confirmation */
        .ak-check-pop {
          animation: ak-check-pop 2.8s cubic-bezier(0.34, 1.56, 0.64, 1) infinite;
        }
      }

      /* ── Keyframes (composable via independent transform properties) ── */

      @keyframes ak-dash {
        to { stroke-dashoffset: -140; }
      }

      /* Pulse: rest, expand, settle, rest */
      @keyframes ak-pulse {
        0%   { opacity: .4; scale: 1; }
        35%  { opacity: 1;  scale: 1.22; }
        55%  { opacity: .9; scale: 1.06; }
        100% { opacity: .4; scale: 1; }
      }

      /* Float: arc through anticipation -> peak -> settle */
      @keyframes ak-float {
        0%   { translate: 0 0; }
        45%  { translate: 0 -10px; }
        55%  { translate: 0 -10px; }
        100% { translate: 0 0; }
      }
      @keyframes ak-float-slow {
        0%   { translate: 0 0; }
        45%  { translate: 0 -14px; }
        55%  { translate: 0 -14px; }
        100% { translate: 0 0; }
      }

      /* Breathe: opacity + scale, asymmetric (in slow, out faster) */
      @keyframes ak-breathe {
        0%   { opacity: .3;  scale: 1; }
        50%  { opacity: 1;   scale: 1.08; }
        100% { opacity: .3;  scale: 1; }
      }

      /* Scan: sweep with a fade at the edges */
      @keyframes ak-scan {
        0%   { translate: -16px 0; opacity: 0; }
        15%  { opacity: .9; }
        50%  { translate: 16px 0;  opacity: 1; }
        85%  { opacity: .9; }
        100% { translate: -16px 0; opacity: 0; }
      }

      /* Reveal: pre-state, lift + brighten, settle */
      @keyframes ak-reveal {
        0%   { opacity: .3; translate: 0 0; }
        30%  { opacity: 1;  translate: 0 -5px; }
        50%  { opacity: 1;  translate: 0 -3px; }
        80%  { opacity: 1;  translate: 0 -3px; }
        100% { opacity: .3; translate: 0 0; }
      }

      @keyframes ak-rotate {
        to { rotate: 360deg; }
      }

      /* Check pop: anticipate, snap, settle (with subtle overshoot) */
      @keyframes ak-check-pop {
        0%   { scale: 1; }
        15%  { scale: 0.92; }
        45%  { scale: 1.32; }
        70%  { scale: 0.98; }
        100% { scale: 1; }
      }
    `}</style>
  );
}
