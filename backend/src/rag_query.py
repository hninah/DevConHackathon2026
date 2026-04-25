"""
rag_query.py

Reusable RAG tutor pipeline for SecurePass.

The tutor accepts a question in any typed language, retrieves relevant Alberta
Basic Security Training manual chunks, and answers only in simplified English.
The Claude response is streamed in a structured envelope so callers can show the
answer live while still receiving citations, exam priority, glossary terms, and
an optional SVG diagram. Separately, Pollinations.ai can generate a text-free
photorealistic scene image for situational context.

Usage:
    python src/rag_query.py "When am I allowed to physically restrain someone?"
    python src/rag_query.py "ਮੈਂ ਕਿਸੇ ਨੂੰ ਕਦੋਂ ਰੋਕ ਸਕਦਾ ਹਾਂ?" --input-language-hint Punjabi
    python src/rag_query.py "Show me excessive force" --include-scene-image always --write-scene-png output/scene.png
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import sys
import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any, Literal, TypedDict

import boto3
import numpy as np
from botocore.exceptions import ClientError
from dotenv import load_dotenv

from scene_image_pollinations import generate_scene_png_b64

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

BACKEND_ROOT = Path(__file__).resolve().parents[1]
load_dotenv(BACKEND_ROOT / ".env")

AWS_REGION = os.getenv("AWS_REGION", "us-west-2")
CLAUDE_MODEL_ID = os.getenv("CLAUDE_MODEL_ID", "us.anthropic.claude-sonnet-4-6")
TITAN_EMBED_MODEL_ID = os.getenv(
    "TITAN_EMBED_MODEL_ID",
    "amazon.titan-embed-text-v2:0",
)

CHUNKS_PATH_ENV = os.getenv("CHUNKS_OUTPUT_PATH", "data/chunks.json")
CHUNKS_PATH = (
    Path(CHUNKS_PATH_ENV)
    if Path(CHUNKS_PATH_ENV).is_absolute()
    else BACKEND_ROOT / CHUNKS_PATH_ENV
)

EMBEDDING_DIMENSIONS = 1024
TOP_K = 5
MAX_OUTPUT_TOKENS = 1800
MAX_IMAGE_BYTES = 1_000_000
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 2

VALID_DIAGRAM_MODES = {"auto", "always", "never"}
VALID_SCENE_IMAGE_MODES = {"auto", "always", "never"}
PRIORITY_VALUES = {"HIGH", "MEDIUM", "BACKGROUND"}


class Citation(TypedDict):
    """Manual chunk citation returned to frontend clients."""

    page_number: int
    chunk_text: str
    chunk_id: int
    score: float


class GlossaryTerm(TypedDict):
    """ELI5 glossary item extracted from a tutor answer."""

    term: str
    plain_english_definition: str
    page_number: int | None


class TutorResult(TypedDict):
    """Final structured response returned by the RAG tutor."""

    answer: str
    svg: str | None
    scene_png_b64: str | None
    scene_image_prompt: str | None
    scene_image_error: str | None
    citations: list[Citation]
    priority: Literal["HIGH", "MEDIUM", "BACKGROUND"]
    priority_rationale: str
    glossary_terms: list[GlossaryTerm]


class StreamEvent(TypedDict):
    """Typed event emitted by the reusable RAG answer pipeline."""

    type: Literal[
        "citations",
        "scene_image",
        "token",
        "svg",
        "priority",
        "priority_rationale",
        "glossary_terms",
        "done",
    ]
    data: Any


# ---------------------------------------------------------------------------
# Bedrock client and chunk cache
# ---------------------------------------------------------------------------

bedrock = boto3.client("bedrock-runtime", region_name=AWS_REGION)
_chunk_cache: tuple[list[dict[str, Any]], np.ndarray] | None = None


def load_chunk_store(path: Path = CHUNKS_PATH) -> tuple[list[dict[str, Any]], np.ndarray]:
    """Load chunk metadata and embeddings from the Phase 3 JSON vector store."""
    global _chunk_cache

    if _chunk_cache is not None:
        return _chunk_cache

    if not path.exists():
        raise FileNotFoundError(
            f"Chunks file not found at {path.resolve()}. "
            "Run Phase 3 first: scripts/chunk_manual.py, then scripts/embed_chunks.py."
        )

    with open(path, "r", encoding="utf-8") as file:
        chunks = json.load(file)

    if not chunks:
        raise ValueError(f"No chunks found in {path.resolve()}. Re-run Phase 3.")

    embeddings = []
    for chunk in chunks:
        embedding = chunk.get("embedding")
        if not embedding:
            raise ValueError(
                f"Chunk {chunk.get('chunk_id')} has no embedding. "
                "Run scripts/embed_chunks.py before querying."
            )
        if len(embedding) != EMBEDDING_DIMENSIONS:
            raise ValueError(
                f"Chunk {chunk.get('chunk_id')} embedding has length "
                f"{len(embedding)}, expected {EMBEDDING_DIMENSIONS}."
            )
        embeddings.append(embedding)

    chunk_matrix = np.asarray(embeddings, dtype=np.float32)
    _chunk_cache = (chunks, chunk_matrix)
    return _chunk_cache


# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------

def embed_text(text: str) -> np.ndarray:
    """Embed text with Titan Embeddings v2."""
    body = json.dumps({
        "inputText": text,
        "dimensions": EMBEDDING_DIMENSIONS,
        "normalize": True,
    })

    last_exception = None
    for attempt in range(MAX_RETRIES):
        try:
            response = bedrock.invoke_model(
                modelId=TITAN_EMBED_MODEL_ID,
                body=body,
                contentType="application/json",
                accept="application/json",
            )
            payload = json.loads(response["body"].read())
            return np.asarray(payload["embedding"], dtype=np.float32)
        except ClientError as error:
            last_exception = error
            error_code = error.response.get("Error", {}).get("Code", "")
            if error_code in ("ThrottlingException", "ServiceUnavailableException"):
                wait = RETRY_BACKOFF_SECONDS * (2 ** attempt)
                print(f"  Throttled, retrying in {wait}s...", file=sys.stderr)
                time.sleep(wait)
                continue
            raise

    raise RuntimeError(f"Embedding failed after {MAX_RETRIES} retries: {last_exception}")


def retrieve_top_k(
    question_vec: np.ndarray,
    chunk_matrix: np.ndarray,
    chunks: list[dict[str, Any]],
    k: int,
) -> list[dict[str, Any]]:
    """Retrieve the k most similar chunks by dot product."""
    if k <= 0:
        raise ValueError("top_k must be greater than 0.")

    capped_k = min(k, len(chunks))
    scores = chunk_matrix @ question_vec
    top_indices = np.argpartition(scores, -capped_k)[-capped_k:]
    sorted_indices = top_indices[np.argsort(scores[top_indices])[::-1]]

    retrieved = []
    for index in sorted_indices:
        chunk = chunks[int(index)].copy()
        chunk["score"] = float(scores[index])
        retrieved.append(chunk)

    return retrieved


def build_citations(retrieved: list[dict[str, Any]]) -> list[Citation]:
    """Convert retrieved chunks into the F4 citation payload."""
    return [
        {
            "page_number": int(chunk["page_number"]),
            "chunk_text": str(chunk["text"]),
            "chunk_id": int(chunk.get("chunk_id", index)),
            "score": float(chunk.get("score", 0.0)),
        }
        for index, chunk in enumerate(retrieved)
    ]


# ---------------------------------------------------------------------------
# Pollinations: runtime scene images (text-free, photorealistic)
# ---------------------------------------------------------------------------


def normalize_scene_image_mode(mode: str | None) -> str:
    """Normalize include_scene_image to auto, always, or never."""
    m = (mode or "auto").strip().lower()
    if m not in VALID_SCENE_IMAGE_MODES:
        raise ValueError("include_scene_image must be one of: auto, always, never.")
    return m


def _retrieval_text_snippet(retrieved: list[dict[str, Any]], max_chars: int = 2000) -> str:
    """Short joined text from top chunks for keyword routing."""
    parts: list[str] = []
    total = 0
    for chunk in retrieved:
        t = str(chunk.get("text", ""))
        if not t:
            continue
        take = t[: min(len(t), max_chars - total)]
        parts.append(take)
        total += len(take)
        if total >= max_chars:
            break
    return " ".join(parts)


def infer_scene_topic(
    include_scene_image: str,
    question: str,
    retrieved: list[dict[str, Any]],
) -> str | None:
    """Route the requested image to a stable, explicit visual topic."""
    if include_scene_image == "never":
        return None

    q = question.strip().lower()
    blob = (q + " " + _retrieval_text_snippet(retrieved).lower())

    # First trust the student's question. Retrieved chunks often mention related
    # topics (for example patrol pages mention exits), which can otherwise hijack
    # the visual route.
    if any(k in q for k in ("evacuation", "evacuate", "fire exit", "escape route")):
        return "evacuation"
    if any(
        k in q
        for k in (
            "angry",
            "yelling",
            "hostile",
            "de-escalation",
            "deescalation",
            "calm down",
            "customer",
        )
    ):
        return "deescalation"
    if any(k in q for k in ("patrol", "positioning", "floor plan", "route")):
        return "patrol"
    if any(
        k in q
        for k in (
            "notebook",
            "report",
            "evidence",
            "chain of custody",
            "incident report",
        )
    ):
        return "notebook"

    if any(
        k in blob
        for k in (
            "excessive force",
            "too much force",
            "restrain",
            "restraining",
            "reasonable force",
            "self-defence",
            "self defense",
            "citizen",
            "arrest",
            "use of force",
            "section 26",
        )
    ) or "force" in q:
        return "force"
    if any(
        k in blob
        for k in ("evacuation", "fire exit", "emergency", "escape route", "delirium")
    ):
        return "evacuation"
    if any(
        k in blob
        for k in (
            "angry",
            "yelling",
            "hostile",
            "de-escalation",
            "deescalation",
            "escalating",
            "composure",
        )
    ):
        return "deescalation"
    if any(k in blob for k in ("patrol", "positioning", "floor plan", "route")):
        return "patrol"
    if any(
        k in blob
        for k in (
            "notebook",
            "report",
            "evidence",
            "chain of custody",
            "incident report",
        )
    ):
        return "notebook"
    if include_scene_image == "always":
        return "generic"
    return None


def build_scene_image_prompt(
    include_scene_image: str,
    question: str,
    retrieved: list[dict[str, Any]],
) -> str | None:
    """Return a scene image prompt, or None if auto mode should skip the image."""
    mode = include_scene_image
    if mode == "never":
        return None

    topic = infer_scene_topic(mode, question, retrieved)
    if topic is None:
        return None

    critical_rules = (
        "\n\nCritical requirements:\n"
        "- No text, words, letters, numbers, signage, or labels anywhere in the image\n"
        "- No logos or brand names on uniforms, products, fixtures, or background\n"
        "- No blood, no weapons, no graphic injury\n"
        "- Both figures fully visible, faces and body language clearly readable\n"
        "- Documentary photography, realistic colors, neutral lighting\n"
        "- 16:9 landscape orientation"
    )

    if topic == "force":
        return (
            "A photorealistic documentary-style image of a security guard inside a generic "
            "retail store during the day.\n\n"
            "The guard is wearing a plain dark uniform with no visible logos, badges, or text. "
            "The guard is mid-action: leaning forward aggressively, one hand firmly gripping "
            "the upper arm of a customer, the other hand raised in a controlling gesture. "
            "The guard's facial expression shows tension and anger, not professionalism.\n\n"
            "The customer is mid-30s in casual clothing, clearly smaller in build than the guard. "
            "The customer's posture is defensive: leaning away, free arm raised in a stop gesture, "
            "face showing surprise and discomfort. The customer is not resisting and is not holding anything.\n\n"
            "The contrast between the guard's overly forceful grip and the customer's non-threatening "
            "posture is the focal point of the image. A viewer should immediately recognize that "
            "the guard's response is disproportionate to the situation.\n\n"
            "Setting: a generic retail store interior, blurred shelves of merchandise in the background, "
            "neutral fluorescent lighting. One or two bystanders are visible in the deep background, watching "
            "with concerned expressions.\n\n"
            "Style: documentary photography, sharp focus on both figures, realistic colors, neutral lighting, "
            "mid-shot framing showing both figures from head to mid-thigh."
            f"{critical_rules}"
        )

    if topic == "patrol":
        return (
            "A photorealistic documentary-style image of a security guard walking a patrol route "
            "inside a generic indoor shopping mall during the day.\n\n"
            "The guard is wearing a plain dark uniform with no visible logos, badges, or text. "
            "The guard is mid-stride with relaxed shoulders, hands visible, and eyes scanning "
            "the public space professionally. Shoppers are spread out in the background at a safe distance.\n\n"
            "Setting: wide mall corridor, blurred storefronts and benches, neutral fluorescent lighting, "
            "clean floor, calm public environment.\n\n"
            "Style: documentary photography, sharp focus on the guard, slight depth of field, "
            "realistic colors, neutral mood."
            f"{critical_rules}"
        )

    if topic == "deescalation":
        return (
            "A photorealistic image of a security guard inside a retail store.\n\n"
            "The guard is wearing a dark uniform with no visible logos, badge, or text on the clothing. "
            "The guard is standing calmly with their arms relaxed at their sides, facing a customer.\n\n"
            "The customer is mid-30s, wearing casual clothing, visibly angry: mouth open mid-shout, "
            "one arm raised and pointing at the guard, body leaning forward aggressively. The customer "
            "is not holding anything.\n\n"
            "Setting: a generic retail store interior, daytime, fluorescent lighting, blurred shelves "
            "of merchandise in the background. Other shoppers are visible in the background looking "
            "concerned but at a distance.\n\n"
            "Style: documentary photography, sharp focus on both figures, slight depth of field, "
            "realistic colors, neutral mood. The composition shows the contrast between the animated "
            "customer and the calm guard."
            f"{critical_rules}"
        )

    if topic == "evacuation":
        return (
            "A photorealistic documentary-style image of a security guard helping people leave "
            "a public retail building in an orderly way.\n\n"
            "The guard is wearing a plain dark uniform with no visible logos, badges, or text. "
            "The guard stands near a wide open doorway and uses one open hand to calmly show the "
            "direction of travel. Several adults walk together in the background with calm body language.\n\n"
            "Setting: bright public building lobby connected to a retail store, neutral lighting, "
            "clear walking path, no smoke or damage.\n\n"
            "Style: documentary photography, wide shot, realistic colors, calm workplace training tone."
            f"{critical_rules}"
        )

    if topic == "notebook":
        return (
            "A photorealistic documentary-style image of a security guard writing notes in a "
            "plain notebook at a small desk in a back office.\n\n"
            "The guard is wearing a plain dark uniform with no visible logos, badges, or text. "
            "The notebook pages are blank from the viewer's perspective with no readable writing. "
            "A plain envelope and a small generic camera sit on the desk.\n\n"
            "Setting: simple back office, neutral lighting, tidy desk, plain walls, professional mood.\n\n"
            "Style: documentary photography, mid-shot framing, realistic colors, calm workplace training tone."
            f"{critical_rules}"
        )

    if topic == "generic":
        return (
            "A photorealistic documentary-style image of a security guard standing inside a "
            "generic retail store during the day.\n\n"
            "The guard is wearing a plain dark uniform with no visible logos, badges, or text. "
            "The guard has a calm, professional posture with relaxed shoulders and open hands. "
            "A customer stands nearby at a comfortable distance in casual clothing.\n\n"
            "Setting: generic retail store interior, blurred shelves of merchandise in the background, "
            "neutral fluorescent lighting, calm shoppers in the distance.\n\n"
            "Style: documentary photography, mid-shot framing, realistic colors, neutral mood."
            f"{critical_rules}"
        )
    return None


def try_generate_runtime_scene(
    include_scene_image: str,
    question: str,
    retrieved: list[dict[str, Any]],
) -> tuple[str | None, str | None, str | None]:
    """Return (base64_png, prompt, error). Skips on never or when auto has no topic."""
    try:
        mode = normalize_scene_image_mode(include_scene_image)
    except ValueError as e:
        return None, None, str(e)
    if mode == "never":
        return None, None, None
    try:
        prompt = build_scene_image_prompt(mode, question, retrieved)
    except (ValueError, TypeError) as e:
        return None, None, str(e)
    if not prompt:
        return None, None, None
    try:
        png, used_prompt = generate_scene_png_b64(prompt)
        return png, used_prompt, None
    except (OSError, ValueError, TypeError, RuntimeError) as e:
        return None, prompt, str(e)


# ---------------------------------------------------------------------------
# Prompt builders
# ---------------------------------------------------------------------------

def build_system_prompt(include_diagram: str) -> str:
    """Build the locked simplified-English tutor system prompt."""
    diagram_rule = {
        "always": (
            "You MUST include an SVG diagram in the <svg> block. Never write "
            "NONE. If you are unsure what to draw, make a simple labelled "
            "ladder, flowchart, or scene map from the answer."
        ),
        "never": "You MUST write NONE in the <svg> block.",
        "auto": (
            "Include an SVG diagram in the <svg> block only when a picture helps. "
            "Good diagram topics: use-of-force ladder, citizen's-arrest decision "
            "tree, patrol layout, escape route, evidence chain."
        ),
    }[include_diagram]

    return f"""You are an exam coach for the Alberta Basic Security Guard
