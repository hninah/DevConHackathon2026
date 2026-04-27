from __future__ import annotations

import json
import random
import re
from pathlib import Path
from typing import Any

ALL_SCENARIOS_OPTION = "all"


def _scenarios_path() -> Path:
    return Path(__file__).resolve().parent.parent / "data" / "scenarios.json"


def _chunks_path() -> Path:
    return Path(__file__).resolve().parent.parent / "data" / "chunks.json"


def _load_scenarios() -> list[dict[str, Any]]:
    with _scenarios_path().open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    if not isinstance(payload, list) or not payload:
        raise ValueError("roleplay scenarios are missing or invalid")

    return payload


def _load_chunks() -> list[dict[str, Any]]:
    with _chunks_path().open("r", encoding="utf-8") as handle:
        payload = json.load(handle)

    if not isinstance(payload, list) or not payload:
        raise ValueError("manual chunks are missing or invalid")

    return payload


def _clean_text(value: str, max_len: int) -> str:
    normalized = re.sub(r"\s+", " ", value).strip()
    return normalized[:max_len]


def _infer_module(text: str) -> str:
    lowered = text.lower()
    if "communicat" in lowered or "dispatch" in lowered:
        return "Communication and Dispatch"
    if "report" in lowered or "note" in lowered or "evidence" in lowered:
        return "Notebook and Evidence"
    if "patrol" in lowered or "hazard" in lowered or "safety" in lowered:
        return "Officer Safety"
    if "legal" in lowered or "act" in lowered or "licence" in lowered:
        return "Legal Authority and Licensing"
    return "Professional Conduct"


def generate_next_manual_scenario(payload: dict[str, Any]) -> dict[str, Any]:
    mode = str(payload.get("mode", "passive")).strip() or "passive"
    excluded_ids = {
        str(item).strip()
        for item in payload.get("exclude_scenario_ids", [])
        if str(item).strip()
    }

    chunks = _load_chunks()
    candidates = []
    for chunk in chunks:
        text = str(chunk.get("text", ""))
        cleaned = _clean_text(text, 1800)
        if len(cleaned) < 220:
            continue

        alpha_count = sum(1 for char in cleaned if char.isalpha())
        if alpha_count < 120:
            continue

        candidates.append(chunk)

    if not candidates:
        raise ValueError("no usable manual chunks for scenario generation")

    chunk = random.choice(candidates)
    page_number = int(chunk.get("page_number", 1))
    chunk_id = int(chunk.get("chunk_id", 0))
    cleaned_excerpt = _clean_text(str(chunk.get("text", "")), 480)
    module = _infer_module(cleaned_excerpt)

    scenario_id = f"manual-generated-{mode}-{page_number}-{chunk_id}"
    while scenario_id in excluded_ids:
        chunk = random.choice(candidates)
        page_number = int(chunk.get("page_number", 1))
        chunk_id = int(chunk.get("chunk_id", 0))
        cleaned_excerpt = _clean_text(str(chunk.get("text", "")), 480)
        module = _infer_module(cleaned_excerpt)
        scenario_id = f"manual-generated-{mode}-{page_number}-{chunk_id}"

    role_label = "suspect" if mode == "passive" else "officer"
    title_prefix = "Manual Passive" if mode == "passive" else "Manual Active"

    return {
        "id": scenario_id,
        "name": f"{title_prefix}: Page {page_number}",
        "roleMode": mode,
        "aiPoliceChat": [
            f"Dispatch: Scenario built from manual page {page_number}.",
            f"AI Coach: Focus on lawful sequence and {module.lower()}.",
            "AI Coach: Keep responses clear, safe, and proportional.",
        ],
        "imagePrompt": (
            f"Generate a realistic {role_label} training scene based on Alberta security manual "
            f"concepts from page {page_number}: {cleaned_excerpt[:180]}"
        ),
        "questions": [
            {
                "id": "generated-q1",
                "title": "Sequence: best first response",
                "parts": [
                    {
                        "id": "generated-q1p1",
                        "prompt": "What is the best first action in this scenario?",
                        "manual_reference": {
                            "page_number": page_number,
                            "excerpt": cleaned_excerpt,
                        },
                        "choices": [
                            {
                                "id": "a",
                                "text": "Assess safety, communicate clearly, and follow legal procedure.",
                                "isCorrect": True,
                                "simplifiedExplanation": "Correct. Safe communication and lawful procedure should happen first.",
                                "module": module,
                            },
                            {
                                "id": "b",
                                "text": "Act immediately without announcing your plan.",
                                "isCorrect": False,
                                "simplifiedExplanation": "Not correct. Skipping communication increases risk and confusion.",
                                "module": "Communication and Dispatch",
                            },
                            {
                                "id": "c",
                                "text": "Delay action and wait for the situation to resolve itself.",
                                "isCorrect": False,
                                "simplifiedExplanation": "Not correct. Delayed response can increase harm and reduce control.",
                                "module": "Officer Safety",
                            },
                        ],
                    },
                    {
                        "id": "generated-q1p2",
                        "prompt": "What should happen next after initial control?",
                        "manual_reference": {
                            "page_number": page_number,
                            "excerpt": cleaned_excerpt,
                        },
                        "choices": [
                            {
                                "id": "a",
                                "text": "Document the timeline and key actions with clear detail.",
                                "isCorrect": True,
                                "simplifiedExplanation": "Correct. Accurate documentation supports accountability and review.",
                                "module": "Notebook and Evidence",
                            },
                            {
                                "id": "b",
                                "text": "Skip notes and rely on memory later.",
                                "isCorrect": False,
                                "simplifiedExplanation": "Not correct. Memory fades; records should be completed promptly.",
                                "module": "Notebook and Evidence",
                            },
                            {
                                "id": "c",
                                "text": "Share incident details through unofficial channels.",
                                "isCorrect": False,
                                "simplifiedExplanation": "Not correct. Incident details belong in official reporting only.",
                                "module": "Professional Conduct",
                            },
                        ],
                    },
                ],
            }
        ],
    }


