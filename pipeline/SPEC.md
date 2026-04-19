# Modal Pipeline Specification

Working directory is `/workspace` in the docker container.
Mount input file to `/workspace/input/room.mp4` and output files will be saved to `/workspace/output/` by default. Adjust paths as needed.

Step 0: Find duration of the video (in seconds) to determine how many frames to extract for COLMAP processing. This can be done with a tool like `ffprobe`:
```sh
DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 avi-room.mp4 | cut -d '.' -f 1)
```
> This will output the duration of the video in seconds (rounded down). Use this to set the `--num-frames-target` flag in the COLMAP processing step to ensure enough frames are extracted for good 3D reconstruction. For example, if the video is 60 seconds long, you might want to extract around 120 frames (2 fps) by setting `--num-frames-target 120`.

Step 1: Run COLMAP to extract camera poses and sparse point cloud from the video frames:
```sh
ns-process-data video --data input/room.mp4 --output-dir colmap/ --num-frames-target $((DURATION * 2))
```

Step 2: Train the Gaussian Splatting model with the extracted COLMAP data:
```sh
ns-train splatfacto --data colmap/ --max-num-iterations 5000 \
    --viewer.quit-on-train-completion True \
    --experiment-name my_splat \
    --timestamp latest \
```
> Follows config file format: `outputs/<experiment_name>/<method_name>/<timestamp>/config.yml`
> So above would make sure it is always: `outputs/my_splat/splatfacto/latest/config.yml`

Step 3: Export the resulting 3D scene as Gaussian Splats in .ply format:
```sh
ns-export gaussian-splat --load-config outputs/my_splat/splatfacto/latest/config.yml --output-dir exports/ 
```
> This will save the .ply file to `exports/splat.ply`.
