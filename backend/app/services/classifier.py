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
from functools import lru_cache
from typing import Tuple

from app.core.config import settings

CLAUSE_CATEGORIES = [
    "Payment",
    "Confidentiality",
    "Termination",
    "Intellectual Property",
    "Liability",
    "Arbitration",
    "Warranty",
    "Indemnification",
    "Non-compete",
    "Non-solicitation",
    "Governing Law",
    "Other",
]

_KEYWORD_MAP = {
    "Payment": ["payment", "invoice", "fee", "compensation"],
    "Confidentiality": ["confidential", "non-disclosure", "proprietary information"],
    "Termination": ["terminat", "expiration of this agreement"],
    "Intellectual Property": ["intellectual property", "copyright", "patent", "trademark"],
    "Liability": ["limitation of liability", "liable", "damages"],
    "Arbitration": ["arbitration", "arbitrator", "dispute resolution"],
    "Warranty": ["warrant", "representations and warranties"],
    "Indemnification": ["indemnify", "indemnification", "hold harmless"],
    "Non-compete": ["non-compete", "noncompete", "restraint of trade"],
    "Non-solicitation": ["non-solicitation", "solicit"],
    "Governing Law": ["governing law", "governed by the laws", "jurisdiction", "venue"],
}


class ClauseClassifier:
    """Interface every backend implements."""

    method_name = "base"

    def classify(self, text: str) -> Tuple[str, float]:
        raise NotImplementedError


class KeywordFallbackClassifier(ClauseClassifier):
    """Rule-based dev fallback. NOT a trained model — used only when no
    transformer backend could be loaded."""

    method_name = "keyword_fallback"

    def classify(self, text: str) -> Tuple[str, float]:
        lowered = text.lower()
        for category, keywords in _KEYWORD_MAP.items():
            if any(kw in lowered for kw in keywords):
                return category, 0.5  # fixed placeholder confidence, not a real probability
        return "Other", 0.0


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
    if settings.fine_tuned_model_path:
        try:
            return FineTunedTransformerClassifier(settings.fine_tuned_model_path)
        except Exception:
            pass  # fall through

    try:
        return ZeroShotTransformerClassifier(settings.classification_model)
    except Exception:
        return KeywordFallbackClassifier()
