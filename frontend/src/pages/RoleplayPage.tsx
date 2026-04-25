import RoleplayScenario from '../components/tier1/RoleplayScenario';

export default function RoleplayPage() {
  return (
    <div className="page-stack">
      <section className="page-intro">
        <h1>Roleplay Scenario Lab</h1>
        <p>
          Learners practice passive and active scenarios using visual prompts and multi-part
          multiple-choice decisions.
        </p>
      </section>

      <RoleplayScenario />
    </div>
  );
}
