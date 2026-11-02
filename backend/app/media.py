import uuid
from pathlib import Path
from typing import Optional

from fastapi import HTTPException, UploadFile

from .config import get_settings

IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
VIDEO_TYPES = {"video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov"}
MEDIA_PREFIX = "/media/"
_CHUNK = 1024 * 1024


def media_root() -> Path:
    root = Path(get_settings().media_dir).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _sniff(head: bytes) -> Optional[str]:
    """Detect the real file type from its first bytes; the client's Content-Type is not trusted.
    SVG is deliberately unsupported because it can carry scripts."""
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if head[4:8] == b"ftyp":
        return "video/quicktime" if head[8:12] == b"qt  " else "video/mp4"
    if head.startswith(b"\x1a\x45\xdf\xa3"):
        return "video/webm"
    return None


def save_upload(file: UploadFile, folder: str, allow_video: bool = False) -> tuple[str, str]:
    """Validate and store an upload. Returns (public_url, kind) where kind is 'image' or 'video'."""
    settings = get_settings()
    allowed = {**IMAGE_TYPES, **(VIDEO_TYPES if allow_video else {})}
    head = file.file.read(16)
    mime = _sniff(head)
    if mime not in allowed:
        kinds = "JPG, PNG, WEBP or GIF images" + (", or MP4, WEBM or MOV videos" if allow_video else "")
        raise HTTPException(status_code=415, detail=f"Unsupported file type. Please upload {kinds}.")

    kind = "video" if mime.startswith("video/") else "image"
    limit_mb = settings.max_video_mb if kind == "video" else settings.max_image_mb
    target_dir = media_root() / folder
    target_dir.mkdir(parents=True, exist_ok=True)
    name = f"{uuid.uuid4().hex}{allowed[mime]}"
    dest = target_dir / name

    size = len(head)
    try:
        with dest.open("wb") as out:
            out.write(head)
            while chunk := file.file.read(_CHUNK):
                size += len(chunk)
                if size > limit_mb * _CHUNK:
                    raise HTTPException(status_code=413, detail=f"File too large. The limit for {kind}s is {limit_mb} MB.")
                out.write(chunk)
    except BaseException:
        dest.unlink(missing_ok=True)
        raise
    return f"{MEDIA_PREFIX}{folder}/{name}", kind


def delete_media_file(url: Optional[str]) -> None:
    """Remove a previously uploaded file. External URLs and paths outside the media folder are ignored."""
    if not url or not url.startswith(MEDIA_PREFIX):
        return
    root = media_root()
    path = (root / url[len(MEDIA_PREFIX):]).resolve()
    if root in path.parents and path.is_file():
        path.unlink(missing_ok=True)
