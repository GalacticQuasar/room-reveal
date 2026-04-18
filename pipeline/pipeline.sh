
# Step 0: Find duration of the video (in seconds) to determine how many frames to extract for COLMAP processing.
DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 avi-room.mp4 | cut -d '.' -f 1)
# This will output the duration of the video in seconds (rounded down).

# Step 1: Run COLMAP to extract camera poses and sparse point cloud from the video frames:
ns-process-data video --data input/room.mp4 --output-dir colmap/ --num-frames-target $((DURATION * 2))

# Step 2: Train the Gaussian Splatting model with the extracted COLMAP data:
ns-train splatfacto --data colmap/ --max-num-iterations 5000 \
    --viewer.quit-on-train-completion True \
    --experiment-name my_splat \
    --timestamp latest \
# Config file will be saved to `outputs/my_splat/splatfacto/latest/config.yml`

# Step 3: Export the resulting 3D scene as Gaussian Splats in .ply format:
ns-export gaussian-splat --load-config outputs/my_splat/splatfacto/latest/config.yml --output-dir exports/
# This will save the .ply file to `exports/splat.ply`.
