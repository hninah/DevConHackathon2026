"""
rag_query.py

Runs the first end-to-end RAG query against the embedded Alberta Basic Security
Training manual chunks. Embeds a student question, retrieves relevant manual
excerpts, and streams a Claude response in the student's target language.

Usage:
    python src/rag_query.py "When am I allowed to physically restrain someone?"
    python src/rag_query.py "When am I allowed to physically restrain someone?" --language Punjabi
"""

import argparse
import json
import os
import sys
import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any, Literal, TypedDict

import boto3
import numpy as np
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

load_dotenv()

AWS_REGION = os.getenv("AWS_REGION", "us-west-2")
CLAUDE_MODEL_ID = os.getenv("CLAUDE_MODEL_ID", "us.anthropic.claude-sonnet-4-6")
TITAN_EMBED_MODEL_ID = os.getenv(
    "TITAN_EMBED_MODEL_ID",
    "amazon.titan-embed-text-v2:0",
)
CHUNKS_PATH = os.getenv("CHUNKS_OUTPUT_PATH", "data/chunks.json")

EMBEDDING_DIMENSIONS = 1024
TOP_K = 5
# Punjabi output tokenizes heavily, so this keeps the live demo complete while
# the fixed four-line prompt still prevents long answers.
MAX_OUTPUT_TOKENS = 1600
DEFAULT_LANGUAGE = "Punjabi"
PRIORITY_RATIONALE_PLACEHOLDER = "<rationale TBD on hack day>"

MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 2


class Citation(TypedDict):
    """Manual chunk citation returned to frontend clients."""

    page_number: int
    chunk_text: str


class StreamEvent(TypedDict):
    """Typed event emitted by the reusable RAG answer pipeline."""

    type: Literal["token", "citations", "priority_rationale", "done"]
    data: Any


# ---------------------------------------------------------------------------
# Bedrock client
# ---------------------------------------------------------------------------

bedrock = boto3.client("bedrock-runtime", region_name=AWS_REGION)


# ---------------------------------------------------------------------------
# Retrieval
# ---------------------------------------------------------------------------

def load_chunk_store(path: Path) -> tuple[list[dict], np.ndarray]:
    """Load chunk metadata and embeddings from the Phase 3 JSON vector store."""
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
    return chunks, chunk_matrix


def embed_question(text: str) -> np.ndarray:
    """Embed the student question with Titan Embeddings v2."""
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

    raise RuntimeError(f"Question embedding failed after {MAX_RETRIES} retries: {last_exception}")


def retrieve_top_k(
    question_vec: np.ndarray,
    chunk_matrix: np.ndarray,
    chunks: list[dict],
    k: int,
) -> list[dict]:
    """Retrieve the k most similar chunks by dot product."""
    if k <= 0:
        raise ValueError("top-k must be greater than 0.")

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


# ---------------------------------------------------------------------------
# Prompt builders
# ---------------------------------------------------------------------------

def build_system_prompt(language: str) -> str:
    """Build the exam-coach system prompt for the selected language."""
    return f"""You are an exam coach helping a {language}-speaking student prepare for the
Alberta Basic Security Guard certification. The provincial exam is in English.

Use ONLY the manual excerpts provided in the user message to answer. If the
answer is not in the excerpts, say so honestly in {language}.

Format your response exactly:
Line 1: A concise answer in {language}. For legal or technical terms, include
the English term in parentheses, e.g. "ਗ੍ਰਿਫ਼ਤਾਰੀ (citizen's arrest)".
Line 2: One practical exam tip in {language}. Cite specific manual pages for
any factual claim, e.g. "(see page 47)".
Line 3: A 1-sentence English summary for vocabulary reinforcement.
Line 4: Tag the topic exam priority as one of:
   "Exam priority: HIGH", "Exam priority: MEDIUM", or "Exam priority: BACKGROUND".

Do not add markdown headings or extra bullets. Keep the complete response under
{MAX_OUTPUT_TOKENS} tokens so Line 4 is always included."""


