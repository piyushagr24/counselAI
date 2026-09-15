from fastapi import APIRouter, HTTPException, Depends

from app.models.schemas import SummaryResponse
from app.services.summarization import summarize_contract
from app.services.llm_client import LLMError
from app.routers.auth import get_current_user
from app.routers.upload import verify_contract_access

router = APIRouter(prefix="/api/contracts", tags=["summary"])


@router.get("/{contract_id}/summary", response_model=SummaryResponse)
def get_contract_summary(
    contract_id: str,
    force: bool = False,
    current_user: dict = Depends(get_current_user),
) -> SummaryResponse:
    verify_contract_access(contract_id, current_user["id"])
    try:
        result = summarize_contract(contract_id, force=force)
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return SummaryResponse(**result)
