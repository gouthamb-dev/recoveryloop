"""
Recovery Loop MicroVM Executor
A simple HTTP server that receives scripts, executes them, and returns stdout/stderr.
Runs inside an AWS Lambda MicroVM.
"""

import http.server
import json
import subprocess
import tempfile
import os
import time
import threading

PORT = 8080
HOOKS_PREFIX = "/aws/lambda-microvms/runtime/v1"


class ExecutorHandler(http.server.BaseHTTPRequestHandler):
    """Handles script execution requests and lifecycle hooks."""

    def do_POST(self):
        # Lifecycle hooks
        if self.path == f"{HOOKS_PREFIX}/run":
            self._handle_run_hook()
        elif self.path == f"{HOOKS_PREFIX}/resume":
            self._respond(200, {"status": "resumed"})
        elif self.path == f"{HOOKS_PREFIX}/suspend":
            self._respond(200, {"status": "suspending"})
        elif self.path == f"{HOOKS_PREFIX}/terminate":
            self._respond(200, {"status": "terminating"})
        elif self.path == "/execute":
            self._handle_execute()
        elif self.path == "/health":
            self._respond(200, {"status": "healthy"})
        else:
            self._respond(404, {"error": "Not found"})

    def do_GET(self):
        if self.path == "/health":
            self._respond(200, {"status": "healthy"})
        else:
            self._respond(404, {"error": "Not found"})

    def _handle_run_hook(self):
        """Handle the /run lifecycle hook — MicroVM is starting."""
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length) if content_length > 0 else b"{}"
        data = json.loads(body)
        print(f"[RUN HOOK] MicroVM started: {data.get('microvmId', 'unknown')}")
        self._respond(200, {"status": "ready"})

    def _handle_execute(self):
        """Execute a script and return stdout, stderr, exit code."""
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length == 0:
            self._respond(400, {"error": "No body provided"})
            return

        body = json.loads(self.rfile.read(content_length))
        script = body.get("script", "")
        timeout = body.get("timeoutMs", 30000) / 1000  # Convert to seconds
        language = body.get("language", "auto")

        if not script:
            self._respond(400, {"error": "No script provided"})
            return

        # Detect language if auto
        if language == "auto":
            language = self._detect_language(script)

        start_time = time.time()

        try:
            # Write script to temp file
            suffix = ".py" if language == "python" else ".sh"
            with tempfile.NamedTemporaryFile(mode="w", suffix=suffix, delete=False) as f:
                f.write(script)
                script_path = f.name

            if language == "bash":
                os.chmod(script_path, 0o755)
                cmd = ["bash", script_path]
            else:
                cmd = ["python3", script_path]

            # Execute with timeout
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=timeout,
                env={**os.environ, "PYTHONUNBUFFERED": "1"},
            )

            execution_time_ms = int((time.time() - start_time) * 1000)

            self._respond(200, {
                "status": "success" if result.returncode == 0 else "failure",
                "stdout": result.stdout,
                "stderr": result.stderr,
                "exitCode": result.returncode,
                "executionTimeMs": execution_time_ms,
            })

        except subprocess.TimeoutExpired:
            execution_time_ms = int((time.time() - start_time) * 1000)
            self._respond(200, {
                "status": "timeout",
                "stdout": "",
                "stderr": f"Execution timed out after {timeout}s",
                "exitCode": 124,
                "executionTimeMs": execution_time_ms,
            })

        except Exception as e:
            execution_time_ms = int((time.time() - start_time) * 1000)
            self._respond(500, {
                "status": "failure",
                "stdout": "",
                "stderr": str(e),
                "exitCode": 1,
                "executionTimeMs": execution_time_ms,
            })

        finally:
            # Cleanup temp file
            try:
                os.unlink(script_path)
            except Exception:
                pass

    def _detect_language(self, script: str) -> str:
        """Detect script language from shebang or content heuristics."""
        first_line = script.split("\n")[0].strip()
        if "python" in first_line:
            return "python"
        if "bash" in first_line or "sh" in first_line:
            return "bash"
        # Heuristics
        if script.lstrip().startswith(("import ", "from ", "def ", "print(")):
            return "python"
        return "bash"

    def _respond(self, status_code: int, body: dict):
        """Send a JSON response."""
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        response = json.dumps(body)
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response.encode())

    def log_message(self, format, *args):
        """Structured logging."""
        print(f"[EXECUTOR] {format % args}")


def main():
    server = http.server.HTTPServer(("0.0.0.0", PORT), ExecutorHandler)
    print(f"[EXECUTOR] Script executor listening on port {PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