def build_user_message(question: str, retrieved: list[dict], language: str) -> str:
    """Build the user message containing the question and manual excerpts."""
    excerpt_blocks = []
    for excerpt_number, chunk in enumerate(retrieved, start=1):
        excerpt_blocks.append(
            f"--- Excerpt {excerpt_number} | page {chunk['page_number']} ---\n"
            f"{chunk['text']}"
        )

    excerpts = "\n\n".join(excerpt_blocks)
    return (
        f"Student question (in {language}):\n{question}\n\n"
        f"Manual excerpts:\n{excerpts}"
    )


# ---------------------------------------------------------------------------
# Claude streaming
# ---------------------------------------------------------------------------

def stream_claude(system_prompt: str, user_message: str) -> Iterator[str]:
    """Stream a Claude response from Bedrock as text tokens."""
    body = json.dumps({
        "anthropic_version": "bedrock-2023-05-31",
        "max_tokens": MAX_OUTPUT_TOKENS,
        "system": system_prompt,
        "messages": [{
            "role": "user",
            "content": user_message,
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


def build_citations(retrieved: list[dict]) -> list[Citation]:
    """Convert retrieved chunks into the F4 citation payload."""
    return [
        {
            "page_number": int(chunk["page_number"]),
            "chunk_text": str(chunk["text"]),
        }
        for chunk in retrieved
    ]


def answer_question(
    question: str,
    language: str = DEFAULT_LANGUAGE,
    top_k: int = TOP_K,
    image_b64: str | None = None,
) -> Iterator[StreamEvent]:
    """Answer a student question as typed stream events.

    `image_b64` is accepted now so the Lambda and frontend can lock the F1 API
    shape tonight; Claude vision wiring lands during Phase 5.
    """
    if not question.strip():
        raise ValueError("Question cannot be empty.")

    if image_b64:
        # Phase 5 will pass this through to Claude as a multimodal message.
        pass

    chunks, chunk_matrix = load_chunk_store(Path(CHUNKS_PATH))
    question_vec = embed_question(question)
    retrieved = retrieve_top_k(question_vec, chunk_matrix, chunks, top_k)

    yield {
        "type": "citations",
        "data": build_citations(retrieved),
    }

    system_prompt = build_system_prompt(language)
    user_message = build_user_message(question, retrieved, language)

    for token in stream_claude(system_prompt, user_message):
        yield {
            "type": "token",
            "data": token,
        }

    yield {
        "type": "priority_rationale",
        "data": PRIORITY_RATIONALE_PLACEHOLDER,
    }
    yield {
        "type": "done",
        "data": None,
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
        "--language",
        "-l",
        default=DEFAULT_LANGUAGE,
        help=f"Target language for the answer. Defaults to {DEFAULT_LANGUAGE}.",
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
        raise ValueError("Question cannot be empty.")
    return question


def print_sources(retrieved: list[dict]) -> None:
    """Print retrieved chunk metadata for demo and debugging visibility."""
    print("\n\nSources:")
    for chunk in retrieved:
        preview = " ".join(chunk["text"].split())[:100]
        print(
            f"- chunk {chunk['chunk_id']} | page {chunk['page_number']} | "
            f"score {chunk['score']:.4f} | {preview}..."
        )


def print_citation_sources(citations: list[Citation]) -> None:
    """Print frontend-shaped citation metadata for demo/debugging visibility."""
    print("\n\nSources:")
    for index, citation in enumerate(citations, start=1):
        preview = " ".join(citation["chunk_text"].split())[:100]
        print(
            f"- citation {index} | page {citation['page_number']} | "
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
        for event in answer_question(
            question=question,
            language=args.language,
            top_k=args.top_k,
        ):
            if event["type"] == "citations":
                citations = event["data"]
                pages = ", ".join(
                    str(citation["page_number"]) for citation in citations
                )
                print(f"Retrieved pages: {pages}\n")
            elif event["type"] == "token":
                print(event["data"], end="", flush=True)

        if args.show_sources:
            print_citation_sources(citations)
        else:
            print()
    except (ClientError, FileNotFoundError, ValueError, RuntimeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        raise SystemExit(1) from error


if __name__ == "__main__":
    main()
