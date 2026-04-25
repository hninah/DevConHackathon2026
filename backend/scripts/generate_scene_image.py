"""
generate_scene_image.py

Generates a photorealistic scenario image using Pollinations.ai.

Used for F11b: scenario stem images with no embedded text.

Usage:
    python scripts/generate_scene_image.py "prompt here" output/filename.png
"""

from __future__ import annotations

import sys
import base64
from pathlib import Path

SRC_DIR = Path(__file__).resolve().parents[1] / "src"
if str(SRC_DIR) not in sys.path:
    sys.path.insert(0, str(SRC_DIR))

from scene_image_pollinations import POLLINATIONS_MODEL, generate_scene_png_b64


def main() -> None:
    if len(sys.argv) < 3:
        print('Usage: python scripts/generate_scene_image.py "prompt" output/path.png')
        sys.exit(1)

    prompt = sys.argv[1]
    output_path = Path(sys.argv[2])

    print(f"Generating image with Pollinations model {POLLINATIONS_MODEL}...")
    print(f"Prompt: {prompt[:120]}{'...' if len(prompt) > 120 else ''}")

    try:
        image_b64, _used_prompt = generate_scene_png_b64(prompt)
    except RuntimeError as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(base64.b64decode(image_b64))
    print(f"Saved image to {output_path.resolve()}")


if __name__ == "__main__":
    main()
