import RoleplayScenario from '../components/tier1/RoleplayScenario';

export default function RoleplayPage() {
    return (
        <section className="page-shell">
            <header className="page-intro">
                <p className="eyebrow">Roleplay</p>
                <h1>Scenario Lab</h1>
                <p className="page-copy">
                    Work through realistic officer response scenarios from the security guard manual,
                    check the citation when you need it, and review every answer at the end.
                </p>
            </header>

            <RoleplayScenario />
        </section>
    );
}
