import glob
import json
import math
import os
import sys

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, backend_dir)
os.chdir(backend_dir)

from app.core.config import settings
settings.upload_dir = os.path.join(backend_dir, "uploads")

from app.services.chunking import chunk_segments
from app.services.extraction import extract_text
from app.services.extraction_batching import atomize_segments, resolve_item_location

upload_dir = settings.upload_dir
files = glob.glob(os.path.join(upload_dir, "*.docx")) + glob.glob(os.path.join(upload_dir, "*.pdf"))

print(f"Starting instant local page number migration for {len(files)} files...")

migrated_cnt = 0

for fpath in files:
    ext = os.path.splitext(fpath)[1].lower()
    cid = os.path.basename(os.path.splitext(fpath)[0])
    meta_path = os.path.join(upload_dir, f"{cid}.json")
    if not os.path.exists(meta_path):
        continue

    try:
        with open(meta_path, "r", encoding="utf-8", errors="ignore") as f:
            old_meta = json.load(f)

        # 1. Pure-python local re-extraction
        extraction = extract_text(fpath, ext)
        extraction["original_filename"] = old_meta.get("original_filename") or os.path.basename(fpath)
        extraction["size_bytes"] = old_meta.get("size_bytes", os.path.getsize(fpath))
        extraction["upload_date"] = old_meta.get("upload_date")
        extraction["user_id"] = old_meta.get("user_id")

        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(extraction, f, ensure_ascii=False, indent=2)

        total_pages = extraction.get("metadata", {}).get("num_pages") or 1
        units = atomize_segments(extraction["segments"], 2000)
        chunks = chunk_segments(extraction["segments"])

        # 2. Update Clauses locally (preserving ML/LLM categories & confidence, updating page numbers)
        cl_path = os.path.join(upload_dir, f"{cid}_clauses.json")
        if os.path.exists(cl_path):
            try:
                with open(cl_path, "r", encoding="utf-8", errors="ignore") as f:
                    cl_data = json.load(f)
                clauses = cl_data.get("clauses", [])
                for i, c in enumerate(clauses):
                    c_idx = c.get("chunk_index", i)
                    if 0 <= c_idx < len(chunks):
                        matched_chunk = chunks[c_idx]
                        c["page_number"] = matched_chunk.get("page_number") or min(total_pages, max(1, math.floor(c_idx / max(1, len(chunks)) * total_pages) + 1))
                        if matched_chunk.get("heading"):
                            c["heading"] = matched_chunk.get("heading")
                    else:
                        c["page_number"] = min(total_pages, max(1, math.floor(i / max(1, len(clauses)) * total_pages) + 1))
                with open(cl_path, "w", encoding="utf-8") as f:
                    json.dump(cl_data, f, ensure_ascii=False, indent=2)
            except Exception as cl_err:
                print(f"  [Clauses Error for {cid[:8]}]: {cl_err}")

        # 3. Update Obligations locally using token/keyword overlap
        ob_path = os.path.join(upload_dir, f"{cid}_obligations.json")
        if os.path.exists(ob_path):
            try:
                with open(ob_path, "r", encoding="utf-8", errors="ignore") as f:
                    ob_data = json.load(f)
                obs = ob_data.get("obligations", [])
                for o in obs:
                    p_num, sec = resolve_item_location(
                        item_page=o.get("page_number"),
                        item_section=o.get("section"),
                        text_snippet=o.get("obligation", ""),
                        batch=units,
                        total_pages=total_pages,
                        excerpt_id=o.get("excerpt_id"),
                    )
                    o["page_number"] = p_num
                    if sec:
                        o["section"] = sec
                with open(ob_path, "w", encoding="utf-8") as f:
                    json.dump(ob_data, f, ensure_ascii=False, indent=2)
            except Exception as ob_err:
                print(f"  [Obligations Error for {cid[:8]}]: {ob_err}")

        # 4. Update Risks locally
        risk_path = os.path.join(upload_dir, f"{cid}_risks.json")
        if os.path.exists(risk_path):
            try:
                with open(risk_path, "r", encoding="utf-8", errors="ignore") as f:
                    risk_data = json.load(f)
                for r in risk_data.get("risks", []):
                    p_num, sec = resolve_item_location(
                        item_page=r.get("page_number"),
                        item_section=r.get("section"),
                        text_snippet=r.get("evidence") or r.get("title", ""),
                        batch=units,
                        total_pages=total_pages,
                        excerpt_id=r.get("excerpt_id"),
                    )
                    r["page_number"] = p_num
                    if sec:
                        r["section"] = sec
                with open(risk_path, "w", encoding="utf-8") as f:
                    json.dump(risk_data, f, ensure_ascii=False, indent=2)
            except Exception as r_err:
                print(f"  [Risks Error for {cid[:8]}]: {r_err}")

        # 5. Update Deadlines locally
        dl_path = os.path.join(upload_dir, f"{cid}_deadlines.json")
        if os.path.exists(dl_path):
            try:
                with open(dl_path, "r", encoding="utf-8", errors="ignore") as f:
                    dl_data = json.load(f)
                dls = dl_data.get("deadlines", {})
                for lst in [dls.get("payment_deadlines", []), dls.get("delivery_deadlines", []), dls.get("other_dates", [])]:
                    for item in lst:
                        p_num, _ = resolve_item_location(
                            item_page=item.get("page_number"),
                            item_section=None,
                            text_snippet=f"{item.get('description', '')} {item.get('date_or_timeframe', '')}",
                            batch=units,
                            total_pages=total_pages,
                            excerpt_id=item.get("excerpt_id"),
                        )
                        item["page_number"] = p_num
                with open(dl_path, "w", encoding="utf-8") as f:
                    json.dump(dl_data, f, ensure_ascii=False, indent=2)
            except Exception as dl_err:
                print(f"  [Deadlines Error for {cid[:8]}]: {dl_err}")

        migrated_cnt += 1
    except Exception as e:
        print(f"Failed to migrate {cid}: {e}")

print(f"\nMigration completed successfully for {migrated_cnt} contracts.")
