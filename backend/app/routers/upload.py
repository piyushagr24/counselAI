import json
import logging
import math
import time
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, UploadFile, File, HTTPException, Depends, BackgroundTasks

from app.core.config import settings
from app.routers.auth import get_current_user
from app.models.schemas import (
    ContractDetails,
    ContractMetadata,
    UploadResponse,
    DashboardStatsResponse,
    DashboardRiskItem,
    DashboardDeadlineItem,
    DashboardObligationItem,
)
from app.services.contract_ingestion import ingest_contract
from app.services.vector_store import delete_chunks
from app.services.summarization import summarize_contract
from app.services.risk_analysis import analyze_risks
from app.services.obligations import extract_obligations
from app.services.deadlines import extract_deadlines

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/contracts", tags=["upload"])


def _precompute_contract_analyses(contract_id: str):
    """Sequentially warm up contract analyses in the background with pacing to respect Groq rate limits."""
    try:
        time.sleep(1.0)
        logger.info("Starting background pre-computation for contract %s", contract_id)

        # 1. Executive Summary
        try:
            summarize_contract(contract_id)
            time.sleep(1.2)
        except Exception as exc:
            logger.warning("Background summary pre-computation skipped for %s: %s", contract_id, exc)

        # 2. Risk Analysis
        try:
            analyze_risks(contract_id)
            time.sleep(1.2)
        except Exception as exc:
            logger.warning("Background risks pre-computation skipped for %s: %s", contract_id, exc)

        # 3. Obligations Extraction
        try:
            extract_obligations(contract_id)
            time.sleep(1.2)
        except Exception as exc:
            logger.warning("Background obligations pre-computation skipped for %s: %s", contract_id, exc)

        # 4. Deadlines Extraction
        try:
            extract_deadlines(contract_id)
        except Exception as exc:
            logger.warning("Background deadlines pre-computation skipped for %s: %s", contract_id, exc)

        logger.info("Completed background pre-computation for contract %s", contract_id)
    except Exception as exc:
        logger.error("Background pre-computation pipeline error for %s: %s", contract_id, exc)


@router.post("/upload", response_model=UploadResponse)
async def upload_contract(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
) -> UploadResponse:
    try:
        result = ingest_contract(file, user_id=current_user["id"])
        background_tasks.add_task(_precompute_contract_analyses, result["contract_id"])
    finally:
        await file.close()
    return UploadResponse(**result)


def _contract_paths(contract_id: str) -> tuple[Path, Path]:
    """Return the source and extraction paths for a stored contract."""
    upload_dir = Path(settings.upload_dir)
    extraction_path = upload_dir / f"{contract_id}.json"
    source_paths = [
        path for path in upload_dir.glob(f"{contract_id}.*")
        if path != extraction_path and path.is_file()
    ]
    if not extraction_path.is_file() or not source_paths:
        raise HTTPException(status_code=404, detail="Contract not found")
    return source_paths[0], extraction_path


def verify_contract_access(contract_id: str, user_id: str) -> tuple[Path, Path, dict]:
    """Verify that a contract exists and belongs to the specified user."""
    source_path, extraction_path = _contract_paths(contract_id)
    try:
        with extraction_path.open("r", encoding="utf-8") as file:
            extraction = json.load(file)
    except (OSError, json.JSONDecodeError) as exc:
        raise HTTPException(status_code=500, detail=f"Failed to read contract metadata: {exc}")

    if extraction.get("user_id") != user_id:
        raise HTTPException(status_code=404, detail="Contract not found")

    return source_path, extraction_path, extraction


