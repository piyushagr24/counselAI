from fastapi import APIRouter, HTTPException, Query

from app.models.schemas import RiskAnalysisResponse
from app.services.risk_analysis import analyze_risks
from app.services.llm_client import LLMError

router = APIRouter(prefix="/api/contracts", tags=["risks"])


@router.get("/{contract_id}/risks", response_model=RiskAnalysisResponse)
async def get_risks(
    contract_id: str,
    force: bool = Query(False, description="Re-run analysis instead of using cached results"),
) -> RiskAnalysisResponse:
    try:
        result = analyze_risks(contract_id, force=force)
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return RiskAnalysisResponse(**result)
