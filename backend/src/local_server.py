"""
Local development HTTP server for the SecurePass tutor Lambda handler.

This keeps local browser testing close to the deployed Lambda shape without
adding a web framework dependency.
"""

from http.server import BaseHTTPRequestHandler, HTTPServer
import os

from lambda_tutor import handler


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
        if self.path not in ("/tutor", "/roleplay/answer", "/roleplay/next-scenario"):
            self.send_error(404, "Not Found")
            return

        content_length = int(self.headers.get("Content-Length", "0"))
        body = self.rfile.read(content_length).decode("utf-8")
        response = handler(
            {
                "requestContext": {"http": {"method": "POST"}},
                "rawPath": self.path,
                "body": body,
                "isBase64Encoded": False,
            },
            None,
        )
        self._send_lambda_response(response)

    def log_message(self, format: str, *args: object) -> None:
        print(f"{self.address_string()} - {format % args}")


def main() -> None:
    port = int(os.getenv("PORT", "8000"))
    server = HTTPServer(("127.0.0.1", port), TutorRequestHandler)
    print(f"SecurePass local backend listening on http://127.0.0.1:{port}")
    print("POST tutor requests to /tutor")
    print("POST roleplay answer requests to /roleplay/answer")
    print("POST roleplay scenario generation requests to /roleplay/next-scenario")
    server.serve_forever()


if __name__ == "__main__":
    main()
