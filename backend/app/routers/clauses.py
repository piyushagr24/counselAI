from fastapi import APIRouter, Query

from app.models.schemas import ClausesResponse
from app.services.clause_classification import classify_contract

router = APIRouter(prefix="/api/contracts", tags=["clauses"])


@router.get("/{contract_id}/clauses", response_model=ClausesResponse)
async def get_clauses(
    contract_id: str,
    force: bool = Query(False, description="Re-run classification instead of using cached results"),
) -> ClausesResponse:
    result = classify_contract(contract_id, force=force)
    return ClausesResponse(**result)
