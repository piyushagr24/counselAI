from fastapi import APIRouter, Query, Depends

from app.models.schemas import ClausesResponse
from app.services.clause_classification import classify_contract
from app.routers.auth import get_current_user
from app.routers.upload import verify_contract_access

router = APIRouter(prefix="/api/contracts", tags=["clauses"])


@router.get("/{contract_id}/clauses", response_model=ClausesResponse)
async def get_clauses(
    contract_id: str,
    force: bool = Query(False, description="Re-run classification instead of using cached results"),
    current_user: dict = Depends(get_current_user),
) -> ClausesResponse:
    verify_contract_access(contract_id, current_user["id"])
    result = classify_contract(contract_id, force=force)
    return ClausesResponse(**result)
