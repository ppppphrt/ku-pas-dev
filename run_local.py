"""Start the supplied frontend build and API on loopback, without Node.js."""

import argparse
import functools
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import URLError
from urllib.parse import urlsplit
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parent


def runtime():
    candidates = [
        ROOT / ".venv/bin/python",
        ROOT / ".venv/Scripts/python.exe",
        ROOT.parents[1] / "work/venv/bin/python",
    ]
    return next((str(path) for path in candidates if path.exists()), sys.executable)


def dependencies(python, ai):
    names = ["fastapi", "uvicorn", "jwt"] + (
        ["sentence_transformers", "numpy"] if ai else []
    )
    expression = (
        "import importlib.util; import sys; sys.exit(not all(importlib.util.find_spec(x) for x in "
        + repr(names)
        + "))"
    )
    return (
        subprocess.run([python, "-c", expression], capture_output=True).returncode == 0
    )


def setup(ai):
    python = runtime()
    if dependencies(python, ai):
        return python
    environment = ROOT / ".venv"
    if not environment.exists():
        subprocess.run([sys.executable, "-m", "venv", str(environment)], check=True)
    python = str(
        environment / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    )
    command = [
        python,
        "-m",
        "pip",
        "install",
        "-r",
        str(ROOT / "backend/requirements.txt"),
    ]
    if ai:
        command += ["-r", str(ROOT / "backend/requirements-ai.txt")]
    print(
        "Installing local dependencies. Internet access is required on first setup.",
        flush=True,
    )
    subprocess.run(command, check=True)
    return python


class Frontend(SimpleHTTPRequestHandler):
    def do_GET(self):
        path = urlsplit(self.path).path
        if not Path(self.translate_path(path)).is_file() and not Path(path).suffix:
            self.path = "/index.html"
        super().do_GET()

    def log_message(self, format, *args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--keyword-only",
        action="store_true",
        help="Skip the semantic model and its download",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Check files/dependencies without opening any ports or installing packages",
    )
    args = parser.parse_args()
    dist = ROOT / "frontend/dist"
    if (
        not (dist / "index.html").is_file()
        or not (ROOT / "backend/data/catalog.json.gz").is_file()
    ):
        raise SystemExit("Missing built frontend or prepared catalog. See README.md.")
    if args.check:
        ready = dependencies(runtime(), not args.keyword_only)
        print("Prepared frontend/catalog: OK")
        print(
            "Python dependencies: "
            + ("OK" if ready else "will install on first startup")
        )
        return
    for port in [5173, 8000]:
        with socket.socket() as probe:
            if probe.connect_ex(("127.0.0.1", port)) == 0:
                raise SystemExit(
                    f"Port {port} is already occupied. Stop the existing app before starting another copy."
                )
    python = setup(not args.keyword_only)
    server = ThreadingHTTPServer(
        ("127.0.0.1", 5173), functools.partial(Frontend, directory=str(dist))
    )
    threading.Thread(target=server.serve_forever, daemon=True).start()
    environment = os.environ.copy()
    environment["SEMANTIC_ENABLED"] = "false" if args.keyword_only else "true"
    local_hf = ROOT.parents[1] / "work/huggingface"
    environment.setdefault(
        "HF_HOME",
        str(local_hf if local_hf.is_dir() else ROOT / "backend/.local/huggingface"),
    )
    process = subprocess.Popen(
        [python, "-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"],
        cwd=ROOT / "backend",
        env=environment,
    )
    try:
        print(
            "Preparing the API. The first AI startup may download a model and build embeddings.",
            flush=True,
        )
        while process.poll() is None:
            try:
                with urlopen("http://127.0.0.1:8000/health", timeout=1) as response:
                    health = json.load(response)
                if health["status"] == "ok":
                    print(
                        "\nReady: http://127.0.0.1:5173/\nPress Ctrl+C here to stop both servers.",
                        flush=True,
                    )
                    if not health["semantic_ready"] and not args.keyword_only:
                        print(
                            "AI is unavailable; keyword search and planning work. See backend output for details.",
                            flush=True,
                        )
                    break
            except (URLError, TimeoutError, ConnectionError):
                pass
            time.sleep(0.5)
        process.wait()
    except KeyboardInterrupt:
        print("\nStopping KU-PAS…", flush=True)
    finally:
        server.shutdown()
        server.server_close()
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait()


if __name__ == "__main__":
    main()
