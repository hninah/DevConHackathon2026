"""
build_roleplay_scenarios.py

Builds frontend roleplay scenarios from manual chunks so question validation can
reference real manual excerpts.

Reads:  data/chunks.json
Writes: ../frontend/public/scenarios.json

Usage:
    python scripts/build_roleplay_scenarios.py
"""

import json
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

CHUNKS_PATH = Path(os.getenv("CHUNKS_OUTPUT_PATH", "data/chunks.json"))
OUTPUT_PATH = Path(os.getenv("SCENARIOS_OUTPUT_PATH", "../frontend/public/scenarios.json"))


def _load_chunks(path: Path) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(
            f"Chunks file not found at {path.resolve()}. Run scripts/chunk_manual.py first."
        )

    with open(path, "r", encoding="utf-8") as file:
        chunks = json.load(file)

    if not isinstance(chunks, list) or not chunks:
        raise ValueError("Chunks file is empty or invalid.")

    return chunks


def _find_reference(chunks: list[dict], keywords: list[str]) -> dict:
    lowered_keywords = [keyword.lower() for keyword in keywords]

    for chunk in chunks:
        text = str(chunk.get("text", ""))
        lowered_text = text.lower()
        if all(keyword in lowered_text for keyword in lowered_keywords):
            return {
                "page_number": int(chunk.get("page_number", 0)),
                "excerpt": _first_sentence(text),
            }

    fallback = chunks[0]
    return {
        "page_number": int(fallback.get("page_number", 0)),
        "excerpt": _first_sentence(str(fallback.get("text", ""))),
    }


def _first_sentence(text: str) -> str:
    cleaned = " ".join(text.split())
    if not cleaned:
        return "Manual excerpt unavailable."

    sentence_end = cleaned.find(". ")
    if sentence_end == -1:
        return cleaned[:220]
    return cleaned[: sentence_end + 1]


def build_scenarios(chunks: list[dict]) -> list[dict]:
    use_of_force = _find_reference(chunks, ["force"])
    communication = _find_reference(chunks, ["report"])
    notebooks = _find_reference(chunks, ["notebook"])
    patrol = _find_reference(chunks, ["patrol"])

    return [
        {
            "id": "manual-passive",
            "name": "Manual Scenario, Suspect Perspective",
            "roleMode": "passive",
            "aiPoliceChat": [
                "Dispatch: Suspect movement reported near the perimeter.",
                "Officer AI: Keep hands visible and follow commands.",
                "Officer AI: Backup requested for safe containment.",
            ],
            "imagePrompt": "Generate a perimeter checkpoint scene with officers and one suspect path.",
            "questions": [
                {
                    "id": "q1",
                    "title": "Sequence, communication first",
                    "parts": [
                        {
                            "id": "q1p1",
                            "prompt": "What should police do first in this situation?",
                            "manual_reference": communication,
                            "choices": [
                                {
                                    "id": "a",
                                    "text": "Report location and direction before isolated pursuit.",
                                    "isCorrect": True,
                                    "simplifiedExplanation": "Correct. Communication first improves team safety and tracking.",
                                    "module": "Communication and Dispatch",
                                },
                                {
                                    "id": "b",
                                    "text": "Pursue alone and report later.",
                                    "isCorrect": False,
                                    "simplifiedExplanation": "Not correct. Delayed reporting increases risk.",
                                    "module": "Officer Safety",
                                },
                                {
                                    "id": "c",
                                    "text": "Wait without sharing updates.",
                                    "isCorrect": False,
                                    "simplifiedExplanation": "Not correct. Team coordination depends on updates.",
                                    "module": "Communication and Dispatch",
                                },
                            ],
                        },
                        {
                            "id": "q1p2",
                            "prompt": "What should happen after initial communication?",
                            "manual_reference": patrol,
                            "choices": [
                                {
                                    "id": "a",
                                    "text": "Set containment and maintain safe positioning.",
                                    "isCorrect": True,
                                    "simplifiedExplanation": "Correct. Containment limits escape and protects bystanders.",
                                    "module": "Patrol and Perimeter Control",
                                },
                                {
                                    "id": "b",
                                    "text": "Ignore perimeter and focus only on speed.",
                                    "isCorrect": False,
                                    "simplifiedExplanation": "Not correct. Losing perimeter control raises risk.",
                                    "module": "Patrol and Perimeter Control",
                                },
                                {
                                    "id": "c",
                                    "text": "Complete full notes before scene control.",
                                    "isCorrect": False,
                                    "simplifiedExplanation": "Not correct. Control the scene first, then document.",
                                    "module": "Notebook and Evidence",
                                },
                            ],
                        },
                    ],
                }
            ],
        },
        {
            "id": "manual-active",
            "name": "Manual Scenario, Officer Perspective",
            "roleMode": "active",
            "aiPoliceChat": [
                "Dispatch: Officer approaching suspect in a public zone.",
                "Officer AI Coach: Start with clear verbal commands.",
                "Officer AI Coach: Record actions accurately after control.",
            ],
            "imagePrompt": "Generate a public transit approach scene with one officer and safe standoff distance.",
            "questions": [
                {
                    "id": "q1",
                    "title": "Sequence, lawful control",
                    "parts": [
                        {
                            "id": "q1p1",
                            "prompt": "What is the best first action?",
                            "manual_reference": use_of_force,
                            "choices": [
                                {
                                    "id": "a",
                                    "text": "Use clear verbal commands and assess compliance.",
                                    "isCorrect": True,
                                    "simplifiedExplanation": "Correct. Start with verbal control before escalation.",
                                    "module": "Use of Force and De-escalation",
                                },
                                {
                                    "id": "b",
                                    "text": "Use force immediately without commands.",
                                    "isCorrect": False,
                                    "simplifiedExplanation": "Not correct. Force should be lawful, necessary, and proportionate.",
                                    "module": "Use of Force and De-escalation",
                                },
                                {
                                    "id": "c",
                                    "text": "Avoid giving any instructions.",
                                    "isCorrect": False,
                                    "simplifiedExplanation": "Not correct. Clear commands reduce confusion and risk.",
                                    "module": "Communication and Dispatch",
                                },
                            ],
                        },
                        {
                            "id": "q1p2",
                            "prompt": "What should happen after control is established?",
                            "manual_reference": notebooks,
                            "choices": [
                                {
                                    "id": "a",
                                    "text": "Document timeline and evidence handoff details.",
                                    "isCorrect": True,
                                    "simplifiedExplanation": "Correct. Accurate notes support legal and procedural review.",
                                    "module": "Notebook and Evidence",
                                },
                                {
                                    "id": "b",
                                    "text": "Skip documentation and rely on memory.",
                                    "isCorrect": False,
                                    "simplifiedExplanation": "Not correct. Delayed notes reduce reliability.",
                                    "module": "Notebook and Evidence",
                                },
                                {
                                    "id": "c",
                                    "text": "Share details through unofficial channels.",
                                    "isCorrect": False,
                                    "simplifiedExplanation": "Not correct. Incident details must stay in official records.",
                                    "module": "Professional Conduct",
                                },
                            ],
                        },
                    ],
                }
            ],
        },
    ]


def main() -> None:
    chunks = _load_chunks(CHUNKS_PATH)
    scenarios = build_scenarios(chunks)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as file:
        json.dump(scenarios, file, ensure_ascii=False, indent=2)

    print(f"Wrote {len(scenarios)} scenarios to {OUTPUT_PATH.resolve()}")


if __name__ == "__main__":
    main()
