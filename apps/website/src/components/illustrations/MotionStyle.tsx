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
      .ak-card      { filter: drop-shadow(0 8px 16px rgb(20 22 30 / 0.06)); }
      .ak-soft-card { filter: drop-shadow(0 6px 12px rgb(20 22 30 / 0.045)); }

      /* ----- Connector dash patterns ------------------------------------ */
      .ak-flow-line       { stroke-dasharray: 8 10; }
      .ak-flow-line-short { stroke-dasharray: 4 8; }

      /* Scale/rotate animations must pivot around the element's own
       * bounding-box center, otherwise they pivot around the SVG (0,0). */
      .ak-pulse, .ak-pulse-slow, .ak-check-pop, .ak-rotate-slow {
        transform-box: fill-box;
        transform-origin: center;
      }

      @media (prefers-reduced-motion: no-preference) {
        .ak-flow-line       { animation: ak-dash 5.5s linear infinite; }
        .ak-flow-line-short { animation: ak-dash 4s   linear infinite; }
        .ak-pulse           { animation: ak-pulse 2.8s ease-in-out infinite; }
        .ak-pulse-slow      { animation: ak-pulse 4.2s ease-in-out infinite; }
        .ak-float           { animation: ak-float 4.8s ease-in-out infinite; }
        .ak-float-slow      { animation: ak-float 6.6s ease-in-out infinite; }
        .ak-breathe         { animation: ak-breathe 5.4s ease-in-out infinite; }
        .ak-scan            { animation: ak-scan 4.8s ease-in-out infinite; }
        .ak-reveal-1        { animation: ak-reveal 5.4s ease-in-out infinite; }
        .ak-reveal-2        { animation: ak-reveal 5.4s ease-in-out .45s infinite; }
        .ak-reveal-3        { animation: ak-reveal 5.4s ease-in-out .9s  infinite; }
        .ak-reveal-4        { animation: ak-reveal 5.4s ease-in-out 1.35s infinite; }
        .ak-reveal-5        { animation: ak-reveal 5.4s ease-in-out 1.8s  infinite; }
        .ak-rotate-slow     { animation: ak-rotate 16s linear infinite; }
        .ak-check-pop       { animation: ak-check-pop 3.2s ease-in-out infinite; }
      }

      /* Use the independent CSS transform properties (translate/scale/rotate)
       * instead of the shorthand "transform" so each animation composes
       * additively with the SVG transform="..." attribute on its <g>.
       * The shorthand replaces the attribute and snaps animated groups to
       * (0,0) of the SVG viewport, which caused visible overlap. */
      @keyframes ak-dash { to { stroke-dashoffset: -72; } }
      @keyframes ak-pulse {
        0%, 100% { opacity: .55; scale: 1; }
        50%      { opacity: 1;   scale: 1.08; }
      }
      @keyframes ak-float {
        0%, 100% { translate: 0 0; }
        50%      { translate: 0 -7px; }
      }
      @keyframes ak-breathe {
        0%, 100% { opacity: .52; }
        50%      { opacity: .92; }
      }
      @keyframes ak-scan {
        0%, 100% { translate: -8px 0; opacity: .22; }
        50%      { translate: 8px 0;  opacity: .85; }
      }
      @keyframes ak-reveal {
        0%, 28%, 100% { opacity: .55; translate: 0 0; }
        45%, 74%      { opacity: 1;   translate: 0 -2px; }
      }
      @keyframes ak-rotate { to { rotate: 360deg; } }
      @keyframes ak-check-pop {
        0%, 100% { scale: 1; }
        38%      { scale: 1.1; }
        58%      { scale: 1; }
      }
    `}</style>
  );
}
