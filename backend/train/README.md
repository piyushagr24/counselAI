# Future clause-classifier fine-tuning (not implemented yet)

No fine-tuned model exists in this project. The live classifier uses a
pretrained NLI model zero-shot (`app/services/classifier.py`,
`ZeroShotTransformerClassifier`) or a keyword fallback if that can't load.

This folder is a **structure stub only** — enough to build a real fine-tuning
pipeline later without redesigning anything, not a working trainer.

## Plan
1. **Data**: CUAD (Contract Understanding Atticus Dataset) and/or LEDGAR —
   both provide clause-level text labeled by category. Map their label sets
   onto `CLAUSE_CATEGORIES` in `app/services/classifier.py` (see
   `prepare_data.py` for the mapping stub).
2. **Base model**: a LegalBERT or RoBERTa checkpoint
   (e.g. `nlpaueb/legal-bert-base-uncased`) fine-tuned as a sequence
   classifier with `num_labels = len(CLAUSE_CATEGORIES)`.
3. **Training**: standard HF `Trainer` fine-tuning loop (see
   `train_classifier.py` stub — intentionally not implemented).
4. **Plugging it in**: once trained, save the checkpoint locally and set
   `FINE_TUNED_MODEL_PATH=/path/to/checkpoint` in `.env`.
   `get_classifier()` in `app/services/classifier.py` will pick it up
   automatically and take priority over the zero-shot model — no other code
   changes needed.

## Honesty note
Until steps 1–3 above are actually done, do not set `FINE_TUNED_MODEL_PATH`
and do not describe the running classifier as "fine-tuned" or "trained on
legal data" — it isn't.