certification. The provincial exam is written in English. Your student reads at
CLB 5 and is ESL. They find legal terms hard.

Style rule (most important): EXPLAIN LIKE THE STUDENT IS 5 YEARS OLD.
Short sentences. Common words a child knows. No idioms. No slang. No legal
Latin. Do not use words like "shall", "may", "thereof", "pursuant to", or
"in accordance with". If a 10-year-old would not understand a word, do not use
it without a gloss in parentheses.

ELI5 example of the style:
- Manual says: "A peace officer or other person may arrest without warrant a
  person whom he finds committing an indictable offence."
- You say: "You can hold someone if you see them doing a serious crime. A
  serious crime is a big crime, like stealing a car or hurting someone. You
  hold them until the police come."

Rules:
1. ALWAYS answer in simplified English at this ELI5 level.
2. Never translate the answer into another language, even if the student writes
   in another language.
3. Use ONLY the manual excerpts from the user message. If the answer is not in
   the excerpts, say "The manual does not cover this" in <answer> and use
   BACKGROUND priority.
4. Cite manual page numbers for every specific claim. Example: "(see page 47)".
5. The first time you use any legal or technical term, add a one-sentence ELI5
   gloss in parentheses. Example: "citizen's arrest (you holding someone until
   police come)".
6. Keep <answer> to 4-8 short sentences when possible.
7. {diagram_rule}

