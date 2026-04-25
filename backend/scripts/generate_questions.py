"""
generate_questions.py

Generates `frontend/public/question-bank.json`.

Primary (future) path:
- Read embedded manual chunks from `backend/data/chunks.json`
- Ask Claude (Bedrock) to draft exam-format questions with citations

Today (offline) fallback path (works without AWS credentials):
- Build a large starter bank from `frontend/public/glossary.json`
  by converting glossary terms into definition-based MCQs + a few select-all items.

Usage:
  python scripts/generate_questions.py

Outputs:
  ../frontend/public/question-bank.json
"""

from __future__ import annotations

import json
import os
import random
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dotenv import load_dotenv


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent

load_dotenv(BACKEND_ROOT / ".env")

GLOSSARY_PATH = PROJECT_ROOT / "frontend" / "public" / "glossary.json"
OUTPUT_PATH = PROJECT_ROOT / "frontend" / "public" / "question-bank.json"

TARGET_COUNT = 120
RNG_SEED = 2026

QUESTION_GEN_MODE = os.getenv("QUESTION_GEN_MODE", "glossary").strip().lower()
AWS_REGION = os.getenv("AWS_REGION", "us-west-2")
CLAUDE_MODEL_ID = os.getenv("CLAUDE_MODEL_ID", "us.anthropic.claude-sonnet-4-6")
CHUNKS_PATH = BACKEND_ROOT / os.getenv("CHUNKS_OUTPUT_PATH", "data/chunks.json")

BEDROCK_BATCH_SIZE = int(os.getenv("QUESTION_GEN_BATCH_SIZE", "6"))
BEDROCK_SLEEP_SECONDS = float(os.getenv("QUESTION_GEN_SLEEP_SECONDS", "0.2"))
BEDROCK_MAX_OUTPUT_TOKENS = int(os.getenv("QUESTION_GEN_MAX_TOKENS", "2200"))
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 2


@dataclass(frozen=True)
class GlossaryEntry:
    term: str
    definition: str
    page: int


def _load_json(path: Path) -> Any:
    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def load_glossary() -> list[GlossaryEntry]:
    if not GLOSSARY_PATH.exists():
        raise FileNotFoundError(
            f"Missing {GLOSSARY_PATH}. Run scripts/extract_glossary.py first "
            "or commit a glossary.json into frontend/public."
        )

    raw = _load_json(GLOSSARY_PATH)
    if not isinstance(raw, list):
        raise ValueError("glossary.json must be a JSON array.")

    entries: list[GlossaryEntry] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        term = str(item.get("term", "")).strip()
        definition = str(item.get("definition", "")).strip()
        page = item.get("page")
        if not term or not definition:
            continue
        try:
            page_number = int(page)
        except (TypeError, ValueError):
            continue
        entries.append(GlossaryEntry(term=term, definition=definition, page=page_number))

    if len(entries) < 50:
        raise RuntimeError("Glossary is too small to generate a question bank.")
    return entries


def load_chunks() -> list[dict[str, Any]]:
    if not CHUNKS_PATH.exists():
        raise FileNotFoundError(
            f"Missing {CHUNKS_PATH}. Run scripts/chunk_manual.py then scripts/embed_chunks.py first."
        )
    raw = _load_json(CHUNKS_PATH)
    if not isinstance(raw, list) or not raw:
        raise ValueError("chunks.json must be a non-empty JSON array.")
    return [item for item in raw if isinstance(item, dict)]


def batched(items: list[Any], size: int) -> list[list[Any]]:
    return [items[i : i + size] for i in range(0, len(items), size)]


def parse_json_array(text: str) -> list[dict[str, Any]]:
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("[")
        end = text.rfind("]")
        if start == -1 or end == -1 or end <= start:
            raise
        value = json.loads(text[start : end + 1])

    if not isinstance(value, list):
        raise ValueError("Claude did not return a JSON array.")
    return [item for item in value if isinstance(item, dict)]


