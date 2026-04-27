export type RoleMode = 'passive' | 'active';

export type ManualReference = {
    page_number: number;
    excerpt: string;
};

export type ScenarioChoice = {
    id: string;
    text: string;
    isCorrect: boolean;
    simplifiedExplanation: string;
    module: string;
};

export type ScenarioPart = {
    id: string;
    prompt: string;
    manual_reference: ManualReference;
    choices: ScenarioChoice[];
};

export type ScenarioQuestion = {
    id: string;
    title: string;
    parts: ScenarioPart[];
};

export type ScenarioScript = {
    id: string;
    name: string;
    roleMode: RoleMode;
    aiPoliceChat: string[];
    imagePrompt: string;
    sourceModule?: string;
    scenarioDescription?: string;
    questions: ScenarioQuestion[];
};

export const FALLBACK_ROLEPLAY_SCENARIOS: ScenarioScript[] = [
    {
        id: 'night-market-passive',
        name: 'Night Market Escape',
        roleMode: 'passive',
        aiPoliceChat: [
            'Dispatch: Two suspects seen near Gate B carrying electronics.',
            'Officer AI: Stop where you are, hands visible, do not run.',
            'Officer AI: One suspect moving east. Backup requested.',
        ],
        imagePrompt:
            'Generate a street market scene at night with police lights and two suspects splitting paths near Gate B.',
        questions: [
            {
                id: 'q1',
                title: 'Sequence: reporting while suspects split',
                parts: [
                    {
                        id: 'q1p1',
                        prompt: 'As responding police, what should happen first?',
                        manual_reference: {
                            page_number: 43,
                            excerpt:
                                'Use reasonable force only when lawful, and prioritize clear communication and safety before physical intervention.',
                        },
                        choices: [
                            {
                                id: 'a',
                                text: 'Broadcast suspect direction and request backup immediately.',
                                isCorrect: true,
                                simplifiedExplanation:
                                    'Correct. First action is clear radio communication so all units know direction and risk.',
                                module: 'Communication and Dispatch',
                            },
                            {
                                id: 'b',
                                text: 'Chase alone without updates.',
                                isCorrect: false,
                                simplifiedExplanation:
                                    'Not safe. Running alone without radio updates can lose suspects and increase danger.',
                                module: 'Officer Safety',
                            },
                            {
                                id: 'c',
                                text: 'Wait silently and observe for five minutes.',
                                isCorrect: false,
                                simplifiedExplanation:
                                    'Too slow. Delayed reporting makes coordination weaker and suspects can disappear.',
                                module: 'Communication and Dispatch',
                            },
                        ],
                    },
                    {
                        id: 'q1p2',
                        prompt: 'What should happen second?',
                        manual_reference: {
                            page_number: 62,
                            excerpt:
                                'Containment and scene control reduce risk and support coordinated response by additional officers.',
                        },
                        choices: [
                            {
                                id: 'a',
                                text: 'Contain exits and coordinate a perimeter.',
                                isCorrect: true,
                                simplifiedExplanation:
                                    'Correct. Perimeter control limits escape options and supports safe interception.',
                                module: 'Patrol and Perimeter Control',
                            },
                            {
                                id: 'b',
                                text: 'Turn off sirens and leave the area.',
                                isCorrect: false,
                                simplifiedExplanation:
                                    'This ends active response too early and allows suspects to flee.',
                                module: 'Patrol and Perimeter Control',
                            },
                            {
                                id: 'c',
                                text: 'Post incident notes before containment.',
                                isCorrect: false,
                                simplifiedExplanation:
                                    'Notes are important, but not before scene control during an active pursuit.',
                                module: 'Notebook and Evidence',
                            },
                        ],
                    },
                ],
            },
            {
                id: 'q2',
                title: 'Sequence: detention and reporting',
                parts: [
                    {
                        id: 'q2p1',
                        prompt: 'A suspect is stopped. What is the best first procedural step?',
                        manual_reference: {
                            page_number: 43,
                            excerpt:
                                'Begin with verbal control and only escalate force when needed and legally justified.',
                        },
                        choices: [
                            {
                                id: 'a',
                                text: 'Give clear verbal commands and confirm compliance.',
                                isCorrect: true,
                                simplifiedExplanation:
                                    'Correct. Clear commands reduce confusion and lower force risk.',
                                module: 'Use of Force and De-escalation',
                            },
                            {
                                id: 'b',
                                text: 'Use force first to prevent any chance of movement.',
                                isCorrect: false,
                                simplifiedExplanation:
                                    'Force is not first choice. Start with verbal control when safe and lawful.',
                                module: 'Use of Force and De-escalation',
                            },
                            {
                                id: 'c',
                                text: 'Question witnesses before securing suspect control.',
                                isCorrect: false,
                                simplifiedExplanation:
                                    'Witness statements matter later. Immediate control and safety come first.',
                                module: 'Officer Safety',
                            },
                        ],
                    },
                    {
                        id: 'q2p2',
                        prompt: 'After control is established, what should be next?',
                        manual_reference: {
                            page_number: 88,
                            excerpt:
                                'Complete accurate notebook entries with timeline, actions, and evidence handoff details.',
                        },
                        choices: [
                            {
                                id: 'a',
                                text: 'Document timeline, evidence handling, and handoff details.',
                                isCorrect: true,
                                simplifiedExplanation:
                                    'Correct. Accurate notes protect case integrity and support legal review.',
                                module: 'Notebook and Evidence',
                            },
                            {
                                id: 'b',
                                text: 'Post scenario details to social media for tips.',
                                isCorrect: false,
                                simplifiedExplanation:
                                    'Not allowed. Confidential incident details must stay in official channels.',
                                module: 'Professional Conduct',
                            },
                            {
                                id: 'c',
                                text: 'Ignore details and rely on memory tomorrow.',
                                isCorrect: false,
                                simplifiedExplanation:
                                    'Memory fades quickly. Notes should be written as soon as possible.',
                                module: 'Notebook and Evidence',
                            },
                        ],
                    },
                ],
            },
        ],
    },
    {
        id: 'transit-hub-active',
        name: 'Transit Hub Response',
        roleMode: 'active',
        aiPoliceChat: [
            'Dispatch: Theft suspect entering Platform 2 with a backpack.',
            'Officer AI Coach: Keep distance, identify exits, and call your approach.',
            'Officer AI Coach: One bystander filming. Keep commands simple and calm.',
        ],
        imagePrompt:
            'Generate a busy transit platform scene with one officer, one suspect near stairs, and highlighted exits.',
        questions: [
            {
                id: 'q1',
                title: 'Sequence: approach in a crowded area',
                parts: [
                    {
                        id: 'q1p1',
                        prompt: 'As police, what should you do first in this crowded setting?',
                        manual_reference: {
                            page_number: 57,
                            excerpt:
                                'Assess hazards, exits, and bystander risk before engagement in crowded environments.',
                        },
                        choices: [
                            {
                                id: 'a',
                                text: 'Assess exits, crowd flow, and hazards before contact.',
                                isCorrect: true,
                                simplifiedExplanation:
                                    'Correct. A fast scene assessment prevents dangerous movement and confusion.',
                                module: 'Patrol and Risk Assessment',
                            },
                            {
                                id: 'b',
                                text: 'Rush directly with no communication.',
                                isCorrect: false,
                                simplifiedExplanation:
                                    'Too risky. Quick action without plan can escalate crowd panic.',
                                module: 'Officer Safety',
                            },
                            {
                                id: 'c',
                                text: 'Ignore exits and focus only on suspect clothing.',
                                isCorrect: false,
                                simplifiedExplanation:
                                    'Incomplete. Exit awareness is critical to prevent escape and crowd harm.',
                                module: 'Patrol and Risk Assessment',
                            },
                        ],
                    },
                    {
                        id: 'q1p2',
                        prompt: 'What should be second?',
                        manual_reference: {
                            page_number: 43,
                            excerpt:
                                'Use clear verbal commands and controlled positioning to de-escalate before force.',
                        },
                        choices: [
                            {
                                id: 'a',
                                text: 'Use clear verbal direction and position safely with cover.',
                                isCorrect: true,
                                simplifiedExplanation:
                                    'Correct. Verbal direction with safe positioning supports de-escalation.',
                                module: 'Use of Force and De-escalation',
                            },
                            {
                                id: 'b',
                                text: 'Push through bystanders to close distance immediately.',
                                isCorrect: false,
                                simplifiedExplanation:
                                    'This can create injury risk and public disorder.',
                                module: 'Professional Conduct',
                            },
                            {
                                id: 'c',
                                text: 'Stop speaking and wait for suspect to decide.',
                                isCorrect: false,
                                simplifiedExplanation:
                                    'Silence can reduce control. Clear lawful commands are needed.',
                                module: 'Communication and Dispatch',
                            },
                        ],
                    },
                ],
            },
        ],
    },
];