Return EXACTLY this envelope. Do not add markdown before or after it:

<answer>
The student-facing answer text only.
</answer>
<diagram>
NONE or one safe inline SVG string. The SVG must use only these elements:
svg, g, rect, circle, line, polyline, polygon, path, text, title, desc.
Use simplified-English labels inside <text> elements. Do not use script,
foreignObject, external href, style tags, or event attributes.
Use ASCII text only inside the SVG. Do not use emoji, warning symbols, or XML
comments.
If the diagram mode is "always", do not write NONE. A minimal valid SVG is:
<svg viewBox="0 0 400 180" xmlns="http://www.w3.org/2000/svg">
  <title>Simple use of force ladder</title>
  <rect x="30" y="120" width="90" height="35"/>
  <text x="40" y="143">Talk first</text>
  <rect x="155" y="75" width="90" height="35"/>
  <text x="165" y="98">Small force</text>
  <rect x="280" y="30" width="90" height="35"/>
  <text x="290" y="53">Stop danger</text>
</svg>
</diagram>
<priority>
HIGH | MEDIUM | BACKGROUND
</priority>
<priority_rationale>
One short ELI5 sentence explaining why this topic matters for the exam.
</priority_rationale>
<glossary_terms>
JSON array only. Each item must have:
{{"term": "...", "plain_english_definition": "...", "page_number": 47}}
Include legal or technical terms used in <answer>. Use [] if none.
</glossary_terms>"""


def build_text_content(
    question: str,
    retrieved: list[dict[str, Any]],
    input_language_hint: str | None,
    include_diagram: str,
) -> str:
    """Build the text part of the Claude user message."""
    excerpt_blocks = []
    for excerpt_number, chunk in enumerate(retrieved, start=1):
        excerpt_blocks.append(
            f"--- Excerpt {excerpt_number} | page {chunk['page_number']} "
            f"| chunk {chunk.get('chunk_id')} ---\n{chunk['text']}"
        )

    hint = input_language_hint or "unknown or English"
    return f"""Student input language hint: {hint}
