import MockExamRunner from './tier1/MockExamRunner';
import ModuleHeatmap from './tier1/ModuleHeatmap';
import SvgScenario from './tier1/SvgScenario';

function PracticeMode() {
  return (
    <section className="mode-panel">
      <div className="primary-card">
        <p className="eyebrow">Practice mode</p>
        <h2>Exam-format scenarios</h2>
        <p>
          Person B will wire `/diagnostic`, `/scenario`, and `/mock-exam` here.
          The Tier 1 containers are ready for data.
        </p>
      </div>
      <div className="feature-grid">
        <ModuleHeatmap />
        <MockExamRunner />
        <SvgScenario />
      </div>
    </section>
  );
}

export default PracticeMode;
