import ThreeView, { MeshDesc } from "@navaramap/three";
import {
  geodeticToVector3,
  vector3ToGeodetic,
  eastNorthUpToFixedFrame,
  degreeToRadian,
  radianToDegree,
} from "@navaramap/three";
import {
  Vector3,
  SphereGeometry,
  MeshStandardMaterial,
  Mesh,
} from "three";

/**
 * Configuration interface for the rolling ball physics
 */
export interface RollingBallConfig {
  radius: number; // Ball radius in meters
  initialPosition: {
    lat: number; // Latitude in degrees
    lng: number; // Longitude in degrees
    height: number; // Height in meters above terrain
  };
  initialVelocity: {
    east: number; // East velocity in m/s
    north: number; // North velocity in m/s
    up?: number; // Up velocity in m/s (optional, default: 0)
  };
  color?: number; // Ball color (hex, optional, default: 0xff4444)
  emissive?: number; // Emissive color (hex, optional)
  emissiveIntensity?: number; // Emissive intensity (optional, default: 0)
  physics?: {
    gravity?: number; // Gravity acceleration (default: 9.81 m/s²)
    frictionCoefficient?: number; // Friction coefficient (default: 0.15)
    rollingResistance?: number; // Rolling resistance (default: 0.02)
    airDrag?: number; // Air drag coefficient (default: 0.005)
    restitution?: number; // Collision elasticity (default: 0.3)
  };
}

/**
 * Internal physics state
 */
interface PhysicsState {
  // Position (degrees and meters)
  lat: number;
  lng: number;
  height: number;

  // Velocity in ENU coordinate system (m/s)
  velocityENU: Vector3;

  // Terrain information
  terrainHeight: number;
  surfaceNormal: Vector3;

  // Rotation state
  rotationAxis: Vector3;
  angularVelocity: number;

  // Timing
  lastTime: number;

  // Status
  isStopped: boolean;
}

/**
 * Custom mesh descriptor for a physics-driven rolling ball on 3D terrain
 */
export class RollingBallDesc extends MeshDesc {
  private state: PhysicsState;
  private config: RollingBallConfig;
  private frameCount = 0;
  private Vector3Constructor: any; // Store the correct Vector3 constructor

  constructor(view: ThreeView, ctx: any, config: any) {
    super(view, ctx);

    const actualConfig: RollingBallConfig = (config as any).rollingBall || config;

    // Validate config structure
    if (!actualConfig || !actualConfig.initialPosition || !actualConfig.initialVelocity) {
      console.error("❌ Invalid config after extraction:", {
        rawConfig: config,
        actualConfig,
        hasActualConfig: !!actualConfig,
      });
      throw new Error(
        `RollingBallDesc: Invalid config structure. ` +
        `Expected: { rollingBall: { radius, initialPosition, initialVelocity, physics? } }`
      );
    }

    this.config = {
      ...actualConfig,
      physics: {
        gravity: actualConfig.physics?.gravity ?? 9.81,
        frictionCoefficient: actualConfig.physics?.frictionCoefficient ?? 0.15,
        rollingResistance: actualConfig.physics?.rollingResistance ?? 0.02,
        airDrag: actualConfig.physics?.airDrag ?? 0.005,
        restitution: actualConfig.physics?.restitution ?? 0.3,
      },
    };

    // Initialize physics state
    // Use geodeticToVector3 to get a Vector3 instance from Navara, then modify it
    // This ensures we use the same Vector3 instance that Navara uses
    const dummyPos = geodeticToVector3({
      lat: 0,
      lng: 0,
      height: 0,
    });
    const initialVelocity = dummyPos.clone();

    // Set values directly on properties
    initialVelocity.x = actualConfig.initialVelocity.east;
    initialVelocity.y = actualConfig.initialVelocity.north;
    initialVelocity.z = actualConfig.initialVelocity.up ?? 0;

    // Test: create using the constructor from the same Three instance
    const testVec = new (initialVelocity.constructor as any)(
      actualConfig.initialVelocity.east,
      actualConfig.initialVelocity.north,
      actualConfig.initialVelocity.up ?? 0
    );

    // Use whichever works
    const finalVelocity = testVec.x !== undefined && !isNaN(testVec.x) ? testVec : initialVelocity;

    // Store the correct Vector3 constructor for later use
    this.Vector3Constructor = finalVelocity.constructor;

    // Create other Vector3 instances using the same constructor
    const surfaceNormal = new this.Vector3Constructor(0, 0, 1);
    const rotationAxis = new this.Vector3Constructor(1, 0, 0);

    this.state = {
      lat: actualConfig.initialPosition.lat,
      lng: actualConfig.initialPosition.lng,
      height: actualConfig.initialPosition.height,
      velocityENU: finalVelocity,
      terrainHeight: 0,
      surfaceNormal: surfaceNormal,
      rotationAxis: rotationAxis,
      angularVelocity: 0,
      lastTime: 0,
      isStopped: false,
    };
  }

