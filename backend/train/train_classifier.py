"""Stub for future clause-classifier fine-tuning. Not implemented.

Intended eventual shape:
  - Load a dataset built by prepare_data.build_training_dataset()
  - Fine-tune a LegalBERT/RoBERTa checkpoint via HF Trainer with
    num_labels = len(CLAUSE_CATEGORIES)
  - Save the resulting checkpoint to a local directory
  - Point FINE_TUNED_MODEL_PATH in .env at that directory

No training is implemented here. Do not run this expecting a trained model.
See backend/train/README.md.
"""
import argparse


def main():
    parser = argparse.ArgumentParser(description="[NOT IMPLEMENTED] Fine-tune a clause classifier.")
    parser.add_argument("--base-model", default="nlpaueb/legal-bert-base-uncased")
    parser.add_argument("--output-dir", default="./checkpoints/clause-classifier")
    parser.parse_args()

    raise NotImplementedError(
        "Fine-tuning is not implemented yet — this is a structure stub. "
        "See backend/train/README.md for the plan."
    )


if __name__ == "__main__":
    main()
