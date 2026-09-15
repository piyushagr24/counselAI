from fastapi import APIRouter, HTTPException, Query, Depends

from app.models.schemas import RiskAnalysisResponse
from app.services.risk_analysis import analyze_risks
from app.services.llm_client import LLMError
from app.routers.auth import get_current_user
from app.routers.upload import verify_contract_access

router = APIRouter(prefix="/api/contracts", tags=["risks"])


@router.get("/{contract_id}/risks", response_model=RiskAnalysisResponse)
def get_risks(
    contract_id: str,
    force: bool = Query(False, description="Re-run analysis instead of using cached results"),
    current_user: dict = Depends(get_current_user),
) -> RiskAnalysisResponse:
    verify_contract_access(contract_id, current_user["id"])
    try:
        result = analyze_risks(contract_id, force=force)
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return RiskAnalysisResponse(**result)