  /**
   * Helper to create Vector3 with the correct constructor
   */
  private createVector3(x: number, y: number, z: number) {
    return new this.Vector3Constructor(x, y, z);
  }

  /**
   * Creates the Three.js mesh for the ball
   */
  createMesh(): Mesh {
    const geometry = new SphereGeometry(this.config.radius, 32, 32);
    const material = new MeshStandardMaterial({
      color: this.config.color ?? 0xff4444,
      emissive: this.config.emissive ?? 0x000000,
      emissiveIntensity: this.config.emissiveIntensity ?? 0,
      roughness: 0.7,
      metalness: 0.3,
    });

    this._instance = new Mesh(geometry, material);
    this._instance.castShadow = true;
    this._instance.receiveShadow = true;

    // Set initial position
    this.updateMeshTransform();

    return this._instance as Mesh;
  }

  /**
   * Main update loop called every frame
   */
  update(time: number): void {
    if (this.state.isStopped || !this._instance) return;

    // CRITICAL: Check if position is already wrong before first update
    if (this.frameCount === 0 && (this.state.lat < 30 || this.state.lat > 40)) {
      console.error("❌ Position is already wrong before first update!", {
        expected: { lat: 35.360556, lng: 138.727778 },
        actual: { lat: this.state.lat, lng: this.state.lng },
      });
    }

    // Calculate delta time
    const dt = this.calculateDeltaTime(time);
    if (dt > 0.1 || dt <= 0) return; // Skip abnormal frames

    this.frameCount++;

    // Update terrain information
    if (this.shouldSampleTerrain()) {
      this.updateTerrainInfo();
    }

    // Run physics simulation
    this.simulatePhysics(dt);

    // Update visual representation
    this.updateMeshTransform();
    this.updateRotation(dt);

    // Check stop condition (re-enabled)
    this.checkStopCondition();
  }

  /**
   * Calculate time delta since last frame
   */
  private calculateDeltaTime(time: number): number {
    if (this.state.lastTime === 0) {
      this.state.lastTime = time;
      return 0;
    }

    const dt = Math.min((time - this.state.lastTime) / 1000, 1 / 30); // Max 30fps
    this.state.lastTime = time;
    return dt;
  }

  /**
   * Determine if terrain should be sampled this frame (performance optimization)
   */
  private shouldSampleTerrain(): boolean {
    const speed = this.state.velocityENU.length();
    if (speed < 1) return this.frameCount % 3 === 0; // Slow: every 3 frames
    return true; // Fast: every frame
  }

  /**
   * Update terrain height and surface normal
   */
  private updateTerrainInfo(): void {
    // Check for invalid state
    if (isNaN(this.state.lat) || isNaN(this.state.lng)) {
      console.error("❌ Invalid lat/lng:", {
        lat: this.state.lat,
        lng: this.state.lng,
      });
      return;
    }

    const latRad = degreeToRadian(this.state.lat);
    const lngRad = degreeToRadian(this.state.lng);

    // Sample terrain height
    const sampledHeight = this.view.sampleTerrainHeight({
      lat: latRad,
      lng: lngRad,
      height: 0,
    });

    // Use fallback if terrain not loaded yet
    this.state.terrainHeight = sampledHeight ?? 0;

    // Calculate terrain normal using finite differences
    this.state.surfaceNormal = this.calculateTerrainNormal();
  }

