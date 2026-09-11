import os
from fastapi import UploadFile, HTTPException

ALLOWED_EXTENSIONS = {".pdf", ".docx"}


def validate_file(file: UploadFile, max_bytes: int) -> tuple[str, bytes]:
    raw_filename = os.path.basename(file.filename or "")
    ext = "." + raw_filename.rsplit(".", 1)[-1].lower() if "." in raw_filename else ""

    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {sorted(ALLOWED_EXTENSIONS)}",
        )

    contents = file.file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(contents) > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds max size of {max_bytes // (1024 * 1024)}MB.",
        )

    # Magic bytes verification for document integrity and security
    if ext == ".pdf" and not contents.startswith(b"%PDF"):
        raise HTTPException(
            status_code=400,
            detail="Corrupted or invalid PDF: file does not match PDF binary signature.",
        )
    if ext == ".docx" and not contents.startswith(b"PK"):
        raise HTTPException(
            status_code=400,
            detail="Corrupted or invalid DOCX: file does not match ZIP/DOCX binary signature.",
        )

    return ext, contents
