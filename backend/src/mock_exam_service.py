from __future__ import annotations

import json
import os
import random
import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any


BACKEND_ROOT = Path(__file__).resolve().parents[1]
MOCK_EXAMS_PATH = BACKEND_ROOT / "data" / "mock_exams.json"
CHUNKS_PATH = BACKEND_ROOT / "data" / "chunks.json"
DEFAULT_ABST_FORMAT_PATH = BACKEND_ROOT / "data" / "abst_practice_quiz_answer_key.txt"
LEGACY_ABST_FORMAT_PATH = Path(r"C:\Users\quocd\Downloads\ABST Practice Quiz Answer Key v 1.txt")

_configured_abst_path = os.getenv("ABST_FORMAT_PATH", "").strip()
if _configured_abst_path:
    ABST_FORMAT_PATH = Path(_configured_abst_path)
elif DEFAULT_ABST_FORMAT_PATH.exists():
    ABST_FORMAT_PATH = DEFAULT_ABST_FORMAT_PATH
else:
    ABST_FORMAT_PATH = LEGACY_ABST_FORMAT_PATH

RNG_SEED = 2026
DEFAULT_DURATION_SECONDS = 60 * 60


@dataclass(frozen=True)
class FormatQuestion:
    number: int
    prompt: str
    answer: str


def _safe_load_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def _safe_save_json(path: Path, payload: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")


def _load_lines(path: Path) -> list[str]:
    with open(path, "r", encoding="utf-8") as file:
        return [line.strip() for line in file.readlines()]


def _parse_format_questions() -> list[FormatQuestion]:
    if not ABST_FORMAT_PATH.exists():
        raise FileNotFoundError(
            f"Missing ABST practice format file at {ABST_FORMAT_PATH}. "
            "Set ABST_FORMAT_PATH for Lambda/local runtime, or add backend/data/abst_practice_quiz_answer_key.txt."
        )

    lines = _load_lines(ABST_FORMAT_PATH)
    pattern = re.compile(r"^(\d+)[A-Za-z]?\.?\s*(.+)$")
    results: list[FormatQuestion] = []
    index = 0
    while index < len(lines):
        line = lines[index]
        match = pattern.match(line)
        if not match:
            index += 1
            continue

        number = int(match.group(1))
        prompt = match.group(2).strip()
        if not prompt:
            index += 1
            continue

        answer = ""
        answer_index = index + 1
        while answer_index < len(lines):
            candidate = lines[answer_index].strip()
            if not candidate:
                answer_index += 1
                continue
            if pattern.match(candidate):
                break
            if candidate.isupper() and len(candidate.split()) <= 5:
                answer_index += 1
                continue
            if candidate.startswith("Note:"):
                answer_index += 1
                continue
            answer = candidate
            break

        if answer:
            results.append(FormatQuestion(number=number, prompt=prompt, answer=answer))

        index += 1

    if len(results) < 50:
        raise RuntimeError("ABST format file parsed too few questions.")
    return results


def _tokenize(text: str) -> set[str]:
    tokens = re.findall(r"[a-z0-9]+", text.lower())
    return {token for token in tokens if len(token) > 2}


def _classify_module(prompt: str, answer: str) -> str:
    text = f"{prompt} {answer}".lower()
    if any(k in text for k in ("force", "arrest", "assault", "restrain", "detain")):
        return "Use of Force"
    if any(k in text for k in ("notebook", "report", "statement", "interview", "evidence")):
        return "Notebooks"
    if any(k in text for k in ("emergency", "evacuation", "fire", "alarm", "bomb")):
        return "Emergency Response"
    return "Patrol"


def _load_chunks() -> list[dict[str, Any]]:
    if not CHUNKS_PATH.exists():
        return []
    raw = _safe_load_json(CHUNKS_PATH)
    if not isinstance(raw, list):
        return []
    return [item for item in raw if isinstance(item, dict)]


def _best_citation(prompt: str, answer: str, chunks: list[dict[str, Any]]) -> dict[str, Any]:
    if not chunks:
        return {
            "page_number": 0,
            "chunk_text": "Citation unavailable in local chunk store.",
        }

    query_tokens = _tokenize(f"{prompt} {answer}")
    best_score = -1
    best_chunk = None
    for chunk in chunks:
        text = str(chunk.get("text", "")).strip()
        if not text:
            continue
        score = len(query_tokens.intersection(_tokenize(text)))
        if score > best_score:
            best_score = score
            best_chunk = chunk

    if not best_chunk:
        return {
            "page_number": 0,
            "chunk_text": "Citation unavailable in local chunk store.",
        }

    return {
        "page_number": int(best_chunk.get("page_number", 0)),
        "chunk_text": str(best_chunk.get("text", "")).strip()[:900],
    }


def _build_mcq_options(
    question: FormatQuestion,
    all_answers: list[str],
    rng: random.Random,
) -> tuple[list[str], int]:
    distractor_pool = [answer for answer in all_answers if answer != question.answer]
    sample = rng.sample(distractor_pool, k=3)
    options = [question.answer, *sample]
    rng.shuffle(options)
    correct_index = options.index(question.answer)
    return options, correct_index


def _load_existing_mock_exams() -> list[dict[str, Any]]:
    if not MOCK_EXAMS_PATH.exists():
        return []
    raw = _safe_load_json(MOCK_EXAMS_PATH)
    return raw if isinstance(raw, list) else []


def _save_mock_exam(definition: dict[str, Any]) -> None:
    existing = _load_existing_mock_exams()
    existing.insert(0, definition)
    _safe_save_json(MOCK_EXAMS_PATH, existing[:40])


def create_mock_exam(label: str | None, question_count: int = 50) -> dict[str, Any]:
    rng = random.Random(RNG_SEED + len(_load_existing_mock_exams()) + 1)
    format_questions = _parse_format_questions()
    all_answers = [item.answer for item in format_questions]
    chunks = _load_chunks()

    pool = list(format_questions)
    rng.shuffle(pool)
    selected = pool[:question_count]

    questions: list[dict[str, Any]] = []
    for idx, item in enumerate(selected, start=1):
        options, correct_index = _build_mcq_options(item, all_answers, rng)
        citation = _best_citation(item.prompt, item.answer, chunks)
        module = _classify_module(item.prompt, item.answer)
        questions.append(
            {
                "id": f"mx-{idx:03d}-{abs(hash(item.prompt)) % 100000}",
                "module": module,
                "type": "mcq",
                "question": item.prompt,
                "simplified": item.prompt,
                "options": options,
                "correctAnswers": [correct_index],
                "explanation": (
                    f'The best answer is "{item.answer}". '
                    "This follows the ABST practice format and manual-aligned guidance."
                ),
                "wrongAnswerExplanations": [
                    None if option_index == correct_index else "This option does not match the expected answer key."
                    for option_index, _ in enumerate(options)
                ],
                "citation": citation,
                "image": None,
            }
        )

    exam_index = len(_load_existing_mock_exams()) + 1
    exam_id = f"backend-mock-exam-{exam_index}"
    exam_label = label.strip() if label else f"Mock Exam {exam_index}"
    payload = {
        "id": exam_id,
        "label": exam_label,
        "questionCount": len(questions),
        "durationSeconds": DEFAULT_DURATION_SECONDS,
        "createdAt": int(time.time() * 1000),
        "source": "backend-abst-format",
        "questions": questions,
    }
    _save_mock_exam(payload)
    return payload