  /**
   * Calculate smooth terrain normal using larger sampling distance
   * This prevents balls from stopping on micro-terrain details
   */
  private calculateTerrainNormal(): Vector3 {
    const delta = 10; // Sampling distance in meters (larger for smoother slope)

    // Convert to radians for calculations
    const latRad = degreeToRadian(this.state.lat);

    // Calculate meter-to-degree conversion at current latitude
    const metersPerDegreeLat = 111320; // Approximately constant
    const metersPerDegreeLng = 111320 * Math.cos(latRad);

    // Sample 4 neighboring points (standard finite difference)
    const hE = this.sampleHeightAtOffset(delta / metersPerDegreeLng, 0);
    const hW = this.sampleHeightAtOffset(-delta / metersPerDegreeLng, 0);
    const hN = this.sampleHeightAtOffset(0, delta / metersPerDegreeLat);
    const hS = this.sampleHeightAtOffset(0, -delta / metersPerDegreeLat);

    // Check if terrain data is available
    if (hE === undefined || hW === undefined || hN === undefined || hS === undefined) {
      // Terrain not loaded yet - return default up vector
      return this.createVector3(0, 0, 1);
    }

    // Calculate gradients (height change per meter)
    const dhdx = (hE - hW) / (2 * delta); // East-West gradient (positive = slope up to east)
    const dhdy = (hN - hS) / (2 * delta); // North-South gradient (positive = slope up to north)

    // Normal vector = (-dh/dx, -dh/dy, 1) normalized
    // The negative signs convert slope gradients to normal direction
    return this.createVector3(-dhdx, -dhdy, 1).normalize();
  }

  /**
   * Sample terrain height at offset (in degrees)
   */
  private sampleHeightAtOffset(lngOffset: number, latOffset: number): number | undefined {
    const lat = degreeToRadian(this.state.lat + latOffset);
    const lng = degreeToRadian(this.state.lng + lngOffset);

    return this.view.sampleTerrainHeight({ lat, lng, height: 0 });
  }

  /**
   * Main physics simulation step
   */
  private simulatePhysics(dt: number): void {
    // Use sub-stepping for stability
    const subSteps = Math.max(1, Math.ceil(dt / 0.016)); // Minimum 60fps
    const subDt = dt / subSteps;

    for (let i = 0; i < subSteps; i++) {
      this.physicsStep(subDt);
    }
  }

  /**
   * Single physics integration step
   */
  private physicsStep(dt: number): void {
    // Calculate all forces
    const totalForce = this.calculateForces();

    // Debug removed - physics is working

    // Semi-implicit Euler integration
    const acceleration = totalForce.clone(); // Force = mass * acceleration (mass = 1 for simplicity)

    // Update velocity
    this.state.velocityENU.add(acceleration.multiplyScalar(dt));

    // Clamp maximum velocity (prevent numerical instability)
    if (this.state.velocityENU.length() > 50000) {
      this.state.velocityENU.setLength(50000);
    }

    // Update position
    const displacement = this.state.velocityENU.clone().multiplyScalar(dt);
    this.updatePositionFromENU(displacement);

    // Update height separately (ENU z-component)
    this.state.height += displacement.z;

    // Handle collision with terrain
    this.handleCollision();
  }