Diagram mode: {include_diagram}

Student question:
{question}

Manual excerpts:
{chr(10).join(excerpt_blocks)}"""


def build_claude_content(
    question: str,
    retrieved: list[dict[str, Any]],
    input_language_hint: str | None,
    include_diagram: str,
    image_b64: str | None,
) -> list[dict[str, Any]]:
    """Build a Claude multimodal user content payload."""
    content: list[dict[str, Any]] = [{
        "type": "text",
        "text": build_text_content(
            question=question,
            retrieved=retrieved,
            input_language_hint=input_language_hint,
            include_diagram=include_diagram,
        ),
    }]

    if image_b64:
        content.append({
            "type": "image",
            "source": {
                "type": "base64",
                "media_type": "image/jpeg",
                "data": image_b64,
            },
        })
        content.append({
            "type": "text",
            "text": (
                "The attached image is a manual page or student photo. Read it, "
                "but still answer only from the image plus retrieved manual "
                "excerpts. Keep output in the required envelope."
            ),
        })

    return content


# ---------------------------------------------------------------------------
# Claude streaming and parsing
# ---------------------------------------------------------------------------

def stream_claude(system_prompt: str, content: list[dict[str, Any]]) -> Iterator[str]:
    """Stream a Claude response from Bedrock as text tokens."""
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": MAX_OUTPUT_TOKENS,
        "system": system_prompt,
        "messages": [{
            "role": "user",
            "content": content,
        }],
    })

    response = bedrock.invoke_model_with_response_stream(
        modelId=CLAUDE_MODEL_ID,
        body=body,
        contentType="application/json",
        accept="application/json",
    )

    stop_reason = None
    for event in response["body"]:
        if "chunk" not in event:
            continue

        payload = json.loads(event["chunk"]["bytes"])
        event_type = payload.get("type")

        if event_type == "content_block_delta":
            delta = payload.get("delta", {})
            if delta.get("type") == "text_delta":
                yield delta.get("text", "")
        elif event_type == "message_delta":
            stop_reason = payload.get("delta", {}).get("stop_reason")

    if stop_reason == "max_tokens":
        yield "\n\n[Response stopped at the configured token limit.]"


def extract_tag(text: str, tag: str) -> str:
    """Extract a tagged block from Claude's envelope."""
    pattern = rf"<{tag}>\s*(.*?)\s*</{tag}>"
    match = re.search(pattern, text, flags=re.DOTALL | re.IGNORECASE)
    return match.group(1).strip() if match else ""


