function SvgScenario() {
  return (
    <section className="feature-card">
      <p className="feature-id">F11</p>
      <h3>SVG scenario diagrams</h3>
      <svg
        aria-label="Placeholder patrol route diagram"
        className="scenario-svg"
        role="img"
        viewBox="0 0 220 120"
      >
        <rect height="90" rx="10" width="190" x="15" y="15" />
        <path d="M45 90 C70 30, 145 30, 170 90" />
        <circle cx="45" cy="90" r="6" />
        <circle cx="170" cy="90" r="6" />
      </svg>
    </section>
  );
}

export default SvgScenario;
