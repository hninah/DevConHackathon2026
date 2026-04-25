# SecurePass Backend

Backend for the SecurePass RAG tutor.

The current backend focus is `POST /tutor`: a retrieval-augmented tutor that helps CLB 5+ ESL learners study for the Alberta Basic Security Guard certification exam. Students may type questions in any language, but the tutor always answers in simplified English at an "explain like I am 5 years old" level.

## What The Tutor Does

- Embeds the student question with Titan Embeddings v2
- Retrieves the most relevant manual chunks from `data/chunks.json`
- Optionally calls **Bedrock text-to-image** (default **Stable Diffusion 3.5 Large**; optional **Nova Canvas**) to generate a **text-free photorealistic PNG** that shows the situation (for example excessive-force body language)
- Sends the chunks to Claude Sonnet 4.6
- Answers in simplified English only
- Cites manual pages
- Returns exam priority metadata
- Returns ELI5 glossary terms
- Optionally returns an inline **SVG** diagram for labelled teaching (use-of-force ladder, flowchart, and so on)
- Accepts an optional manual-page photo via `image_b64`

### PNG vs SVG

- **PNG (`scene_png_b64`)**: situational scene. Prompts explicitly request **no text, no signs, no labels** on the image.
- **SVG (`svg`)**: conceptual explanation with simplified-English labels inside `<text>`.

## Setup

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
copy .env.example .env
```

Fill `.env` with:

```env
CLAUDE_MODEL_ID=us.anthropic.claude-sonnet-4-6
TITAN_EMBED_MODEL_ID=amazon.titan-embed-text-v2:0
NOVA_CANVAS_MODEL_ID=amazon.nova-canvas-v1:0
NOVA_CANVAS_REGION=us-east-1
AWS_REGION=us-west-2
MANUAL_PDF_PATH=data/manual.pdf
CHUNKS_OUTPUT_PATH=data/chunks.json
SCENE_IMAGE_WIDTH=1024
SCENE_IMAGE_HEIGHT=1024
```

Workshop Studio credentials must also be available in the shell/session.

## Build The Vector Store

Put the Alberta manual at:

```text
backend/data/manual.pdf
```

Then run:

```powershell
python scripts\chunk_manual.py
python scripts\embed_chunks.py
```

This creates:

```text
backend/data/chunks.json
```

`manual.pdf` and `chunks.json` are gitignored.

## CLI Usage

Ask a question:

```powershell
python src\rag_query.py "When am I allowed to physically restrain someone?"
```

Force no diagram:

```powershell
python src\rag_query.py "When am I allowed to physically restrain someone?" --include-diagram never
```

Force an SVG diagram:

```powershell
python src\rag_query.py "Explain the use of force continuum with a simple diagram." --include-diagram always
```

Force a PNG scene image (save to disk for viewing; see `SCENE_IMAGE_PROVIDER` in `.env`):

```powershell
python src\rag_query.py "Show me an excessive force scenario" --include-scene-image always --write-scene-png output\scene.png --no-show-sources
```

Use a typed native-language question while keeping output in simplified English:

```powershell
python src\rag_query.py "ਮੈਂ ਕਿਸੇ ਨੂੰ ਕਦੋਂ ਰੋਕ ਸਕਦਾ ਹਾਂ?" --input-language-hint Punjabi
```

Useful options:

- `--input-language-hint`, `-l`: optional input language hint only. It never changes output language.
- `--include-diagram`: `auto`, `always`, or `never`.
- `--include-scene-image`: `auto`, `always`, or `never`.
- `--write-scene-png PATH`: save the returned scene PNG to a file.
- `--top-k`: number of chunks to retrieve. Default is `5`.
- `--show-sources` / `--no-show-sources`: print source chunks after the answer.

## Tutor API

Local API Gateway-style smoke test:

```powershell
python src\lambda_tutor.py
```

Request:

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

Rules:

- `question` is required.
- `input_language_hint` is optional and only helps understand typed input.
- `image_b64` is optional and must decode to 1 MB or less.
- `include_diagram` must be `auto`, `always`, or `never`.
- `include_scene_image` must be `auto`, `always`, or `never`.
- `top_k` must be between `1` and `10`.

Response:

```json
{
  "answer": "You can physically hold someone only when the law says it is okay (see page 43).",
  "svg": "<svg viewBox=\"0 0 420 260\">...</svg>",
  "scene_png_b64": "iVBORw0KGgo...",
  "scene_image_prompt": "Photorealistic training scene: ...",
  "scene_image_error": null,
  "citations": [
    {
      "page_number": 43,
      "chunk_text": "Manual excerpt text...",
      "chunk_id": 67,
      "score": 0.3654
    }
  ],
  "priority": "HIGH",
  "priority_rationale": "Knowing when you can hold someone is one of the most important things the exam tests.",
  "glossary_terms": [
    {
      "term": "reasonable force",
      "plain_english_definition": "Just enough force to stop the problem, and no more.",
      "page_number": 44
    }
  ]
}
```

## Prompt Contract

Claude is asked to return an internal structured envelope:

```text
<answer>...</answer>
<diagram>NONE or <svg>...</svg></diagram>
<priority>HIGH | MEDIUM | BACKGROUND</priority>
<priority_rationale>...</priority_rationale>
<glossary_terms>[...]</glossary_terms>
```

`rag_query.py` streams only the `<answer>` text to callers, then parses the rest into the final response shape.

## Simplified-English Style

The tutor should explain like the student is 5 years old:

- Short sentences
- Common words
- No idioms
- No slang
- No legal Latin
- No native-language output
- Gloss hard terms in parentheses

Example:

```text
Manual style:
A person may use as much force as is reasonably necessary.

