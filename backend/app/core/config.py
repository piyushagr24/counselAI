from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    upload_dir: str = "./uploads"
    max_upload_mb: int = 15
    database_url: str = ""
    chroma_persist_dir: str = "./chroma_db"
    llm_provider: str = "groq"
    groq_api_key: str = ""
    groq_base_url: str = "https://api.groq.com/openai/v1"
    anthropic_api_key: str = ""
    openai_api_key: str = ""
    openai_base_url: str = "https://api.openai.com/v1"
    gemini_api_key: str = ""
    google_api_key: str = ""
    gemini_base_url: str = "https://generativelanguage.googleapis.com/v1beta"
    mock_fallback: bool = True
    llm_model: str = "qwen/qwen3.8-27b"
    embedding_model: str = "sentence-transformers/all-MiniLM-L6-v2"
    chunk_size: int = 800
    chunk_overlap: int = 100
    classification_model: str = "valhalla/distilbart-mnli-12-3"
    classification_backend: str = "llm"
    fine_tuned_model_path: str = ""
    risk_model_path: str = ""  # future: path to a trained risk-classification model, if any
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    @field_validator("llm_provider", "llm_model", "groq_api_key", "anthropic_api_key", "openai_api_key", "gemini_api_key", "google_api_key", mode="before")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        return v.strip() if isinstance(v, str) else v


settings = Settings()