def parse_priority(value: str) -> Literal["HIGH", "MEDIUM", "BACKGROUND"]:
    """Normalize Claude's priority value."""
    normalized = value.strip().upper()
    if normalized in PRIORITY_VALUES:
        return normalized  # type: ignore[return-value]
    return "BACKGROUND"


def parse_svg(value: str) -> str | None:
    """Return the SVG block when present."""
    stripped = value.strip()
    if not stripped or stripped.upper() == "NONE":
        return None
    if "<svg" not in stripped.lower() or "</svg>" not in stripped.lower():
        return None
    return stripped


def extract_diagram_value(raw_text: str) -> str:
    """Extract the diagram envelope without being confused by inner SVG tags."""
    value = extract_tag(raw_text, "diagram")
    if value:
        return value

    # Backwards-compatible fallback for the earlier <svg> wrapper shape.
    start_match = re.search(r"<svg>\s*", raw_text, flags=re.IGNORECASE)
    end_match = re.search(r"\s*</svg>\s*<priority>", raw_text, flags=re.IGNORECASE)
    if not start_match or not end_match:
        return ""
    return raw_text[start_match.end():end_match.start()].strip()


def parse_glossary_terms(value: str) -> list[GlossaryTerm]:
    """Parse and normalize the glossary_terms JSON array."""
    if not value.strip():
        return []

    try:
        raw = json.loads(value)
    except json.JSONDecodeError:
        start = value.find("[")
        end = value.rfind("]")
        if start == -1 or end == -1 or end <= start:
            return []
        try:
            raw = json.loads(value[start:end + 1])
        except json.JSONDecodeError:
            return []

    if not isinstance(raw, list):
        return []

    terms: list[GlossaryTerm] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        term = str(item.get("term", "")).strip()
        definition = str(item.get("plain_english_definition", "")).strip()
        page = item.get("page_number")
        if not term or not definition:
            continue
        try:
            page_number = int(page) if page is not None else None
        except (TypeError, ValueError):
            page_number = None
        terms.append({
            "term": term,
            "plain_english_definition": definition,
            "page_number": page_number,
        })

    return terms


