from fastapi import APIRouter, HTTPException, Depends

from app.models.schemas import QuestionRequest, AnswerResponse
from app.services.rag import answer_question
from app.services.llm_client import LLMError
from app.routers.auth import get_current_user
from app.routers.upload import verify_contract_access

router = APIRouter(prefix="/api/contracts", tags=["qa"])


@router.post("/ask", response_model=AnswerResponse)
@router.post("/{contract_id}/ask", response_model=AnswerResponse)
async def ask_question(
    payload: QuestionRequest,
    contract_id: str = "general",
    current_user: dict = Depends(get_current_user),
) -> AnswerResponse:
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question must not be empty.")

    is_general = not contract_id or contract_id.lower() in {"general", "none", "all"}
    if not is_general:
        verify_contract_access(contract_id, current_user["id"])

    try:
        history_dicts = [h.model_dump() for h in payload.history] if payload.history else None
        result = answer_question(contract_id, payload.question, history=history_dicts)
    except LLMError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return AnswerResponse(**result)

