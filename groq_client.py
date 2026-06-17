"""
groq_client.py — Centralised Groq API wrapper.
All LLM calls in the project go through here.
"""

import os
import json
import re
import time
import random
import logging
from groq import Groq

logger = logging.getLogger(__name__)

_client: Groq | None = None

# Best Groq model for multi-step legal reasoning
GROQ_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct"

# Rate limiting
_last_request_time = 0
_min_request_interval = 3.0  # Minimum 3 seconds between requests


def get_client() -> Groq:
    global _client
    if _client is None:
        api_key = os.environ.get("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError("GROQ_API_KEY environment variable not set")
        _client = Groq(api_key=api_key)
    return _client


def chat(system: str, user: str, max_tokens: int = 4096, retries: int = 3) -> str:
    """
    Send a chat completion to Groq.
    Returns the raw string response.
    Retries with exponential backoff on rate limits.
    """
    global _last_request_time
    
    client = get_client()

    for attempt in range(retries):
        try:
            # Enforce minimum time between requests
            elapsed = time.time() - _last_request_time
            if elapsed < _min_request_interval:
                sleep_time = _min_request_interval - elapsed
                logger.debug(f"Rate limiting: waiting {sleep_time:.2f}s before next request")
                time.sleep(sleep_time)
            
            _last_request_time = time.time()
            
            response = client.chat.completions.create(
                model=GROQ_MODEL,
                max_tokens=max_tokens,
                temperature=0.1,
                messages=[
                    {"role": "system", "content": system},
                    {"role": "user",   "content": user},
                ],
            )
            return response.choices[0].message.content or ""

        except Exception as e:
            error_msg = str(e)
            
            # Check if it's a rate limit error (429)
            if "429" in error_msg or "rate_limit" in error_msg.lower():
                # Try to parse suggested wait time from error message
                wait_match = re.search(r'Please try again in ([\d\.]+)([mhs]?)', error_msg)
                if wait_match:
                    value = float(wait_match.group(1))
                    unit = wait_match.group(2)
                    if unit == 'm':
                        wait = value * 60
                    elif unit == 'h':
                        wait = value * 3600
                    else:
                        wait = value
                    wait = min(wait, 300)  # Cap at 5 minutes
                else:
                    # Exponential backoff with jitter
                    wait = min((2 ** attempt) * 30 + random.uniform(0, 10), 300)
                
                if attempt < retries - 1:
                    logger.warning(f"Rate limit hit. Waiting {wait:.0f}s before retry {attempt + 2}/{retries}")
                    time.sleep(wait)
                    continue
                else:
                    logger.error(f"Rate limit persists after {retries} retries")
                    raise
            else:
                # Non-rate-limit error
                if attempt < retries - 1:
                    wait = (attempt + 1) * 5
                    logger.warning(f"Groq attempt {attempt + 1} failed: {e}. Retrying in {wait}s…")
                    time.sleep(wait)
                else:
                    logger.error(f"Groq failed after {retries} attempts: {e}")
                    raise


def parse_json(raw: str) -> dict:
    """
    Robustly parse JSON from LLM output.
    Strips markdown fences and trailing garbage.
    """
    cleaned = re.sub(r"```(?:json)?\s*", "", raw).strip().rstrip("`").strip()

    # Trim to last closing brace in case the model appended commentary
    last = cleaned.rfind("}")
    if last != -1:
        cleaned = cleaned[: last + 1]

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError as e:
        logger.error(f"JSON parse error: {e}\nRaw (first 500 chars):\n{raw[:500]}")
        raise ValueError(f"LLM returned invalid JSON: {e}")