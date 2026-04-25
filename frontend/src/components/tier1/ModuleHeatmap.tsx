const MODULES = [
  { name: 'Use of Force', score: 42 },
  { name: 'Patrol', score: 68 },
  { name: 'Notebooks', score: 81 },
  { name: 'Emergency Response', score: 57 },
];

function ModuleHeatmap() {
  return (
    <section className="feature-card">
      <p className="feature-id">F2</p>
      <h3>Module Mastery Map</h3>
      <div className="heatmap">
        {MODULES.map((module) => (
          <div className="heatmap-row" key={module.name}>
            <span>{module.name}</span>
            <meter max="100" min="0" value={module.score}>
              {module.score}%
            </meter>
          </div>
        ))}
      </div>
    </section>
  );
}

export default ModuleHeatmap;
