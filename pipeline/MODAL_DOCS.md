# Modal Rules and Guidelines for LLMs

This file provides rules and guidelines for LLMs when implementing Modal code.

## General

- Modal is a serverless cloud platform for running Python code with minimal configuration
- Designed for AI/ML workloads but supports general-purpose cloud compute
- Serverless billing model - you only pay for resources used

## Modal documentation

- Extensive documentation is available at: modal.com/docs (and in markdown format at modal.com/llms-full.txt)
- A large collection of examples is available at: modal.com/docs/examples (and github.com/modal-labs/modal-examples)
- Reference documentation is available at: modal.com/docs/reference

Always refer to documentation and examples for up-to-date functionality and exact syntax.

## Core Modal concepts

### App

- A group of functions, classes and sandboxes that are deployed together.

### Function

- The basic unit of serverless execution on Modal.
- Each Function executes in its own container, and you can configure different Images for different Functions within the same App:

```python
image = (
    modal.Image.debian_slim(python_version="3.13")
    .pip_install("torch", "numpy", "transformers")
    .apt_install("ffmpeg")
    .run_commands("mkdir -p /models")
)

@app.function(image=image)
def square(x: int) -> int:
    return x * x
```

- You can configure individual hardware requirements (CPU, memory, GPUs, ephemeral_disk) for each Function:

```python
@app.function(
    gpu="H100",
    memory=4096,
    cpu=2,
    ephemeral_disk=2000,
)
def inference():
    ...
```

#### GPU configuration

Modal supports various GPU types:

```python
@app.function(gpu="T4")       # T4 GPU
@app.function(gpu="L4")        # L4 GPU
@app.function(gpu="A10")       # A10 GPU
@app.function(gpu="L40S")      # L40S GPU
@app.function(gpu="A100")     # A100 (Modal may auto-upgrade to 80GB)
@app.function(gpu="A100-40GB") # Specifically 40GB version
@app.function(gpu="A100-80GB") # Specifically 80GB version
@app.function(gpu="RTX-PRO-6000") # RTX Pro 6000
@app.function(gpu="H100")     # H100 (Modal may auto-upgrade to H200)
@app.function(gpu="H100!")    # H100, disable auto-upgrade to H200
@app.function(gpu="H200")     # H200 GPU
@app.function(gpu="B200")     # B200 GPU
@app.function(gpu="B200+")    # B200+, opt-in to allow B300 upgrade (billed as B200)
@app.function(gpu="any")        # Any available GPU
```

Multi-GPU support (up to 8 GPUs on most types, 4 on A10):

```python
@app.function(gpu="H100:8")   # 8x H100 GPUs
@app.function(gpu="A100:2")    # 2x A100 GPUs
```

GPU fallback list (tries in order):

```python
@app.function(gpu=["H100", "A100-40GB:2"])  # Try H100 first, fallback to 2x A100-40GB
```

Note: Modal may automatically upgrade H100 to H200, and A100 to A100-80GB, at no additional cost. Use `H100!` to disable this for benchmarking.

#### CPU and memory configuration

```python
@app.function(cpu=8.0)              # 8 CPU cores (physical, not vCPUs)
@app.function(memory=32768)             # 32 GiB of memory (in MiB)
@app.function(cpu=(1.0, 4.0))        # tuple: (request, soft_limit)
@app.function(memory=(1024, 2048))     # tuple: (request, hard_limit for OOM kill)
```

- Default CPU: 0.125 cores, soft limit +16 cores
- Default memory: 128 MiB
- Auto-sets OPENBLAS_NUM_THREADS, OMP_NUM_THREADS, MKL_NUM_THREADS based on CPU request

#### Disk configuration

```python
@app.function(ephemeral_disk=2000)  # 2000 MiB (default 512 GiB, max 3.0 TiB)
```

Disk billed at 20:1 ratio to memory. Hitting limit causes OSError.

#### Autoscaling

```python
@app.function(
    max_containers=100,       # Upper limit
    min_containers=2,         # Minimum warm
    buffer_containers=5,      # Buffer while active
    scaledown_window=300,     # Max idle seconds before scale down
)
def my_function():
    ...
```

- Functions scale to zero by default when inactive

### Function invocation

```python
foo.remote(x, y)              # Run in cloud container (most common)
foo.local(x, y)               # Run locally in same context
foo.map(inputs)               # Parallel map over inputs
foo.spawn(x, y)              # Fire-and-forget, returns FunctionCall
```

For .map():

```python
results = foo.map(inputs, return_exceptions=True, max_inputs=100)
```

For .spawn():

```python
call = foo.spawn(input_data)
result = call.get(timeout=30)
```

With classes:

```python
@app.cls(gpu="A100")
class ModelServer:
    @modal.enter()
    def load_model(self):
        self.model = load_model()

    @modal.method()
    def predict(self, text: str) -> str:
        return self.model.generate(text)

# Invocation
ModelServer().predict.remote("hello")  # Class method on Modal
```

#### Scheduling

```python
@app.function(schedule=modal.Period(days=1))      # Daily
@app.function(schedule=modal.Period(hours=2))   # Every 2 hours
@app.function(schedule=modal.Cron("0 9 * * *"))  # Daily at 9am
@app.function(schedule=modal.Cron("0 6 * * *", timezone="America/New_York"))  # With timezone
```

