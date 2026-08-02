import ThreeView from "@navaramap/three";
import { DefaultDescriptions, DefaultPlugin } from "@navaramap/three-default-plugin";
import { RollingBallDesc } from "./RollingBallDesc";
import type { RollingBallConfig } from "./RollingBallDesc";
import { Pane } from "tweakpane";

// Extend descriptions to include rolling ball
interface AppDescriptions extends DefaultDescriptions {
  rollingBall: RollingBallConfig;
}

const view: ThreeView<AppDescriptions> = new ThreeView<AppDescriptions>();

const defaultPlugin = new DefaultPlugin();
view.addPlugin(defaultPlugin);

// Initialization

await view.init();

// Setup scene
defaultPlugin.addDefaultPhotorealScene();

view.atmosphere.date.setHours(8);

view.toneMappingExposure = 10;

// Layer declaration

const raster = view.addSource({
  type: "raster-tile",
  url: "https://tiles.maps.eox.at/wmts?layer=s2cloudless-2020_3857&style=default" +
    "&tilematrixset=g&Service=WMTS&Request=GetTile" +
    "&Version=1.0.0&Format=image%2Fjpeg" +
    "&TileMatrix={z}&TileCol={x}&TileRow={y}",
  maxZoom: 16,
});

view.addLayer({
  type: "raster",
  source: raster,
  raster: {},
});

const terrain = view.addSource({
  type: "quantized-mesh",
  url: "https://terrain.reearth.land/cesium-mesh/ellipsoid/{z}/{x}/{y}.terrain",
  maxZoom: 18,
  requestVertexNormals: true,
  requestWaterMask: true,
});

view.addLayer({
  type: "terrain",
  source: terrain,
  terrain: {},
});

// Attribution

view.attribution?.add([
  {
    attributionHtml: `<a href="https://s2maps.eu">Sentinel-2 cloudless 2020</a> by <a href="https://eox.at">EOX IT Services GmbH</a> (contains modified Copernicus Sentinel data 2020)`,
  },
  {
    attribution: "© Re:Earth Terrain",
    attributionUrl: "https://terrain.reearth.land/",
  },
  {
    attribution: "© Mapterhorn",
    attributionUrl: "https://mapterhorn.com/",
  },
]);

// Register rolling ball mesh descriptor
view.registerMesh("rollingBall", RollingBallDesc);

// Volcano Eruption System
const VOLCANO_CONFIG = {
  lat: 35.36256, // Mount Fuji crater center (degrees)
  lng: 138.7325,
  height: 3776, // Summit height
  craterRadius: 150, // Crater radius in meters (random spawn within this area)
  maxBalls: 500, // Maximum number of balls
  eruptionInterval: 200, // Milliseconds between eruptions (5 balls per second)
  ballRadius: 50, // Ball size in meters
  physics: {
    gravity: 100,
    frictionCoefficient: 0.01,
    rollingResistance: 0.002,
    airDrag: 0.0005,
    restitution: 0.6,
  },
};

// Track all active balls
const activeBalls = new Set<any>();

// Random position within crater area
function randomCraterPosition() {
  // Use square root for uniform distribution in circular area
  const distance = Math.sqrt(Math.random()) * VOLCANO_CONFIG.craterRadius;
  const angle = Math.random() * Math.PI * 2;

  // Convert to lat/lng offset
  const latRad = (VOLCANO_CONFIG.lat * Math.PI) / 180;
  const metersPerDegreeLat = 111320; // Approximately constant
  const metersPerDegreeLng = 111320 * Math.cos(latRad);

  const offsetLat = (distance * Math.sin(angle)) / metersPerDegreeLat;
  const offsetLng = (distance * Math.cos(angle)) / metersPerDegreeLng;

  return {
    lat: VOLCANO_CONFIG.lat + offsetLat,
    lng: VOLCANO_CONFIG.lng + offsetLng,
    height: VOLCANO_CONFIG.height,
  };
}

// Random direction helper
function randomDirection() {
  const angle = Math.random() * Math.PI * 2; // Random angle in radians
  const speed = 200 + Math.random() * 300; // Random speed 200-500 m/s
  return {
    east: Math.cos(angle) * speed,
    north: Math.sin(angle) * speed,
    up: 300 + Math.random() * 400, // Vertical speed 300-700 m/s
  };
}

