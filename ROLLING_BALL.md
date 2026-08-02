# Rolling Ball Physics Implementation

## Overview

A physics-driven rolling ball system on 3D terrain implemented using Navara (@navaramap/three). The ball responds to gravity, terrain slopes, friction, and air resistance.

## Features

- **Realistic Physics**: Gravity decomposition, friction, rolling resistance, and air drag
- **Terrain Interaction**: Real-time terrain height sampling and surface normal calculation
- **Elastic Collisions**: Configurable bounce behavior with energy loss
- **Visual Animation**: Realistic rolling rotation synchronized with velocity
- **ENU Coordinate System**: All physics calculations in local East-North-Up coordinates

## Implementation

### Core Files

- `src/RollingBallDesc.ts` - Main physics engine and mesh descriptor
- `src/main.ts` - Application setup and ball instantiation

### Physics System

The implementation uses a semi-implicit Euler integrator with sub-stepping for stability:

```typescript
// Forces applied each frame:
1. Gravity decomposition (normal + tangent components)
2. Friction force (opposes motion)
3. Rolling resistance (speed-dependent)
4. Air drag (velocity-squared)

// Integration:
acceleration = totalForce / mass
velocity(t+dt) = velocity(t) + acceleration × dt
position(t+dt) = position(t) + velocity(t+dt) × dt
```

### Coordinate Flow

```
Physics (ENU) → ECEF → Geodetic (lat/lng/height) → Mesh Transform
```

### Terrain Normal Calculation

Uses finite difference method to calculate accurate terrain slope:

```typescript
// Sample 4 neighboring points (±0.5m)
// Calculate gradients: dh/deast, dh/dnorth
// Normal = normalize(-dh/deast, -dh/dnorth, 1)
```

## Usage

### Basic Setup

```typescript
import { RollingBallDesc } from "./RollingBallDesc";

// Register the custom mesh type
view.registerMesh("rollingBall", RollingBallDesc);

// Create a ball instance
const ball = view.addMesh<RollingBallDesc>({
  rollingBall: {
    radius: 2, // meters
    initialPosition: {
      lat: 35.681236,    // degrees
      lng: 139.767125,   // degrees
      height: 100        // meters above terrain
    },
    initialVelocity: {
      east: 20,  // m/s
      north: 10  // m/s
    },
    physics: {
      gravity: 9.81,
      frictionCoefficient: 0.15,
      rollingResistance: 0.02,
      airDrag: 0.005,
      restitution: 0.3  // 30% bounce
    }
  }
});
```

### Configuration Options

| Parameter | Default | Description |
|-----------|---------|-------------|
| `radius` | - | Ball radius in meters (required) |
| `initialPosition` | - | Starting lat/lng/height (required) |
| `initialVelocity` | - | Initial east/north velocity in m/s (required) |
| `gravity` | 9.81 | Gravitational acceleration (m/s²) |
| `frictionCoefficient` | 0.15 | Surface friction (0-1) |
| `rollingResistance` | 0.02 | Rolling resistance coefficient |
| `airDrag` | 0.005 | Air drag coefficient |
| `restitution` | 0.3 | Bounce elasticity (0-1) |

### Advanced Usage

**Apply impulse to moving ball:**
```typescript
ball.applyImpulse({ east: 10, north: 5 }, 20); // 20 m/s impulse
```

**Monitor ball state:**
```typescript
const state = ball.getState();
console.log(`Speed: ${state.velocityENU.length()} m/s`);
console.log(`Position: ${state.lat}°, ${state.lng}°`);
```

## Known Limitations

1. **Terrain resolution**: Low-res terrain may cause jittery normals
2. **High-speed collisions**: Very fast impacts may penetrate slightly
3. **Coordinate precision**: Extreme distances may accumulate floating-point error
4. **Single ball**: Not optimized for many simultaneous balls


## Running the Demo

```bash
npm install --legacy-peer-deps
npm run dev
```

Open http://localhost:8080 and watch the ball roll across Tokyo terrain.
