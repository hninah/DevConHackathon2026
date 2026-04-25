import MockExamRunner from './tier1/MockExamRunner';
import ModuleHeatmap from './tier1/ModuleHeatmap';
import SvgScenario from './tier1/SvgScenario';

function PracticeMode() {
  return (
    <section className="mode-panel">
      <div className="primary-card">
        <p className="eyebrow">Practice mode</p>
        <h2>Exam-format practice in student language</h2>
        <p>
          Multiple-choice practice stays in the student language, includes
          citations, and gives simplified-English explanations for wrong
          answers.
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
