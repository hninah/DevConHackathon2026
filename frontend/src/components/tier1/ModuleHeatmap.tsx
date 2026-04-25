const MODULES = [
  { name: 'Module 2: Legal Authority', score: 42 },
  { name: 'Patrol', score: 68 },
  { name: 'Notebook and Reporting', score: 81 },
  { name: 'Emergency Response', score: 57 },
];

function ModuleHeatmap() {
  return (
    <section className="feature-card">
      <p className="feature-id">F2</p>
      <h3>Module Mastery Map</h3>
      <p className="field-hint">Lower scores become top items in your review to-do list.</p>
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