  /**
   * Calculate all forces acting on the ball
   */
  private calculateForces(): Vector3 {
    const forces = this.createVector3(0, 0, 0);
    const physics = this.config.physics!;

    // Check if ball is on the ground
    const ballBottom = this.state.height - this.config.radius;
    const isOnGround = ballBottom <= this.state.terrainHeight + 0.1; // 10cm tolerance

    // 1. Gravity
    const gravity = this.createVector3(0, 0, -physics.gravity!);
    const speed = this.state.velocityENU.length();

    if (isOnGround) {
      // On ground: decompose gravity into normal and tangent components
      const normal = this.state.surfaceNormal;
      const gravityNormalMag = gravity.dot(normal);
      const normalForce = normal.clone().multiplyScalar(gravityNormalMag);
      const tangentForce = gravity.clone().sub(normalForce);
      forces.add(tangentForce); // Only add tangent force (slope component)

      // 2. Friction force (only when on ground) - REDUCE IT MORE
      if (speed > 0.001) {
        const frictionMagnitude = physics.frictionCoefficient! * Math.abs(gravityNormalMag) * 0.3; // Apply only 30% of friction
        const frictionDirection = this.state.velocityENU.clone().normalize().negate();
        const frictionForce = frictionDirection.multiplyScalar(frictionMagnitude);
        forces.add(frictionForce);
      }

      // 3. Rolling resistance (only when on ground) - REDUCE IT MORE
      if (speed > 0.001) {
        const rollingResistanceMag = physics.rollingResistance! * speed * 0.3; // Apply only 30% of resistance
        const rollingDirection = this.state.velocityENU.clone().normalize().negate();
        const rollingForce = rollingDirection.multiplyScalar(rollingResistanceMag);
        forces.add(rollingForce);
      }
    } else {
      // In air: apply full gravity (no friction or rolling resistance)
      forces.add(gravity);
    }

    // 4. Air drag (proportional to v²)
    if (speed > 0.001) {
      const dragMagnitude = physics.airDrag! * speed * speed;
      const dragDirection = this.state.velocityENU.clone().normalize().negate();
      const dragForce = dragDirection.multiplyScalar(dragMagnitude);
      forces.add(dragForce);
    }

    return forces;
  }

  /**
   * Handle collision with terrain (elastic bounce)
   */
  private handleCollision(): void {
    // Ball center is at this.state.height, so bottom is center - radius
    const ballBottom = this.state.height - this.config.radius;
    const groundLevel = this.state.terrainHeight;

    if (ballBottom <= groundLevel) {
      // Penetration depth
      const penetration = groundLevel - ballBottom;

      // Correct position: ball center should be at ground + radius
      this.state.height = groundLevel + this.config.radius;

      // Decompose velocity into normal and tangent components
      const normal = this.state.surfaceNormal;
      const velocityNormalMag = this.state.velocityENU.dot(normal);

      if (velocityNormalMag < 0) {
        // Only bounce if moving into ground
        const velocityNormal = normal.clone().multiplyScalar(velocityNormalMag);
        const velocityTangent = this.state.velocityENU.clone().sub(velocityNormal);

        // Apply restitution to normal component
        const restitution = this.config.physics!.restitution!;
        const velocityNormalBounce = velocityNormal.multiplyScalar(-restitution);

        // Recombine
        this.state.velocityENU = velocityTangent.add(velocityNormalBounce);

        // Reduce energy loss - keep more speed for dramatic effect
        if (penetration > 0.1) {
          this.state.velocityENU.multiplyScalar(0.98); // Was 0.95
        }
      }
    }
  }

  /**
   * Update ball position from ENU displacement
   */
  private updatePositionFromENU(displacementENU: Vector3): void {
    // Debug removed - coordinate conversion is working

    // Check for invalid input
    if (isNaN(this.state.lat) || isNaN(this.state.lng) || isNaN(this.state.height)) {
      console.error("❌ Cannot update position - current state has NaN:", {
        lat: this.state.lat,
        lng: this.state.lng,
        height: this.state.height,
      });
      return;
    }

    if (isNaN(displacementENU.x) || isNaN(displacementENU.y) || isNaN(displacementENU.z)) {
      console.error("❌ Cannot update position - displacement has NaN:", {
        x: displacementENU.x,
        y: displacementENU.y,
        z: displacementENU.z,
      });
      return;
    }

    // 1. Current position → ECEF
    const currentECEF = geodeticToVector3({
      lat: degreeToRadian(this.state.lat),
      lng: degreeToRadian(this.state.lng),
      height: this.state.height,
    });

    // 2. Build ENU → ECEF transformation matrix
    const enuToECEFMatrix = eastNorthUpToFixedFrame(currentECEF);

    // 3. Transform displacement from ENU to ECEF
    // IMPORTANT: Use transformDirection to only apply rotation, not translation!
    // displacementENU is a direction/displacement, not a position
    const displacementECEF = displacementENU.clone();
    displacementECEF.applyMatrix4(enuToECEFMatrix);

    // Actually, we need to manually handle this because applyMatrix4 treats as position
    // Extract only the rotation part by getting the axes from the matrix
    const m = enuToECEFMatrix.elements;
    const x = displacementENU.x * m[0] + displacementENU.y * m[4] + displacementENU.z * m[8];
    const y = displacementENU.x * m[1] + displacementENU.y * m[5] + displacementENU.z * m[9];
    const z = displacementENU.x * m[2] + displacementENU.y * m[6] + displacementENU.z * m[10];
    displacementECEF.set(x, y, z);

    // 4. Update ECEF position
    const newECEF = currentECEF.add(displacementECEF);

    // 5. Convert back to geodetic
    const newGeodetic = vector3ToGeodetic(newECEF);
    const newLat = radianToDegree(newGeodetic.lat);
    const newLng = radianToDegree(newGeodetic.lng);

    // Validate output before updating state
    if (isNaN(newLat) || isNaN(newLng)) {
      console.error("❌ Position update produced NaN:", {
        newLat,
        newLng,
        newGeodetic,
        currentECEF,
        displacementECEF,
        newECEF,
      });
      return;
    }

    // Debug removed

    this.state.lat = newLat;
    this.state.lng = newLng;
    // Height is updated separately in physicsStep
  }

