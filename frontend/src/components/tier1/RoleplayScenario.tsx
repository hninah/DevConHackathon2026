import { useEffect, useMemo, useState } from 'react';

import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
    Card,
    CardContent,
    CardFooter,
    CardHeader,
    CardTitle,
} from '../ui/card';
import Progress from '../ui/progress';
import { submitRoleplayAnswer } from '../../api/tutorClient';
import {
    FALLBACK_ROLEPLAY_SCENARIOS,
    MODULE_REVIEW_TODO,
    loadRoleplayScenarios,
    type ScenarioChoice,
    type ScenarioScript,
} from '../../lib/roleplayScenario';

type SelectedAnswerMap = Record<string, string>;
const NO_SCENARIO = 'no-scenario';

function excerptToBullets(text: string): string[] {
    return text
        .replace(/[●▪]/g, '|')
        .replace(/\s+[oO]\s+/g, '|')
        .replace(/\s*:\s*/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .split(/\||;|(?<=[.!?])\s+/)
        .map((s) => s.replace(/^[-–•:\s]+/, '').trim())
        .filter((s) => s.length > 12)
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .slice(0, 4);
}

function flattenParts(scenarios: ScenarioScript[], selectedScenarioId: string) {
    const filteredScenarios = scenarios.filter((item) => item.id === selectedScenarioId);
    const selectedScenarios = filteredScenarios.length > 0
        ? filteredScenarios
        : scenarios.length > 0
            ? [scenarios[0]]
            : [];

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
    const [selectedScenarioId, setSelectedScenarioId] = useState<string>(NO_SCENARIO);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selected, setSelected] = useState<SelectedAnswerMap>({});
    const [imageSeed, setImageSeed] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        loadRoleplayScenarios().then((scenarios) => {
            const officerOnly = scenarios.filter((item) => item.roleMode === 'active');
            setScenarioScripts(officerOnly.length > 0 ? officerOnly : scenarios);
        });
    }, []);

    useEffect(() => {
        const selectedExists = scenarioScripts.some((item) => item.id === selectedScenarioId);
        if (selectedScenarioId !== NO_SCENARIO && selectedExists) {
            return;
        }

        const initial = scenarioScripts[0];
        if (initial) {
            setSelectedScenarioId(initial.id);
        }
    }, [scenarioScripts, selectedScenarioId]);

    const { scenario, parts, selectableScenarios } = useMemo(
        () => flattenParts(scenarioScripts, selectedScenarioId),
        [scenarioScripts, selectedScenarioId],
    );

    const current = parts[currentIndex];
    const totalParts = parts.length;
    const progress = totalParts > 0 ? Math.round((currentIndex / totalParts) * 100) : 0;
    const completed = totalParts > 0 && currentIndex >= totalParts;

    function resetForScenario(nextScenarioId: string) {
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
        if (isSubmitting || !current || selected[partId]) {
            return;
        }

        setSelected((prev) => ({
            ...prev,
            [partId]: choiceId,
        }));
    }

    async function continueToNext() {
        if (!current || isSubmitting) {
            return;
        }

        const partId = current.part.id;
        const choiceId = selected[partId];
        if (!choiceId) {
            return;
        }

        const fallbackAdvance = () => {
            if (currentIndex < totalParts) {
                setCurrentIndex((prev) => prev + 1);
            }
        };

        const jumpToPart = (nextPartId: string | null, completedByBackend: boolean) => {
            if (completedByBackend) {
                setCurrentIndex(totalParts);
                return;
            }

            if (!nextPartId) {
                fallbackAdvance();
                return;
            }

            const nextIndex = parts.findIndex((item) => item.part.id === nextPartId);
            if (nextIndex < 0) {
                fallbackAdvance();
                return;
            }
            setCurrentIndex(nextIndex);
        };

        setIsSubmitting(true);
        try {
            const result = await submitRoleplayAnswer({
                mode: 'active',
                selected_scenario_id: selectedScenarioId,
                current_part_id: partId,
                choice_id: choiceId,
            });

            window.setTimeout(() => {
                jumpToPart(result.next_part_id, result.completed);
                setIsSubmitting(false);
            }, 250);
        } catch {
            window.setTimeout(() => {
                fallbackAdvance();
                setIsSubmitting(false);
            }, 250);
        }
    }

    function restart() {
        setCurrentIndex(0);
        setSelected({});
        setIsSubmitting(false);
    }

    function gotoNextScenario() {
        if (scenarioScripts.length === 0) {
            restart();
            return;
        }

        const completedScenarioId = parts[totalParts - 1]?.scenario.id ?? selectedScenarioId;
        const currentScenarioIndex = scenarioScripts.findIndex((item) => item.id === completedScenarioId);
        const nextScenario = scenarioScripts[(currentScenarioIndex + 1 + scenarioScripts.length) % scenarioScripts.length];
        resetForScenario(nextScenario.id);
    }

    const summary = useMemo(() => {
        const wrongByModule: Record<string, number> = {};
        const answeredParts = parts
            .map(({ questionTitle, part }, index) => {
                const selectedChoice = selectedChoiceForPart(part.id, part.choices);
                const correctChoice = part.choices.find((choice) => choice.isCorrect);

                if (!selectedChoice || !correctChoice) {
                    return null;
                }

                if (!selectedChoice.isCorrect) {
                    wrongByModule[selectedChoice.module] = (wrongByModule[selectedChoice.module] ?? 0) + 1;
                }

                return {
                    id: part.id,
                    stepNumber: index + 1,
                    questionTitle,
                    prompt: part.prompt,
                    selectedChoice,
                    correctChoice,
                    manualBullets: excerptToBullets(part.manual_reference.excerpt),
                    pageNumber: part.manual_reference.page_number,
                };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null);

        const focusModules = Object.entries(wrongByModule)
            .sort((first, second) => second[1] - first[1])
            .map(([module]) => module);

        const totalWrong = Object.values(wrongByModule).reduce((sum, count) => sum + count, 0);

        return { answeredParts, focusModules, totalWrong };
    }, [parts, selected]);

    if (completed) {
        return (
            <Card className="roleplay-shell">
                <CardHeader>
                    <Badge variant="success">Scenario complete</Badge>
                    <CardTitle>Answer review</CardTitle>
                </CardHeader>
                <CardContent className="summary-grid">
                    <div className="summary-panel">
                        <h4>Scenario result</h4>
                        <p className="muted-text">
                            You answered {summary.answeredParts.length} step{summary.answeredParts.length === 1 ? '' : 's'}.
                        </p>
                        <p className="muted-text">Wrong answers: {summary.totalWrong}</p>
                        {summary.focusModules.length > 0 && (
                            <>
                                <h4>Review these modules first</h4>
                                <ul>
                                    {summary.focusModules.map((moduleName) => (
                                        <li key={moduleName}>{moduleName}</li>
                                    ))}
                                </ul>
                            </>
                        )}
                    </div>

                    <div className="summary-panel">
                        <h4>Next study move</h4>
                        <ul>
                            {(summary.focusModules[0]
                                ? MODULE_REVIEW_TODO[summary.focusModules[0]]
                                : ['Review one full mock exam and explain each answer in simple English.']
                            ).map((task) => (
                                <li key={task}>{task}</li>
                            ))}
                        </ul>
                    </div>

                    <div className="summary-panel summary-panel--full">
                        <h4>Step-by-step answer review</h4>
                        <div className="answer-review-list">
                            {summary.answeredParts.map((item) => (
                                <section key={item.id} className="answer-review-card">
                                    <div className="answer-review-card__header">
                                        <Badge variant={item.selectedChoice.isCorrect ? 'success' : 'warning'}>
                                            Step {item.stepNumber}
                                        </Badge>
                                        <span className="muted-text">{item.questionTitle}</span>
                                    </div>
                                    <h5 className="answer-review-card__prompt">{item.prompt}</h5>

                                    <p className="answer-review-card__line">
                                        <strong>Your answer:</strong> {item.selectedChoice.text}
                                    </p>

                                    <p className="answer-review-card__line">
                                        <strong>Correct answer:</strong> {item.correctChoice.text}
                                    </p>

                                    <div className="answer-explanation">
                                        <p className="answer-explanation__eyebrow">Explanation</p>
                                        <p className="answer-explanation__text">
                                            {item.selectedChoice.isCorrect
                                                ? item.selectedChoice.simplifiedExplanation
                                                : `${item.selectedChoice.simplifiedExplanation} ${item.correctChoice.simplifiedExplanation}`}
                                        </p>

                                        <details className="manual-check manual-check--review">
                                            <summary className="manual-check__label">See citation (page {item.pageNumber})</summary>
                                            <ul className="manual-check__bullets">
                                                {item.manualBullets.map((bullet) => (
                                                    <li key={bullet}>{bullet}</li>
                                                ))}
                                            </ul>
                                        </details>
                                    </div>
                                </section>
                            ))}
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="actions-row">
                    <Button onClick={restart}>Retry same role</Button>
                    <Button variant="secondary" onClick={gotoNextScenario}>
                        Next scenario
                    </Button>
                </CardFooter>
            </Card>
        );
    }

    const selectedChoice = current
        ? selectedChoiceForPart(current.part.id, current.part.choices)
        : undefined;
    const displayScenario = current?.scenario ?? scenario;
    const currentScenarioName = displayScenario?.name ?? 'Officer scenarios';

    return (
        <Card className="roleplay-shell">
            <CardHeader>
                <div className="roleplay-topline">
                    <Badge variant="warning">Single player</Badge>
                    <div className="role-choice-compact" aria-label="Role selection">
                        <Button size="sm" variant="primary" type="button">
                            Officer
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
                            <p>{displayScenario?.imagePrompt}</p>
                            <p>Variation seed: {imageSeed}</p>
                            <Button size="sm" variant="secondary" onClick={() => setImageSeed((prev) => prev + 1)}>
                                Regenerate image
                            </Button>
                        </div>
                    </div>

                    <div className="chat-panel" aria-label="Scenario description">
                        <h4>Scenario description</h4>
                        <p className="muted-text">
                            {displayScenario?.scenarioDescription ??
                                'Use the prompt and manual citation to understand the scene before answering.'}
                        </p>
                        <p className="citation-note">
                            Source module: {displayScenario?.sourceModule ?? 'General security procedures'}
                        </p>
                    </div>
                </div>

                {current && (
                    <div className="question-column">
                        <Badge variant="neutral">
                            Module: {displayScenario?.sourceModule ?? current.questionTitle}
                        </Badge>
                        <h4>{current.part.prompt}</h4>
                        <p className="muted-text">
                            Step {currentIndex + 1} of {totalParts}
                        </p>

                        <div className="choices-grid" role="radiogroup" aria-label="Answer choices">
                            {current.part.choices.map((choice) => {
                                const hasAnswered = !!selected[current.part.id];
                                const isSelected = selected[current.part.id] === choice.id;
                                const stateClass = hasAnswered && choice.isCorrect
                                    ? 'choice-btn choice-btn--correct'
                                    : isSelected && !choice.isCorrect
                                        ? 'choice-btn choice-btn--wrong'
                                        : 'choice-btn';

                                return (
                                    <button
                                        key={choice.id}
                                        className={stateClass}
                                        onClick={() => chooseAnswer(current.part.id, choice.id)}
                                        disabled={!!selected[current.part.id] || isSubmitting}
                                        type="button"
                                    >
                                        <span className="choice-id">{choice.id.toUpperCase()}</span>
                                        <span>{choice.text}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {selectedChoice && (
                            <div
                                className={selectedChoice.isCorrect ? 'feedback feedback--correct' : 'feedback feedback--wrong'}
                                role="status"
                                aria-live="polite"
                            >
                                <strong>{selectedChoice.isCorrect ? 'Correct' : 'Try this instead'}</strong>
                                <p>{selectedChoice.simplifiedExplanation}</p>
                                <p className="citation-note">Review module: {selectedChoice.module}</p>
                                <details className="manual-check">
                                    <summary className="manual-check__label">
                                        Simple manual check, page {current.part.manual_reference.page_number}
                                    </summary>
                                    <ul className="manual-check__bullets">
                                        {excerptToBullets(current.part.manual_reference.excerpt).map((bullet) => (
                                            <li key={bullet}>{bullet}</li>
                                        ))}
                                    </ul>
                                </details>
                                <div className="feedback-actions">
                                    <Button onClick={() => void continueToNext()} disabled={isSubmitting}>
                                        {currentIndex + 1 >= totalParts ? 'Finish scenario' : 'Next step'}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </CardContent>

            <CardFooter className="actions-row">
                <Button variant="secondary" onClick={restart}>Restart scenario</Button>
            </CardFooter>
        </Card>
    );
}

export default RoleplayScenario;
