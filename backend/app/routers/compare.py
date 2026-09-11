from fastapi import APIRouter, UploadFile, File, HTTPException

from app.models.schemas import ComparisonResponse, CompareByIdRequest
from app.services.contract_ingestion import ingest_contract
from app.services.comparison import compare_contracts
from app.services.llm_client import LLMError

router = APIRouter(prefix="/api/contracts", tags=["compare"])


@router.post("/compare", response_model=ComparisonResponse)
async def compare_two_contracts(
    file_a: UploadFile = File(...),
    file_b: UploadFile = File(...),
) -> ComparisonResponse:
    try:
        result_a = ingest_contract(file_a)
    finally:
        await file_a.close()
    try:
        result_b = ingest_contract(file_b)
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
) -> ComparisonResponse:
    try:
        result = compare_contracts(payload.contract_a_id, payload.contract_b_id)
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return ComparisonResponse(**result)