def _read_contract(contract_id: str, user_id: str | None = None) -> ContractDetails:
    if user_id is not None:
        source_path, extraction_path, extraction = verify_contract_access(contract_id, user_id)
    else:
        source_path, extraction_path = _contract_paths(contract_id)
        try:
            with extraction_path.open("r", encoding="utf-8") as file:
                extraction = json.load(file)
        except (OSError, json.JSONDecodeError) as exc:
            raise HTTPException(status_code=500, detail=f"Failed to read contract metadata: {exc}")

    # Inspect cached analysis files if available
    risk_count = 0
    high_risk_count = 0
    parent_dir = extraction_path.parent

    risks_path = parent_dir / f"{contract_id}_risks.json"
    has_risks = risks_path.is_file()
    if has_risks:
        try:
            with risks_path.open("r", encoding="utf-8") as rf:
                rdata = json.load(rf)
                risks = rdata.get("risks", [])
                risk_count = len(risks)
                high_risk_count = sum(1 for r in risks if r.get("severity") in ("High", "Critical"))
        except Exception:
            pass

    has_summary = (parent_dir / f"{contract_id}_summary.json").is_file()
    has_obligations = (parent_dir / f"{contract_id}_obligations.json").is_file()
    has_deadlines = (parent_dir / f"{contract_id}_deadlines.json").is_file()
    has_clauses = (parent_dir / f"{contract_id}_clauses.json").is_file()

    metadata = extraction.get("metadata", {})
    num_pages = metadata.get("num_pages")
    if not num_pages or num_pages <= 0:
        word_count = metadata.get("word_count", 0)
        if not word_count:
            words = extraction.get("full_text", "").split()
            word_count = len(words)
            metadata["word_count"] = word_count
        num_pages = max(1, math.ceil(word_count / 400)) if word_count > 0 else max(1, len(extraction.get("segments", [])))
        metadata["num_pages"] = num_pages
        try:
            with extraction_path.open("w", encoding="utf-8") as file:
                json.dump(extraction, file, indent=2)
        except Exception:
            pass

    contract_metadata = ContractMetadata(
        contract_id=contract_id,
        filename=extraction.get("original_filename", source_path.name),
        size_bytes=extraction.get("size_bytes", source_path.stat().st_size),
        upload_date=extraction.get(
            "upload_date",
            datetime.fromtimestamp(source_path.stat().st_mtime, tz=timezone.utc).isoformat(),
        ),
        num_pages=num_pages,
        num_segments=metadata.get("num_segments", len(extraction.get("segments", []))),
        risk_count=risk_count,
        high_risk_count=high_risk_count,
        has_summary=has_summary,
        has_risks=has_risks,
        has_obligations=has_obligations,
        has_deadlines=has_deadlines,
        has_clauses=has_clauses,
    )
    return ContractDetails(**contract_metadata.model_dump(), extraction=extraction)


@router.get("/stats", response_model=DashboardStatsResponse)
async def get_dashboard_stats(current_user: dict = Depends(get_current_user)) -> DashboardStatsResponse:
    upload_dir = Path(settings.upload_dir)
    if not upload_dir.exists():
        return DashboardStatsResponse(
            total_contracts=0, total_pages=0, total_risks=0, high_risk_count=0,
            total_obligations=0, total_deadlines=0
        )

    contracts = await list_contracts(current_user=current_user)
    user_contract_ids = {c.contract_id for c in contracts}
    contract_filenames = {c.contract_id: c.filename for c in contracts}
    total_pages = sum(c.num_pages or 1 for c in contracts)

    total_risks = 0
    critical_risk_count = 0
    high_risk_count = 0
    medium_risk_count = 0
    low_risk_count = 0
    all_risks: list[DashboardRiskItem] = []

    for cid in user_contract_ids:
        rf_file = upload_dir / f"{cid}_risks.json"
        if not rf_file.is_file():
            continue
        cname = contract_filenames.get(cid, "Contract")
        try:
            with rf_file.open("r", encoding="utf-8") as rf:
                rdata = json.load(rf)
                for r in rdata.get("risks", []):
                    total_risks += 1
                    sev = r.get("severity", "Medium")
                    if sev == "Critical":
                        critical_risk_count += 1
                    elif sev == "High":
                        high_risk_count += 1
                    elif sev == "Medium":
                        medium_risk_count += 1
                    elif sev == "Low":
                        low_risk_count += 1

                    all_risks.append(
                        DashboardRiskItem(
                            contract_id=cid,
                            contract_filename=cname,
                            title=r.get("title", "Untitled Risk"),
                            severity=sev if sev in ("Low", "Medium", "High", "Critical") else "Medium",
                            explanation=r.get("explanation", ""),
                            section=r.get("section"),
                            page_number=r.get("page_number"),
                        )
                    )
        except Exception:
            continue

    sev_rank = {"Critical": 0, "High": 1, "Medium": 2, "Low": 3}
    all_risks.sort(key=lambda x: sev_rank.get(x.severity, 4))
    recent_risks = all_risks[:15]

    total_obligations = 0
    all_obligations: list[DashboardObligationItem] = []
    for cid in user_contract_ids:
        ob_file = upload_dir / f"{cid}_obligations.json"
        if not ob_file.is_file():
            continue
        cname = contract_filenames.get(cid, "Contract")
        try:
            with ob_file.open("r", encoding="utf-8") as f:
                data = json.load(f)
                for item in data.get("obligations", []):
                    total_obligations += 1
                    all_obligations.append(
                        DashboardObligationItem(
                            contract_id=cid,
                            contract_filename=cname,
                            responsible_party=item.get("responsible_party"),
                            obligation=item.get("obligation", ""),
                            deadline=item.get("deadline"),
                            priority=item.get("priority"),
                            page_number=item.get("page_number"),
                        )
                    )
        except Exception:
            continue

    total_deadlines = 0
    all_deadlines: list[DashboardDeadlineItem] = []
    for cid in user_contract_ids:
        dl_file = upload_dir / f"{cid}_deadlines.json"
        if not dl_file.is_file():
            continue
        cname = contract_filenames.get(cid, "Contract")
        try:
            with dl_file.open("r", encoding="utf-8") as f:
                data = json.load(f).get("deadlines", {})
                if data.get("contract_start_date"):
                    total_deadlines += 1
                    all_deadlines.append(
                        DashboardDeadlineItem(
                            contract_id=cid,
                            contract_filename=cname,
                            description="Effective / Start Date",
                            date_or_timeframe=data.get("contract_start_date"),
                            category="Start",
                        )
                    )
                if data.get("contract_end_date"):
                    total_deadlines += 1
                    all_deadlines.append(
                        DashboardDeadlineItem(
                            contract_id=cid,
                            contract_filename=cname,
                            description="Expiration / End Date",
                            date_or_timeframe=data.get("contract_end_date"),
                            category="Expiration",
                        )
                    )
                if data.get("renewal_date"):
                    total_deadlines += 1
                    all_deadlines.append(
                        DashboardDeadlineItem(
                            contract_id=cid,
                            contract_filename=cname,
                            description="Renewal Notice Window",
                            date_or_timeframe=data.get("renewal_date"),
                            category="Renewal",
                        )
                    )
                if data.get("termination_notice_period"):
                    total_deadlines += 1
                    all_deadlines.append(
                        DashboardDeadlineItem(
                            contract_id=cid,
                            contract_filename=cname,
                            description="Termination Notice Period",
                            date_or_timeframe=data.get("termination_notice_period"),
                            category="Notice",
                        )
                    )
                for p in data.get("payment_deadlines", []):
                    total_deadlines += 1
                    all_deadlines.append(
                        DashboardDeadlineItem(
                            contract_id=cid,
                            contract_filename=cname,
                            description=p.get("description", "Payment Deadline"),
                            date_or_timeframe=p.get("date_or_timeframe"),
                            category="Payment",
                            page_number=p.get("page_number"),
                        )
                    )
                for d in data.get("delivery_deadlines", []):
                    total_deadlines += 1
                    all_deadlines.append(
                        DashboardDeadlineItem(
                            contract_id=cid,
                            contract_filename=cname,
                            description=d.get("description", "Delivery Milestone"),
                            date_or_timeframe=d.get("date_or_timeframe"),
                            category="Delivery",
                            page_number=d.get("page_number"),
                        )
                    )
                for o in data.get("other_dates", []):
                    total_deadlines += 1
                    all_deadlines.append(
                        DashboardDeadlineItem(
                            contract_id=cid,
                            contract_filename=cname,
                            description=o.get("description", "Milestone Date"),
                            date_or_timeframe=o.get("date_or_timeframe"),
                            category="Other",
                            page_number=o.get("page_number"),
                        )
                    )
        except Exception:
            continue

    recent_obligations = all_obligations[:12]
    upcoming_deadlines = all_deadlines[:12]
    combined_high_risks = critical_risk_count + high_risk_count

    return DashboardStatsResponse(
        total_contracts=len(contracts),
        total_pages=total_pages,
        total_risks=total_risks,
        high_risk_count=combined_high_risks,
        total_obligations=total_obligations,
        total_deadlines=total_deadlines,
        critical_risk_count=critical_risk_count,
        medium_risk_count=medium_risk_count,
        low_risk_count=low_risk_count,
        recent_risks=recent_risks,
        upcoming_deadlines=upcoming_deadlines,
        recent_obligations=recent_obligations,
    )


