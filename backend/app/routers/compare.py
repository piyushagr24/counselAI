from fastapi import APIRouter, UploadFile, File, HTTPException, Depends

from app.models.schemas import ComparisonResponse, CompareByIdRequest
from app.services.contract_ingestion import ingest_contract
from app.services.comparison import compare_contracts
from app.services.llm_client import LLMError
from app.routers.auth import get_current_user
from app.routers.upload import verify_contract_access

router = APIRouter(prefix="/api/contracts", tags=["compare"])


@router.post("/compare", response_model=ComparisonResponse)
async def compare_two_contracts(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
) -> ComparisonResponse:
    try:
        result_a = ingest_contract(file_a, user_id=current_user["id"])
    finally:
        await file_a.close()
    try:
        result_b = ingest_contract(file_b, user_id=current_user["id"])
    finally:
        await file_b.close()

    try:
        result = compare_contracts(result_a["contract_id"], result_b["contract_id"])
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return ComparisonResponse(**result)


@router.post("/compare-ids", response_model=ComparisonResponse)
async def compare_two_contracts_by_id(
    payload: CompareByIdRequest,
    current_user: dict = Depends(get_current_user),
) -> ComparisonResponse:
    verify_contract_access(payload.contract_a_id, current_user["id"])
    verify_contract_access(payload.contract_b_id, current_user["id"])

    try:
        result = compare_contracts(payload.contract_a_id, payload.contract_b_id)
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return ComparisonResponse(**result)