Tutor style:
Use just enough force to stop the problem. No more.
```

## Runtime scene images (PNG)

By default, scene images use **Stability AI Stable Diffusion 3.5 Large** (`stability.sd3-5-large-v1:0`) via `SCENE_IMAGE_PROVIDER=stability` in `STABILITY_IMAGE_REGION` (default: same as `AWS_REGION`, often `us-west-2`). Request model access in the Bedrock console for that model and region.

To use **Amazon Nova Canvas** instead, set `SCENE_IMAGE_PROVIDER=nova` and configure `NOVA_CANVAS_REGION` (default `us-east-1`) and `NOVA_CANVAS_MODEL_ID`. Nova uses `taskType: TEXT_IMAGE` with `textToImageParams.text` set to a safe, text-free prompt.

**Legacy Nova errors:** If you see a message that the model is **Legacy** and you have not used it in the last 30 days, switch to `SCENE_IMAGE_PROVIDER=stability` and enable **Stable Diffusion 3.5 Large** in Bedrock, or use an active Nova model when AWS offers one in your account.

If image generation throttles or the model is not enabled, `scene_image_error` is set and the tutor still returns the text answer and SVG when requested.

**Region note (Nova):** If you see `ValidationException: The provided model identifier is invalid` for Canvas, set `NOVA_CANVAS_REGION=us-east-1` and enable **Amazon Nova Canvas** in that region.

## Visual Diagram Rules

Inline SVG diagrams are generated by Claude and returned as `svg`.

SVG rules in the prompt:

- Use only safe SVG elements
- Use simplified-English labels
- Use ASCII text only
- No emoji or warning symbols
- No XML comments
- No scripts
- No event attributes
- No external links
- No `foreignObject`

Frontend still needs its own SVG sanitizer before rendering.

## Verified Locally

These checks passed:

```powershell
python -m py_compile src\rag_query.py src\lambda_tutor.py
python src\rag_query.py "When am I allowed to physically restrain someone?" --include-diagram never --no-show-sources
python src\rag_query.py "Explain the use of force continuum with a simple diagram." --include-diagram always --no-show-sources
python src\rag_query.py "Show me an excessive force scenario" --include-scene-image always --include-diagram always --write-scene-png output\scene.png --no-show-sources
python src\lambda_tutor.py
```

Observed behavior:

- Retrieves relevant manual pages
- Answers in simplified English
- Includes page citations
- Returns `HIGH` priority on use-of-force questions
- Returns glossary terms
- Returns `SVG: returned` when `include_diagram=always`
- Writes `output\\scene.png` or sets `scene_image_error` if Bedrock TTI is unavailable
- Lambda smoke test returns `statusCode: 200`

## Files

- `src/rag_query.py`: reusable RAG tutor pipeline
- `src/lambda_tutor.py`: API Gateway Lambda handler for `/tutor`
- `scripts/chunk_manual.py`: PDF extraction and chunking
- `scripts/embed_chunks.py`: Titan embedding generation
- `scripts/extract_glossary.py`: optional glossary extraction helper
