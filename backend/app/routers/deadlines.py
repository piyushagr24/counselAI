from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import DeadlinesResponse
from app.services.deadlines import extract_deadlines
from app.services.llm_client import LLMError

router = APIRouter(prefix="/api/contracts", tags=["deadlines"])


@router.get("/{contract_id}/deadlines", response_model=DeadlinesResponse)
async def get_deadlines(
    contract_id: str,
    force: bool = Query(False, description="Re-run extraction instead of using cached results"),
) -> DeadlinesResponse:
    try:
        result = extract_deadlines(contract_id, force=force)
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return DeadlinesResponse(**result)
