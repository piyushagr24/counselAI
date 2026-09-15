"""Small defensive parser for structured responses from LLM providers."""
import ast
import json
from typing import Any


def repair_truncated_json(raw: str) -> Any:
    """Attempt to repair truncated JSON objects or arrays caused by token exhaustion.
    Backtracks from the end, closes unclosed strings/keys, and terminates all open containers."""
    text = raw.strip()
    if not text:
        return None

    # Find starting brace or bracket
    start_brace = text.find("{")
    start_bracket = text.find("[")
    if start_brace == -1 and start_bracket == -1:
        return None

    if start_brace != -1 and (start_bracket == -1 or start_brace < start_bracket):
        start = start_brace
    else:
        start = start_bracket

    candidate = text[start:]

    # Try parsing directly with permissive control characters
    try:
        return json.loads(candidate, strict=False)
    except Exception:
        pass

    # If parsing a truncated array of objects, discard any incomplete trailing element
    if start_bracket != -1 and (start_brace == -1 or start_bracket < start_brace):
        last_brace = candidate.rfind("}")
        if last_brace > 0:
            candidate_arr = candidate[:last_brace + 1] + "\n]"
            try:
                res = json.loads(candidate_arr, strict=False)
                if isinstance(res, list):
                    return res
            except Exception:
                pass

    # Backtrack up to 2500 characters from end to find last valid structure
    for cut in range(len(candidate), max(0, len(candidate) - 2500), -1):
        prefix = candidate[:cut].rstrip()
        if not prefix:
            continue

        stack = []
        in_string = False
        escape = False
        for c in prefix:
            if escape:
                escape = False
                continue
            if c == '\\':
                if in_string:
                    escape = True
                continue
            if c == '"':
                in_string = not in_string
                continue
            if not in_string:
                if c in "{[":
                    stack.append(c)
                elif c == "}":
                    if stack and stack[-1] == "{":
                        stack.pop()
                elif c == "]":
                    if stack and stack[-1] == "[":
                        stack.pop()

        if not stack:
            continue

        closing = ""
        if in_string:
            closing += '"'
        for opener in reversed(stack):
            if opener == "{":
                closing += "}"
            elif opener == "[":
                closing += "]"

        test_str = prefix + closing
        try:
            return json.loads(test_str, strict=False)
        except Exception:
            pass

    return None


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
            return json.loads(candidate, strict=False)
        except (json.JSONDecodeError, ValueError) as exc:
            last_error = exc
        try:
            return ast.literal_eval(candidate)
        except (SyntaxError, ValueError) as exc:
            last_error = exc

    # Attempt truncated JSON repair (common when LLMs hit max_tokens)
    repaired = repair_truncated_json(text)
    if repaired is not None:
        return repaired

    raise json.JSONDecodeError(str(last_error), text, 0)


def extract_list_loose(raw: str) -> list:
    """Extract a list from LLM output, unwrapping dict wrappers if necessary,
    with automatic recovery for responses truncated by token limits."""
    data = None
    try:
        data = parse_json_loose(raw)
    except json.JSONDecodeError:
        data = None

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

    # Attempt recovery of truncated JSON arrays (e.g. when LLM hits max_tokens)
    text = raw.strip().replace("```json", "").replace("```JSON", "").replace("```", "").strip()
    start = text.find("[")
    if start >= 0:
        sub = text[start:]
        last_brace = sub.rfind("}")
        if last_brace > 0:
            candidate = sub[:last_brace + 1] + "\n]"
            try:
                recovered = json.loads(candidate)
                if isinstance(recovered, list) and recovered:
                    return recovered
            except Exception:
                try:
                    recovered = ast.literal_eval(candidate)
                    if isinstance(recovered, list) and recovered:
                        return recovered
                except Exception:
                    pass

    return []

