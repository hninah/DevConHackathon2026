"""
extract_glossary.py

Builds a frontend glossary from the embedded manual chunks by asking Claude to
extract Canadian security guard legal/procedural terms with short definitions.

Usage:
    python scripts/extract_glossary.py
"""

import json
import os
import time
from pathlib import Path
from typing import Any

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv


BACKEND_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_ROOT.parent

load_dotenv(BACKEND_ROOT / ".env")

AWS_REGION = os.getenv("AWS_REGION", "us-west-2")
CLAUDE_MODEL_ID = os.getenv("CLAUDE_MODEL_ID", "us.anthropic.claude-sonnet-4-6")
CHUNKS_PATH = BACKEND_ROOT / os.getenv("CHUNKS_OUTPUT_PATH", "data/chunks.json")
OUTPUT_PATH = PROJECT_ROOT / "frontend" / "public" / "glossary.json"

BATCH_SIZE = 10
MAX_OUTPUT_TOKENS = 1500
SLEEP_BETWEEN_CALLS_SECONDS = 0.2
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 2

bedrock = boto3.client("bedrock-runtime", region_name=AWS_REGION)


def load_chunks() -> list[dict[str, Any]]:
    """Load the embedded chunk store generated in Phase 3."""
    if not CHUNKS_PATH.exists():
        raise FileNotFoundError(
            f"Chunks file not found at {CHUNKS_PATH}. Run Phase 3 first."
        )

    with open(CHUNKS_PATH, "r", encoding="utf-8") as file:
        chunks = json.load(file)

    if not chunks:
        raise ValueError("chunks.json is empty.")
    return chunks


def batched(items: list[dict[str, Any]], size: int) -> list[list[dict[str, Any]]]:
    """Split items into fixed-size batches."""
    return [items[index:index + size] for index in range(0, len(items), size)]


def build_prompt(chunks: list[dict[str, Any]]) -> str:
    """Build the glossary extraction prompt for one batch of chunks."""
    excerpts = []
    for chunk in chunks:
        excerpts.append(
            f"--- page {chunk['page_number']} | chunk {chunk['chunk_id']} ---\n"
            f"{chunk['text']}"
        )

    return f"""Extract glossary entries from these Alberta Basic Security Training manual excerpts.

Return ONLY a JSON array. Do not add markdown, comments, or surrounding prose.

Each object must have exactly:
- "term": a Canadian security guard legal/procedural concept, not a generic English word
- "definition": one plain-English sentence useful to an ESL student studying for the exam
- "page": the manual page number where the concept appears

Good terms include examples like "citizen's arrest", "use of force",
"indictable offence", "reasonable grounds", "duty of care", and
"continuity of evidence".

Manual excerpts:
{chr(10).join(excerpts)}"""


def invoke_claude(prompt: str) -> list[dict[str, Any]]:
    """Ask Claude for glossary entries and parse its JSON array response."""
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": MAX_OUTPUT_TOKENS,
        "messages": [{
            "role": "user",
            "content": prompt,
        }],
    })

    last_exception = None
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
                wait = RETRY_BACKOFF_SECONDS * (2 ** attempt)
                print(f"  Throttled, retrying in {wait}s...")
                time.sleep(wait)
                continue
            raise

    raise RuntimeError(f"Claude glossary extraction failed: {last_exception}")


def parse_json_array(text: str) -> list[dict[str, Any]]:
    """Parse a JSON array, tolerating accidental text around it."""
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        start = text.find("[")
        end = text.rfind("]")
        if start == -1 or end == -1 or end <= start:
            raise
        value = json.loads(text[start:end + 1])

    if not isinstance(value, list):
        raise ValueError("Claude did not return a JSON array.")
    return [item for item in value if isinstance(item, dict)]


def normalize_entry(entry: dict[str, Any]) -> dict[str, Any] | None:
    """Validate and normalize one glossary entry."""
    term = str(entry.get("term", "")).strip()
    definition = str(entry.get("definition", "")).strip()
    page = entry.get("page")

    if not term or not definition or page is None:
        return None

    try:
        page_number = int(page)
    except (TypeError, ValueError):
        return None

    return {
        "term": term,
        "definition": definition,
        "page": page_number,
    }


def dedupe_entries(entries: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Dedupe by lowercased term, keeping the earliest page."""
    by_term: dict[str, dict[str, Any]] = {}

    for entry in entries:
        normalized = normalize_entry(entry)
        if normalized is None:
            continue

        key = normalized["term"].lower()
        current = by_term.get(key)
        if current is None or normalized["page"] < current["page"]:
            by_term[key] = normalized

    return sorted(by_term.values(), key=lambda item: item["term"].lower())


def write_glossary(entries: list[dict[str, Any]]) -> None:
    """Write glossary entries to the Vite public folder."""
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as file:
        json.dump(entries, file, ensure_ascii=False, indent=2)
        file.write("\n")


def main() -> None:
    """Extract, dedupe, and write glossary entries."""
    chunks = load_chunks()
    batches = batched(chunks, BATCH_SIZE)
    print(f"Loaded {len(chunks)} chunks. Processing {len(batches)} batches...")

    raw_entries: list[dict[str, Any]] = []
    for index, batch in enumerate(batches, start=1):
        print(f"Batch {index}/{len(batches)}...")
        raw_entries.extend(invoke_claude(build_prompt(batch)))
        time.sleep(SLEEP_BETWEEN_CALLS_SECONDS)

    entries = dedupe_entries(raw_entries)
    write_glossary(entries)

    pages = [entry["page"] for entry in entries]
    page_range = f"{min(pages)}-{max(pages)}" if pages else "n/a"
    print(
        f"Wrote {len(entries)} unique glossary entries to {OUTPUT_PATH}. "
        f"Page range: {page_range}."
    )

    if len(entries) < 30:
        raise RuntimeError("Glossary has fewer than 30 entries.")


if __name__ == "__main__":
    main()