def _flatten_parts(
    scenarios: list[dict[str, Any]],
    mode: str,
    selected_scenario_id: str,
) -> list[dict[str, Any]]:
    mode_scenarios = [item for item in scenarios if item.get("roleMode") == mode]
    scoped = mode_scenarios if mode_scenarios else scenarios

    if selected_scenario_id == ALL_SCENARIOS_OPTION:
        selected = scoped
    else:
        selected = [item for item in scenarios if item.get("id") == selected_scenario_id]
        if not selected:
            selected = scoped

    flattened: list[dict[str, Any]] = []
    for scenario in selected:
        for question in scenario.get("questions", []):
            for part in question.get("parts", []):
                flattened.append(
                    {
                        "scenario_id": str(scenario.get("id", "")),
                        "part_id": str(part.get("id", "")),
                        "part": part,
                    }
                )

    return flattened


def process_roleplay_answer(payload: dict[str, Any]) -> dict[str, Any]:
    mode = str(payload.get("mode", "passive")).strip() or "passive"
    selected_scenario_id = str(payload.get("selected_scenario_id", ALL_SCENARIOS_OPTION)).strip() or ALL_SCENARIOS_OPTION
    current_part_id = str(payload.get("current_part_id", "")).strip()
    choice_id = str(payload.get("choice_id", "")).strip()

    if not current_part_id:
        raise ValueError("current_part_id is required")
    if not choice_id:
        raise ValueError("choice_id is required")

    flattened_parts = _flatten_parts(_load_scenarios(), mode, selected_scenario_id)
    if not flattened_parts:
        raise ValueError("no roleplay parts available")

    current_index = next(
        (index for index, item in enumerate(flattened_parts) if item["part_id"] == current_part_id),
        -1,
    )
    if current_index < 0:
        raise ValueError(f"current_part_id not found: {current_part_id}")

    current_part = flattened_parts[current_index]["part"]
    choices = current_part.get("choices", [])
    selected_choice = next(
        (item for item in choices if str(item.get("id", "")) == choice_id),
        None,
    )
    if selected_choice is None:
        raise ValueError(f"choice_id not found in part {current_part_id}: {choice_id}")

    next_index = current_index + 1
    completed = next_index >= len(flattened_parts)
    next_part_id = None if completed else flattened_parts[next_index]["part_id"]
    next_scenario_id = None if completed else flattened_parts[next_index]["scenario_id"]

    return {
        "is_correct": bool(selected_choice.get("isCorrect", False)),
        "simplified_explanation": str(selected_choice.get("simplifiedExplanation", "")),
        "module": str(selected_choice.get("module", "")),
        "current_part_id": current_part_id,
        "next_part_id": next_part_id,
        "next_scenario_id": next_scenario_id,
        "completed": completed,
    }