def invoke_claude(prompt: str) -> list[dict[str, Any]]:
    try:
        import boto3
        from botocore.exceptions import ClientError
    except ModuleNotFoundError as error:
        raise RuntimeError(
            "Missing dependency for Bedrock mode. Activate the backend venv and run "
            "`pip install -r requirements.txt`."
        ) from error

    bedrock = boto3.client("bedrock-runtime", region_name=AWS_REGION)

    body = json.dumps(
        {
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": BEDROCK_MAX_OUTPUT_TOKENS,
            "messages": [{"role": "user", "content": prompt}],
        }
    )

    last_exception: Exception | None = None
    for attempt in range(MAX_RETRIES):
        try:
            response = bedrock.invoke_model(
                modelId=CLAUDE_MODEL_ID,
                body=body,
                contentType="application/json",
                accept="application/json",
            )
            payload = json.loads(response["body"].read())
            text = "".join(
                block.get("text", "")
                for block in payload.get("content", [])
                if block.get("type") == "text"
            ).strip()
            return parse_json_array(text)
        except ClientError as error:
            last_exception = error
            code = error.response.get("Error", {}).get("Code", "")
            if code in ("ThrottlingException", "ServiceUnavailableException"):
                wait = RETRY_BACKOFF_SECONDS * (2**attempt)
                print(f"  Throttled, retrying in {wait}s...")
                time.sleep(wait)
                continue
            raise

    raise RuntimeError(f"Claude question generation failed: {last_exception}")


def build_chunk_prompt(chunks: list[dict[str, Any]]) -> str:
    excerpts: list[str] = []
    for chunk in chunks:
        page = chunk.get("page_number")
        chunk_id = chunk.get("chunk_id")
        text = str(chunk.get("text", "")).strip()
        if not text:
            continue
        excerpts.append(f"--- page {page} | chunk {chunk_id} ---\n{text}")

    return f"""Create exam-format practice questions for the Alberta Basic Security Guard exam.

Return ONLY a JSON array. No markdown, no commentary.

Create 2-3 questions from the excerpts below. Use only what is stated in the excerpts.

Each question object MUST have exactly these keys:
- module: one of ["Use of Force","Patrol","Notebooks","Emergency Response"]
- type: "mcq" or "select-all"
- question: exam English wording
- simplified: plain-English version of the question (simpler words, shorter sentences)
- options: array of 4 answer options (strings)
- correctAnswers: for mcq: [index]. for select-all: [indices] (2 correct)
- explanation: plain-English explanation of why the correct answer(s) is right
- wrongAnswerExplanations: array same length as options, with null for correct options, and plain-English reason(s) each wrong option is wrong
- citation: object with page_number (int) and chunk_text (verbatim excerpt supporting the answer)
- image: null

Rules:
- For "select-all", ensure exactly 2 correct answers.
- Explanations should be short, direct, and easy to understand.
- Use a citation chunk_text taken verbatim from the excerpt(s) above (can be a short snippet).

Manual excerpts:
{chr(10).join(excerpts)}"""


def normalize_bedrock_question(item: dict[str, Any]) -> dict[str, Any] | None:
    try:
        module = str(item.get("module", "")).strip()
        qtype = str(item.get("type", "")).strip()
        question = str(item.get("question", "")).strip()
        simplified = str(item.get("simplified", "")).strip()
        options = item.get("options")
        correct = item.get("correctAnswers")
        explanation = str(item.get("explanation", "")).strip()
        wrong = item.get("wrongAnswerExplanations")
        citation = item.get("citation") or {}
        page_number = int(citation.get("page_number"))
        chunk_text = str(citation.get("chunk_text", "")).strip()
    except Exception:
        return None

    if module not in ("Use of Force", "Patrol", "Notebooks", "Emergency Response"):
        return None
    if qtype not in ("mcq", "select-all"):
        return None
    if not question or not simplified or not explanation or not chunk_text:
        return None
    if not isinstance(options, list) or len(options) != 4:
        return None
    if not isinstance(correct, list) or not correct:
        return None
    if not isinstance(wrong, list) or len(wrong) != 4:
        return None

    # validate indices
    if any((not isinstance(i, int) or i < 0 or i >= 4) for i in correct):
        return None
    if qtype == "mcq" and len(correct) != 1:
        return None
    if qtype == "select-all" and len(correct) != 2:
        return None

    # ensure wrong explanations null for correct indices
    for i in correct:
        if wrong[i] not in (None, "null"):
            # tolerate "null" string sometimes
            return None

    normalized_wrong: list[str | None] = []
    for entry in wrong:
        if entry is None:
            normalized_wrong.append(None)
        else:
            text = str(entry).strip()
            normalized_wrong.append(text if text else None)

    return {
        "module": module,
        "type": qtype,
        "question": question,
        "simplified": simplified,
        "options": [str(o) for o in options],
        "correctAnswers": correct,
        "explanation": explanation,
        "wrongAnswerExplanations": normalized_wrong,
        "citation": {"page_number": page_number, "chunk_text": chunk_text},
        "image": None,
    }


