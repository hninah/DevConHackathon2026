import { useEffect, useMemo, useState } from 'react';

import Badge from '../ui/badge';
import Button from '../ui/button';
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from '../ui/card';
import Progress from '../ui/progress';
import {
    FALLBACK_ROLEPLAY_SCENARIOS,
    MODULE_REVIEW_TODO,
    loadRoleplayScenarios,
    type RoleMode,
    type ScenarioChoice,
    type ScenarioScript,
} from '../../lib/roleplayScenario';

type SelectedAnswerMap = Record<string, string>;
const ALL_SCENARIOS_OPTION = 'all';

function flattenParts(mode: RoleMode, scenarios: ScenarioScript[], selectedScenarioId: string) {
    const modeScenarios = scenarios.filter((item) => item.roleMode === mode);
    const roleScenarios = modeScenarios.length > 0 ? modeScenarios : scenarios;

    const filteredScenarios =
        selectedScenarioId === ALL_SCENARIOS_OPTION
            ? roleScenarios
            : scenarios.filter((item) => item.id === selectedScenarioId);
    const selectedScenarios = filteredScenarios.length > 0 ? filteredScenarios : roleScenarios;

    const parts = selectedScenarios.flatMap((scenario) =>
        scenario.questions.flatMap((question) =>
            question.parts.map((part) => ({
                scenario,
                questionTitle: question.title,
                part,
            })),
        ),
    );

    const currentScenario = selectedScenarios[0] ?? scenarios[0];
    return { scenario: currentScenario, parts, selectableScenarios: scenarios };
}

