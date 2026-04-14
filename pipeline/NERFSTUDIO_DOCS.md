<quickstart-installation-usingdocker>

Use docker image
Instead of installing and compiling prerequisites, setting up the environment and installing dependencies, a ready to use docker image is provided.

Prerequisites
Docker (get docker) and nvidia GPU drivers (get nvidia drivers), capable of working with CUDA 11.8, must be installed. The docker image can then either be pulled from here (latest can be replaced with a fixed version, e.g., 1.1.3)

docker pull ghcr.io/nerfstudio-project/nerfstudio:latest
or be built from the repository using

docker build --tag nerfstudio -f Dockerfile .
To restrict to only CUDA architectures that you have available locally, use the CUDA_ARCHITECTURES build arg and look up the compute capability for your GPU. For example, here’s how to build with support for GeForce 30xx series GPUs:

docker build \
    --build-arg CUDA_ARCHITECTURES=86 \
    --tag nerfstudio-86 \
    --file Dockerfile .
Using an interactive container
The docker container can be launched with an interactive terminal where nerfstudio commands can be entered as usual. Some parameters are required and some are strongly recommended for usage as following:

docker run --gpus all \                                         # Give the container access to nvidia GPU (required).
            -u $(id -u) \                                       # To prevent abusing of root privilege, please use custom user privilege to start.
            -v /folder/of/your/data:/workspace/ \               # Mount a folder from the local machine into the container to be able to process them (required).
            -v /home/<YOUR_USER>/.cache/:/home/user/.cache/ \   # Mount cache folder to avoid re-downloading of models everytime (recommended).
            -p 7007:7007 \                                      # Map port from local machine to docker container (required to access the web interface/UI).
            --rm \                                              # Remove container after it is closed (recommended).
            -it \                                               # Start container in interactive mode.
            --shm-size=12gb \                                   # Increase memory assigned to container to avoid memory limitations, default is 64 MB (recommended).
            ghcr.io/nerfstudio-project/nerfstudio:<tag>         # Docker image name if you pulled from GitHub.
            <--- OR --->
            nerfstudio                                          # Docker image tag if you built the image from the Dockerfile by yourself using the command from above.
Call nerfstudio commands directly
Besides, the container can also directly be used by adding the nerfstudio command to the end.

docker run --gpus all -u $(id -u) -v /folder/of/your/data:/workspace/ -v /home/<YOUR_USER>/.cache/:/home/user/.cache/ -p 7007:7007 --rm -it --shm-size=12gb  # Parameters.
            ghcr.io/nerfstudio-project/nerfstudio:<tag> \       # Docker image name if you pulled from GitHub.
            ns-process-data video --data /workspace/video.mp4   # Smaple command of nerfstudio.
Note
The container works on Linux and Windows, depending on your OS some additional setup steps might be required to provide access to your GPU inside containers.

Paths on Windows use backslash ‘' while unix based systems use a frontslash ‘/’ for paths, where backslashes might require an escape character depending on where they are used (e.g. C:\folder1\folder2…). Alternatively, mounts can be quoted (e.g. -v 'C:\local_folder:/docker_folder'). Ensure to use the correct paths when mounting folders or providing paths as parameters.

Always use full paths, relative paths are known to create issues when being used in mounts into docker.

Everything inside the container, what is not in a mounted folder (workspace in the above example), will be permanently removed after destroying the container. Always do all your tasks and output folder in workdir!

The container currently is based on nvidia/cuda:11.8.0-devel-ubuntu22.04, consequently it comes with CUDA 11.8 which must be supported by the nvidia driver. No local CUDA installation is required or will be affected by using the docker image.

The docker image (respectively Ubuntu 22.04) comes with Python3.10, no older version of Python is installed.

If you call the container with commands directly, you still might want to add the interactive terminal (‘-it’) flag to get live log outputs of the nerfstudio scripts. In case the container is used in an automated environment the flag should be discarded.

The current version of docker is built for multi-architecture (CUDA architectures) use. The target architecture(s) must be defined at build time for Colmap and tinyCUDNN to be able to compile properly. If your GPU architecture is not covered by the following table you need to replace the number in the line ARG CUDA_ARCHITECTURES=90;89;86;80;75;70;61;52;37 to your specific architecture. It also is a good idea to remove all architectures but yours (e.g. ARG CUDA_ARCHITECTURES=86) to speedup the docker build process a lot.

To avoid memory issues or limitations during processing, it is recommended to use either --shm-size=12gb or --ipc=host to increase the memory available to the docker container. 12gb as in the example is only a suggestion and may be replaced by other values depending on your hardware and requirements.

</quickstart-installation-usingdocker>

<quickstart-custom-dataset>

Using custom data
Training model on existing datasets is only so fun. If you would like to train on self captured data you will need to process the data into the nerfstudio format. Specifically we need to know the camera poses for each image.

To process your own data run:

ns-process-data {video,images,polycam,record3d} --data {DATA_PATH} --output-dir {PROCESSED_DATA_DIR}

...

Images or Video
To assist running on custom data we have a script that will process a video or folder of images into a format that is compatible with nerfstudio. We use COLMAP and FFmpeg in our data processing script, please have these installed. We have provided a quickstart to installing COLMAP below, FFmpeg can be downloaded from here

Tip

COLMAP can be finicky. Try your best to capture overlapping, non-blurry images.

Processing Data
ns-process-data {images, video} --data {DATA_PATH} --output-dir {PROCESSED_DATA_DIR}
Training on your data
ns-train nerfacto --data {PROCESSED_DATA_DIR}
Training and evaluation on separate data
For ns-process-data {images, video}, you can optionally use a separate image directory or video for training and evaluation, as suggested in Nerfbusters. To do this, run ns-process-data {images, video} --data {DATA_PATH} --eval-data {EVAL_DATA_PATH} --output-dir {PROCESSED_DATA_DIR}. Then when running nerfacto, run ns-train nerfacto --data {PROCESSED_DATA_DIR} nerfstudio-data --eval-mode filename.

</quickstart-custom-dataset>