  /**
   * Update Three.js mesh transform to match physics state
   */
  private updateMeshTransform(): void {
    if (!this._instance) return;

    const position = geodeticToVector3({
      lat: degreeToRadian(this.state.lat),
      lng: degreeToRadian(this.state.lng),
      height: this.state.height,
    });

    const mesh = this._instance as Mesh;
    mesh.position.copy(position);

    // Align ball with surface normal
    const up = this.state.surfaceNormal;
    mesh.up.copy(up);
    mesh.lookAt(position.clone().add(up));
  }

  /**
   * Update visual rolling animation
   */
  private updateRotation(dt: number): void {
    if (!this._instance) return;

    const speed = this.state.velocityENU.length();
    if (speed < 0.001) return;

    // Angular velocity = linear velocity / radius
    this.state.angularVelocity = speed / this.config.radius;

    // Rotation axis = velocity × up (cross product)
    const velocity2D = this.createVector3(
      this.state.velocityENU.x,
      this.state.velocityENU.y,
      0
    ).normalize();

    this.state.rotationAxis
      .crossVectors(velocity2D, this.createVector3(0, 0, 1))
      .normalize();

    // Apply rotation
    if (this.state.rotationAxis.length() > 0.1) {
      (this._instance as Mesh).rotateOnAxis(
        this.state.rotationAxis,
        this.state.angularVelocity * dt
      );
    }
  }

  /**
   * Check if ball should stop (velocity below threshold AND on flat ground)
   */
  private checkStopCondition(): void {
    const speed = this.state.velocityENU.length();
    const stopThreshold = 0.05; // m/s

    if (speed < stopThreshold) {
      // Check if on a slope - if normal z-component is close to 1, it's flat
      const normalZ = this.state.surfaceNormal.z;
      const slopeThreshold = 0.98; // cos(~11.5°) - stop only if slope < 11.5 degrees

      // Only stop if on relatively flat ground
      if (normalZ > slopeThreshold) {
        this.state.isStopped = true;
        this.state.velocityENU.set(0, 0, 0);
      }
      // If on a slope, keep simulating - gravity will accelerate it
    }
  }

  /**
   * Public method to apply an impulse to the ball
   */
  applyImpulse(direction: { east: number; north: number }, magnitude: number): void {
    const impulse = this.createVector3(direction.east, direction.north, 0)
      .normalize()
      .multiplyScalar(magnitude);

    this.state.velocityENU.add(impulse);
    this.state.isStopped = false;
  }

  /**
   * Public method to restart the ball with new velocity
   */
  restart(): void {
    this.state.isStopped = false;
    this.state.velocityENU.set(
      this.config.initialVelocity.east,
      this.config.initialVelocity.north,
      0
    );
  }

  /**
   * Get current physics state (for debugging)
   */
  getState(): Readonly<PhysicsState> {
    return { ...this.state };
  }
}
