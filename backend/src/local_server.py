"""
Local development HTTP server for the SecurePass tutor Lambda handler.

This keeps local browser testing close to the deployed Lambda shape without
adding a web framework dependency.
"""

from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from urllib.parse import urlparse

from lambda_tutor import handler
from mock_exam_service import create_mock_exam


class TutorRequestHandler(BaseHTTPRequestHandler):
    """Route local HTTP requests into the API Gateway-style Lambda handler."""

    def _send_lambda_response(self, response: dict) -> None:
        status_code = int(response.get("statusCode", 500))
        headers = response.get("headers", {})
        body = str(response.get("body", ""))

        self.send_response(status_code)
        for name, value in headers.items():
            self.send_header(name, str(value))
        self.end_headers()
        if body:
            self.wfile.write(body.encode("utf-8"))

    def do_OPTIONS(self) -> None:
        response = handler(
            {"requestContext": {"http": {"method": "OPTIONS"}}, "body": "{}"},
            None,
        )
        self._send_lambda_response(response)

    def do_POST(self) -> None:
        content_length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_length).decode("utf-8")
        parsed_path = urlparse(self.path).path
        normalized_path = (parsed_path or "/").rstrip("/")
        print(f"POST path raw={self.path!r} normalized={normalized_path!r}")
        if normalized_path in ("/tutor", "/roleplay/answer", "/roleplay/next-scenario"):
            response = handler(
                {
                    "requestContext": {"http": {"method": "POST"}},
                    "rawPath": normalized_path,
                    "body": body,
                    "isBase64Encoded": False,
                },
                None,
            )
            self._send_lambda_response(response)
            return

        if normalized_path == "/mock-exams/create":
            try:
                parsed = json.loads(body or "{}")
                if not isinstance(parsed, dict):
                    parsed = {}
                label = parsed.get("label")
                question_count = int(parsed.get("question_count", 50))
                payload = create_mock_exam(
                    label=str(label) if isinstance(label, str) else None,
                    question_count=question_count,
                )
                response = {
                    "statusCode": 200,
                    "headers": {
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Headers": "content-type",
                        "Access-Control-Allow-Methods": "POST,OPTIONS",
                        "Content-Type": "application/json",
                    },
                    "body": json.dumps(payload, ensure_ascii=False),
                }
                self._send_lambda_response(response)
            except Exception as error:
                response = {
                    "statusCode": 500,
                    "headers": {
                        "Access-Control-Allow-Origin": "*",
                        "Access-Control-Allow-Headers": "content-type",
                        "Access-Control-Allow-Methods": "POST,OPTIONS",
                        "Content-Type": "application/json",
                    },
                    "body": json.dumps({"error": str(error)}, ensure_ascii=False),
                }
                self._send_lambda_response(response)
            return

        self.send_error(404, "Not Found")

    def log_message(self, format: str, *args: object) -> None:
        print(f"{self.address_string()} - {format % args}")


def main() -> None:
    port = int(os.getenv("PORT", "8000"))
    server = HTTPServer(("127.0.0.1", port), TutorRequestHandler)
    print(f"SecurePass local backend listening on http://127.0.0.1:{port}", flush=True)
    print("POST tutor requests to /tutor", flush=True)
    print("POST roleplay answer requests to /roleplay/answer", flush=True)
    print("POST roleplay scenario generation requests to /roleplay/next-scenario", flush=True)
    print("POST mock exam creation requests to /mock-exams/create", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