def generate_from_bedrock_chunks() -> list[dict[str, Any]]:
    random.seed(RNG_SEED)
    chunks = load_chunks()

    # Shuffle chunks so we cover more topics; cap to reduce token/cost.
    chunks = shuffle(chunks)[:200]
    batches = batched(chunks, BEDROCK_BATCH_SIZE)
    print(f"Generating questions from {len(chunks)} chunks ({len(batches)} batches)...")

    questions: list[dict[str, Any]] = []
    for batch_index, batch in enumerate(batches, start=1):
        print(f"Batch {batch_index}/{len(batches)}...")
        raw_items = invoke_claude(build_chunk_prompt(batch))
        for raw in raw_items:
            normalized = normalize_bedrock_question(raw)
            if normalized:
                questions.append(normalized)
        time.sleep(BEDROCK_SLEEP_SECONDS)

        if len(questions) >= TARGET_COUNT:
            break

    # Assign stable IDs after generation.
    for idx, q in enumerate(questions, start=1):
        q["id"] = f"q-{idx:04d}"

    return questions


def classify_module(term: str, definition: str) -> str:
    text = f"{term} {definition}".lower()
    if any(
        needle in text
        for needle in (
            "use of force",
            "force",
            "arrest",
            "assault",
            "offence",
            "criminal",
            "citizen",
            "reasonable grounds",
            "self-defence",
            "detain",
            "restrain",
        )
    ):
        return "Use of Force"
    if any(
        needle in text
        for needle in (
            "notebook",
            "notebooks",
            "report",
            "reporting",
            "radio",
            "10-code",
            "10-codes",
            "24-hour",
            "clock",
            "log",
            "evidence",
        )
    ):
        return "Notebooks"
    if any(
        needle in text
        for needle in (
            "patrol",
            "patrolling",
            "access control",
            "alarm",
            "key-holder",
            "site",
            "vehicle",
            "parking",
            "perimeter",
        )
    ):
        return "Patrol"
    if any(
        needle in text
        for needle in (
            "emergency",
            "fire",
            "medical",
            "evacuation",
            "hazard",
            "first aid",
            "cpr",
        )
    ):
        return "Emergency Response"
    # Keep everything in the four demo modules so the UI can show mastery bars.
    return "Patrol"


def build_mcq(
    index: int,
    entry: GlossaryEntry,
    distractors: list[GlossaryEntry],
) -> dict[str, Any]:
    option_entries = [entry] + distractors
    random.shuffle(option_entries)
    options = [item.definition for item in option_entries]
    correct_index = options.index(entry.definition)

    question = f'In the security guard manual, what does "{entry.term}" mean?'
    simplified = f'What is the best meaning of "{entry.term}"?'
    explanation = (
        f'"{entry.term}" means: {entry.definition} '
        "Pick the option that matches this definition."
    )

    wrong_explanations: list[str | None] = []
    for option_index, option_entry in enumerate(option_entries):
        if option_index == correct_index:
            wrong_explanations.append(None)
        else:
            wrong_explanations.append(
                f'This is not the meaning of "{entry.term}". '
                f'It describes "{option_entry.term}" instead.'
            )

    return {
        "id": f"q-{index:04d}",
        "module": classify_module(entry.term, entry.definition),
        "type": "mcq",
        "question": question,
        "simplified": simplified,
        "options": options,
        "correctAnswers": [correct_index],
        "explanation": explanation,
        "wrongAnswerExplanations": wrong_explanations,
        "citation": {
            "page_number": entry.page,
            "chunk_text": f'{entry.term}: {entry.definition}',
        },
        "image": None,
    }


def shuffle(items: list[Any]) -> list[Any]:
    copy = list(items)
    for i in range(len(copy) - 1, 0, -1):
        j = random.randint(0, i)
        copy[i], copy[j] = copy[j], copy[i]
    return copy


