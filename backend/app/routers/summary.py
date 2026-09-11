from fastapi import APIRouter, HTTPException

from app.models.schemas import SummaryResponse
from app.services.summarization import summarize_contract
from app.services.llm_client import LLMError

router = APIRouter(prefix="/api/contracts", tags=["summary"])


@router.get("/{contract_id}/summary", response_model=SummaryResponse)
async def get_contract_summary(contract_id: str, force: bool = False) -> SummaryResponse:
    try:
        result = summarize_contract(contract_id, force=force)
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return SummaryResponse(**result)