def parse_tutor_result(raw_text: str, citations: list[Citation]) -> TutorResult:
    """Parse Claude's structured envelope into the frontend response shape."""
    answer = extract_tag(raw_text, "answer").strip()
    if not answer:
        answer = raw_text.strip()

    return {
        "answer": answer,
        "svg": parse_svg(extract_diagram_value(raw_text)),
        "scene_png_b64": None,
        "scene_image_prompt": None,
        "scene_image_error": None,
        "citations": citations,
        "priority": parse_priority(extract_tag(raw_text, "priority")),
        "priority_rationale": extract_tag(raw_text, "priority_rationale"),
        "glossary_terms": parse_glossary_terms(extract_tag(raw_text, "glossary_terms")),
    }


def stream_answer_tokens(raw_stream: Iterator[str]) -> Iterator[tuple[str, str | None]]:
    """Yield clean answer tokens while accumulating Claude's full envelope.

    The parser streams only text inside <answer> and keeps a small rolling buffer
    so the closing </answer> tag is never emitted to the caller.
    """
    full_text = ""
    state = "before_answer"
    answer_hold = ""
    closing_tag = "</answer>"
    keep_chars = len(closing_tag) - 1

    for token in raw_stream:
        full_text += token

        if state == "before_answer":
            start_index = full_text.lower().find("<answer>")
            if start_index == -1:
                continue
            state = "in_answer"
            answer_hold = full_text[start_index + len("<answer>"):]
        elif state == "in_answer":
            answer_hold += token

        if state != "in_answer":
            continue

        end_index = answer_hold.lower().find(closing_tag)
        if end_index != -1:
            emit_text = answer_hold[:end_index]
            if emit_text:
                yield full_text, emit_text
            state = "after_answer"
            answer_hold = ""
            continue

        if len(answer_hold) > keep_chars:
            emit_text = answer_hold[:-keep_chars]
            answer_hold = answer_hold[-keep_chars:]
            if emit_text:
                yield full_text, emit_text

    if state == "in_answer" and answer_hold:
        yield full_text, answer_hold
    else:
        yield full_text, None


# ---------------------------------------------------------------------------
# Public tutor pipeline
# ---------------------------------------------------------------------------

def normalize_diagram_mode(include_diagram: str | None) -> str:
    """Normalize include_diagram to auto, always, or never."""
    mode = (include_diagram or "auto").strip().lower()
    if mode not in VALID_DIAGRAM_MODES:
        raise ValueError("include_diagram must be one of: auto, always, never.")
    return mode


