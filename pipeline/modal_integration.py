import modal
from pathlib import Path
import subprocess

app = modal.App("room-reveal-pipeline")

PIPELINE_IMAGE = modal.Image.from_registry(
    "ghcr.io/nerfstudio-project/nerfstudio:latest", add_python="3.11"
)


@app.cls(
    image=PIPELINE_IMAGE,
    gpu="A10",
    timeout=3600,
    memory=32768,
)
class GaussianPipeline:
    @modal.enter()
    def setup(self):
        self.workspace = Path("/workspace")
        self.workspace.mkdir(exist_ok=True)

    @modal.method()
    def process_video(
        self, video_url: str, experiment_name: str = "room-splat"
    ) -> dict:
        """Download video, extract frames, train gaussian splat, export to .ply"""
        import urllib.request

        workspace = self.workspace
        experiment_dir = workspace / experiment_name
        experiment_dir.mkdir(exist_ok=True)

        video_path = experiment_dir / "input.mp4"
        if not video_path.exists():
            urllib.request.urlretrieve(video_url, video_path)

        output_dir = experiment_dir / "output"
        output_dir.mkdir(exist_ok=True)

        subprocess.run(
            [
                "ns-process-data",
                "video",
                "--data",
                str(video_path),
                "--output-dir",
                str(output_dir),
                "--num-frames-target",
                "120",
            ],
            check=True,
        )

        outputs_dir = experiment_dir / "outputs"
        outputs_dir.mkdir(exist_ok=True)

        subprocess.run(
            [
                "ns-train",
                "splatfacto",
                "--data",
                str(output_dir),
                "--output_dir",
                str(outputs_dir),
            ],
            check=True,
        )

        config_files = list(outputs_dir.glob("**/config.yml"))
        if not config_files:
            raise RuntimeError("No config.yml found in training outputs")

        exports_dir = experiment_dir / "exports"
        exports_dir.mkdir(exist_ok=True)
        ply_path = exports_dir / "splat.ply"

        subprocess.run(
            [
                "ns-export",
                "gaussian-splat",
                "--load-config",
                str(config_files[0]),
                "--output-dir",
                str(exports_dir),
            ],
            check=True,
        )

        upload_result = upload_to_storage(ply_path)
        return {"ply_url": upload_result, "experiment_name": experiment_name}


def upload_to_storage(file_path: Path) -> str:
    """Upload the .ply file to cloud storage (S3 or Cloudflare R2)"""
    import os

    if "R2_ACCESS_KEY" in os.environ:
        from r2_upload import upload_file

        return upload_file(file_path)

    if "AWS_ACCESS_KEY_ID" in os.environ:
        import boto3

        s3 = boto3.client("s3")
        bucket = os.environ.get("S3_BUCKET", "room-reveal-outputs")
        key = f"ply/{file_path.name}"
        s3.upload_file(str(file_path), bucket, key)
        return f"https://{bucket}.s3.amazonaws.com/{key}"

    raise NotImplementedError(
        "No storage configured. Set R2_ACCESS_KEY or AWS_ACCESS_KEY_ID env vars."
    )


@app.function(image=modal.Image.debian_slim().pip_install("fastapi[standard]"))
@modal.asgi_app()
def api():
    """Web API for submitting jobs and checking status"""
    from fastapi import FastAPI, HTTPException
    from pydantic import BaseModel

    web_app = FastAPI()

    class JobRequest(BaseModel):
        video_url: str
        experiment_name: str = "room-splat"

    class JobStatusResponse(BaseModel):
        job_id: str

    @web_app.post("/jobs", response_model=JobStatusResponse)
    async def submit_job(request: JobRequest):
        if not request.video_url:
            raise HTTPException(status_code=400, detail="video_url is required")

        pipeline = GaussianPipeline()
        result = pipeline.process_video.spawn(
            request.video_url, request.experiment_name
        )
        return {"job_id": result.object_id}

    @web_app.get("/jobs/{job_id}")
    async def get_job_status(job_id: str):
        try:
            call = modal.FunctionCall.from_id(job_id)
            result = call.get(timeout=0)
            return {"status": "complete", "result": result}
        except TimeoutError:
            return {"status": "processing"}
        except modal.exception.NotFoundError:
            raise HTTPException(status_code=404, detail="Job not found")
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

    return web_app