@router.get("", response_model=list[ContractMetadata])
async def list_contracts(current_user: dict = Depends(get_current_user)) -> list[ContractMetadata]:
    upload_dir = Path(settings.upload_dir)
    if not upload_dir.exists():
        return []

    contracts = []
    for extraction_path in upload_dir.glob("*.json"):
        if "_" in extraction_path.stem:
            continue
        try:
            with extraction_path.open("r", encoding="utf-8") as f:
                data = json.load(f)
            if data.get("user_id") != current_user["id"]:
                continue
            contracts.append(_read_contract(extraction_path.stem, user_id=current_user["id"]))
        except HTTPException:
            # Ignore incomplete or malformed entries in the upload cache.
            continue
        except Exception:
            continue
    return [ContractMetadata(**contract.model_dump(exclude={"extraction"})) for contract in contracts]


@router.get("/{contract_id}", response_model=ContractDetails)
async def get_contract(
    contract_id: str,
    current_user: dict = Depends(get_current_user),
) -> ContractDetails:
    return _read_contract(contract_id, user_id=current_user["id"])


@router.delete("/{contract_id}", status_code=204)
async def delete_contract(
    contract_id: str,
    current_user: dict = Depends(get_current_user),
) -> None:
    source_path, extraction_path, _ = verify_contract_access(contract_id, current_user["id"])
    try:
        source_path.unlink(missing_ok=True)
        extraction_path.unlink(missing_ok=True)
        for cached_path in extraction_path.parent.glob(f"{contract_id}_*.json"):
            cached_path.unlink(missing_ok=True)
        delete_chunks(contract_id)
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Failed to delete contract: {exc}")
