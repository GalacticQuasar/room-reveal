# Room Reveal

Room Reveal is a platform where students can explore 3D Gaussian Splat models of various living spaces around campus. Models are created when users upload a video of their rooms (after specifying their location and room type) that is transformed into a Gaussian Splat 3D model by our processing pipeline. From there, any user can explore the space interactively on our website to get a sense of potential future living spaces.

## Impact

Room Reveal helps students explore living spaces in dorms or apartments around campus, helping them plan ahead for how to effectively use space, what to buy, or what accommodations they may need. This is especially useful for those with disabilities or accessibility needs, as they can get a better sense of the space before moving in. Different room configurations such as lofted beds, double vs triple occupancy within the same room type, and possibilities for furniture arrangement can be better visualized through our platform. The need for this project was inspired by the fact that currently, Purdue only provides a top-down floor plan of most dorm rooms without any pictures or videos. The floor plan leaves out important details such as the location of furnishings and actually usable space. We aim to provide a more immersive and informative way for students to explore their future living spaces before moving in.

## Technologies

- Nerfstudio: for the 3D reconstruction pipeline to create Gaussian Splat models from videos
- React Three Fiber: for the interactive 3D visualization of the models on the frontend
- Docker: for containerization of the Nerfstudio pipeline to ensure consistent environments and easy setup

## How It Works

The process of creating a Gaussian Splat model from a video involves several steps:
1. **Data Collection**: The user uploads a video of their room, which can be taken with a phone camera. The video should capture the entire living space from multiple angles to ensure good coverage for 3D reconstruction.
2. **COLMAP Processing**: The video frames are extracted and processed with COLMAP, a structure-from-motion software, to extract camera poses and a sparse point cloud of the scene.
3. **Gaussian Splatting**: The extracted data from COLMAP is then used to train a Gaussian Splatting model using Nerfstudio, which creates a 3D representation of the scene in the form of Gaussian splats.
4. **Visualization**: The resulting Gaussian Splat model is then made available on the Room Reveal website, where users can interactively explore the 3D scene to get a better sense of the living space.

## Run Gaussian Splatting Pipeline

Follow the instructions in the [Gaussian Splatting Pipeline README](pipeline/README.md) to set up and run the pipeline to create Gaussian Splat models from videos of rooms.

## Run Gaussian Splat Visualization locally

```bash
npm install
npm run dev
```

### Controls

- `W A S D`: move
- `Space`: move up
- `C`: move down
- `Shift`: speed boost
- `Mouse`: look around (pointer lock)
- `Esc`: release pointer lock