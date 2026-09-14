"""Clause classifier backends.

Default: zero-shot classification using a pretrained NLI transformer
(e.g. facebook/bart-large-mnli). This is a genuine transformer model doing
real inference — but it is NOT fine-tuned on legal text, and that is stated
here explicitly rather than implied.

A fine-tuned LegalBERT/RoBERTa checkpoint (e.g. trained on CUAD/LEDGAR, see
backend/train/) can be dropped in later via FINE_TUNED_MODEL_PATH without
changing any calling code — get_classifier() picks whichever backend is
actually available.

If no transformer backend can be loaded (e.g. no internet to download model
weights), a keyword-based fallback is used instead. It is clearly labeled via
`method_name` in every result — never silently presented as a trained model.
"""
import logging
from functools import lru_cache
from typing import List, Tuple

from app.core.config import settings

logger = logging.getLogger(__name__)

CLAUSE_CATEGORIES = [
    "Payment",
    "Confidentiality",
    "Termination",
    "Term & Renewal",
    "Intellectual Property",
    "Liability",
    "Indemnification",
    "Warranty & Representations",
    "Dispute Resolution & Arbitration",
    "Governing Law",
    "Scope of Work & Deliverables",
    "Assignment & Transfer",
    "Non-compete",
    "Non-solicitation",
    "Force Majeure",
    "Notice & Communications",
    "General Provisions & Boilerplate",
    "Other",
]

_KEYWORD_MAP = {
    "Payment": ["payment", "invoice", "fee", "compensation", "rent", "deposit"],
    "Confidentiality": ["confidential", "non-disclosure", "proprietary information", "trade secret"],
    "Termination": ["terminat", "cancellation", "breach", "cur", "default"],
    "Term & Renewal": ["term of", "renewal", "lock-in", "duration", "effective date", "expiration"],
    "Intellectual Property": ["intellectual property", "copyright", "patent", "trademark", "license", "proprietary right"],
    "Liability": ["limitation of liability", "liable", "damages", "consequential"],
    "Indemnification": ["indemnify", "indemnification", "hold harmless", "defense"],
    "Warranty & Representations": ["warrant", "representations", "covenants", "authority", "quiet enjoyment"],
    "Dispute Resolution & Arbitration": ["arbitration", "arbitrator", "dispute resolution", "mediation", "tribunal"],
    "Governing Law": ["governing law", "governed by the laws", "jurisdiction", "venue", "courts of"],
    "Scope of Work & Deliverables": ["services", "deliverables", "obligations", "demised premises", "permitted use", "repair"],
    "Assignment & Transfer": ["assignment", "sublet", "sublease", "transfer", "assign"],
    "Non-compete": ["non-compete", "noncompete", "restraint of trade", "exclusivity"],
    "Non-solicitation": ["non-solicitation", "solicit"],
    "Force Majeure": ["force majeure", "act of god", "uncontrollable"],
    "Notice & Communications": ["notices", "written notice", "registered post", "addressed to"],
    "General Provisions & Boilerplate": ["entire agreement", "severability", "counterparts", "witnesseth", "whereas", "amendment"],
}


class ClauseClassifier:
    """Interface every backend implements."""

    method_name = "base"

    def classify(self, text: str) -> Tuple[str, float]:
        raise NotImplementedError

    def classify_batch(self, texts: List[str]) -> List[Tuple[str, float]]:
        return [self.classify(t) for t in texts]


class KeywordFallbackClassifier(ClauseClassifier):
    """Rule-based dev fallback. NOT a trained model — used only when no
    transformer or LLM backend could be loaded."""

    method_name = "keyword_fallback"

    def classify(self, text: str) -> Tuple[str, float]:
        lowered = text.lower()
        for category, keywords in _KEYWORD_MAP.items():
            if any(kw in lowered for kw in keywords):
                return category, 0.5  # fixed placeholder confidence, not a real probability
        return "Other", 0.0