Note: modal.Period resets on redeploy.

#### Web endpoints

```python
@app.function()
@modal.fastapi_endpoint()
def fastapi_endpoint():
    return {"status": "ok"}

@app.function()
@modal.fastapi_endpoint(method="POST", docs=True)
def api_with_docs():
    ...

@app.function()
@modal.asgi_app()
def asgi_app():
    app = FastAPI()
    ...
    return app

@app.function()
@modal.wsgi_app()
def wsgi_app():
    app = Flask(__name__)
    ...
    return app
```

### Classes (a.k.a. `Cls`)

- For stateful operations with startup/shutdown lifecycle hooks. Example:

```python
@app.cls(gpu="A100", memory=4096)
class ModelServer:
    @modal.enter()
    def load_model(self):
        # Runs once when container starts
        self.model = load_model()

    @modal.method()
    def predict(self, text: str) -> str:
        return self.model.generate(text)

    @modal.exit()
    def cleanup(self):
        # Runs when container stops
        cleanup()
```

### Other important concepts

- **Image**: Container environment that Functions run in
- **Sandbox**: Define containers at runtime, run arbitrary code securely
- **Volume**: Distributed file system for Modal apps
- **Secret**: Securely provide credentials/env vars
- **Dict**: Distributed key/value store
- **Queue**: Distributed FIFO queue

## Image definition

### Base images

```python
image = modal.Image.debian_slim()                    # Default Python
image = modal.Image.debian_slim(python_version="3.13") # Specific version
image = modal.Image.micromamba()                    # For conda packages
```

### Python packages

Preferred method (uses uv, faster):

```python
image = modal.Image.debian_slim().uv_pip_install("torch", "numpy==1.26.0")
```

Fallback to pip:

```python
image = modal.Image.debian_slim().pip_install("pandas==2.2.0", "numpy")
```

For conda/mamba packages:

```python
image = (
    modal.Image.micromamba()
    .micromamba_install("pymc==5.10.4", channels=["conda-forge"])
)
```

### System packages

```python
image = modal.Image.debian_slim().apt_install("git", "curl", "ffmpeg")
```

### Environment variables

```python
image = modal.Image.debian_slim().env({"HF_HUB_CACHE": "/cache", "PORT": "8000"})
```

### Run commands during build

```python
image = (
    modal.Image.debian_slim()
    .apt_install("git")
    .run_commands("git clone https://github.com/...")
)
```

### Add local files

```python
image = modal.Image.debian_slim().add_local_dir("/local/path", remote_path="/remote/path")
image = modal.Image.debian_slim().add_local_file("./config.json", remote_path="/app/config.json")

# For Python modules
image = modal.Image.debian_slim().add_local_python_source("my_module")
```

By default, local files are added at container startup (fast redeploy). Use `copy=True` to force inclusion in Image build.

### Image imports context manager

```python
pandas_image = modal.Image.debian_slim().pip_install("pandas", "numpy")

with pandas_image.imports():
    import pandas as pd
    import numpy as np
```

### Run Python during build

```python
def download_models():
    import huggingface_hub
    ...

image = (
    modal.Image.debian_slim()
    .pip_install("huggingface-hub")
    .run_function(download_model)
)
```

### Use existing container images

```python
# From public registry
image = modal.Image.from_registry("nvidia/cuda:12.8.1-devel-ubuntu24.04", add_python="3.12")

# From Dockerfile
image = modal.Image.from_dockerfile("./Dockerfile")
```

### Image caching

Images are cached per layer. To force rebuild:

```python
image = modal.Image.debian_slim().pip_install("package", force_build=True)
```

Or use environment variable: `MODAL_FORCE_BUILD=1 modal run ...`

## Differences from standard Python development

- Modal always executes code in the cloud, even while developing. Use Environments for separating dev/prod deployments.
- Different dependencies for different Functions is common - define in Image definitions attached to Functions.
- Put `import` statements inside Function `def` when local and remote environments differ.
- Global scope code must work in all environments (local, all Images the App uses).

## Modal coding style

- Modal Apps, Volumes, and Secrets should be named using kebab-case.
- Always use `import modal`, and qualified names like `modal.App()`, `modal.Image.debian_slim()`.
- Modal evolves quickly, prints deprecation warnings. Never use deprecated features.

## Common commands

### Running your Modal app during development

- `modal run path/to/your/app.py` - Run on Modal
- `modal run -m module.path.to.app` - Run by Python module path
- `modal serve modal_server.py` - Run web endpoint(s) with hot-reload. Press Ctrl+C to interrupt.

### Deploying your Modal app

- `modal deploy path/to/your/app.py` - Deploy to Modal
- `modal deploy -m module.path.to.app` - Deploy by Python module path

### Logs

- `modal app logs <app_name>` - Stream logs. Press Ctrl+C to interrupt.

### Resource management

- `modal app list`, `modal volume list`, `modal secret list`, etc.
- Use `--help` for more options.

## Testing and debugging

- When using `app.deploy()`, wrap in `with modal.enable_output():` block for more output.
- Use `MODAL_FORCE_BUILD=1` to rebuild all images.
- Use `MODAL_IGNORE_CACHE=1` to rebuild without breaking cache.