function RoleplayScenario() {
    const [scenarioScripts, setScenarioScripts] = useState<ScenarioScript[]>(FALLBACK_ROLEPLAY_SCENARIOS);
    const [mode, setMode] = useState<RoleMode>('passive');
    const [selectedScenarioId, setSelectedScenarioId] = useState<string>(ALL_SCENARIOS_OPTION);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selected, setSelected] = useState<SelectedAnswerMap>({});
    const [imageSeed, setImageSeed] = useState(1);

    useEffect(() => {
        loadRoleplayScenarios().then(setScenarioScripts);
    }, []);

    const { scenario, parts, selectableScenarios } = useMemo(
        () => flattenParts(mode, scenarioScripts, selectedScenarioId),
        [mode, scenarioScripts, selectedScenarioId],
    );
    const current = parts[currentIndex];
    const totalParts = parts.length;
    const progress = totalParts > 0 ? Math.round((currentIndex / totalParts) * 100) : 0;

    const completed = totalParts > 0 && currentIndex >= totalParts;

    function resetForMode(nextMode: RoleMode) {
        setMode(nextMode);
        setSelectedScenarioId(ALL_SCENARIOS_OPTION);
        setCurrentIndex(0);
        setSelected({});
        setImageSeed(1);
    }

    function resetForScenario(nextScenarioId: string) {
        if (nextScenarioId !== ALL_SCENARIOS_OPTION) {
            const nextScenario = scenarioScripts.find((item) => item.id === nextScenarioId);
            if (nextScenario) {
                setMode(nextScenario.roleMode);
            }
        }
        setSelectedScenarioId(nextScenarioId);
        setCurrentIndex(0);
        setSelected({});
        setImageSeed(1);
    }

    function selectedChoiceForPart(partId: string, choices: ScenarioChoice[]) {
        const chosen = selected[partId];
        return choices.find((choice) => choice.id === chosen);
    }

    function chooseAnswer(partId: string, choiceId: string) {
        setSelected((prev) => ({
            ...prev,
            [partId]: choiceId,
        }));
    }

    function next() {
        if (currentIndex < totalParts) {
            setCurrentIndex((prev) => prev + 1);
        }
    }

    function restart() {
        setCurrentIndex(0);
        setSelected({});
    }

    function roleLabel(roleMode: RoleMode): string {
        return roleMode === 'active' ? 'Officer perspective' : 'Suspect perspective';
    }

    const summary = useMemo(() => {
        const wrongByModule: Record<string, number> = {};

        parts.forEach(({ part }) => {
            const choice = selectedChoiceForPart(part.id, part.choices);
            if (!choice || choice.isCorrect) {
                return;
            }
            wrongByModule[choice.module] = (wrongByModule[choice.module] ?? 0) + 1;
        });

        const focusModules = Object.entries(wrongByModule)
            .sort((first, second) => second[1] - first[1])
            .map(([module]) => module);

        const totalWrong = Object.values(wrongByModule).reduce((sum, count) => sum + count, 0);

        return { focusModules, totalWrong };
    }, [parts, selected]);

    if (completed) {
        return (
            <Card className="roleplay-shell">
                <CardHeader>
                    <Badge variant="success">Scenario complete</Badge>
                    <CardTitle>Module focus summary</CardTitle>
                </CardHeader>
                <CardContent className="summary-grid">
                    <div className="summary-panel">
                        <h4>Recommended module focus</h4>
                        {summary.focusModules.length === 0 && (
                            <p>Strong run. No weak module detected in this scenario.</p>
                        )}
                        {summary.focusModules.length > 0 && (
                            <ol>
                                {summary.focusModules.map((moduleName) => (
                                    <li key={moduleName}>{moduleName}</li>
                                ))}
                            </ol>
                        )}
                        <p className="muted-text">Wrong selections: {summary.totalWrong}</p>
                    </div>

                    <div className="summary-panel">
                        <h4>To-do list, review in this order</h4>
                        <ul>
                            {(summary.focusModules[0]
                                ? MODULE_REVIEW_TODO[summary.focusModules[0]]
                                : ['Review one full mock exam and explain each answer in simple English.']
                            ).map((task) => (
                                <li key={task}>{task}</li>
                            ))}
                        </ul>
                    </div>
                </CardContent>
                <CardFooter className="actions-row">
                    <Button onClick={restart}>Retry same role</Button>
                    <Button variant="outline" onClick={() => resetForMode(mode === 'passive' ? 'active' : 'passive')}>
                        Switch role and retry
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    const selectedChoice = current
        ? selectedChoiceForPart(current.part.id, current.part.choices)
        : undefined;
    const canProceed = Boolean(selectedChoice);
    const displayScenario = current?.scenario ?? scenario;
    const currentScenarioName =
        selectedScenarioId === ALL_SCENARIOS_OPTION
            ? `${roleLabel(mode)} scenarios`
            : displayScenario.name;

    return (
        <Card className="roleplay-shell">
            <CardHeader>
                <div className="roleplay-topline">
                    <Badge variant="warning">Single player</Badge>
                    <div className="role-choice-compact" aria-label="Role selection">
                        <Button
                            size="sm"
                            variant={mode === 'active' ? 'default' : 'outline'}
                            onClick={() => resetForMode('active')}
                        >
                            Officer
                        </Button>
                        <Button
                            size="sm"
                            variant={mode === 'passive' ? 'default' : 'outline'}
                            onClick={() => resetForMode('passive')}
                        >
                            Suspect
                        </Button>
                    </div>
                </div>

                <CardTitle>{currentScenarioName}</CardTitle>
                <label htmlFor="scenario-select" className="muted-text">
                    Scenario
                </label>
                <select
                    id="scenario-select"
                    value={selectedScenarioId}
                    onChange={(event) => resetForScenario(event.target.value)}
                >
                    <option value={ALL_SCENARIOS_OPTION}>All scenarios</option>
                    {selectableScenarios.map((scenarioOption) => (
                        <option key={scenarioOption.id} value={scenarioOption.id}>
                            {scenarioOption.name}
                        </option>
                    ))}
                </select>
                <Progress label="Scenario progress" value={progress} />
            </CardHeader>

            <CardContent className="roleplay-grid">
                <div className="scene-column">
                    <div className="image-frame" aria-label="AI generated scenario image">
                        <div className="image-overlay">
                            <strong>AI image prompt</strong>
                            <p>{displayScenario.imagePrompt}</p>
                            <p>Variation seed: {imageSeed}</p>
                            <Button size="sm" variant="outline" onClick={() => setImageSeed((prev) => prev + 1)}>
                                Regenerate image
                            </Button>
                        </div>
                    </div>

                    <div className="chat-panel" aria-label="AI police chat log">
                        <h4>AI police chat</h4>
                        <p className="muted-text">Visual aid is generated from prompt, then tested with step-by-step choices.</p>
                        <ul>
                            {displayScenario.aiPoliceChat.map((line) => (
                                <li key={line}>{line}</li>
                            ))}
                        </ul>
                    </div>
                </div>

                {current && (
                    <div className="question-column">
                        <Badge variant="muted">{current.questionTitle}</Badge>
                        <h4>{current.part.prompt}</h4>
                        <p className="muted-text">
                            Step {currentIndex + 1} of {totalParts}
                        </p>

                        <div className="choices-grid" role="radiogroup" aria-label="Answer choices">
                            {current.part.choices.map((choice) => {
                                const isSelected = selected[current.part.id] === choice.id;
                                const stateClass = isSelected
                                    ? choice.isCorrect
                                        ? 'choice-btn choice-btn--correct'
                                        : 'choice-btn choice-btn--wrong'
                                    : 'choice-btn';

                                return (
                                    <button
                                        key={choice.id}
                                        className={stateClass}
                                        onClick={() => chooseAnswer(current.part.id, choice.id)}
                                        type="button"
                                    >
                                        <span className="choice-id">{choice.id.toUpperCase()}</span>
                                        <span>{choice.text}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {selectedChoice && !selectedChoice.isCorrect && (
                            <div className="feedback feedback--wrong" role="status" aria-live="polite">
                                <strong>Simplified English explanation</strong>
                                <p>{selectedChoice.simplifiedExplanation}</p>
                                <p className="citation-note">Review: {selectedChoice.module}</p>
                                <p className="citation-note">
                                    Manual check, page {current.part.manual_reference.page_number}: {current.part.manual_reference.excerpt}
                                </p>
                            </div>
                        )}

                        {selectedChoice && selectedChoice.isCorrect && (
                            <div className="feedback feedback--correct" role="status" aria-live="polite">
                                <strong>Correct</strong>
                                <p>{selectedChoice.simplifiedExplanation}</p>
                                <p className="citation-note">Review: {selectedChoice.module}</p>
                                <p className="citation-note">
                                    Manual check, page {current.part.manual_reference.page_number}: {current.part.manual_reference.excerpt}
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>

            <CardFooter className="actions-row">
                <Button variant="outline" onClick={restart}>Restart scenario</Button>
                <Button onClick={next} disabled={!canProceed}>
                    {currentIndex + 1 >= totalParts ? 'Finish and see summary' : 'Next part'}
                </Button>
            </CardFooter>
        </Card>
    );
}

export default RoleplayScenario;
