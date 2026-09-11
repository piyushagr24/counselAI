"""Stub for future CUAD/LEDGAR data preparation. Not implemented.

Intended eventual shape:
  load_cuad() / load_ledgar() -> raw label-diverse clause examples
  map_labels_to_categories()  -> remap dataset-specific labels onto
                                  app.services.classifier.CLAUSE_CATEGORIES
  build_training_dataset()    -> HF Dataset ready for Trainer

None of this is implemented yet — see backend/train/README.md.
"""


def load_cuad(path: str):
    raise NotImplementedError("CUAD loading not implemented yet.")


def load_ledgar(path: str):
    raise NotImplementedError("LEDGAR loading not implemented yet.")


def map_labels_to_categories(examples):
    """Will map dataset-native labels onto CLAUSE_CATEGORIES. Not implemented."""
    raise NotImplementedError


def build_training_dataset(*sources):
    raise NotImplementedError("Training dataset assembly not implemented yet.")


if __name__ == "__main__":
    raise SystemExit(
        "This is a structure stub for future fine-tuning data prep — not a runnable script yet."
    )
