from fastapi import APIRouter, HTTPException, Query, Depends

from app.models.schemas import ObligationsResponse
from app.services.obligations import extract_obligations
from app.services.llm_client import LLMError
from app.routers.auth import get_current_user
from app.routers.upload import verify_contract_access

router = APIRouter(prefix="/api/contracts", tags=["obligations"])


@router.get("/{contract_id}/obligations", response_model=ObligationsResponse)
async def get_obligations(
    contract_id: str,
    force: bool = Query(False, description="Re-run extraction instead of using cached results"),
    current_user: dict = Depends(get_current_user),
) -> ObligationsResponse:
    verify_contract_access(contract_id, current_user["id"])
    try:
        result = extract_obligations(contract_id, force=force)
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return ObligationsResponse(**result)