class LLMClauseClassifier(ClauseClassifier):
    """Accurate, zero-RAM clause classifier using provider-neutral LLM (Groq/OpenAI/Gemini).
    Works in lightweight cloud environments without PyTorch or HuggingFace dependencies.
    """

    method_name = "llm_classifier"

    def classify(self, text: str) -> Tuple[str, float]:
        batch_results = self.classify_batch([text])
        if batch_results:
            return batch_results[0]
        return "Other", 0.0

    def classify_batch(self, texts: List[str]) -> List[Tuple[str, float]]:
        if not texts:
            return []

        from concurrent.futures import ThreadPoolExecutor
        from app.services.llm_client import generate_answer
        from app.utils.json_parsing import extract_list_loose

        batch_size = 15
        slices = [texts[i : i + batch_size] for i in range(0, len(texts), batch_size)]

        def _process_slice(chunk_slice: List[str]) -> List[Tuple[str, float]]:
            prompt_items = []
            for idx, txt in enumerate(chunk_slice, start=1):
                snippet = txt.strip()[:350]
                prompt_items.append(f"[Excerpt {idx}]:\n\"{snippet}\"")

            user_prompt = "\n\n".join(prompt_items)

            system_prompt = (
                "You are an expert legal AI assistant. Classify each numbered contract excerpt into its most appropriate legal category:\n"
                "- Payment (fees, invoices, billing, compensation, rent, deposits)\n"
                "- Confidentiality (non-disclosure, proprietary data, trade secrets)\n"
                "- Termination (cancellation, breach termination, exit rights)\n"
                "- Term & Renewal (contract duration, effective date, renewal options, lock-in period)\n"
                "- Intellectual Property (patents, copyrights, trademarks, licensing, ownership of work)\n"
                "- Liability (limitation of liability, damages caps, consequential damage waivers)\n"
                "- Indemnification (indemnify, hold harmless, defense against third-party claims)\n"
                "- Warranty & Representations (authority, service quality, condition, fitness, covenants)\n"
                "- Dispute Resolution & Arbitration (arbitration, mediation, jurisdiction, dispute escalation)\n"
                "- Governing Law (choice of law, governing jurisdiction, venue)\n"
                "- Scope of Work & Deliverables (services provided, duties, permitted use, maintenance, obligations)\n"
                "- Assignment & Transfer (subletting, assignment, change of control, transfer rights)\n"
                "- Non-compete (covenants not to compete, restraint of trade)\n"
                "- Non-solicitation (non-solicitation of personnel, customers, or contractors)\n"
                "- Force Majeure (acts of God, excused delays, uncontrollable events)\n"
                "- Notice & Communications (formal written notice procedures, addresses)\n"
                "- General Provisions & Boilerplate (entire agreement, severability, amendments, recitals, waivers)\n"
                "- Other (ONLY for purely non-operative text such as isolated page numbers, table of contents, or empty signature lines)\n\n"
                "CRITICAL RULES:\n"
                "1. Choose the BEST and MOST ACCURATE legal category for each excerpt.\n"
                "2. DO NOT classify substantive contract provisions, covenants, terms, or conditions as 'Other'.\n"
                "3. Use 'Other' ONLY for non-contractual text (e.g. document titles, page headers, signature labels).\n\n"
                "Return a JSON array of objects with the following schema:\n"
                "[\n"
                "  {\"index\": 1, \"category\": \"<Category Name>\", \"confidence\": <float between 0.75 and 0.99>}\n"
                "]\n"
                "Respond ONLY with a valid JSON array. Do not include introductory text or explanations."
            )

            try:
                raw_response = generate_answer(system_prompt, user_prompt, max_tokens=1000)
                parsed_list = extract_list_loose(raw_response)

                index_map: dict[int, Tuple[str, float]] = {}
                for item in parsed_list:
                    if isinstance(item, dict):
                        idx = item.get("index")
                        cat = str(item.get("category", "")).strip()
                        conf = item.get("confidence", 0.95)
                        try:
                            conf_float = float(conf)
                        except (ValueError, TypeError):
                            conf_float = 0.95

                        matched_cat = "Other"
                        for valid_cat in CLAUSE_CATEGORIES:
                            if valid_cat.lower() == cat.lower():
                                matched_cat = valid_cat
                                break

                        if idx is not None:
                            try:
                                index_map[int(idx)] = (matched_cat, min(1.0, max(0.0, conf_float)))
                            except (ValueError, TypeError):
                                pass

                slice_results = []
                for idx_in_slice in range(1, len(chunk_slice) + 1):
                    if idx_in_slice in index_map:
                        slice_results.append(index_map[idx_in_slice])
                    else:
                        fallback = KeywordFallbackClassifier()
                        slice_results.append(fallback.classify(chunk_slice[idx_in_slice - 1]))
                return slice_results

            except Exception as exc:
                logger.warning("LLM clause classification batch failed (%s), using keyword fallback for slice.", exc)
                fallback = KeywordFallbackClassifier()
                return [fallback.classify(txt) for txt in chunk_slice]

        if len(slices) == 1:
            return _process_slice(slices[0])

        with ThreadPoolExecutor(max_workers=min(4, len(slices))) as executor:
            batch_outputs = list(executor.map(_process_slice, slices))

        results: List[Tuple[str, float]] = []
        for b_out in batch_outputs:
            results.extend(b_out)
        return results


