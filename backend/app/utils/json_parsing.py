"""Small defensive parser for structured responses from LLM providers."""
import ast
import json
from typing import Any


def parse_json_loose(raw: str) -> Any:
    text = raw.strip().replace("```json", "").replace("```JSON", "").replace("```", "").strip()
    candidates = [text]
    for opening, closing in (("{", "}"), ("[", "]")):
        start, end = text.find(opening), text.rfind(closing)
        if start >= 0 and end > start:
            candidates.append(text[start : end + 1])
    last_error = None
    for candidate in candidates:
        try:
            return json.loads(candidate)
        except json.JSONDecodeError as exc:
            last_error = exc
        try:
            return ast.literal_eval(candidate)
        except (SyntaxError, ValueError) as exc:
            last_error = exc
    raise json.JSONDecodeError(str(last_error), text, 0)


def extract_list_loose(raw: str) -> list:
    """Extract a list from LLM output, unwrapping dict wrappers if necessary."""
    try:
        data = parse_json_loose(raw)
    except json.JSONDecodeError:
        return []

    if isinstance(data, list):
        return data

    if isinstance(data, dict):
        # Check common container keys
        for key in ("risks", "obligations", "deadlines", "items", "findings", "data", "results"):
            if key in data and isinstance(data[key], list):
                return data[key]
        # Fallback: first list value in the dict
        for val in data.values():
            if isinstance(val, list):
                return val

    return []

