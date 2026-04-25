"""
scene_image_pollinations.py

Shared Pollinations.ai image-generation helpers for SecurePass scene images.
"""

from __future__ import annotations

import base64
import urllib.parse
import urllib.request

POLLINATIONS_BASE_URL = "https://image.pollinations.ai/prompt"
POLLINATIONS_MODEL = "flux"
POLLINATIONS_WIDTH = 1024
POLLINATIONS_HEIGHT = 576
POLLINATIONS_TIMEOUT_SECONDS = 60


def _compact_prompt(prompt: str) -> str:
    """Make the prompt URL-friendly while keeping the visual instructions."""
    return " ".join(prompt.split())


def generate_scene_png_b64(prompt: str) -> tuple[str, str]:
    """Generate a scene image and return (base64_image, prompt_used)."""
    used_prompt = _compact_prompt(prompt)
    if not used_prompt:
        raise ValueError("Image prompt cannot be empty.")

    encoded_prompt = urllib.parse.quote(used_prompt)
    query = urllib.parse.urlencode({
        "width": POLLINATIONS_WIDTH,
        "height": POLLINATIONS_HEIGHT,
        "nologo": "true",
        "model": POLLINATIONS_MODEL,
    })
    url = f"{POLLINATIONS_BASE_URL}/{encoded_prompt}?{query}"

    request = urllib.request.Request(
        url,
        headers={"User-Agent": "Mozilla/5.0 SecurePassHackathon/1.0"},
    )

    try:
        with urllib.request.urlopen(request, timeout=POLLINATIONS_TIMEOUT_SECONDS) as response:
            image_bytes = response.read()
    except Exception as error:
        message = str(error).splitlines()[0][:700]
        raise RuntimeError(f"Pollinations image generation failed: {message}") from error

    if not image_bytes:
        raise RuntimeError("Pollinations image generation returned an empty image.")

    return base64.b64encode(image_bytes).decode("ascii"), used_prompt