export async function loadRoleplayScenarios(): Promise<ScenarioScript[]> {
    try {
        const response = await fetch('/scenarios.json');
        if (!response.ok) {
            throw new Error(`scenarios.json request failed: ${response.status}`);
        }

        const payload = await response.json() as ScenarioScript[];
        if (!Array.isArray(payload) || payload.length === 0) {
            throw new Error('scenarios.json did not contain a scenario array');
        }

        return payload;
    } catch {
        return FALLBACK_ROLEPLAY_SCENARIOS;
    }
}

export const MODULE_REVIEW_TODO: Record<string, string[]> = {
    'Communication and Dispatch': [
        'Review radio call structure: location, suspect, direction, risk.',
        'Practice 30-second incident updates with clear sequence language.',
    ],
    'Officer Safety': [
        'Review distance and cover positioning rules before physical contact.',
        'Practice decision points for waiting, containing, and requesting backup.',
    ],
    'Patrol and Perimeter Control': [
        'Review perimeter setup priorities in split-suspect scenarios.',
        'Practice choosing containment points near exits and choke paths.',
    ],
    'Patrol and Risk Assessment': [
        'Review quick-scene scan checklist: exits, crowd, hazards, routes.',
        'Practice identifying high-risk terrain in transit and market settings.',
    ],
    'Use of Force and De-escalation': [
        'Review force continuum and thresholds for verbal-first response.',
        'Practice concise verbal commands for compliance and safety.',
    ],
    'Notebook and Evidence': [
        'Review required note fields: time, action, witness, handoff.',
        'Practice writing a short, factual timeline from memory within 5 minutes.',
    ],
    'Professional Conduct': [
        'Review confidentiality boundaries for public incidents and media.',
        'Practice neutral language under stress and crowd pressure.',
    ],
};
