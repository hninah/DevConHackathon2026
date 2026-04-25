import { getAttemptsByModule, getMistakesByModule } from '../../lib/mistakeLog';

const MODULES = ['Use of Force', 'Patrol', 'Notebooks', 'Emergency Response'] as const;

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ModuleHeatmap() {
  const attemptsByModule = getAttemptsByModule();
  const mistakesByModule = getMistakesByModule();

  return (
    <section className="feature-card">
      <p className="feature-id">F2</p>
      <h3>Module Mastery Map</h3>
      <p className="field-hint">Lower scores become top items in your review to-do list.</p>
      <div className="heatmap">
        {MODULES.map((module) => {
          const attempts = attemptsByModule[module] ?? [];
          const mistakes = mistakesByModule[module] ?? [];
          const attempted = attempts.length;
          const wrong = mistakes.length;
          const correct = Math.max(0, attempted - wrong);
          const accuracy = attempted <= 0 ? 0 : (correct / attempted) * 100;
          const score = clampPercent(accuracy);

          let tone: 'good' | 'warn' | 'bad' | 'none' = 'none';
          if (attempted > 0) {
            if (score >= 80) {
              tone = 'good';
            } else if (score >= 60) {
              tone = 'warn';
            } else {
              tone = 'bad';
            }
          }

          return (
            <div className="heatmap-row" key={module}>
              <div className="heatmap-row-head">
                <span>{module}</span>
                <small>
                  {attempted ? `${score}%` : '—'}{' '}
                  {attempted ? `(${correct}/${attempted})` : ''}
                </small>
              </div>
              <meter
                className={`heatmeter ${tone}`}
                max="100"
                min="0"
                value={attempted ? score : 0}
              >
                {score}%
              </meter>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default ModuleHeatmap;