def validate_image_b64(image_b64: str | None) -> None:
    """Validate optional JPEG image payload size."""
    if not image_b64:
        return

    try:
        image_bytes = base64.b64decode(image_b64, validate=True)
    except ValueError as error:
        raise ValueError("image_b64 must be valid base64.") from error

    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError("image_b64 must decode to 1 MB or less.")


def answer_question(
    question: str,
    input_language_hint: str | None = None,
    top_k: int = TOP_K,
    image_b64: str | None = None,
    include_diagram: str | None = "auto",
    include_scene_image: str | None = "auto",
) -> Iterator[StreamEvent]:
    """Answer a student question as typed stream events."""
    if not question.strip():
        raise ValueError("question cannot be empty.")

    diagram_mode = normalize_diagram_mode(include_diagram)
    scene_mode = normalize_scene_image_mode(include_scene_image)
    validate_image_b64(image_b64)

    chunks, chunk_matrix = load_chunk_store()
    question_vec = embed_text(question)
    retrieved = retrieve_top_k(question_vec, chunk_matrix, chunks, top_k)
    citations = build_citations(retrieved)

    yield {
        "type": "citations",
        "data": citations,
    }

    scene_png, scene_prompt, scene_err = try_generate_runtime_scene(
        scene_mode,
        question,
        retrieved,
    )
    yield {
        "type": "scene_image",
        "data": {
            "scene_png_b64": scene_png,
            "scene_image_prompt": scene_prompt,
            "scene_image_error": scene_err,
        },
    }

    system_prompt = build_system_prompt(diagram_mode)
    content = build_claude_content(
        question=question,
        retrieved=retrieved,
        input_language_hint=input_language_hint,
        include_diagram=diagram_mode,
        image_b64=image_b64,
    )

    raw_text = ""
    for latest_full_text, answer_token in stream_answer_tokens(
        stream_claude(system_prompt, content),
    ):
        raw_text = latest_full_text
        if answer_token:
            yield {
                "type": "token",
                "data": answer_token,
            }

    result = parse_tutor_result(raw_text, citations)
    result["scene_png_b64"] = scene_png
    result["scene_image_prompt"] = scene_prompt
    result["scene_image_error"] = scene_err

    yield {"type": "svg", "data": result["svg"]}
    yield {"type": "priority", "data": result["priority"]}
    yield {"type": "priority_rationale", "data": result["priority_rationale"]}
    yield {"type": "glossary_terms", "data": result["glossary_terms"]}
    yield {"type": "done", "data": result}


def answer_question_blocking(
    question: str,
    input_language_hint: str | None = None,
    top_k: int = TOP_K,
    image_b64: str | None = None,
    include_diagram: str | None = "auto",
    include_scene_image: str | None = "auto",
) -> TutorResult:
    """Run the tutor pipeline and return the final response shape."""
    answer_parts: list[str] = []
    citations: list[Citation] = []
    svg: str | None = None
    scene_png: str | None = None
    scene_prompt: str | None = None
    scene_err: str | None = None
    priority: Literal["HIGH", "MEDIUM", "BACKGROUND"] = "BACKGROUND"
    priority_rationale = ""
    glossary_terms: list[GlossaryTerm] = []

    for event in answer_question(
        question=question,
        input_language_hint=input_language_hint,
        top_k=top_k,
        image_b64=image_b64,
        include_diagram=include_diagram,
        include_scene_image=include_scene_image,
    ):
        if event["type"] == "citations":
            citations = event["data"]
        elif event["type"] == "scene_image":
            payload = event["data"]
            if isinstance(payload, dict):
                scene_png = payload.get("scene_png_b64")
                scene_prompt = payload.get("scene_image_prompt")
                scene_err = payload.get("scene_image_error")
        elif event["type"] == "token":
            answer_parts.append(str(event["data"]))
        elif event["type"] == "svg":
            svg = event["data"]
        elif event["type"] == "priority":
            priority = parse_priority(str(event["data"]))
        elif event["type"] == "priority_rationale":
            priority_rationale = str(event["data"])
        elif event["type"] == "glossary_terms":
            glossary_terms = event["data"]
        elif event["type"] == "done":
            done_result = event["data"]
            if isinstance(done_result, dict):
                return done_result

    return {
        "answer": "".join(answer_parts).strip(),
        "svg": svg,
        "scene_png_b64": scene_png,
        "scene_image_prompt": scene_prompt,
        "scene_image_error": scene_err,
        "citations": citations,
        "priority": priority,
        "priority_rationale": priority_rationale,
        "glossary_terms": glossary_terms,
    }


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Ask the Alberta Basic Security Training manual with RAG.",
    )
    parser.add_argument(
        "question",
        nargs="?",
        help="Student question to answer. If omitted, prompts once in the terminal.",
    )
    parser.add_argument(
        "--input-language-hint",
        "-l",
        default=None,
        help="Optional input language hint. Output is always simplified English.",
    )
    parser.add_argument(
        "--include-diagram",
        choices=sorted(VALID_DIAGRAM_MODES),
        default="auto",
        help="Whether Claude should include an inline SVG diagram.",
    )
    parser.add_argument(
        "--include-scene-image",
        choices=sorted(VALID_SCENE_IMAGE_MODES),
        default="auto",
        help="Whether Pollinations should return a text-free photorealistic scene.",
    )
    parser.add_argument(
        "--write-scene-png",
        type=str,
        default=None,
        metavar="PATH",
        help="If a scene PNG is returned, write it to this file path (e.g. output/scene.png).",
    )
    parser.add_argument(
        "--top-k",
        type=int,
        default=TOP_K,
        help=f"Number of manual chunks to retrieve. Defaults to {TOP_K}.",
    )
    parser.add_argument(
        "--show-sources",
        action=argparse.BooleanOptionalAction,
        default=True,
        help="Print retrieved chunk metadata after the answer.",
    )
    return parser.parse_args()


