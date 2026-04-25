"""
chunk_manual.py

Extracts text from the Alberta Basic Security Guard manual PDF and splits it
into overlapping chunks suitable for embedding and retrieval.

Outputs: data/chunks.json - a list of chunk objects with text, page number,
and chunk index.

Usage:
    python scripts/chunk_manual.py
"""

import json
import os
from pathlib import Path

from dotenv import load_dotenv
from pypdf import PdfReader

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

load_dotenv()

MANUAL_PDF_PATH = os.getenv("MANUAL_PDF_PATH", "data/manual.pdf")
CHUNKS_OUTPUT_PATH = os.getenv("CHUNKS_OUTPUT_PATH", "data/chunks.json")

# Chunking parameters. Roughly 500 tokens ~ 2000 characters for English prose.
# Overlap helps preserve context across chunk boundaries so concepts don't get split.
CHUNK_SIZE_CHARS = 2000
CHUNK_OVERLAP_CHARS = 200


# ---------------------------------------------------------------------------
# PDF text extraction
# ---------------------------------------------------------------------------

def extract_pages_from_pdf(pdf_path: str) -> list[dict]:
    """Read a PDF and return a list of {page_number, text} dicts.

    Page numbers are 1-indexed to match how humans reference manual pages.
    """
    reader = PdfReader(pdf_path)
    pages = []

    for page_index, page in enumerate(reader.pages):
        text = page.extract_text() or ""
        text = text.strip()
        if text:
            pages.append({
                "page_number": page_index + 1,
                "text": text,
            })

    return pages


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------

def chunk_text(text: str, chunk_size: int, overlap: int) -> list[str]:
    """Split text into overlapping chunks of roughly chunk_size characters.

    Tries to break on paragraph boundaries when possible to keep chunks coherent.
    Falls back to hard character splits when no clean break is available.
    """
    chunks = []
    start = 0

    while start < len(text):
        end = start + chunk_size

        if end >= len(text):
            chunks.append(text[start:].strip())
            break

        # Try to break on a double newline (paragraph) within the last 300 chars
        break_point = text.rfind("\n\n", start, end)
        if break_point == -1 or break_point < start + chunk_size // 2:
            # Fall back to single newline
            break_point = text.rfind("\n", start, end)
        if break_point == -1 or break_point < start + chunk_size // 2:
            # Fall back to sentence end
            break_point = text.rfind(". ", start, end)
        if break_point == -1 or break_point < start + chunk_size // 2:
            # Hard split
            break_point = end

        chunk = text[start:break_point].strip()
        if chunk:
            chunks.append(chunk)

        # Move start forward, but back up by overlap to preserve context
        start = max(break_point - overlap, start + 1)

    return chunks


def build_chunk_records(pages: list[dict]) -> list[dict]:
    """Turn pages into chunk records with metadata.

    Each record contains:
        - chunk_id: unique global index
        - page_number: source page (1-indexed)
        - chunk_index_on_page: which chunk this is on its source page
        - text: the chunk content
    """
    records = []
    global_chunk_id = 0

    for page in pages:
        page_chunks = chunk_text(
            page["text"],
            chunk_size=CHUNK_SIZE_CHARS,
            overlap=CHUNK_OVERLAP_CHARS,
        )

        for chunk_index_on_page, chunk in enumerate(page_chunks):
            records.append({
                "chunk_id": global_chunk_id,
                "page_number": page["page_number"],
                "chunk_index_on_page": chunk_index_on_page,
                "text": chunk,
            })
            global_chunk_id += 1

    return records


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    """Extract, chunk, and write the manual text to JSON."""
    pdf_path = Path(MANUAL_PDF_PATH)
    if not pdf_path.exists():
        raise FileNotFoundError(f"Manual PDF not found at {pdf_path.resolve()}")

    print(f"Reading PDF from {pdf_path}...")
    pages = extract_pages_from_pdf(str(pdf_path))
    print(f"Extracted text from {len(pages)} pages.")

    print("Chunking text...")
    chunks = build_chunk_records(pages)
    print(f"Created {len(chunks)} chunks.")

    # Quick stats so we know the chunking is reasonable
    chunk_lengths = [len(chunk["text"]) for chunk in chunks]
    avg_length = sum(chunk_lengths) / len(chunk_lengths) if chunk_lengths else 0
    print(f"Average chunk length: {avg_length:.0f} chars.")
    print(f"Min: {min(chunk_lengths)} | Max: {max(chunk_lengths)}")

    output_path = Path(CHUNKS_OUTPUT_PATH)
    output_path.parent.mkdir(parents=True, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as file:
        json.dump(chunks, file, ensure_ascii=False, indent=2)

    print(f"Saved chunks to {output_path.resolve()}")


if __name__ == "__main__":
    main()