// Random color helper (vibrant colors)
function randomBallColor() {
  const colors = [
    0xff0000, // Red
    0xff4400, // Red-Orange
    0xff6600, // Orange
    0xff8800, // Light Orange
    0xffaa00, // Yellow-Orange
    0xff2200, // Dark Red
    0xffff00, // Yellow
    0x00ff00, // Green
    0x00ffff, // Cyan
    0x0088ff, // Blue
    0xff00ff, // Magenta
    0xff0088, // Pink
    0x8800ff, // Purple
    0x00ff88, // Spring Green
    0xff8800, // Amber
    0xff00aa, // Hot Pink
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Random emissive color (glow effect)
function randomEmissiveColor() {
  const colors = [
    0xff2200, // Red glow
    0xff6600, // Orange glow
    0xffaa00, // Yellow glow
    0x00ff00, // Green glow
    0x00ffff, // Cyan glow
    0x0088ff, // Blue glow
    0xff00ff, // Magenta glow
    0x8800ff, // Purple glow
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

// Erupt a single ball
function eruptBall() {
  if (activeBalls.size >= VOLCANO_CONFIG.maxBalls) {
    return; // Maximum capacity reached
  }

  const velocity = randomDirection();
  const position = randomCraterPosition(); // Random position within crater
  // Random radius: 50%-150% of configured radius
  const randomRadius = VOLCANO_CONFIG.ballRadius * (0.5 + Math.random() * 1.0);

  const ball = view.addMesh({
    rollingBall: {
      radius: randomRadius,
      initialPosition: position,
      initialVelocity: velocity,
      color: randomBallColor(),
      emissive: randomEmissiveColor(),
      emissiveIntensity: 0.2 + Math.random() * 0.3, // Random glow 0.2-0.5
      physics: VOLCANO_CONFIG.physics,
    },
  } as any);

  activeBalls.add(ball);

  // Monitor ball state and remove when stopped
  const checkInterval = setInterval(() => {
    const state = (ball.ref as RollingBallDesc).getState();
    if (state.isStopped) {
      clearInterval(checkInterval);
      ball.delete();
      activeBalls.delete(ball);
    }
  }, 1000); // Check every second
}

// Continuous eruption loop with dynamic interval
let lastEruptionTime = 0;
function checkEruption() {
  const now = Date.now();
  if (
    activeBalls.size < VOLCANO_CONFIG.maxBalls &&
    now - lastEruptionTime >= VOLCANO_CONFIG.eruptionInterval
  ) {
    eruptBall();
    lastEruptionTime = now;
  }
  requestAnimationFrame(checkEruption);
}
checkEruption();

// Default camera position
const DEFAULT_CAMERA_POSITION = {
  lng: 138.5995983788,
  lat: 35.3164,
  height: 6077,
  heading: 64.3046,
  pitch: -25.616,
  roll: 0,
};

// Function to reset camera to default position
function resetCameraPosition() {
  view.setCamera(DEFAULT_CAMERA_POSITION);
}

// Set initial camera position
resetCameraPosition();

// Camera configuration for tweakpane
const cameraConfig = {
  autoRotate: false,
};

// Auto-rotate camera around Mount Fuji
function animateCamera() {
  requestAnimationFrame(animateCamera);
  view.forceUpdate();

  if (cameraConfig.autoRotate) {
    view.rotateAround(0.001);
  }
}

// Start the animation
animateCamera();

// Expose volcano system for debugging
(window as any).activeBalls = activeBalls;
(window as any).eruptBall = eruptBall;

// Tweakpane GUI for real-time parameter adjustment
const pane = new Pane({ title: "🌋 Volcano Controls" });

// Physics folder
const physicsFolder = pane.addFolder({ title: "Physics" });
physicsFolder.addBinding(VOLCANO_CONFIG.physics, "gravity", {
  label: "Gravity",
  min: 1,
  max: 200,
  step: 1,
});
physicsFolder.addBinding(VOLCANO_CONFIG.physics, "restitution", {
  label: "Restitution",
  min: 0,
  max: 1,
  step: 0.05,
});
physicsFolder.addBinding(VOLCANO_CONFIG.physics, "frictionCoefficient", {
  label: "Friction",
  min: 0,
  max: 0.5,
  step: 0.001,
});
physicsFolder.addBinding(VOLCANO_CONFIG.physics, "rollingResistance", {
  label: "Rolling Resist",
  min: 0,
  max: 0.01,
  step: 0.0001,
});
physicsFolder.addBinding(VOLCANO_CONFIG.physics, "airDrag", {
  label: "Air Drag",
  min: 0,
  max: 0.01,
  step: 0.0001,
});

// Eruption folder
const eruptionFolder = pane.addFolder({ title: "Eruption" });
eruptionFolder.addBinding(VOLCANO_CONFIG, "craterRadius", {
  label: "Crater Radius (m)",
  min: 10,
  max: 500,
  step: 10,
});
eruptionFolder.addBinding(VOLCANO_CONFIG, "maxBalls", {
  label: "Max Balls",
  min: 100,
  max: 1000,
  step: 10,
});
eruptionFolder.addBinding(VOLCANO_CONFIG, "eruptionInterval", {
  label: "Interval (ms)",
  min: 50,
  max: 1000,
  step: 50,
});
eruptionFolder.addBinding(VOLCANO_CONFIG, "ballRadius", {
  label: "Base Radius (m)",
  min: 5,
  max: 100,
  step: 5,
});

// Camera controls folder
const cameraFolder = pane.addFolder({ title: "Camera" });

cameraFolder.addBinding(cameraConfig, "autoRotate", {
  label: "Auto Rotate",
});

cameraFolder.addButton({ title: "Reset Position" }).on("click", resetCameraPosition);

// Info display
const infoFolder = pane.addFolder({ title: "Stats" });
const stats = {
  activeBallCount: 0,
};
const activeBallsBinding = infoFolder.addBinding(stats, "activeBallCount", {
  label: "Active Balls",
  readonly: true,
});

// Update stats every 500ms
setInterval(() => {
  stats.activeBallCount = activeBalls.size;
  activeBallsBinding.refresh();
}, 500);
