export function MotionStyle() {
  return (
    <style>{`
      /* ----- Render quality ---------------------------------------------- */
      .ak-svg-root {
        shape-rendering: geometricPrecision;
        text-rendering: geometricPrecision;
      }
      .ak-svg-root * {
        vector-effect: non-scaling-stroke;
      }
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

      /* ----- Card shadows ------------------------------------------------ */
      .ak-card      { filter: drop-shadow(0 10px 20px rgb(20 22 30 / 0.08)); }
      .ak-soft-card { filter: drop-shadow(0 6px 14px rgb(20 22 30 / 0.05)); }

      /* ----- Connector dash patterns ------------------------------------ */
      .ak-flow-line       { stroke-dasharray: 8 10; }
      .ak-flow-line-short { stroke-dasharray: 4 8; }

      /* Scale/rotate animations must pivot from their own bbox center,
       * otherwise they pivot around the SVG (0,0). */
      .ak-pulse, .ak-pulse-slow, .ak-check-pop, .ak-rotate-slow {
        transform-box: fill-box;
        transform-origin: center;
      }

      @media (prefers-reduced-motion: no-preference) {
        .ak-flow-line       { animation: ak-dash 3.6s linear infinite; }
        .ak-flow-line-short { animation: ak-dash 2.6s linear infinite; }
        .ak-pulse           { animation: ak-pulse 2.2s ease-in-out infinite; }
        .ak-pulse-slow      { animation: ak-pulse 3.4s ease-in-out infinite; }
        .ak-float           { animation: ak-float 3.8s ease-in-out infinite; }
        .ak-float-slow      { animation: ak-float-slow 5.2s ease-in-out infinite; }
        .ak-breathe         { animation: ak-breathe 4.4s ease-in-out infinite; }
        .ak-scan            { animation: ak-scan 3.4s ease-in-out infinite; }
        .ak-reveal-1        { animation: ak-reveal 4.2s ease-in-out infinite; }
        .ak-reveal-2        { animation: ak-reveal 4.2s ease-in-out .35s infinite; }
        .ak-reveal-3        { animation: ak-reveal 4.2s ease-in-out .7s  infinite; }
        .ak-reveal-4        { animation: ak-reveal 4.2s ease-in-out 1.05s infinite; }
        .ak-reveal-5        { animation: ak-reveal 4.2s ease-in-out 1.4s infinite; }
        .ak-rotate-slow     { animation: ak-rotate 12s linear infinite; }
        .ak-check-pop       { animation: ak-check-pop 2.6s ease-in-out infinite; }
      }

      /* Use the independent CSS transform properties (translate/scale/rotate)
       * instead of the shorthand "transform" so each animation composes
       * additively with the SVG transform="..." attribute on its <g>. */

      @keyframes ak-dash { to { stroke-dashoffset: -120; } }

      @keyframes ak-pulse {
        0%, 100% { opacity: .45; scale: 1; }
        50%      { opacity: 1;   scale: 1.22; }
      }

      @keyframes ak-float {
        0%, 100% { translate: 0 0; }
        50%      { translate: 0 -10px; }
      }

      @keyframes ak-float-slow {
        0%, 100% { translate: 0 0; }
        50%      { translate: 0 -14px; }
      }

      @keyframes ak-breathe {
        0%, 100% { opacity: .35; scale: 1; }
        50%      { opacity: .95; scale: 1.06; }
      }

      @keyframes ak-scan {
        0%, 100% { translate: -14px 0; opacity: .15; }
        50%      { translate: 14px 0;  opacity: .9; }
      }

      @keyframes ak-reveal {
        0%, 25%, 100% { opacity: .35; translate: 0 0; }
        45%, 75%      { opacity: 1;   translate: 0 -4px; }
      }

      @keyframes ak-rotate { to { rotate: 360deg; } }

      @keyframes ak-check-pop {
        0%, 100% { scale: 1; }
        30%      { scale: 1.28; }
        55%      { scale: 1; }
      }
    `}</style>
  );
}
