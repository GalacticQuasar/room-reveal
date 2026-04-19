import json
import os
import shutil
import subprocess
import tempfile
import time
import uuid
from pathlib import Path

import modal
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse


MAX_VIDEO_DURATION_SECONDS = 300
MAX_CONCURRENT_JOBS = 2
LOCK_STALE_AFTER_SECONDS = 60 * 60 * 6

app = modal.App("room-reveal")

volume = modal.Volume.from_name("room-reveal-splats", create_if_missing=True)
cache_volume = modal.Volume.from_name("room-reveal-cache", create_if_missing=True)

image = (
    modal.Image.from_registry(
        "ghcr.io/nerfstudio-project/nerfstudio:latest",
        add_python="3.11",
    )
    .pip_install("fastapi[standard]==0.115.6")
    .add_local_file("pipeline/pipeline.sh", remote_path="/workspace/pipeline.sh")
)


def _duration_seconds_from_file(video_path: Path) -> int:
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(video_path),
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
    seconds = int(float(proc.stdout.strip()))
    return max(seconds, 0)


def _lock_root() -> Path:
    root = Path("/splats") / "_locks"
    root.mkdir(parents=True, exist_ok=True)
    return root


def _is_lock_stale(lock_file: Path) -> bool:
    try:
        payload = json.loads(lock_file.read_text())
        acquired_at = float(payload.get("acquired_at", 0))
    except Exception:
        acquired_at = 0
    return acquired_at > 0 and (time.time() - acquired_at) > LOCK_STALE_AFTER_SECONDS


def _acquire_slot(job_id: str) -> str | None:
    lock_root = _lock_root()

    for slot in range(MAX_CONCURRENT_JOBS):
        lock_path = lock_root / f"slot-{slot}.json"
        if lock_path.exists() and _is_lock_stale(lock_path):
            lock_path.unlink(missing_ok=True)

    for slot in range(MAX_CONCURRENT_JOBS):
        lock_path = lock_root / f"slot-{slot}.json"
        payload = {
            "job_id": job_id,
            "acquired_at": time.time(),
        }
        try:
            fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
        except FileExistsError:
            continue

        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            handle.write(json.dumps(payload))
        return str(lock_path)

    return None


def _release_slot(lock_path: str) -> None:
    Path(lock_path).unlink(missing_ok=True)


@app.function(
    image=image,
    gpu="A10G",
    timeout=60 * 60,
    volumes={"/splats": volume, "/cache": cache_volume},
)
def run_pipeline_job(job_id: str, building: str, room_type: str, upload_path: str, lock_path: str) -> None:
    upload_video = Path(upload_path)
    destination_dir = Path("/splats") / building / room_type
    destination_dir.mkdir(parents=True, exist_ok=True)
    final_path = destination_dir / f"{job_id}.ply"

    temp_root = Path(tempfile.mkdtemp(prefix=f"room-reveal-{job_id}-"))
    output_dir = temp_root / "exports"
    output_dir.mkdir(parents=True, exist_ok=True)

    cache_root = Path("/cache")
    cache_root.mkdir(parents=True, exist_ok=True)
    pipeline_env = {
        **os.environ,
        "XDG_CACHE_HOME": str(cache_root),
        "PIP_CACHE_DIR": str(cache_root / "pip"),
        "TORCH_HOME": str(cache_root / "torch"),
        "HF_HOME": str(cache_root / "huggingface"),
    }

    try:
        subprocess.run(
            ["chmod", "+x", "/workspace/pipeline.sh"],
            check=True,
        )
        subprocess.run(
            ["/workspace/pipeline.sh", str(upload_video), str(output_dir)],
            cwd=str(temp_root),
            env=pipeline_env,
            check=True,
        )

        produced_file = output_dir / "splat.ply"
        if not produced_file.exists():
            raise RuntimeError("Pipeline completed but splat.ply was not produced")

        shutil.move(str(produced_file), str(final_path))
        volume.commit()
        cache_volume.commit()
    finally:
        upload_video.unlink(missing_ok=True)
        _release_slot(lock_path)
        volume.commit()
        cache_volume.commit()
        shutil.rmtree(temp_root, ignore_errors=True)


web_app = FastAPI(title="Room Reveal Modal API")

web_app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@web_app.get("/splats/{building}/{room_type}")
def list_splats(building: str, room_type: str) -> list[dict[str, str]]:
    volume.reload()

    target_dir = Path("/splats") / building / room_type
    if not target_dir.exists():
        return []

    entries = []
    for file_path in target_dir.glob("*.ply"):
        stat = file_path.stat()
        entries.append(
            {
                "id": file_path.stem,
                "created_at": str(int(stat.st_mtime)),
                "url": f"/splats/{building}/{room_type}/{file_path.name}",
            }
        )

    entries.sort(key=lambda item: int(item["created_at"]), reverse=True)
    return entries


@web_app.get("/splats/{building}/{room_type}/{file_name}")
def get_splat_file(building: str, room_type: str, file_name: str) -> FileResponse:
    if not file_name.endswith(".ply"):
        raise HTTPException(status_code=400, detail="Only .ply files are supported")

    volume.reload()
    target = Path("/splats") / building / room_type / file_name
    if not target.exists():
        raise HTTPException(status_code=404, detail="Splat file not found")

    return FileResponse(path=str(target), media_type="application/octet-stream", filename=file_name)


@web_app.post("/upload")
async def upload_video(
    video: UploadFile = File(...),
    building: str = Form(...),
    room_type: str = Form(...),
) -> dict[str, str]:
    content_type = (video.content_type or "").lower()
    if not content_type.startswith("video/"):
        raise HTTPException(status_code=400, detail="Uploaded file must be a video")

    volume.reload()

    job_id = str(uuid.uuid4())
    lock_path = _acquire_slot(job_id)
    if lock_path is None:
        raise HTTPException(
            status_code=429,
            detail="We are experiencing a high volume of requests at this time. Please try again later!",
        )

    volume.commit()

    uploads_dir = Path("/splats") / "_uploads"
    uploads_dir.mkdir(parents=True, exist_ok=True)
    upload_path = uploads_dir / f"{job_id}.mp4"

    try:
        with upload_path.open("wb") as handle:
            while True:
                chunk = await video.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)

        duration_seconds = _duration_seconds_from_file(upload_path)
        if duration_seconds > MAX_VIDEO_DURATION_SECONDS:
            upload_path.unlink(missing_ok=True)
            _release_slot(lock_path)
            raise HTTPException(status_code=400, detail="Video must be 5 minutes or less")

        volume.commit()
        run_pipeline_job.spawn(job_id, building, room_type, str(upload_path), lock_path)
        return {
            "id": job_id,
            "message": "Thank you for your contribution to our platform! Your video is being processed, and will take some time (~15-30min depending on video duration) before being visible as a gaussian splat on the website. Check back later!",
        }
    except Exception:
        upload_path.unlink(missing_ok=True)
        _release_slot(lock_path)
        volume.commit()
        raise


@app.function(image=image, volumes={"/splats": volume})
@modal.asgi_app()
def api():
    return web_app
