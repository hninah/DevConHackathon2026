"""
lambda_tutor.py

API Gateway Lambda handler sketch for the SecurePass tutor endpoint.

Tonight's version returns a batched JSON response so the frontend can type
against the final shape. Phase 5 will replace the batched response with a
streaming Lambda Function URL / API Gateway setup.
"""

import json
import sys
from typing import Any

from botocore.exceptions import ClientError

from rag_query import DEFAULT_LANGUAGE, TOP_K, Citation, answer_question


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
        return json.loads(raw_body)
    return json.loads(raw_body)


def handler(event: dict[str, Any], context: object) -> dict[str, Any]:
    """Handle POST /tutor requests."""
    if event.get("requestContext", {}).get("http", {}).get("method") == "OPTIONS":
        return _response(204, {})

    try:
        body = _parse_body(event)
    except json.JSONDecodeError:
        return _response(400, {"error": "Request body must be valid JSON."})

    question = str(body.get("question", "")).strip()
    language = str(body.get("language", DEFAULT_LANGUAGE)).strip() or DEFAULT_LANGUAGE
    image_b64 = body.get("image_b64")
    top_k = int(body.get("top_k", TOP_K))

    if not question:
        return _response(400, {"error": "question is required"})

    answer_parts: list[str] = []
    citations: list[Citation] = []
    priority_rationale = ""

    try:
        # TODO Phase 5: return these events through a streaming Lambda response.
        for event_item in answer_question(
            question=question,
            language=language,
            top_k=top_k,
            image_b64=image_b64,
        ):
            if event_item["type"] == "citations":
                citations = event_item["data"]
            elif event_item["type"] == "token":
                answer_parts.append(str(event_item["data"]))
            elif event_item["type"] == "priority_rationale":
                priority_rationale = str(event_item["data"])
    except (ClientError, FileNotFoundError, ValueError, RuntimeError) as error:
        return _response(500, {"error": str(error)})

    return _response(
        200,
        {
            "answer": "".join(answer_parts),
            "citations": citations,
            "priority_rationale": priority_rationale,
        },
    )


def main() -> None:
    """Run a local API Gateway-style smoke test."""
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    event = {
        "requestContext": {"http": {"method": "POST"}},
        "body": json.dumps({
            "question": "When am I allowed to physically restrain someone?",
            "language": "Punjabi",
        }),
    }
    response = handler(event, None)
    print(json.dumps(response, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
