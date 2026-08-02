
# Navara volcano - Volcanic Eruption Physics Demo

A 3D physics simulation of a volcanic eruption on Mount Fuji using Navara (@navaramap/three). Watch hundreds of colorful balls erupt from the crater, roll down the slopes with realistic physics, and interact with real terrain data.

[Navara API Documentation](https://navara-docs.netlify.app/)

## Quick Start

```bash
pnpm install
pnpm run dev
```

Then open http://localhost:8080 in your browser.

## What You'll See

https://github.com/user-attachments/assets/cefd2d6d-6573-4cc9-b973-94be380bf291


- 🌋 **Volcanic Eruption**: Continuous eruption of colorful balls from Mount Fuji's crater
- 🎨 **Random Colors**: Each ball has unique random colors and sizes
- 🎮 **Interactive Controls**: Real-time parameter adjustment via Tweakpane GUI
- 🏔️ **Realistic Terrain**: Balls roll down Mount Fuji following actual terrain contours
- ⚡ **High Performance**: Handles up to 300+ active balls simultaneously

## Features

### Physics System
- **Realistic Physics**: Gravity decomposition, friction, rolling resistance, air drag
- **Terrain Interaction**: Real-time terrain height sampling and smooth slope detection
- **Elastic Collisions**: Bounces on ground contact with configurable restitution
- **Visual Animation**: Balls rotate realistically as they roll
- **Smart Stop Detection**: Only stops on flat ground, keeps rolling on slopes

### Volcanic Eruption
- **Continuous Spawning**: Balls erupt at configurable intervals (200ms default)
- **Random Distribution**: Spawn points distributed within crater radius
- **Random Properties**: Each ball has random size, color, emissive glow, and velocity
- **Auto Cleanup**: Stopped balls are automatically removed to maintain performance
- **Capacity Management**: Configurable maximum ball count (300 default)

### Interactive Controls (Tweakpane GUI)
- **Physics Parameters**: Adjust gravity, friction, restitution, air drag in real-time
- **Eruption Settings**: Control crater radius, spawn interval, max balls, ball size
- **Camera Controls**: Auto-rotate toggle, reset to default position
- **Live Stats**: Real-time active ball count display

## Configuration

All parameters can be adjusted in real-time via the Tweakpane GUI panel (top-right corner):

- **Gravity**: 1-200 m/s² (default: 100)
- **Restitution**: 0-1 (bounciness, default: 0.6)
- **Friction**: 0-0.5 (default: 0.01)
- **Crater Radius**: 10-500m (spawn area, default: 150m)
- **Max Balls**: 10-1000 (default: 500)
- **Eruption Interval**: 50-1000ms (default: 200ms)
- **Base Ball Radius**: 5-100m (default: 50m, actual size ±50%)

## Technical Details

### Architecture
- **Custom MeshDesc**: `RollingBallDesc` extends Navara's `MeshDesc` for per-frame physics updates
- **ENU Coordinates**: All physics calculations in local East-North-Up coordinate system
- **Semi-implicit Euler**: Stable physics integration with sub-stepping
- **Terrain Normal Sampling**: 10m sampling distance for smooth slope detection
- **Smart Collision**: Ground contact detection with restitution-based bouncing

### Performance Optimizations
- Automatic cleanup of stopped balls
- Efficient terrain sampling with fallback handling
- Sub-stepping for numerical stability
- Velocity clamping (max 50,000 m/s)

## Documentation

See [ROLLING_BALL.md](./ROLLING_BALL.md) for detailed physics documentation including:
- Physics equations and force decomposition
- Coordinate transformation details
- Parameter tuning guide
- Troubleshooting tips

## Key Files

- `src/RollingBallDesc.ts` - Physics engine and custom mesh descriptor (~600 lines)
- `src/main.ts` - Volcano eruption system, GUI controls, ball spawning logic

## License

Licensed under either of

- Apache License, Version 2.0
  ([LICENSE-APACHE](LICENSE-APACHE) or http://www.apache.org/licenses/LICENSE-2.0)
- MIT license
  ([LICENSE-MIT](LICENSE-MIT) or http://opensource.org/licenses/MIT)

at your option.
