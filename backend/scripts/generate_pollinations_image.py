"""
generate_pollinations_image.py

Generate a free no-auth scenario image through Pollinations.ai.

Usage:
    python scripts/generate_pollinations_image.py
    python scripts/generate_pollinations_image.py "prompt here" output/scene.png
"""

from __future__ import annotations

import sys
import urllib.parse
import urllib.request
from pathlib import Path


DEFAULT_PROMPT = (
    "TEXT-FREE IMAGE. NO WORDS. NO LETTERS. NO SIGNS. "
    "Photorealistic documentary-style image of a security guard in a plain "
    "dark uniform inside a retail store, firmly gripping a customer's arm. "
    "The customer is smaller, defensive, surprised, not resisting. Blurred "
    "merchandise shelves, fluorescent lighting, concerned bystanders in "
    "background. No text, no logos, no weapons, no blood. 16:9 landscape."
)


def generate_pollinations_image(
    prompt: str,
    output_path: Path,
    width: int = 1024,
    height: int = 576,
) -> None:
    """Generate an image via Pollinations.ai (free, no auth) and save as PNG."""
    encoded = urllib.parse.quote(prompt)
    url = (
        f"https://image.pollinations.ai/prompt/{encoded}"
        f"?width={width}&height={height}&nologo=true&model=flux"
    )

    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 SecurePassHackathon/1.0"},
    )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    with urllib.request.urlopen(request, timeout=60) as response:
        output_path.write_bytes(response.read())
    print(f"Saved to {output_path.resolve()}")


def main() -> None:
    prompt = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PROMPT
    output_path = Path(sys.argv[2]) if len(sys.argv) > 2 else Path("output/excessive_force_01.png")
    generate_pollinations_image(prompt, output_path)


if __name__ == "__main__":
    main()