def build_select_all(
    index: int,
    module: str,
    correct_entries: list[GlossaryEntry],
    wrong_entries: list[GlossaryEntry],
) -> dict[str, Any]:
    # 2 correct + 2 wrong.
    options_entries = correct_entries[:2] + wrong_entries[:2]
    random.shuffle(options_entries)
    options = [e.term for e in options_entries]
    correct_terms = {e.term for e in correct_entries[:2]}
    correct_indices = [i for i, term in enumerate(options) if term in correct_terms]

    question = f"Select all terms that relate to the module: {module}."
    simplified = f"Pick all words that match: {module}."
    explanation = (
        "These terms show up in this module's content. "
        "Use the manual page citations to verify each term."
    )

    # Build a compact citation block by concatenating term definitions.
    citation_text = "\n".join(
        f"- {e.term} (page {e.page}): {e.definition}" for e in correct_entries[:2]
    )

    wrong_explanations: list[str | None] = []
    for option_entry in options_entries:
        if option_entry.term in correct_terms:
            wrong_explanations.append(None)
        else:
            wrong_explanations.append(
                f'"{option_entry.term}" is not a core term for {module} in this question. '
                "Use the manual pages in the citation block to verify which terms belong."
            )

    return {
        "id": f"q-{index:04d}",
        "module": module,
        "type": "select-all",
        "question": question,
        "simplified": simplified,
        "options": options,
        "correctAnswers": correct_indices,
        "explanation": explanation,
        "wrongAnswerExplanations": wrong_explanations,
        "citation": {
            "page_number": min(e.page for e in correct_entries[:2]),
            "chunk_text": citation_text,
        },
        "image": None,
    }


def generate_from_glossary() -> list[dict[str, Any]]:
    random.seed(RNG_SEED)
    glossary = load_glossary()

    # Choose a stable slice so repeated runs are deterministic.
    selected = glossary[: max(TARGET_COUNT, 80)]

    # Build MCQs.
    questions: list[dict[str, Any]] = []
    for idx, entry in enumerate(selected[: TARGET_COUNT - 8], start=1):
        pool = [e for e in glossary if e.term != entry.term]
        distractors = random.sample(pool, k=3)
        questions.append(build_mcq(idx, entry, distractors))

    # Add a handful of select-all questions so Knowledge Checks can demo the format.
    by_module: dict[str, list[GlossaryEntry]] = {}
    for entry in glossary:
        by_module.setdefault(classify_module(entry.term, entry.definition), []).append(entry)

    next_id = len(questions) + 1
    for module in ("Use of Force", "Patrol", "Notebooks", "Emergency Response"):
        entries = by_module.get(module, [])
        if len(entries) < 6:
            continue
        correct = entries[:2]
        wrong_pool = [e for m, items in by_module.items() if m != module for e in items]
        wrong = random.sample(wrong_pool, k=2)
        questions.append(build_select_all(next_id, module, correct, wrong))
        next_id += 1

    return questions


def validate(questions: list[dict[str, Any]]) -> None:
    if len(questions) < 80:
        raise RuntimeError("Question bank must contain at least 80 questions.")

    for q in questions:
        if not q.get("id") or not q.get("module") or not q.get("question"):
            raise RuntimeError(f"Invalid question missing required fields: {q}")
        options = q.get("options") or []
        correct = q.get("correctAnswers") or []
        wrong = q.get("wrongAnswerExplanations")
        if not isinstance(options, list) or len(options) < 2:
            raise RuntimeError(f"Invalid options for {q.get('id')}")
        if not isinstance(correct, list) or not correct:
            raise RuntimeError(f"Missing correctAnswers for {q.get('id')}")
        if any((not isinstance(i, int) or i < 0 or i >= len(options)) for i in correct):
            raise RuntimeError(f"correctAnswers out of range for {q.get('id')}")
        if wrong is not None:
            if not isinstance(wrong, list) or len(wrong) != len(options):
                raise RuntimeError(
                    f"wrongAnswerExplanations must be array of length options for {q.get('id')}"
                )
        citation = q.get("citation") or {}
        if "page_number" not in citation or "chunk_text" not in citation:
            raise RuntimeError(f"Missing citation for {q.get('id')}")


def main() -> None:
    if QUESTION_GEN_MODE == "bedrock":
        try:
            questions = generate_from_bedrock_chunks()
        except (FileNotFoundError, ValueError, RuntimeError) as error:
            print(f"Bedrock generation failed ({error}). Falling back to glossary.")
            questions = generate_from_glossary()
    else:
        questions = generate_from_glossary()
    validate(questions)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as file:
        json.dump(questions, file, ensure_ascii=False, indent=2)
        file.write("\n")

    print(f"Wrote {len(questions)} questions to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()

