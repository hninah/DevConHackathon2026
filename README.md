# SecurePass

AI exam coach for Alberta Basic Security Guard certification prep.

SecurePass helps CLB 5+ ESL learners study for an English-only certification exam. The product does **not** translate exam material into a native language. Students can type questions in any language, but every learning output comes back in simplified English, written like an "explain like I am 5 years old" answer.

## Current Focus

The working backend feature is the RAG tutor:

- Retrieves relevant chunks from the Alberta Basic Security Training manual
- Answers in simplified English only
- Cites manual pages
- Tags exam priority as `HIGH`, `MEDIUM`, or `BACKGROUND`
- Returns an ELI5 priority rationale
- Extracts glossary terms with plain-English definitions
- **Two visual types**:
  - **PNG scene image** (Bedrock TTI, default **Stable Diffusion 3.5**; optional **Nova Canvas**): photorealistic, **no text on the image**, used as situational context (for example excessive-force body language)
  - **SVG diagram** (Claude): labelled simplified-English explanation diagram (use-of-force ladder, flowchart, and so on)
- Supports an optional uploaded manual-page image via `image_b64`

## Product Rule

Input may be typed in any language. Output is always simplified English.

The simplified-English style means:

- Short sentences
- Common words
- No idioms or slang
- No legal Latin
- Legal terms get a quick gloss, like `citizen's arrest (you holding someone until police come)`
- Diagrams use simplified-English labels

## Stack

- AWS Bedrock Claude Sonnet 4.6 for tutor answers, structured response generation, and inline SVG diagrams
- AWS Bedrock text-to-image for runtime PNG scene images (`SCENE_IMAGE_PROVIDER`, default Stable Diffusion 3.5; Nova Canvas is opt-in)
- AWS Bedrock Titan Embeddings v2 for vector search
- Local JSON vector store at `backend/data/chunks.json`
- AWS Lambda + API Gateway style handler for `/tutor`
- Python backend

Audio, voice input, and translation services are intentionally out of scope for the current build.

## Setup

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Fill `.env` with the Workshop Studio AWS credentials/config needed for Bedrock.

**Scene image provider:** By default, `SCENE_IMAGE_PROVIDER=stability` uses **Stable Diffusion 3.5** in `STABILITY_IMAGE_REGION` (default: same as `AWS_REGION`, often `us-west-2`). For **Nova Canvas** instead, set `SCENE_IMAGE_PROVIDER=nova` and configure `NOVA_CANVAS_REGION` (default `us-east-1`); enable that model in the Bedrock console for that region. See `backend/README.md` for details.

## Data Pipeline

The manual PDF and embedded chunks are local, gitignored files.

```powershell
cd backend
python scripts\chunk_manual.py
python scripts\embed_chunks.py
```

Expected local data:

- `backend/data/manual.pdf`
- `backend/data/chunks.json`

## RAG Tutor CLI

Basic text-only answer:

```powershell
cd backend
python src\rag_query.py "When am I allowed to physically restrain someone?" --include-diagram never
```

Force a diagram:

```powershell
python src\rag_query.py "Explain the use of force continuum with a simple diagram." --include-diagram always
```

Native-language typed input, simplified-English output:

```powershell
python src\rag_query.py "ਮੈਂ ਕਿਸੇ ਨੂੰ ਕਦੋਂ ਰੋਕ ਸਕਦਾ ਹਾਂ?" --input-language-hint Punjabi
```

Force a Nova Canvas PNG scene plus an SVG explanation (for example use of force):

```powershell
python src\rag_query.py "Show me an excessive force scenario" --include-scene-image always --include-diagram always --write-scene-png output\scene.png --no-show-sources
```

## Tutor API Shape

Local API Gateway-style smoke test:

```powershell
cd backend
python src\lambda_tutor.py
```

`POST /tutor` request:

```json
{
  "question": "When am I allowed to physically restrain someone?",
  "input_language_hint": "Punjabi",
  "image_b64": "<optional JPEG base64>",
  "include_diagram": "auto",
  "include_scene_image": "auto",
  "top_k": 5
}
```

`include_diagram` can be:

- `auto`
- `always`
- `never`

`include_scene_image` can be:

- `auto` — generate a PNG when the question and retrieved chunks match a known safe topic template
- `always` — always request a PNG (falls back to a generic de-escalation mall scene if no keyword match)
- `never` — skip the scene PNG

Response:

```json
{
  "answer": "Simplified English answer with citations.",
  "svg": "<svg>...</svg>",
  "scene_png_b64": "iVBORw0KGgo...",
  "scene_image_prompt": "Photorealistic training scene: ...",
  "scene_image_error": null,
  "citations": [
    {
      "page_number": 44,
      "chunk_text": "Manual excerpt text...",
      "chunk_id": 68,
      "score": 0.37
    }
  ],
  "priority": "HIGH",
  "priority_rationale": "This is tested often because guards must know when force is allowed.",
  "glossary_terms": [
    {
      "term": "reasonable force",
      "plain_english_definition": "Just enough force to stop the problem, and no more.",
      "page_number": 44
    }
  ]
}
```

## Key Files

- `Prompt.md` — full project handoff and hackathon plan
- `backend/src/rag_query.py` — reusable RAG tutor pipeline
- `backend/src/lambda_tutor.py` — API Gateway Lambda handler for `/tutor`
- `backend/scripts/chunk_manual.py` — extracts and chunks the manual PDF
- `backend/scripts/embed_chunks.py` — embeds chunks with Titan Embeddings v2
- `backend/scripts/extract_glossary.py` — optional glossary extraction helper

## Verified Smoke Tests

These passed locally:

- Python compile check for `backend/src/rag_query.py` and `backend/src/lambda_tutor.py`
- Real RAG CLI query with `--include-diagram never`
- Real RAG CLI query with `--include-diagram always`, returning `SVG: returned`
- Re-run with Workshop Studio creds: `include_scene_image=always` should return `scene_png_b64` and/or `scene_image_error` if the chosen TTI model is not enabled in the account
- Local Lambda handler smoke test returning `statusCode: 200` with the full tutor response shape