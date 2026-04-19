# Gaussian Splatting Pipeline

> NOTE: This pipeline is instructions on how to run the nerfstudio gaussian splatting pipeline locally. The backend pipeline executes the flow in `pipeline/pipeline.sh` in a GPU Modal job, so you can also run it by uploading a video through the frontend and letting the backend handle it. However, if you want to run it locally for testing or development purposes, follow the instructions below.

This pipeline was built to create gaussian splats of a full living space from a video.

- Input: Video (or folder of photos) of a room, may be taken with a phone camera
- Output: 3D Scene as Gaussian Splats (.ply format)

## Setup

### Pull nerfstudio docker container:

> Note: You can access nerfstudio official installation instructions [here](https://docs.nerf.studio/quickstart/installation.html).

```sh
docker pull ghcr.io/nerfstudio-project/nerfstudio:latest
```

### Run nerfstudio docker container:
> Note: If you are on windows, use WSL2 and make sure to adjust the volume mounts to desired file paths. Also ensure you have a GPU enabled and accessible from WSL2 (run `nvidia-smi` in WSL2 terminal to check).

First, create the following directories in your current directory for volume mounting:
```
mkdir mount cache
```

Now run (and enter) the docker container with the following command:
```sh
docker run --gpus all \
            -u $(id -u) \
            -e HOME=/workspace \
            -e XDG_DATA_HOME=/workspace/.local/share \
            -e MPLCONFIGDIR=/workspace/.matplotlib \
            -e TORCHINDUCTOR_CACHE_DIR=/tmp/torchinductor \
            -v $(pwd)/mount:/workspace/ \
            -v $(pwd)/cache:/home/user/.cache/ \
            -p 7007:7007 \
            --rm \
            -it \
            --shm-size=12gb \
            ghcr.io/nerfstudio-project/nerfstudio:latest
```

The following steps are to be run inside the docker container terminal (you should now be in the `/workspace` directory):

### Run COLMAP to extract camera poses and sparse point cloud from the video frames:
If you took a set of images, place them in a folder (e.g. `pictures/`) and run the following command to process the images with COLMAP:
```sh
ns-process-data images --data pictures/ --output-dir output/
```

If you have a video, you can run the following command to extract frames and process them with COLMAP:
```sh
ns-process-data video --data my-room.mp4 --output-dir output/ --num-frames-target 120
```

> Note: The `--num-frames-target` flag is optional and can be adjusted based on the length of the video and desired number of frames to extract. Try to keep it higher than 1 fps to ensure COLMAP can find enough features to match between frames. Ideally, there should be enough overlap between frames for COLMAP to work well.

### Train the gaussian splatting model with the extracted COLMAP data:
```sh
ns-train splatfacto --data output/
```

> Note: There are many parameters you can adjust for training (both to save time or increase quality), so feel free to check them out by running `ns-train splatfacto --help`. For example, you can adjust the number of training iterations (default is 20000) with the `--max-num-iterations` flag.

### Export the trained model as a .ply file of gaussian splats:
```sh
ns-export gaussian-splat \
            --load-config outputs/<experiment-name>/config.yml \
            --output-dir exports/
```
> Note: Make sure to replace `<experiment-name>` with the actual name of the experiment that was created during training (you can check the `outputs/` directory for this). The exported .ply file will be saved in the `exports/` directory.