#!/bin/bash
#
# This script takes in a video file path and outputs a splat.ply file in a given output directory.
# Meant to be used by calling as `./pipeline.sh input/room.mp4 exports/`, so the output .ply file will be saved to `exports/splat.ply`.
# This is so the input and output directories can be mounted as volumes in the Docker container, and used as part of a larger pipeline.
#

set -e  # exit on error

if [ $# -lt 2 ]; then
    echo "Usage: $0 <input_video> <output_dir>"
    exit 1
fi

VIDEO_PATH=$1
OUTPUT_DIR=$2

# Step 0: Find duration of the video (in seconds) to determine how many frames to extract for COLMAP processing.
echo "START: Finding video duration..."
DURATION=$(ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $VIDEO_PATH | cut -d '.' -f 1)
echo "Video duration: $DURATION seconds"
# This will output the duration of the video in seconds (rounded down).

# Step 1: Run COLMAP to extract camera poses and sparse point cloud from the video frames:
echo "START: Extracting COLMAP data from video..."
ns-process-data video --data $VIDEO_PATH --output-dir colmap/ --gpu --num-frames-target $((DURATION * 2))
echo "END: COLMAP data extraction complete. Output saved to colmap/ directory."

# Step 2: Train the Gaussian Splatting model with the extracted COLMAP data:
echo "START: Training Gaussian Splatting model..."
ns-train splatfacto --data colmap/ --max-num-iterations 30000 \
    --viewer.quit-on-train-completion True \
    --machine.device-type cuda \
    --experiment-name my_splat \
    --timestamp latest
echo "END: Training complete. Model config saved to outputs/my_splat/splatfacto/latest/config.yml"
# Config file will be saved to `outputs/my_splat/splatfacto/latest/config.yml`

# Step 3: Export the resulting 3D scene as Gaussian Splats in .ply format:
echo "START: Exporting Gaussian Splats..."
ns-export gaussian-splat --load-config outputs/my_splat/splatfacto/latest/config.yml --output-dir $OUTPUT_DIR
echo "END: Export complete."
# This will save the .ply file to `$OUTPUT_DIR/splat.ply`.

echo "DONE. Output saved to $OUTPUT_DIR/splat.ply"