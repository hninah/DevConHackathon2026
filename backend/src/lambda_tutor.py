"""
lambda_tutor.py

API Gateway Lambda handler for SecurePass POST /tutor.

Request:
    {
        "question": "When am I allowed to physically restrain someone?",
        "input_language_hint": "Punjabi",
        "image_b64": "<optional JPEG base64>",
        "include_diagram": "auto",
        "include_scene_image": "auto",
        "top_k": 5
    }

Response:
    {
        "answer": "... simplified English ...",
        "svg": "<svg ...>...</svg>" | null,
        "scene_png_b64": "<base64 png>" | null,
        "scene_image_prompt": "TTI scene prompt used, or null",
        "scene_image_error": "Error string if image gen failed, or null",
        "citations": [...],
        "priority": "HIGH",
        "priority_rationale": "...",
        "glossary_terms": [...]
    }
"""

from __future__ import annotations

import base64
import json
import sys
from typing import Any

from botocore.exceptions import ClientError

from rag_query import TOP_K, answer_question_blocking


def _response(status_code: int, payload: dict[str, Any]) -> dict[str, Any]:
    """Build an API Gateway proxy response."""
    return {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "content-type",
            "Access-Control-Allow-Methods": "POST,OPTIONS",
            "Content-Type": "application/json",
        },
        "body": json.dumps(payload, ensure_ascii=False),
    }


def _parse_body(event: dict[str, Any]) -> dict[str, Any]:
    """Parse an API Gateway event body into a dict."""
    raw_body = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw_body = base64.b64decode(raw_body).decode("utf-8")

    parsed = json.loads(raw_body)
    if not isinstance(parsed, dict):
        raise ValueError("Request body must be a JSON object.")
    return parsed


def _coerce_top_k(value: Any) -> int:
    """Parse top_k while keeping a safe lower/upper bound for demo latency."""
    if value is None:
        return TOP_K

    try:
        top_k = int(value)
    except (TypeError, ValueError) as error:
        raise ValueError("top_k must be an integer.") from error

    if top_k < 1 or top_k > 10:
        raise ValueError("top_k must be between 1 and 10.")
    return top_k


def _method(event: dict[str, Any]) -> str:
    """Return the HTTP method for API Gateway v1 or v2 events."""
    request_context = event.get("requestContext", {})
    http_context = request_context.get("http", {})
    return str(
        http_context.get("method")
        or event.get("httpMethod")
        or "POST"
    ).upper()


def handler(event: dict[str, Any], context: object) -> dict[str, Any]:
    """Handle POST /tutor requests."""
    if _method(event) == "OPTIONS":
        return _response(204, {})

    try:
        body = _parse_body(event)
    except json.JSONDecodeError:
        return _response(400, {"error": "Request body must be valid JSON."})
    except ValueError as error:
        return _response(400, {"error": str(error)})

    question = str(body.get("question", "")).strip()
    input_language_hint = body.get("input_language_hint")
    image_b64 = body.get("image_b64")
    include_diagram = str(body.get("include_diagram", "auto")).strip() or "auto"
    include_scene_image = str(
        body.get("include_scene_image", "auto"),
    ).strip() or "auto"

    if not question:
        return _response(400, {"error": "question is required."})
    if input_language_hint is not None:
        input_language_hint = str(input_language_hint).strip() or None
    if image_b64 is not None:
        image_b64 = str(image_b64).strip() or None

    try:
        result = answer_question_blocking(
            question=question,
            input_language_hint=input_language_hint,
            top_k=_coerce_top_k(body.get("top_k")),
            image_b64=image_b64,
            include_diagram=include_diagram,
        )
    except ValueError as error:
        return _response(400, {"error": str(error)})
    except (ClientError, FileNotFoundError, RuntimeError) as error:
        return _response(500, {"error": str(error)})

    return _response(200, result)


def main() -> None:
    """Run a local API Gateway-style smoke test."""
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    event = {
        "requestContext": {"http": {"method": "POST"}},
        "body": json.dumps({
            "question": "When am I allowed to physically restrain someone?",
            "include_diagram": "auto",
            "include_scene_image": "auto",
        }),
    }
    response = handler(event, None)
    print(json.dumps(response, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
