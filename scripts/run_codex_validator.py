#!/usr/bin/env python3
"""Run the installed official Codex validators in an isolated local venv."""

from __future__ import annotations

import argparse
import hashlib
import os
from pathlib import Path
import subprocess
import sys
import venv


PROJECT_ROOT = Path(__file__).resolve().parents[1]
REQUIREMENTS = PROJECT_ROOT / "requirements-validator.txt"
VENV_ROOT = (
    PROJECT_ROOT
    / ".cache"
    / f"codex-validator-cpython-{sys.version_info.major}.{sys.version_info.minor}"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run an official Codex plugin or skill validator."
    )
    parser.add_argument("kind", choices=("plugin", "skill"))
    return parser.parse_args()


def venv_python() -> Path:
    executable = "python.exe" if os.name == "nt" else "python"
    return VENV_ROOT / ("Scripts" if os.name == "nt" else "bin") / executable


def requirements_digest() -> str:
    return hashlib.sha256(REQUIREMENTS.read_bytes()).hexdigest()


def dependency_is_current(python: Path) -> bool:
    marker = VENV_ROOT / ".requirements.sha256"
    if not python.is_file() or not marker.is_file():
        return False
    if marker.read_text(encoding="utf-8").strip() != requirements_digest():
        return False
    check = subprocess.run(
        [str(python), "-c", "import yaml; assert yaml.__version__ == '6.0.3'"],
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return check.returncode == 0


def ensure_validator_environment() -> Path:
    python = venv_python()
    if dependency_is_current(python):
        return python

    if not python.is_file():
        VENV_ROOT.parent.mkdir(parents=True, exist_ok=True)
        venv.EnvBuilder(with_pip=True).create(VENV_ROOT)

    print(
        "Bootstrapping the pinned Codex validator dependency in .cache/; "
        "the first run requires access to PyPI.",
        file=sys.stderr,
    )
    subprocess.run(
        [
            str(python),
            "-m",
            "pip",
            "install",
            "--disable-pip-version-check",
            "--require-hashes",
            "--no-binary",
            "PyYAML",
            "--no-deps",
            "--requirement",
            str(REQUIREMENTS),
        ],
        cwd=PROJECT_ROOT,
        check=True,
    )
    (VENV_ROOT / ".requirements.sha256").write_text(
        f"{requirements_digest()}\n", encoding="utf-8"
    )
    return python


def validator_command(kind: str, python: Path) -> list[str]:
    codex_home = Path(os.environ.get("CODEX_HOME", Path.home() / ".codex")).expanduser()
    if kind == "plugin":
        validator = (
            codex_home
            / "skills"
            / ".system"
            / "plugin-creator"
            / "scripts"
            / "validate_plugin.py"
        )
        target = PROJECT_ROOT / "plugins" / "telic"
    else:
        validator = (
            codex_home
            / "skills"
            / ".system"
            / "skill-creator"
            / "scripts"
            / "quick_validate.py"
        )
        target = PROJECT_ROOT / "plugins" / "telic" / "skills" / "telic"

    if not validator.is_file():
        raise FileNotFoundError(
            f"Official {kind} validator not found at {validator}. "
            "Install the Codex system skills or set CODEX_HOME."
        )
    return [str(python), str(validator), str(target)]


def main() -> int:
    args = parse_args()
    try:
        python = ensure_validator_environment()
        completed = subprocess.run(
            validator_command(args.kind, python), cwd=PROJECT_ROOT, check=False
        )
        return completed.returncode
    except (FileNotFoundError, OSError, subprocess.CalledProcessError) as error:
        print(f"Validator setup failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