def get_question(args: argparse.Namespace) -> str:
    """Return the CLI question or prompt for one interactively."""
    if args.question:
        return args.question

    question = input("Student question: ").strip()
    if not question:
        raise ValueError("question cannot be empty.")
    return question


def print_citation_sources(citations: list[Citation]) -> None:
    """Print retrieved chunk metadata for demo/debugging visibility."""
    print("\n\nSources:")
    for index, citation in enumerate(citations, start=1):
        preview = " ".join(citation["chunk_text"].split())[:100]
        print(
            f"- citation {index} | chunk {citation['chunk_id']} | "
            f"page {citation['page_number']} | score {citation['score']:.4f} | "
            f"{preview}..."
        )


def main() -> None:
    """Run the RAG query CLI."""
    try:
        if hasattr(sys.stdout, "reconfigure"):
            sys.stdout.reconfigure(encoding="utf-8")

        args = parse_args()
        question = get_question(args)

        citations: list[Citation] = []
        svg: str | None = None
        scene_png: str | None = None
        scene_prompt: str | None = None
        scene_err: str | None = None
        priority = ""
        priority_rationale = ""
        glossary_terms: list[GlossaryTerm] = []

        for event in answer_question(
            question=question,
            input_language_hint=args.input_language_hint,
            top_k=args.top_k,
            include_diagram=args.include_diagram,
            include_scene_image=args.include_scene_image,
        ):
            if event["type"] == "citations":
                citations = event["data"]
                pages = ", ".join(
                    str(citation["page_number"]) for citation in citations
                )
                print(f"Retrieved pages: {pages}\n")
            elif event["type"] == "scene_image":
                payload = event["data"]
                if isinstance(payload, dict):
                    scene_png = payload.get("scene_png_b64")
                    scene_prompt = payload.get("scene_image_prompt")
                    scene_err = payload.get("scene_image_error")
            elif event["type"] == "token":
                print(event["data"], end="", flush=True)
            elif event["type"] == "svg":
                svg = event["data"]
            elif event["type"] == "priority":
                priority = str(event["data"])
            elif event["type"] == "priority_rationale":
                priority_rationale = str(event["data"])
            elif event["type"] == "glossary_terms":
                glossary_terms = event["data"]

        print(f"\n\nPriority: {priority}")
        print(f"Why: {priority_rationale}")
        if scene_png and args.write_scene_png:
            out_path = Path(args.write_scene_png)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            out_path.write_bytes(base64.b64decode(scene_png, validate=True))
            print(f"\nScene PNG written to: {out_path.resolve()}")
        elif scene_png:
            print("\nScene PNG: returned as base64 in API response. Use --write-scene-png to save a file.")
        if scene_err:
            print(f"\nScene image error: {scene_err}")
        if scene_prompt:
            preview = scene_prompt[:200] + "..." if len(scene_prompt) > 200 else scene_prompt
            print(f"\nScene prompt (for debugging): {preview}")
        if svg:
            print("\nSVG: returned")
        if glossary_terms:
            print("\nGlossary terms:")
            for item in glossary_terms:
                print(
                    f"- {item['term']}: {item['plain_english_definition']} "
                    f"(page {item['page_number']})"
                )

        if args.show_sources:
            print_citation_sources(citations)
    except (ClientError, FileNotFoundError, ValueError, RuntimeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
