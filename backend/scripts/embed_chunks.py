"""
embed_chunks.py

Generates a vector embedding for every chunk in data/chunks.json using
Amazon Titan Embeddings v2 via Bedrock.

Reads:  data/chunks.json (chunks without embeddings)
Writes: data/chunks.json (same chunks, now with an "embedding" field)

Usage:
    python scripts/embed_chunks.py
"""

import json
import os
import time
from pathlib import Path

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

load_dotenv()

AWS_REGION = os.getenv("AWS_REGION", "us-west-2")
TITAN_EMBED_MODEL_ID = os.getenv(
    "TITAN_EMBED_MODEL_ID",
    "amazon.titan-embed-text-v2:0",
)
CHUNKS_PATH = os.getenv("CHUNKS_OUTPUT_PATH", "data/chunks.json")

# Titan v2 supports configurable embedding dimensions: 256, 512, or 1024.
# 1024 gives best retrieval quality. Smaller is faster but loses fidelity.
EMBEDDING_DIMENSIONS = 1024

# Throttling and retry behavior. Bedrock has per-account rate limits.
SLEEP_BETWEEN_CALLS_SECONDS = 0.05  # ~20 calls/sec, well under typical limits
MAX_RETRIES = 3
RETRY_BACKOFF_SECONDS = 2


# ---------------------------------------------------------------------------
# Bedrock client
# ---------------------------------------------------------------------------

bedrock = boto3.client("bedrock-runtime", region_name=AWS_REGION)


def embed_text(text: str) -> list[float]:
    """Call Titan Embeddings v2 and return the embedding vector.

    Retries on transient errors. Raises if all retries fail.
    """
    body = json.dumps({
        "inputText": text,
        "dimensions": EMBEDDING_DIMENSIONS,
        "normalize": True,  # Pre-normalized vectors make cosine similarity = dot product
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
            return payload["embedding"]
        except ClientError as error:
            last_exception = error
            error_code = error.response.get("Error", {}).get("Code", "")
            if error_code in ("ThrottlingException", "ServiceUnavailableException"):
                wait = RETRY_BACKOFF_SECONDS * (2 ** attempt)
                print(f"  Throttled, retrying in {wait}s...")
                time.sleep(wait)
                continue
            raise

    raise RuntimeError(f"Embedding failed after {MAX_RETRIES} retries: {last_exception}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    """Embed every chunk in chunks.json and write the enriched JSON file."""
    chunks_path = Path(CHUNKS_PATH)
    if not chunks_path.exists():
        raise FileNotFoundError(
            f"Chunks file not found at {chunks_path.resolve()}. "
            "Run scripts/chunk_manual.py first."
        )

    print(f"Loading chunks from {chunks_path}...")
    with open(chunks_path, "r", encoding="utf-8") as file:
        chunks = json.load(file)

    total = len(chunks)
    print(f"Found {total} chunks. Embedding with {TITAN_EMBED_MODEL_ID}...")
    print(f"Embedding dimensions: {EMBEDDING_DIMENSIONS}")

    start_time = time.time()

    for index, chunk in enumerate(chunks):
        # Skip if already embedded (lets us resume after a crash)
        if "embedding" in chunk and chunk["embedding"]:
            continue

        chunk["embedding"] = embed_text(chunk["text"])

        # Progress indicator every 25 chunks
        if (index + 1) % 25 == 0 or (index + 1) == total:
            elapsed = time.time() - start_time
            rate = (index + 1) / elapsed if elapsed > 0 else 0
            remaining = (total - (index + 1)) / rate if rate > 0 else 0
            print(
                f"  {index + 1}/{total} chunks embedded "
                f"({rate:.1f}/sec, ~{remaining:.0f}s left)"
            )

        time.sleep(SLEEP_BETWEEN_CALLS_SECONDS)

    print(f"Saving embedded chunks back to {chunks_path}...")
    with open(chunks_path, "w", encoding="utf-8") as file:
        json.dump(chunks, file, ensure_ascii=False, indent=2)

    elapsed = time.time() - start_time
    print(f"Done. Embedded {total} chunks in {elapsed:.1f}s.")


if __name__ == "__main__":
    main()