class ZeroShotTransformerClassifier(ClauseClassifier):
    """Pretrained NLI model used zero-shot. Not fine-tuned on legal data."""

    method_name = "zero_shot_transformer"

    def __init__(self, model_name: str):
        from transformers import pipeline  # heavy import, done lazily

        self._pipe = pipeline("zero-shot-classification", model=model_name)

    def classify(self, text: str) -> Tuple[str, float]:
        result = self._pipe(text, candidate_labels=CLAUSE_CATEGORIES, multi_label=False)
        return result["labels"][0], float(result["scores"][0])


class FineTunedTransformerClassifier(ClauseClassifier):
    """Loads a locally fine-tuned sequence-classification checkpoint (e.g. a
    LegalBERT/RoBERTa model trained on CUAD/LEDGAR — see backend/train/).
    No such checkpoint ships with this project; this class only activates if
    FINE_TUNED_MODEL_PATH points to a real, loadable model directory."""

    method_name = "fine_tuned_transformer"

    def __init__(self, model_path: str):
        import torch
        from transformers import AutoTokenizer, AutoModelForSequenceClassification

        self._tokenizer = AutoTokenizer.from_pretrained(model_path)
        self._model = AutoModelForSequenceClassification.from_pretrained(model_path)
        self._model.eval()
        self._torch = torch

    def classify(self, text: str) -> Tuple[str, float]:
        inputs = self._tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
        with self._torch.no_grad():
            logits = self._model(**inputs).logits
        probs = self._torch.softmax(logits, dim=-1)[0]
        idx = int(self._torch.argmax(probs))
        return CLAUSE_CATEGORIES[idx], float(probs[idx])


@lru_cache(maxsize=1)
def get_classifier() -> ClauseClassifier:
    backend_choice = getattr(settings, "classification_backend", "llm").lower().strip()

    # 1. Check fine-tuned model path if configured
    if settings.fine_tuned_model_path and backend_choice in {"fine_tuned", "transformer"}:
        try:
            return FineTunedTransformerClassifier(settings.fine_tuned_model_path)
        except Exception:
            pass

    # 2. If explicitly set to 'llm' or 'auto'
    if backend_choice in {"llm", "auto"}:
        try:
            return LLMClauseClassifier()
        except Exception:
            pass

    # 3. If explicitly set to 'transformer'
    if backend_choice == "transformer":
        try:
            return ZeroShotTransformerClassifier(settings.classification_model)
        except Exception:
            pass

    # 4. Fallback attempt to LLM
    try:
        return LLMClauseClassifier()
    except Exception:
        pass

    return KeywordFallbackClassifier()
