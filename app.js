/* ==========================================================================
   BHARAT FLOWSIZE PRO — SIMULATION ENGINE & 3D CONTROLLER (VANILLA JS)
   ========================================================================== */

const $ = (id) => document.getElementById(id);

// --- Custom Orbit Controls for WebGL Scenes ---
class CustomOrbitControls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.domElement = domElement;
    
    this.enableDamping = true;
    this.dampingFactor = 0.05;
    this.minDistance = 1.0;
    this.maxDistance = 20.0;
    this.minPolarAngle = 0;
    this.maxPolarAngle = Math.PI;
    this.autoRotate = false;
    this.autoRotateSpeed = 2.0;
    this.target = new THREE.Vector3(0, 0, 0);

    this.spherical = {
      radius: camera.position.distanceTo(this.target),
      phi: 0,
      theta: 0
    };

    this.updateSphericalFromCamera();

    this.targetSpherical = {
      radius: this.spherical.radius,
      phi: this.spherical.phi,
      theta: this.spherical.theta
    };

    this.listeners = {};
    this.isDragging = false;
    this.prevMousePosition = { x: 0, y: 0 };

    this.initEvents();
  }

  updateSphericalFromCamera() {
    const offset = new THREE.Vector3().copy(this.camera.position).sub(this.target);
    this.spherical.radius = offset.length();
    if (this.spherical.radius === 0) {
      this.spherical.phi = 0;
      this.spherical.theta = 0;
    } else {
      this.spherical.phi = Math.acos(Math.max(-1, Math.min(1, offset.y / this.spherical.radius)));
      this.spherical.theta = Math.atan2(offset.x, offset.z);
    }
  }

  addEventListener(type, callback) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(callback);
  }

  dispatchEvent(event) {
    if (this.listeners[event.type]) {
      this.listeners[event.type].forEach(cb => cb(event));
    }
  }

  initEvents() {
    const onMouseDown = (e) => {
      this.isDragging = true;
      this.prevMousePosition.x = e.clientX;
      this.prevMousePosition.y = e.clientY;
      this.dispatchEvent({ type: 'start' });
    };

    const onMouseMove = (e) => {
      if (!this.isDragging) return;
      const dx = e.clientX - this.prevMousePosition.x;
      const dy = e.clientY - this.prevMousePosition.y;

      this.prevMousePosition.x = e.clientX;
      this.prevMousePosition.y = e.clientY;

      const factorX = 2 * Math.PI / this.domElement.clientWidth;
      const factorY = Math.PI / this.domElement.clientHeight;

      this.targetSpherical.theta -= dx * factorX * 0.8;
      this.targetSpherical.phi -= dy * factorY * 0.8;
      this.targetSpherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.targetSpherical.phi));
    };

    const onMouseUp = () => {
      this.isDragging = false;
    };

    const onWheel = (e) => {
      e.preventDefault();
      const zoomFactor = 1.05;
      if (e.deltaY < 0) {
        this.targetSpherical.radius /= zoomFactor;
      } else {
        this.targetSpherical.radius *= zoomFactor;
      }
      this.targetSpherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.targetSpherical.radius));
    };

    const onTouchStart = (e) => {
      if (e.touches.length === 1) {
        this.isDragging = true;
        this.prevMousePosition.x = e.touches[0].clientX;
        this.prevMousePosition.y = e.touches[0].clientY;
        this.dispatchEvent({ type: 'start' });
      }
    };

    const onTouchMove = (e) => {
      if (!this.isDragging || e.touches.length !== 1) return;
      const dx = e.touches[0].clientX - this.prevMousePosition.x;
      const dy = e.touches[0].clientY - this.prevMousePosition.y;

      this.prevMousePosition.x = e.touches[0].clientX;
      this.prevMousePosition.y = e.touches[0].clientY;

      const factorX = 2 * Math.PI / this.domElement.clientWidth;
      const factorY = Math.PI / this.domElement.clientHeight;

      this.targetSpherical.theta -= dx * factorX * 1.0;
      this.targetSpherical.phi -= dy * factorY * 1.0;
      this.targetSpherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.targetSpherical.phi));
    };

    this.domElement.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    this.domElement.addEventListener('wheel', onWheel, { passive: false });

    this.domElement.addEventListener('touchstart', onTouchStart, { passive: true });
    this.domElement.addEventListener('touchmove', onTouchMove, { passive: true });
    this.domElement.addEventListener('touchend', onMouseUp);
  }

  update() {
    if (this.autoRotate && !this.isDragging) {
      const speed = (this.autoRotateSpeed / 60) * 0.05;
      this.targetSpherical.theta += speed;
    }

    if (this.enableDamping) {
      this.spherical.theta += (this.targetSpherical.theta - this.spherical.theta) * this.dampingFactor;
      this.spherical.phi += (this.targetSpherical.phi - this.spherical.phi) * this.dampingFactor;
      this.spherical.radius += (this.targetSpherical.radius - this.spherical.radius) * this.dampingFactor;
    } else {
      this.spherical.theta = this.targetSpherical.theta;
      this.spherical.phi = this.targetSpherical.phi;
      this.spherical.radius = this.targetSpherical.radius;
    }

    this.spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.spherical.phi));
    
    const sinPhiRadius = Math.sin(this.spherical.phi) * this.spherical.radius;
    
    this.camera.position.x = this.target.x + sinPhiRadius * Math.sin(this.spherical.theta);
    this.camera.position.y = this.target.y + Math.cos(this.spherical.phi) * this.spherical.radius;
    this.camera.position.z = this.target.z + sinPhiRadius * Math.cos(this.spherical.theta);

    this.camera.lookAt(this.target);
  }
}

// --- Global Sizing State ---
const state = {
  pump: {
    calculated: false,
    inputs: {},
    results: {}
  },
  line: {
    calculated: false,
    inputs: {},
    results: {},
    activeType: 'liquid'
  },
  sthe: {
    calculated: false,
    inputs: {},
    results: {}
  }
};

// --- Chart Handles ---
let pumpChartInstance = null;
let reportPumpChartInstance = null;
let lineChartInstance = null;
let reportLineChartInstance = null;

// --- 3D WebGL Scene Handles ---
const pump3D = {
  scene: null, camera: null, renderer: null, controls: null,
  impellerGroup: null, particles: [], isRunning: false, speedScale: 1.0,
  animationId: null,
  // Dynamic mesh references — full hydraulic loop
  vesselBody: null, vesselLiquid: null, vesselTop: null, vesselBottom: null,
  supportGroup: null, suctionPipeV: null, suctionPipeH: null,
  dischargePipe: null, motorMesh: null, motorGroup: null,
  casingMesh: null, casingGroup: null, baseMesh: null, shaftMesh: null,
  suctionFlange: null, dischargeFlange: null, vesselGaugeNeedle: null,
  dischargeGaugeNeedle: null, suctionGaugeNeedle: null,
  flowSpeedMultiplier: 1.0, targetFlowSpeed: 1.0,
  targetSpinSpeed: 1.0, currentSpinSpeed: 0.012,
  liquidTop: null, lllRing: null, lllDisc: null,
  // Scene geometry params (updated from user inputs)
  vesselElevation: 5.0, pumpCL: 0.75, lllPercent: 0
};

const line3D = {
  scene: null, camera: null, renderer: null, controls: null,
  particles: [], isRunning: false, speedScale: 1.0, velocity: 1.5,
  animationId: null
};

const dphe3D = {
  scene: null, camera: null, renderer: null, controls: null,
  animationId: null, particles: [], initialized: false,
  outerPipe: null, innerPipe: null, flanges: [], hotParticles: [], coldParticles: []
};

const sthe3D = {
  scene: null, camera: null, renderer: null, controls: null,
  animationId: null, particles: [], initialized: false,
  shell: null, tubes: [], baffles: [], flanges: [], hotParticles: [], coldParticles: []
};

const gas3D = {
  scene: null, camera: null, renderer: null, controls: null,
  animationId: null, initialized: false, particles: []
};

// --- Undo/Redo System ---
const undoRedoStacks = {
  pump: { undo: [], redo: [], max: 50 },
  line: { undo: [], redo: [], max: 50 },
  gas: { undo: [], redo: [], max: 50 },
  dphe: { undo: [], redo: [], max: 50 },
  sthe: { undo: [], redo: [], max: 50 }
};
let undoDebounceTimers = {};

function captureFormState(formSelector) {
  const s = {};
  document.querySelectorAll(formSelector + ' input, ' + formSelector + ' select').forEach(el => {
    if (el.id) s[el.id] = el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value;
  });
  return s;
}

function restoreFormState(state) {
  Object.keys(state).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.type === 'checkbox' || el.type === 'radio') el.checked = state[id];
    else el.value = state[id];
  });
}

function pushUndo(module, formSelector) {
  const stack = undoRedoStacks[module];
  const snapshot = captureFormState(formSelector);
  if (stack.undo.length > 0 && JSON.stringify(stack.undo[stack.undo.length - 1]) === JSON.stringify(snapshot)) return;
  stack.undo.push(snapshot);
  if (stack.undo.length > stack.max) stack.undo.shift();
  stack.redo = [];
}

function debouncedPushUndo(module, formSelector) {
  clearTimeout(undoDebounceTimers[module]);
  undoDebounceTimers[module] = setTimeout(() => pushUndo(module, formSelector), 600);
}

function performUndo(module, formSelector, calcFn) {
  const stack = undoRedoStacks[module];
  if (stack.undo.length === 0) return;
  stack.redo.push(captureFormState(formSelector));
  restoreFormState(stack.undo.pop());
  if (calcFn) calcFn();
}

function performRedo(module, formSelector, calcFn) {
  const stack = undoRedoStacks[module];
  if (stack.redo.length === 0) return;
  stack.undo.push(captureFormState(formSelector));
  restoreFormState(stack.redo.pop());
  if (calcFn) calcFn();
}

// --- Preset Databases ---

// 1. Fluids Presets Database
const FLUID_PRESETS = {
  water: { name: "Water", density: 997, viscosity: 0.89, vaporPressure: 0.032, defaultTemp: 25 },
  steam: { name: "Steam", density: 1.2, viscosity: 0.013, vaporPressure: 1.013, defaultTemp: 100 },
  light_hydrocarbon: { name: "Light Hydrocarbon", density: 650, viscosity: 0.25, vaporPressure: 4.5, defaultTemp: 40 },
  heavy_hydrocarbon: { name: "Heavy Hydrocarbon", density: 850, viscosity: 5.0, vaporPressure: 0.05, defaultTemp: 80 },
  ammonia: { name: "Ammonia", density: 682, viscosity: 0.27, vaporPressure: 8.500, defaultTemp: 20 },
  methanol: { name: "Methanol", density: 792, viscosity: 0.6, vaporPressure: 0.13, defaultTemp: 20 },
  caustic: { name: "Caustic Soda (30%)", density: 1330, viscosity: 3.0, vaporPressure: 0.020, defaultTemp: 20 },
  caustic_50: { name: "Caustic Soda 50%", density: 1525, viscosity: 12.0, vaporPressure: 0.015, defaultTemp: 25 },
  diesel: { name: "Diesel", density: 830, viscosity: 3.0, vaporPressure: 0.010, defaultTemp: 25 },
  oil: { name: "Fuel Oil", density: 890, viscosity: 8.0, vaporPressure: 0.010, defaultTemp: 50 },
  lpg: { name: "LPG", density: 540, viscosity: 0.20, vaporPressure: 8.000, defaultTemp: 20 },
  ethanol: { name: "Ethanol", density: 789, viscosity: 1.20, vaporPressure: 0.079, defaultTemp: 20 },
  glycol: { name: "Glycol (Ethylene)", density: 1113, viscosity: 16.1, vaporPressure: 0.012, defaultTemp: 25 },
  toluene: { name: "Toluene", density: 867, viscosity: 0.59, vaporPressure: 0.029, defaultTemp: 20 },
  acetone: { name: "Acetone", density: 790, viscosity: 0.32, vaporPressure: 0.246, defaultTemp: 20 },
  sulfuric_acid: { name: "Sulfuric Acid 98%", density: 1836, viscosity: 26.0, vaporPressure: 0.001, defaultTemp: 25 },
  hydrochloric_acid: { name: "Hydrochloric Acid 35%", density: 1175, viscosity: 1.9, vaporPressure: 0.084, defaultTemp: 20 },
  light_hc: { name: "Light Hydrocarbon (LPG)", density: 550, viscosity: 0.14, vaporPressure: 4.5, defaultTemp: 20 },
  heavy_hc: { name: "Heavy Hydrocarbon (HFO)", density: 980, viscosity: 180.0, vaporPressure: 0.005, defaultTemp: 60 },
  brine: { name: "Brine (NaCl 20%)", density: 1150, viscosity: 1.8, vaporPressure: 0.023, defaultTemp: 25 },
  crude_oil: { name: "Crude Oil (medium)", density: 870, viscosity: 25.0, vaporPressure: 0.035, defaultTemp: 30 },
  condensate: { name: "Condensate", density: 750, viscosity: 0.5, vaporPressure: 0.30, defaultTemp: 40 },
  nitrogen: { name: "Nitrogen (Liquid)", density: 808, viscosity: 0.16, vaporPressure: 2.000, defaultTemp: -196 },
  cooling_water: { name: "Cooling Water", density: 995, viscosity: 0.80, vaporPressure: 0.040, defaultTemp: 30 },
  boiler_feed: { name: "Boiler Feed Water", density: 960, viscosity: 0.30, vaporPressure: 0.700, defaultTemp: 90 },
  custom: { name: "Custom Fluid", density: "", viscosity: "", vaporPressure: "", defaultTemp: "" },
  user_defined: { name: "User Defined", density: "", viscosity: "", vaporPressure: "", defaultTemp: "" }
};

const PUMP_VAPOR_PRESSURE_TABLE = [
  { t: 0, p: 0.0061 }, { t: 5, p: 0.0087 }, { t: 10, p: 0.0123 }, { t: 15, p: 0.0170 }, { t: 20, p: 0.0234 },
  { t: 25, p: 0.0317 }, { t: 30, p: 0.0425 }, { t: 35, p: 0.0563 }, { t: 40, p: 0.0738 }, { t: 45, p: 0.0959 },
  { t: 50, p: 0.1235 }, { t: 55, p: 0.1575 }, { t: 60, p: 0.1992 }, { t: 65, p: 0.2498 }, { t: 70, p: 0.3117 },
  { t: 75, p: 0.3860 }, { t: 80, p: 0.4739 }, { t: 85, p: 0.5790 }, { t: 90, p: 0.7011 }, { t: 95, p: 0.8450 },
  { t: 100, p: 1.0133 }, { t: 110, p: 1.4330 }, { t: 120, p: 1.9870 }, { t: 130, p: 2.7010 }, { t: 140, p: 3.6140 },
  { t: 150, p: 4.7580 }, { t: 160, p: 6.1800 }, { t: 170, p: 7.9300 }, { t: 180, p: 10.030 }, { t: 190, p: 12.540 },
  { t: 200, p: 15.540 }
];

function lookupPumpVaporPressure(tempC) {
  if (tempC <= PUMP_VAPOR_PRESSURE_TABLE[0].t) return PUMP_VAPOR_PRESSURE_TABLE[0].p;
  if (tempC >= PUMP_VAPOR_PRESSURE_TABLE[PUMP_VAPOR_PRESSURE_TABLE.length - 1].t) return PUMP_VAPOR_PRESSURE_TABLE[PUMP_VAPOR_PRESSURE_TABLE.length - 1].p;
  
  for (let i = 0; i < PUMP_VAPOR_PRESSURE_TABLE.length - 1; i++) {
    const p1 = PUMP_VAPOR_PRESSURE_TABLE[i];
    const p2 = PUMP_VAPOR_PRESSURE_TABLE[i + 1];
    if (tempC >= p1.t && tempC <= p2.t) {
      const fraction = (tempC - p1.t) / (p2.t - p1.t);
      return p1.p + fraction * (p2.p - p1.p);
    }
  }
  return 0;
}

const MOTOR_SIZES = [0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250];

function getStandardMotorSize(kw) {
  for (let size of MOTOR_SIZES) {
    if (kw <= size) return size;
  }
  return kw;
}

// 2. Pipe Material Roughness Preset Database (mm)
const MATERIAL_ROUGHNESS = {
  cs: 0.045, ms: 0.045, gi: 0.150,
  ss304: 0.0015, ss304l: 0.0015, ss316: 0.0015, ss316l: 0.0015,
  ss321: 0.0015, ss310: 0.0015, duplex_ss: 0.0015, super_duplex_ss: 0.0015,
  alloy_steel: 0.045, copper: 0.0015, brass: 0.0015,
  pvc: 0.0015, cpvc: 0.0015, hdpe: 0.007, frp: 0.005,
  ptfe: 0.001, rubber_lined: 0.010,
  hastelloy: 0.0015, monel: 0.0015, inconel: 0.0015
};

// 3. Pipe Dimensions Matrix (ASME B36.10 / B36.19)
const PIPE_DATABASE = {
  "0.5":  { OD: 0.840,  STD: 0.622, "40": 0.622, "80": 0.546, "160": 0.466 },
  "0.75": { OD: 1.050,  STD: 0.824, "40": 0.824, "80": 0.742, "160": 0.612 },
  "1":    { OD: 1.315,  STD: 1.049, "40": 1.049, "80": 0.957, "160": 0.815 },
  "1.5":  { OD: 1.900,  STD: 1.610, "40": 1.610, "80": 1.500, "160": 1.338 },
  "2":    { OD: 2.375,  STD: 2.067, "40": 2.067, "80": 1.939, "160": 1.687 },
  "3":    { OD: 3.500,  STD: 3.068, "40": 3.068, "80": 2.900, "160": 2.624 },
  "4":    { OD: 4.500,  STD: 4.026, "40": 4.026, "80": 3.826, "160": 3.438 },
  "6":    { OD: 6.625,  STD: 6.065, "40": 6.065, "80": 5.761, "160": 5.187 },
  "8":    { OD: 8.625,  STD: 7.981, "40": 7.981, "80": 7.625, "160": 6.871 },
  "10":   { OD: 10.750, STD: 10.020, "40": 10.020, "80": 9.562, "160": 8.500 },
  "12":   { OD: 12.750, STD: 12.000, "40": 11.940, "80": 11.374, "160": 10.126 }
};

// 4. Fittings K-Factors Constants
const FITTINGS_K = {
  elbow_45: 0.35,
  elbow_90: 0.75,
  elbow_90_lr: 0.45,
  elbow_90_sq: 1.30,
  tee_elbow: 1.00,
  tee_run: 0.40,
  gate_open: 0.17,
  gate_3_4: 0.90,
  globe_open: 6.00,
  globe_half: 9.50,
  angle_valve: 2.00,
  check_swing: 2.00,
  check_disk: 10.00,
  ball_valve: 70.00
};

// 5. Line Service Design Limits
const SERVICE_LIMITS = {
  // Liquid
  suction:   { maxV: 1.5, minV: 1.0, maxDp100: 0.20 },
  discharge: { maxV: 3.0, minV: 2.5, maxDp100: 0.45 },
  drain:     { maxV: 2.1, minV: 1.2, maxDp100: 0.35 },
  general:   { maxV: 3.0, minV: 2.0, maxDp100: 0.45 },
  gravity:   { maxV: 1.0, minV: 0.5, maxDp100: 0.10 },
  boiler_feed: { maxV: 4.6, minV: 2.5, maxDp100: 0.45 },
  // Gas
  gas_vapor:      { maxV: 25, minV: 10, maxDp100: 0.20 },
  sat_steam_gas:  { maxV: 35, minV: 10, maxDp100: 0.20 },
  sup_steam_gas:  { maxV: 75, minV: 60, maxDp100: 0.10 },
  compressed_air: { maxV: 25, minV: 15, maxDp100: 0.20 },
  flare_vent:     { maxV: 50, minV: 10, maxDp100: 0.10 },
  // Steam
  sat_steam:  { maxV: 35, minV: 10, maxDp100: 0.20 },
  sup_steam:  { maxV: 75, minV: 60, maxDp100: 0.10 },
  lp_steam:   { maxV: 25, minV: 15, maxDp100: 0.20 },
  hp_steam:   { maxV: 60, minV: 30, maxDp100: 0.15 },
  // Slurry
  slurry:     { maxV: 3.5, minV: 1.5, maxDp100: 0.50 },
  // Two-Phase (general)
  two_phase:  { maxV: 30, minV: 5, maxDp100: 0.50 }
};

// 6. Saturated Steam Property Table
const STEAM_TABLE = [
  { P: 1.0,  T_sat: 99.6,  rho: 0.597, mu: 0.0120 },
  { P: 2.0,  T_sat: 120.2, rho: 1.129, mu: 0.0126 },
  { P: 3.0,  T_sat: 133.5, rho: 1.651, mu: 0.0130 },
  { P: 4.0,  T_sat: 143.6, rho: 2.163, mu: 0.0133 },
  { P: 5.0,  T_sat: 151.8, rho: 2.669, mu: 0.0136 },
  { P: 6.0,  T_sat: 158.8, rho: 3.170, mu: 0.0138 },
  { P: 8.0,  T_sat: 170.4, rho: 4.161, mu: 0.0142 },
  { P: 10.0, T_sat: 179.9, rho: 5.145, mu: 0.0145 },
  { P: 15.0, T_sat: 198.3, rho: 7.594, mu: 0.0151 },
  { P: 20.0, T_sat: 212.4, rho: 10.04, mu: 0.0156 },
  { P: 30.0, T_sat: 233.9, rho: 15.01, mu: 0.0163 },
  { P: 40.0, T_sat: 250.4, rho: 20.09, mu: 0.0170 },
  { P: 50.0, T_sat: 264.0, rho: 25.36, mu: 0.0175 }
];

function interpolateSteamTable(pressure, prop) {
  if (pressure <= STEAM_TABLE[0].P) return STEAM_TABLE[0][prop];
  if (pressure >= STEAM_TABLE[STEAM_TABLE.length-1].P) return STEAM_TABLE[STEAM_TABLE.length-1][prop];
  for (let i = 0; i < STEAM_TABLE.length - 1; i++) {
    if (pressure >= STEAM_TABLE[i].P && pressure <= STEAM_TABLE[i+1].P) {
      const frac = (pressure - STEAM_TABLE[i].P) / (STEAM_TABLE[i+1].P - STEAM_TABLE[i].P);
      return STEAM_TABLE[i][prop] + frac * (STEAM_TABLE[i+1][prop] - STEAM_TABLE[i][prop]);
    }
  }
  return STEAM_TABLE[STEAM_TABLE.length-1][prop];
}

// --- Utility Functions ---

function getTimestamp() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function logConsole(message, type = "info") {
  const statusBarMsg = document.getElementById("statusBarMsg");
  if (statusBarMsg) {
    statusBarMsg.textContent = message.toUpperCase();
    if (type === "error" || type === "fail") {
      statusBarMsg.style.color = "var(--color-fail)";
    } else if (type === "warn") {
      statusBarMsg.style.color = "var(--color-saffron)";
    } else if (type === "success") {
      statusBarMsg.style.color = "var(--color-green)";
    } else {
      statusBarMsg.style.color = "var(--text-main)";
    }
  }
}

// Solve Colebrook friction factor
function solveColebrook(Re, relativeRoughness) {
  if (Re <= 2300) return 64 / Re;
  
  const term1 = Math.pow(relativeRoughness / 3.7, 1.11);
  const term2 = 6.9 / Re;
  const initialInvSqrtF = -1.8 * Math.log10(term1 + term2);
  let f = 1 / (initialInvSqrtF * initialInvSqrtF);

  if (Re > 2300 && Re < 4000) {
    const fLaminar = 64 / Re;
    const fTurbulent = solveColebrookIterations(4000, relativeRoughness, f);
    const fraction = (Re - 2300) / (4000 - 2300);
    return fLaminar + fraction * (fTurbulent - fLaminar);
  }
  return solveColebrookIterations(Re, relativeRoughness, f);
}

function solveColebrookIterations(Re, relativeRoughness, fGuess) {
  let f = fGuess;
  const tolerance = 1e-6;
  const maxIterations = 20;
  for (let i = 0; i < maxIterations; i++) {
    const prevF = f;
    const invSqrtF = -2 * Math.log10((relativeRoughness / 3.7) + (2.51 / (Re * Math.sqrt(f))));
    f = 1 / (invSqrtF * invSqrtF);
    if (Math.abs(f - prevF) < tolerance) break;
  }
  return f;
}

function updateStatusBadge(elementId, statusText, statusType) {
  const badge = document.getElementById(elementId);
  if (!badge) return;
  badge.textContent = statusText;
  badge.className = "badge";
  if (statusType === "ok") badge.classList.add("badge-teal");
  else if (statusType === "warn") badge.classList.add("badge-amber");
  else if (statusType === "fail") badge.classList.add("badge-red");
}

// Get Theme-specific Colors for Chart.js
function getThemeColors() {
  const isLight = document.body.classList.contains("light-theme");
  return {
    textColor: isLight ? "#475569" : "#b4c5e4",
    gridColor: isLight ? "rgba(15, 23, 42, 0.05)" : "rgba(43, 89, 195, 0.08)",
    pointBorder: isLight ? "#2a52be" : "#ffffff",
    tooltipBg: isLight ? "rgba(255, 255, 255, 0.96)" : "rgba(13, 22, 47, 0.96)",
    tooltipBorder: isLight ? "rgba(15, 23, 42, 0.12)" : "rgba(43, 89, 195, 0.2)",
    tooltipText: isLight ? "#0f172a" : "#b4c5e4"
  };
}

// --- 3D Geometries & Instrumentation Dial Maker ---
function createDialGauge(needleColorHex, pipeColorHex = 0x1e293b, scaleText = "bar") {
  const gaugeGroup = new THREE.Group();
  
  // Stem connection
  const stemGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.16, 8);
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.9, roughness: 0.1 });
  const stem = new THREE.Mesh(stemGeo, metalMat);
  gaugeGroup.add(stem);

  // Dial Casing
  const casingGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.055, 16);
  casingGeo.rotateX(Math.PI / 2);
  const casingMat = new THREE.MeshStandardMaterial({ color: pipeColorHex, metalness: 0.8, roughness: 0.3 });
  const casing = new THREE.Mesh(casingGeo, casingMat);
  casing.position.y = 0.2;
  gaugeGroup.add(casing);

  // White Dial Face
  const faceGeo = new THREE.CylinderGeometry(0.105, 0.105, 0.01, 16);
  faceGeo.rotateX(Math.PI / 2);
  const faceMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 });
  const face = new THREE.Mesh(faceGeo, faceMat);
  face.position.set(0, 0.2, 0.0275);
  gaugeGroup.add(face);

  // Pointer Needle
  const needleGeo = new THREE.BoxGeometry(0.085, 0.012, 0.005);
  const needleMat = new THREE.MeshBasicMaterial({ color: needleColorHex });
  const needle = new THREE.Mesh(needleGeo, needleMat);
  // Shift pivot point to needle base end
  needleGeo.translate(0.035, 0, 0);
  needle.position.set(-0.035, 0.2, 0.034);
  needle.rotation.z = Math.PI / 3;
  gaugeGroup.add(needle);

  return gaugeGroup;
}

// --- 3D Animation Particles Helper Functions ---

function resetPumpParticle(p, progress) {
  p.pathProgress = progress;
  p.offsetX = (Math.random() - 0.5) * 0.06;
  p.offsetY = (Math.random() - 0.5) * 0.06;
  p.spiralAngle = Math.random() * Math.PI * 2;
}

function updatePumpParticlePosition(p) {
  const t = p.pathProgress;
  const vesselY = pump3D.vesselElevation * 0.5;
  const pumpY = pump3D.pumpCL * 0.5;
  const vesselX = -1.2;
  const pumpX = 1.0;
  const elbowY = pumpY + 0.15;
  const dischargeTopY = pumpY + 2.5;

  if (t < 0.15) {
    // Seg 1: Inside vessel — drop from liquid level to vessel bottom
    const lt = t / 0.15;
    p.position.x = vesselX + p.offsetX;
    p.position.z = p.offsetY;
    p.position.y = vesselY - lt * (vesselY - elbowY - 0.3);
  } else if (t < 0.35) {
    // Seg 2: Vertical suction pipe down to elbow
    const lt = (t - 0.15) / 0.2;
    p.position.x = vesselX + p.offsetX;
    p.position.z = p.offsetY;
    p.position.y = (elbowY + 0.5) - lt * ((elbowY + 0.5) - elbowY);
  } else if (t < 0.55) {
    // Seg 3: Horizontal suction pipe from vessel to pump
    const lt = (t - 0.35) / 0.2;
    p.position.x = vesselX + lt * (pumpX - 0.5 - vesselX) + p.offsetX * 0.5;
    p.position.y = elbowY + p.offsetY * 0.5;
    p.position.z = p.offsetY * 0.5;
  } else if (t < 0.75) {
    // Seg 4: Pump volute spiral
    const lt = (t - 0.55) / 0.2;
    const angle = p.spiralAngle + lt * Math.PI * 3;
    const radius = 0.05 + lt * 0.35;
    p.position.x = pumpX + Math.sin(angle) * radius;
    p.position.z = Math.cos(angle) * radius;
    p.position.y = elbowY;
  } else {
    // Seg 5: Discharge pipe going up
    const lt = (t - 0.75) / 0.25;
    p.position.x = pumpX + 0.35 + p.offsetX * 0.5;
    p.position.z = p.offsetY * 0.5;
    p.position.y = elbowY + lt * (dischargeTopY - elbowY);
  }
}

function resetLineParticle(p, progress) {
  p.pathProgress = progress;
  p.offsetX = (Math.random() - 0.5) * 0.10;
  p.offsetY = (Math.random() - 0.5) * 0.10;
  p.offsetZ = (Math.random() - 0.5) * 0.10;
}

function updateLineParticlePosition(p, points) {
  const t = p.pathProgress;
  
  const lengths = [];
  let totalLength = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const len = points[i].distanceTo(points[i+1]);
    lengths.push(len);
    totalLength += len;
  }

  const targetDist = t * totalLength;
  
  let currentDist = 0;
  let segmentIndex = 0;
  let localT = 0;
  
  for (let i = 0; i < lengths.length; i++) {
    if (targetDist >= currentDist && targetDist <= currentDist + lengths[i]) {
      segmentIndex = i;
      localT = (targetDist - currentDist) / lengths[i];
      break;
    }
    currentDist += lengths[i];
  }
  
  if (t >= 1.0) {
    segmentIndex = lengths.length - 1;
    localT = 1.0;
  }
  
  const pStart = points[segmentIndex];
  const pEnd = points[segmentIndex + 1];
  
  const basePos = new THREE.Vector3().lerpVectors(pStart, pEnd, localT);
  p.position.copy(basePos);
  
  const dir = new THREE.Vector3().subVectors(pEnd, pStart).normalize();
  let perp1 = new THREE.Vector3(1, 0, 0);
  if (Math.abs(dir.dot(perp1)) > 0.9) {
    perp1.set(0, 1, 0);
  }
  const perp2 = new THREE.Vector3().crossVectors(dir, perp1).normalize();
  perp1.crossVectors(dir, perp2).normalize();
  
  p.position.addScaledVector(perp1, p.offsetX);
  p.position.addScaledVector(perp2, p.offsetY);
}

// --- 3D Centrifugal Pump Simulation Scene (Three.js) ---

function init3DEnvironments() {
  if (typeof THREE === 'undefined') {
    console.error("Three.js is not defined. WebGL scenes skipped.");
    const p3d = document.getElementById("pump-3d-container");
    if (p3d) p3d.innerHTML = "<div style='color: var(--color-fail); padding: var(--space-md); font-family: var(--font-data); font-size: 11px;'>WebGL initialization failed: Three.js library not loaded.</div>";
    const l3d = document.getElementById("line-3d-container");
    if (l3d) l3d.innerHTML = "<div style='color: var(--color-fail); padding: var(--space-md); font-family: var(--font-data); font-size: 11px;'>WebGL initialization failed: Three.js library not loaded.</div>";
    return;
  }

  try {
    const pumpContainer = document.getElementById("pump-3d-container");
    if (pumpContainer) initPump3D(pumpContainer);
  } catch (err) {
    console.error("Error initializing Pump 3D visualization:", err);
  }

  try {
    const lineContainer = document.getElementById("line-3d-container");
    if (lineContainer) initLine3D(lineContainer);
  } catch (err) {
    console.error("Error initializing Line 3D visualization:", err);
  }

}

// Helper: create a pipe segment (cylinder between two Y-positions or along an axis)
function createPipeMesh(radius, length, color, opacity) {
  const geo = new THREE.CylinderGeometry(radius, radius, length, 16);
  const mat = new THREE.MeshStandardMaterial({
    color: color || 0x607d8b,
    metalness: 0.7, roughness: 0.3,
    transparent: opacity < 1, opacity: opacity || 1
  });
  return new THREE.Mesh(geo, mat);
}

// Helper: create a flange ring
function createFlange(outerR, innerR, thickness, color) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerR, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, innerR, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  const mat = new THREE.MeshStandardMaterial({ color: color || 0x37474f, metalness: 0.9, roughness: 0.2 });
  return new THREE.Mesh(geo, mat);
}

function initPump3D(container) {
  container.innerHTML = '';
  const width = container.clientWidth || 520;
  const height = container.clientHeight || 300;

  pump3D.scene = new THREE.Scene();

  pump3D.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  pump3D.camera.position.set(6, 3.5, 6);

  pump3D.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  pump3D.renderer.setSize(width, height);
  pump3D.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  pump3D.renderer.shadowMap.enabled = true;
  pump3D.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(pump3D.renderer.domElement);

  pump3D.controls = new CustomOrbitControls(pump3D.camera, pump3D.renderer.domElement);
  pump3D.controls.enableDamping = true;
  pump3D.controls.dampingFactor = 0.05;
  pump3D.controls.maxPolarAngle = Math.PI / 2 + 0.1;
  pump3D.controls.minDistance = 3;
  pump3D.controls.maxDistance = 18;
  pump3D.controls.autoRotate = true;
  pump3D.controls.autoRotateSpeed = 0.6;
  pump3D.controls.target.set(0.5, 1.5, 0);
  pump3D.controls.addEventListener('start', () => { pump3D.controls.autoRotate = false; });

  // --- Lighting ---
  const ambient = new THREE.AmbientLight(0xffffff, 0.5);
  pump3D.scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(6, 10, 5);
  dirLight.castShadow = true;
  pump3D.scene.add(dirLight);
  const saffronPt = new THREE.PointLight(0xff7538, 1.2, 12);
  saffronPt.position.set(3, 4, 3);
  pump3D.scene.add(saffronPt);
  const greenPt = new THREE.PointLight(0x00b875, 0.8, 10);
  greenPt.position.set(-2, 1, -2);
  pump3D.scene.add(greenPt);

  // === SCENE GEOMETRY PARAMS (scaled: 1 unit ≈ 0.5m real) ===
  const vesselY = pump3D.vesselElevation * 0.5;  // top of support = vessel bottom tangent
  const pumpY = pump3D.pumpCL * 0.5;             // pump centreline
  const vesselX = -1.2;
  const pumpX = 1.0;
  const elbowY = pumpY + 0.15;

  // ========== GROUND PLANE (Plant Grade) ==========
  const groundGeo = new THREE.PlaneGeometry(12, 8);
  const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a1a2e, roughness: 0.95 });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  pump3D.scene.add(ground);

  // Grade line indicator (red dashed effect)
  const gradeGeo = new THREE.BoxGeometry(10, 0.01, 0.02);
  const gradeMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  const gradeLine = new THREE.Mesh(gradeGeo, gradeMat);
  gradeLine.position.set(0, 0.01, 1.5);
  pump3D.scene.add(gradeLine);

  // ========== CONCRETE FOUNDATION PAD (under pump) ==========
  const baseGeo = new THREE.BoxGeometry(2.4, 0.2, 1.6);
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.95, metalness: 0.05 });
  const baseMesh = new THREE.Mesh(baseGeo, baseMat);
  baseMesh.position.set(pumpX + 0.2, 0.1, 0);
  baseMesh.castShadow = true;
  baseMesh.receiveShadow = true;
  pump3D.baseMesh = baseMesh;
  pump3D.scene.add(baseMesh);

  // ========== STEEL SUPPORT STRUCTURE (under vessel) ==========
  const supportGroup = new THREE.Group();
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x546e7a, metalness: 0.8, roughness: 0.3 });

  // 4 vertical columns
  const colGeo = new THREE.BoxGeometry(0.08, vesselY, 0.08);
  const colPositions = [
    [vesselX - 0.35, vesselY / 2, -0.35],
    [vesselX + 0.35, vesselY / 2, -0.35],
    [vesselX - 0.35, vesselY / 2, 0.35],
    [vesselX + 0.35, vesselY / 2, 0.35]
  ];
  colPositions.forEach(pos => {
    const col = new THREE.Mesh(colGeo, steelMat);
    col.position.set(pos[0], pos[1], pos[2]);
    col.castShadow = true;
    supportGroup.add(col);
  });

  // Cross braces (X pattern on two sides)
  const braceMat = new THREE.MeshStandardMaterial({ color: 0x455a64, metalness: 0.7, roughness: 0.4 });
  const braceLen = Math.sqrt(0.7 * 0.7 + vesselY * vesselY);
  const braceGeo = new THREE.BoxGeometry(0.03, braceLen, 0.03);
  const braceAngle = Math.atan2(0.7, vesselY);

  // Front face X-braces
  const brace1 = new THREE.Mesh(braceGeo, braceMat);
  brace1.position.set(vesselX, vesselY / 2, -0.35);
  brace1.rotation.z = braceAngle;
  supportGroup.add(brace1);
  const brace2 = new THREE.Mesh(braceGeo, braceMat);
  brace2.position.set(vesselX, vesselY / 2, -0.35);
  brace2.rotation.z = -braceAngle;
  supportGroup.add(brace2);

  // Back face X-braces
  const brace3 = new THREE.Mesh(braceGeo, braceMat);
  brace3.position.set(vesselX, vesselY / 2, 0.35);
  brace3.rotation.z = braceAngle;
  supportGroup.add(brace3);
  const brace4 = new THREE.Mesh(braceGeo, braceMat);
  brace4.position.set(vesselX, vesselY / 2, 0.35);
  brace4.rotation.z = -braceAngle;
  supportGroup.add(brace4);

  // Horizontal beam at top
  const beamGeo = new THREE.BoxGeometry(0.78, 0.06, 0.78);
  const beam = new THREE.Mesh(beamGeo, steelMat);
  beam.position.set(vesselX, vesselY - 0.03, 0);
  supportGroup.add(beam);

  pump3D.supportGroup = supportGroup;
  pump3D.scene.add(supportGroup);

  // ========== SUCTION VESSEL (Vertical Cylindrical Tank) ==========
  const vesselR = 0.5;
  const vesselH = 1.8;

  // Vessel body (semi-transparent so liquid is visible)
  const vesselBodyGeo = new THREE.CylinderGeometry(vesselR, vesselR, vesselH, 24);
  const vesselBodyMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, roughness: 0.25, metalness: 0.6, transparent: true, opacity: 0.35 });
  const vesselBody = new THREE.Mesh(vesselBodyGeo, vesselBodyMat);
  vesselBody.position.set(vesselX, vesselY + vesselH / 2, 0);
  vesselBody.castShadow = true;
  pump3D.vesselBody = vesselBody;
  pump3D.scene.add(vesselBody);

  // Vessel top dome (hemisphere)
  const topDomeGeo = new THREE.SphereGeometry(vesselR, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2);
  const topDomeMat = new THREE.MeshStandardMaterial({ color: 0xbbbbc0, roughness: 0.3, metalness: 0.5, transparent: true, opacity: 0.4 });
  const topDome = new THREE.Mesh(topDomeGeo, topDomeMat);
  topDome.position.set(vesselX, vesselY + vesselH, 0);
  pump3D.vesselTop = topDome;
  pump3D.scene.add(topDome);

  // Vessel bottom dome
  const botDomeGeo = new THREE.SphereGeometry(vesselR, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
  const botDome = new THREE.Mesh(botDomeGeo, topDomeMat);
  botDome.position.set(vesselX, vesselY, 0);
  pump3D.vesselBottom = botDome;
  pump3D.scene.add(botDome);

  // Liquid level inside vessel (blue, clearly visible)
  const liquidLevel = vesselH * 0.55;
  const liquidGeo = new THREE.CylinderGeometry(vesselR * 0.94, vesselR * 0.94, liquidLevel, 24);
  const liquidMat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6, transparent: true, opacity: 0.75,
    roughness: 0.05, metalness: 0.3, side: THREE.DoubleSide
  });
  const vesselLiquid = new THREE.Mesh(liquidGeo, liquidMat);
  vesselLiquid.position.set(vesselX, vesselY + liquidLevel / 2, 0);
  vesselLiquid.visible = false;
  pump3D.vesselLiquid = vesselLiquid;
  pump3D.scene.add(vesselLiquid);

  // Liquid top surface disc (visible from above)
  const liquidTopGeo = new THREE.CircleGeometry(vesselR * 0.93, 24);
  const liquidTopMat = new THREE.MeshStandardMaterial({
    color: 0x60a5fa, transparent: true, opacity: 0.85,
    roughness: 0.0, metalness: 0.4, side: THREE.DoubleSide
  });
  const liquidTop = new THREE.Mesh(liquidTopGeo, liquidTopMat);
  liquidTop.rotation.x = -Math.PI / 2;
  liquidTop.position.set(vesselX, vesselY + liquidLevel, 0);
  liquidTop.visible = false;
  pump3D.liquidTop = liquidTop;
  pump3D.scene.add(liquidTop);

  // LLL marker ring (orange/amber ring inside vessel to show minimum level)
  const lllRingGeo = new THREE.TorusGeometry(vesselR * 0.93, 0.02, 8, 32);
  const lllRingMat = new THREE.MeshStandardMaterial({ color: 0xff7538, emissive: 0xff7538, emissiveIntensity: 0.6 });
  const lllRing = new THREE.Mesh(lllRingGeo, lllRingMat);
  lllRing.rotation.x = Math.PI / 2;
  lllRing.position.set(vesselX, vesselY + vesselH * 0.7, 0);
  pump3D.lllRing = lllRing;
  pump3D.scene.add(lllRing);

  // LLL marker disc (semi-transparent orange disc at LLL level)
  const lllDiscGeo = new THREE.CircleGeometry(vesselR * 0.92, 24);
  const lllDiscMat = new THREE.MeshStandardMaterial({
    color: 0xff7538, transparent: true, opacity: 0.4,
    emissive: 0xff7538, emissiveIntensity: 0.3, side: THREE.DoubleSide
  });
  const lllDisc = new THREE.Mesh(lllDiscGeo, lllDiscMat);
  lllDisc.rotation.x = -Math.PI / 2;
  lllDisc.position.set(vesselX, vesselY + vesselH * 0.7, 0);
  pump3D.lllDisc = lllDisc;
  pump3D.scene.add(lllDisc);

  const pipeR = 0.09;

  // Pressure gauge on vessel — flush against cylinder surface
  const vesselGauge = createDialGauge(0xff7538, 0x37474f, "bar");
  vesselGauge.position.set(vesselX + vesselR + 0.01, vesselY + vesselH * 0.7, 0);
  vesselGauge.rotation.y = Math.PI / 2;
  vesselGauge.scale.setScalar(0.9);
  pump3D.vesselGaugeNeedle = vesselGauge.children[3];
  pump3D.vesselGauge = vesselGauge;
  pump3D.scene.add(vesselGauge);

  // Suction Pressure Gauge — on horizontal suction pipe surface
  const suctionGauge = createDialGauge(0x00b875, 0x37474f, "bar");
  suctionGauge.position.set(vesselX + (pumpX - 0.5 - vesselX) * 0.5, elbowY + pipeR + 0.01, 0);
  suctionGauge.rotation.x = -Math.PI / 2;
  suctionGauge.rotation.z = Math.PI;
  suctionGauge.scale.setScalar(0.5);
  pump3D.suctionGaugeNeedle = suctionGauge.children[3];
  pump3D.suctionGauge = suctionGauge;
  pump3D.scene.add(suctionGauge);

  // Discharge Pressure Gauge — on discharge pipe surface
  const dischargeGauge = createDialGauge(0xff7538, 0x37474f, "bar");
  dischargeGauge.position.set(pumpX + 0.35 + pipeR * 0.85 + 0.01, elbowY + 0.8, 0);
  dischargeGauge.rotation.y = Math.PI / 2;
  dischargeGauge.scale.setScalar(0.5);
  pump3D.dischargeGaugeNeedle = dischargeGauge.children[3];
  pump3D.dischargeGauge = dischargeGauge;
  pump3D.scene.add(dischargeGauge);

  // ========== SUCTION PIPING (Vertical drop + Horizontal run) ==========

  // Vertical pipe from vessel bottom down
  const sucVLen = vesselY - elbowY;
  const sucVPipe = createPipeMesh(pipeR, sucVLen, 0x607d8b, 0.7);
  sucVPipe.position.set(vesselX, elbowY + sucVLen / 2, 0);
  pump3D.suctionPipeV = sucVPipe;
  pump3D.scene.add(sucVPipe);

  // Elbow (small sphere at bend)
  const elbowGeo = new THREE.SphereGeometry(pipeR * 1.3, 12, 12);
  const elbowMat = new THREE.MeshStandardMaterial({ color: 0x607d8b, metalness: 0.7, roughness: 0.3 });
  const elbow = new THREE.Mesh(elbowGeo, elbowMat);
  elbow.position.set(vesselX, elbowY, 0);
  pump3D.scene.add(elbow);

  // Horizontal pipe from elbow to pump
  const sucHLen = pumpX - 0.5 - vesselX;
  const sucHPipe = createPipeMesh(pipeR, sucHLen, 0x607d8b, 0.7);
  sucHPipe.rotation.z = Math.PI / 2;
  sucHPipe.position.set(vesselX + sucHLen / 2, elbowY, 0);
  pump3D.suctionPipeH = sucHPipe;
  pump3D.scene.add(sucHPipe);

  // Suction flange (at pump inlet)
  const sucFlange = createFlange(pipeR * 2.2, pipeR, 0.03, 0x37474f);
  sucFlange.rotation.y = Math.PI / 2;
  sucFlange.position.set(pumpX - 0.5, elbowY, 0);
  pump3D.suctionFlange = sucFlange;
  pump3D.scene.add(sucFlange);

  // ========== CENTRIFUGAL PUMP (Volute Casing) ==========
  const casingGroup = new THREE.Group();
  casingGroup.position.set(pumpX, elbowY, 0);

  // Volute (spiral casing - saffron, very transparent to show impeller)
  const casingGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.3, 32);
  const casingMat = new THREE.MeshStandardMaterial({
    color: 0xff7538, transparent: true, opacity: 0.25,
    roughness: 0.2, metalness: 0.6, side: THREE.DoubleSide
  });
  const casingMesh = new THREE.Mesh(casingGeo, casingMat);
  casingGroup.add(casingMesh);

  // Back plate
  const backGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.03, 32);
  const castMat = new THREE.MeshStandardMaterial({ color: 0x1e3a5f, metalness: 0.85, roughness: 0.25 });
  const backPlate = new THREE.Mesh(backGeo, castMat);
  backPlate.position.z = -0.16;
  casingGroup.add(backPlate);

  pump3D.casingMesh = casingMesh;
  pump3D.casingGroup = casingGroup;
  pump3D.scene.add(casingGroup);

  // ========== DISCHARGE PIPE (going up from pump top) ==========
  const dischargeLen = 2.5;
  const dischargePipe = createPipeMesh(pipeR * 0.85, dischargeLen, 0x607d8b, 0.7);
  dischargePipe.position.set(pumpX + 0.35, elbowY + dischargeLen / 2, 0);
  pump3D.dischargePipe = dischargePipe;
  pump3D.scene.add(dischargePipe);

  // Discharge flange (at pump outlet)
  const disFlange = createFlange(pipeR * 2, pipeR * 0.85, 0.03, 0x37474f);
  disFlange.rotation.x = Math.PI / 2;
  disFlange.position.set(pumpX + 0.35, elbowY + 0.2, 0);
  pump3D.dischargeFlange = disFlange;
  pump3D.scene.add(disFlange);

  // ========== DISCHARGE LINE COMPONENTS (Check Valve + Globe Valve + Flow Meter) ==========
  const disX = pumpX + 0.35;

  // --- Check Valve (swing check - industrial style) ---
  const checkValveGroup = new THREE.Group();
  // Valve body - two flanges with a center body
  const cvFlangeGeo = new THREE.CylinderGeometry(pipeR * 2.2, pipeR * 2.2, 0.04, 16);
  const cvFlangeMat = new THREE.MeshStandardMaterial({ color: 0x78350f, metalness: 0.8, roughness: 0.25 });
  const cvFlangeTop = new THREE.Mesh(cvFlangeGeo, cvFlangeMat);
  cvFlangeTop.position.y = 0.1;
  checkValveGroup.add(cvFlangeTop);
  const cvFlangeBot = new THREE.Mesh(cvFlangeGeo, cvFlangeMat);
  cvFlangeBot.position.y = -0.1;
  checkValveGroup.add(cvFlangeBot);
  const cvBodyMat = new THREE.MeshStandardMaterial({ color: 0xb45309, metalness: 0.7, roughness: 0.3 });
  const cvBody = new THREE.Mesh(new THREE.CylinderGeometry(pipeR * 1.8, pipeR * 1.8, 0.2, 16), cvBodyMat);
  checkValveGroup.add(cvBody);
  // Arrow indicator on body (flow direction)
  const cvArrow = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.08, 6), new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.3 }));
  cvArrow.position.set(pipeR * 1.8 + 0.01, 0, 0);
  cvArrow.rotation.z = 0;
  checkValveGroup.add(cvArrow);
  checkValveGroup.position.set(disX, elbowY + 0.5, 0);
  pump3D.checkValve = checkValveGroup;
  pump3D.scene.add(checkValveGroup);
  pump3D.scene.add(makeLabel('CHECK VALVE', [disX + 1.0, elbowY + 0.5, 0], '#d97706'));
  pump3D.checkValveLabel = pump3D.scene.children[pump3D.scene.children.length - 1];

  // --- Globe Valve (industrial with bonnet, stem, handwheel) ---
  const globeValveGroup = new THREE.Group();
  // Valve body (bulge shape)
  const gvBodyMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, metalness: 0.75, roughness: 0.3 });
  const gvBody = new THREE.Mesh(new THREE.SphereGeometry(pipeR * 1.8, 16, 16), gvBodyMat);
  globeValveGroup.add(gvBody);
  // Flanges
  const gvFlangeTop = new THREE.Mesh(cvFlangeGeo.clone(), new THREE.MeshStandardMaterial({ color: 0x7f1d1d, metalness: 0.8, roughness: 0.25 }));
  gvFlangeTop.position.y = 0.12;
  globeValveGroup.add(gvFlangeTop);
  const gvFlangeBot = new THREE.Mesh(cvFlangeGeo.clone(), new THREE.MeshStandardMaterial({ color: 0x7f1d1d, metalness: 0.8, roughness: 0.25 }));
  gvFlangeBot.position.y = -0.12;
  globeValveGroup.add(gvFlangeBot);
  // Bonnet (cylindrical top)
  const gvBonnet = new THREE.Mesh(new THREE.CylinderGeometry(pipeR * 0.8, pipeR * 1.2, 0.15, 12), new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.7, roughness: 0.3 }));
  gvBonnet.position.set(pipeR * 1.8 + 0.08, 0, 0);
  gvBonnet.rotation.z = -Math.PI / 2;
  globeValveGroup.add(gvBonnet);
  // Stem
  const gvStem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.9, roughness: 0.1 }));
  gvStem.position.set(pipeR * 1.8 + 0.25, 0, 0);
  gvStem.rotation.z = -Math.PI / 2;
  globeValveGroup.add(gvStem);
  // Handwheel
  const gvWheel = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.018, 8, 20), new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.6, roughness: 0.35 }));
  gvWheel.position.set(pipeR * 1.8 + 0.4, 0, 0);
  gvWheel.rotation.y = Math.PI / 2;
  globeValveGroup.add(gvWheel);
  globeValveGroup.position.set(disX, elbowY + 1.0, 0);
  pump3D.globeValve = globeValveGroup;
  pump3D.scene.add(globeValveGroup);
  pump3D.scene.add(makeLabel('GLOBE VALVE', [disX + 1.0, elbowY + 1.0, 0], '#dc2626'));
  pump3D.globeValveLabel = pump3D.scene.children[pump3D.scene.children.length - 1];

  // --- Flow Meter (orifice plate style with digital display showing flow rate) ---
  const flowMeterGroup = new THREE.Group();
  // Meter body (wider section)
  const fmBody = new THREE.Mesh(new THREE.CylinderGeometry(pipeR * 1.6, pipeR * 1.6, 0.3, 16), new THREE.MeshStandardMaterial({ color: 0x0369a1, metalness: 0.65, roughness: 0.3 }));
  flowMeterGroup.add(fmBody);
  // Flanges
  const fmFlangeMat = new THREE.MeshStandardMaterial({ color: 0x075985, metalness: 0.8, roughness: 0.25 });
  const fmFlangeTop = new THREE.Mesh(cvFlangeGeo.clone(), fmFlangeMat);
  fmFlangeTop.position.y = 0.15;
  flowMeterGroup.add(fmFlangeTop);
  const fmFlangeBot = new THREE.Mesh(cvFlangeGeo.clone(), fmFlangeMat);
  fmFlangeBot.position.y = -0.15;
  flowMeterGroup.add(fmFlangeBot);
  // Digital display box (shows flow rate)
  const fmDisplayGeo = new THREE.BoxGeometry(0.22, 0.14, 0.06);
  const fmDisplayMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x0ea5e9, emissiveIntensity: 0.5 });
  const fmDisplay = new THREE.Mesh(fmDisplayGeo, fmDisplayMat);
  fmDisplay.position.set(pipeR * 1.6 + 0.12, 0, 0);
  flowMeterGroup.add(fmDisplay);
  // Display screen (canvas sprite for flow value)
  const fmCanvas = document.createElement('canvas');
  fmCanvas.width = 128; fmCanvas.height = 48;
  var fmCtx = fmCanvas.getContext('2d');
  fmCtx.fillStyle = '#0c1424';
  fmCtx.fillRect(0, 0, 128, 48);
  fmCtx.fillStyle = '#22d3ee';
  fmCtx.font = 'bold 16px monospace';
  fmCtx.textAlign = 'center';
  fmCtx.fillText('-- m³/hr', 64, 30);
  const fmTex = new THREE.CanvasTexture(fmCanvas);
  const fmScreenMat = new THREE.SpriteMaterial({ map: fmTex, transparent: true });
  const fmScreen = new THREE.Sprite(fmScreenMat);
  fmScreen.position.set(pipeR * 1.6 + 0.35, 0, 0);
  fmScreen.scale.set(0.6, 0.2, 1);
  fmScreen._fmCanvas = fmCanvas;
  fmScreen._fmTex = fmTex;
  flowMeterGroup.add(fmScreen);
  pump3D.flowMeterScreen = fmScreen;
  flowMeterGroup.position.set(disX, elbowY + 1.6, 0);
  pump3D.flowMeter = flowMeterGroup;
  pump3D.scene.add(flowMeterGroup);
  pump3D.scene.add(makeLabel('FLOW METER', [disX + 1.0, elbowY + 1.6, 0], '#0ea5e9'));
  pump3D.flowMeterLabel = pump3D.scene.children[pump3D.scene.children.length - 1];

  // ========== PUMP CENTRELINE MARKER (vertical line from grade to pump shaft) ==========
  const clHeight = elbowY;
  const clLineGeo = new THREE.BoxGeometry(0.015, clHeight, 0.015);
  const clLineMat = new THREE.MeshBasicMaterial({ color: 0xff7538 });
  const clLine = new THREE.Mesh(clLineGeo, clLineMat);
  clLine.position.set(pumpX + 1.2, clHeight / 2, 0);
  pump3D.centrelineLine = clLine;
  pump3D.scene.add(clLine);
  // Horizontal tick at the top to mark CL level
  const clTickGeo = new THREE.BoxGeometry(0.3, 0.01, 0.01);
  const clTick = new THREE.Mesh(clTickGeo, clLineMat);
  clTick.position.set(pumpX + 1.2, elbowY, 0);
  pump3D.centrelineTick = clTick;
  pump3D.scene.add(clTick);
  // Horizontal tick at grade (bottom)
  const clTickBot = new THREE.Mesh(clTickGeo.clone(), clLineMat);
  clTickBot.position.set(pumpX + 1.2, 0.01, 0);
  pump3D.centrelineTickBot = clTickBot;
  pump3D.scene.add(clTickBot);
  const clLabel = makeLabel('PUMP CL: ' + pump3D.pumpCL.toFixed(2) + ' m', [pumpX + 1.2, elbowY + 0.3, 0], '#ff7538');
  pump3D.centrelineLabel = clLabel;
  pump3D.scene.add(clLabel);

  // ========== DISCHARGE ELEVATION LABEL ==========
  const dischElLabel = makeLabel('DISCH. EL: -- m', [disX + 0.9, elbowY + dischargeLen + 0.3, 0], '#16a34a');
  pump3D.dischElLabel = dischElLabel;
  pump3D.scene.add(dischElLabel);

  // ========== MOTOR (Blue horizontal cylinder with ribs) ==========
  const motorGroup = new THREE.Group();
  motorGroup.position.set(pumpX, elbowY, 0);

  const motorMat = new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.35, metalness: 0.8 });
  const motorGeo = new THREE.CylinderGeometry(0.32, 0.32, 1.1, 16);
  motorGeo.rotateX(Math.PI / 2);
  const motorMesh = new THREE.Mesh(motorGeo, motorMat);
  motorMesh.position.z = -0.85;
  motorMesh.castShadow = true;
  motorGroup.add(motorMesh);

  // Motor cooling ribs
  const ribGeo = new THREE.TorusGeometry(0.34, 0.015, 8, 24);
  ribGeo.rotateX(Math.PI / 2);
  const ribMat = new THREE.MeshStandardMaterial({ color: 0x0d47a1, roughness: 0.5 });
  for (let i = 0; i < 5; i++) {
    const rib = new THREE.Mesh(ribGeo.clone(), ribMat);
    rib.position.set(0, 0, -0.45 - i * 0.2);
    motorGroup.add(rib);
  }

  // Motor feet/mounts
  const footGeo = new THREE.BoxGeometry(0.15, 0.12, 0.6);
  const footMat = new THREE.MeshStandardMaterial({ color: 0x263238, metalness: 0.9, roughness: 0.2 });
  const foot1 = new THREE.Mesh(footGeo, footMat);
  foot1.position.set(-0.28, -0.3, -0.85);
  motorGroup.add(foot1);
  const foot2 = new THREE.Mesh(footGeo, footMat);
  foot2.position.set(0.28, -0.3, -0.85);
  motorGroup.add(foot2);

  // Coupling shield (gold)
  const shaftGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.25, 8);
  shaftGeo.rotateX(Math.PI / 2);
  const shaftMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.15 });
  const shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
  shaftMesh.position.z = -0.2;
  motorGroup.add(shaftMesh);

  pump3D.motorMesh = motorMesh;
  pump3D.motorGroup = motorGroup;
  pump3D.shaftMesh = shaftMesh;
  pump3D.scene.add(motorGroup);

  // ========== IMPELLER (inside casing) ==========
  pump3D.impellerGroup = new THREE.Group();
  pump3D.impellerGroup.position.set(pumpX, elbowY, 0);

  const hubGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.2, 8);
  const hubMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 0.95, roughness: 0.1 });
  const hub = new THREE.Mesh(hubGeo, hubMat);
  pump3D.impellerGroup.add(hub);

  const bladeGeo = new THREE.BoxGeometry(0.34, 0.02, 0.14);
  const bladeMat = new THREE.MeshStandardMaterial({ color: 0x60a5fa, metalness: 0.9, roughness: 0.1, emissive: 0x1e40af, emissiveIntensity: 0.3 });
  for (let i = 0; i < 6; i++) {
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.rotation.y = (Math.PI / 3) * i;
    blade.position.x = Math.sin((Math.PI / 3) * i) * 0.15;
    blade.position.z = Math.cos((Math.PI / 3) * i) * 0.15;
    pump3D.impellerGroup.add(blade);
  }
  pump3D.scene.add(pump3D.impellerGroup);

  // ========== FLOW PARTICLES ==========
  const particleCount = 30;
  const pGeo = new THREE.SphereGeometry(0.035, 8, 8);
  const pMat = new THREE.MeshBasicMaterial({ color: 0x00b875 });
  pump3D.particles = [];
  for (let i = 0; i < particleCount; i++) {
    const p = new THREE.Mesh(pGeo, pMat.clone());
    p.particleId = i;
    resetPumpParticle(p, Math.random());
    pump3D.scene.add(p);
    pump3D.particles.push(p);
  }

  // ========== ANNOTATION LABELS (3D text sprites) ==========
  function makeLabel(text, position, color) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color || '#ff7538';
    ctx.font = 'bold 20px IBM Plex Mono';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 40);
    const tex = new THREE.CanvasTexture(canvas);
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.85 });
    const sprite = new THREE.Sprite(spriteMat);
    sprite.position.set(position[0], position[1], position[2]);
    sprite.scale.set(1.5, 0.4, 1);
    return sprite;
  }

  pump3D.scene.add(makeLabel('SUCTION VESSEL', [vesselX, vesselY + vesselH + 0.7, 0], '#d4d4d8'));
  pump3D.scene.add(makeLabel('PLANT GRADE (0 m)', [2, 0.15, 1.5], '#ef4444'));
  pump3D.scene.add(makeLabel('PUMP', [pumpX, elbowY - 0.5, 0], '#ff7538'));
  pump3D.scene.add(makeLabel('MOTOR', [pumpX, elbowY - 0.5, -0.85], '#3b82f6'));
  // DISCHARGE label removed — replaced by dynamic DISCH. EL label

  // Pressure gauge value sprites (dynamic text)
  function makePressureGaugeSprite(text, position) {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = '#ff7538';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 252, 60);
    ctx.fillStyle = '#ff7538';
    ctx.font = 'bold 18px IBM Plex Mono';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 40);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    const sprite = new THREE.Sprite(mat);
    sprite.position.set(position[0], position[1], position[2]);
    sprite.scale.set(1.6, 0.45, 1);
    sprite._gaugeCanvas = canvas;
    sprite._gaugeTex = tex;
    return sprite;
  }

  pump3D.sucPressSprite = makePressureGaugeSprite('P_suc: -- bar(g)', [pumpX - 1.5, elbowY + 0.6, 0.8]);
  pump3D.scene.add(pump3D.sucPressSprite);
  pump3D.disPressSprite = makePressureGaugeSprite('P_dis: -- bar(g)', [pumpX + 0.35, elbowY + dischargeLen + 0.8, 0.8]);
  pump3D.scene.add(pump3D.disPressSprite);

  // ========== ANIMATION LOOP ==========
  function animate() {
    pump3D.animationId = requestAnimationFrame(animate);

    pump3D.currentSpinSpeed += (pump3D.targetSpinSpeed - pump3D.currentSpinSpeed) * 0.05;
    pump3D.flowSpeedMultiplier += (pump3D.targetFlowSpeed - pump3D.flowSpeedMultiplier) * 0.05;

    const isCavitating = pump3D.cavitating || false;

    const spinSpeed = pump3D.isRunning
      ? 0.15 * pump3D.speedScale * pump3D.currentSpinSpeed
      : 0.01;
    if (pump3D.impellerGroup) {
      pump3D.impellerGroup.rotation.y += spinSpeed;
      // Cavitation effect: violent shaking/vibration on impeller
      if (isCavitating && pump3D.isRunning) {
        const t = performance.now() * 0.02;
        pump3D.impellerGroup.position.x = pump3D.impellerGroup._baseX + Math.sin(t * 7.3) * 0.015;
        pump3D.impellerGroup.position.y = pump3D.impellerGroup._baseY + Math.cos(t * 11.1) * 0.012;
        pump3D.impellerGroup.position.z = Math.sin(t * 9.7) * 0.01;
        // Shake casing too
        if (pump3D.casingGroup) {
          pump3D.casingGroup.position.x = pump3D.casingGroup._baseX + Math.sin(t * 8.5) * 0.008;
          pump3D.casingGroup.position.y = pump3D.casingGroup._baseY + Math.cos(t * 12.3) * 0.006;
        }
      } else {
        if (pump3D.impellerGroup._baseX !== undefined) {
          pump3D.impellerGroup.position.x = pump3D.impellerGroup._baseX;
          pump3D.impellerGroup.position.y = pump3D.impellerGroup._baseY;
          pump3D.impellerGroup.position.z = 0;
        }
        if (pump3D.casingGroup && pump3D.casingGroup._baseX !== undefined) {
          pump3D.casingGroup.position.x = pump3D.casingGroup._baseX;
          pump3D.casingGroup.position.y = pump3D.casingGroup._baseY;
        }
      }
    }

    // Cavitation: stop/slow flow, particles stuck in pump area
    const flowSpeed = pump3D.isRunning
      ? (isCavitating ? 0.001 : 0.012 * pump3D.speedScale * pump3D.flowSpeedMultiplier)
      : 0.002;

    pump3D.particles.forEach(p => {
      p.pathProgress += flowSpeed;
      // Cavitation: particles past pump get stuck, flicker red
      if (isCavitating && p.pathProgress > 0.45 && p.pathProgress < 0.7) {
        p.pathProgress -= flowSpeed * 0.8; // almost stuck
        p.material.color.setHex(Math.random() > 0.5 ? 0xef4444 : 0xff7538);
      }
      if (p.pathProgress >= 1.0) {
        resetPumpParticle(p, 0);
      } else {
        updatePumpParticlePosition(p);
      }
    });

    pump3D.controls.update();
    pump3D.renderer.render(pump3D.scene, pump3D.camera);
  }
  animate();

  window.addEventListener('resize', () => {
    if (!pump3D.renderer || !pump3D.camera) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    pump3D.camera.aspect = w / h;
    pump3D.camera.updateProjectionMatrix();
    pump3D.renderer.setSize(w, h);
  });
}

// --- Pump Sound Effects (Web Audio API) ---
var pumpAudio = { ctx: null, running: false, cavitation: false };

function initPumpAudio() {
  if (pumpAudio.ctx) return;
  try { pumpAudio.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { return; }
}

function startPumpRunningSound() {
  if (!pumpAudio.ctx || pumpAudio.running) return;
  var ctx = pumpAudio.ctx;
  if (ctx.state === 'suspended') ctx.resume();
  var osc1 = ctx.createOscillator();
  osc1.type = 'sawtooth'; osc1.frequency.value = 55;
  var osc2 = ctx.createOscillator();
  osc2.type = 'sine'; osc2.frequency.value = 120;
  var gain = ctx.createGain(); gain.gain.value = 0.06;
  var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 200;
  osc1.connect(lp); osc2.connect(lp); lp.connect(gain); gain.connect(ctx.destination);
  osc1.start(); osc2.start();
  pumpAudio.runOsc1 = osc1; pumpAudio.runOsc2 = osc2; pumpAudio.runGain = gain;
  pumpAudio.running = true;
}

function stopPumpRunningSound() {
  if (!pumpAudio.running) return;
  try { pumpAudio.runOsc1.stop(); pumpAudio.runOsc2.stop(); } catch(e) {}
  pumpAudio.running = false;
}

function startCavitationAlarm() {
  if (!pumpAudio.ctx || pumpAudio.cavitation) return;
  var ctx = pumpAudio.ctx;
  if (ctx.state === 'suspended') ctx.resume();
  var osc = ctx.createOscillator();
  osc.type = 'square'; osc.frequency.value = 800;
  var lfo = ctx.createOscillator();
  lfo.type = 'sine'; lfo.frequency.value = 4;
  var lfoGain = ctx.createGain(); lfoGain.gain.value = 400;
  lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
  var gain = ctx.createGain(); gain.gain.value = 0.1;
  osc.connect(gain); gain.connect(ctx.destination);
  osc.start(); lfo.start();
  pumpAudio.cavOsc = osc; pumpAudio.cavLfo = lfo; pumpAudio.cavGain = gain;
  pumpAudio.cavitation = true;
}

function stopCavitationAlarm() {
  if (!pumpAudio.cavitation) return;
  try { pumpAudio.cavOsc.stop(); pumpAudio.cavLfo.stop(); } catch(e) {}
  pumpAudio.cavitation = false;
}

// --- Dynamic 3D Pump Update from Calculation Results ---

function updatePump3DFromResults() {
  if (!pump3D.scene || !window.state || !window.state.pump || !window.state.pump.calculated) return;
  const r = window.state.pump.results;
  const inp = window.state.pump.inputs;

  // --- Atmospheric (open) vs Pressurized (closed) vessel ---
  if (pump3D.vesselTop) {
    pump3D.vesselTop.visible = (inp.sucSourceType !== 'atmospheric');
  }

  // --- Update vessel position & liquid level ---
  const vesselEl = inp.zVessel || 5;
  const lllPct = inp.lllPercent || 0;
  const pumpCL = inp.zPump || 0.75;
  pump3D.vesselElevation = vesselEl;
  pump3D.pumpCL = pumpCL;

  // Vessel position: vesselEl = base height of vessel from ground
  // In 3D: vesselY = vesselEl * 0.5 (same scaling as initPump3D)
  const vesselH = 1.8;
  const vesselX = -1.2;
  const pumpX = 1.0;
  const vesselY = vesselEl * 0.5;
  const pumpY = pumpCL * 0.5;
  const elbowY = pumpY + 0.15;

  // Move vessel body, domes
  if (pump3D.vesselBody) pump3D.vesselBody.position.y = vesselY + vesselH / 2;
  if (pump3D.vesselTop) pump3D.vesselTop.position.y = vesselY + vesselH;
  if (pump3D.vesselBottom) pump3D.vesselBottom.position.y = vesselY;

  // Liquid fills based on LLL percentage — empty when 0
  if (pump3D.vesselLiquid) {
    if (lllPct <= 0) {
      pump3D.vesselLiquid.visible = false;
      if (pump3D.liquidTop) pump3D.liquidTop.visible = false;
    } else {
      pump3D.vesselLiquid.visible = true;
      if (pump3D.liquidTop) pump3D.liquidTop.visible = true;
      const liqFraction = Math.max(0.05, Math.min(0.95, lllPct / 100));
      const liqH = vesselH * liqFraction;
      const initLiqH = vesselH * 0.55;
      pump3D.vesselLiquid.scale.y = liqH / initLiqH;
      pump3D.vesselLiquid.position.y = vesselY + liqH / 2;
      if (pump3D.liquidTop) {
        pump3D.liquidTop.position.set(vesselX, vesselY + liqH, 0);
      }
    }
  }

  // Move vessel gauge with vessel elevation
  if (pump3D.vesselGauge) {
    pump3D.vesselGauge.position.set(vesselX + 0.5 + 0.01, vesselY + vesselH * 0.7, 0);
  }

  // LLL marker ring & disc — at LLL percentage level inside vessel
  if (pump3D.lllRing) {
    const lllY = vesselY + vesselH * Math.max(0.1, Math.min(0.95, lllPct / 100));
    pump3D.lllRing.position.set(vesselX, lllY, 0);
  }
  if (pump3D.lllDisc) {
    const lllY = vesselY + vesselH * Math.max(0.1, Math.min(0.95, lllPct / 100));
    pump3D.lllDisc.position.set(vesselX, lllY, 0);
  }

  // Move suction pipe vertical to connect vessel bottom to elbow
  if (pump3D.suctionPipeV) {
    const defaultVesselY = 5 * 0.5;
    const defaultElbowY = 0.75 * 0.5 + 0.15;
    const defaultSucVLen = defaultVesselY - defaultElbowY;
    const newSucVLen = Math.max(0.1, vesselY - elbowY);
    pump3D.suctionPipeV.scale.y = newSucVLen / Math.max(defaultSucVLen, 0.1);
    pump3D.suctionPipeV.position.set(vesselX, elbowY + newSucVLen / 2, 0);
  }

  // Move pump assembly (casing, motor, impeller) to new elbowY
  if (pump3D.casingGroup) {
    pump3D.casingGroup.position.set(pumpX, elbowY, 0);
    pump3D.casingGroup._baseX = pumpX;
    pump3D.casingGroup._baseY = elbowY;
  }
  if (pump3D.motorGroup) pump3D.motorGroup.position.set(pumpX, elbowY, 0);
  if (pump3D.impellerGroup) {
    pump3D.impellerGroup.position.set(pumpX, elbowY, 0);
    pump3D.impellerGroup._baseX = pumpX;
    pump3D.impellerGroup._baseY = elbowY;
  }

  // Move concrete base pad — stays on ground but height extends to pump CL
  if (pump3D.baseMesh) {
    var baseHeight = Math.max(0.2, pumpY);
    pump3D.baseMesh.scale.y = baseHeight / 0.2;
    pump3D.baseMesh.position.set(pumpX + 0.2, baseHeight / 2, 0);
  }

  // Move suction horizontal pipe & flange to elbowY
  var sucHLen = pumpX - 0.5 - vesselX;
  if (pump3D.suctionPipeH) {
    pump3D.suctionPipeH.position.set(vesselX + sucHLen / 2, elbowY, 0);
  }
  if (pump3D.suctionFlange) pump3D.suctionFlange.position.set(pumpX - 0.5, elbowY, 0);

  // Move suction gauge to follow horizontal pipe
  if (pump3D.suctionGauge) {
    var pipeR = 0.09;
    pump3D.suctionGauge.position.set(vesselX + sucHLen * 0.5, elbowY + pipeR + 0.01, 0);
  }

  // Move discharge flange to elbowY
  if (pump3D.dischargeFlange) pump3D.dischargeFlange.position.set(pumpX + 0.35, elbowY + 0.2, 0);

  // Move discharge gauge to follow discharge pipe
  if (pump3D.dischargeGauge) {
    pump3D.dischargeGauge.position.set(pumpX + 0.35 + 0.09 * 0.85 + 0.01, elbowY + 0.8, 0);
  }

  // Support structure: always from ground (y=0) to vessel bottom (vesselY)
  if (pump3D.supportGroup) {
    if (vesselY <= 0) {
      pump3D.supportGroup.visible = false;
    } else {
      pump3D.supportGroup.visible = true;
      var defaultVesselY2 = 5 * 0.5;
      var yScale = vesselY / Math.max(0.01, defaultVesselY2);
      pump3D.supportGroup.position.y = 0;
      pump3D.supportGroup.scale.y = Math.max(0.05, yScale);
      // Shift support X to stay centered under vessel
      pump3D.supportGroup.position.x = 0;
    }
  }

  // --- Scale suction & discharge pipes based on nozzle ID ---
  const baseNozzleId = 26.6;
  const sucId = r.sucNozzle ? r.sucNozzle.id : baseNozzleId;
  const disId = r.disNozzle ? r.disNozzle.id : baseNozzleId;
  const sucScale = Math.max(0.4, Math.min(3.5, sucId / baseNozzleId));
  const disScale = Math.max(0.3, Math.min(3.0, disId / baseNozzleId));

  if (pump3D.suctionPipeV) {
    var sucVLenScale = pump3D.suctionPipeV.scale.y;
    pump3D.suctionPipeV.scale.set(sucScale, sucVLenScale, sucScale);
  }
  if (pump3D.suctionPipeH) pump3D.suctionPipeH.scale.set(1, sucScale, sucScale);
  if (pump3D.suctionFlange) pump3D.suctionFlange.scale.setScalar(sucScale);
  if (pump3D.dischargePipe) pump3D.dischargePipe.scale.set(disScale, 1, disScale);
  if (pump3D.dischargeFlange) pump3D.dischargeFlange.scale.setScalar(disScale);

  // --- Scale motor based on standard motor kW ---
  const baseMotorKw = 7.5;
  const motorKw = r.stdMotorKw || baseMotorKw;
  const motorScale = Math.max(0.6, Math.min(2.0, Math.pow(motorKw / baseMotorKw, 0.3)));
  if (pump3D.motorMesh) {
    pump3D.motorMesh.scale.set(motorScale, motorScale, 1);
  }

  // --- Scale casing based on flow ---
  const baseFlow = 10;
  const designFlow = r.designVolFlow || baseFlow;
  const casingScale = Math.max(0.7, Math.min(1.8, Math.pow(designFlow / baseFlow, 0.25)));
  if (pump3D.casingMesh) pump3D.casingMesh.scale.set(casingScale, 1, casingScale);

  // --- Reposition discharge pipe for discharge elevation ---
  const initDisLen = 2.5;
  const disX = pumpX + 0.35;
  const dischElM = inp.zDisch || 0;
  const dischTopY = Math.max(elbowY + initDisLen, dischElM * 0.5);
  const newDisLen = dischTopY - elbowY;

  if (pump3D.dischargePipe) {
    pump3D.dischargePipe.scale.y = newDisLen / initDisLen;
    pump3D.dischargePipe.position.set(disX, elbowY + newDisLen / 2, 0);
  }

  // --- Reposition pressure gauge sprites with elevation ---
  if (pump3D.sucPressSprite) {
    pump3D.sucPressSprite.position.set(pumpX - 1.5, elbowY + 0.6, 0.8);
  }
  if (pump3D.disPressSprite) {
    pump3D.disPressSprite.position.set(disX, dischTopY + 0.8, 0.8);
  }

  // --- Reposition discharge line components evenly along pipe ---
  var cvY = elbowY + newDisLen * 0.25;
  var gvY = elbowY + newDisLen * 0.5;
  var fmY = elbowY + newDisLen * 0.75;
  if (pump3D.checkValve) pump3D.checkValve.position.y = cvY;
  if (pump3D.globeValve) pump3D.globeValve.position.y = gvY;
  if (pump3D.flowMeter) pump3D.flowMeter.position.y = fmY;
  if (pump3D.checkValveLabel) pump3D.checkValveLabel.position.y = cvY;
  if (pump3D.globeValveLabel) pump3D.globeValveLabel.position.y = gvY;
  if (pump3D.flowMeterLabel) pump3D.flowMeterLabel.position.y = fmY;

  // --- Update discharge elevation label ---
  if (pump3D.dischElLabel) {
    pump3D.dischElLabel.position.y = dischTopY + 0.3;
    // Update text
    var delCanvas = pump3D.dischElLabel.material.map.image;
    if (delCanvas) {
      var delCtx = delCanvas.getContext('2d');
      delCtx.clearRect(0, 0, 256, 64);
      delCtx.fillStyle = '#16a34a';
      delCtx.font = 'bold 20px IBM Plex Mono';
      delCtx.textAlign = 'center';
      delCtx.fillText('DISCH. EL: ' + dischElM.toFixed(1) + ' m', 128, 40);
      pump3D.dischElLabel.material.map.needsUpdate = true;
    }
  }

  // --- Update pump centreline vertical line ---
  if (pump3D.centrelineLine) {
    var initCLH = 0.75 * 0.5 + 0.15;
    var clH = Math.max(0.05, elbowY);
    pump3D.centrelineLine.scale.y = clH / Math.max(0.05, initCLH);
    pump3D.centrelineLine.position.y = clH / 2;
  }
  if (pump3D.centrelineTick) {
    pump3D.centrelineTick.position.y = elbowY;
  }
  if (pump3D.centrelineTickBot) {
    pump3D.centrelineTickBot.position.y = 0.01;
  }
  if (pump3D.centrelineLabel) {
    pump3D.centrelineLabel.position.y = elbowY + 0.3;
    var clCanvas = pump3D.centrelineLabel.material.map.image;
    if (clCanvas) {
      var clCtx = clCanvas.getContext('2d');
      clCtx.clearRect(0, 0, 256, 64);
      clCtx.fillStyle = '#ff7538';
      clCtx.font = 'bold 20px IBM Plex Mono';
      clCtx.textAlign = 'center';
      clCtx.fillText('PUMP CL: ' + pumpCL.toFixed(2) + ' m', 128, 40);
      pump3D.centrelineLabel.material.map.needsUpdate = true;
    }
  }

  // --- Update flow meter display with design flow rate ---
  if (pump3D.flowMeterScreen && pump3D.flowMeterScreen._fmCanvas) {
    var fmc = pump3D.flowMeterScreen._fmCanvas;
    var fmx = fmc.getContext('2d');
    fmx.clearRect(0, 0, 128, 48);
    fmx.fillStyle = '#0c1424';
    fmx.fillRect(0, 0, 128, 48);
    fmx.fillStyle = '#22d3ee';
    fmx.font = 'bold 14px monospace';
    fmx.textAlign = 'center';
    var flowVal = r.designVolFlow || 0;
    fmx.fillText(flowVal.toFixed(1) + ' m³/hr', 64, 30);
    pump3D.flowMeterScreen._fmTex.needsUpdate = true;
  }

  // --- Impeller speed proportional to flow velocity ---
  const velSuc = r.velSuc || 1.5;
  pump3D.targetSpinSpeed = Math.max(0.3, Math.min(3.0, velSuc / 1.5));
  pump3D.targetFlowSpeed = pump3D.targetSpinSpeed;

  // --- Cavitation state for animation effects ---
  const cavType = r.cavType || "ok";
  pump3D.cavitating = (cavType === "fail");

  // Sound effects
  initPumpAudio();
  startPumpRunningSound();
  if (cavType === "fail") { startCavitationAlarm(); } else { stopCavitationAlarm(); }

  // Store base positions for impeller & casing (for cavitation vibration)
  if (pump3D.impellerGroup && pump3D.impellerGroup._baseX === undefined) {
    pump3D.impellerGroup._baseX = pump3D.impellerGroup.position.x;
    pump3D.impellerGroup._baseY = pump3D.impellerGroup.position.y;
  }
  if (pump3D.casingGroup && pump3D.casingGroup._baseX === undefined) {
    pump3D.casingGroup._baseX = pump3D.casingGroup.position.x;
    pump3D.casingGroup._baseY = pump3D.casingGroup.position.y;
  }

  // --- Particle color: green=ok, amber=warn, red=fail ---
  const particleColor = cavType === "fail" ? 0xef4444 : (cavType === "warn" ? 0xff7538 : 0x00b875);
  pump3D.particles.forEach(p => {
    if (p.material) p.material.color.setHex(particleColor);
  });

  // --- Particle size based on flow ---
  const particleScale = Math.max(0.5, Math.min(2.0, Math.pow(designFlow / baseFlow, 0.2)));
  pump3D.particles.forEach(p => p.scale.setScalar(particleScale));

  // --- Vessel gauge needle: vessel pressure ---
  const maxGauge = 25;
  if (pump3D.vesselGaugeNeedle) {
    const vp = Math.max(0, Math.min(maxGauge, inp.vesselPressA || 1.01));
    pump3D.vesselGaugeNeedle.rotation.z = (Math.PI / 3) - (vp / maxGauge) * (2 * Math.PI / 3);
  }

  // --- Suction pressure gauge needle in bar(g) ---
  if (pump3D.suctionGaugeNeedle) {
    const pAtm = inp.pAtm || 1.01325;
    const pSucG = Math.max(-1.0, (r.pSucA || pAtm) - pAtm);
    const minVal = -1.0;
    const maxVal = 10.0;
    const frac = Math.max(0, Math.min(1, (pSucG - minVal) / (maxVal - minVal)));
    pump3D.suctionGaugeNeedle.rotation.z = (Math.PI / 3) - frac * (2 * Math.PI / 3);
  }

  // --- Discharge pressure gauge needle in bar(g) ---
  if (pump3D.dischargeGaugeNeedle) {
    const pAtm = inp.pAtm || 1.01325;
    const pDischG = Math.max(-1.0, (r.pDischA || pAtm) - pAtm);
    const minVal = -1.0;
    const maxVal = 30.0;
    const frac = Math.max(0, Math.min(1, (pDischG - minVal) / (maxVal - minVal)));
    pump3D.dischargeGaugeNeedle.rotation.z = (Math.PI / 3) - frac * (2 * Math.PI / 3);
  }

  // --- Floating Suction & Discharge Pressure Gauge HUD Labels ---
  const pAtmVal = inp.pAtm || 1.01325;
  const pSucGVal = (r.pSucA || pAtmVal) - pAtmVal;
  const pDischGVal = (r.pDischA || pAtmVal) - pAtmVal;

  const sucValEl = document.getElementById("pump-3d-suc-press-val");
  if (sucValEl) sucValEl.textContent = pSucGVal.toFixed(4);

  const disValEl = document.getElementById("pump-3d-dis-press-val");
  if (disValEl) disValEl.textContent = pDischGVal.toFixed(4);

  // --- Update 3D pressure gauge sprites ---
  function updateGaugeSprite(sprite, label, value) {
    if (!sprite || !sprite._gaugeCanvas) return;
    const c = sprite._gaugeCanvas;
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = '#ff7538';
    ctx.lineWidth = 2;
    ctx.strokeRect(2, 2, 252, 60);
    ctx.fillStyle = value < 0 ? '#ef4444' : '#00b875';
    ctx.font = 'bold 18px IBM Plex Mono';
    ctx.textAlign = 'center';
    ctx.fillText(label + ': ' + value.toFixed(2) + ' bar(g)', 128, 40);
    sprite._gaugeTex.needsUpdate = true;
  }
  updateGaugeSprite(pump3D.sucPressSprite, 'P_suc', pSucGVal);
  updateGaugeSprite(pump3D.disPressSprite, 'P_dis', pDischGVal);

  // --- Motor color feedback based on loading ---
  const motorLoading = r.motorLoading || 0;
  if (pump3D.motorMesh) {
    let mc = 0x1565c0;
    if (motorLoading > 100)      mc = 0xef4444;
    else if (motorLoading > 90)  mc = 0xf59e0b;
    else if (motorLoading < 20)  mc = 0x42a5f5;
    pump3D.motorMesh.material.color.setHex(mc);
  }

  // --- Casing opacity ---
  const diffHead = r.diffHeadCal || 20;
  if (pump3D.casingMesh) {
    pump3D.casingMesh.material.opacity = Math.max(0.25, Math.min(0.6, 0.6 - (diffHead / 200) * 0.3));
  }

  // --- Liquid color based on fluid ---
  if (pump3D.vesselLiquid) {
    const fluidKey = inp.fluidKey || 'water';
    const fluidColors = {
      water: 0x3b82f6, diesel: 0xd4a574, crude_oil: 0x3e2723, ethanol: 0xe0e0e0,
      methanol: 0xf5f5f5, glycol: 0xffab91, toluene: 0xfff9c4, acetone: 0xf0f0f0,
      sulfuric_acid: 0xfdd835, hydrochloric_acid: 0xc8e6c9, ammonia: 0xb3e5fc,
      brine: 0x90a4ae, caustic_50: 0xefebe9, light_hc: 0xfff59d, heavy_hc: 0x4e342e,
      condensate: 0xfff176
    };
    const liqColor = fluidColors[fluidKey] || 0x3b82f6;
    pump3D.vesselLiquid.material.color.setHex(liqColor);
    pump3D.particles.forEach(p => {
      if (cavType === "ok") p.material.color.setHex(liqColor);
    });
  }

  pump3D.isRunning = true;
}

// --- 3D Pipeline Manifold Simulation Scene (Three.js) ---

function initLine3D(container) {
  container.innerHTML = '';
  const width = container.clientWidth || 380;
  const height = container.clientHeight || 180;

  line3D.scene = new THREE.Scene();

  line3D.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
  line3D.camera.position.set(5.0, 4.0, 7.0);

  line3D.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  line3D.renderer.setSize(width, height);
  line3D.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(line3D.renderer.domElement);

  line3D.controls = new CustomOrbitControls(line3D.camera, line3D.renderer.domElement);
  line3D.controls.enableDamping = true;
  line3D.controls.dampingFactor = 0.05;
  line3D.controls.maxPolarAngle = Math.PI / 2 + 0.08;
  line3D.controls.minDistance = 3.5;
  line3D.controls.maxDistance = 13;
  line3D.controls.autoRotate = true;
  line3D.controls.autoRotateSpeed = 0.7;

  line3D.controls.addEventListener('start', () => { line3D.controls.autoRotate = false; });

  const ambientLight = new THREE.AmbientLight(0xffffff, 0.55);
  line3D.scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.75);
  dirLight.position.set(5, 10, 5);
  line3D.scene.add(dirLight);

  const orangeLight = new THREE.PointLight(0xff7538, 1.8, 10);
  orangeLight.position.set(0, 3, 2);
  line3D.scene.add(orangeLight);

  const tealLight = new THREE.PointLight(0x00c4a0, 1.8, 10);
  tealLight.position.set(0, -3, 2);
  line3D.scene.add(tealLight);

  // Manifold pipe route joints
  const points = [
    new THREE.Vector3(-4.0, 1.3, -1),
    new THREE.Vector3(-1.8, 1.3, -1),
    new THREE.Vector3(-1.8, -1.0, -1),
    new THREE.Vector3(1.5, -1.0, -1),
    new THREE.Vector3(1.5, -1.0, 1.5),
    new THREE.Vector3(4.0, -1.0, 1.5)
  ];

  // Concrete support ground floor
  const floorGeo = new THREE.BoxGeometry(10.0, 0.2, 5.5);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.95 });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.position.set(0, -2.1, 0);
  line3D.scene.add(floorMesh);

  // Pipeline Support Pillars
  const supportMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.85, metalness: 0.4 });
  
  const stand1 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.3, 8), supportMat);
  stand1.position.set(-2.0, 0.15, -1);
  line3D.scene.add(stand1);

  const stand2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.0, 8), supportMat);
  stand2.position.set(1.5, -1.5, 0.2);
  line3D.scene.add(stand2);

  // Pipe manifold geometry
  const pipeRadius = 0.2;
  const pipeMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.25,
    metalness: 0.8,
    transparent: true,
    opacity: 0.65
  });

  const pipeGroup = new THREE.Group();

  for (let i = 0; i < points.length - 1; i++) {
    const pStart = points[i];
    const pEnd = points[i+1];
    const distance = pStart.distanceTo(pEnd);
    
    const cylGeo = new THREE.CylinderGeometry(pipeRadius, pipeRadius, distance, 16);
    const cylMesh = new THREE.Mesh(cylGeo, pipeMat);
    
    const midPoint = new THREE.Vector3().addVectors(pStart, pEnd).multiplyScalar(0.5);
    cylMesh.position.copy(midPoint);
    
    const direction = new THREE.Vector3().subVectors(pEnd, pStart).normalize();
    const upVector = new THREE.Vector3(0, 1, 0);
    cylMesh.quaternion.setFromUnitVectors(upVector, direction);
    
    pipeGroup.add(cylMesh);

    // Bends / joint elbows
    if (i < points.length - 2) {
      const jointGeo = new THREE.SphereGeometry(pipeRadius * 1.15, 16, 16);
      const jointMesh = new THREE.Mesh(jointGeo, pipeMat);
      jointMesh.position.copy(pEnd);
      pipeGroup.add(jointMesh);
    }
  }

  // Flanges + joints details
  const flangeGeo = new THREE.CylinderGeometry(pipeRadius * 1.48, pipeRadius * 1.48, 0.07, 16);
  flangeGeo.rotateX(Math.PI / 2);
  const flangeMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.2 });
  
  const inletFlange = new THREE.Mesh(flangeGeo, flangeMat);
  inletFlange.position.copy(points[0]);
  inletFlange.lookAt(points[1]);
  pipeGroup.add(inletFlange);

  const outletFlange = new THREE.Mesh(flangeGeo, flangeMat);
  outletFlange.position.copy(points[points.length - 1]);
  outletFlange.lookAt(points[points.length - 2]);
  pipeGroup.add(outletFlange);

  // Add flange joints at intermediate pipe bends
  for (let i = 1; i < points.length - 1; i++) {
    const bendFlange = new THREE.Mesh(flangeGeo, flangeMat);
    bendFlange.position.copy(points[i]);
    bendFlange.lookAt(points[i-1]);
    pipeGroup.add(bendFlange);
  }

  // Globe Sizing Valve
  const valveGroup = new THREE.Group();
  valveGroup.position.set(-0.15, -1.0, -1);

  const coneGeo1 = new THREE.ConeGeometry(0.32, 0.44, 16);
  coneGeo1.rotateZ(Math.PI / 2);
  const valveMat = new THREE.MeshStandardMaterial({ color: 0x2a52be, metalness: 0.85, roughness: 0.25 });
  const coneMesh1 = new THREE.Mesh(coneGeo1, valveMat);
  coneMesh1.position.x = -0.21;
  valveGroup.add(coneMesh1);

  const coneMesh2 = coneMesh1.clone();
  coneMesh2.rotation.z = -Math.PI / 2;
  coneMesh2.position.x = 0.21;
  valveGroup.add(coneMesh2);

  const stemGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.55, 8);
  const stemMesh = new THREE.Mesh(stemGeo, flangeMat);
  stemMesh.position.y = 0.35;
  valveGroup.add(stemMesh);

  const wheelGeo = new THREE.TorusGeometry(0.26, 0.045, 8, 16);
  wheelGeo.rotateX(Math.PI / 2);
  const wheelMesh = new THREE.Mesh(wheelGeo, valveMat);
  wheelMesh.position.y = 0.62;
  valveGroup.add(wheelMesh);

  pipeGroup.add(valveGroup);

  // Electromagnetic Flow Meter (with glowing LED display)
  const meterGroup = new THREE.Group();
  meterGroup.position.set(2.7, -1.0, 1.5);
  
  const meterBodyGeo = new THREE.CylinderGeometry(pipeRadius * 1.5, pipeRadius * 1.5, 0.55, 16);
  meterBodyGeo.rotateZ(Math.PI / 2);
  const meterBodyMat = new THREE.MeshStandardMaterial({ color: 0xff7538, metalness: 0.7, roughness: 0.3 });
  const meterBody = new THREE.Mesh(meterBodyGeo, meterBodyMat);
  meterGroup.add(meterBody);
  
  const housingGeo = new THREE.BoxGeometry(0.28, 0.28, 0.3);
  const housingMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });
  const housing = new THREE.Mesh(housingGeo, housingMat);
  housing.position.y = 0.32;
  meterGroup.add(housing);
  
  // LED screen glowing panel
  const screenGeo = new THREE.PlaneGeometry(0.18, 0.14);
  const screenMat = new THREE.MeshBasicMaterial({ color: 0x00c4a0 }); // Cyan flow screen
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, 0.32, 0.155);
  meterGroup.add(screen);
  
  pipeGroup.add(meterGroup);
  line3D.scene.add(pipeGroup);

  // Sizing Instrument Gauges on routes
  const inletGauge = createDialGauge(0x00b875, 0x1e293b, "bar");
  inletGauge.position.copy(points[0]).add(new THREE.Vector3(0.4, 0.25, 0));
  inletGauge.scale.set(1.1, 1.1, 1.1);
  line3D.scene.add(inletGauge);

  const outletGauge = createDialGauge(0xff7538, 0x1e293b, "bar");
  outletGauge.position.copy(points[points.length-1]).add(new THREE.Vector3(-0.4, 0.25, 0));
  outletGauge.scale.set(1.1, 1.1, 1.1);
  line3D.scene.add(outletGauge);

  // Line Flow Saffron Particles
  const particleCount = 25;
  const pGeo = new THREE.SphereGeometry(0.045, 8, 8);
  const pMat = new THREE.MeshBasicMaterial({ color: 0xff7538 });

  line3D.particles = [];
  for (let i = 0; i < particleCount; i++) {
    const p = new THREE.Mesh(pGeo, pMat.clone());
    p.particleId = i;
    resetLineParticle(p, Math.random());
    line3D.scene.add(p);
    line3D.particles.push(p);
  }

  function animate() {
    line3D.animationId = requestAnimationFrame(animate);

    const baseSpeed = 0.0035 * line3D.speedScale;
    const flowStep = baseSpeed * Math.max(line3D.velocity, 0.15);

    line3D.particles.forEach(p => {
      p.pathProgress += flowStep;
      if (p.pathProgress >= 1.0) {
        resetLineParticle(p, 0);
      } else {
        updateLineParticlePosition(p, points);
      }
    });

    if (line3D.speedScale > 1.1) {
      wheelMesh.rotation.y += 0.045;
    }

    line3D.controls.update();
    line3D.renderer.render(line3D.scene, line3D.camera);
  }
  animate();

  window.addEventListener('resize', () => {
    if (!line3D.renderer || !line3D.camera) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    line3D.camera.aspect = w / h;
    line3D.camera.updateProjectionMatrix();
    line3D.renderer.setSize(w, h);
  });
}

// --- Dynamic Recolor Theme Updates for Chart.js ---
function redrawChartsThemeUpdate() {
  if (state.pump.calculated) {
    const pIn = state.pump.inputs;
    const pOut = state.pump.results;
    drawPumpChart(pOut.designVolFlow, pIn.diffHead, pOut.staticHead);
  }
  if (state.line.calculated) {
    const lIn = state.line.inputs;
    const lOut = state.line.results;
    drawOptimizationChart(lIn.qVol, lIn.rho, lIn.mu, lIn.roughnessMm, lIn.npsText, lOut.limits);
  }
}

// --- Sizing Analytical Curves drawing functions using Chart.js ---

function drawPumpChart(designVolFlow, diffHead, staticHead) {
  pumpChartInstance = drawSinglePumpChart('pumpChart', designVolFlow, diffHead, staticHead, pumpChartInstance);
}

function drawOptimizationChart(qVol, rho, mu, roughnessMm, npsText, limits) {
  lineChartInstance = drawSingleLineChart('lineChart', qVol, rho, mu, roughnessMm, npsText, limits, lineChartInstance);
}

function drawSinglePumpChart(canvasId, designVolFlow, diffHead, staticHead, chartInstance) {
  const canvasEl = document.getElementById(canvasId);
  if (!canvasEl) return null;

  if (chartInstance) {
    chartInstance.destroy();
  }

  if (typeof Chart === 'undefined') {
    console.error("Chart.js library not loaded. Unable to draw curves.");
    return null;
  }

  const rho = parseFloat(document.getElementById("pump-density").value) || 997;
  const g = 9.80665;
  let staticM = (staticHead * 100000) / (rho * g);
  
  const qDesign = Math.max(designVolFlow, 1.0);
  const hDesign = Math.max(diffHead, 1.0);
  
  if (staticM >= hDesign) {
    staticM = 0.2 * hDesign;
  }
  if (staticM < -hDesign) {
    staticM = -0.5 * hDesign;
  }

  const shutoffHead = 1.25 * hDesign;
  const A = (shutoffHead - hDesign) / (qDesign * qDesign);
  const B = (hDesign - staticM) / (qDesign * qDesign);

  const flowData = [];
  const pumpHeadData = [];
  const sysHeadData = [];
  
  const steps = 15;
  const maxFlow = qDesign * 1.5;
  
  for (let i = 0; i <= steps; i++) {
    const q = (maxFlow / steps) * i;
    flowData.push(q);
    
    const hPump = Math.max(0, shutoffHead - A * q * q);
    pumpHeadData.push(hPump);
    
    const hSys = staticM + B * q * q;
    sysHeadData.push(hSys);
  }

  const themeColors = getThemeColors();
  const isLight = document.body.classList.contains("light-theme");
  
  const pumpColor = "#ff7538";
  const sysColor = "#00c4a0";
  const optColor = isLight ? "#0f172a" : "#ffffff";

  const opData = new Array(flowData.length).fill(null);
  const opIndex = Math.min(steps, Math.round((qDesign / maxFlow) * steps));
  opData[opIndex] = hDesign;

  const data = {
    labels: flowData.map(q => q.toFixed(1)),
    datasets: [
      {
        label: 'Pump Head Curve (m)',
        data: pumpHeadData,
        borderColor: pumpColor,
        backgroundColor: 'rgba(255, 117, 56, 0.1)',
        borderWidth: 2.5,
        pointRadius: 0,
        fill: false,
        tension: 0.2
      },
      {
        label: 'System Head Curve (m)',
        data: sysHeadData,
        borderColor: sysColor,
        backgroundColor: 'rgba(0, 196, 160, 0.05)',
        borderWidth: 2.5,
        pointRadius: 0,
        fill: false,
        tension: 0.2
      },
      {
        label: 'Operating Point',
        data: opData,
        borderColor: optColor,
        backgroundColor: optColor,
        pointStyle: 'circle',
        pointRadius: 6,
        pointHoverRadius: 8,
        showLine: false
      }
    ]
  };

  const config = {
    type: 'line',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: themeColors.textColor,
            font: { family: 'IBM Plex Mono', size: 9 }
          }
        },
        tooltip: {
          backgroundColor: themeColors.tooltipBg,
          borderColor: themeColors.tooltipBorder,
          borderWidth: 1,
          titleColor: themeColors.tooltipText,
          bodyColor: themeColors.tooltipText,
          titleFont: { family: 'IBM Plex Mono', size: 10 },
          bodyFont: { family: 'IBM Plex Mono', size: 10 }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Flow Rate (m³/hr)',
            color: themeColors.textColor,
            font: { family: 'IBM Plex Mono', size: 9 }
          },
          grid: { color: themeColors.gridColor },
          ticks: {
            color: themeColors.textColor,
            font: { family: 'IBM Plex Mono', size: 8 }
          }
        },
        y: {
          title: {
            display: true,
            text: 'Head (m)',
            color: themeColors.textColor,
            font: { family: 'IBM Plex Mono', size: 9 }
          },
          grid: { color: themeColors.gridColor },
          ticks: {
            color: themeColors.textColor,
            font: { family: 'IBM Plex Mono', size: 8 }
          }
        }
      }
    }
  };

  return new Chart(canvasEl, config);
}

function drawSingleLineChart(canvasId, qVol, rho, mu, roughnessMm, npsText, limits, chartInstance) {
  const canvasEl = document.getElementById(canvasId);
  if (!canvasEl) return null;

  if (chartInstance) {
    chartInstance.destroy();
  }

  if (typeof Chart === 'undefined') {
    console.error("Chart.js library not loaded. Unable to draw curves.");
    return null;
  }

  const sizes = ["0.5", "0.75", "1", "1.5", "2", "3", "4", "6", "8", "10", "12"];
  const labels = ["1/2\"", "3/4\"", "1\"", "1-1/2\"", "2\"", "3\"", "4\"", "6\"", "8\"", "10\"", "12\""];
  
  const velocities = [];
  const dp100ms = [];
  
  let activeIndex = -1;
  const currentNpsVal = parseFloat(npsText);

  const schSelect = document.getElementById("line-schedule");
  const sch = schSelect ? schSelect.value : "40";

  sizes.forEach((size, idx) => {
    const sizeData = PIPE_DATABASE[size];
    const idInches = sizeData ? (sizeData[sch] || sizeData["STD"] || sizeData["40"]) : 0;
    
    if (Math.abs(parseFloat(size) - currentNpsVal) < 0.05) {
      activeIndex = idx;
    }

    if (idInches > 0) {
      const idM = idInches * 0.0254;
      const area = (Math.PI / 4) * (idM * idM);
      const qM3S = qVol / 3600;
      const vel = qM3S / area;
      
      const muPaS = mu * 0.001;
      const reynolds = (rho * vel * idM) / muPaS;
      
      let f = 0.02;
      if (reynolds <= 2300) {
        f = 64 / reynolds;
      } else {
        const relRoughness = (roughnessMm * 0.001) / idM;
        f = solveColebrook(reynolds, relRoughness);
      }
      
      const dp100 = f * (100 / idM) * (rho * vel * vel) / (2 * 1e5);
      
      velocities.push(vel);
      dp100ms.push(dp100);
    } else {
      velocities.push(0);
      dp100ms.push(0);
    }
  });

  const themeColors = getThemeColors();
  const isLight = document.body.classList.contains("light-theme");
  
  const velColor = "#00c4a0";
  const dpColor = "#ff7538";
  const highlightColor = isLight ? "#0f172a" : "#ffffff";

  const pointRadii = new Array(sizes.length).fill(3);
  const pointBackgrounds = new Array(sizes.length).fill(velColor);
  if (activeIndex !== -1) {
    pointRadii[activeIndex] = 7;
    pointBackgrounds[activeIndex] = highlightColor;
  }

  const data = {
    labels: labels,
    datasets: [
      {
        label: 'Velocity (m/s)',
        data: velocities,
        borderColor: velColor,
        backgroundColor: 'rgba(0, 196, 160, 0.15)',
        borderWidth: 2,
        pointRadius: pointRadii,
        pointBackgroundColor: pointBackgrounds,
        yAxisID: 'yVel',
        tension: 0.15
      },
      {
        label: 'Pressure Drop (bar/100m)',
        data: dp100ms,
        borderColor: dpColor,
        backgroundColor: 'rgba(255, 117, 56, 0.05)',
        borderWidth: 2,
        pointRadius: pointRadii.map((r, i) => i === activeIndex ? 7 : 3),
        pointBackgroundColor: pointRadii.map((r, i) => i === activeIndex ? highlightColor : dpColor),
        yAxisID: 'yDp',
        tension: 0.15
      }
    ]
  };

  const config = {
    type: 'line',
    data: data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: themeColors.textColor,
            font: { family: 'IBM Plex Mono', size: 9 }
          }
        },
        tooltip: {
          backgroundColor: themeColors.tooltipBg,
          borderColor: themeColors.tooltipBorder,
          borderWidth: 1,
          titleColor: themeColors.tooltipText,
          bodyColor: themeColors.tooltipText,
          titleFont: { family: 'IBM Plex Mono', size: 10 },
          bodyFont: { family: 'IBM Plex Mono', size: 10 }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Nominal Pipe Size (NPS)',
            color: themeColors.textColor,
            font: { family: 'IBM Plex Mono', size: 9 }
          },
          grid: { color: themeColors.gridColor },
          ticks: {
            color: themeColors.textColor,
            font: { family: 'IBM Plex Mono', size: 8 }
          }
        },
        yVel: {
          type: 'linear',
          position: 'left',
          title: {
            display: true,
            text: 'Velocity (m/s)',
            color: themeColors.textColor,
            font: { family: 'IBM Plex Mono', size: 9 }
          },
          grid: { color: themeColors.gridColor },
          ticks: {
            color: themeColors.textColor,
            font: { family: 'IBM Plex Mono', size: 8 }
          },
          min: 0,
          max: Math.ceil(Math.max(...velocities, limits.maxV * 1.5))
        },
        yDp: {
          type: 'linear',
          position: 'right',
          title: {
            display: true,
            text: 'Pressure Drop (bar/100m)',
            color: themeColors.textColor,
            font: { family: 'IBM Plex Mono', size: 9 }
          },
          grid: { drawOnChartArea: false },
          ticks: {
            color: themeColors.textColor,
            font: { family: 'IBM Plex Mono', size: 8 }
          },
          min: 0,
          max: Math.max(1.0, Math.max(...dp100ms) * 1.2)
        }
      }
    }
  };

  return new Chart(canvasEl, config);
}

// --- Sizing Calculations Executors ---

function executePumpCalculations() {
  const overlay = document.getElementById("pump-sim-overlay");
  if (overlay) {
    overlay.classList.add("active");
    pump3D.isRunning = true;
    pump3D.speedScale = 4.0;
    
    const consoleText = overlay.querySelector(".sim-console-text");
    const phrases = [
      "Solving static pressure heads...",
      "Evaluating Bernoulli values...",
      "Performing cavitation audit...",
      "Checking NPSH margin limits...",
      "Finalizing BHP calculations..."
    ];
    
    let phase = 0;
    const interval = setInterval(() => {
      if (consoleText && phase < phrases.length) {
        consoleText.textContent = phrases[phase++];
      }
    }, 150);

    setTimeout(() => {
      clearInterval(interval);
      overlay.classList.remove("active");
      pump3D.speedScale = 1.0;
      runActualPumpCalculations();
    }, 800);
  } else {
    runActualPumpCalculations();
  }
}

// ====== PUMP SIZING EXTENSIONS & DESIGN ASSISTANT ======
const STANDARD_NOZZLES = [
  { nps: '1/2"', id: 15.8 },
  { nps: '3/4"', id: 20.9 },
  { nps: '1"', id: 26.6 },
  { nps: '1½"', id: 40.9 },
  { nps: '2"', id: 52.5 },
  { nps: '3"', id: 77.9 },
  { nps: '4"', id: 102.3 },
  { nps: '6"', id: 154.1 },
  { nps: '8"', id: 202.7 },
  { nps: '10"', id: 254.5 },
  { nps: '12"', id: 303.2 },
  { nps: '14"', id: 333.4 },
  { nps: '16"', id: 381.0 },
  { nps: '18"', id: 428.7 },
  { nps: '20"', id: 477.9 },
  { nps: '24"', id: 574.6 }
];

let pumpCorrections = {
  active: false,
  suctionNps: null,
  dischargeNps: null,
  efficiencyApplied: false,
  motorPowerOverride: null,
  npshMarginApplied: false,
  cavitationApplied: false
};

function resetPumpCorrections() {
  pumpCorrections = {
    active: false,
    suctionNps: null,
    dischargeNps: null,
    efficiencyApplied: false,
    motorPowerOverride: null,
    npshMarginApplied: false,
    cavitationApplied: false
  };
}

function syncActiveNpshMargin() {
  const activeRadio = document.querySelector('input[name="npsh-active-row"]:checked');
  if (!activeRadio) return;
  
  const activeType = activeRadio.value;
  const valInput = document.getElementById(`npsh-val-${activeType}`);
  if (!valInput) return;
  
  const val = parseFloat(valInput.value) || 0;
  
  const hiddenNpshr = document.getElementById("pump-npshr");
  if (hiddenNpshr) {
    hiddenNpshr.value = val;
  }
  
  const lblActiveMargin = document.getElementById("lbl-active-npsh-margin-val");
  const lblActiveNpshr = document.getElementById("lbl-active-npshr-val");
  
  if (lblActiveMargin) lblActiveMargin.textContent = val.toFixed(2);
  if (lblActiveNpshr) lblActiveNpshr.textContent = val.toFixed(2);
}

function getRecommendedNozzle(Q_m3s, targetVelocity) {
  const reqArea = Q_m3s / targetVelocity;
  const reqId = Math.sqrt((4 * reqArea) / Math.PI) * 1000;
  for (let nozzle of STANDARD_NOZZLES) {
    if (nozzle.id >= reqId) return nozzle;
  }
  return STANDARD_NOZZLES[STANDARD_NOZZLES.length - 1];
}

function findNozzleForRange(Q_m3s, minVel, maxVel, preferredTarget) {
  let candidates = [];
  for (let nozzle of STANDARD_NOZZLES) {
    const area = (Math.PI / 4) * Math.pow(nozzle.id / 1000, 2);
    const vel = Q_m3s / area;
    if (vel >= minVel && vel <= maxVel) {
      candidates.push({ nozzle, vel, diff: Math.abs(vel - preferredTarget) });
    }
  }
  if (candidates.length > 0) {
    candidates.sort((a, b) => a.diff - b.diff);
    return candidates[0].nozzle;
  }
  let bestNozzle = STANDARD_NOZZLES[0];
  let minDiff = Infinity;
  for (let nozzle of STANDARD_NOZZLES) {
    const area = (Math.PI / 4) * Math.pow(nozzle.id / 1000, 2);
    const vel = Q_m3s / area;
    let diff = 0;
    if (vel < minVel) diff = minVel - vel;
    else if (vel > maxVel) diff = vel - maxVel;
    if (diff < minDiff) {
      minDiff = diff;
      bestNozzle = nozzle;
    }
  }
  return bestNozzle;
}

function applyPumpCorrection(type) {
  if (type === "npshMargin") {
    window.isApplyingCorrection = true;
    let elInput = document.getElementById("pump-vessel-el");
    if (elInput) {
      let currentVal = window.getInputValueSI("pump-vessel-el");
      let activeMargin = window.getInputValueSI("pump-npshr");
      let maxIter = 100;
      while (maxIter > 0) {
        currentVal += 0.5;
        const displayVal = window.UNIT_CONVERSIONS['length-m'].fromSI(currentVal, window.activeUnitSystem);
        elInput.value = displayVal.toFixed(4).replace(/\.0000$/, '');
        runActualPumpCalculations(true);
        const currentNpsha = window.state.pump.results.npsha;
        if (currentNpsha - activeMargin >= activeMargin) break;
        maxIter--;
      }
    }
    window.isApplyingCorrection = false;
    pumpCorrections.npshMarginApplied = true;
    runActualPumpCalculations(true);
    logConsole("Design Assistant: NPSH Margin corrected by increasing Vessel Elevation.", "success");
  } else if (type === "suctionVel") {
    const Q_m3s = window.state.pump.results.designVolFlow / 3600;
    const recNozzle = findNozzleForRange(Q_m3s, 0.5, 1.5, 1.0);
    pumpCorrections.suctionNps = recNozzle.nps;
    runActualPumpCalculations(true);
    logConsole(`Design Assistant: Suction nozzle size updated to standard NPS ${recNozzle.nps}.`, "success");
  } else if (type === "dischargeVel") {
    const Q_m3s = window.state.pump.results.designVolFlow / 3600;
    const recNozzle = findNozzleForRange(Q_m3s, 1.5, 3.0, 2.0);
    pumpCorrections.dischargeNps = recNozzle.nps;
    runActualPumpCalculations(true);
    logConsole(`Design Assistant: Discharge nozzle size updated to standard NPS ${recNozzle.nps}.`, "success");
  } else if (type === "efficiency") {
    const effInput = document.getElementById("pump-efficiency");
    if (effInput) effInput.value = 75;
    pumpCorrections.efficiencyApplied = true;
    runActualPumpCalculations(true);
    logConsole("Design Assistant: Pump efficiency corrected to recommended 75%.", "success");
  } else if (type === "motorOversized") {
    const Preq = window.state?.pump?.results?.motorSelKw;
    const Pmotor = window.state?.pump?.results?.stdMotorKw;
    if (Preq == null || Pmotor == null) {
      logConsole("Design Assistant: Run calculations first before applying motor correction.", "warn");
      return;
    }
    const IEC_MOTOR_SIZES_KW = [0.06, 0.09, 0.12, 0.18, 0.25, 0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250, 315];
    let optimalMotor = 0.06;
    for (let size of IEC_MOTOR_SIZES_KW) {
      if (size >= Preq) {
        optimalMotor = size;
        break;
      }
    }
    if (Preq > IEC_MOTOR_SIZES_KW[IEC_MOTOR_SIZES_KW.length - 1]) {
      optimalMotor = IEC_MOTOR_SIZES_KW[IEC_MOTOR_SIZES_KW.length - 1];
    }
    
    if (optimalMotor < Pmotor) {
      pumpCorrections.motorPowerOverride = optimalMotor;
      runActualPumpCalculations(true);
      logConsole(`Design Assistant: Motor optimized from ${Pmotor} kW → ${optimalMotor} kW.`, "success");
    } else {
      logConsole(`Design Assistant: No smaller standard motor size found below current selection ${Pmotor} kW that satisfies required power.`, "warn");
    }
  } else if (type === "motorAutoOptimize") {
    const r = window.state?.pump?.results;
    if (!r) { logConsole("Design Assistant: Run calculations first.", "warn"); return; }
    const IEC_MOTOR_SIZES_KW = [0.06, 0.09, 0.12, 0.18, 0.25, 0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250, 315];
    const bhp = r.bhp || 0;
    const currentMotor = r.stdMotorKw || 0;
    // Step 1: Try selecting optimal (smallest sufficient) motor
    let optMotor = IEC_MOTOR_SIZES_KW[0];
    for (let s of IEC_MOTOR_SIZES_KW) { if (s >= (r.motorSelKw || 0)) { optMotor = s; break; } }
    if ((r.motorSelKw || 0) > IEC_MOTOR_SIZES_KW[IEC_MOTOR_SIZES_KW.length - 1]) optMotor = IEC_MOTOR_SIZES_KW[IEC_MOTOR_SIZES_KW.length - 1];
    const loadOnOpt = optMotor > 0 ? (bhp / optMotor) * 100 : 0;
    if (optMotor < currentMotor && loadOnOpt >= 40 && loadOnOpt <= 100) {
      pumpCorrections.motorPowerOverride = optMotor;
      runActualPumpCalculations(true);
      logConsole("Auto-Optimize: Motor downsized from " + currentMotor + " kW → " + optMotor + " kW (loading " + loadOnOpt.toFixed(1) + "%).", "success");
    } else {
      // Step 2: Try increasing flowrate to get 75% loading on optimal motor
      const targetMotor = optMotor < currentMotor ? optMotor : currentMotor;
      const targetBhp = targetMotor * 0.75;
      const flowFactor = bhp > 0 ? targetBhp / bhp : 1;
      const currentFlow = r.designVolFlow || 0;
      const newFlowM3hr = currentFlow * flowFactor;
      const newFlowLhr = newFlowM3hr * 1000;
      const flowInput = document.getElementById("pump-vol-flow-lhr");
      if (flowInput && newFlowLhr > 0) {
        flowInput.value = newFlowLhr.toFixed(0);
        if (optMotor < currentMotor) pumpCorrections.motorPowerOverride = optMotor;
        runActualPumpCalculations(true);
        logConsole("Auto-Optimize: Flowrate adjusted to " + newFlowLhr.toFixed(0) + " l/hr" + (optMotor < currentMotor ? ", motor → " + optMotor + " kW" : "") + " for ~75% loading.", "success");
      } else {
        logConsole("Auto-Optimize: Could not determine optimal adjustment. Review inputs manually.", "warn");
      }
    }
  } else if (type === "cavitation") {
    window.isApplyingCorrection = true;
    let dpInput = document.getElementById("pump-suc-dp");
    if (dpInput) {
      let currentDp = window.getInputValueSI("pump-suc-dp");
      let maxIter = 100;
      while (maxIter > 0) {
        currentDp = Math.max(0, currentDp - 0.05);
        const displayVal = window.UNIT_CONVERSIONS['press-drop'].fromSI(currentDp, window.activeUnitSystem);
        dpInput.value = displayVal.toFixed(4).replace(/\.0000$/, '');
        runActualPumpCalculations(true);
        const currentNpsha = window.state.pump.results.npsha;
        const activeNpshr = window.state.pump.inputs.npshr;
        if (currentNpsha >= activeNpshr || currentDp === 0) break;
        maxIter--;
      }
    }
    window.isApplyingCorrection = false;
    pumpCorrections.cavitationApplied = true;
    runActualPumpCalculations(true);
    logConsole("Design Assistant: Cavitation risk corrected by reducing Suction Line ΔP.", "success");
  }
}

function applyAllPumpSuggestions() {
  // Apply corrections iteratively until system stabilizes
  const correctionOrder = ["suctionVel", "dischargeVel", "motorAutoOptimize", "cavitation", "npshMargin"];
  let iterations = 0;
  let applied = true;
  while (applied && iterations < 5) {
    applied = false;
    iterations++;
    const pIn = window.state.pump.inputs;
    const pOut = window.state.pump.results;
    if (!pOut) break;
    const Q_m3s = pOut.designVolFlow / 3600;

    for (const type of correctionOrder) {
      let needsApply = false;
      if (type === "suctionVel" && !pumpCorrections.suctionNps) {
        const noz = getRecommendedNozzle(Q_m3s, 1.0);
        const a = Math.PI / 4 * Math.pow(noz.id / 1000, 2);
        const v = Q_m3s / a;
        needsApply = (v < 0.5 || v > 1.5);
      } else if (type === "dischargeVel" && !pumpCorrections.dischargeNps) {
        const noz = getRecommendedNozzle(Q_m3s, 2.0);
        const a = Math.PI / 4 * Math.pow(noz.id / 1000, 2);
        const v = Q_m3s / a;
        needsApply = (v < 1.5 || v > 3.0);
      } else if (type === "motorAutoOptimize" && !pumpCorrections.motorPowerOverride && pOut.motorLoading < 40) {
        needsApply = true;
      } else if (type === "cavitation" && !pumpCorrections.cavitationApplied && pOut.npsha < pIn.npshr) {
        needsApply = true;
      } else if (type === "npshMargin" && !pumpCorrections.npshMarginApplied) {
        needsApply = (pOut.npsha - pIn.npshr < pIn.npshr);
      }
      if (needsApply) {
        applyPumpCorrection(type);
        applied = true;
      }
    }
  }
  logConsole("Design Assistant: All suggestions applied (" + iterations + " iteration" + (iterations > 1 ? "s" : "") + ").", "success");
}

function runActualPumpCalculations(isApplyAction) {
  if (!isApplyAction) resetPumpCorrections();

  // FLUID PROPERTY LOOKUP TABLE
  const FLUID_DB = {
    water:          { density: 1000, viscosity: 1.0 },
    caustic_50:     { density: 1530, viscosity: 78.0 },
    diesel:         { density: 845,  viscosity: 3.5 },
    ethanol:        { density: 789,  viscosity: 1.2 },
    methanol:       { density: 792,  viscosity: 0.59 },
    glycol:         { density: 1113, viscosity: 16.0 },
    toluene:        { density: 867,  viscosity: 0.59 },
    acetone:        { density: 790,  viscosity: 0.32 },
    sulfuric_acid:  { density: 1836, viscosity: 26.0 },
    hydrochloric_acid: { density: 1175, viscosity: 1.9 },
    light_hc:       { density: 550,  viscosity: 0.14 },
    heavy_hc:       { density: 980,  viscosity: 180.0 },
    ammonia:        { density: 682,  viscosity: 0.26 },
    brine:          { density: 1150, viscosity: 1.8 },
    crude_oil:      { density: 870,  viscosity: 25.0 },
    condensate:     { density: 750,  viscosity: 0.5 },
    custom:         { density: null, viscosity: null }
  };

  // SYNC FLUID DROPDOWN - AUTO-FILL density/viscosity
  const fluidSelect = document.getElementById("pump-fluid");
  const fluidVal = fluidSelect ? fluidSelect.value : "water";
  const fluidName = fluidSelect ? fluidSelect.options[fluidSelect.selectedIndex].text : "Water";
  const fluidData = FLUID_DB[fluidVal] || FLUID_DB.water;
  if (fluidData.density !== null) {
    const densEl = document.getElementById("pump-density");
    if (densEl && !densEl.dataset.userOverride) densEl.value = fluidData.density;
    const viscEl = document.getElementById("pump-viscosity");
    if (viscEl && !viscEl.dataset.userOverride) viscEl.value = fluidData.viscosity;
  }

  // READ INPUTS
  const pumpTag       = document.getElementById("pump-tag")?.value || "P-101-A";
  const pumpOpCount   = parseInt(document.getElementById("pump-operating-count")?.value) || 1;
  const rho           = parseFloat(document.getElementById("pump-density")?.value) || 1000;
  const mu            = parseFloat(document.getElementById("pump-viscosity")?.value) || 1.0;

  const tempMaxC      = parseFloat(document.getElementById("pump-temp-max")?.value) || 34;
  const tempNormC     = parseFloat(document.getElementById("pump-temp-norm")?.value) || 25;
  const tempMinC      = parseFloat(document.getElementById("pump-temp-min")?.value) || 21;

  // VAPOR PRESSURE — user-editable, auto-lookup if blank
  const g = 9.81;
  const vpInput = document.getElementById("pump-vapor-pres");
  const vpUserVal = vpInput ? parseFloat(vpInput.value) : NaN;
  const isCustomFluid = (fluidVal === 'custom');
  const pVapBarA = isNaN(vpUserVal) ? (isCustomFluid ? 0 : lookupPumpVaporPressure(tempMaxC)) : vpUserVal;
  const pVapM = (pVapBarA * 100000) / (rho * g);
  const vpMDisp = document.getElementById("pump-vapor-pres-m-display");
  if (vpMDisp) vpMDisp.value = pVapM.toFixed(3) + " m";

  // FLOWRATES — l/hr is the only user input; m³/hr and kg/hr auto-calc
  const volFlowLhr    = parseFloat(document.getElementById("pump-vol-flow-lhr")?.value) || 0;
  const volFlowM3hr   = volFlowLhr / 1000;
  const massFlowKghr  = volFlowM3hr * rho;
  const margin        = parseFloat(document.getElementById("pump-margin")?.value) || 0;
  const designVolFlow = volFlowM3hr * (1 + margin / 100);
  const Q_m3s         = designVolFlow / 3600;
  // Update auto-calc displays
  const m3disp = document.getElementById("pump-vol-flow-m3hr");
  if (m3disp) m3disp.value = volFlowLhr > 0 ? volFlowM3hr.toFixed(4) : '';
  const massDisp = document.getElementById("pump-mass-flow");
  if (massDisp) massDisp.value = volFlowLhr > 0 ? massFlowKghr.toFixed(1) : '';
  const designDisp = document.getElementById("pump-design-flow-display");
  if (designDisp) designDisp.value = volFlowLhr > 0 ? (designVolFlow.toFixed(3) + " m³/hr = " + (designVolFlow*1000).toFixed(1) + " l/hr") : '';

  // SUCTION SIDE
  const sucSourceType = document.getElementById("pump-suc-source-type")?.value || "atmospheric";
  const vesselPressG  = parseFloat(document.getElementById("pump-vessel-press-g")?.value) || 0;
  const pAtm          = parseFloat(document.getElementById("pump-atm-pressure")?.value) || 1.01325;
  const vesselPressA  = (sucSourceType === "atmospheric") ? pAtm : (vesselPressG + pAtm);

  const vpAdisp = document.getElementById("pump-vessel-press-a-display");
  if (vpAdisp) vpAdisp.value = vesselPressA.toFixed(4);

  const zVessel       = parseFloat(document.getElementById("pump-vessel-el")?.value) || 5;
  const lllPercentRaw = document.getElementById("pump-lll")?.value;
  const lllPercent    = (lllPercentRaw !== '' && lllPercentRaw !== null && lllPercentRaw !== undefined) ? parseFloat(lllPercentRaw) || 0 : 0;
  const zPump         = parseFloat(document.getElementById("pump-centreline-el")?.value) || 0.75;
  const vesselHeight  = zVessel * 0.8;
  const lll           = zVessel + vesselHeight * (lllPercent / 100);

  // Suction dP from radio table
  let sucDp = 0.01;
  const sucDpRadio = document.querySelector('input[name="suc-dp-radio"]:checked');
  if (sucDpRadio) {
    const rv = sucDpRadio.value;
    if (rv === "short")        sucDp = parseFloat(document.getElementById("suc-dp-short")?.value) || 0.005;
    else if (rv === "normal")  sucDp = parseFloat(document.getElementById("suc-dp-normal")?.value) || 0.01;
    else if (rv === "long")    sucDp = parseFloat(document.getElementById("suc-dp-long")?.value) || 0.05;
    else if (rv === "user")    sucDp = parseFloat(document.getElementById("suc-dp-user")?.value) || 0.01;
  }
  const sucDpHid = document.getElementById("pump-suc-dp");
  if (sucDpHid) sucDpHid.value = sucDp;

  // NPSHr — user-editable, fallback to max(vendor, process)
  const npshrInput = document.getElementById("pump-npshr");
  const npshrUserVal = npshrInput ? parseFloat(npshrInput.value) : NaN;
  const npshrVendor  = parseFloat(document.getElementById("pump-npshr-vendor")?.value) || 0;
  const npshrProcess = parseFloat(document.getElementById("pump-npshr-process")?.value) || 10;
  const npshr = !isNaN(npshrUserVal) && npshrUserVal > 0 ? npshrUserVal : Math.max(npshrVendor, npshrProcess);

  // NPSH Margin from radio table
  let npshMarginLimit = 1.0;
  const npshRadio = document.querySelector('input[name="npsh-active-row"]:checked');
  if (npshRadio) {
    const rv = npshRadio.value;
    if (rv === "water")       npshMarginLimit = parseFloat(document.getElementById("npsh-val-water")?.value) || 1.0;
    else if (rv === "user1")  npshMarginLimit = parseFloat(document.getElementById("npsh-val-user1")?.value) || 2.0;
    else if (rv === "user2")  npshMarginLimit = parseFloat(document.getElementById("npsh-val-user2")?.value) || 1.0;
  }

  // DISCHARGE SIDE
  let dischDp = 0.5;
  const disDpRadio = document.querySelector('input[name="dis-dp-radio"]:checked');
  if (disDpRadio) {
    const rv = disDpRadio.value;
    if (rv === "veryshort")   dischDp = parseFloat(document.getElementById("dis-dp-veryshort")?.value) || 0.05;
    else if (rv === "normal") dischDp = parseFloat(document.getElementById("dis-dp-normal")?.value) || 0.5;
    else if (rv === "long")   dischDp = parseFloat(document.getElementById("dis-dp-long")?.value) || 1.5;
    else if (rv === "user")   dischDp = parseFloat(document.getElementById("dis-dp-user")?.value) || 0.5;
  }
  const disDpHid = document.getElementById("pump-disch-dp");
  if (disDpHid) disDpHid.value = dischDp;

  const destA          = parseFloat(document.getElementById("pump-dest-a")?.value) || 5;
  const zDisch         = parseFloat(document.getElementById("pump-discharge-el")?.value) || 10;
  const shutoffMargin  = parseFloat(document.getElementById("pump-shutoff-margin")?.value) || 20;

  // NOZZLE TARGET VELOCITIES (standard engineering: suction ~2 m/s, discharge ~6 m/s)
  const targetSucVel  = 2.0;
  const targetDisVel  = 6.0;

  // EFFICIENCY LOOKUP
  let pumpEff = 77.5;
  const peffOverride = parseFloat(document.getElementById("pump-eff-override")?.value);
  if (!isNaN(peffOverride) && peffOverride > 0) {
    pumpEff = peffOverride;
  } else {
    const activePumpRadio = document.querySelector('input[name="peff-radio"]:checked');
    if (activePumpRadio) {
      const row = activePumpRadio.closest('.eff-row');
      if (row) {
        const pMin = parseFloat(row.querySelector('.p-min')?.value) || 0;
        const pMax = parseFloat(row.querySelector('.p-max')?.value) || 0;
        if (pMin > 0 || pMax > 0) pumpEff = (pMin + pMax) / 2;
      }
    }
  }
  const apd = document.getElementById("active-pump-eff-disp");
  if (apd) apd.textContent = pumpEff.toFixed(1);

  let motorEff = 93.0;
  const meffOverride = parseFloat(document.getElementById("motor-eff-override")?.value);
  if (!isNaN(meffOverride) && meffOverride > 0) {
    motorEff = meffOverride;
  } else {
    const activeMotorRadio = document.querySelector('input[name="meff-radio"]:checked');
    if (activeMotorRadio) {
      const row = activeMotorRadio.closest('.eff-row');
      if (row) {
        const mMin = parseFloat(row.querySelector('.m-min')?.value) || 0;
        const mMax = parseFloat(row.querySelector('.m-max')?.value) || 0;
        if (mMin > 0 || mMax > 0) motorEff = (mMin + mMax) / 2;
      }
    }
  }
  const amd = document.getElementById("active-motor-eff-disp");
  if (amd) amd.textContent = motorEff.toFixed(1);

  const motorSf = parseFloat(document.getElementById("pump-motor-sf")?.value) || 20;

  // NOZZLE SIZING
  let sucNozzle, disNozzle;
  if (pumpCorrections.suctionNps !== null) {
    sucNozzle = STANDARD_NOZZLES.find(n => n.nps === pumpCorrections.suctionNps) || STANDARD_NOZZLES[5];
  } else {
    sucNozzle = getNozzleForTargetVelocity(Q_m3s, targetSucVel);
  }
  if (pumpCorrections.dischargeNps !== null) {
    disNozzle = STANDARD_NOZZLES.find(n => n.nps === pumpCorrections.dischargeNps) || STANDARD_NOZZLES[4];
  } else {
    disNozzle = getNozzleForTargetVelocity(Q_m3s, targetDisVel);
  }
  // Enforce: discharge nozzle ID must always be strictly smaller than suction ID
  if (disNozzle.id >= sucNozzle.id) {
    const sucIdx = STANDARD_NOZZLES.findIndex(n => n.nps === sucNozzle.nps);
    if (sucIdx > 0) {
      disNozzle = STANDARD_NOZZLES[sucIdx - 1];
    } else {
      sucNozzle = STANDARD_NOZZLES[1];
      disNozzle = STANDARD_NOZZLES[0];
    }
  }

  const areaSuc = (Math.PI / 4) * Math.pow(sucNozzle.id / 1000, 2);
  const velSuc  = Q_m3s / areaSuc;
  const areaDis = (Math.PI / 4) * Math.pow(disNozzle.id / 1000, 2);
  const velDis  = Q_m3s / areaDis;

  try {
    // CORE CALCULATIONS

    // Suction Side
    const Hs = lll - zPump;
    const staticHeadBar = (rho * g * Hs) / 100000;
    const pSucA = vesselPressA + staticHeadBar - sucDp;
    const hSuc  = (pSucA * 100000) / (rho * g);

    const npsha      = hSuc - pVapM;
    const npshMargin = npsha - npshr;
    const vpSafetyMargin = npsha - pVapM;
    const npshRatio  = npshr > 0 ? npsha / npshr : 0;

    let npshRatioStatus = "";
    if (npshRatio < 1.0)       npshRatioStatus = "CRITICAL - CAVITATION";
    else if (npshRatio < 1.1)  npshRatioStatus = "RISKY - Monitor closely";
    else if (npshRatio < 1.5)  npshRatioStatus = "ACCEPTABLE";
    else                        npshRatioStatus = "GOOD - Safe margin";

    let cavText, cavType;
    if (npsha < npshr) {
      cavText = "CAVITATION RISK";
      cavType = "fail";
    } else if (npshMargin < npshMarginLimit) {
      cavText = "MARGINAL - Monitor";
      cavType = "warn";
    } else {
      cavText = "SAFE - NO CAVITATION";
      cavType = "ok";
    }

    // Discharge Side
    const staticDischBar   = (rho * g * zDisch) / 100000;
    const pDischG          = destA + staticDischBar + dischDp;
    const pDischA          = pDischG + pAtm;

    // Differential Head
    const pumpDp      = pDischA - pSucA;
    const diffHeadCal = (pumpDp * 100000) / (rho * g);

    // Shut-off
    const shutoffDp      = pumpDp * (1 + shutoffMargin / 100);
    const shutoffPressA  = pSucA + shutoffDp;
    const shutoffHeadCal = (shutoffPressA * 100000) / (rho * g);

    // Power
    const hydPower  = (pumpDp * designVolFlow) / 36;
    const bhp       = hydPower / (pumpEff / 100);
    const mhp       = bhp / (motorEff / 100);
    const motorSelKw = mhp * (1 + motorSf / 100);
    let stdMotorKw;
    if (pumpCorrections.motorPowerOverride !== null) {
      stdMotorKw = pumpCorrections.motorPowerOverride;
    } else {
      stdMotorKw = getStandardMotorSize(motorSelKw);
    }
    const stdMotorHp = stdMotorKw * 1.341;
    const motorLoading = stdMotorKw > 0 ? (bhp / stdMotorKw) * 100 : 0;

    let motorStatus = "";
    if (motorLoading < 20)       motorStatus = "OVERSIZED - Review";
    else if (motorLoading < 75)  motorStatus = "NORMAL LOADING";
    else if (motorLoading < 90)  motorStatus = "GOOD LOADING";
    else if (motorLoading < 100) motorStatus = "HIGH - Monitor";
    else                          motorStatus = "OVERLOADED - Upsize";

    // Nozzle ratio
    const nozzleSizRatio = sucNozzle.id > 0 ? disNozzle.id / sucNozzle.id : 0;
    let nozzleStatus = "";
    if (nozzleSizRatio > 2.0)       nozzleStatus = "RATIO HIGH - Review";
    else if (nozzleSizRatio < 1.0)  nozzleStatus = "RATIO LOW - Check";
    else                             nozzleStatus = "RATIO OK";

    const sucNozzlePress = pSucA;
    const disNozzlePress = pDischA;

    // --- MOTOR OVERSIZING CHECK CALCULATIONS ---
    const checkSucSelect = document.getElementById("pump-check-suc-nozzle-select");
    const checkDisSelect = document.getElementById("pump-check-dis-nozzle-select");

    let checkSucId = checkSucSelect ? (parseFloat(checkSucSelect.value) || 77.9) : 77.9;
    let checkDisId = checkDisSelect ? (parseFloat(checkDisSelect.value) || 52.5) : 52.5;

    // Enforce: discharge nozzle ID always strictly less than of suction ID
    if (checkDisId >= checkSucId) {
      const sucIdx = STANDARD_NOZZLES.findIndex(n => Math.abs(n.id - checkSucId) < 0.1);
      const disIdx = STANDARD_NOZZLES.findIndex(n => Math.abs(n.id - checkDisId) < 0.1);
      
      if (disIdx >= sucIdx) {
        if (sucIdx > 0) {
          checkDisId = STANDARD_NOZZLES[sucIdx - 1].id;
          if (checkDisSelect) checkDisSelect.value = checkDisId;
        } else {
          checkSucId = STANDARD_NOZZLES[1].id;
          checkDisId = STANDARD_NOZZLES[0].id;
          if (checkSucSelect) checkSucSelect.value = checkSucId;
          if (checkDisSelect) checkDisSelect.value = checkDisId;
        }
      }
    }

    // Now calculate velocities based on the nozzle IDs!
    const q_m3s = designVolFlow / 3600;
    const checkSucArea = (Math.PI / 4) * Math.pow(checkSucId / 1000, 2);
    const vs = checkSucArea > 0 ? q_m3s / checkSucArea : 0;

    const checkDisArea = (Math.PI / 4) * Math.pow(checkDisId / 1000, 2);
    const vd = checkDisArea > 0 ? q_m3s / checkDisArea : 0;

    // Motor loading & status check
    const motorLoadingCheck = stdMotorKw > 0 ? (bhp / stdMotorKw) * 100 : 0;

    // Auto-tune low motor loading if active
    const autotuneSelect = document.getElementById("pump-check-autotune-select");
    const autotuneVal = autotuneSelect ? autotuneSelect.value : "none";

    if (motorLoadingCheck < 20 && autotuneVal !== "none" && !window.isApplyingAutotune) {
      window.isApplyingAutotune = true;
      try {
        const targetLoad = 20;
        const bhp_req = (targetLoad / 100) * stdMotorKw;
        
        if (autotuneVal === "flowrate") {
          if (pumpDp > 0) {
            const hyd_req = bhp_req * (pumpEff / 100);
            const Q_req_m3hr = (hyd_req * 36) / pumpDp;
            const flow_req_m3hr = Q_req_m3hr / (1 + margin / 100);
            if (flow_req_m3hr > 0 && flow_req_m3hr < 5000) {
              const flowInput = document.getElementById("pump-flow-m3hr");
              if (flowInput) {
                flowInput.value = flow_req_m3hr.toFixed(2);
                flowInput.dispatchEvent(new Event("change"));
                return; // Abort stale run
              }
            }
          }
        } else if (autotuneVal === "head") {
          if (designVolFlow > 0) {
            const hyd_req = bhp_req * (pumpEff / 100);
            const pumpDp_req = (hyd_req * 36) / designVolFlow;
            const pDischA_req = pSucA + pumpDp_req;
            const zDisch_req = ((pDischA_req - destA - dischDp) * 100000) / (rho * g) + zPump;
            if (zDisch_req > 0 && zDisch_req < 1000) {
              const elInput = document.getElementById("pump-discharge-el");
              if (elInput) {
                elInput.value = zDisch_req.toFixed(2);
                elInput.dispatchEvent(new Event("change"));
                return; // Abort stale run
              }
            }
          }
        } else if (autotuneVal === "efficiency") {
          if (bhp_req > 0) {
            const eff_req = (hydPower / bhp_req) * 100;
            if (eff_req > 5 && eff_req < 95) {
              const effInput = document.getElementById("pump-eff-override");
              if (effInput) {
                effInput.value = eff_req.toFixed(1);
                effInput.dispatchEvent(new Event("change"));
                return; // Abort stale run
              }
            }
          }
        }
      } finally {
        window.isApplyingAutotune = false;
      }
    }

    let motorStatusCheck = "";
    if (motorLoadingCheck < 20) {
      motorStatusCheck = "OVERSIZED";
    } else if (motorLoadingCheck < 50) {
      motorStatusCheck = "ACCEPTABLE";
    } else if (motorLoadingCheck <= 90) {
      motorStatusCheck = "GOOD";
    } else {
      motorStatusCheck = "REVIEW";
    }

    let motorRecommendCheck = "";
    if (motorLoadingCheck < 20) {
      motorRecommendCheck = "SELECT SMALLER MOTOR";
    } else if (motorLoadingCheck < 50) {
      motorRecommendCheck = "ACCEPTABLE - CHECK SMALLER MOTOR";
    } else if (motorLoadingCheck <= 90) {
      motorRecommendCheck = "NO CHANGE REQUIRED";
    } else {
      motorRecommendCheck = "SELECT LARGER MOTOR";
    }

    const checkSucNozzleObj = STANDARD_NOZZLES.find(n => Math.abs(n.id - checkSucId) < 0.1) || STANDARD_NOZZLES[5];
    const checkDisNozzleObj = STANDARD_NOZZLES.find(n => Math.abs(n.id - checkDisId) < 0.1) || STANDARD_NOZZLES[4];

    const d_suction_mm = checkSucNozzleObj.id;
    const d_discharge_mm = checkDisNozzleObj.id;
    const areaCheckSuc = (Math.PI / 4) * Math.pow(d_suction_mm / 1000, 2);
    const areaCheckDis = (Math.PI / 4) * Math.pow(d_discharge_mm / 1000, 2);
    const velCheckSuc = Q_m3s / areaCheckSuc;
    const velCheckDis = Q_m3s / areaCheckDis;

    const getNBFromNPS = (nps) => {
      if (nps === '1/2"') return 15;
      if (nps === '3/4"') return 20;
      if (nps === '1"') return 25;
      if (nps === '1½"') return 40;
      if (nps === '2"') return 50;
      if (nps === '3"') return 80;
      if (nps === '4"') return 100;
      if (nps === '6"') return 150;
      if (nps === '8"') return 200;
      if (nps === '10"') return 250;
      if (nps === '12"') return 300;
      return parseInt(nps) * 25 || 150;
    };

    const nb_suction = getNBFromNPS(checkSucNozzleObj.nps);
    const nb_discharge = getNBFromNPS(checkDisNozzleObj.nps);

    const nozzleRatioCheck = d_discharge_mm > 0 ? (d_suction_mm / d_discharge_mm) : 0;

    let nozzleStatusCheck = "";
    if (nozzleRatioCheck < 1) {
      nozzleStatusCheck = "REVIEW - SUCTION NOZZLE SMALLER THAN DISCHARGE";
    } else if (Math.abs(nozzleRatioCheck - 1) < 1e-9) {
      nozzleStatusCheck = "SAME SIZE NOZZLES - ACCEPTABLE FOR SMALL PUMPS";
    } else if (nozzleRatioCheck > 1 && nozzleRatioCheck < 1.2) {
      nozzleStatusCheck = "GOOD";
    } else if (nozzleRatioCheck >= 1.2 && nozzleRatioCheck <= 2.0) {
      nozzleStatusCheck = "VERY GOOD";
    } else {
      nozzleStatusCheck = "CHECK VELOCITY SELECTION";
    }

    // SAVE STATE
    window.state = window.state || {};
    window.state.pump = window.state.pump || {};
    window.state.pump.calculated = true;
    var pumpOutSec = document.getElementById('pump-output-section');
    if (pumpOutSec) pumpOutSec.style.display = 'flex';
    window.state.pump.inputs = {
      pumpTag, pumpOpCount, fluidVal: fluidName, fluidKey: fluidVal,
      tempMinC, tempNormC, tempMaxC, rho, mu, pVapBarA,
      tempMin: window.getInputValueSI ? window.getInputValueSI("pump-temp-min") : tempMinC,
      tempNorm: window.getInputValueSI ? window.getInputValueSI("pump-temp-norm") : tempNormC,
      tempMax: window.getInputValueSI ? window.getInputValueSI("pump-temp-max") : tempMaxC,
      volFlowLhr, volFlowM3hr, margin, designVolFlow,
      normalVolFlow: volFlowM3hr,
      vesselPressG, vesselPressA, pAtm, zVessel, lll, lllPercent, vesselHeight, zPump,
      sucDp, npshr, npshMarginLimit,
      destA, zDisch, dischDp, shutoffMargin,
      pumpEff, motorEff, motorSf, targetSucVel, targetDisVel,
      sucSourceType, density: rho
    };
    window.state.pump.results = {
      pVapBarA, pVapM, vesselPressA, Hs, staticHeadBar, pSucA, hSuc, pNet: pSucA,
      npsha, npshMargin, vpSafetyMargin, npshRatio, npshRatioStatus,
      cavText, cavType, pDischG, pDischA, pumpDp, diffHeadCal,
      shutoffPressA, shutoffHeadCal, designVolFlow, hydPower, pumpEff,
      bhp, motorEff, mhp, motorSf, motorSelKw, stdMotorKw, stdMotorHp,
      motorLoading, motorStatus, sucNozzle, disNozzle, velSuc, velDis,
      nozzleSizRatio, nozzleStatus, sucNozzlePress, disNozzlePress,
      motorLoadingCheck, motorStatusCheck, motorRecommendCheck,
      vs, vd, d_suction_mm, nb_suction, d_discharge_mm, nb_discharge,
      nozzleRatioCheck, nozzleStatusCheck,
      checkSucNozzle: checkSucNozzleObj, checkDisNozzle: checkDisNozzleObj,
      velCheckSuc, velCheckDis
    };

    // UI OUTPUT BINDINGS
    const setTxt = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    const setVal = (id, val, ut, dp) => { if (typeof window.setOutputValue === 'function') window.setOutputValue(id, val, ut, dp); };
    const fmt    = (val, ut, dp) => { if (typeof window.formatUnit === 'function') return window.formatUnit(val, ut, dp); return { value: val.toFixed(dp || 2), symbol: '' }; };

    // Identification
    setTxt("out-pump-tag", pumpTag);
    setTxt("out-pump-operating-count", pumpOpCount);
    setTxt("out-pump-fluid", fluidName);

    // Suction Side
    setVal("out-pump-vp-bara", pVapBarA, "pressure", 4);
    setVal("out-pump-vp-m", pVapM, "length-m", 4);
    setVal("out-pump-vessel-press-a", vesselPressA, "pressure", 4);
    setVal("out-pump-static-head-suc", Hs, "length-m", 4);
    setVal("out-pump-net-suc-press", pSucA, "pressure", 4);
    setVal("out-pump-head-suc", hSuc, "length-m", 4);
    setVal("out-pump-npsha", npsha, "length-m", 4);
    setVal("out-pump-npshr-val", npshr, "length-m", 2);
    setVal("out-pump-npsh-margin", npshMargin, "length-m", 4);
    setVal("out-pump-vp-margin", vpSafetyMargin, "length-m", 4);
    setTxt("out-pump-npsh-ratio", npshRatio.toFixed(4)); // dimensionless
    setTxt("out-pump-npsh-ratio-status", npshRatioStatus);

    const outCavStatus = document.getElementById("out-pump-cavitation-status");
    if (outCavStatus) {
      outCavStatus.textContent = cavText;
      outCavStatus.style.color = cavType === "ok" ? "var(--color-green)" : (cavType === "warn" ? "var(--color-saffron)" : "var(--color-red)");
    }

    // NPSH Compliance panel duplicates
    setVal("out-pump-npsha-display", npsha, "length-m", 2);
    setVal("out-pump-npshr-display", npshr, "length-m", 2);
    setVal("out-pump-margin-display", npshMargin, "length-m", 2);
    setTxt("out-pump-ratio-display", npshRatio.toFixed(2));
    setTxt("out-pump-ratio-status-display", npshRatioStatus);
    const cavDisp = document.getElementById("out-pump-cavitation-display");
    if (cavDisp) {
      cavDisp.textContent = cavText;
      cavDisp.style.color = cavType === "ok" ? "var(--color-green)" : (cavType === "warn" ? "var(--color-saffron)" : "var(--color-red)");
    }
    const cavCardDisp = document.getElementById("card-cavitation-display");
    if (cavCardDisp) cavCardDisp.style.background = cavType === "ok" ? "rgba(74,222,128,0.08)" : (cavType === "warn" ? "rgba(245,158,11,0.08)" : "rgba(239,68,68,0.08)");

    // Discharge
    setVal("out-pump-disch-press-g", pDischG, "pressure", 4);
    setVal("out-pump-disch-press-a", pDischA, "pressure", 4);

    // Differential Head
    setVal("out-pump-diff-press", pumpDp, "pressure", 4);
    setVal("out-pump-diff-head-val", diffHeadCal, "length-m", 4);
    setVal("out-pump-shutoff-press", shutoffPressA, "pressure", 4);
    setVal("out-pump-shutoff-head", shutoffHeadCal, "length-m", 2);

    // Power
    setVal("out-pump-design-flow", designVolFlow, "vol-flow", 4);
    setVal("out-pump-hyd-power", hydPower, "power", 4);
    setTxt("out-pump-eff-out", pumpEff.toFixed(1));
    setVal("out-pump-bhp", bhp, "power", 4);
    setTxt("out-pump-meff-out", motorEff.toFixed(1));
    setVal("out-pump-mhp", mhp, "power", 4);
    setTxt("out-pump-sf-out", motorSf.toFixed(0));
    setVal("out-pump-motor-kw", motorSelKw, "power", 4);
    setVal("out-pump-std-motor-kw", stdMotorKw, "power", 2);
    setVal("out-pump-std-motor-hp", stdMotorHp, "power", 2);
    setTxt("out-pump-motor-loading", motorLoading.toFixed(1));
    // Enhanced Motor Loading card
    const motorLoadingDisplay = document.getElementById("out-pump-motor-loading-display");
    const motorLoadingBar = document.getElementById("motor-loading-bar");
    const motorStatusEl = document.getElementById("out-pump-motor-status");
    let mlColor, mlBg;
    if (motorLoading > 100)      { mlColor = "#f87171"; mlBg = "rgba(239,68,68,0.15)"; }
    else if (motorLoading > 90)  { mlColor = "#f59e0b"; mlBg = "rgba(245,158,11,0.15)"; }
    else if (motorLoading > 75)  { mlColor = "#a78bfa"; mlBg = "rgba(139,92,246,0.15)"; }
    else if (motorLoading < 20)  { mlColor = "#f59e0b"; mlBg = "rgba(245,158,11,0.10)"; }
    else                          { mlColor = "#34d399"; mlBg = "rgba(52,211,153,0.12)"; }
    if (motorLoadingDisplay) {
      motorLoadingDisplay.textContent = motorLoading.toFixed(1) + "%";
      motorLoadingDisplay.style.color = mlColor;
    }
    if (motorLoadingBar) {
      motorLoadingBar.style.width = Math.min(motorLoading, 100) + "%";
      motorLoadingBar.style.background = mlBg;
    }
    if (motorStatusEl) {
      motorStatusEl.textContent = motorStatus;
      motorStatusEl.style.color = mlColor;
    }
    const cardMotorLoading = document.getElementById("card-motor-loading");
    if (cardMotorLoading) cardMotorLoading.style.borderColor = mlColor;

    // Nozzle
    if (sucNozzle) setTxt("out-pump-suc-nozzle", "NPS " + sucNozzle.nps);
    setTxt("out-pump-nozzle-suc-id", sucNozzle ? sucNozzle.id.toFixed(1) : "-");
    setVal("out-pump-suc-vel", velSuc, "velocity", 3);
    setVal("out-pump-suc-nozzle-press", pSucA, "pressure", 4);
    if (disNozzle) setTxt("out-pump-dis-nozzle", "NPS " + disNozzle.nps);
    setTxt("out-pump-nozzle-dis-id", disNozzle ? disNozzle.id.toFixed(1) : "-");
    setVal("out-pump-dis-vel", velDis, "velocity", 3);
    setVal("out-pump-dis-nozzle-press", pDischA, "pressure", 4);
    setTxt("out-pump-nozzle-ratio", nozzleSizRatio.toFixed(3));
    setTxt("out-pump-nozzle-status", nozzleStatus);

    // Old nozzle IDs for backwards-compat
    setVal("out-pump-nozzle-suc-vel", velSuc, "velocity", 3);
    setVal("out-pump-nozzle-dis-vel", velDis, "velocity", 3);
    setTxt("out-pump-suc-nozzle", sucNozzle ? "NPS " + sucNozzle.nps + " (" + sucNozzle.id + " mm)" : "-");
    setTxt("out-pump-dis-nozzle", disNozzle ? "NPS " + disNozzle.nps + " (" + disNozzle.id + " mm)" : "-");

    // Helper for Badge Class
    function getBadgeClass(statusStr) {
      const greenStates = ["GOOD", "NO CHANGE REQUIRED", "VERY GOOD", "SAME SIZE NOZZLES - ACCEPTABLE FOR SMALL PUMPS"];
      const amberStates = ["ACCEPTABLE", "ACCEPTABLE - CHECK SMALLER MOTOR"];
      const redStates = ["OVERSIZED", "SELECT SMALLER MOTOR", "REVIEW", "SELECT LARGER MOTOR", "CHECK VELOCITY SELECTION", "REVIEW - SUCTION NOZZLE SMALLER THAN DISCHARGE"];
      
      if (greenStates.includes(statusStr)) {
        return "badge badge-teal";
      } else if (amberStates.includes(statusStr)) {
        return "badge badge-amber";
      } else if (redStates.includes(statusStr)) {
        return "badge badge-red";
      }
      return "badge";
    }

    // Motor Oversizing Check output bindings
    setTxt("out-pump-check-motor-loading", motorLoadingCheck.toFixed(2));
    
    const motorStatusCheckEl = document.getElementById("out-pump-check-motor-status");
    if (motorStatusCheckEl) {
      motorStatusCheckEl.textContent = motorStatusCheck;
      motorStatusCheckEl.className = getBadgeClass(motorStatusCheck);
    }
    
    const motorRecommendCheckEl = document.getElementById("out-pump-check-motor-recommend");
    if (motorRecommendCheckEl) {
      motorRecommendCheckEl.textContent = motorRecommendCheck;
      motorRecommendCheckEl.className = getBadgeClass(motorRecommendCheck);
    }
    
    setVal("out-pump-check-suc-vel", vs, "velocity", 3);
    setVal("out-pump-check-dis-vel", vd, "velocity", 3);
    setVal("out-pump-check-suc-nozzle-mm", d_suction_mm, "length-mm", 2);
    setTxt("out-pump-check-suc-nozzle-nb", nb_suction);
    setVal("out-pump-check-dis-nozzle-mm", d_discharge_mm, "length-mm", 2);
    setTxt("out-pump-check-dis-nozzle-nb", nb_discharge);
    setTxt("out-pump-check-nozzle-ratio", nozzleRatioCheck.toFixed(3));
    
    const nozzleStatusCheckEl = document.getElementById("out-pump-check-nozzle-status");
    if (nozzleStatusCheckEl) {
      nozzleStatusCheckEl.textContent = nozzleStatusCheck;
      nozzleStatusCheckEl.className = getBadgeClass(nozzleStatusCheck);
    }

    // Summary Box
    setTxt("sum-pump-fluid", fluidName);
    var fmtFlow = fmt(designVolFlow, "vol-flow", 4);
    setTxt("sum-pump-flow", fmtFlow.value + " " + fmtFlow.symbol);
    const fmtHead = fmt(diffHeadCal, "length-m", 4);
    setTxt("sum-pump-head", fmtHead.value + " " + fmtHead.symbol);
    const fmtDP = fmt(pumpDp, "pressure", 4);
    setTxt("sum-pump-dp", fmtDP.value + " " + fmtDP.symbol);
    const fmtNpsha = fmt(npsha, "length-m", 4);
    const fmtMarginV = fmt(npshMargin, "length-m", 4);
    setTxt("sum-pump-npsh", fmtNpsha.value + " / " + fmtMarginV.value + " " + fmtNpsha.symbol);
    setTxt("sum-pump-cav", cavText);
    const sumCavEl = document.getElementById("sum-pump-cav");
    if (sumCavEl) sumCavEl.style.color = cavType === "ok" ? "#4ade80" : (cavType === "warn" ? "#f59e0b" : "#f87171");
    const fmtBhp = fmt(bhp, "power", 4);
    setTxt("sum-pump-bhp", fmtBhp.value + " " + fmtBhp.symbol);
    setTxt("sum-pump-motor-loading", motorLoading.toFixed(1) + "%");
    const fmtMot = fmt(stdMotorKw, "power", 2);
    setTxt("sum-pump-motor", fmtMot.value + " " + fmtMot.symbol);
    setTxt("sum-pump-suc-nozzle", "Auto: NPS " + sucNozzle.nps + '" | Selected: NPS ' + checkSucNozzleObj.nps + '" (ID ' + checkSucNozzleObj.id.toFixed(1) + ' mm)');
    setTxt("sum-pump-dis-nozzle", "Auto: NPS " + disNozzle.nps + '" | Selected: NPS ' + checkDisNozzleObj.nps + '" (ID ' + checkDisNozzleObj.id.toFixed(1) + ' mm)');
    var fmtSucVel = fmt(velSuc, "velocity", 3);
    var fmtDisVel = fmt(velDis, "velocity", 3);
    var fmtCheckSucVel = fmt(velCheckSuc, "velocity", 3);
    var fmtCheckDisVel = fmt(velCheckDis, "velocity", 3);
    setTxt("sum-pump-suc-vel", "Auto: " + fmtSucVel.value + " | Selected: " + fmtCheckSucVel.value + " " + fmtCheckSucVel.symbol);
    setTxt("sum-pump-dis-vel", "Auto: " + fmtDisVel.value + " | Selected: " + fmtCheckDisVel.value + " " + fmtCheckDisVel.symbol);
    const pAtmForSum = pAtm || 1.01325;
    var fmtSucP = fmt(pSucA - pAtmForSum, "pressure", 4);
    var fmtDisP = fmt(pDischA - pAtmForSum, "pressure", 4);
    setTxt("sum-pump-suc-press", fmtSucP.value + " " + fmtSucP.symbol + "(g)");
    setTxt("sum-pump-dis-press", fmtDisP.value + " " + fmtDisP.symbol + "(g)");

    // Status banner
    const statusBanner = document.querySelector("#pump-results .status-banner");
    if (statusBanner) {
      statusBanner.className = "status-banner";
      const bannerMsg = statusBanner.querySelector(".banner-message");
      if (cavType === "ok") {
        statusBanner.classList.add("banner-teal");
        if (bannerMsg) bannerMsg.textContent = "STABLE - NO CAVITATION. NPSHa: " + fmtNpsha.value + " " + fmtNpsha.symbol + " | Motor: " + stdMotorKw.toFixed(2) + " kW";
      } else if (cavType === "warn") {
        statusBanner.classList.add("banner-amber");
        if (bannerMsg) bannerMsg.textContent = "WARNING - NPSH MARGIN BELOW LIMIT. Margin: " + fmtMarginV.value + " " + fmtMarginV.symbol;
      } else {
        statusBanner.classList.add("banner-red");
        if (bannerMsg) bannerMsg.textContent = "CAVITATION RISK - NPSHa (" + fmtNpsha.value + ") < NPSHr (" + npshr.toFixed(2) + ") " + fmtNpsha.symbol;
      }
    }

    // Cavitation card
    const cavCard = document.getElementById("card-cavitation");
    if (cavCard) {
      cavCard.className = "pump-res-card highlight-card cav-status-card";
      if (cavType === "ok") cavCard.classList.add("status-ok");
      else if (cavType === "warn") cavCard.classList.add("status-warn");
      else cavCard.classList.add("status-fail");
    }

    // Mini gauges
    const npshArc = document.getElementById("gauge-arc-npsh");
    const npshValG = document.getElementById("gauge-val-npsh");
    if (npshArc && npshValG) {
      const p = Math.min((npsha / Math.max(npshr * 2, 0.1)) * 100, 100);
      npshArc.style.strokeDashoffset = 125 - (125 * p / 100);
      npshValG.textContent = npsha.toFixed(1);
      npshArc.style.stroke = cavType === "ok" ? "var(--color-green)" : (cavType === "warn" ? "var(--color-saffron)" : "var(--color-red)");
    }
    const velArc = document.getElementById("gauge-arc-vel");
    const velValEl = document.getElementById("gauge-val-vel");
    if (velArc && velValEl) {
      const vp = Math.min((velSuc / (targetSucVel * 2)) * 100, 100);
      velArc.style.strokeDashoffset = 125 - (125 * vp / 100);
      velValEl.textContent = velSuc.toFixed(1);
      velArc.style.stroke = (velSuc < targetSucVel * 0.5 || velSuc > targetSucVel * 2) ? "var(--color-saffron)" : "var(--color-green)";
    }
    const motorArc = document.getElementById("gauge-arc-motor");
    const motorValEl = document.getElementById("gauge-val-motor");
    if (motorArc && motorValEl) {
      const mp = Math.min(motorLoading, 100);
      motorArc.style.strokeDashoffset = 125 - (125 * mp / 100);
      motorValEl.textContent = mp.toFixed(0) + "%";
      motorArc.style.stroke = motorLoading > 95 ? "var(--color-red)" : (motorLoading > 85 ? "var(--color-saffron)" : "#3b82f6");
    }

    // Ticker / Pills
    if (document.getElementById("tick-q"))     document.getElementById("tick-q").textContent = designVolFlow.toFixed(3);
    if (document.getElementById("tick-h"))     document.getElementById("tick-h").textContent = diffHeadCal.toFixed(2);
    if (document.getElementById("tick-npsha")) document.getElementById("tick-npsha").textContent = npsha.toFixed(4);
    if (document.getElementById("tick-bhp"))   document.getElementById("tick-bhp").textContent = bhp.toFixed(4);
    if (document.getElementById("tick-motor")) document.getElementById("tick-motor").textContent = stdMotorKw.toFixed(2);
    if (document.getElementById("tick-dp"))    document.getElementById("tick-dp").textContent = pumpDp.toFixed(4);
    if (document.getElementById("tick-eff"))   document.getElementById("tick-eff").textContent = pumpEff.toFixed(1);
    if (document.getElementById("pill-h"))     document.getElementById("pill-h").textContent = diffHeadCal.toFixed(2);
    if (document.getElementById("pill-bhp"))   document.getElementById("pill-bhp").textContent = bhp.toFixed(4);
    if (document.getElementById("pill-motor")) document.getElementById("pill-motor").textContent = stdMotorKw.toFixed(2);
    if (document.getElementById("pill-status")) {
      const pillSt = document.getElementById("pill-status");
      if (cavType === "ok") { pillSt.innerHTML = "Status: &#10003;"; pillSt.style.color = "var(--color-green)"; }
      else if (cavType === "warn") { pillSt.innerHTML = "Status: &#9888;"; pillSt.style.color = "var(--color-saffron)"; }
      else { pillSt.innerHTML = "Status: &#10007;"; pillSt.style.color = "var(--color-red)"; }
    }

    if (document.getElementById("badge-q"))     document.getElementById("badge-q").textContent = designVolFlow.toFixed(3);
    if (document.getElementById("badge-h"))     document.getElementById("badge-h").textContent = diffHeadCal.toFixed(2);
    if (document.getElementById("badge-npsha")) document.getElementById("badge-npsha").textContent = npsha.toFixed(2);
    if (document.getElementById("badge-bhp"))   document.getElementById("badge-bhp").textContent = bhp.toFixed(2);
    if (document.getElementById("badge-motor")) document.getElementById("badge-motor").textContent = stdMotorKw.toFixed(2);
    if (document.getElementById("badge-dp"))    document.getElementById("badge-dp").textContent = pumpDp.toFixed(4);
    if (document.getElementById("badge-eff"))   document.getElementById("badge-eff").textContent = pumpEff.toFixed(1);

    // Legacy labels
    const formattedNpsha2 = fmt(npsha, 'length-m', 4);
    const formattedNpshr2 = fmt(npshr, 'length-m', 2);
    setTxt("lbl-npshr", formattedNpshr2.value + " " + formattedNpshr2.symbol);
    setTxt("lbl-npsha", formattedNpsha2.value + " " + formattedNpsha2.symbol);

    // NPSH gauge bar (legacy)
    const maxVal = Math.max(npshr * 2.5, npsha * 1.2, 5.0);
    const npshaPercent = Math.min((npsha / maxVal) * 100, 100);
    const gaugeBar = document.getElementById("gauge-bar");
    if (gaugeBar) {
      gaugeBar.style.width = npshaPercent + "%";
      gaugeBar.className = "gauge-bar";
      if (cavType === "ok") gaugeBar.classList.add("bg-teal");
      else if (cavType === "warn") gaugeBar.classList.add("bg-amber");
      else gaugeBar.classList.add("bg-red");
    }
    const markerNpshr = document.getElementById("gauge-marker-npshr");
    if (markerNpshr) { markerNpshr.style.display = ""; markerNpshr.style.left = Math.min((npshr / maxVal) * 100, 100) + "%"; }
    const markerMargin = document.getElementById("gauge-marker-margin");
    if (markerMargin) { markerMargin.style.display = ""; markerMargin.style.left = Math.min(((npshr + npshMarginLimit) / maxVal) * 100, 100) + "%"; }

    // Auto-highlight efficiency rows
    if (bhp > 0 && isNaN(peffOverride)) {
      const pRadios = document.querySelectorAll('input[name="peff-radio"]');
      let targetIdx = 1;
      if (bhp < 1)        targetIdx = 0;
      else if (bhp < 5)   targetIdx = 1;
      else if (bhp < 20)  targetIdx = 2;
      else if (bhp < 100) targetIdx = 3;
      else if (bhp < 500) targetIdx = 4;
      else                targetIdx = 5;
      const currentPIdx = parseInt(document.querySelector('input[name="peff-radio"]:checked')?.value || "6");
      if (currentPIdx < 6) {
        if (pRadios[targetIdx]) pRadios[targetIdx].checked = true;
      }
    }
    if (stdMotorKw > 0 && isNaN(meffOverride)) {
      const mRadios = document.querySelectorAll('input[name="meff-radio"]');
      let targetMIdx = 0;
      if (stdMotorKw < 5)        targetMIdx = 0;
      else if (stdMotorKw < 20)  targetMIdx = 1;
      else if (stdMotorKw <= 50) targetMIdx = 2;
      else if (stdMotorKw <= 200)targetMIdx = 3;
      else                        targetMIdx = 4;
      if (mRadios[targetMIdx]) mRadios[targetMIdx].checked = true;
    }

    // Visual styling for active efficiency rows
    document.querySelectorAll('input[name="peff-radio"]').forEach(rad => {
      const r = rad.closest('.eff-row');
      if (!r) return;
      if (rad.checked) {
        r.classList.add('active-eff-row');
        r.style.background = '#0a2a0a';
        r.style.borderLeft = '3px solid #f59e0b';
        const nm = r.querySelector('.eff-name'); if (nm) nm.style.color = '#f59e0b';
      } else {
        r.classList.remove('active-eff-row');
        r.style.background = r.classList.contains('bg-alt') ? '#071007' : 'transparent';
        r.style.borderLeft = 'none';
        const nm = r.querySelector('.eff-name'); if (nm) nm.style.color = '';
      }
    });
    document.querySelectorAll('input[name="meff-radio"]').forEach(rad => {
      const r = rad.closest('.eff-row');
      if (!r) return;
      if (rad.checked) {
        r.classList.add('active-eff-row');
        r.style.background = '#0a2a0a';
        r.style.borderLeft = '3px solid #f59e0b';
        const nm = r.querySelector('.eff-name'); if (nm) nm.style.color = '#f59e0b';
      } else {
        r.classList.remove('active-eff-row');
        r.style.background = r.classList.contains('bg-alt') ? '#071007' : 'transparent';
        r.style.borderLeft = 'none';
        const nm = r.querySelector('.eff-name'); if (nm) nm.style.color = '';
      }
    });

    // 3D dynamic update from calculation results
    if (typeof updatePump3DFromResults === 'function') {
      updatePump3DFromResults();
    }

    // Pump curves
    if (typeof drawPumpChart === 'function') {
      drawPumpChart(designVolFlow, diffHeadCal, Math.max(0, Hs));
    }
    if (typeof drawPumpCharacteristicCurve === "function") {
      drawPumpCharacteristicCurve(designVolFlow, diffHeadCal, Math.max(0, Hs));
    }

    // DESIGN ASSISTANT SUGGESTIONS
    const assistantPanel = document.getElementById("pump-assistant-panel");
    const assistantContent = document.getElementById("pump-assistant-content");
    const applyAllWrapper = document.getElementById("pump-assistant-apply-all-wrapper");

    if (assistantPanel && assistantContent) {
      let suggestionsHtml = "";
      let activeViolationsCount = 0;

      const fmtVel = (v) => (window.activeUnitSystem === 'US') ? ((v * 3.28084).toFixed(2) + " ft/s") : (v.toFixed(2) + " m/s");
      const fmtID  = (mm) => (window.activeUnitSystem === 'US') ? ((mm / 25.4).toFixed(3) + " in") : (mm.toFixed(1) + " mm");

      // Check 1: NPSH Margin
      if (pumpCorrections.npshMarginApplied) {
        suggestionsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;margin-bottom:6px;border:1px solid var(--color-green);background:rgba(0,184,117,0.05);border-radius:var(--radius-sm);"><div style="color:var(--color-green);font-weight:500;">&#10003; CORRECTED: Vessel Elevation increased to satisfy NPSH margin.</div><span style="font-size:9px;font-weight:600;padding:2px 6px;background:var(--color-green);color:var(--color-black);border-radius:var(--radius-xs);">&#10003; CORRECTED</span></div>';
      } else if (npshMargin < npshMarginLimit) {
        activeViolationsCount++;
        const deficit = npshMarginLimit - npshMargin;
        suggestionsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;margin-bottom:6px;border:1px solid var(--color-saffron);background:rgba(255,117,56,0.05);border-radius:var(--radius-sm);"><div style="color:var(--text-main);flex:1;padding-right:var(--space-sm);">NPSH Margin deficit of ' + deficit.toFixed(2) + ' m. Increase Vessel Elevation or reduce Suction DP.</div><button type="button" class="apply-pump-correction btn" data-correction-type="npshMargin" style="font-size:9px;padding:3px 8px;font-family:var(--font-mono);font-weight:bold;border:1px solid var(--color-saffron);color:var(--color-saffron);background:transparent;cursor:pointer;">APPLY &#9889;</button></div>';
      }

      // Check 2: Suction velocity
      const isSucOut = velSuc < targetSucVel * 0.4 || velSuc > targetSucVel * 2.5;
      if (pumpCorrections.suctionNps !== null) {
        suggestionsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;margin-bottom:6px;border:1px solid var(--color-green);background:rgba(0,184,117,0.05);border-radius:var(--radius-sm);"><div style="color:var(--color-green);font-weight:500;">&#10003; CORRECTED: Suction nozzle NPS ' + sucNozzle.nps + ' (Velocity: ' + fmtVel(velSuc) + ').</div><span style="font-size:9px;font-weight:600;padding:2px 6px;background:var(--color-green);color:var(--color-black);border-radius:var(--radius-xs);">&#10003; CORRECTED</span></div>';
      } else if (isSucOut) {
        activeViolationsCount++;
        const recSuc = getNozzleForTargetVelocity(Q_m3s, targetSucVel);
        const aR = (Math.PI / 4) * Math.pow(recSuc.id / 1000, 2);
        const vR = Q_m3s / aR;
        suggestionsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;margin-bottom:6px;border:1px solid var(--color-saffron);background:rgba(255,117,56,0.05);border-radius:var(--radius-sm);"><div style="color:var(--text-main);flex:1;padding-right:var(--space-sm);">Suction velocity ' + fmtVel(velSuc) + ' outside target. Recommend NPS ' + recSuc.nps + ' (ID: ' + fmtID(recSuc.id) + ', Vel: ' + fmtVel(vR) + ').</div><button type="button" class="apply-pump-correction btn" data-correction-type="suctionVel" style="font-size:9px;padding:3px 8px;font-family:var(--font-mono);font-weight:bold;border:1px solid var(--color-saffron);color:var(--color-saffron);background:transparent;cursor:pointer;">APPLY &#9889;</button></div>';
      }

      // Check 3: Discharge velocity
      const isDisOut = velDis < targetDisVel * 0.4 || velDis > targetDisVel * 2.5;
      if (pumpCorrections.dischargeNps !== null) {
        suggestionsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;margin-bottom:6px;border:1px solid var(--color-green);background:rgba(0,184,117,0.05);border-radius:var(--radius-sm);"><div style="color:var(--color-green);font-weight:500;">&#10003; CORRECTED: Discharge nozzle NPS ' + disNozzle.nps + ' (Velocity: ' + fmtVel(velDis) + ').</div><span style="font-size:9px;font-weight:600;padding:2px 6px;background:var(--color-green);color:var(--color-black);border-radius:var(--radius-xs);">&#10003; CORRECTED</span></div>';
      } else if (isDisOut) {
        activeViolationsCount++;
        const recDis = getNozzleForTargetVelocity(Q_m3s, targetDisVel);
        const aR = (Math.PI / 4) * Math.pow(recDis.id / 1000, 2);
        const vR = Q_m3s / aR;
        suggestionsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;margin-bottom:6px;border:1px solid var(--color-saffron);background:rgba(255,117,56,0.05);border-radius:var(--radius-sm);"><div style="color:var(--text-main);flex:1;padding-right:var(--space-sm);">Discharge velocity ' + fmtVel(velDis) + ' outside target. Recommend NPS ' + recDis.nps + ' (ID: ' + fmtID(recDis.id) + ', Vel: ' + fmtVel(vR) + ').</div><button type="button" class="apply-pump-correction btn" data-correction-type="dischargeVel" style="font-size:9px;padding:3px 8px;font-family:var(--font-mono);font-weight:bold;border:1px solid var(--color-saffron);color:var(--color-saffron);background:transparent;cursor:pointer;">APPLY &#9889;</button></div>';
      }

      // Check 4: Motor oversized/underloaded
      const IEC_MOTOR_SIZES_KW = [0.06, 0.09, 0.12, 0.18, 0.25, 0.37, 0.55, 0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250, 315];
      const Preq = motorSelKw;
      const Pmotor = stdMotorKw;
      let optimalMotor = 0.06;
      for (let size of IEC_MOTOR_SIZES_KW) {
        if (size >= Preq) {
          optimalMotor = size;
          break;
        }
      }
      if (Preq > IEC_MOTOR_SIZES_KW[IEC_MOTOR_SIZES_KW.length - 1]) {
        optimalMotor = IEC_MOTOR_SIZES_KW[IEC_MOTOR_SIZES_KW.length - 1];
      }

      if (motorLoading < 40 && pumpCorrections.motorPowerOverride === null) {
        activeViolationsCount++;
        const optLoadOnOptimal = optimalMotor > 0 ? (bhp / optimalMotor) * 100 : 0;
        const targetBhp75 = Pmotor * 0.75;
        const flowFactor = bhp > 0 ? targetBhp75 / bhp : 1;
        const suggestedFlow = designVolFlow * flowFactor;

        let optMsg = 'Motor underloaded — loading ' + motorLoading.toFixed(1) + '% (&lt;40%). ';
        if (optimalMotor < Pmotor && optLoadOnOptimal >= 40 && optLoadOnOptimal <= 100) {
          optMsg += 'Recommend: select ' + optimalMotor.toFixed(2) + ' kW motor (&rarr;' + optLoadOnOptimal.toFixed(0) + '% load).';
        } else if (optimalMotor < Pmotor) {
          optMsg += 'Smaller motor (' + optimalMotor.toFixed(2) + ' kW) available, or increase flowrate to ~' + suggestedFlow.toFixed(0) + ' m³/hr for 75% load.';
        } else {
          optMsg += 'Already smallest motor. Increase flowrate to ~' + suggestedFlow.toFixed(0) + ' m³/hr for 75% load.';
        }
        suggestionsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;margin-bottom:6px;border:1px solid var(--color-saffron);background:rgba(255,117,56,0.05);border-radius:var(--radius-sm);"><div style="color:var(--text-main);flex:1;padding-right:var(--space-sm);">' + optMsg + '</div><button type="button" class="apply-pump-correction btn" data-correction-type="motorAutoOptimize" style="font-size:9px;padding:3px 8px;font-family:var(--font-mono);font-weight:bold;border:1px solid var(--color-saffron);color:var(--color-saffron);background:transparent;cursor:pointer;">AUTO-OPTIMIZE &#9889;</button></div>';

        if (optimalMotor >= Pmotor) {
          // Floor reached - also offer specific tips
          let extraTips = [];
          const targetLoad = 75;
          const bhp_req = (targetLoad / 100) * Pmotor;
          const hyd_req = bhp_req * (pumpEff / 100);
          if (pumpDp > 0) {
            const Q_req_m3hr = (hyd_req * 36) / pumpDp;
            const flow_req_m3hr = Q_req_m3hr / (1 + margin / 100);
            if (flow_req_m3hr > 0 && flow_req_m3hr < 50000) {
              extraTips.push('<button type="button" class="apply-pump-correction btn" style="font-size:9px;padding:3px 8px;font-family:var(--font-mono);font-weight:bold;border:1px solid var(--color-saffron);color:var(--color-saffron);background:transparent;cursor:pointer;margin-right:4px;margin-top:4px;" onclick="window.tunePumpInput(\'pump-vol-flow-lhr\', ' + (flow_req_m3hr * 1000).toFixed(0) + ')">Increase Flow to ' + (flow_req_m3hr * 1000).toFixed(0) + ' l/hr ⚡</button>');
            }
          }
          
          // 2. Discharge elevation adjustment
          if (designVolFlow > 0) {
            const pumpDp_req = (hyd_req * 36) / designVolFlow;
            const pDischA_req = pSucA + pumpDp_req;
            const zDisch_req = ((pDischA_req - destA - dischDp) * 100000) / (rho * g) + zPump;
            if (zDisch_req > 0 && zDisch_req < 1000) {
              extraTips.push('<button type="button" class="apply-pump-correction btn" style="font-size:9px;padding:3px 8px;font-family:var(--font-mono);font-weight:bold;border:1px solid var(--color-saffron);color:var(--color-saffron);background:transparent;cursor:pointer;margin-right:4px;margin-top:4px;" onclick="window.tunePumpInput(\'pump-discharge-el\', ' + zDisch_req.toFixed(2) + ')">Increase Discharge El to ' + zDisch_req.toFixed(2) + ' m ⚡</button>');
            }
          }
          if (bhp_req > 0) {
            const eff_req = (hydPower / bhp_req) * 100;
            if (eff_req > 5 && eff_req < 95) {
              extraTips.push('<button type="button" class="apply-pump-correction btn" style="font-size:9px;padding:3px 8px;font-family:var(--font-mono);font-weight:bold;border:1px solid var(--color-saffron);color:var(--color-saffron);background:transparent;cursor:pointer;margin-right:4px;margin-top:4px;" onclick="window.tunePumpInput(\'pump-eff-override\', ' + eff_req.toFixed(1) + ')">Set Pump Eff to ' + eff_req.toFixed(1) + '% ⚡</button>');
            }
          }
          if (extraTips.length > 0) {
            suggestionsHtml += '<div style="padding:6px 8px;margin-bottom:6px;border:1px dashed rgba(255,117,56,0.3);border-radius:var(--radius-sm);"><div style="color:var(--text-muted);font-size:9px;margin-bottom:4px;">Alternative adjustments to reach 75% loading:</div>' + extraTips.join(' ') + '</div>';
          }
        }
      } else if (pumpCorrections.motorPowerOverride !== null) {
        suggestionsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;margin-bottom:6px;border:1px solid var(--color-green);background:rgba(0,184,117,0.05);border-radius:var(--radius-sm);"><div style="color:var(--color-green);font-weight:500;">&#10003; CORRECTED: Motor optimized to ' + stdMotorKw.toFixed(2) + ' kW (loading ' + motorLoading.toFixed(1) + '%).</div><span style="font-size:9px;font-weight:600;padding:2px 6px;background:var(--color-green);color:var(--color-black);border-radius:var(--radius-xs);">&#10003; CORRECTED</span></div>';
      } else if (motorLoading > 100) {
        activeViolationsCount++;
        suggestionsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;margin-bottom:6px;border:1px solid var(--color-red);background:rgba(239,68,68,0.05);border-radius:var(--radius-sm);"><div style="color:var(--text-main);flex:1;padding-right:var(--space-sm);">Motor OVERLOADED — loading ' + motorLoading.toFixed(1) + '% (&gt;100%). Upsize motor immediately.</div></div>';
      }

      // Check 5: NPSH Ratio risky
      if (npshRatio > 0 && npshRatio < 1.1) {
        activeViolationsCount++;
        suggestionsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;margin-bottom:6px;border:1px solid var(--color-red);background:rgba(239,68,68,0.05);border-radius:var(--radius-sm);"><div style="color:var(--text-main);flex:1;padding-right:var(--space-sm);">NPSH Ratio (NPSHa/NPSHr) = ' + npshRatio.toFixed(3) + ' &lt; 1.1 - Risky. Increase NPSHa or reduce NPSHr.</div></div>';
      }

      // Check 6: Nozzle ratio
      if (nozzleSizRatio > 2.0) {
        activeViolationsCount++;
        suggestionsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;margin-bottom:6px;border:1px solid var(--color-saffron);background:rgba(255,117,56,0.05);border-radius:var(--radius-sm);"><div style="color:var(--text-main);flex:1;padding-right:var(--space-sm);">Nozzle ratio D_dis/D_suc = ' + nozzleSizRatio.toFixed(2) + ' &gt; 2.0. Review nozzle selection.</div></div>';
      }
      if (nozzleSizRatio > 0 && nozzleSizRatio < 1.0) {
        activeViolationsCount++;
        suggestionsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;margin-bottom:6px;border:1px solid var(--color-saffron);background:rgba(255,117,56,0.05);border-radius:var(--radius-sm);"><div style="color:var(--text-main);flex:1;padding-right:var(--space-sm);">Nozzle ratio D_dis/D_suc = ' + nozzleSizRatio.toFixed(2) + ' &lt; 1.0. Discharge smaller than suction - review.</div></div>';
      }

      // Check 7: Cavitation
      if (pumpCorrections.cavitationApplied) {
        suggestionsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;margin-bottom:6px;border:1px solid var(--color-green);background:rgba(0,184,117,0.05);border-radius:var(--radius-sm);"><div style="color:var(--color-green);font-weight:500;">&#10003; CORRECTED: Cavitation risk resolved.</div><span style="font-size:9px;font-weight:600;padding:2px 6px;background:var(--color-green);color:var(--color-black);border-radius:var(--radius-xs);">&#10003; CORRECTED</span></div>';
      } else if (npsha < npshr) {
        activeViolationsCount++;
        suggestionsHtml += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;margin-bottom:6px;border:1px solid var(--color-red);background:rgba(239,68,68,0.05);border-radius:var(--radius-sm);"><div style="color:var(--text-main);flex:1;padding-right:var(--space-sm);">&#9888; CAVITATION RISK. NPSHa (' + npsha.toFixed(4) + ' m) &lt; NPSHr (' + npshr.toFixed(2) + ' m).</div><button type="button" class="apply-pump-correction btn" data-correction-type="cavitation" style="font-size:9px;padding:3px 8px;font-family:var(--font-mono);font-weight:bold;border:1px solid var(--color-red);color:var(--color-red);background:transparent;cursor:pointer;">APPLY &#9889;</button></div>';
      }

      assistantPanel.style.display = "block";
      if (suggestionsHtml === "") {
        assistantContent.innerHTML = '<div style="color:var(--color-green);font-weight:600;text-align:center;padding:var(--space-xs);border:1px solid var(--color-green);background:rgba(0,184,117,0.05);border-radius:var(--radius-sm);">&#10003; ALL PUMP PARAMETERS WITHIN RECOMMENDED RANGE - NO CORRECTIONS NEEDED</div>';
        if (applyAllWrapper) applyAllWrapper.style.display = "none";
      } else {
        assistantContent.innerHTML = suggestionsHtml;
        if (applyAllWrapper) applyAllWrapper.style.display = (activeViolationsCount >= 2) ? "block" : "none";
        // NOTE: click events handled by delegated listener on #pump-assistant-panel (see DOMContentLoaded)
      }
    }

    updatePumpCharts();

    logConsole("Pump Sizing OK. NPSHa: " + npsha.toFixed(4) + " m | DH: " + diffHeadCal.toFixed(4) + " m | Motor: " + stdMotorKw.toFixed(2) + " kW | Load: " + motorLoading.toFixed(1) + "%", cavType === "fail" ? "error" : "success");

  } catch (err) {
    logConsole("Pump calculation error: " + err.message, "error");
    console.error(err);
  }
}

// Helper: find nozzle closest to target velocity
function getNozzleForTargetVelocity(Q_m3s, targetVel) {
  if (!STANDARD_NOZZLES || STANDARD_NOZZLES.length === 0) return { nps: '2"', id: 52.5 };
  const reqArea = Q_m3s / Math.max(targetVel, 0.01);
  const reqDiamMm = Math.sqrt(4 * reqArea / Math.PI) * 1000;
  let best = STANDARD_NOZZLES[0];
  let bestDiff = Math.abs(STANDARD_NOZZLES[0].id - reqDiamMm);
  for (const noz of STANDARD_NOZZLES) {
    const diff = Math.abs(noz.id - reqDiamMm);
    if (diff < bestDiff) { bestDiff = diff; best = noz; }
  }
  return best;
}


// --- PUMP PERFORMANCE CHARTS ---
let pumpFlowHeadChart = null;
let pumpSucNozzleChart = null;
let pumpDisNozzleChart = null;

function updatePumpCharts() {
  if (typeof Chart === 'undefined') return;
  const r = window.state?.pump?.results;
  if (!r) return;

  const Q_design = r.designVolFlow || 0;
  const H_design = r.diffHeadCal || 0;
  const H_static = Math.max(0, r.Hs || 0);
  if (Q_design <= 0 || H_design <= 0) return;

  const maxQ = Q_design * 1.5;
  const H_shutoff = H_design * 1.25;
  const k_sys = Q_design > 0 ? (H_design - H_static) / Math.pow(Q_design, 2) : 0;

  // --- Chart 1: Flowrate vs Head (Pump + System curve) ---
  const flowCanvas = document.getElementById('chart-flow-head');
  if (flowCanvas) {
    const ctx = flowCanvas.getContext('2d');
    const pumpCurve = [];
    const sysCurve = [];
    for (let i = 0; i <= 30; i++) {
      const q = (maxQ / 30) * i;
      pumpCurve.push({ x: q, y: H_shutoff * (1 - 0.7 * Math.pow(q / maxQ, 2)) });
      sysCurve.push({ x: q, y: H_static + k_sys * Math.pow(q, 2) });
    }

    if (pumpFlowHeadChart) pumpFlowHeadChart.destroy();
    pumpFlowHeadChart = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Pump Head Curve (H)',
          data: pumpCurve,
          showLine: true, borderColor: '#f59e0b', backgroundColor: 'rgba(245,158,11,0.08)',
          fill: false, tension: 0.4, pointRadius: 0, borderWidth: 2.5
        }, {
          label: 'System Head Curve (H)',
          data: sysCurve,
          showLine: true, borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.08)',
          fill: false, tension: 0.4, pointRadius: 0, borderWidth: 2.5
        }, {
          label: 'Operating Point (Q=' + Q_design.toFixed(1) + ', H=' + H_design.toFixed(1) + ')',
          data: [{ x: Q_design, y: H_design }],
          borderColor: '#ffffff', backgroundColor: '#f59e0b',
          pointRadius: 7, pointHoverRadius: 10, showLine: false, borderWidth: 2
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#aaa', font: { family: 'monospace', size: 10 } } },
          tooltip: { callbacks: { label: function(ctx) { return ctx.dataset.label + ': Q=' + ctx.parsed.x.toFixed(1) + ' m³/hr, H=' + ctx.parsed.y.toFixed(1) + ' m'; } } }
        },
        scales: {
          x: { type: 'linear', min: 0, max: maxQ, title: { display: true, text: 'Flow Rate Q (m³/hr)', color: '#f59e0b', font: { family: 'monospace', size: 11 } }, ticks: { color: '#888', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.06)' } },
          y: { type: 'linear', min: 0, title: { display: true, text: 'Head H (m)', color: '#22c55e', font: { family: 'monospace', size: 11 } }, ticks: { color: '#888', font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.06)' } }
        }
      }
    });
  }

  // --- Nozzle chart helper ---
  function drawNozzleChart(canvasId, selectedNozzle, selectedVel, targetVelMin, targetVelMax, label, color) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    const Q_m3s = Q_design / 3600;
    const rho = window.state?.pump?.inputs?.density || 1000;
    const nozzleData = [];
    for (const noz of STANDARD_NOZZLES) {
      if (noz.id < 10 || noz.id > 300) continue;
      const area = Math.PI * Math.pow(noz.id / 1000 / 2, 2);
      const vel = area > 0 ? Q_m3s / area : 0;
      const dp = 0.5 * rho * vel * vel / 1e5;
      nozzleData.push({ nps: noz.nps, id: noz.id, vel: vel, dp: dp });
    }
    const selId = selectedNozzle?.id || 0;

    return new Chart(ctx, {
      type: 'bar',
      data: {
        labels: nozzleData.map(n => n.nps),
        datasets: [{
          label: 'Velocity (m/s)',
          data: nozzleData.map(n => n.vel),
          backgroundColor: nozzleData.map(n => Math.abs(n.id - selId) < 1 ? color : 'rgba(100,100,100,0.25)'),
          borderColor: nozzleData.map(n => Math.abs(n.id - selId) < 1 ? color : 'rgba(100,100,100,0.4)'),
          borderWidth: 1, yAxisID: 'y', barPercentage: 0.7
        }, {
          label: 'Dyn. Pressure (bar)',
          data: nozzleData.map(n => n.dp), type: 'line',
          borderColor: '#ff7538', backgroundColor: 'transparent',
          pointRadius: nozzleData.map(n => Math.abs(n.id - selId) < 1 ? 6 : 1.5),
          pointBackgroundColor: nozzleData.map(n => Math.abs(n.id - selId) < 1 ? '#ff7538' : 'rgba(255,117,56,0.5)'),
          borderWidth: 2, tension: 0.3, yAxisID: 'y1'
        }]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { labels: { color: '#aaa', font: { family: 'monospace', size: 9 } } },
          title: { display: true, text: label + ': ' + (selectedNozzle?.nps || '--') + ' (Vel: ' + (selectedVel || 0).toFixed(2) + ' m/s)', color: color, font: { family: 'monospace', size: 11 } }
        },
        scales: {
          x: { title: { display: true, text: 'Nozzle NPS', color: '#888', font: { family: 'monospace', size: 10 } }, ticks: { color: '#888', font: { size: 8 }, maxRotation: 45 }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y: { position: 'left', title: { display: true, text: 'Velocity (m/s)', color: color, font: { family: 'monospace', size: 10 } }, ticks: { color: color, font: { size: 9 } }, grid: { color: 'rgba(255,255,255,0.04)' } },
          y1: { position: 'right', title: { display: true, text: 'Pressure (bar)', color: '#ff7538', font: { family: 'monospace', size: 10 } }, ticks: { color: '#ff7538', font: { size: 9 } }, grid: { drawOnChartArea: false } }
        }
      }
    });
  }

  // --- Chart 2: Suction Nozzle ---
  if (pumpSucNozzleChart) pumpSucNozzleChart.destroy();
  pumpSucNozzleChart = drawNozzleChart('chart-suc-nozzle', r.sucNozzle, r.velSuc, 0.5, 1.5, 'SUCTION SELECTED', 'rgba(59,130,246,0.85)');

  // --- Chart 3: Discharge Nozzle ---
  if (pumpDisNozzleChart) pumpDisNozzleChart.destroy();
  pumpDisNozzleChart = drawNozzleChart('chart-dis-nozzle', r.disNozzle, r.velDis, 1.5, 3.0, 'DISCHARGE SELECTED', 'rgba(239,68,68,0.85)');
}

function executeLineCalculations() {
  const overlay = document.getElementById("line-sim-overlay");
  if (overlay) {
    overlay.classList.add("active");
    line3D.isRunning = true;
    line3D.speedScale = 4.0;
    
    const consoleText = overlay.querySelector(".sim-console-text");
    const phrases = [
      "Iterating Colebrook-White mesh...",
      "Determining friction factor (f)...",
      "Calculating fittings K-losses...",
      "Verifying API 14E velocity limits...",
      "Sizing pipeline total pressure drop..."
    ];
    
    let phase = 0;
    const interval = setInterval(() => {
      if (consoleText && phase < phrases.length) {
        consoleText.textContent = phrases[phase++];
      }
    }, 150);

    setTimeout(() => {
      clearInterval(interval);
      overlay.classList.remove("active");
      line3D.speedScale = 1.0;
      runActualLineCalculations();
    }, 800);
  } else {
    runActualLineCalculations();
  }
}

function runActualLineCalculations() {
  if (window.runActualLineCalculations) {
    window.runActualLineCalculations();
  }
}

// --- Gas Phase Line Sizing Calculation Engine ---
function runActualGasCalculations() {
  if (typeof window.runActualGasCalculations === 'function') {
    window.runActualGasCalculations();
  }
}

// --- Steam Line Sizing Calculation Engine ---
function runActualSteamCalculations() {
  try {
    const steamTypeRadios = document.getElementsByName('steam-type');
    let steamType = 'sat';
    steamTypeRadios.forEach(r => { if (r.checked) steamType = r.value; });

    const pressure = parseFloat(document.getElementById('steam-pressure').value);
    const tempInput = parseFloat(document.getElementById('steam-temp').value);
    const massFlow = parseFloat(document.getElementById('steam-mass-flow').value);
    const npsText = document.getElementById('steam-nps').value;
    const schText = document.getElementById('steam-schedule').value;
    const idInches = parseFloat(document.getElementById('steam-id').value);
    const roughnessMm = parseFloat(document.getElementById('steam-roughness').value);
    const length = parseFloat(document.getElementById('steam-length').value);
    const elevation = parseFloat(document.getElementById('steam-elevation').value);
    const serviceType = document.getElementById('steam-service').value;
    const otherDp = parseFloat(document.getElementById('steam-other-dp').value) || 0;

    if (isNaN(pressure) || isNaN(massFlow) || isNaN(idInches)) return;

    const g = 9.80665;
    let rho, mu, T_sat;

    T_sat = interpolateSteamTable(pressure, 'T_sat');

    if (steamType === 'sat') {
      rho = interpolateSteamTable(pressure, 'rho');
      mu = interpolateSteamTable(pressure, 'mu');
    } else {
      // Superheated: use ideal gas law for density with actual temp
      const T_K = tempInput + 273.15;
      rho = (pressure * 100000 * 18) / (8314 * T_K);
      mu = interpolateSteamTable(pressure, 'mu'); // approximate
    }

    const specificVolume = 1 / rho;
    const idM = idInches * 0.0254;
    const area = (Math.PI / 4) * (idM * idM);
    const mass_flow_kgs = massFlow / 3600;
    const volFlow_m3hr = massFlow * specificVolume;
    const vol_flow_m3s = mass_flow_kgs / rho;
    const velocity = vol_flow_m3s / area;

    const muPaS = mu * 0.001;
    const reynolds = (rho * velocity * idM) / muPaS;

    let regimeText = 'Turbulent';
    let frictionFactor = 0.02;
    if (reynolds <= 2300) {
      regimeText = 'Laminar';
      frictionFactor = 64 / reynolds;
    } else {
      regimeText = reynolds < 4000 ? 'Transition' : 'Turbulent';
      const relRoughness = (roughnessMm * 0.001) / idM;
      frictionFactor = solveColebrook(reynolds, relRoughness);
    }

    const dpPipe = frictionFactor * (length / idM) * (rho * velocity * velocity) / (2 * 1e5);

    let sumK = 0;
    const fittingsRows = document.querySelectorAll('.steam-fittings-table tbody tr');
    fittingsRows.forEach(row => {
      const key = row.getAttribute('data-fitting');
      const kValue = FITTINGS_K[key] || 0;
      const qty = parseFloat(row.querySelector('.table-input').value) || 0;
      sumK += kValue * qty;
    });

    const dpFittings = sumK * (rho * velocity * velocity) / (2 * 1e5);
    const dpElevation = (rho * g * elevation) / 1e5;
    const dpTotal = dpPipe + dpFittings + dpElevation + otherDp;
    const dp100m = frictionFactor * (100 / idM) * (rho * velocity * velocity) / (2 * 1e5);
    const vErosion = (122 / Math.sqrt(rho * 0.062428)) * 0.3048;

    const limits = SERVICE_LIMITS[serviceType] || SERVICE_LIMITS['sat_steam'];

    let velStatus = 'ok', velText = 'OK';
    if (velocity > limits.maxV) { velStatus = 'fail'; velText = 'TOO HIGH'; }
    else if (velocity < limits.minV) { velStatus = 'warn'; velText = 'TOO LOW'; }

    let dpStatus = 'ok', dpText = 'OK';
    if (dp100m > limits.maxDp100) { dpStatus = 'fail'; dpText = 'EXCEEDS LIMIT'; }

    let overallStatus = 'ok';
    if (velStatus === 'fail' || dpStatus === 'fail') overallStatus = 'fail';
    else if (velStatus === 'warn' || dpStatus === 'warn') overallStatus = 'warn';

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('out-steam-density', rho.toFixed(3));
    setEl('out-steam-tsat', T_sat.toFixed(1));
    setEl('out-steam-sv', specificVolume.toFixed(4));
    setEl('out-steam-velocity', velocity.toFixed(2));
    setEl('out-steam-reynolds', reynolds.toLocaleString(undefined, {maximumFractionDigits: 0}));
    setEl('out-steam-f', frictionFactor.toFixed(5));
    setEl('out-steam-regime', regimeText.toUpperCase());
    setEl('out-steam-vol-flow', volFlow_m3hr.toFixed(2));

    setEl('out-steam-dp-pipe', dpPipe.toFixed(4) + ' bar');
    setEl('out-steam-dp-fittings', dpFittings.toFixed(4) + ' bar');
    setEl('out-steam-dp-elevation', dpElevation.toFixed(4) + ' bar');
    setEl('out-steam-dp-other', otherDp.toFixed(4) + ' bar');
    setEl('out-steam-dp-total', dpTotal.toFixed(4) + ' bar');
    setEl('out-steam-dp-100m', dp100m.toFixed(3));

    updateStatusBadge('badge-steam-vel', velText, velStatus);
    updateStatusBadge('badge-steam-dp', dpText, dpStatus);

    state.line.calculated = true;
    state.line.activeType = 'steam';
    state.line.inputs = { steamType, pressure, tempInput, massFlow, npsText, schText, idInches, roughnessMm, length, elevation, serviceType, otherDp, sumK };
    state.line.results = { rho, mu, T_sat, specificVolume, volFlow_m3hr, velocity, reynolds, regimeText, frictionFactor, dpPipe, dpFittings, dpElevation, dpTotal, dp100m, vErosion, velStatus, velText, dpStatus, dpText, overallStatus, limits, idM, area };

    logConsole(`SYSTEM STATUS: STEAM LINE CALCULATED. DENSITY: ${rho.toFixed(2)} KG/M³. VELOCITY: ${velocity.toFixed(1)} M/S. STATUS: ${overallStatus.toUpperCase()}`, overallStatus === 'fail' ? 'error' : 'success');
  } catch (err) {
    logConsole(`Steam calculation error: ${err.message}`, 'error');
  }
}

// --- Slurry Line Sizing Calculation Engine ---
function runActualSlurryCalculations() {
  try {
    const rho_carrier = parseFloat(document.getElementById('slurry-carrier-density').value);
    const mu_carrier_cP = parseFloat(document.getElementById('slurry-carrier-viscosity').value);
    const rho_solid = parseFloat(document.getElementById('slurry-solid-density').value);
    const d50 = parseFloat(document.getElementById('slurry-d50').value);
    const Cw = parseFloat(document.getElementById('slurry-cw').value);
    const massFlow = parseFloat(document.getElementById('slurry-mass-flow').value);
    const npsText = document.getElementById('slurry-nps').value;
    const schText = document.getElementById('slurry-schedule').value;
    const idInches = parseFloat(document.getElementById('slurry-id').value);
    const roughnessMm = parseFloat(document.getElementById('slurry-roughness').value);
    const length = parseFloat(document.getElementById('slurry-length').value);
    const elevation = parseFloat(document.getElementById('slurry-elevation').value);
    const serviceType = document.getElementById('slurry-service').value;
    const otherDp = parseFloat(document.getElementById('slurry-other-dp').value) || 0;

    if (isNaN(rho_carrier) || isNaN(rho_solid) || isNaN(Cw) || isNaN(massFlow) || isNaN(idInches)) return;

    const g = 9.80665;
    const Cw_frac = Cw / 100;

    // Volume fraction from weight fraction
    const Cv = Cw_frac / (Cw_frac + (1 - Cw_frac) * (rho_solid / rho_carrier));

    // Mixture density
    const rho_slurry = rho_carrier * (1 - Cv) + rho_solid * Cv;

    // Thomas equation for apparent viscosity
    const mu_carrier = mu_carrier_cP * 0.001; // Pa.s
    const mu_slurry_PaS = mu_carrier * (1 + 2.5 * Cv + 10.05 * Cv * Cv + 0.00273 * Math.exp(16.6 * Cv));
    const mu_slurry_cP = mu_slurry_PaS * 1000;

    const idM = idInches * 0.0254;
    const area = (Math.PI / 4) * (idM * idM);
    const mass_flow_kgs = massFlow / 3600;
    const volFlow = mass_flow_kgs / rho_slurry; // m³/s
    const velocity = volFlow / area;

    const reynolds = (rho_slurry * velocity * idM) / mu_slurry_PaS;

    let regimeText = 'Turbulent';
    let frictionFactor = 0.02;
    if (reynolds <= 2300) {
      regimeText = 'Laminar';
      frictionFactor = 64 / reynolds;
    } else {
      regimeText = reynolds < 4000 ? 'Transition' : 'Turbulent';
      const relRoughness = (roughnessMm * 0.001) / idM;
      frictionFactor = solveColebrook(reynolds, relRoughness);
    }

    // Durand deposition velocity
    const V_deposit = 1.0 * Math.sqrt(2 * g * idM * (rho_solid / rho_carrier - 1));

    const dpPipe = frictionFactor * (length / idM) * (rho_slurry * velocity * velocity) / (2 * 1e5);

    let sumK = 0;
    const fittingsRows = document.querySelectorAll('.slurry-fittings-table tbody tr');
    fittingsRows.forEach(row => {
      const key = row.getAttribute('data-fitting');
      const kValue = FITTINGS_K[key] || 0;
      const qty = parseFloat(row.querySelector('.table-input').value) || 0;
      sumK += kValue * qty;
    });

    const dpFittings = sumK * (rho_slurry * velocity * velocity) / (2 * 1e5);
    const dpElevation = (rho_slurry * g * elevation) / 1e5;
    const dpTotal = dpPipe + dpFittings + dpElevation + otherDp;
    const dp100m = frictionFactor * (100 / idM) * (rho_slurry * velocity * velocity) / (2 * 1e5);
    const vErosion = (122 / Math.sqrt(rho_slurry * 0.062428)) * 0.3048;

    const limits = SERVICE_LIMITS[serviceType] || SERVICE_LIMITS['slurry'];

    let velStatus = 'ok', velText = 'OK';
    if (velocity > limits.maxV) { velStatus = 'fail'; velText = 'TOO HIGH'; }
    else if (velocity < limits.minV) { velStatus = 'warn'; velText = 'TOO LOW'; }

    let dpStatus = 'ok', dpText = 'OK';
    if (dp100m > limits.maxDp100) { dpStatus = 'fail'; dpText = 'EXCEEDS LIMIT'; }

    let depStatus = 'ok', depText = 'PASS';
    if (velocity < V_deposit) { depStatus = 'fail'; depText = 'BELOW V_DEP'; }

    let overallStatus = 'ok';
    if (velStatus === 'fail' || dpStatus === 'fail' || depStatus === 'fail') overallStatus = 'fail';
    else if (velStatus === 'warn' || dpStatus === 'warn') overallStatus = 'warn';

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('out-slurry-density', rho_slurry.toFixed(1));
    setEl('out-slurry-viscosity', mu_slurry_cP.toFixed(3));
    setEl('out-slurry-cv', (Cv * 100).toFixed(2));
    setEl('out-slurry-vdep', V_deposit.toFixed(2));
    setEl('out-slurry-velocity', velocity.toFixed(2));
    setEl('out-slurry-reynolds', reynolds.toLocaleString(undefined, {maximumFractionDigits: 0}));
    setEl('out-slurry-f', frictionFactor.toFixed(5));
    setEl('out-slurry-regime', regimeText.toUpperCase());

    setEl('out-slurry-dp-pipe', dpPipe.toFixed(4) + ' bar');
    setEl('out-slurry-dp-fittings', dpFittings.toFixed(4) + ' bar');
    setEl('out-slurry-dp-elevation', dpElevation.toFixed(4) + ' bar');
    setEl('out-slurry-dp-other', otherDp.toFixed(4) + ' bar');
    setEl('out-slurry-dp-total', dpTotal.toFixed(4) + ' bar');
    setEl('out-slurry-dp-100m', dp100m.toFixed(3));

    const depWarn = document.getElementById('slurry-dep-warning');
    if (depWarn) depWarn.style.display = velocity < V_deposit ? 'block' : 'none';

    updateStatusBadge('badge-slurry-vel', velText, velStatus);
    updateStatusBadge('badge-slurry-dp', dpText, dpStatus);
    updateStatusBadge('badge-slurry-dep', depText, depStatus);

    state.line.calculated = true;
    state.line.activeType = 'slurry';
    state.line.inputs = { rho_carrier, mu_carrier_cP, rho_solid, d50, Cw, massFlow, npsText, schText, idInches, roughnessMm, length, elevation, serviceType, otherDp, sumK };
    state.line.results = { rho_slurry, mu_slurry_cP, Cv, V_deposit, velocity, reynolds, regimeText, frictionFactor, dpPipe, dpFittings, dpElevation, dpTotal, dp100m, vErosion, velStatus, velText, dpStatus, dpText, depStatus, depText, overallStatus, limits, idM, area };

    logConsole(`SYSTEM STATUS: SLURRY LINE CALCULATED. DEPOSITION CHECK: ${depText}. VELOCITY: ${velocity.toFixed(2)} M/S. STATUS: ${overallStatus.toUpperCase()}`, overallStatus === 'fail' ? 'error' : 'success');
  } catch (err) {
    logConsole(`Slurry calculation error: ${err.message}`, 'error');
  }
}

// --- Two-Phase Line Sizing Calculation Engine (Lockhart-Martinelli) ---
function runActualTwoPhaseCalculations() {
  try {
    const rhoL = parseFloat(document.getElementById('tp-liquid-density').value);
    const muL_cP = parseFloat(document.getElementById('tp-liquid-viscosity').value);
    const rhoG = parseFloat(document.getElementById('tp-gas-density').value);
    const muG_cP = parseFloat(document.getElementById('tp-gas-viscosity').value);
    const totalMassFlow = parseFloat(document.getElementById('tp-mass-flow').value);
    const quality = parseFloat(document.getElementById('tp-quality').value);
    const npsText = document.getElementById('tp-nps').value;
    const schText = document.getElementById('tp-schedule').value;
    const idInches = parseFloat(document.getElementById('tp-id').value);
    const roughnessMm = parseFloat(document.getElementById('tp-roughness').value);
    const length = parseFloat(document.getElementById('tp-length').value);
    const elevation = parseFloat(document.getElementById('tp-elevation').value);
    const serviceType = document.getElementById('tp-service').value;
    const otherDp = parseFloat(document.getElementById('tp-other-dp').value) || 0;
    const orientRadios = document.getElementsByName('tp-orient');
    let orientation = 'horizontal';
    orientRadios.forEach(r => { if (r.checked) orientation = r.value; });

    if (isNaN(rhoL) || isNaN(rhoG) || isNaN(totalMassFlow) || isNaN(quality) || isNaN(idInches)) return;

    const g = 9.80665;
    const x = quality; // vapour mass fraction
    const idM = idInches * 0.0254;
    const area = (Math.PI / 4) * (idM * idM);

    const mTotal_kgs = totalMassFlow / 3600;
    const mL = mTotal_kgs * (1 - x);
    const mG = mTotal_kgs * x;

    const VL_superficial = mL / (rhoL * area);
    const VG_superficial = mG / (rhoG * area);
    const VM = VL_superficial + VG_superficial;

    // Homogeneous void fraction
    const alpha = VG_superficial / (VL_superficial + VG_superficial);
    const rhoM = rhoL * (1 - alpha) + rhoG * alpha;

    // Individual phase pressure drops per meter (Darcy)
    const muL_PaS = muL_cP * 0.001;
    const muG_PaS = muG_cP * 0.001;
    const relRoughness = (roughnessMm * 0.001) / idM;

    // Liquid-only Reynolds and friction
    const ReL = (rhoL * VL_superficial * idM) / muL_PaS;
    const fL = ReL > 0 ? solveColebrook(Math.max(ReL, 100), relRoughness) : 0.02;
    const dpL_per_m = fL * (1 / idM) * (rhoL * VL_superficial * VL_superficial) / 2;

    // Gas-only Reynolds and friction
    const ReG = (rhoG * VG_superficial * idM) / muG_PaS;
    const fG = ReG > 0 ? solveColebrook(Math.max(ReG, 100), relRoughness) : 0.02;
    const dpG_per_m = fG * (1 / idM) * (rhoG * VG_superficial * VG_superficial) / 2;

    // Lockhart-Martinelli parameter
    const Xtt = dpL_per_m > 0 && dpG_per_m > 0 ? Math.sqrt(dpL_per_m / dpG_per_m) : 1;
    const C = 20; // turbulent-turbulent
    const PhiL2 = 1 + C / Xtt + 1 / (Xtt * Xtt);
    const dpTP_per_m = PhiL2 * dpL_per_m;

    // Fittings
    let sumK = 0;
    const fittingsRows = document.querySelectorAll('.tp-fittings-table tbody tr');
    fittingsRows.forEach(row => {
      const key = row.getAttribute('data-fitting');
      const kValue = FITTINGS_K[key] || 0;
      const qty = parseFloat(row.querySelector('.table-input').value) || 0;
      sumK += kValue * qty;
    });
    const dpFittings_TP = sumK * (rhoM * VM * VM) / (2 * 1e5);

    const dpElevation = (rhoM * g * elevation) / 1e5;
    const dpTP_total_bar = (dpTP_per_m * length) / 1e5 + dpElevation + dpFittings_TP + otherDp;
    const dp100m = (dpTP_per_m * 100) / 1e5;

    // Flow pattern determination
    let flowPattern = 'Intermittent';
    const V_SL = VL_superficial;
    const V_SG = VG_superficial;

    if (orientation === 'horizontal') {
      // Mandhane map (simplified)
      if (V_SG < 0.1) flowPattern = 'Bubble';
      else if (V_SG >= 0.1 && V_SG < 1.0 && V_SL > 0.1) flowPattern = 'Slug';
      else if (V_SG >= 1.0 && V_SG < 10 && V_SL >= 0.01 && V_SL < 1.0) flowPattern = 'Intermittent';
      else if (V_SG >= 10 && V_SL < 0.1) flowPattern = 'Annular/Mist';
      else if (V_SL >= 1.0 && V_SG < 1.0) flowPattern = 'Stratified';
      else flowPattern = 'Intermittent';
    } else {
      // Vertical
      if (V_SG < 0.25) flowPattern = 'Bubble';
      else if (V_SG >= 0.25 && V_SG < 1) flowPattern = 'Slug';
      else if (V_SG >= 1 && V_SG < 3) flowPattern = 'Churn';
      else if (V_SG >= 3) flowPattern = 'Annular';
    }

    const limits = SERVICE_LIMITS[serviceType] || SERVICE_LIMITS['two_phase'];

    let velStatus = 'ok', velText = 'OK';
    if (VM > limits.maxV) { velStatus = 'fail'; velText = 'TOO HIGH'; }
    else if (VM < limits.minV) { velStatus = 'warn'; velText = 'TOO LOW'; }

    let dpStatus = 'ok', dpText = 'OK';
    if (dp100m > limits.maxDp100) { dpStatus = 'fail'; dpText = 'EXCEEDS LIMIT'; }

    let overallStatus = 'ok';
    if (velStatus === 'fail' || dpStatus === 'fail') overallStatus = 'fail';
    else if (velStatus === 'warn' || dpStatus === 'warn') overallStatus = 'warn';

    const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    setEl('out-tp-vl', VL_superficial.toFixed(3));
    setEl('out-tp-vg', VG_superficial.toFixed(3));
    setEl('out-tp-vm', VM.toFixed(2));
    setEl('out-tp-alpha', (alpha * 100).toFixed(2));
    setEl('out-tp-mix-density', rhoM.toFixed(2));
    setEl('out-tp-xtt', Xtt.toFixed(4));
    setEl('out-tp-phi', PhiL2.toFixed(3));
    setEl('out-tp-dp', dpTP_total_bar.toFixed(4));
    setEl('out-tp-dp-100m', dp100m.toFixed(3));
    setEl('out-tp-pattern', flowPattern.toUpperCase());

    // Flow pattern badge
    const patternBadge = document.getElementById('out-tp-pattern');
    if (patternBadge) {
      patternBadge.className = '';
      const patClass = flowPattern.toLowerCase().replace(/\//g, '-');
      patternBadge.classList.add('pattern-' + patClass);
    }

    updateStatusBadge('badge-tp-vel', velText, velStatus);
    updateStatusBadge('badge-tp-dp', dpText, dpStatus);

    state.line.calculated = true;
    state.line.activeType = 'two_phase';
    state.line.inputs = { rhoL, muL_cP, rhoG, muG_cP, totalMassFlow, quality: x, npsText, schText, idInches, roughnessMm, length, elevation, serviceType, otherDp, orientation, sumK };
    state.line.results = { VL_superficial, VG_superficial, VM, alpha, rhoM, Xtt, PhiL2, dpTP_per_m, dpTP_total_bar, dp100m, dpElevation, dpFittings_TP, flowPattern, velStatus, velText, dpStatus, dpText, overallStatus, limits, idM, area };

    logConsole(`SYSTEM STATUS: TWO-PHASE CALCULATED. FLOW PATTERN: ${flowPattern.toUpperCase()}. ΔP_TP: ${dpTP_total_bar.toFixed(3)} BAR. STATUS: ${overallStatus.toUpperCase()}`, overallStatus === 'fail' ? 'error' : 'success');
  } catch (err) {
    logConsole(`Two-phase calculation error: ${err.message}`, 'error');
  }
}

// --- TAB 3: Summary Report Generator ---
function generateSummaryReport() {
  const reportTime = document.getElementById("report-time");
  if (reportTime) reportTime.textContent = getTimestamp();

  const sysEl = document.getElementById("rep-active-unit-system");
  if (sysEl) {
    sysEl.textContent = `UNIT SYSTEM: ${window.activeUnitSystem}`;
  }

  logConsole(`Aggregating sizing reports and populating summary dashboard [Units: ${window.activeUnitSystem}]...`, "info");

  const getFormattedText = (valSI, type, decimals = 2) => {
    const formatted = window.formatUnit(valSI, type, decimals);
    return `${formatted.value} ${formatted.symbol}`;
  };

  if (window.state && window.state.pump && window.state.pump.calculated) {
    const pIn = window.state.pump.inputs;
    const pOut = window.state.pump.results;

    document.getElementById("rep-pump-fluid").textContent = pIn.fluidVal;
    document.getElementById("rep-pump-temp").textContent = `${window.formatUnit(pIn.tempMin, 'temperature', 1).value} / ${window.formatUnit(pIn.tempNorm, 'temperature', 1).value} / ${window.formatUnit(pIn.tempMax, 'temperature', 1).value} ${window.formatUnit(pIn.tempNorm, 'temperature', 1).symbol}`;
    document.getElementById("rep-pump-density").textContent = getFormattedText(pIn.rho, 'density', 2);
    document.getElementById("rep-pump-viscosity").textContent = getFormattedText(pIn.mu, 'viscosity', 2);
    document.getElementById("rep-pump-flow-norm").textContent = getFormattedText(pIn.normalVolFlow, 'vol-flow', 1);
    document.getElementById("rep-pump-flow-design").textContent = `${getFormattedText(pOut.designVolFlow, 'vol-flow', 1)} (${pIn.margin}% margin)`;
    
    document.getElementById("rep-pump-net-suc-press").textContent = getFormattedText(pOut.pNet, 'pressure', 3);
    
    const repNpsha = document.getElementById("rep-pump-npsha");
    if (repNpsha) {
      repNpsha.textContent = getFormattedText(pOut.npsha, 'length-m', 2);
      repNpsha.className = "val text-data font-bold";
      if (pOut.cavType === "ok") repNpsha.className = "val text-data font-bold text-teal";
      else if (pOut.cavType === "warn") repNpsha.className = "val text-data font-bold text-amber";
      else if (pOut.cavType === "fail") repNpsha.className = "val text-data font-bold text-red";
    }
    
    document.getElementById("rep-pump-npshr").textContent = getFormattedText(pIn.npshr, 'length-m', 2);
    
    const repNpshMarginCheck = document.getElementById("rep-pump-net-suc");
    if (repNpshMarginCheck) {
      repNpshMarginCheck.textContent = getFormattedText(pOut.npshMargin, 'length-m', 2);
      repNpshMarginCheck.className = "val text-data font-bold";
      if (pOut.cavType === "ok") repNpshMarginCheck.className = "val text-data font-bold text-teal";
      else if (pOut.cavType === "warn") repNpshMarginCheck.className = "val text-data font-bold text-amber";
      else if (pOut.cavType === "fail") repNpshMarginCheck.className = "val text-data font-bold text-red";
    }
    
    const repCav = document.getElementById("rep-pump-cavitation");
    if (repCav) {
      repCav.textContent = pOut.cavText + (pOut.cavType === "fail" ? " ⚠" : "");
      repCav.className = "val font-bold";
      if (pOut.cavType === "ok") repCav.className = "val font-bold text-teal";
      else if (pOut.cavType === "warn") repCav.className = "val font-bold text-amber";
      else if (pOut.cavType === "fail") repCav.className = "val font-bold text-red";
    }
    
    document.getElementById("rep-pump-diff-head").textContent = getFormattedText(pOut.diffHeadCal, 'length-m', 2);
    document.getElementById("rep-pump-shutoff-head").textContent = `${getFormattedText(pOut.shutoffHeadCal, 'length-m', 2)} (${getFormattedText(pOut.shutoffPressA, 'pressure', 2)})`;
    
    const repBhp = document.getElementById("rep-pump-bhp");
    if (repBhp) {
      repBhp.textContent = getFormattedText(pOut.bhp, 'power', 2);
      repBhp.className = "val text-data font-bold text-teal";
    }
    
    const repMotor = document.getElementById("rep-pump-motor");
    if (repMotor) {
      repMotor.textContent = `${getFormattedText(pOut.stdMotorKw, 'power', 2)} (${pOut.stdMotorHp.toFixed(1)} HP)`;
      repMotor.className = "val text-data font-bold text-teal";
    }

    const repTag = document.getElementById("rep-pump-tag");
    if (repTag) {
      repTag.textContent = pIn.pumpTag;
    }

    const repSucNozzle = document.getElementById("rep-pump-suc-nozzle");
    if (repSucNozzle) {
      repSucNozzle.textContent = pOut.sucNozzle ? `NPS ${pOut.sucNozzle.nps} (${pOut.sucNozzle.id.toFixed(1)} mm)` : "-";
    }
    const repSucPv = document.getElementById("rep-pump-suc-pv");
    if (repSucPv) {
      repSucPv.textContent = `${getFormattedText(pOut.sucNozzlePress, 'pressure', 2)} @ ${getFormattedText(pOut.velSuc, 'velocity', 2)}`;
    }
    const repDisNozzle = document.getElementById("rep-pump-dis-nozzle");
    if (repDisNozzle) {
      repDisNozzle.textContent = pOut.disNozzle ? `NPS ${pOut.disNozzle.nps} (${pOut.disNozzle.id.toFixed(1)} mm)` : "-";
    }
    const repDisPv = document.getElementById("rep-pump-dis-pv");
    if (repDisPv) {
      repDisPv.textContent = `${getFormattedText(pOut.disNozzlePress, 'pressure', 2)} @ ${getFormattedText(pOut.velDis, 'velocity', 2)}`;
    }

    if (typeof drawSinglePumpChart === 'function') {
      reportPumpChartInstance = drawSinglePumpChart('reportPumpChart', pOut.designVolFlow, pIn.diffHead, pOut.staticHead, reportPumpChartInstance);
    }
  } else {
    clearPumpReport();
  }

  if (window.state && window.state.line && window.state.line.calculated) {
    const lIn = window.state.line.inputs;
    const lOut = window.state.line.results;
    const lineType = window.state.line.activeType;

    const repLineType = document.getElementById("rep-line-type");
    if (repLineType) repLineType.textContent = lineType.toUpperCase().replace('_', '-');

    if (lineType === 'liquid') {
      document.getElementById("rep-line-nps").textContent = `NPS ${lIn.npsText}" Schedule ${lIn.schText}`;
      document.getElementById("rep-line-id").textContent = `${getFormattedText(lOut.idM * 1000, 'length-mm', 3)}`;
      document.getElementById("rep-line-material").textContent = lIn.fluidVal;
      document.getElementById("rep-line-length").textContent = getFormattedText(lIn.length, 'length-m', 1);
      
      const servMap = { suction: "Pump Suction", discharge: "Pump Discharge", drain: "Drain", general: "General", gravity: "Gravity", boiler_feed: "Boiler Feed" };
      document.getElementById("rep-line-service").textContent = servMap[lIn.serviceType] || lIn.serviceType;
      document.getElementById("rep-line-flow").textContent = getFormattedText(lIn.qVol, 'vol-flow', 1);
      
      document.getElementById("rep-line-velocity").textContent = `${getFormattedText(lOut.velocity, 'velocity', 2)} (Limit: ${getFormattedText(lOut.limits.minV, 'velocity', 1)} - ${getFormattedText(lOut.limits.maxV, 'velocity', 1)})`;
      document.getElementById("rep-line-v-erosion").textContent = getFormattedText(lOut.vErosion, 'velocity', 2);
      document.getElementById("rep-line-reynolds").textContent = `${lOut.reynolds.toLocaleString(undefined, {maximumFractionDigits:0})} [${lOut.regimeText}]`;
      document.getElementById("rep-line-f").textContent = lOut.frictionFactor.toFixed(5);
      document.getElementById("rep-line-dp-pipe").textContent = getFormattedText(lOut.dpPipe, 'press-drop', 4);
      document.getElementById("rep-line-dp-fittings").textContent = `${getFormattedText(lOut.dpFittings, 'press-drop', 4)} (K: ${lIn.sumK.toFixed(2)})`;
      document.getElementById("rep-line-dp-elevation").textContent = `${getFormattedText(lOut.dpElevation, 'press-drop', 4)} (h: ${getFormattedText(lIn.elevation, 'length-m', 1)})`;
      document.getElementById("rep-line-dp-other").textContent = getFormattedText(lIn.otherDp, 'press-drop', 4);

      const repDpTotal = document.getElementById("rep-line-dp-total");
      repDpTotal.textContent = getFormattedText(lOut.dpTotal, 'press-drop', 4);
      repDpTotal.className = "val text-data font-bold text-teal";

      const repDp100 = document.getElementById("rep-line-dp-100m");
      repDp100.textContent = `${getFormattedText(lOut.dp100m, 'press-drop', 3)}/100m (Max: ${getFormattedText(lOut.limits.maxDp100, 'press-drop', 2)}/100m)`;
      repDp100.className = "val text-data font-bold text-teal";
      if (lOut.dpStatus === "fail") {
        repDp100.className = "val text-data font-bold text-red";
      }

      setAuditResult("rep-audit-velocity", lOut.velText, lOut.velStatus);
      setAuditResult("rep-audit-dp", lOut.dpText, lOut.dpStatus);
      setAuditResult("rep-audit-erosion", lOut.erosionText, lOut.erosionStatus);

      if (typeof drawSingleLineChart === 'function') {
        reportLineChartInstance = drawSingleLineChart('reportLineChart', lIn.qVol, lIn.rho, lIn.mu, lIn.roughnessMm, lIn.npsText, lOut.limits, reportLineChartInstance);
      }

    } else if (lineType === 'gas') {
      document.getElementById("rep-line-nps").textContent = `NPS ${lIn.npsText}" Schedule ${lIn.schText}`;
      document.getElementById("rep-line-id").textContent = `${getFormattedText(lOut.idM * 1000, 'length-mm', 3)}`;
      document.getElementById("rep-line-material").textContent = `Roughness: ${getFormattedText(lIn.roughnessMm, 'length-mm', 4)}`;
      document.getElementById("rep-line-length").textContent = getFormattedText(lIn.length, 'length-m', 1);
      document.getElementById("rep-line-service").textContent = lIn.serviceType.toUpperCase();
      document.getElementById("rep-line-flow").textContent = getFormattedText(lIn.massFlow, 'mass-flow', 1);
      document.getElementById("rep-line-velocity").textContent = getFormattedText(lOut.velocity, 'velocity', 2);
      document.getElementById("rep-line-v-erosion").textContent = `Mach: ${lOut.Mach.toFixed(4)}`;
      document.getElementById("rep-line-reynolds").textContent = `${lOut.reynolds.toLocaleString(undefined, {maximumFractionDigits:0})} [${lOut.regimeText}]`;
      document.getElementById("rep-line-f").textContent = lOut.frictionFactor.toFixed(5);
      document.getElementById("rep-line-dp-pipe").textContent = `Density: ${getFormattedText(lOut.rho, 'density', 3)}`;
      document.getElementById("rep-line-dp-fittings").textContent = `${getFormattedText(lOut.dpFittings, 'press-drop', 4)} (K: ${lIn.sumK.toFixed(2)})`;
      document.getElementById("rep-line-dp-elevation").textContent = getFormattedText(lOut.dpElevation, 'press-drop', 4);
      document.getElementById("rep-line-dp-other").textContent = getFormattedText(lIn.otherDp, 'press-drop', 4);

      const repDpTotal = document.getElementById("rep-line-dp-total");
      repDpTotal.textContent = getFormattedText(lOut.dpTotal, 'press-drop', 4);
      repDpTotal.className = "val text-data font-bold " + (lOut.overallStatus === 'ok' ? 'text-teal' : 'text-red');

      const repDp100 = document.getElementById("rep-line-dp-100m");
      repDp100.textContent = `${getFormattedText(lOut.dp100m, 'press-drop', 3)}/100m`;
      repDp100.className = "val text-data font-bold " + (lOut.dpStatus === 'ok' ? 'text-teal' : 'text-red');

      setAuditResult("rep-audit-velocity", lOut.velText, lOut.velStatus);
      setAuditResult("rep-audit-dp", lOut.dpText, lOut.dpStatus);
      setAuditResult("rep-audit-erosion", "N/A", "ok");

    } else if (lineType === 'steam') {
      document.getElementById("rep-line-nps").textContent = `NPS ${lIn.npsText}" Schedule ${lIn.schText}`;
      document.getElementById("rep-line-id").textContent = `${getFormattedText(lOut.idM * 1000, 'length-mm', 3)}`;
      document.getElementById("rep-line-material").textContent = `${lIn.steamType === 'sat' ? 'Saturated' : 'Superheated'} Steam`;
      document.getElementById("rep-line-length").textContent = getFormattedText(lIn.length, 'length-m', 1);
      document.getElementById("rep-line-service").textContent = lIn.serviceType.toUpperCase();
      document.getElementById("rep-line-flow").textContent = getFormattedText(lIn.massFlow, 'mass-flow', 1);
      document.getElementById("rep-line-velocity").textContent = getFormattedText(lOut.velocity, 'velocity', 2);
      document.getElementById("rep-line-v-erosion").textContent = `T_sat: ${window.formatUnit(lOut.T_sat, 'temperature', 1).value} ${window.formatUnit(lOut.T_sat, 'temperature', 1).symbol} | SV: ${lOut.specificVolume.toFixed(4)} m³/kg`;
      document.getElementById("rep-line-reynolds").textContent = `${lOut.reynolds.toLocaleString(undefined, {maximumFractionDigits:0})} [${lOut.regimeText}]`;
      document.getElementById("rep-line-f").textContent = lOut.frictionFactor.toFixed(5);
      document.getElementById("rep-line-dp-pipe").textContent = `Density: ${getFormattedText(lOut.rho, 'density', 3)}`;
      document.getElementById("rep-line-dp-fittings").textContent = `${getFormattedText(lOut.dpFittings, 'press-drop', 4)} (K: ${lIn.sumK.toFixed(2)})`;
      document.getElementById("rep-line-dp-elevation").textContent = getFormattedText(lOut.dpElevation, 'press-drop', 4);
      document.getElementById("rep-line-dp-other").textContent = getFormattedText(lIn.otherDp, 'press-drop', 4);

      const repDpTotal = document.getElementById("rep-line-dp-total");
      repDpTotal.textContent = getFormattedText(lOut.dpTotal, 'press-drop', 4);
      repDpTotal.className = "val text-data font-bold " + (lOut.overallStatus === 'ok' ? 'text-teal' : 'text-red');

      const repDp100 = document.getElementById("rep-line-dp-100m");
      repDp100.textContent = `${getFormattedText(lOut.dp100m, 'press-drop', 3)}/100m`;
      repDp100.className = "val text-data font-bold " + (lOut.dpStatus === 'ok' ? 'text-teal' : 'text-red');

      setAuditResult("rep-audit-velocity", lOut.velText, lOut.velStatus);
      setAuditResult("rep-audit-dp", lOut.dpText, lOut.dpStatus);
      setAuditResult("rep-audit-erosion", "N/A", "ok");

    } else if (lineType === 'slurry') {
      document.getElementById("rep-line-nps").textContent = `NPS ${lIn.npsText}" Schedule ${lIn.schText}`;
      document.getElementById("rep-line-id").textContent = `${getFormattedText(lOut.idM * 1000, 'length-mm', 3)}`;
      document.getElementById("rep-line-material").textContent = `Roughness: ${getFormattedText(lIn.roughnessMm, 'length-mm', 4)}`;
      document.getElementById("rep-line-length").textContent = getFormattedText(lIn.length, 'length-m', 1);
      document.getElementById("rep-line-service").textContent = lIn.serviceType.toUpperCase();
      document.getElementById("rep-line-flow").textContent = getFormattedText(lIn.massFlow, 'mass-flow', 1);
      document.getElementById("rep-line-velocity").textContent = getFormattedText(lOut.velocity, 'velocity', 2);
      document.getElementById("rep-line-v-erosion").textContent = `V_dep: ${getFormattedText(lOut.V_deposit, 'velocity', 2)} | Cv: ${(lOut.Cv*100).toFixed(2)}%`;
      document.getElementById("rep-line-reynolds").textContent = `${lOut.reynolds.toLocaleString(undefined, {maximumFractionDigits:0})} [${lOut.regimeText}]`;
      document.getElementById("rep-line-f").textContent = lOut.frictionFactor.toFixed(5);
      document.getElementById("rep-line-dp-pipe").textContent = `Density: ${getFormattedText(lOut.rho_slurry, 'density', 1)} | Viscosity: ${getFormattedText(lOut.mu_slurry_cP, 'viscosity', 3)}`;
      document.getElementById("rep-line-dp-fittings").textContent = `${getFormattedText(lOut.dpFittings, 'press-drop', 4)} (K: ${lIn.sumK.toFixed(2)})`;
      document.getElementById("rep-line-dp-elevation").textContent = getFormattedText(lOut.dpElevation, 'press-drop', 4);
      document.getElementById("rep-line-dp-other").textContent = getFormattedText(lIn.otherDp, 'press-drop', 4);

      const repDpTotal = document.getElementById("rep-line-dp-total");
      repDpTotal.textContent = getFormattedText(lOut.dpTotal, 'press-drop', 4);
      repDpTotal.className = "val text-data font-bold " + (lOut.overallStatus === 'ok' ? 'text-teal' : 'text-red');

      const repDp100 = document.getElementById("rep-line-dp-100m");
      repDp100.textContent = `${getFormattedText(lOut.dp100m, 'press-drop', 3)}/100m`;
      repDp100.className = "val text-data font-bold " + (lOut.dpStatus === 'ok' ? 'text-teal' : 'text-red');

      setAuditResult("rep-audit-velocity", lOut.velText, lOut.velStatus);
      setAuditResult("rep-audit-dp", lOut.dpText, lOut.dpStatus);
      setAuditResult("rep-audit-erosion", lOut.depText, lOut.depStatus);

    } else if (lineType === 'two_phase' || lineType === 'twophase') {
      document.getElementById("rep-line-nps").textContent = `NPS ${lIn.npsText}" Schedule ${lIn.schText}`;
      document.getElementById("rep-line-id").textContent = `${getFormattedText(lOut.idM * 1000, 'length-mm', 3)}`;
      document.getElementById("rep-line-material").textContent = `Roughness: ${getFormattedText(lIn.roughnessMm, 'length-mm', 4)}`;
      document.getElementById("rep-line-length").textContent = getFormattedText(lIn.length, 'length-m', 1);
      document.getElementById("rep-line-service").textContent = lIn.serviceType.toUpperCase();
      document.getElementById("rep-line-flow").textContent = getFormattedText(lIn.totalMassFlow, 'mass-flow', 1);
      document.getElementById("rep-line-velocity").textContent = `V_m: ${getFormattedText(lOut.VM, 'velocity', 2)}`;
      document.getElementById("rep-line-v-erosion").textContent = `V_L: ${getFormattedText(lOut.VL_superficial, 'velocity', 2)} | V_G: ${getFormattedText(lOut.VG_superficial, 'velocity', 2)}`;
      document.getElementById("rep-line-reynolds").textContent = `X_tt: ${lOut.Xtt.toFixed(4)}`;
      document.getElementById("rep-line-f").textContent = `Phi_L²: ${lOut.PhiL2.toFixed(3)}`;
      document.getElementById("rep-line-dp-pipe").textContent = `Density_m: ${getFormattedText(lOut.rhoM, 'density', 2)} | Void Fr: ${(lOut.alpha*100).toFixed(1)}%`;
      document.getElementById("rep-line-dp-fittings").textContent = `${getFormattedText(lOut.dpFittings_TP, 'press-drop', 4)} (K: ${lIn.sumK.toFixed(2)})`;
      document.getElementById("rep-line-dp-elevation").textContent = getFormattedText(lOut.dpElevation, 'press-drop', 4);
      document.getElementById("rep-line-dp-other").textContent = getFormattedText(lIn.otherDp, 'press-drop', 4);

      const repDpTotal = document.getElementById("rep-line-dp-total");
      repDpTotal.textContent = getFormattedText(lOut.dpTP_total_bar, 'press-drop', 4);
      repDpTotal.className = "val text-data font-bold " + (lOut.overallStatus === 'ok' ? 'text-teal' : 'text-red');

      const repDp100 = document.getElementById("rep-line-dp-100m");
      repDp100.textContent = `${getFormattedText(lOut.dp100m, 'press-drop', 3)}/100m`;
      repDp100.className = "val text-data font-bold " + (lOut.dpStatus === 'ok' ? 'text-teal' : 'text-red');

      setAuditResult("rep-audit-velocity", lOut.velText, lOut.velStatus);
      setAuditResult("rep-audit-dp", lOut.dpText, lOut.dpStatus);
      setAuditResult("rep-audit-erosion", "Pattern: " + lOut.flowPattern.toUpperCase(), "ok");
    }
  } else {
    clearLineReport();
  }

  if (window.state && window.state.sthe && window.state.sthe.calculated) {
    const r = window.state.sthe.results;
    const inp = window.state.sthe.inputs;
    
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('rep-sthe-q', getFormattedText(r.Q_kW, 'heat-duty', 2));
    set('rep-sthe-dtlm', getFormattedText(r.dT_lm, 'temp-diff', 3));
    set('rep-sthe-u', getFormattedText(r.U_calc, 'htc', 2));
    set('rep-sthe-nt', r.Nt);
    set('rep-sthe-np', inp.Np);
    set('rep-sthe-ds', getFormattedText(r.Ds_used_mm / 1000, 'length-mm', 1));
    set('rep-sthe-aa', getFormattedText(r.Aa, 'area', 2));
    set('rep-sthe-ar', getFormattedText(r.Ar, 'area', 2));
    set('rep-sthe-excess', r.excessArea.toFixed(1) + '%');
    set('rep-sthe-dp-tube', getFormattedText(r.dp_tube_kPa, 'press-drop-kpa', 2));
    set('rep-sthe-dp-shell', getFormattedText(r.dp_shell_kPa, 'press-drop-kpa', 2));
    set('rep-sthe-nozzle-tube-in', getFormattedText(r.D_nozzle_tube_in / 1000, 'length-mm', 1));
    set('rep-sthe-nozzle-tube-out', getFormattedText(r.D_nozzle_tube_out / 1000, 'length-mm', 1));
    set('rep-sthe-nozzle-shell-in', getFormattedText(r.D_nozzle_shell_in / 1000, 'length-mm', 1));
    set('rep-sthe-nozzle-shell-out', getFormattedText(r.D_nozzle_shell_out / 1000, 'length-mm', 1));
    set('rep-sthe-type', r.stheType);
    set('rep-sthe-status', r.areaStatus);
    set('rep-sthe-tube-fluid', inp.tubeSideFluid);
    set('rep-sthe-shell-fluid', inp.shellSideFluid);
    set('rep-sthe-flow', inp.flowArrangement.toUpperCase());
  }
}

function clearPumpReport() {
  const fields = [
    "rep-pump-fluid", "rep-pump-temp", "rep-pump-density", "rep-pump-viscosity",
    "rep-pump-flow-norm", "rep-pump-flow-design", "rep-pump-net-suc-press", "rep-pump-suc-dp",
    "rep-pump-npsha", "rep-pump-npshr", "rep-pump-net-suc", "rep-pump-cavitation",
    "rep-pump-diff-head", "rep-pump-shutoff-head", "rep-pump-eff", "rep-pump-bhp",
    "rep-pump-motor", "rep-pump-tag", "rep-pump-suc-nozzle", "rep-pump-suc-pv",
    "rep-pump-dis-nozzle", "rep-pump-dis-pv"
  ];
  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el) { el.textContent = ""; el.className = "val text-data"; }
  });
}
function clearLineReport() {
  const fields = [
    "rep-line-nps", "rep-line-id", "rep-line-material", "rep-line-length",
    "rep-line-service", "rep-line-flow", "rep-line-velocity", "rep-line-v-erosion",
    "rep-line-reynolds", "rep-line-f", "rep-line-dp-pipe", "rep-line-dp-fittings",
    "rep-line-dp-elevation", "rep-line-dp-other", "rep-line-dp-total", "rep-line-dp-100m"
  ];
  fields.forEach(f => {
    const el = document.getElementById(f);
    if (el) { el.textContent = ""; el.className = "val text-data"; }
  });

  setAuditResult("rep-audit-velocity", "", "warn");
  setAuditResult("rep-audit-dp", "", "warn");
  setAuditResult("rep-audit-erosion", "", "warn");
}

function setAuditResult(elementId, text, status) {
  const el = document.getElementById(elementId);
  if (!el) return;
  
  el.textContent = text;
  el.className = "val font-bold";
  if (status === "ok") el.classList.add("text-teal");
  else if (status === "warn") el.classList.add("text-amber");
  else if (status === "fail") el.classList.add("text-red");
}

// --- Application Init & Bindings ---

// ============================================================
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  // Helper for tuning inputs and recalculating automatically
  window.tunePumpInput = function(id, val) {
    const el = document.getElementById(id);
    if (el) {
      el.value = val;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };

  // Live Clock Update
  const timeDisplay = document.getElementById("current-time");
  setInterval(() => {
    const d = new Date();
    timeDisplay.textContent = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  }, 1000);

  // ── Delegated APPLY button handler for Pump Design Assistant ──
  // Must be on stable parent so it survives innerHTML re-renders
  const pumpAssistantPanel = document.getElementById("pump-assistant-panel");
  if (pumpAssistantPanel) {
    pumpAssistantPanel.addEventListener("click", function(e) {
      const btn = e.target.closest(".apply-pump-correction");
      if (!btn) return;
      e.preventDefault();
      const corrType = btn.getAttribute("data-correction-type");
      if (corrType && typeof applyPumpCorrection === "function") {
        // Visual feedback: flash the button
        btn.style.background = "var(--color-saffron)";
        btn.style.color = "#000";
        setTimeout(() => { applyPumpCorrection(corrType); }, 80);
      }
    });
  }

  // Initialize 3D Scenes (delay slightly so layout is computed for container dimensions)
  setTimeout(() => {
    try { init3DEnvironments(); } catch(e) { console.error("3D init error:", e); }
  }, 100);

  // Auto-fill fluid properties after everything is loaded
  setTimeout(() => {
    try {
      const fluidSel = document.getElementById("pump-fluid");
      const densEl = document.getElementById("pump-density");
      const viscEl = document.getElementById("pump-viscosity");
      if (fluidSel && densEl && viscEl) {
        const preset = FLUID_PRESETS[fluidSel.value];
        if (preset && preset.density) {
          densEl.value = preset.density;
          viscEl.value = preset.viscosity;
          const vpEl = document.getElementById("pump-vapor-pres");
          if (vpEl) vpEl.value = preset.vaporPressure;
          const tmin = document.getElementById("pump-temp-min");
          const tnorm = document.getElementById("pump-temp-norm");
          const tmax = document.getElementById("pump-temp-max");
          if (tmin) tmin.value = (preset.defaultTemp - 5).toFixed(1);
          if (tnorm) tnorm.value = preset.defaultTemp.toFixed(1);
          if (tmax) tmax.value = (preset.defaultTemp + 10).toFixed(1);
        }
      }
    } catch(e) { console.error("Auto-fill fluid error:", e); }
  }, 500);

  // 1. Tab Navigation System
  const tabs = document.querySelectorAll(".nav-tab");
  const contents = document.querySelectorAll(".tab-content");

  tabs.forEach(tab => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-tab");

      tabs.forEach(t => t.classList.remove("active"));
      contents.forEach(c => c.classList.remove("active"));

      tab.classList.add("active");
      document.getElementById(target).classList.add("active");

      logConsole(`Switched active view tab to: ${target.replace("-tab", "").toUpperCase()}`, "info");

      // Lazy-init HEX 3D scenes on tab switch
      if (target === "sthe-tab") {
        setTimeout(function() {
          if (!dphe3D.initialized) {
            var dc = document.getElementById('dphe-3d-container');
            if (dc && dc.clientWidth > 0) try { initDPHE3D(dc); } catch(e) { console.error(e); }
          }
          if (!sthe3D.initialized) {
            var sc = document.getElementById('sthe-3d-container');
            if (sc && sc.clientWidth > 0) try { initSTHE3D(sc); } catch(e) { console.error(e); }
          }
        }, 150);
      }

      // Handle WebGL resizing on tab switch to avoid 0px canvas bug
      if (target === "pump-tab" && pump3D.renderer) {
        const container = document.getElementById("pump-3d-container");
        const w = container.clientWidth || 380;
        const h = container.clientHeight || 180;
        pump3D.camera.aspect = w / h;
        pump3D.camera.updateProjectionMatrix();
        pump3D.renderer.setSize(w, h);
      } else if (target === "line-tab" && line3D.renderer) {
        const container = document.getElementById("line-3d-container");
        const w = container.clientWidth || 380;
        const h = container.clientHeight || 180;
        line3D.camera.aspect = w / h;
        line3D.camera.updateProjectionMatrix();
        line3D.renderer.setSize(w, h);
      }

      if (target === "report-tab") {
        generateSummaryReport();
      }
    });
  });

  // 2. Theme Switching Manager
  const savedTheme = localStorage.getItem("theme");
  const themeToggleBtn = document.getElementById("btn-theme-toggle");
  
  if (savedTheme === "light") {
    document.body.classList.add("light-theme");
    if (themeToggleBtn) themeToggleBtn.querySelector(".theme-icon").textContent = "🌙";
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      document.body.classList.toggle("light-theme");
      const isLight = document.body.classList.contains("light-theme");
      themeToggleBtn.querySelector(".theme-icon").textContent = isLight ? "🌙" : "☀️";
      localStorage.setItem("theme", isLight ? "light" : "dark");
      
      logConsole(`Theme switched to ${isLight ? 'LIGHT' : 'DARK'} mode`, "info");
      
      // Recolors Chart.js canvases according to active theme colors
      redrawChartsThemeUpdate();
    });
  }

  // 3. TAB 1: Fluid Selector Preset Handler
  const pumpFluidSelect = document.getElementById("pump-fluid");
  const pumpDensityInput = document.getElementById("pump-density");
  const pumpViscosityInput = document.getElementById("pump-viscosity");
  const pumpVaporPresInput = document.getElementById("pump-vapor-pres");

  if (pumpFluidSelect) {
    pumpFluidSelect.addEventListener("change", () => {
      const val = pumpFluidSelect.value;
      const preset = FLUID_PRESETS[val];

      if (preset && val !== "custom" && val !== "user_defined") {
        try {
          const uc = window.UNIT_CONVERSIONS;
          const sys = window.activeUnitSystem || 'SI';
          const rhoActive = uc ? uc['density'].fromSI(preset.density, sys) : preset.density;
          const muActive = uc ? uc['viscosity'].fromSI(preset.viscosity, sys) : preset.viscosity;
          const pVapActive = uc ? uc['pressure'].fromSI(preset.vaporPressure, sys) : preset.vaporPressure;
          const tempActive = uc ? uc['temperature'].fromSI(preset.defaultTemp, sys) : preset.defaultTemp;

          if (pumpDensityInput) pumpDensityInput.value = rhoActive.toFixed(2);
          if (pumpViscosityInput) pumpViscosityInput.value = muActive.toFixed(4);
          if (pumpVaporPresInput) pumpVaporPresInput.value = pVapActive.toFixed(4);

          const tempMinEl = document.getElementById("pump-temp-min");
          const tempNormEl = document.getElementById("pump-temp-norm");
          const tempMaxEl = document.getElementById("pump-temp-max");
          if (tempMinEl) tempMinEl.value = (tempActive - 5).toFixed(1);
          if (tempNormEl) tempNormEl.value = tempActive.toFixed(1);
          if (tempMaxEl) tempMaxEl.value = (tempActive + 10).toFixed(1);

          if (tempMaxEl && pumpVaporPresInput) {
            const tempMaxSI = (typeof window.getInputValueSI === 'function') ? window.getInputValueSI("pump-temp-max") : parseFloat(tempMaxEl.value);
            const lookupVapSI = lookupPumpVaporPressure(tempMaxSI);
            const lookupVapDisp = uc ? uc['pressure'].fromSI(lookupVapSI, sys) : lookupVapSI;
            pumpVaporPresInput.value = lookupVapDisp.toFixed(4);
          }

          if (typeof updatePumpFlowRates === 'function') updatePumpFlowRates("vol");
          logConsole(`Pump Fluid changed to preset [${preset.name}]. Density: ${preset.density} kg/m³, Viscosity: ${preset.viscosity} cP.`, "success");
        } catch(e) {
          // Fallback: direct SI values
          if (pumpDensityInput) pumpDensityInput.value = preset.density;
          if (pumpViscosityInput) pumpViscosityInput.value = preset.viscosity;
          if (pumpVaporPresInput) pumpVaporPresInput.value = preset.vaporPressure;
          console.warn("Fluid preset fallback used:", e);
        }
      } else {
        logConsole(`Pump Fluid changed to custom [User Defined]. Please specify fluid parameters.`, "warn");
      }
    });
  }

  // Flow rates (m³/hr and kg/hr) are now auto-calculated inside runActualPumpCalculations from l/hr input

  const pumpTempMax = document.getElementById("pump-temp-max");
  if (pumpTempMax) {
    const handleTempMaxChange = () => {
      const vpInput = document.getElementById("pump-vapor-pres");
      if (vpInput && vpInput.value === '') {
        const tempMaxSI = window.getInputValueSI("pump-temp-max");
        const pVapSI = lookupPumpVaporPressure(tempMaxSI);
        const pVapActive = window.UNIT_CONVERSIONS['pressure'].fromSI(pVapSI, window.activeUnitSystem);
        vpInput.value = pVapActive.toFixed(4);
      }
      runActualPumpCalculations();
    };
    pumpTempMax.addEventListener("input", handleTempMaxChange);
    pumpTempMax.addEventListener("change", handleTempMaxChange);
  }

  // 4. TAB 2: Fluid Selector Preset Handler
  const lineFluidSelect = document.getElementById("line-fluid");
  const lineDensityInput = document.getElementById("line-density");
  const lineViscosityInput = document.getElementById("line-viscosity");

  if (lineFluidSelect) {
    lineFluidSelect.addEventListener("change", () => {
      const val = lineFluidSelect.value;
      const preset = FLUID_PRESETS[val];
      
      if (preset && val !== "custom" && val !== "user_defined") {
        if (lineDensityInput) lineDensityInput.value = preset.density;
        if (lineViscosityInput) lineViscosityInput.value = preset.viscosity;
        logConsole(`Line Sizing Fluid changed to preset [${preset.name}]. Density: ${preset.density} kg/m³, Viscosity: ${preset.viscosity} cP.`, "success");
      } else {
        logConsole(`Line Sizing Fluid changed to custom [User Defined]. Please specify parameters.`, "warn");
      }
    });
  }

  // Pipe Material & Roughness Handler
  const lineMaterialSelect = document.getElementById("line-material");
  const lineRoughnessInput = document.getElementById("line-roughness");

  lineMaterialSelect.addEventListener("change", () => {
    const mat = lineMaterialSelect.value;
    const roughness = MATERIAL_ROUGHNESS[mat];
    if (roughness !== undefined) {
      lineRoughnessInput.value = roughness;
      logConsole(`Pipe material changed to preset [${lineMaterialSelect.options[lineMaterialSelect.selectedIndex].text}]. Roughness set to: ${roughness} mm.`, "success");
    }
  });

  // Pipe NPS Size & Schedule Handler
  const lineNpsSelect = document.getElementById("line-nps");
  const lineScheduleSelect = document.getElementById("line-schedule");
  const lineIdInput = document.getElementById("line-id");

  function updateAutoFilledID() {
    const size = lineNpsSelect.value;
    const sch = lineScheduleSelect.value;
    
    const sizeData = PIPE_DATABASE[size];
    if (sizeData) {
      const id = sizeData[sch];
      if (id !== undefined) {
        lineIdInput.value = id;
        logConsole(`Selected pipe dimensions: NPS ${size}" Schedule ${sch}. Auto-filled ID: ${id} inches.`, "success");
      } else {
        const stdId = sizeData["STD"] || sizeData["40"];
        lineIdInput.value = stdId;
        logConsole(`Schedule ${sch} not defined for NPS ${size}". Falling back to standard ID: ${stdId} inches.`, "warn");
      }
    }
  }

  lineNpsSelect.addEventListener("change", updateAutoFilledID);
  lineScheduleSelect.addEventListener("change", updateAutoFilledID);

  // --- Copy Report to Clipboard ---
  const copyReportBtn = document.getElementById("btn-copy-report");
  copyReportBtn.addEventListener("click", () => {
    let reportText = `======================================================================\n`;
    reportText += `                   BHARAT FLOWSIZE PRO SIZING REPORT                  \n`;
    reportText += `======================================================================\n`;
    reportText += `TIMESTAMP: ${getTimestamp()}\n\n`;

    reportText += `----------------------------------------------------------------------\n`;
    reportText += `1. PUMP HYDRAULICS SUMMARY\n`;
    reportText += `----------------------------------------------------------------------\n`;
    if (state.pump.calculated) {
      const pIn = state.pump.inputs;
      const pOut = state.pump.results;
      reportText += `Fluid Preset:                   ${pIn.fluidVal}\n`;
      reportText += `Operating Temperature (Min/N/Max): ${pIn.tempMin} / ${pIn.tempNorm} / ${pIn.tempMax} °C\n`;
      reportText += `Fluid Density:                  ${pIn.rho} kg/m³\n`;
      reportText += `Fluid Viscosity:                ${pIn.mu} cP\n`;
      reportText += `Normal Volumetric Flow:          ${pIn.normalVolFlow.toFixed(2)} m³/hr\n`;
      reportText += `Design Volumetric Flow:          ${pOut.designVolFlow.toFixed(2)} m³/hr (${pIn.margin}% margin)\n`;
      reportText += `Static Head (LLL - Pump C/L):    ${pOut.staticHead.toFixed(3)} bar\n`;
      reportText += `Suction Line Pressure Drop:     ${pIn.suctionDp.toFixed(4)} bar\n`;
      reportText += `Net Suction Pressure (Abs):     ${pOut.pNet.toFixed(3)} bar A\n`;
      reportText += `NPSH Available (NPSHa):         ${pOut.npsha.toFixed(2)} m\n`;
      reportText += `NPSH Required (NPSHr):          ${pIn.npshr.toFixed(2)} m\n`;
      reportText += `NPSH Margin:                    ${pOut.npshMargin.toFixed(2)} m\n`;
      reportText += `Cavitation Verdict:             ${pOut.cavText}\n`;
      reportText += `Estimated Pump Efficiency:      ${(pOut.efficiency * 100).toFixed(0)} %\n`;
      reportText += `Brake Power (BHP):              ${pOut.bhp.toFixed(2)} kW\n`;
      reportText += `Recommended Motor Power:        ${pOut.motorPower.toFixed(2)} kW\n`;
    } else {
      reportText += `[AWAITING RUN PUMP CALCULATION]\n`;
    }
    reportText += `\n`;

    reportText += `----------------------------------------------------------------------\n`;
    reportText += `2. LINE SIZING SUMMARY\n`;
    reportText += `----------------------------------------------------------------------\n`;
    if (state.line.calculated) {
      const lIn = state.line.inputs;
      const lOut = state.line.results;
      const lineType = state.line.activeType;
      reportText += `Line Sizing Type:               ${lineType.toUpperCase()}\n`;
      reportText += `Line Size / Schedule:           NPS ${lIn.npsText}" Schedule ${lIn.schText}\n`;
      reportText += `Pipe Inside Diameter (ID):      ${lIn.idInches.toFixed(3)} inches (${(lOut.idM * 1000).toFixed(1)} mm)\n`;

      if (lineType === 'liquid') {
        reportText += `Pipe Material Roughness:        ${lIn.matVal} (${lIn.roughnessMm} mm)\n`;
        reportText += `Pipe Route Length:              ${lIn.length.toFixed(1)} m\n`;
        reportText += `Line Service Category:          ${lIn.serviceType.toUpperCase()}\n`;
        reportText += `Fluid Volumetric Flow:          ${lIn.qVol.toFixed(2)} m³/hr\n`;
        reportText += `Actual Fluid Velocity:          ${lOut.velocity.toFixed(2)} m/s (Limit: ${lOut.limits.minV.toFixed(1)} - ${lOut.limits.maxV.toFixed(1)} m/s)\n`;
        reportText += `Erosion Velocity Limit (API):   ${lOut.vErosion.toFixed(2)} m/s\n`;
        reportText += `Reynolds Number / Flow Regime:  ${lOut.reynolds.toLocaleString(undefined, {maximumFractionDigits:0})} [${lOut.regimeText.toUpperCase()}]\n`;
        reportText += `Friction Factor (Darcy):        ${lOut.frictionFactor.toFixed(5)}\n`;
        reportText += `TOTAL PRESSURE LOSS:            ${lOut.dpTotal.toFixed(4)} bar\n`;
        reportText += `Unit Pressure Drop (/100m):     ${lOut.dp100m.toFixed(3)} bar/100m\n`;
      } else if (lineType === 'gas') {
        reportText += `Gas Density (calc):             ${lOut.rho_gas.toFixed(3)} kg/m³\n`;
        reportText += `Gas Velocity:                   ${lOut.velocity.toFixed(2)} m/s\n`;
        reportText += `Mach Number:                    ${lOut.Mach.toFixed(4)}\n`;
        reportText += `Momentum (ρv²):                ${lOut.momentum.toFixed(0)} Pa\n`;
        reportText += `TOTAL PRESSURE LOSS:            ${lOut.dpTotal.toFixed(4)} bar\n`;
        reportText += `Unit Pressure Drop (/100m):     ${lOut.dp100m.toFixed(3)} bar/100m\n`;
      } else if (lineType === 'steam') {
        reportText += `Steam Density:                  ${lOut.rho.toFixed(3)} kg/m³\n`;
        reportText += `T_sat:                          ${lOut.T_sat.toFixed(1)} °C\n`;
        reportText += `Specific Volume:                ${lOut.specificVolume.toFixed(4)} m³/kg\n`;
        reportText += `Steam Velocity:                 ${lOut.velocity.toFixed(2)} m/s\n`;
        reportText += `TOTAL PRESSURE LOSS:            ${lOut.dpTotal.toFixed(4)} bar\n`;
        reportText += `Unit Pressure Drop (/100m):     ${lOut.dp100m.toFixed(3)} bar/100m\n`;
      } else if (lineType === 'slurry') {
        reportText += `Slurry Density:                 ${lOut.rho_slurry.toFixed(1)} kg/m³\n`;
        reportText += `Slurry Viscosity:               ${lOut.mu_slurry_cP.toFixed(3)} cP\n`;
        reportText += `Volume Fraction (Cv):           ${(lOut.Cv * 100).toFixed(2)}%\n`;
        reportText += `Deposition Velocity:            ${lOut.V_deposit.toFixed(2)} m/s\n`;
        reportText += `Actual Velocity:                ${lOut.velocity.toFixed(2)} m/s\n`;
        reportText += `TOTAL PRESSURE LOSS:            ${lOut.dpTotal.toFixed(4)} bar\n`;
      } else if (lineType === 'two_phase') {
        reportText += `Mixture Velocity (VM):          ${lOut.VM.toFixed(2)} m/s\n`;
        reportText += `Void Fraction (α):              ${(lOut.alpha * 100).toFixed(2)}%\n`;
        reportText += `L-M Parameter (Xtt):            ${lOut.Xtt.toFixed(4)}\n`;
        reportText += `Two-Phase Multiplier (ΦL²):     ${lOut.PhiL2.toFixed(3)}\n`;
        reportText += `Flow Pattern:                   ${lOut.flowPattern}\n`;
        reportText += `TOTAL ΔP (TP):                  ${lOut.dpTP_total_bar.toFixed(4)} bar\n`;
      }
      reportText += `\n`;
      reportText += `COMPLIANCE AUDIT VERDICTS:\n`;
      reportText += `- Velocity Compliance:          ${lOut.velText}\n`;
      reportText += `- Pressure Drop Compliance:     ${lOut.dpText}\n`;
    } else {
      reportText += `[AWAITING RUN LINE CALCULATION]\n`;
    }
    reportText += `======================================================================\n`;

    navigator.clipboard.writeText(reportText).then(() => {
      logConsole(`Summary Report successfully copied to system clipboard!`, "success");
      
      const originalText = copyReportBtn.innerHTML;
      copyReportBtn.innerHTML = `<span class="btn-text">COPIED!</span> <span class="btn-icon">✓</span>`;
      copyReportBtn.style.borderColor = "var(--color-green)";
      copyReportBtn.style.color = "var(--color-green)";
      
      setTimeout(() => {
        copyReportBtn.innerHTML = originalText;
        copyReportBtn.style.borderColor = "";
        copyReportBtn.style.color = "";
      }, 2000);
    }).catch(err => {
      logConsole(`Failed to copy clipboard report: ${err.message}`, "error");
    });
  });

  // --- Download PDF Exporter ---
  const downloadPdfBtn = document.getElementById("btn-download-pdf");
  downloadPdfBtn.addEventListener("click", () => {
    if (!state.pump.calculated && !state.line.calculated) {
      logConsole("Cannot export PDF: No sizing simulations evaluated yet.", "error");
      alert("Please run pump or line calculations before exporting the datasheet PDF.");
      return;
    }

    logConsole("Initiating PDF Export solver...", "info");
    
    // Select report viewport element
    const element = document.getElementById('report-viewport');
    
    // Configure pdf settings dynamically based on active theme
    const isLight = document.body.classList.contains("light-theme");
    const opt = {
      margin:       10,
      filename:     `BHARAT_FLOWSIZE_REPORT_${new Date().toISOString().slice(0,10)}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2.2, useCORS: true, backgroundColor: isLight ? '#ffffff' : '#040812' },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // Run html2pdf download
    html2pdf().set(opt).from(element).save().then(() => {
      logConsole("PDF Datasheet successfully compiled and downloaded!", "success");
    }).catch(err => {
      logConsole(`PDF compiling failed: ${err.message}`, "error");
    });
  });

  // ── Pump AI Chatbot ──
  var pumpChatToggle = document.getElementById('pump-chatbot-toggle');
  if (pumpChatToggle) pumpChatToggle.style.display = 'block';

  window.togglePumpChatbot = function() {
    var panel = document.getElementById('pump-chatbot-panel');
    var msgs = document.getElementById('pump-chat-messages');
    if (panel.style.display === 'none') {
      panel.style.display = 'block';
      if (!msgs.innerHTML) {
        msgs.innerHTML = '<div style="color:#fbbf24;margin-bottom:8px;"><strong>🤖 Pump Hydraulics AI Assistant</strong></div>' +
          '<div style="color:#94a3b8;">I can help with:<br/>• NPSH calculations & cavitation<br/>• Head & pressure calculations<br/>• Motor sizing & efficiency<br/>• Suction/discharge piping<br/>• Nozzle velocity limits<br/>• Affinity laws & system curves<br/>• API 610 / ISO 5199 standards<br/><br/>Ask me anything about your pump design!</div>';
      }
    } else {
      panel.style.display = 'none';
    }
  };

  window.pumpChatSend = function() {
    var input = document.getElementById('pump-chat-input');
    var msgs = document.getElementById('pump-chat-messages');
    var q = input.value.trim().toLowerCase();
    if (!q) return;
    msgs.innerHTML += '<div style="margin:6px 0;text-align:right;"><span style="background:rgba(245,158,11,0.15);padding:4px 8px;border-radius:6px;color:#fbbf24;">' + input.value + '</span></div>';

    var r = '';
    if (q.includes('npsh') || q.includes('cavitation') || q.includes('suction')) {
      r = '📐 <strong>NPSH (Net Positive Suction Head):</strong><br/>' +
        '• NPSHa = P_vessel + H_static - H_friction - P_vapor (all in meters of liquid)<br/>' +
        '• NPSHr is from pump curve (manufacturer data)<br/>' +
        '• <strong>Rule:</strong> NPSHa/NPSHr ratio must be ≥ 1.3 (30% safety margin per API 610)<br/>' +
        '• If NPSHa < NPSHr → cavitation occurs → impeller damage, noise, vibration<br/>' +
        '• <strong>Fix low NPSHa:</strong> Raise vessel, reduce suction line losses, increase pipe size, reduce fluid temperature';
    } else if (q.includes('head') || q.includes('tdh') || q.includes('differential')) {
      r = '📐 <strong>Total Dynamic Head (TDH):</strong><br/>' +
        '• TDH = H_static + H_friction + H_pressure_diff<br/>' +
        '• H_static = discharge elevation - suction elevation<br/>' +
        '• H_friction = pipe friction + fittings + valve losses (Darcy-Weisbach)<br/>' +
        '• H_pressure = (P_discharge - P_suction) × 10.2 / ρ<br/>' +
        '• <strong>Unit:</strong> Always express in meters of liquid column (m) for pump selection';
    } else if (q.includes('motor') || q.includes('power') || q.includes('bhp') || q.includes('efficiency')) {
      r = '⚡ <strong>Motor & Power Sizing:</strong><br/>' +
        '• Hydraulic Power = ρ × g × Q × H / 1000 (kW)<br/>' +
        '• BHP = Hydraulic Power / η_pump<br/>' +
        '• Motor kW = BHP / η_motor × safety factor (1.1-1.25)<br/>' +
        '• <strong>API 610 motor margins:</strong> ≤22kW: +25%, 22-55kW: +15%, >55kW: +10%<br/>' +
        '• Motor loading should be 75-90% of rated power for optimal efficiency<br/>' +
        '• Oversize motor = low power factor, undersize = overheating risk';
    } else if (q.includes('nozzle') || q.includes('velocity') || q.includes('pipe size')) {
      r = '🔧 <strong>Nozzle & Velocity Guidelines:</strong><br/>' +
        '• Suction nozzle: 1.0-2.0 m/s (API 610 max 2.4 m/s)<br/>' +
        '• Discharge nozzle: 2.5-4.5 m/s (API 610 max 6.0 m/s)<br/>' +
        '• <strong>Rule:</strong> Discharge nozzle ID must be ≤ suction nozzle ID<br/>' +
        '• High velocity → erosion, noise, pressure drop<br/>' +
        '• Low velocity → oversized piping, settling (slurry)';
    } else if (q.includes('affinity') || q.includes('speed') || q.includes('impeller')) {
      r = '🔄 <strong>Affinity Laws (Speed/Impeller Change):</strong><br/>' +
        '• Q₂/Q₁ = N₂/N₁ (flow ∝ speed)<br/>' +
        '• H₂/H₁ = (N₂/N₁)² (head ∝ speed²)<br/>' +
        '• P₂/P₁ = (N₂/N₁)³ (power ∝ speed³)<br/>' +
        '• Same ratios apply for impeller diameter trim<br/>' +
        '• VFD (Variable Frequency Drive) saves energy by reducing speed';
    } else if (q.includes('seal') || q.includes('mechanical') || q.includes('gland')) {
      r = '🔩 <strong>Mechanical Seal & Gland Packing:</strong><br/>' +
        '• Mechanical seals: preferred for >10 bar, toxic, or high-speed<br/>' +
        '• Gland packing: economical for low-pressure, non-critical service<br/>' +
        '• Seal flush plans: API Plan 11 (internal recirculation), Plan 21 (cooled), Plan 54 (external barrier)<br/>' +
        '• Seal chamber pressure must exceed vapor pressure by ≥1 bar';
    } else if (q.includes('api') || q.includes('standard') || q.includes('610') || q.includes('iso')) {
      r = '📋 <strong>Pump Standards:</strong><br/>' +
        '• <strong>API 610:</strong> Centrifugal pumps for petroleum/heavy-duty — centerline mounted, heavy-wall casing<br/>' +
        '• <strong>ISO 5199:</strong> Technical specs for centrifugal pumps, Class II/III<br/>' +
        '• <strong>ASME B73.1:</strong> Chemical process pumps (ANSI pumps)<br/>' +
        '• <strong>HI Standards:</strong> Hydraulic Institute — test procedures, NPSH margins, vibration limits';
    } else if (q.includes('vibration') || q.includes('noise') || q.includes('bearing')) {
      r = '📊 <strong>Vibration & Bearing Life:</strong><br/>' +
        '• API 610 vibration limits: 2.5 mm/s RMS (unfiltered)<br/>' +
        '• L10 bearing life: minimum 25,000 hours (API 610)<br/>' +
        '• Common causes: misalignment, imbalance, cavitation, pipe strain<br/>' +
        '• Monitor: accelerometer on bearing housing, measure velocity in mm/s';
    } else if (q.includes('curve') || q.includes('system') || q.includes('operating point') || q.includes('bep')) {
      r = '📈 <strong>Pump & System Curves:</strong><br/>' +
        '• Operating point = intersection of pump curve and system curve<br/>' +
        '• BEP (Best Efficiency Point): operate within 70-120% of BEP flow<br/>' +
        '• Left of BEP: recirculation, high radial loads, temperature rise<br/>' +
        '• Right of BEP: cavitation risk, shaft deflection, NPSH issues<br/>' +
        '• System curve: H_sys = H_static + K × Q² (friction is quadratic)';
    } else if (q.includes('specific speed') || q.includes('ns') || q.includes('type')) {
      r = '🏷 <strong>Specific Speed & Pump Type Selection:</strong><br/>' +
        '• Ns = N√Q / H^0.75 (N in rpm, Q in m³/s, H in m)<br/>' +
        '• Ns < 1000: Radial (centrifugal) — high head, low flow<br/>' +
        '• Ns 1000-5000: Mixed flow — medium head & flow<br/>' +
        '• Ns > 5000: Axial flow — low head, high flow<br/>' +
        '• Higher Ns → flatter curve, higher efficiency at high flow';
    } else {
      r = '🤖 I\'m your Pump Hydraulics AI Assistant! I can help with:<br/>' +
        '• <strong>NPSH & cavitation</strong> — type "npsh" or "cavitation"<br/>' +
        '• <strong>Head calculations</strong> — type "head" or "tdh"<br/>' +
        '• <strong>Motor sizing</strong> — type "motor" or "power"<br/>' +
        '• <strong>Nozzle velocities</strong> — type "nozzle" or "velocity"<br/>' +
        '• <strong>Affinity laws</strong> — type "affinity" or "speed"<br/>' +
        '• <strong>Pump curves & BEP</strong> — type "curve" or "bep"<br/>' +
        '• <strong>Mechanical seals</strong> — type "seal"<br/>' +
        '• <strong>API/ISO standards</strong> — type "api" or "standard"<br/>' +
        '• <strong>Vibration & bearings</strong> — type "vibration"<br/>' +
        '• <strong>Specific speed</strong> — type "specific speed"';
    }
    msgs.innerHTML += '<div style="margin:6px 0;"><span style="background:rgba(59,130,246,0.1);padding:6px 10px;border-radius:6px;display:inline-block;border-left:3px solid #3b82f6;color:#cbd5e1;">' + r + '</span></div>';
    msgs.scrollTop = msgs.scrollHeight;
    input.value = '';
  };

  // ── Global RUN button feedback (✓ checkmark animation) ──
  window.showCalcFeedback = function(form) {
    var btn = form ? form.querySelector('button[type="submit"]') : null;
    if (!btn) return;
    var orig = btn.innerHTML;
    var origBg = btn.style.background;
    var origBorder = btn.style.border;
    btn.innerHTML = '<span style="color:#22c55e;font-weight:900;font-size:1.1em;">⚡ CALCULATING...</span>';
    btn.style.background = 'linear-gradient(135deg, #064e3b, #065f46)';
    btn.style.border = '2px solid #22c55e';
    setTimeout(function() {
      btn.innerHTML = '<span style="color:#22c55e;font-weight:900;font-size:1.1em;">✓ UPDATED SUCCESSFULLY</span>';
      setTimeout(function() {
        btn.innerHTML = orig;
        btn.style.background = origBg || '';
        btn.style.border = origBorder || '';
      }, 2000);
    }, 500);
  };

  // Bind Form Submit Event Listeners to prevent page reload and trigger calculations
  const pumpForm = document.getElementById("pump-form");
  if (pumpForm) {
    pumpForm.addEventListener("submit", (e) => {
      e.preventDefault();
      window.showCalcFeedback(pumpForm);
      executePumpCalculations();
    });
  }

  const lineForm = document.getElementById("line-form");
  if (lineForm) {
    lineForm.addEventListener("submit", (e) => {
      e.preventDefault();
      window.showCalcFeedback(lineForm);
      executeLineCalculations();
    });
  }

  // Live recalculations on input changes (real-time simulation updates)
  const pumpInputs = document.querySelectorAll("#pump-form input, #pump-form select");
  pumpInputs.forEach(input => {
    input.addEventListener("input", () => {
      try {
        if (window.isApplyingCorrection) return;
        debouncedPushUndo('pump', '#pump-form');
        resetPumpCorrections();
        runActualPumpCalculations();
      } catch(e) { console.error("Pump input handler error:", e); }
    });
    input.addEventListener("change", () => {
      try {
        if (window.isApplyingCorrection) return;
        debouncedPushUndo('pump', '#pump-form');
        resetPumpCorrections();
        runActualPumpCalculations();
      } catch(e) { console.error("Pump change handler error:", e); }
    });
  });

  // Auto-set vessel pressure on source type change
  const sucSourceSel = document.getElementById("pump-suc-source-type");
  function applyVesselPressMode() {
    var pressInput = document.getElementById("pump-vessel-press-g");
    if (!pressInput || !sucSourceSel) return;
    if (sucSourceSel.value === "atmospheric") {
      pressInput.value = "0";
      pressInput.readOnly = true;
      pressInput.style.background = "#050d05";
      pressInput.style.color = "var(--color-saffron)";
    } else {
      pressInput.readOnly = false;
      pressInput.style.background = "";
      pressInput.style.color = "";
      if (parseFloat(pressInput.value) < 1) pressInput.value = "1";
    }
  }
  if (sucSourceSel) {
    sucSourceSel.addEventListener("change", function() {
      applyVesselPressMode();
      resetPumpCorrections();
      runActualPumpCalculations();
    });
    applyVesselPressMode();
  }

  // Reset button — clear all pump inputs to blank and outputs to "-"
  const resetBtn = document.getElementById("pump-reset-btn");
  if (resetBtn) {
    resetBtn.addEventListener("click", function() {
      // Clear all pump inputs
      document.querySelectorAll('#pump-tab .pump-input').forEach(function(inp) {
        inp.value = '';
      });
      // Clear specific editable fields
      ['pump-vapor-pres','pump-vol-flow-m3hr','pump-vol-flow-lhr','pump-npshr','pump-mass-flow',
       'pump-npshr-vendor','pump-margin','pump-vessel-press-g','pump-vessel-el','pump-lll',
       'pump-centreline-el','pump-atm-pressure','pump-disch-el','pump-disch-equip-press-g',
       'pump-density','pump-viscosity','pump-temp-max','pump-temp-norm','pump-temp-min',
       'pump-vapor-pres-m-display','pump-design-flow-display','pump-vessel-press-a-display'
      ].forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.value = '';
      });
      // Clear all output spans
      document.querySelectorAll('[id^="out-pump-"]').forEach(function(el) {
        el.textContent = '-';
      });
      // Clear report fields
      clearPumpReport();
      resetPumpCorrections();
    });
  }

  // --- Undo/Redo Button Listeners ---
  var pumpUndoBtn = document.getElementById('pump-undo-btn');
  if (pumpUndoBtn) pumpUndoBtn.addEventListener('click', function() { performUndo('pump', '#pump-form', runActualPumpCalculations); });
  var pumpRedoBtn = document.getElementById('pump-redo-btn');
  if (pumpRedoBtn) pumpRedoBtn.addEventListener('click', function() { performRedo('pump', '#pump-form', runActualPumpCalculations); });

  var lineUndoBtn = document.getElementById('line-undo-btn');
  if (lineUndoBtn) lineUndoBtn.addEventListener('click', function() { performUndo('line', '#line-form', executeLineCalculations); });
  var lineRedoBtn = document.getElementById('line-redo-btn');
  if (lineRedoBtn) lineRedoBtn.addEventListener('click', function() { performRedo('line', '#line-form', executeLineCalculations); });

  var gasUndoBtn = document.getElementById('gas-undo-btn');
  if (gasUndoBtn) gasUndoBtn.addEventListener('click', function() { performUndo('gas', '#gas-form', runActualGasCalculations); });
  var gasRedoBtn = document.getElementById('gas-redo-btn');
  if (gasRedoBtn) gasRedoBtn.addEventListener('click', function() { performRedo('gas', '#gas-form', runActualGasCalculations); });

  var dpheUndoBtn = document.getElementById('dphe-undo-btn');
  if (dpheUndoBtn) dpheUndoBtn.addEventListener('click', function() { performUndo('dphe', '#dphe-form', null); });
  var dpheRedoBtn = document.getElementById('dphe-redo-btn');
  if (dpheRedoBtn) dpheRedoBtn.addEventListener('click', function() { performRedo('dphe', '#dphe-form', null); });

  var stheUndoBtn = document.getElementById('sthe-undo-btn');
  if (stheUndoBtn) stheUndoBtn.addEventListener('click', function() { performUndo('sthe', '#sthe-form', typeof calculateSTHE === 'function' ? calculateSTHE : null); });
  var stheRedoBtn = document.getElementById('sthe-redo-btn');
  if (stheRedoBtn) stheRedoBtn.addEventListener('click', function() { performRedo('sthe', '#sthe-form', typeof calculateSTHE === 'function' ? calculateSTHE : null); });

  // --- Line Reset Button ---
  var lineResetBtn = document.getElementById('line-reset-btn');
  if (lineResetBtn) lineResetBtn.addEventListener('click', function() {
    document.querySelectorAll('#line-form input[type=number]').forEach(function(i) { i.value = ''; });
    document.querySelectorAll('#line-form input[type=text]').forEach(function(i) { i.value = ''; });
    document.querySelectorAll('#line-form select').forEach(function(s) { s.selectedIndex = 0; });
    document.querySelectorAll('[id^="out-line-"]').forEach(function(el) { el.textContent = ''; });
    clearLineReport();
  });

  // --- Gas Reset Button ---
  var gasResetBtn = document.getElementById('gas-reset-btn');
  if (gasResetBtn) gasResetBtn.addEventListener('click', function() {
    document.querySelectorAll('#gas-form input[type=number]').forEach(function(i) { i.value = ''; });
    document.querySelectorAll('#gas-form input[type=text]').forEach(function(i) { i.value = ''; });
    document.querySelectorAll('#gas-form select').forEach(function(s) { s.selectedIndex = 0; });
    document.querySelectorAll('[id^="out-gas-"]').forEach(function(el) { el.textContent = ''; });
  });

  // --- STHE Reset Button ---
  var stheResetBtn = document.getElementById('sthe-reset-btn');
  if (stheResetBtn) stheResetBtn.addEventListener('click', function() {
    document.querySelectorAll('#sthe-form input[type=number]').forEach(function(i) { i.value = ''; });
    document.querySelectorAll('#sthe-form input[type=text]').forEach(function(i) { i.value = ''; });
    document.querySelectorAll('#sthe-form select').forEach(function(s) { s.selectedIndex = 0; });
    var stheResults = document.getElementById('sthe-results');
    if (stheResults) stheResults.style.display = 'none';
  });

  // --- NPSH Margin Table Input Event Listeners ---
  const npshRadioButtons = document.querySelectorAll('input[name="npsh-active-row"]');
  npshRadioButtons.forEach(radio => {
    radio.addEventListener("change", () => {
      runActualPumpCalculations();
    });
  });

  const npshValueInputs = document.querySelectorAll('input[id^="npsh-val-"]');
  npshValueInputs.forEach(input => {
    input.addEventListener("input", () => {
      runActualPumpCalculations();
    });
    input.addEventListener("change", () => {
      runActualPumpCalculations();
    });
  });

  // --- Motor Oversizing Check select input listeners ---
  ['pump-check-suc-nozzle-select', 'pump-check-dis-nozzle-select', 'pump-check-autotune-select'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("change", () => {
        runActualPumpCalculations();
      });
    }
  });

  // --- Suction dP radio listeners ---
  document.querySelectorAll('input[name="suc-dp-radio"]').forEach(radio => {
    radio.addEventListener("change", () => { runActualPumpCalculations(); });
  });
  ['suc-dp-short','suc-dp-normal','suc-dp-long','suc-dp-user'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", () => { runActualPumpCalculations(); });
  });

  // --- Discharge dP radio listeners ---
  document.querySelectorAll('input[name="dis-dp-radio"]').forEach(radio => {
    radio.addEventListener("change", () => { runActualPumpCalculations(); });
  });
  ['dis-dp-veryshort','dis-dp-normal','dis-dp-long','dis-dp-user'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", () => { runActualPumpCalculations(); });
  });

  // --- Fluid dropdown auto-fill density/viscosity ---
  const fluidDropdown2 = document.getElementById("pump-fluid");
  if (fluidDropdown2) {
    fluidDropdown2.addEventListener("change", () => {
      const densEl2 = document.getElementById("pump-density");
      const viscEl2 = document.getElementById("pump-viscosity");
      if (densEl2) delete densEl2.dataset.userOverride;
      if (viscEl2) delete viscEl2.dataset.userOverride;
      runActualPumpCalculations();
    });
  }

  // Mark density/viscosity as user-overridden when typed manually
  const densEl3 = document.getElementById("pump-density");
  if (densEl3) densEl3.addEventListener("input", () => { densEl3.dataset.userOverride = "1"; });
  const viscEl3 = document.getElementById("pump-viscosity");
  if (viscEl3) viscEl3.addEventListener("input", () => { viscEl3.dataset.userOverride = "1"; });

  // Temp max triggers VP auto-update
  const tempMaxEl2 = document.getElementById("pump-temp-max");
  if (tempMaxEl2) {
    tempMaxEl2.addEventListener("input", () => { runActualPumpCalculations(); });
  }


  // Master APPLY ALL button listener
  const btnApplyAll = document.getElementById("btn-pump-apply-all-suggestions");
  if (btnApplyAll) {
    btnApplyAll.addEventListener("click", () => {
      applyAllPumpSuggestions();
    });
  }

  const lineInputs = document.querySelectorAll("#line-form input, #line-form select");
  lineInputs.forEach(input => {
    input.addEventListener("input", () => {
      debouncedPushUndo('line', '#line-form');
      runActualLineCalculations();
    });
    input.addEventListener("change", () => {
      debouncedPushUndo('line', '#line-form');
      runActualLineCalculations();
    });
  });

  // --- Line Type Sub-Tab Switching ---
  const lineTypeTabs = document.querySelectorAll('.line-type-tab');
  const lineTypeContents = document.querySelectorAll('.line-type-content');

  lineTypeTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const type = tab.getAttribute('data-line-type');
      state.line.activeType = type;

      lineTypeTabs.forEach(t => t.classList.remove('active'));
      lineTypeContents.forEach(c => c.classList.remove('active'));

      tab.classList.add('active');
      const content = document.getElementById('line-' + type + '-content');
      if (content) {
        content.classList.add('active');
        content.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      // Lazy-init 3D scenes for gas/steam sub-tabs
      if (type === 'gas' && !gas3D.initialized) {
        setTimeout(function() {
          try {
            var gc = document.getElementById('gas-3d-container');
            if (gc && gc.clientWidth > 0) initGas3D(gc);
          } catch(e) { console.error('Gas 3D init error:', e); }
        }, 100);
      }

      logConsole('Switched line sizing type to: ' + type.toUpperCase(), 'info');
    });
  });

  // --- Gas Form Submit + Real-Time Input Listeners ---
  const gasForm = document.getElementById('gas-form');
  if (gasForm) {
    gasForm.addEventListener('submit', (e) => { e.preventDefault(); runActualGasCalculations(); });
    gasForm.querySelectorAll('input, select').forEach(el => {
      el.addEventListener('input', () => { debouncedPushUndo('gas', '#gas-form'); runActualGasCalculations(); });
      el.addEventListener('change', () => { debouncedPushUndo('gas', '#gas-form'); runActualGasCalculations(); });
    });
  }

  // --- Steam Form Submit + Real-Time Input Listeners ---
  const steamForm = document.getElementById('steam-form');
  if (steamForm) {
    steamForm.addEventListener('submit', (e) => { e.preventDefault(); runActualSteamCalculations(); });
    steamForm.querySelectorAll('input, select').forEach(el => {
      el.addEventListener('input', () => runActualSteamCalculations());
      el.addEventListener('change', () => runActualSteamCalculations());
    });
  }

  // --- Slurry Form Submit + Real-Time Input Listeners ---
  const slurryForm = document.getElementById('slurry-form');
  if (slurryForm) {
    slurryForm.addEventListener('submit', (e) => { e.preventDefault(); runActualSlurryCalculations(); });
    slurryForm.querySelectorAll('input, select').forEach(el => {
      el.addEventListener('input', () => runActualSlurryCalculations());
      el.addEventListener('change', () => runActualSlurryCalculations());
    });
  }

  // --- Two-Phase Form Submit + Real-Time Input Listeners ---
  const tpForm = document.getElementById('tp-form');
  if (tpForm) {
    tpForm.addEventListener('submit', (e) => { e.preventDefault(); runActualTwoPhaseCalculations(); });
    tpForm.querySelectorAll('input, select').forEach(el => {
      el.addEventListener('input', () => runActualTwoPhaseCalculations());
      el.addEventListener('change', () => runActualTwoPhaseCalculations());
    });
  }

  // --- Auto-fill Pipe ID for New Forms ---
  function setupPipeAutoFill(npsId, schId, idId) {
    const npsEl = document.getElementById(npsId);
    const schEl = document.getElementById(schId);
    const idEl = document.getElementById(idId);
    if (!npsEl || !schEl || !idEl) return;

    function autoFillID() {
      const size = npsEl.value;
      const sch = schEl.value;
      const sizeData = PIPE_DATABASE[size];
      if (sizeData) {
        const id = sizeData[sch];
        if (id !== undefined) {
          idEl.value = id;
        } else {
          const stdId = sizeData['STD'] || sizeData['40'];
          if (stdId) idEl.value = stdId;
        }
      }
    }
    npsEl.addEventListener('change', autoFillID);
    schEl.addEventListener('change', autoFillID);
  }

  setupPipeAutoFill('gas-nps', 'gas-schedule', 'gas-id');
  setupPipeAutoFill('steam-nps', 'steam-schedule', 'steam-id');
  setupPipeAutoFill('slurry-nps', 'slurry-schedule', 'slurry-id');
  setupPipeAutoFill('tp-nps', 'tp-schedule', 'tp-id');

  // --- Auto-fill Roughness for New Forms ---
  function setupRoughnessAutoFill(matId, roughId) {
    const matEl = document.getElementById(matId);
    const roughEl = document.getElementById(roughId);
    if (!matEl || !roughEl) return;

    matEl.addEventListener('change', () => {
      const mat = matEl.value;
      const roughness = MATERIAL_ROUGHNESS[mat];
      if (roughness !== undefined) {
        roughEl.value = roughness;
      }
    });
  }

  setupRoughnessAutoFill('gas-material', 'gas-roughness');
  setupRoughnessAutoFill('steam-material', 'steam-roughness');
  setupRoughnessAutoFill('slurry-material', 'slurry-roughness');
  setupRoughnessAutoFill('tp-material', 'tp-roughness');

  // Do NOT run calculations on startup — wait for user input
  // runActualPumpCalculations();
  // runActualLineCalculations();

  // ====== STHE DESIGN MODULE — EVENT WIRING ======

  // Form submit
  const stheForm = document.getElementById('sthe-form');
  if (stheForm) {
    stheForm.addEventListener('submit', (e) => {
      e.preventDefault();
      window.showCalcFeedback(stheForm);
      if (typeof calculateSTHE === 'function') calculateSTHE();
    });
    stheForm.querySelectorAll('input, select').forEach(function(el) {
      el.addEventListener('input', function() { debouncedPushUndo('sthe', '#sthe-form'); });
      el.addEventListener('change', function() { debouncedPushUndo('sthe', '#sthe-form'); });
    });
  }

  // Tube material dropdown → auto-fill kw
  const stheTubeMat = document.getElementById('sthe-tube-material');
  const stheKwInput = document.getElementById('sthe-tube-kw');
  if (stheTubeMat && stheKwInput) {
    stheTubeMat.addEventListener('change', () => {
      const matKey = stheTubeMat.value;
      const mat = TUBE_MATERIAL_KW[matKey];
      if (mat && mat.kw !== null) {
        stheKwInput.value = mat.kw;
        stheKwInput.readOnly = true;
      } else {
        stheKwInput.value = '';
        stheKwInput.readOnly = false;
      }
    });
  }

  // U reference dropdown → auto-fill U
  const stheURef = document.getElementById('sthe-u-ref');
  const stheUCustom = document.getElementById('sthe-u-custom');
  const stheUCustomRow = document.getElementById('sthe-u-custom-row');
  if (stheURef) {
    stheURef.addEventListener('change', () => {
      const key = stheURef.value;
      if (key === 'user_defined') {
        if (stheUCustomRow) stheUCustomRow.style.display = '';
        if (stheUCustom) stheUCustom.readOnly = false;
      } else {
        if (stheUCustomRow) stheUCustomRow.style.display = 'none';
        const ref = STHE_U_REF[key];
        if (stheUCustom && ref) stheUCustom.value = ref.U;
      }
    });
  }

  // Collapsible panels
  document.querySelectorAll('.sthe-collapse-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.getAttribute('data-target'));
      if (target) {
        const isHidden = target.style.display === 'none';
        target.style.display = isHidden ? '' : 'none';
        btn.textContent = isHidden ? '▾ COLLAPSE' : '▸ EXPAND';
      }
    });
  });

  // Tube OD → auto-calculate ID
  const stheOD = document.getElementById('sthe-tube-od');
  const stheID = document.getElementById('sthe-tube-id');
  if (stheOD && stheID) {
    const odToId = { '12.7': 10.2, '19': 16, '25': 21 };
    stheOD.addEventListener('change', () => {
      const mapped = odToId[stheOD.value];
      if (mapped) stheID.value = mapped;
    });
  }

  // Update generateSummaryReport to include STHE data
  const origGenReport = typeof generateSummaryReport === 'function' ? generateSummaryReport : null;
  if (origGenReport) {
    const _origGenReport = generateSummaryReport;
    generateSummaryReport = function() {
      _origGenReport();
      if (state.sthe.calculated) {
        const r = state.sthe.results;
        const inp = state.sthe.inputs;
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('rep-sthe-q', r.Q_kW.toFixed(2) + ' kW');
        set('rep-sthe-dtlm', r.dT_lm.toFixed(3) + ' °C');
        set('rep-sthe-u', r.U_calc.toFixed(2) + ' W/m²·°C');
        set('rep-sthe-nt', r.Nt);
        set('rep-sthe-np', inp.Np);
        set('rep-sthe-ds', r.Ds_used_mm.toFixed(0) + ' mm');
        set('rep-sthe-aa', r.Aa.toFixed(2) + ' m²');
        set('rep-sthe-ar', r.Ar.toFixed(2) + ' m²');
        set('rep-sthe-excess', r.excessArea.toFixed(1) + '%');
        set('rep-sthe-dp-tube', r.dp_tube_kPa.toFixed(2) + ' kPa');
        set('rep-sthe-dp-shell', r.dp_shell_kPa.toFixed(2) + ' kPa');
        set('rep-sthe-nozzle-tube-in', r.D_nozzle_tube_in.toFixed(1) + ' mm');
        set('rep-sthe-nozzle-tube-out', r.D_nozzle_tube_out.toFixed(1) + ' mm');
        set('rep-sthe-nozzle-shell-in', r.D_nozzle_shell_in.toFixed(1) + ' mm');
        set('rep-sthe-nozzle-shell-out', r.D_nozzle_shell_out.toFixed(1) + ' mm');
        set('rep-sthe-type', r.stheType);
        set('rep-sthe-status', r.areaStatus);
        set('rep-sthe-tube-fluid', inp.tubeSideFluid);
        set('rep-sthe-shell-fluid', inp.shellSideFluid);
        set('rep-sthe-flow', inp.flowArrangement);
      }
    };
  }
});


// ============================================================================
// STHE DESIGN MODULE (TAB 04)
// ============================================================================

window.addEventListener('DOMContentLoaded', () => {
    
    const stheForm = document.getElementById('sthe-form');
    if(!stheForm) return;

    const tubeMat = document.getElementById('sthe-tube-mat');
    const kwInput = document.getElementById('sthe-kw');
    const fluidCombo = document.getElementById('sthe-fluid-combo');
    const uAssumed = document.getElementById('sthe-u-assumed');

    // Auto-fill Tube Wall Conductivity (kw)
    if(tubeMat) {
        tubeMat.addEventListener('change', (e) => {
            if(e.target.value !== 'custom') {
                kwInput.value = e.target.value;
            }
        });
    }

    // Auto-fill U Assumed
    if(fluidCombo) {
        fluidCombo.addEventListener('change', (e) => {
            if(e.target.value !== 'custom') {
                uAssumed.value = e.target.value;
            }
        });
    }

    // Run Calculation
    stheForm.addEventListener('submit', (e) => {
        e.preventDefault();
        
        // Show simulation overlay
        const overlay = document.getElementById('sthe-sim-overlay');
        if(overlay) overlay.style.display = 'flex';
        
        setTimeout(() => {
            calculateSTHE();
            if(overlay) overlay.style.display = 'none';
        }, 800);
    });

});

// STHE Fluid Database (same as DPHE, shared across HX modules)
var STHE_FLUIDS = {
  'water':              { name:'Water',               rho:997,  mu:0.89,  cp:4.18,  k:0.607, muw:0.55 },
  'seawater':           { name:'Seawater',            rho:1025, mu:1.08,  cp:3.93,  k:0.596, muw:0.70 },
  'ethylene-glycol-50': { name:'Ethylene Glycol 50%', rho:1082, mu:3.5,   cp:3.27,  k:0.385, muw:2.0  },
  'propylene-glycol-50':{ name:'Propylene Glycol 50%',rho:1043, mu:5.3,   cp:3.55,  k:0.358, muw:3.0  },
  'therminol-66':       { name:'Therminol 66',        rho:1005, mu:3.14,  cp:1.63,  k:0.118, muw:1.8  },
  'dowtherm-a':         { name:'Dowtherm A',          rho:1056, mu:3.71,  cp:1.58,  k:0.138, muw:2.0  },
  'hot-oil':            { name:'Hot Oil (Mineral)',    rho:850,  mu:12.0,  cp:2.09,  k:0.131, muw:6.0  },
  'kerosene':           { name:'Kerosene',            rho:780,  mu:1.64,  cp:2.01,  k:0.145, muw:1.0  },
  'diesel':             { name:'Diesel',              rho:832,  mu:3.0,   cp:1.88,  k:0.140, muw:1.5  },
  'gasoline':           { name:'Gasoline',            rho:720,  mu:0.56,  cp:2.22,  k:0.120, muw:0.35 },
  'methanol':           { name:'Methanol',            rho:791,  mu:0.59,  cp:2.53,  k:0.200, muw:0.40 },
  'ethanol':            { name:'Ethanol',             rho:789,  mu:1.20,  cp:2.44,  k:0.171, muw:0.70 },
  'toluene':            { name:'Toluene',             rho:867,  mu:0.59,  cp:1.67,  k:0.131, muw:0.40 },
  'crude-oil-light':    { name:'Crude Oil (Light)',   rho:825,  mu:5.0,   cp:1.88,  k:0.132, muw:3.0  },
  'crude-oil-heavy':    { name:'Crude Oil (Heavy)',   rho:930,  mu:50.0,  cp:1.67,  k:0.125, muw:25.0 },
  'naphtha':            { name:'Naphtha',             rho:740,  mu:0.65,  cp:2.14,  k:0.130, muw:0.40 },
  'ammonia-liquid':     { name:'Ammonia (Liquid)',     rho:603,  mu:0.13,  cp:4.74,  k:0.493, muw:0.10 },
  'natural-gas':        { name:'Natural Gas',         rho:0.72, mu:0.011, cp:2.22,  k:0.034, muw:0.011},
  'steam-lp':           { name:'Steam (LP, 2 bar)',   rho:1.13, mu:0.013, cp:1.97,  k:0.025, muw:0.013},
  'air':                { name:'Air (1 atm)',         rho:1.18, mu:0.018, cp:1.005, k:0.026, muw:0.018},
  'nitrogen':           { name:'Nitrogen (gas)',      rho:1.14, mu:0.018, cp:1.04,  k:0.026, muw:0.018},
  'hydrogen':           { name:'Hydrogen (gas)',      rho:0.082,mu:0.009, cp:14.3,  k:0.182, muw:0.009},
  'co2':                { name:'CO₂ (gas)',           rho:1.84, mu:0.015, cp:0.846, k:0.016, muw:0.015}
};

window.stheFlowComparison = function() {
  var panel = document.getElementById('sthe-flow-compare');
  var content = document.getElementById('sthe-flow-compare-content');
  if (!panel || !content) return;
  if (!window.stheFlowAnalysis) { content.innerHTML = '<div style="color:#ef4444;">Run STHE calculation first.</div>'; panel.style.display = 'block'; return; }
  var cc = window.stheFlowAnalysis.counterCurrent;
  var conc = window.stheFlowAnalysis.concurrent;
  var better = cc.LMTD > conc.LMTD ? '✓ Counter-Current' : '✓ Concurrent';
  var diff = Math.abs(cc.effectiveness - conc.effectiveness) * 100;
  content.innerHTML = '<div style="margin-bottom:6px;padding:5px;background:rgba(59,130,246,0.15);border-radius:4px;font-size:10px;font-weight:700;color:#93c5fd;">' +
    '📖 Counter-Current = Fluids flow OPPOSITE directions (most efficient)<br/>' +
    '📖 Concurrent (Co-Current) = Fluids flow SAME direction (less efficient)</div>' +
    '<table style="width:100%;border-collapse:collapse;font-size:10px;">' +
    '<tr style="border-bottom:2px solid rgba(59,130,246,0.3);background:rgba(59,130,246,0.1);"><th style="text-align:left;padding:5px;">Parameter</th><th style="text-align:center;padding:5px;">⇆ Counter-Current</th><th style="text-align:center;padding:5px;">⇉ Concurrent</th><th style="text-align:center;padding:5px;">Winner</th></tr>' +
    '<tr><td style="padding:5px;">Effectiveness (ε)</td><td style="text-align:center;color:#22c55e;">' + cc.effectiveness.toFixed(4) + '</td><td style="text-align:center;color:#f59e0b;">' + conc.effectiveness.toFixed(4) + '</td><td style="text-align:center;font-weight:700;">' + (cc.effectiveness > conc.effectiveness ? '✓ Counter-Current' : '✓ Concurrent') + '</td></tr>' +
    '<tr style="border-bottom:1px solid rgba(59,130,246,0.2);"><td style="padding:5px;">LMTD (°C)</td><td style="text-align:center;color:#22c55e;">' + cc.LMTD.toFixed(2) + '</td><td style="text-align:center;color:#f59e0b;">' + conc.LMTD.toFixed(2) + '</td><td style="text-align:center;font-weight:700;">' + (cc.LMTD > conc.LMTD ? '✓ Counter-Current' : '✓ Concurrent') + '</td></tr>' +
    '</table>' +
    '<div style="margin-top:6px;padding:6px;background:rgba(59,130,246,0.1);border-radius:4px;">' +
    '<strong>🏆 Recommendation:</strong> ' + better + ' — LMTD difference: ' + Math.abs(cc.LMTD - conc.LMTD).toFixed(2) + '°C. For STHE, counter-current is standard per TEMA/ASME.</div>';
  panel.style.display = 'block';
};

// Typical operating pressures for fluids (bar G)
var STHE_PRESSURE_MAP = {
  'water':4.0,'seawater':3.0,'ethylene-glycol-50':4.0,'propylene-glycol-50':4.0,
  'therminol-66':6.0,'dowtherm-a':6.0,'hot-oil':5.0,'kerosene':3.0,'diesel':3.0,
  'gasoline':4.0,'methanol':3.0,'ethanol':3.0,'toluene':2.0,'crude-oil-light':5.0,
  'crude-oil-heavy':5.0,'naphtha':4.0,'ammonia-liquid':15.0,'natural-gas':40.0,
  'steam-lp':2.0,'air':1.0,'nitrogen':5.0,'hydrogen':20.0,'co2':10.0
};

// U-value lookup: [tube fluid key, shell fluid key] → typical U (W/m²·K)
// Comprehensive matrix based on TEMA / Perry's Chemical Engineers' Handbook
var STHE_U_LOOKUP = {};
(function() {
  // Fluid categories for U estimation
  var cats = {
    'water':'water','seawater':'water','ethylene-glycol-50':'glycol','propylene-glycol-50':'glycol',
    'therminol-66':'oil','dowtherm-a':'oil','hot-oil':'oil','kerosene':'oil','diesel':'oil',
    'gasoline':'oil','methanol':'solvent','ethanol':'solvent','toluene':'solvent',
    'crude-oil-light':'crude','crude-oil-heavy':'heavyoil','naphtha':'oil',
    'ammonia-liquid':'refrigerant','natural-gas':'gas','steam-lp':'steam',
    'air':'gas','nitrogen':'gas','hydrogen':'gas','co2':'gas'
  };
  // U matrix: [tube_cat][shell_cat] = typical U
  var uMatrix = {
    'water':    {water:1000,glycol:600,oil:250,solvent:400,crude:200,heavyoil:80,refrigerant:800,gas:50,steam:3000},
    'glycol':   {water:600,glycol:300,oil:150,solvent:250,crude:120,heavyoil:50,refrigerant:400,gas:35,steam:1200},
    'oil':      {water:250,glycol:150,oil:100,solvent:150,crude:80,heavyoil:40,refrigerant:200,gas:25,steam:500},
    'solvent':  {water:400,glycol:250,oil:150,solvent:200,crude:120,heavyoil:50,refrigerant:350,gas:35,steam:800},
    'crude':    {water:200,glycol:120,oil:80,solvent:120,crude:60,heavyoil:30,refrigerant:150,gas:20,steam:300},
    'heavyoil': {water:80,glycol:50,oil:40,solvent:50,crude:30,heavyoil:20,refrigerant:60,gas:10,steam:150},
    'refrigerant':{water:800,glycol:400,oil:200,solvent:350,crude:150,heavyoil:60,refrigerant:500,gas:40,steam:1500},
    'gas':      {water:50,glycol:35,oil:25,solvent:35,crude:20,heavyoil:10,refrigerant:40,gas:15,steam:100},
    'steam':    {water:3000,glycol:1200,oil:500,solvent:800,crude:300,heavyoil:150,refrigerant:1500,gas:100,steam:1000}
  };
  // Build full lookup from fluid keys
  var keys = Object.keys(cats);
  for (var i = 0; i < keys.length; i++) {
    for (var j = 0; j < keys.length; j++) {
      var ci = cats[keys[i]], cj = cats[keys[j]];
      if (uMatrix[ci] && uMatrix[ci][cj]) {
        STHE_U_LOOKUP[keys[i] + '|' + keys[j]] = uMatrix[ci][cj];
      }
    }
  }
})();

// STHE Material Selection — auto-fill kw + fouling factors
window.stheMatSelect = function() {
  var sel = document.getElementById('sthe-tube-mat');
  if (!sel) return;
  var opt = sel.options[sel.selectedIndex];
  var kw = parseFloat(sel.value);
  if (!isNaN(kw) && kw > 0) {
    var kwEl = document.getElementById('sthe-kw');
    if (kwEl) kwEl.value = kw;
  }
  var rdi = opt.getAttribute('data-rdi');
  var rdo = opt.getAttribute('data-rdo');
  if (rdi) { var el = document.getElementById('sthe-rdi'); if (el) el.value = rdi; }
  if (rdo) { var el = document.getElementById('sthe-rdo'); if (el) el.value = rdo; }
};

window.stheFluidSelect = function(side) {
  var selId = 'sthe-fluid-' + side + '-select';
  var sel = document.getElementById(selId);
  if (!sel) return;
  var key = sel.value;
  var f = STHE_FLUIDS[key];
  if (!f) return;
  var nameEl = document.getElementById('sthe-fluid-' + side);
  if (nameEl) nameEl.value = f.name;
  var rhoEl = document.getElementById('sthe-rho-' + side);
  if (rhoEl) rhoEl.value = f.rho;
  var muEl = document.getElementById('sthe-mu-' + side);
  if (muEl) muEl.value = f.mu;
  var muwEl = document.getElementById('sthe-muw-' + side);
  if (muwEl) muwEl.value = f.muw;
  var cpEl = document.getElementById('sthe-cp-' + side);
  if (cpEl) cpEl.value = f.cp;
  var kEl = document.getElementById('sthe-k-' + side);
  if (kEl) kEl.value = f.k;

  // Auto-fill pressure if empty or 0
  var pressEl = document.getElementById('sthe-press-' + side);
  if (pressEl && (parseFloat(pressEl.value) === 0 || pressEl.value === '')) {
    var p = STHE_PRESSURE_MAP[key] || 1.0;
    pressEl.value = p;
  }

  // Auto-update U-value based on tube+shell fluid combination
  var tubeKey = document.getElementById('sthe-fluid-tube-select')?.value || '';
  var shellKey = document.getElementById('sthe-fluid-shell-select')?.value || '';
  if (tubeKey && shellKey) {
    var uKey = tubeKey + '|' + shellKey;
    var uVal = STHE_U_LOOKUP[uKey] || null;
    var uEl = document.getElementById('sthe-u-assumed');
    var uSrc = document.getElementById('sthe-u-source');
    var uPair = document.getElementById('sthe-u-pair-display');
    var tName = STHE_FLUIDS[tubeKey]?.name || tubeKey;
    var sName = STHE_FLUIDS[shellKey]?.name || shellKey;
    if (uVal && uEl) {
      uEl.value = uVal;
      if (uSrc) uSrc.innerHTML = '⚡ Auto: <strong>' + tName + ' ↔ ' + sName + '</strong>';
      if (uPair) uPair.innerHTML = '<span style="color:#22c55e;">TUBE:</span> ' + tName + '<br/><span style="color:#ef4444;">SHELL:</span> ' + sName + '<br/><span style="color:#f59e0b;">U = <strong>' + uVal + ' W/m²·°C</strong></span><br/><span style="font-size:8px;color:#64748b;">Source: Perry\'s / TEMA Table</span>';
    } else {
      if (uSrc) uSrc.innerHTML = '⚠ Enter U manually';
      if (uPair) uPair.innerHTML = '<span style="color:#22c55e;">TUBE:</span> ' + tName + '<br/><span style="color:#ef4444;">SHELL:</span> ' + sName + '<br/><span style="color:#f59e0b;">U = enter manually</span>';
    }
  }
};

// Smart calc mode change — STHE
window.stheCalcModeChange = function() {
  var mode = document.getElementById('sthe-calc-mode')?.value || 'auto';
  var fields = {
    'auto':            'sthe-mass-tube',
    'calc-tube-mass':  'sthe-mass-tube',
    'calc-shell-mass': 'sthe-mass-shell',
    'calc-tout-tube':  'sthe-tout-tube',
    'calc-tout-shell': 'sthe-tout-shell'
  };
  var allIds = ['sthe-mass-tube','sthe-mass-shell','sthe-tout-tube','sthe-tout-shell','sthe-tin-tube','sthe-tin-shell'];
  allIds.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { el.style.color = ''; el.style.background = ''; el.readOnly = false; el.style.opacity = '1'; }
  });
  var selId = fields[mode];
  if (selId) {
    var el = document.getElementById(selId);
    if (el) { el.style.color = '#4ade80'; el.style.background = 'rgba(34,197,94,0.08)'; el.readOnly = true; el.style.opacity = '0.8'; }
  }
  var tag = document.getElementById('sthe-mass-tube-tag');
  if (tag) tag.innerHTML = (mode === 'auto' || mode === 'calc-tube-mass') ? '<span style="color:#4ade80;">⚡ AUTO-CALCULATED</span>' : '';
};

function calculateSTHE() {
    // ==========================================
    // COLLECT INPUTS (matching STHE_Design_Workbook Excel)
    // ==========================================
    const flowTypeInput = document.querySelector('input[name="sthe-flow"]:checked');
    const flowType = flowTypeInput ? flowTypeInput.value : 'counter';
    const layoutInput = document.querySelector('input[name="sthe-layout"]:checked');
    const layout = layoutInput ? layoutInput.value : 'triangular';

    const m_shell = parseFloat(document.getElementById('sthe-mass-shell')?.value || 0);
    let m_tube_input = parseFloat(document.getElementById('sthe-mass-tube')?.value || 0);

    const Tin_tube = parseFloat(document.getElementById('sthe-tin-tube')?.value || 0);
    const Tin_shell = parseFloat(document.getElementById('sthe-tin-shell')?.value || 0);
    const Tout_tube = parseFloat(document.getElementById('sthe-tout-tube')?.value || 0);
    const Tout_shell = parseFloat(document.getElementById('sthe-tout-shell')?.value || 0);

    const Cp_tube = parseFloat(document.getElementById('sthe-cp-tube')?.value || 0);
    const Cp_shell = parseFloat(document.getElementById('sthe-cp-shell')?.value || 0);
    const Cp_tube_J = Cp_tube * 1000;
    const Cp_shell_J = Cp_shell * 1000;

    const k_tube = parseFloat(document.getElementById('sthe-k-tube')?.value || 0);
    const k_shell = parseFloat(document.getElementById('sthe-k-shell')?.value || 0);

    const rho_tube = parseFloat(document.getElementById('sthe-rho-tube')?.value || 1);
    const rho_shell = parseFloat(document.getElementById('sthe-rho-shell')?.value || 1);

    const mu_tube_cP = parseFloat(document.getElementById('sthe-mu-tube')?.value || 0.001);
    const mu_shell_cP = parseFloat(document.getElementById('sthe-mu-shell')?.value || 0.001);
    const muw_tube_cP = parseFloat(document.getElementById('sthe-muw-tube')?.value || mu_tube_cP);
    const muw_shell_cP = parseFloat(document.getElementById('sthe-muw-shell')?.value || mu_shell_cP);

    const Do_mm = parseFloat(document.getElementById('sthe-tube-od')?.value || 19);
    const Di_mm = parseFloat(document.getElementById('sthe-tube-id')?.value || 16);
    const L_mm = parseFloat(document.getElementById('sthe-tube-L')?.value || 7270);
    const Pt_ratio = parseFloat(document.getElementById('sthe-pitch-ratio')?.value || 1.25);
    const Np = parseInt(document.getElementById('sthe-tube-passes')?.value || 1);
    const Nt = parseInt(document.getElementById('sthe-num-tubes')?.value || 200);
    const baffleRatio = parseFloat(document.getElementById('sthe-baffle-ratio')?.value || 0.3);
    const baffleCut = parseFloat(document.getElementById('sthe-baffle-cut')?.value || 25);

    const kw = parseFloat(document.getElementById('sthe-kw')?.value || 50);
    const Rfi = parseFloat(document.getElementById('sthe-rdi')?.value || 0.0002);
    const Rfo = parseFloat(document.getElementById('sthe-rdo')?.value || 0.0002);
    const U_assumed = parseFloat(document.getElementById('sthe-u-assumed')?.value || 200);
    const v_tube_target = parseFloat(document.getElementById('sthe-v-tube')?.value || 2);
    const v_shell_target = parseFloat(document.getElementById('sthe-v-shell')?.value || 20);
    const targetExcess = parseFloat(document.getElementById('sthe-target-excess')?.value || 20);

    // Rear-head type → bundle-shell clearance (from Excel '6. Data Tables')
    const rearHead = document.getElementById('sthe-rear-head')?.value || 'fixed';
    const clearanceMap = { 'fixed': 12, 'outside-packed': 18, 'split-ring': 50, 'pull-through': 92, 'u-tube': 14 };
    const bundleClearance_mm = clearanceMap[rearHead] || 12;

    // ==========================================
    // A. HEAT DUTY & LMTD (Excel: '2. Thermal Design' A)
    // ==========================================
    const Do_m = Do_mm / 1000;
    const Di_m = Di_mm / 1000;
    const L_m = L_mm / 1000;
    const Pt_mm = Pt_ratio * Do_mm;
    const Pt_m = Pt_mm / 1000;
    const mu_tube = mu_tube_cP / 1000;
    const mu_shell = mu_shell_cP / 1000;

    // Heat duty from shell (hot) side
    const Q = m_shell * Cp_shell_J * Math.abs(Tin_shell - Tout_shell);
    const Q_kW = Q / 1000;

    // Auto-calculate tube mass flow from energy balance if input is 0
    let m_tube;
    if (m_tube_input <= 0 && Cp_tube_J > 0 && Math.abs(Tout_tube - Tin_tube) > 0.001) {
        m_tube = Q / (Cp_tube_J * Math.abs(Tout_tube - Tin_tube));
        var mtEl = document.getElementById('sthe-mass-tube');
        if (mtEl) mtEl.value = m_tube.toFixed(4);
    } else {
        m_tube = m_tube_input;
    }

    // Duty balance check
    const Q_cold = m_tube * Cp_tube_J * Math.abs(Tout_tube - Tin_tube);
    const dutyBalanced = Math.abs(Q - Q_cold) < 500;

    // LMTD — calculate BOTH arrangements for comparison
    function calcLMTD(dt1, dt2) {
      if (Math.abs(dt1 - dt2) < 0.01) return dt1;
      if (dt1 > 0 && dt2 > 0) return (dt1 - dt2) / Math.log(dt1 / dt2);
      return 0;
    }
    var dT1_cc = Tin_shell - Tout_tube, dT2_cc = Tout_shell - Tin_tube;
    var dT1_co = Tin_shell - Tin_tube,  dT2_co = Tout_shell - Tout_tube;
    var LMTD_cc = calcLMTD(dT1_cc, dT2_cc);
    var LMTD_co = calcLMTD(dT1_co, dT2_co);

    // Use selected flow type
    let dT1, dT2;
    if (flowType === 'counter') { dT1 = dT1_cc; dT2 = dT2_cc; }
    else { dT1 = dT1_co; dT2 = dT2_co; }
    let LMTD = (flowType === 'counter') ? LMTD_cc : LMTD_co;

    // Effectiveness comparison
    var Cmin_s = Math.min(m_shell * Cp_shell_J, m_tube * Cp_tube_J || m_shell * Cp_shell_J);
    var eff_cc = (Cmin_s > 0 && (Tin_shell - Tin_tube) > 0) ? Q / (Cmin_s * (Tin_shell - Tin_tube)) : 0;
    var eff_co = eff_cc * (LMTD_co > 0 ? LMTD_co / (LMTD_cc || 1) : 0.8);
    window.stheFlowAnalysis = {
      counterCurrent: { LMTD: LMTD_cc, effectiveness: Math.min(eff_cc, 1) },
      concurrent: { LMTD: LMTD_co, effectiveness: Math.min(eff_co, 1) }
    };

    // R, P, Ft (Excel formula from '2. Thermal Design' D13)
    const R = Math.abs(Tin_shell - Tout_shell) / (Math.abs(Tout_tube - Tin_tube) || 1);
    const P = Math.abs(Tout_tube - Tin_tube) / (Math.abs(Tin_shell - Tin_tube) || 1);

    let ft = 1.0;
    if (Math.abs(R - 1.0) < 0.0001) {
        var sqr2P = Math.sqrt(2) * P / (1 - P + 1e-15);
        var denom1 = 2 - P * (2 - Math.sqrt(2));
        var denom2 = 2 - P * (2 + Math.sqrt(2));
        if (denom1 > 0 && denom2 > 0) {
            ft = sqr2P / Math.log(denom1 / denom2);
        }
    } else if (P > 0 && P < 1 && R > 0) {
        var sqrtR = Math.sqrt(R * R + 1);
        var W = (1 - P * R) / (1 - P);
        var num = sqrtR * Math.log(W) / (R - 1);
        var d1 = 2 / P - 1 - R + sqrtR;
        var d2 = 2 / P - 1 - R - sqrtR;
        if (d1 > 0 && d2 > 0 && d1 !== d2) {
            ft = num / Math.log(d1 / d2);
        }
    }
    if (!isFinite(ft) || ft <= 0 || ft > 1) ft = 1.0;
    const dT_lm = ft * LMTD;

    // ==========================================
    // B. SIZING — BUNDLE & SHELL (Excel: '2. Thermal Design' B)
    // ==========================================
    const A_per_tube = Math.PI * Do_m * L_m;
    const A_trial = (U_assumed > 0 && dT_lm > 0) ? Q / (U_assumed * dT_lm) : 0;
    const Nt_trial = A_trial / A_per_tube;

    // Tube-count constants (Excel: '6. Data Tables')
    const KN = {
        triangular: { 1:[0.319,2.142], 2:[0.249,2.207], 4:[0.175,2.285], 6:[0.0743,2.499], 8:[0.0365,2.675] },
        square:     { 1:[0.215,2.207], 2:[0.156,2.291], 4:[0.158,2.263], 6:[0.0402,2.617], 8:[0.0331,2.643] }
    };
    let K1 = 0.319, n1 = 2.142;
    if (KN[layout] && KN[layout][Np]) {
        K1 = KN[layout][Np][0];
        n1 = KN[layout][Np][1];
    }

    // Bundle diameter: Db = do × (Nt/K1)^(1/n1)  (Excel: '2. Thermal Design' D25)
    const Db_m = Do_m * Math.pow(Nt / K1, 1 / n1);
    const Db_mm = Db_m * 1000;

    // Shell ID = Db + clearance (Excel: '2. Thermal Design' D26)
    const Ds_m = Db_m + bundleClearance_mm / 1000;
    const Ds_mm = Ds_m * 1000;
    var dsInput = document.getElementById('sthe-shell-id');
    if (dsInput) dsInput.value = Ds_mm.toFixed(1);

    // Baffle spacing from ratio (Excel: '2. Thermal Design' D43)
    const B_m = baffleRatio * Ds_m;
    const B_mm = B_m * 1000;
    var bsInput = document.getElementById('sthe-baffle-space');
    if (bsInput) bsInput.value = B_mm.toFixed(1);

    const L_Ds_ratio = L_m / Ds_m;

    // ==========================================
    // C. TUBE-SIDE FILM COEFFICIENT (Excel: '2. Thermal Design' C)
    // ==========================================
    // Flow area per pass: 0.785 × di² × (Nt/Np)
    const A_flow_tube = 0.785 * Di_m * Di_m * (Nt / Np);
    const Gt = m_tube / (A_flow_tube || 1);
    const v_tube_calc = Gt / rho_tube;
    const Re_tube = Gt * Di_m / (mu_tube || 1e-10);
    const Pr_tube = (Cp_tube_J * mu_tube) / (k_tube || 1e-10);

    // Sieder-Tate: Nu = 0.023 × Re^0.8 × Pr^0.33 × (µ/µw)^0.14
    const visc_ratio_tube = Math.pow((mu_tube_cP / (muw_tube_cP || mu_tube_cP)), 0.14);
    const Nu_tube = 0.023 * Math.pow(Math.max(Re_tube, 1), 0.8) * Math.pow(Math.max(Pr_tube, 0.1), 0.33) * visc_ratio_tube;
    const hi = Nu_tube * k_tube / Di_m;
    const hio = hi * (Di_m / Do_m);

    // ==========================================
    // D. SHELL-SIDE FILM COEFFICIENT — Kern (Excel: '2. Thermal Design' D)
    // ==========================================
    // Equivalent diameter (layout-dependent)
    let de_mm;
    if (layout === 'triangular') {
        de_mm = 1.1 / Do_mm * (Pt_mm * Pt_mm - 0.917 * Do_mm * Do_mm);
    } else {
        de_mm = 1.27 / Do_mm * (Pt_mm * Pt_mm - 0.785 * Do_mm * Do_mm);
    }
    const De = de_mm / 1000;

    // Cross-flow area: As = Ds × C' × B / Pt  (Excel: '2. Thermal Design' D45)
    const C_prime = Pt_m - Do_m;
    const A_flow_shell = (Ds_m * C_prime * B_m) / Pt_m;
    const Gs = m_shell / (A_flow_shell || 1);
    const v_shell_calc = Gs / rho_shell;
    const Re_shell = Gs * De / (mu_shell || 1e-10);
    const Pr_shell = (Cp_shell_J * mu_shell) / (k_shell || 1e-10);

    // Kern: Nu = 0.36 × Re^0.55 × Pr^⅓ × (µ/µw)^0.14
    const visc_ratio_shell = Math.pow((mu_shell_cP / (muw_shell_cP || mu_shell_cP)), 0.14);
    const Nu_shell = 0.36 * Math.pow(Math.max(Re_shell, 1), 0.55) * Math.pow(Math.max(Pr_shell, 0.1), 0.33) * visc_ratio_shell;
    const ho = Nu_shell * k_shell / De;

    // ==========================================
    // E. OVERALL COEFFICIENT & AREA (Excel: '2. Thermal Design' E)
    // ==========================================
    // Wall resistance: Rw = do·ln(do/di)/(2·kw)  (Excel: '2. Thermal Design' D57)
    const Rw = Do_m * Math.log(Do_m / Di_m) / (2 * kw);

    // Fouling referred to OD: Rf,i(OD) = Rfi × (di/do)
    const Rfi_od = Rfi * (Di_m / Do_m);

    // Uc clean = 1/(1/hio + Rw + 1/ho)
    const Uc = 1 / ((1 / (hio || 1)) + Rw + (1 / (ho || 1)));
    // Ud dirty = 1/(1/hio + Rfi(OD) + Rw + Rfo + 1/ho)
    const U_calc = 1 / ((1 / (hio || 1)) + Rfi_od + Rw + Rfo + (1 / (ho || 1)));

    // Area required & available
    const Ar = (U_calc > 0 && dT_lm > 0) ? Q / (U_calc * dT_lm) : 0;
    const Aa = Nt * Math.PI * Do_m * L_m;
    const excess_pct = Ar > 0 ? ((Aa - Ar) / Ar) * 100 : 0;

    // Suggested Nt for target over-surface (Excel: '2. Thermal Design' D65)
    const Nt_suggested = Math.ceil(Ar * (1 + (targetExcess || 20) / 100) / A_per_tube);

    // ==========================================
    // F. PRESSURE DROP — Kern (Excel: '2. Thermal Design' F)
    // ==========================================
    // Number of baffles
    const Nb = Math.max(0, Math.round(L_m / B_m) - 1);

    // Tube: f = 0.72 × Re^-0.33; ΔP = (f·Gt²·L·Np)/(2e6·di·ρ·(µ/µw)^0.14) + 2.5·Np·ρ·vt²
    const f_tube = 0.72 * Math.pow(Math.max(Re_tube, 1), -0.33);
    const dp_tube_Pa = (f_tube * Gt * Gt * L_m * Np) / (2e6 * Di_m * (rho_tube / 1000) * visc_ratio_tube)
                     + 2.5 * Np * (rho_tube / 1000) * v_tube_calc * v_tube_calc;
    const dp_tube_kPa = dp_tube_Pa;
    const dp_tube_kgcm2 = dp_tube_kPa / 98.0665;

    // Shell: f = 1.87 × Re^-0.2; ΔP = (f·Gs²·Ds·(Nb+1))/(2e6·de·ρ·(µ/µw)^0.14)
    const f_shell = 1.87 * Math.pow(Math.max(Re_shell, 1), -0.2);
    const dp_shell_Pa = (f_shell * Gs * Gs * Ds_m * (Nb + 1)) / (2e6 * De * (rho_shell / 1000) * visc_ratio_shell);
    const dp_shell_kPa = dp_shell_Pa;
    const dp_shell_kgcm2 = dp_shell_kPa / 98.0665;

    // ==========================================
    // NOZZLE SIZING (Excel: '3. Mechanical' A)
    // ==========================================
    const Qv_tube = m_tube / rho_tube;
    const A_noz_tube = Qv_tube / v_tube_target;
    const d_noz_tube_calc = Math.sqrt(4 * A_noz_tube / Math.PI) * 1000;
    const D_nozzle_tube_mm = Math.ceil(d_noz_tube_calc / 25) * 25;
    const v_noz_tube_actual = 4 * m_tube / (Math.PI * rho_tube * Math.pow(D_nozzle_tube_mm / 1000, 2));

    const Qv_shell = m_shell / rho_shell;
    const A_noz_shell = Qv_shell / v_shell_target;
    const d_noz_shell_calc = Math.sqrt(4 * A_noz_shell / Math.PI) * 1000;
    const D_nozzle_shell_mm = Math.ceil(d_noz_shell_calc / 25) * 25;
    const v_noz_shell_actual = 4 * m_shell / (Math.PI * rho_shell * Math.pow(D_nozzle_shell_mm / 1000, 2));

    // ==========================================
    // TEMA TYPE (Excel: '3. Mechanical' B)
    // ==========================================
    const tMax = Math.max(Tin_tube, Tout_tube, Tin_shell, Tout_shell);
    const fluidShell = (document.getElementById('sthe-fluid-shell')?.value || '').toLowerCase();
    const isClean = !(fluidShell.includes('dirty') || fluidShell.includes('crude') || fluidShell.includes('toxic'));
    const isHazardous = fluidShell.includes('toxic') || fluidShell.includes('hazard');
    let stheType = '', temaFront = 'B', temaShell = 'E', temaRear = 'M';
    if (tMax < 90) {
        stheType = 'Fixed tube sheet (BEM) — low temperature'; temaRear = 'M';
    } else if (isClean) {
        stheType = 'U-tube (BEU) — clean fluid, T>90°C'; temaRear = 'U';
    } else if (!isHazardous) {
        stheType = 'Internal floating head (AES) — dirty, removable bundle'; temaFront = 'A'; temaRear = 'S';
    } else {
        stheType = 'Pull-through floating head (AET) — dirty + hazardous'; temaFront = 'A'; temaRear = 'T';
    }
    const temaDesignation = temaFront + temaShell + temaRear;

    // ==========================================
    // UPDATE DOM
    // ==========================================
    var set = function(id, val) { var el = document.getElementById(id); if (el) el.innerText = val; };

    set('sthe-out-Q', Q_kW.toFixed(2));
    set('sthe-out-mass-tube', m_tube.toFixed(2));
    set('sthe-out-mass-tube-hr', (m_tube * 3600).toFixed(0));
    set('sthe-out-lmtd', LMTD.toFixed(2));
    set('sthe-out-ft', ft.toFixed(3));
    set('sthe-out-dtlm', dT_lm.toFixed(2));
    set('sthe-out-R', R.toFixed(3));
    set('sthe-out-P', P.toFixed(3));

    set('sthe-out-Nt', Nt);
    set('sthe-out-Db', Db_mm.toFixed(1));
    set('sthe-out-Ds', Ds_mm.toFixed(1));
    set('sthe-out-Ar', Ar.toFixed(2));
    set('sthe-out-Aa', Aa.toFixed(2));
    set('sthe-out-excess', excess_pct.toFixed(1));
    set('sthe-out-Nt-suggested', Nt_suggested);

    const badgeExcess = document.getElementById('sthe-badge-excess');
    if (badgeExcess) {
        badgeExcess.style.display = 'inline-block';
        badgeExcess.className = 'banner-badge';
        var excessStatus = '';
        if (excess_pct >= 10 && excess_pct <= 40) {
            badgeExcess.innerText = "ACCEPTABLE"; badgeExcess.classList.add('badge-teal'); excessStatus = 'ACCEPTABLE';
        } else if (excess_pct > 40) {
            badgeExcess.innerText = "OVERSIZED"; badgeExcess.classList.add('badge-amber'); excessStatus = 'OVERSIZED';
        } else {
            badgeExcess.innerText = "UNDERSIZED"; badgeExcess.classList.add('badge-red'); excessStatus = 'UNDERSIZED';
        }
    }

    set('sthe-out-Retube', Re_tube.toFixed(0));
    set('sthe-out-Prtube', Pr_tube.toFixed(2));
    set('sthe-out-Nu-tube', Nu_tube.toFixed(1));
    set('sthe-out-hi', hi.toFixed(1));
    set('sthe-out-hio', hio.toFixed(1));
    set('sthe-out-Reshell', Re_shell.toFixed(0));
    set('sthe-out-Prshell', Pr_shell.toFixed(2));
    set('sthe-out-Nu-shell', Nu_shell.toFixed(1));
    set('sthe-out-ho', ho.toFixed(1));
    set('sthe-out-Rw', Rw.toExponential(3));
    set('sthe-out-Uc', Uc.toFixed(1));
    set('sthe-out-Ucalc', U_calc.toFixed(1));
    set('sthe-out-v-tube-calc', v_tube_calc.toFixed(2));
    set('sthe-out-v-shell-calc', v_shell_calc.toFixed(2));

    const badgeU = document.getElementById('sthe-badge-U');
    if (badgeU) {
        badgeU.style.display = 'inline-block';
        badgeU.className = 'banner-badge';
        var uDiff = Math.abs(U_calc - U_assumed) / (U_assumed || 1) * 100;
        if (uDiff < 30) { badgeU.innerText = "CONVERGED"; badgeU.classList.add('badge-teal'); }
        else { badgeU.innerText = "RE-ITERATE"; badgeU.classList.add('badge-amber'); }
    }

    set('sthe-out-dp-tube', dp_tube_kPa.toFixed(2));
    set('sthe-out-dp-tube-kg', dp_tube_kgcm2.toFixed(4));
    set('sthe-out-dp-shell', dp_shell_kPa.toFixed(2));
    set('sthe-out-dp-shell-kg', dp_shell_kgcm2.toFixed(4));
    set('sthe-out-Nb', Nb);

    set('sthe-out-noz-ti', D_nozzle_tube_mm);
    set('sthe-out-noz-to', D_nozzle_tube_mm);
    set('sthe-out-noz-si', D_nozzle_shell_mm);
    set('sthe-out-noz-so', D_nozzle_shell_mm);

    // ==========================================
    // FLAGS & RECOMMENDATIONS
    // ==========================================
    const recList = document.getElementById('sthe-rec-list');
    if (recList) {
        recList.innerHTML = '';
        const addFlag = (msg, colorType) => {
            const row = document.createElement('div');
            row.className = 'check-item';
            var colorHex = colorType === 'AMBER' ? '#f59e0b' : (colorType === 'TEAL' ? '#00b875' : '#ef4444');
            var bgHex = colorType === 'AMBER' ? 'rgba(245,158,11,0.1)' : (colorType === 'TEAL' ? 'rgba(0,184,117,0.08)' : 'rgba(239,68,68,0.1)');
            row.style.borderLeft = '3px solid ' + colorHex;
            row.style.backgroundColor = bgHex;
            row.innerHTML = '<div class="check-info"><span class="check-name" style="color:' + colorHex + '">' + colorType + '</span><span class="check-details" style="font-size:10px;">' + msg + '</span></div>';
            recList.appendChild(row);
        };

        // Duty balance
        if (dutyBalanced) addFlag("Duty balance OK (" + Q_kW.toFixed(1) + " kW)", "TEAL");
        else addFlag("Duty imbalance — check mass flows & Cp", "RED");

        // Ft check
        if (ft >= 0.75) addFlag("Ft = " + ft.toFixed(3) + " OK", "TEAL");
        else addFlag("Ft = " + ft.toFixed(3) + " < 0.75 — add shell pass or reconfigure", "RED");

        // Tube velocity
        if (v_tube_calc >= 1.0 && v_tube_calc <= 2.5) addFlag("Tube velocity " + v_tube_calc.toFixed(2) + " m/s OK", "TEAL");
        else if (v_tube_calc < 1.0) addFlag("Tube velocity " + v_tube_calc.toFixed(2) + " m/s LOW — add passes / fewer tubes", "AMBER");
        else addFlag("Tube velocity " + v_tube_calc.toFixed(2) + " m/s HIGH — fewer passes / more tubes", "RED");

        // Shell velocity
        if (v_shell_calc <= 30) addFlag("Shell velocity " + v_shell_calc.toFixed(1) + " m/s OK", "TEAL");
        else addFlag("Shell velocity " + v_shell_calc.toFixed(1) + " m/s > 30 max", "RED");

        // L/Ds
        if (L_Ds_ratio >= 5 && L_Ds_ratio <= 10) addFlag("L/Ds = " + L_Ds_ratio.toFixed(1) + " OK", "TEAL");
        else addFlag("L/Ds = " + L_Ds_ratio.toFixed(1) + " outside 5–10", "AMBER");

        // Over-surface
        if (excess_pct >= 10 && excess_pct <= 25) addFlag("Over-surface " + excess_pct.toFixed(1) + "% OK", "TEAL");
        else if (excess_pct < 0) addFlag("UNDER-SURFACED (" + excess_pct.toFixed(1) + "%) — add tubes/length. Suggested Nt: " + Nt_suggested, "RED");
        else if (excess_pct < 10) addFlag("Low over-surface " + excess_pct.toFixed(1) + "% — increase Nt to ~" + Nt_suggested, "AMBER");
        else if (excess_pct > 40) addFlag("Oversized " + excess_pct.toFixed(1) + "% — reduce Nt or tube length", "AMBER");

        // ΔP checks (using allowable from inputs if available)
        var dpAllowTube = parseFloat(document.getElementById('sthe-dp-allow-tube')?.value || 70);
        var dpAllowShell = parseFloat(document.getElementById('sthe-dp-allow-shell')?.value || 50);
        if (dp_tube_kPa <= dpAllowTube) addFlag("Tube ΔP " + dp_tube_kPa.toFixed(1) + " kPa OK", "TEAL");
        else addFlag("Tube ΔP " + dp_tube_kPa.toFixed(1) + " kPa exceeds " + dpAllowTube + " kPa limit", "RED");
        if (dp_shell_kPa <= dpAllowShell) addFlag("Shell ΔP " + dp_shell_kPa.toFixed(1) + " kPa OK", "TEAL");
        else addFlag("Shell ΔP " + dp_shell_kPa.toFixed(1) + " kPa exceeds " + dpAllowShell + " kPa limit", "RED");

        // Baffle spacing TEMA check
        var bMin = Math.max(0.2 * Ds_mm, 50.8);
        var bMax = Ds_mm;
        if (B_mm >= bMin && B_mm <= bMax) addFlag("Baffle spacing " + B_mm.toFixed(0) + " mm within TEMA limits", "TEAL");
        else addFlag("Baffle spacing " + B_mm.toFixed(0) + " mm outside TEMA " + bMin.toFixed(0) + "–" + bMax.toFixed(0) + " mm", "RED");

        // Cooling water warning
        var fluidTube = (document.getElementById('sthe-fluid-tube')?.value || '').toLowerCase();
        if (Tout_tube > 40 && fluidTube.includes('cooling') || fluidTube.includes('water')) {
            if (Tout_tube > 40) addFlag("Cooling water outlet " + Tout_tube + "°C > 40°C — scaling risk", "AMBER");
        }

        // Vibration screening
        if (v_shell_calc > 25) addFlag("Vibration risk HIGH — full TEMA Sec.6 analysis required", "RED");
        else if (v_shell_calc > 15) addFlag("Vibration risk MODERATE — run TEMA Sec.6 check", "AMBER");

        // Re check
        if (Re_tube >= 10000) addFlag("Tube Re = " + Re_tube.toFixed(0) + " turbulent — correlation valid", "TEAL");
        else if (Re_tube >= 2300) addFlag("Tube Re = " + Re_tube.toFixed(0) + " transition — use with caution", "AMBER");
        else addFlag("Tube Re = " + Re_tube.toFixed(0) + " laminar — change correlation", "RED");

        // TEMA type
        var typeRow = document.createElement('div');
        typeRow.className = 'check-item';
        typeRow.style.borderLeft = '3px solid var(--color-saffron)';
        typeRow.style.backgroundColor = 'rgba(255,117,56,0.05)';
        typeRow.innerHTML = '<div class="check-info"><span class="check-name" style="color:var(--color-saffron)">TEMA: ' + temaDesignation + '</span><span class="check-details" style="font-size:10px;">' + stheType + '</span></div>';
        recList.appendChild(typeRow);
    }

    // ==========================================
    // STATE & STATUS
    // ==========================================
    window.state = window.state || {};
    window.state.sthe = {
        calculated: true,
        Q: Q_kW.toFixed(2),
        U: U_calc.toFixed(1),
        Nt: Nt,
        excessArea: excess_pct.toFixed(1),
        status: excessStatus || '',
        D_tube: D_nozzle_tube_mm,
        D_shell: D_nozzle_shell_mm
    };

    var exSt = excessStatus || (excess_pct >= 10 && excess_pct <= 40 ? 'ACCEPTABLE' : (excess_pct > 40 ? 'OVERSIZED' : 'UNDERSIZED'));
    var statusMsg = 'STHE CALCULATED // Ud = ' + U_calc.toFixed(1) + ' W/m²·K // Uc = ' + Uc.toFixed(1) + ' // Nt = ' + Nt + ' // EXCESS = ' + excess_pct.toFixed(1) + '% // ' + exSt;
    var statusEl = document.querySelector('.terminal-logs');
    if (statusEl) {
        statusEl.innerHTML = '<div class="logs-header"><span class="logs-title">STHE ENGINE</span> <span class="logs-status-val" style="color:' + (exSt === 'ACCEPTABLE' ? '#00b875' : (exSt === 'OVERSIZED' ? '#f59e0b' : '#ef4444')) + '">' + statusMsg + '</span></div>';
    }

    var resultCards = document.querySelectorAll('#sthe-tab .result-card');
    resultCards.forEach(function(card) {
        card.style.transform = 'scale(0.98)';
        setTimeout(function() { card.style.transform = 'scale(1)'; }, 150);
    });
}

// ==========================================
// BHARAT FLOWSIZE UPGRADES V3.0 START
// ==========================================

// ==========================================
// BHARAT FLOWSIZE UPGRADES V3.0 START
// ==========================================

(function() {
  logConsole("LOADED BHARAT FLOWSIZE V3.0 COMPREHENSIVE ENGINE", "success");

  // --- UNIT SYSTEM DEFINITIONS & CONVERSIONS ---
  const UNIT_CONVERSIONS = {
    'temperature': {
      toSI: (val, sys) => {
        if (sys === 'US') return (val - 32) * 5 / 9;
        if (sys === 'CGS') return val - 273.15;
        return val;
      },
      fromSI: (val, sys) => {
        if (sys === 'US') return val * 9 / 5 + 32;
        if (sys === 'CGS') return val + 273.15;
        return val;
      },
      symbol: (sys) => {
        if (sys === 'US') return '°F';
        if (sys === 'CGS') return 'K';
        return '°C';
      }
    },
    'pressure': {
      toSI: (val, sys) => {
        if (sys === 'US') return val / 14.50377;
        if (sys === 'CGS') return val / 1.019716;
        return val;
      },
      fromSI: (val, sys) => {
        if (sys === 'US') return val * 14.50377;
        if (sys === 'CGS') return val * 1.019716;
        return val;
      },
      symbol: (sys) => {
        if (sys === 'US') return 'psi';
        if (sys === 'CGS') return 'kg/cm²';
        return 'bar';
      }
    },
    'press-drop': {
      toSI: (val, sys) => {
        if (sys === 'US') return val / 14.50377;
        if (sys === 'CGS') return val / 1.019716;
        return val;
      },
      fromSI: (val, sys) => {
        if (sys === 'US') return val * 14.50377;
        if (sys === 'CGS') return val * 1.019716;
        return val;
      },
      symbol: (sys) => {
        if (sys === 'US') return 'psi';
        if (sys === 'CGS') return 'kg/cm²';
        return 'bar';
      }
    },
    'press-drop-rate': {
      toSI: (val, sys) => {
        if (sys === 'US') return val / 4.42075;
        if (sys === 'CGS') return val / 1.019716;
        return val;
      },
      fromSI: (val, sys) => {
        if (sys === 'US') return val * 4.42075;
        if (sys === 'CGS') return val * 1.019716;
        return val;
      },
      symbol: (sys) => {
        if (sys === 'US') return 'psi/100ft';
        if (sys === 'CGS') return 'kg/cm²/100m';
        return 'bar/100m';
      }
    },
    'press-drop-kpa': {
      toSI: (val, sys) => {
        if (sys === 'US') return val / 0.1450377;
        if (sys === 'CGS') return val / 0.01019716;
        return val;
      },
      fromSI: (val, sys) => {
        if (sys === 'US') return val * 0.1450377;
        if (sys === 'CGS') return val * 0.01019716;
        return val;
      },
      symbol: (sys) => {
        if (sys === 'US') return 'psi';
        if (sys === 'CGS') return 'kg/cm²';
        return 'kPa';
      }
    },
    'density': {
      toSI: (val, sys) => {
        if (sys === 'US') return val / 0.06242796;
        if (sys === 'CGS') return val / 0.001;
        return val;
      },
      fromSI: (val, sys) => {
        if (sys === 'US') return val * 0.06242796;
        if (sys === 'CGS') return val * 0.001;
        return val;
      },
      symbol: (sys) => {
        if (sys === 'US') return 'lb/ft³';
        if (sys === 'CGS') return 'g/cm³';
        return 'kg/m³';
      }
    },
    'viscosity': {
      toSI: (val, sys) => val,
      fromSI: (val, sys) => val,
      symbol: (sys) => 'cP'
    },
    'mass-flow': {
      toSI: (val, sys) => {
        if (sys === 'US') return val / 2.204622;
        if (sys === 'CGS') return val / 0.2777778;
        return val;
      },
      fromSI: (val, sys) => {
        if (sys === 'US') return val * 2.204622;
        if (sys === 'CGS') return val * 0.2777778;
        return val;
      },
      symbol: (sys) => {
        if (sys === 'US') return 'lb/hr';
        if (sys === 'CGS') return 'g/s';
        return 'kg/hr';
      }
    },
    'mass-flow-s': {
      toSI: (val, sys) => {
        if (sys === 'US') return val / 2.204622;
        if (sys === 'CGS') return val / 1000;
        return val;
      },
      fromSI: (val, sys) => {
        if (sys === 'US') return val * 2.204622;
        if (sys === 'CGS') return val * 1000;
        return val;
      },
      symbol: (sys) => {
        if (sys === 'US') return 'lb/s';
        if (sys === 'CGS') return 'g/s';
        return 'kg/s';
      }
    },
    'vol-flow': {
      toSI: (val, sys) => {
        if (sys === 'US') return val / 4.402868;
        if (sys === 'CGS') return val / 16.66667;
        return val;
      },
      fromSI: (val, sys) => {
        if (sys === 'US') return val * 4.402868;
        if (sys === 'CGS') return val * 16.66667;
        return val;
      },
      symbol: (sys) => {
        if (sys === 'US') return 'GPM';
        if (sys === 'CGS') return 'L/min';
        return 'm³/hr';
      }
    },
    'length-m': {
      toSI: (val, sys) => {
        if (sys === 'US') return val / 3.28084;
        if (sys === 'CGS') return val / 100;
        return val;
      },
      fromSI: (val, sys) => {
        if (sys === 'US') return val * 3.28084;
        if (sys === 'CGS') return val * 100;
        return val;
      },
      symbol: (sys) => {
        if (sys === 'US') return 'ft';
        if (sys === 'CGS') return 'cm';
        return 'm';
      }
    },
    'length-mm': {
      toSI: (val, sys) => {
        if (sys === 'US') return val / 0.0393701;
        return val;
      },
      fromSI: (val, sys) => {
        if (sys === 'US') return val * 0.0393701;
        return val;
      },
      symbol: (sys) => {
        if (sys === 'US') return 'in';
        return 'mm';
      }
    },
    'velocity': {
      toSI: (val, sys) => {
        if (sys === 'US') return val / 3.28084;
        return val;
      },
      fromSI: (val, sys) => {
        if (sys === 'US') return val * 3.28084;
        return val;
      },
      symbol: (sys) => {
        if (sys === 'US') return 'ft/s';
        return 'm/s';
      }
    },
    'power': {
      toSI: (val, sys) => {
        if (sys === 'US') return val / 1.341022;
        if (sys === 'CGS') return val / 859.845;
        return val;
      },
      fromSI: (val, sys) => {
        if (sys === 'US') return val * 1.341022;
        if (sys === 'CGS') return val * 859.845;
        return val;
      },
      symbol: (sys) => {
        if (sys === 'US') return 'HP';
        if (sys === 'CGS') return 'kcal/hr';
        return 'kW';
      }
    },
    'heat-duty': {
      toSI: (val, sys) => {
        if (sys === 'US') return val / 3412.142;
        if (sys === 'CGS') return val / 859.845;
        return val;
      },
      fromSI: (val, sys) => {
        if (sys === 'US') return val * 3412.142;
        if (sys === 'CGS') return val * 859.845;
        return val;
      },
      symbol: (sys) => {
        if (sys === 'US') return 'BTU/hr';
        if (sys === 'CGS') return 'kcal/hr';
        return 'kW';
      }
    },
    'cp': {
      toSI: (val, sys) => {
        if (sys === 'US') return val / 0.2388459;
        if (sys === 'CGS') return val / 0.2388459;
        return val;
      },
      fromSI: (val, sys) => {
        if (sys === 'US') return val * 0.2388459;
        if (sys === 'CGS') return val * 0.2388459;
        return val;
      },
      symbol: (sys) => {
        if (sys === 'US') return 'BTU/lb·°F';
        if (sys === 'CGS') return 'cal/g·°C';
        return 'kJ/kg·°C';
      }
    },
    'thermal-cond': {
      toSI: (val, sys) => {
        if (sys === 'US') return val / 0.577789;
        if (sys === 'CGS') return val / 0.859845;
        return val;
      },
      fromSI: (val, sys) => {
        if (sys === 'US') return val * 0.577789;
        if (sys === 'CGS') return val * 0.859845;
        return val;
      },
      symbol: (sys) => {
        if (sys === 'US') return 'BTU/hr·ft·°F';
        if (sys === 'CGS') return 'kcal/hr·m·°C';
        return 'W/m·°C';
      }
    },
    'htc': {
      toSI: (val, sys) => {
        if (sys === 'US') return val / 0.176110;
        if (sys === 'CGS') return val / 0.859845;
        return val;
      },
      fromSI: (val, sys) => {
        if (sys === 'US') return val * 0.176110;
        if (sys === 'CGS') return val * 0.859845;
        return val;
      },
      symbol: (sys) => {
        if (sys === 'US') return 'BTU/hr·ft²·°F';
        if (sys === 'CGS') return 'kcal/hr·m²·°C';
        return 'W/m²·°C';
      }
    },
    'fouling': {
      toSI: (val, sys) => {
        if (sys === 'US') return val / 5.678263;
        if (sys === 'CGS') return val / 1.163;
        return val;
      },
      fromSI: (val, sys) => {
        if (sys === 'US') return val * 5.678263;
        if (sys === 'CGS') return val * 1.163;
        return val;
      },
      symbol: (sys) => {
        if (sys === 'US') return 'hr·ft²·°F/BTU';
        if (sys === 'CGS') return 'hr·m²·°C/kcal';
        return 'm²·°C/W';
      }
    },
    'area': {
      toSI: (val, sys) => {
        if (sys === 'US') return val / 10.76391;
        return val;
      },
      fromSI: (val, sys) => {
        if (sys === 'US') return val * 10.76391;
        return val;
      },
      symbol: (sys) => {
        if (sys === 'US') return 'ft²';
        return 'm²';
      }
    },
    'temp-diff': {
      toSI: (val, sys) => {
        if (sys === 'US') return val / 1.8;
        return val;
      },
      fromSI: (val, sys) => {
        if (sys === 'US') return val * 1.8;
        return val;
      },
      symbol: (sys) => {
        if (sys === 'US') return '°F';
        return '°C';
      }
    }
  };

  let activeUnitSystem = 'SI';
  window.activeUnitSystem = activeUnitSystem;
  window.UNIT_CONVERSIONS = UNIT_CONVERSIONS;

  window.getInputValueSI = function(id) {
    const el = document.getElementById(id);
    if (!el) return 0;
    const val = parseFloat(el.value) || 0;
    const type = el.getAttribute('data-unit-type');
    if (type && UNIT_CONVERSIONS[type]) {
      return UNIT_CONVERSIONS[type].toSI(val, activeUnitSystem);
    }
    return val;
  };

  window.formatUnit = function(valSI, type, decimals = 2) {
    if (UNIT_CONVERSIONS[type]) {
      const val = UNIT_CONVERSIONS[type].fromSI(valSI, activeUnitSystem);
      const sym = UNIT_CONVERSIONS[type].symbol(activeUnitSystem);
      return {
        value: val.toFixed(decimals),
        symbol: sym
      };
    }
    return {
      value: valSI.toFixed(decimals),
      symbol: ''
    };
  };

  window.setOutputValue = function(id, valSI, type, decimals = 2) {
    const el = document.getElementById(id);
    if (el) {
      const formatted = formatUnit(valSI, type, decimals);
      el.textContent = formatted.value;
      el.setAttribute('data-val-si', valSI);
      el.setAttribute('data-unit-type', type);

      // Determine suffix for pressure gauge/absolute labels
      let suffix = "";
      if (id === "out-pump-net-suc-press" || id === "out-pump-disch-press-a" || id === "out-pump-shutoff-press" || id === "out-pump-vessel-press-a" || id === "out-pump-vp-bara" || id === "out-pump-suc-nozzle-press" || id === "out-pump-dis-nozzle-press") {
        suffix = " A";
      } else if (id === "out-pump-disch-press-g") {
        suffix = " G";
      }

      // Update unit label by ID if it exists
      const unitEl = document.getElementById(id + "-unit");
      if (unitEl) {
        unitEl.textContent = formatted.symbol + suffix;
      }

      // Update sibling res-unit span in the same parent div
      const parentDiv = el.parentElement;
      if (parentDiv) {
        const resUnit = parentDiv.querySelector('.res-unit');
        if (resUnit) {
          resUnit.textContent = formatted.symbol + suffix;
        }
      }

      // Update sub-line unit spans (e.g. vapor head "m" below main value)
      const resCard = el.closest('.pump-res-card');
      if (resCard) {
        const sub = resCard.querySelector('.res-sub');
        if (sub && type === 'length-m') {
          const subSpan = sub.querySelector('[data-unit-type]');
          if (subSpan) subSpan.textContent = formatted.symbol;
        }
      }

      const parent = el.closest('.result-card');
      if (parent) {
        const cardUnit = parent.querySelector('.card-unit');
        if (cardUnit) {
          cardUnit.textContent = formatted.symbol;
        }
      }
    }
  };

  window.updateUnitLabels = function() {
    document.querySelectorAll('[data-unit-type]').forEach(el => {
      const type = el.getAttribute('data-unit-type');
      if (UNIT_CONVERSIONS[type]) {
        const sym = UNIT_CONVERSIONS[type].symbol(activeUnitSystem);
        if (el.classList.contains('unit') || el.classList.contains('card-unit')) {
          el.textContent = sym;
        }
      }
    });
  };

  // Switch Unit System Event Listener
  document.addEventListener("DOMContentLoaded", () => {
    const selector = document.getElementById("global-unit-system");
    if (selector) {
      selector.addEventListener("change", function() {
        const oldSys = activeUnitSystem;
        const newSys = this.value;
        
        // Loop through all input elements that have data-unit-type
        document.querySelectorAll('input[data-unit-type]').forEach(el => {
          const val = parseFloat(el.value);
          if (isNaN(val)) return;
          const type = el.getAttribute('data-unit-type');
          if (UNIT_CONVERSIONS[type]) {
            const valSI = UNIT_CONVERSIONS[type].toSI(val, oldSys);
            const valNew = UNIT_CONVERSIONS[type].fromSI(valSI, newSys);
            el.value = valNew.toFixed(4).replace(/\.0000$/, '');
          }
        });

        activeUnitSystem = newSys;
        window.activeUnitSystem = newSys;
        updateUnitLabels();

        // Trigger calculations
        if (typeof runActualPumpCalculations === 'function') runActualPumpCalculations();
        if (typeof runActualLineCalculations === 'function') runActualLineCalculations();
        if (typeof runActualGasCalculations === 'function') runActualGasCalculations();
        if (typeof runActualSteamCalculations === 'function') runActualSteamCalculations();
        if (typeof runActualSlurryCalculations === 'function') runActualSlurryCalculations();
        if (typeof runActualTwoPhaseCalculations === 'function') runActualTwoPhaseCalculations();
        if (typeof calculateSTHE === 'function') calculateSTHE();
        var dpheForm = document.getElementById('dphe-form');
        if (dpheForm) dpheForm.dispatchEvent(new Event('submit'));

        logConsole(`Switched global unit system to ${newSys}`, "info");
      });
    }
    
    // Tag service table velocity/dp inputs for unit conversion
    document.querySelectorAll('[id^="vel-min-"], [id^="vel-max-"]').forEach(el => {
      if (!el.getAttribute('data-unit-type')) el.setAttribute('data-unit-type', 'velocity');
    });
    document.querySelectorAll('[id^="dp-lim-"]').forEach(el => {
      if (!el.getAttribute('data-unit-type')) el.setAttribute('data-unit-type', 'press-drop-rate');
    });

    // Initial call to set labels
    updateUnitLabels();
  });

  // --- OVERRIDDEN CALCULATIONS WITH UNIT SYSTEM COMPATIBILITY ---

  window.runActualPumpCalculations = runActualPumpCalculations;

  
  
  window.runActualLineCalculations = function() {
    // 1. Get inputs safely as SI units (or fallback to UI values if SI getter missing)
    const gv = (id) => parseFloat(document.getElementById(id)?.value || 0);
    const getSI = (id, defaultVal) => window.getInputValueSI ? (window.getInputValueSI(id) || defaultVal) : gv(id, defaultVal);
    const gs = (id, defaultVal) => { const el = document.getElementById(id); return el ? el.value : defaultVal; };
    const sd = (num, den, fallback = 0) => den === 0 ? fallback : num / den;
    const st = (id, text) => { const el = document.getElementById(id); if(el) el.textContent = text; };
    
    const density = getSI('line-density', 997);
    const viscosity = getSI('line-viscosity', 1.0);
    const nps_str = gs('line-nps', '4');
    const schedule = gs('line-schedule', '40');
    const roughness = getSI('line-roughness', 0.045); 
    const massFlow = getSI('line-mass-flow', 99700);
    const volFlow = getSI('line-flow', 100);
    const pipeLen = getSI('line-length', 4.0);
    const elev = getSI('line-elevation', 0.5);
    const otherDp = getSI('line-other-dp', 0.0);
    const pUpstream = getSI('line-upstream-press', 600000); // 6 bar -> 600k Pa
    const tempNorm = getSI('line-temp-norm', 34);

    const odMap = {
      "0.5": 0.840, "0.75": 1.050, "1": 1.315, "1.5": 1.900, "2": 2.375, "3": 3.500,
      "4": 4.500, "6": 6.625, "8": 8.625, "10": 10.750, "12": 12.750, "14": 14.000,
      "16": 16.000, "18": 18.000, "20": 20.000, "24": 24.000
    };
    const thkMap = {
      "0.5": 0.109, "0.75": 0.113, "1": 0.133, "1.5": 0.145, "2": 0.154, "3": 0.216,
      "4": 0.237, "6": 0.280, "8": 0.322, "10": 0.365, "12": 0.406, "14": 0.375,
      "16": 0.375, "18": 0.375, "20": 0.375, "24": 0.375
    };
    
    const od_in = odMap[nps_str] || 4.5;
    const thk_in = thkMap[nps_str] || 0.237; 
    
    const id_in = od_in - 2 * thk_in;
    const id_m = id_in * 0.0254;
    const id_mm = id_in * 25.4;
    
    if($('lbl-line-od')) $('lbl-line-od').textContent = `${od_in.toFixed(3)} in (${(od_in*25.4).toFixed(1)} mm)`;
    if($('lbl-line-thickness')) $('lbl-line-thickness').textContent = `${thk_in.toFixed(3)} in`;
    if($('lbl-line-nominal-id')) $('lbl-line-nominal-id').textContent = `${id_in.toFixed(3)} in (${id_mm.toFixed(1)} mm)`;
    
    // Roughness is retrieved as SI (meters), so convert to mm for UI/relRoughness if needed. 
    // Wait, getInputValueSI('line-roughness') returns meters.
    const roughness_m = roughness;
    const relRoughness = roughness_m / id_m;
    
    // Flow in SI is m3/s
    const q_m3s = volFlow / 3600; 
    const area = (Math.PI / 4) * Math.pow(id_m, 2);
    const velocity = sd(q_m3s, area, 0); // velocity is m/s
    
    // The UI uses Unit toggle formatters for everything
    const fval = (val, type, dec=2) => window.formatUnit ? window.formatUnit(val, type, dec).value : val.toFixed(dec);

    if($('lbl-line-velocity')) $('lbl-line-velocity').textContent = fval(velocity, 'velocity', 2);
    
    // Reynolds uses dynamic viscosity in Pa.s (which is kg/m.s). 
    // UI gives cP (mPa.s), SI gives Pa.s
    const viscosity_pas = viscosity * 1e-3; 
    const re = sd(density * velocity * id_m, viscosity_pas, 0);
    
    let regime = "LAMINAR";
    let regimeBadge = "badge-amber";
    if(re > 4000) { regime = "TURBULENT"; regimeBadge = "badge-teal"; }
    else if(re >= 2300) { regime = "TRANSITIONAL"; regimeBadge = "badge-amber"; }
    
    let f = 0.02;
    if(re > 0) {
      if(re < 2300) {
        f = 64 / re;
      } else {
        const term = relRoughness / 3.7 + 5.74 / Math.pow(re, 0.9);
        f = 0.25 / Math.pow(Math.log10(term), 2);
      }
    }
    
    const dp_major_pa = f * (pipeLen / id_m) * (density * Math.pow(velocity, 2) / 2);
    
    const dp_static_pa = density * 9.81 * elev;
    
    let sumK = 0;
    const kInputs = document.querySelectorAll('#fittings-table tbody tr');
    kInputs.forEach(tr => {
      const kVal = parseFloat(tr.querySelector('.k-val')?.value || 0);
      const qty = parseFloat(tr.querySelector('.k-qty')?.value || 0);
      if(!isNaN(kVal) && !isNaN(qty)) sumK += kVal * qty;
    });
    if($('lbl-minor-sum-k')) $('lbl-minor-sum-k').textContent = `ΣK=${sumK.toFixed(2)}`;
    
    const dp_minor_pa = sumK * (density * Math.pow(velocity, 2) / 2);
    
    const otherDp_pa = otherDp; // already in Pascals from SI getter
    
    const dp_total_pa = dp_major_pa + dp_static_pa + dp_minor_pa + otherDp_pa;
    const p_downstream_pa = pUpstream - dp_total_pa;
    
    // Pressure drop per 100m. dp_major_pa is for pipeLen.
    // SI unit for press-drop-rate could be Pa/m. UI asks for bar/100m. 
    // If our converter is designed for Pa/m as base SI:
    const dp_rate_pa_per_m = pipeLen > 0 ? dp_major_pa / pipeLen : 0;
    
    // API 14E Erosional Velocity
    const cFactor = gv('line-erosion-c', 125);
    const designPct = gv('line-erosion-setpoint', 75);
    const dens_lbft3 = density * 0.062428;
    const v_erosion_fps = cFactor / Math.sqrt(dens_lbft3 > 0 ? dens_lbft3 : 1);
    const v_erosion_ms = v_erosion_fps * 0.3048; // this is in SI (m/s)
    const v_design_erosion = v_erosion_ms * (designPct / 100);
    const erosionStatus = velocity < v_design_erosion ? "SAFE" : "EROSION RISK ⚠";
    
    const activeRadio = document.querySelector('input[name="line-active-service"]:checked');
    const activeRow = activeRadio ? activeRadio.closest('tr') : null;
    
    let vMin_ms = 0.5, vMax_ms = 3.0, dpLimit_bar100m = 0.45;
    let serviceName = "General";
    if(activeRow) {
      const inputs = activeRow.querySelectorAll('input[type="number"]');
      if(inputs.length >= 3) {
        // These inputs are raw UI values. E.g. 1.0 m/s or 3.28 ft/s depending on UI.
        // We need to convert them to SI.
        const vMin_ui = parseFloat(inputs[0].value) || vMin_ms;
        const vMax_ui = parseFloat(inputs[1].value) || vMax_ms;
        const dpLim_ui = parseFloat(inputs[2].value) || dpLimit_bar100m;
        
        vMin_ms = window.UNIT_CONVERSIONS && window.UNIT_CONVERSIONS['velocity'] ? window.UNIT_CONVERSIONS['velocity'].toSI(vMin_ui, window.activeUnitSystem) : vMin_ui;
        vMax_ms = window.UNIT_CONVERSIONS && window.UNIT_CONVERSIONS['velocity'] ? window.UNIT_CONVERSIONS['velocity'].toSI(vMax_ui, window.activeUnitSystem) : vMax_ui;
        // The table limit is unit-mapped to press-drop-rate
        let dpLim_si = window.UNIT_CONVERSIONS && window.UNIT_CONVERSIONS['press-drop-rate'] ? window.UNIT_CONVERSIONS['press-drop-rate'].toSI(dpLim_ui, window.activeUnitSystem) : dpLim_ui;
        dpLimit_bar100m = dpLim_si; // Actually dpLimit_si is now Pa/m
      }
      const td = activeRow.querySelector('td:nth-child(2)');
      serviceName = td ? td.textContent.trim() : "General";
    }
    
    st('out-line-pid', gs('line-pid', '-'));
    st('out-line-route', `${gs('line-from', '-')} → ${gs('line-to', '-')}`);
    st('out-line-nps', nps_str);
    st('out-line-schedule', schedule);
    st('out-line-nom-dia', id_in.toFixed(3));
    st('out-line-od', `${od_in.toFixed(3)} / ${(od_in*25.4).toFixed(1)}`);
    st('out-line-nominal-id', id_mm.toFixed(1));
    const fluidSel = $('line-fluid');
    st('out-line-fluid', fluidSel && fluidSel.selectedIndex > -1 ? fluidSel.options[fluidSel.selectedIndex].text : '-');
    st('out-line-operating-temp', fval(tempNorm, 'temperature', 1));
    st('out-line-service', serviceName);
    st('out-line-viscosity', fval(viscosity, 'viscosity', 2));
    st('out-line-density', fval(density, 'density', 2));
    st('out-line-upstream-press', fval(pUpstream, 'pressure', 2));
    st('out-line-downstream-press', fval(p_downstream_pa, 'pressure', 2));
    st('out-line-total-dp', fval(dp_total_pa, 'press-drop', 4));
    st('out-line-dp-per-100m', fval(dp_rate_pa_per_m, 'press-drop-rate', 4));
    st('out-line-mass-flow', fval(massFlow, 'mass-flow', 1));
    st('out-line-vol-flow', fval(volFlow, 'vol-flow', 2));
    st('out-line-velocity', fval(velocity, 'velocity', 2));
    st('out-line-reynolds', Math.round(re).toLocaleString());
    st('out-line-behavior', regime);
    st('out-line-f-factor', f.toFixed(4));
    st('out-line-rel-roughness', relRoughness.toFixed(5));
    st('out-line-v-erosion-100', fval(v_erosion_ms, 'velocity', 2));
    st('out-line-v-erosion-design', fval(v_design_erosion, 'velocity', 2));
    st('out-line-erosion-cond', erosionStatus);
    
    st('out-line-dp-major-pa', Math.round(dp_major_pa).toLocaleString());
    st('out-line-dp-major-bar', fval(dp_major_pa, 'press-drop', 4));
    st('out-line-dp-static-pa', Math.round(dp_static_pa).toLocaleString());
    st('out-line-dp-static-bar', fval(dp_static_pa, 'press-drop', 4));
    st('out-line-dp-minor-pa', Math.round(dp_minor_pa).toLocaleString());
    st('out-line-dp-minor-bar', fval(dp_minor_pa, 'press-drop', 4));
    st('out-line-dp-other-pa', Math.round(otherDp_pa).toLocaleString());
    st('out-line-dp-other-bar', fval(otherDp_pa, 'press-drop', 4));
    st('out-line-dp-total-pa', Math.round(dp_total_pa).toLocaleString());
    st('out-line-dp-total-bar', fval(dp_total_pa, 'press-drop', 4));
    
    const bVelMin = velocity >= vMin_ms ? ["✓ YES", "badge-teal"] : ["✗ NO", "badge-red"];
    const bVelMax = velocity <= vMax_ms ? ["✓ YES", "badge-teal"] : ["✗ NO", "badge-red"];
    
    let recBadge = "✓ OPTIMAL", recClass = "badge-teal";
    if(velocity < vMin_ms) { recBadge = "Decrease Pipe Size"; recClass = "badge-amber"; }
    else if(velocity > vMax_ms) { recBadge = "Increase Pipe Size"; recClass = "badge-red"; }
    
    const bDp = dp_rate_pa_per_m <= dpLimit_bar100m ? ["✓ WITHIN LIMIT", "badge-teal"] : ["✗ EXCEEDS LIMIT", "badge-red"];
    const bErosion = velocity < v_design_erosion ? ["✓ SAFE", "badge-teal"] : ["⚠ EROSION RISK", "badge-red"];
    
    if($('badge-vel-min')) { $('badge-vel-min').textContent = `Vel vs Min: ${bVelMin[0]}`; $('badge-vel-min').className = `badge ${bVelMin[1]}`; }
    if($('badge-vel-max')) { $('badge-vel-max').textContent = `Vel vs Max: ${bVelMax[0]}`; $('badge-vel-max').className = `badge ${bVelMax[1]}`; }
    if($('badge-vel-rec')) { $('badge-vel-rec').textContent = `Rec: ${recBadge}`; $('badge-vel-rec').className = `badge ${recClass}`; }
    if($('badge-dp-status')) { $('badge-dp-status').textContent = `ΔP: ${bDp[0]}`; $('badge-dp-status').className = `badge ${bDp[1]}`; }
    if($('badge-erosion-status')) { $('badge-erosion-status').textContent = `Erosion: ${bErosion[0]}`; $('badge-erosion-status').className = `badge ${bErosion[1]}`; }
    if($('badge-regime-status')) { $('badge-regime-status').textContent = `Flow: ${regime}`; $('badge-regime-status').className = `badge ${regimeBadge}`; }

    // Summary Report logic using formatted UI strings so they look perfect in the print out
    st('rep-line-nps', `${nps_str}" Sch ${schedule}`);
    st('rep-line-id', `${id_mm.toFixed(1)} mm`);
    const matSel = $('line-material');
    st('rep-line-material', matSel && matSel.selectedIndex > -1 ? matSel.options[matSel.selectedIndex].text : '-');
    st('rep-line-length', fval(pipeLen, 'length-m', 1) + ' ' + (window.UNIT_CONVERSIONS['length-m'].symbol(window.activeUnitSystem)));
    st('rep-line-service', serviceName);
    st('rep-line-flow', fval(volFlow, 'vol-flow', 2) + ' ' + (window.UNIT_CONVERSIONS['vol-flow'].symbol(window.activeUnitSystem)));
    st('rep-line-velocity', fval(velocity, 'velocity', 2) + ' ' + (window.UNIT_CONVERSIONS['velocity'].symbol(window.activeUnitSystem)));
    st('rep-line-v-erosion', fval(v_design_erosion, 'velocity', 2) + ' ' + (window.UNIT_CONVERSIONS['velocity'].symbol(window.activeUnitSystem)));
    st('rep-line-reynolds', Math.round(re).toLocaleString());
    st('rep-line-f', f.toFixed(4));
    st('rep-line-dp-pipe', fval(dp_major_pa, 'press-drop', 4) + ' ' + (window.UNIT_CONVERSIONS['press-drop'].symbol(window.activeUnitSystem)));
    st('rep-line-dp-fittings', fval(dp_minor_pa, 'press-drop', 4) + ' ' + (window.UNIT_CONVERSIONS['press-drop'].symbol(window.activeUnitSystem)));
    st('rep-line-dp-elevation', fval(dp_static_pa, 'press-drop', 4) + ' ' + (window.UNIT_CONVERSIONS['press-drop'].symbol(window.activeUnitSystem)));
    st('rep-line-dp-other', fval(otherDp_pa, 'press-drop', 4) + ' ' + (window.UNIT_CONVERSIONS['press-drop'].symbol(window.activeUnitSystem)));
    st('rep-line-dp-total', fval(dp_total_pa, 'press-drop', 4) + ' ' + (window.UNIT_CONVERSIONS['press-drop'].symbol(window.activeUnitSystem)));
    st('rep-line-dp-100m', fval(dp_rate_pa_per_m, 'press-drop-rate', 4) + ' ' + (window.UNIT_CONVERSIONS['press-drop-rate'].symbol(window.activeUnitSystem)));
    
    const sumVelOk = (velocity >= vMin_ms && velocity <= vMax_ms);
    if($('rep-audit-velocity')) {
      const vUI = fval(velocity, 'velocity', 2);
      const minUI = fval(vMin_ms, 'velocity', 2);
      const maxUI = fval(vMax_ms, 'velocity', 2);
      $('rep-audit-velocity').textContent = sumVelOk ? `✓ PASS (${vUI} vs ${minUI}-${maxUI})` : `✗ FAIL (${vUI} vs ${minUI}-${maxUI})`;
      $('rep-audit-velocity').className = sumVelOk ? 'status-pass' : 'status-fail';
    }
    const sumDpOk = (dp_rate_pa_per_m <= dpLimit_bar100m);
    if($('rep-audit-dp')) {
      const dpUI = fval(dp_rate_pa_per_m, 'press-drop-rate', 3);
      const dpLimUI = fval(dpLimit_bar100m, 'press-drop-rate', 3);
      $('rep-audit-dp').textContent = sumDpOk ? `✓ PASS (${dpUI} vs ${dpLimUI})` : `✗ FAIL (${dpUI} vs ${dpLimUI})`;
      $('rep-audit-dp').className = sumDpOk ? 'status-pass' : 'status-fail';
    }
    if($('rep-audit-erosion')) {
      $('rep-audit-erosion').textContent = velocity < v_design_erosion ? 'SAFE' : 'RISK';
      $('rep-audit-erosion').className = velocity < v_design_erosion ? 'status-pass' : 'status-fail';
    }
    st('rep-line-type', serviceName);

    if(window.runLineDesignAssistant) {
      window.runLineDesignAssistant({
        velocity, vMin_ms, vMax_ms, dp_rate_pa_per_m, dpLimit_bar100m, v_design_erosion, re, p_downstream_pa,
        currentNps: nps_str, serviceName
      });
    }

    if(window.updateLineAnimation) {
      window.updateLineAnimation();
    }
  };

  window.runLineDesignAssistant = function(data) {
    const pnl = $('line-assistant-panel');
    const cnt = $('line-assistant-content');
    if(!pnl || !cnt) return;
    
    pnl.style.display = 'block';
    cnt.innerHTML = '';
    
    let violations = 0;
    
    const addRow = (msg, applyFnStr) => {
      violations++;
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.alignItems = 'center';
      row.style.padding = '6px';
      row.style.marginBottom = '4px';
      row.style.borderLeft = '3px solid var(--color-warn)';
      row.style.background = 'rgba(255, 193, 7, 0.05)';
      
      const txt = document.createElement('span');
      txt.textContent = msg;
      
      const btn = document.createElement('button');
      btn.className = 'btn btn-outline';
      btn.style.padding = '2px 8px';
      btn.style.fontSize = '9px';
      btn.textContent = 'APPLY ⚡';
      btn.onclick = () => {
        eval(applyFnStr);
        row.style.borderLeft = '3px solid var(--color-teal)';
        row.style.background = 'rgba(0, 196, 160, 0.05)';
        txt.textContent = '✓ CORRECTED — ' + msg;
        btn.style.display = 'none';
      };
      
      row.appendChild(txt);
      row.appendChild(btn);
      cnt.appendChild(row);
    };

    const getNextNps = (current, dir) => {
      const opts = Array.from($('line-nps').options).map(o => o.value);
      const idx = opts.indexOf(current.toString());
      if(idx === -1) return current;
      const nextIdx = idx + dir;
      if(nextIdx >= 0 && nextIdx < opts.length) return opts[nextIdx];
      return current;
    };
    
    const fval = (val, type, dec=2) => window.formatUnit ? window.formatUnit(val, type, dec).value : val.toFixed(dec);
    const vUI = fval(data.velocity, 'velocity');
    const minUI = fval(data.vMin_ms, 'velocity');
    const maxUI = fval(data.vMax_ms, 'velocity');
    const uVel = window.UNIT_CONVERSIONS && window.UNIT_CONVERSIONS['velocity'] ? window.UNIT_CONVERSIONS['velocity'].symbol(window.activeUnitSystem) : 'm/s';

    if(data.velocity < data.vMin_ms) {
      const next = getNextNps(data.currentNps, -1);
      if(next !== data.currentNps) {
        addRow(`Line velocity ${vUI} ${uVel} is BELOW minimum ${minUI} ${uVel}. Recommend NPS ${next}".`, `sv('line-nps', '${next}'); window.runActualLineCalculations();`);
      }
    }
    if(data.velocity > data.vMax_ms) {
      const next = getNextNps(data.currentNps, 1);
      if(next !== data.currentNps) {
        addRow(`Line velocity ${vUI} ${uVel} EXCEEDS maximum ${maxUI} ${uVel}. Recommend NPS ${next}".`, `sv('line-nps', '${next}'); window.runActualLineCalculations();`);
      }
    }
    
    const dpUI = fval(data.dp_rate_pa_per_m, 'press-drop-rate', 3);
    const dpLimUI = fval(data.dpLimit_bar100m, 'press-drop-rate', 3);
    const uDp = window.UNIT_CONVERSIONS && window.UNIT_CONVERSIONS['press-drop-rate'] ? window.UNIT_CONVERSIONS['press-drop-rate'].symbol(window.activeUnitSystem) : 'bar/100m';

    if(data.dp_rate_pa_per_m > data.dpLimit_bar100m) {
      const next = getNextNps(data.currentNps, 1);
      if(next !== data.currentNps) {
        addRow(`Pressure drop ${dpUI} ${uDp} exceeds limit ${dpLimUI}. Increasing to NPS ${next}".`, `sv('line-nps', '${next}'); window.runActualLineCalculations();`);
      }
    }
    if(data.velocity > data.v_design_erosion) {
      const next = getNextNps(data.currentNps, 1);
      if(next !== data.currentNps) {
        addRow(`Velocity exceeds API 14E erosion limit. Recommend NPS ${next}".`, `sv('line-nps', '${next}'); window.runActualLineCalculations();`);
      }
    }
    if(data.re >= 2300 && data.re <= 4000) {
      const next = getNextNps(data.currentNps, -1);
      if(next !== data.currentNps) {
        addRow(`Flow is TRANSITIONAL (Re = ${Math.round(data.re)}). Step down to NPS ${next}" for turbulence.`, `sv('line-nps', '${next}'); window.runActualLineCalculations();`);
      }
    }
    if(data.p_downstream_pa < 0) {
      const next = getNextNps(data.currentNps, 1);
      if(next !== data.currentNps) {
        addRow(`Downstream pressure is negative. Step up to NPS ${next}".`, `sv('line-nps', '${next}'); window.runActualLineCalculations();`);
      } else {
        addRow(`⚠ Upstream pressure must be increased — pipe sizing alone cannot resolve negative pressure.`, `sv('line-upstream-press', (parseFloat(gv('line-upstream-press',6))+1).toFixed(1)); window.runActualLineCalculations();`);
      }
    }
    if(data.dp_rate_pa_per_m > 2 * data.dpLimit_bar100m) {
      let next = getNextNps(data.currentNps, 1);
      next = getNextNps(next, 1);
      if(next !== data.currentNps) {
        addRow(`Pressure drop > 2× limit. Consider stepping up 2 sizes to NPS ${next}".`, `sv('line-nps', '${next}'); window.runActualLineCalculations();`);
      }
    }
    
    if(violations === 0) {
      cnt.innerHTML = '<div style="padding: 6px; background: rgba(0,196,160,0.1); border-left: 3px solid var(--color-teal); color: var(--color-teal); font-weight: bold;">✓ ALL LINE SIZING PARAMETERS WITHIN RECOMMENDED RANGE — NO CORRECTIONS NEEDED</div>';
    }
  };

  window.runActualGasCalculations = function() {
  const isMetric = window.currentUnitSystem === 'metric';

  // HELPER DOM FUNCTIONS
  const gv = (id) => parseFloat(document.getElementById(id)?.value || 0);
  const sv = (id, val) => { const el = document.getElementById(id); if(el) el.value = val; };
  const st = (id, text) => { const el = document.getElementById(id); if(el) el.innerText = text; };
  const getSI = (id, type) => window.getInputValueSI(document.getElementById(id), type);
  const format = (val, type) => window.formatUnit(val, type);
  
  // 1. GATHER INPUTS
  const mw = gv('gas-mw');
  const z = gv('gas-z');
  const gamma = gv('gas-gamma');
  const r = 8314.46; // J/(kmol.K)
  const T_norm_C = gv('gas-temp-norm');
  const T_norm_K = T_norm_C + 273.15;
  
  // Upstream pressure (convert to absolute Pa for density)
  const P_up_gauge_pa = getSI('gas-upstream-press', 'pressure');
  const P_up_abs_pa = P_up_gauge_pa + 101325; // add 1 atm
  
  // Viscosity (cP -> Pa.s)
  const visc_cp = gv('gas-viscosity');
  const visc_pa_s = visc_cp * 0.001; 

  // Pipe Data
  const nps = document.getElementById('gas-nps')?.value || '3';
  const sch = document.getElementById('gas-schedule')?.value || '40';
  const roughness_mm = gv('gas-roughness');
  const roughness_m = roughness_mm / 1000;
  
  // Lookup pipe geometry from embedded global lineSizeData if available
  let od_mm = 88.9, thk_mm = 5.49, id_mm = 77.92;
  if (window.lineSizeData && window.lineSizeData[nps]) {
    const pipeData = window.lineSizeData[nps];
    od_mm = pipeData.od;
    if (pipeData.schedules[sch]) {
      thk_mm = pipeData.schedules[sch].thk;
      id_mm = pipeData.schedules[sch].id;
    }
  }
  const id_m = id_mm / 1000;
  const area_m2 = (Math.PI / 4) * Math.pow(id_m, 2);

  // 2. GAS DENSITY CALCULATION (Ideal Gas Law with Compressibility)
  // rho = (P * MW) / (Z * R * T)
  const rho_kg_m3 = (P_up_abs_pa * mw) / (z * r * T_norm_K);
  const rho_lb_ft3 = rho_kg_m3 * 0.062428;
  
  st('lbl-gas-density-kg', rho_kg_m3.toFixed(2) + ' kg/m³');
  st('lbl-gas-density-lb', rho_lb_ft3.toFixed(3) + ' lb/ft³');
  
  // Update UI geometry displays
  st('lbl-gas-od', od_mm.toFixed(2) + ' mm');
  st('lbl-gas-thickness', thk_mm.toFixed(2) + ' mm');
  st('lbl-gas-nominal-id', id_mm.toFixed(2) + ' mm');

  // 3. FLOW CALCULATIONS
  // Volumetric Flow is usually provided at Standard Conditions (Sm3/hr) or Actual (Am3/hr).
  // Assuming the input is Actual Volumetric Flow for simplicity, or we convert based on density.
  // Using actual volumetric flow for velocity:
  const q_actual_m3_hr = getSI('gas-flow', 'vol-flow') * 3600; // SI gives m3/s, convert to m3/hr ? Wait, getInputValueSI for vol-flow returns m3/s.
  const q_m3_s = getSI('gas-flow', 'vol-flow');
  
  const mass_flow_kg_s = q_m3_s * rho_kg_m3;
  const mass_flow_kg_hr = mass_flow_kg_s * 3600;
  
  const velocity_m_s = q_m3_s / area_m2;
  
  st('lbl-gas-mass-flow', mass_flow_kg_hr.toFixed(2) + ' kg/hr');
  st('lbl-gas-velocity', velocity_m_s.toFixed(2) + ' m/s');

  // 4. SPEED OF SOUND & MACH NUMBER
  // Speed of sound c = sqrt(gamma * R_specific * T)
  // R_specific = R_universal / MW = 8314.46 / mw (J/kg.K)
  const r_specific = r / mw;
  const c_sonic_m_s = Math.sqrt(gamma * z * r_specific * T_norm_K);
  const mach_number = velocity_m_s / c_sonic_m_s;

  // 5. REYNOLDS & FRICTION (Swamee-Jain)
  const reynolds = (rho_kg_m3 * velocity_m_s * id_m) / visc_pa_s;
  let f_factor = 0.02;
  let behavior = "Turbulent";
  const rel_roughness = roughness_m / id_m;
  
  if (reynolds < 2000) {
    f_factor = 64 / reynolds;
    behavior = "Laminar";
  } else if (reynolds > 4000) {
    // Swamee-Jain explicit equation for turbulent flow
    const logTerm = Math.log10((rel_roughness / 3.7) + (5.74 / Math.pow(reynolds, 0.9)));
    f_factor = 0.25 / Math.pow(logTerm, 2);
  } else {
    // Transitional - simple interpolation or fixed
    f_factor = 0.03;
    behavior = "Transitional";
  }

  // 6. PRESSURE DROP (Darcy-Weisbach)
  const L = getSI('gas-length', 'length-m');
  const H = getSI('gas-elevation', 'length-m');
  const dp_other_pa = getSI('gas-other-dp', 'press-drop');
  
  const dynamic_pressure_pa = 0.5 * rho_kg_m3 * Math.pow(velocity_m_s, 2);
  
  // Major Loss
  const dp_major_pa = f_factor * (L / id_m) * dynamic_pressure_pa;
  
  // Static Head
  const dp_static_pa = rho_kg_m3 * 9.81 * H;
  
  // Minor Loss (K factor sum)
  let sum_k = 0;
  const kVals = document.querySelectorAll('#gas-fittings-table .k-val');
  const kQtys = document.querySelectorAll('#gas-fittings-table .k-qty');
  for (let i = 0; i < kVals.length; i++) {
    sum_k += parseFloat(kVals[i].value || 0) * parseFloat(kQtys[i].value || 0);
  }
  st('lbl-gas-minor-sum-k', 'ΣK=' + sum_k.toFixed(2));
  
  const dp_minor_pa = sum_k * dynamic_pressure_pa;
  
  // Total DP
  const dp_total_pa = dp_major_pa + dp_static_pa + dp_minor_pa + dp_other_pa;
  const dp_per_100m_pa = L > 0 ? (dp_total_pa / L) * 100 : 0;
  
  const P_down_abs_pa = P_up_abs_pa - dp_total_pa;
  const P_down_gauge_pa = P_down_abs_pa - 101325;

  // 7. EROSIONAL VELOCITY (API 14E)
  let c_factor = 100;
  const selectedC = document.querySelector('input[name="gas-erosion-c"]:checked');
  if (selectedC) {
    if (selectedC.value === 'user') {
      const parentTr = selectedC.closest('tr');
      if (parentTr) {
        c_factor = parseFloat(parentTr.querySelector('input[type="number"]').value) || 100;
      }
    } else {
      c_factor = parseFloat(selectedC.value);
    }
  }
  // API 14E: Ve = C / sqrt(rho) where rho is in lb/ft3 and Ve is in ft/s
  // Then convert ft/s back to m/s
  const v_erosion_ft_s = c_factor / Math.sqrt(rho_lb_ft3);
  const v_erosion_100_m_s = v_erosion_ft_s * 0.3048;
  
  const erosion_setpoint = gv('gas-erosion-setpoint') / 100;
  const v_erosion_design_m_s = v_erosion_100_m_s * erosion_setpoint;

  // 8. UPDATE DATASHEET UI
  st('out-gas-pid', document.getElementById('gas-pid')?.value || 'N/A');
  st('out-gas-route', (document.getElementById('gas-from')?.value || '') + ' → ' + (document.getElementById('gas-to')?.value || ''));
  st('out-gas-nps', nps + '"');
  st('out-gas-schedule', sch);
  st('out-gas-nom-dia', nps);
  st('out-gas-od', (od_mm / 25.4).toFixed(3) + ' / ' + od_mm.toFixed(1));
  st('out-gas-nominal-id', id_mm.toFixed(2));
  
  const fluidSelect = document.getElementById('gas-fluid');
  st('out-gas-fluid', fluidSelect.options[fluidSelect.selectedIndex].text);
  st('out-gas-operating-temp', format(T_norm_C, 'temperature'));
  
  const serviceRadio = document.querySelector('input[name="gas-active-service"]:checked');
  st('out-gas-service', serviceRadio ? serviceRadio.value : 'N/A');
  
  st('out-gas-mw', mw.toFixed(2));
  st('out-gas-viscosity', format(visc_cp, 'viscosity'));
  st('out-gas-z', z.toFixed(4));
  st('out-gas-gamma', gamma.toFixed(3));
  st('out-gas-density-kg', rho_kg_m3.toFixed(3));
  st('out-gas-density-lb', rho_lb_ft3.toFixed(3));
  
  st('out-gas-upstream-press', format(P_up_gauge_pa, 'pressure'));
  st('out-gas-downstream-press', format(P_down_gauge_pa, 'pressure'));
  
  st('out-gas-total-dp', format(dp_total_pa, 'press-drop'));
  st('out-gas-dp-per-100m', format(dp_per_100m_pa, 'press-drop-rate'));
  
  st('out-gas-vol-flow', format(q_m3_s, 'vol-flow'));
  st('out-gas-mass-flow', format(mass_flow_kg_s, 'mass-flow'));
  st('out-gas-velocity', format(velocity_m_s, 'velocity'));
  st('out-gas-sonic-vel', format(c_sonic_m_s, 'velocity'));
  st('out-gas-mach', mach_number.toFixed(4));
  
  st('out-gas-reynolds', Math.round(reynolds).toLocaleString());
  st('out-gas-behavior', behavior);
  st('out-gas-f-factor', f_factor.toFixed(5));
  st('out-gas-rel-roughness', rel_roughness.toFixed(6));
  
  st('out-gas-v-erosion-100', format(v_erosion_100_m_s, 'velocity'));
  st('out-gas-v-erosion-design', format(v_erosion_design_m_s, 'velocity'));
  
  const isErosionSafe = velocity_m_s <= v_erosion_design_m_s;
  st('out-gas-erosion-cond', isErosionSafe ? 'SAFE' : 'EROSION RISK');
  
  // Pressure Drop Table
  const toBar = pa => pa / 100000;
  st('out-gas-dp-major-pa', dp_major_pa.toFixed(0));
  st('out-gas-dp-major-bar', toBar(dp_major_pa).toFixed(4));
  st('out-gas-dp-static-pa', dp_static_pa.toFixed(0));
  st('out-gas-dp-static-bar', toBar(dp_static_pa).toFixed(4));
  st('out-gas-dp-minor-pa', dp_minor_pa.toFixed(0));
  st('out-gas-dp-minor-bar', toBar(dp_minor_pa).toFixed(4));
  st('out-gas-dp-other-pa', dp_other_pa.toFixed(0));
  st('out-gas-dp-other-bar', toBar(dp_other_pa).toFixed(4));
  st('out-gas-dp-total-pa', dp_total_pa.toFixed(0));
  st('out-gas-dp-total-bar', toBar(dp_total_pa).toFixed(4));
  
  // Update Report Tables too
  st('rep-gas-nps', nps + '" / ' + sch);
  st('rep-gas-id', id_mm.toFixed(2) + ' mm');
  st('rep-gas-fluid', fluidSelect.options[fluidSelect.selectedIndex].text);
  st('rep-gas-z', z.toFixed(4));
  st('rep-gas-mass-flow', format(mass_flow_kg_s, 'mass-flow') + ' ' + (isMetric ? 'kg/hr' : 'lb/hr'));
  st('rep-gas-density', rho_kg_m3.toFixed(2) + ' kg/m³');
  st('rep-gas-velocity', format(velocity_m_s, 'velocity') + ' ' + (isMetric ? 'm/s' : 'ft/s'));
  st('rep-gas-v-erosion', format(v_erosion_design_m_s, 'velocity') + ' ' + (isMetric ? 'm/s' : 'ft/s'));
  st('rep-gas-mach', mach_number.toFixed(4));
  st('rep-gas-sonic', format(c_sonic_m_s, 'velocity') + ' ' + (isMetric ? 'm/s' : 'ft/s'));
  st('rep-gas-dp-pipe', format(dp_major_pa, 'press-drop') + ' ' + (isMetric ? 'bar' : 'psi'));
  st('rep-gas-dp-fittings', format(dp_minor_pa, 'press-drop') + ' ' + (isMetric ? 'bar' : 'psi'));
  st('rep-gas-dp-total', format(dp_total_pa, 'press-drop') + ' ' + (isMetric ? 'bar' : 'psi'));
  st('rep-gas-dp-100m', format(dp_per_100m_pa, 'press-drop-rate') + ' ' + (isMetric ? 'bar/100m' : 'psi/100ft'));

  // 9. CALL DESIGN ASSISTANT
  if (typeof window.runGasDesignAssistant === 'function') {
    window.runGasDesignAssistant({
      velocity: velocity_m_s,
      dp_100m: dp_per_100m_pa, // in Pa, will convert to bar internally
      mach: mach_number,
      erosion_v: v_erosion_design_m_s,
      P_down: P_down_gauge_pa,
      reynolds: reynolds
    });
  }
};

window.runGasDesignAssistant = function(data) {
  const isMetric = window.currentUnitSystem === 'metric';
  const panel = document.getElementById('gas-assistant-panel');
  const content = document.getElementById('gas-assistant-content');
  
  if (!panel || !content) return;
  
  let html = '';
  let issuesCount = 0;
  
  // Find limits
  let v_min = 10, v_max = 25, dp_limit_bar = 0.2;
  const activeService = document.querySelector('input[name="gas-active-service"]:checked');
  if (activeService) {
    const parentRow = activeService.closest('tr');
    if (parentRow) {
      const inputs = parentRow.querySelectorAll('input[type="number"]');
      if (inputs.length >= 3) {
        v_min = parseFloat(inputs[0].value) || 0;
        v_max = parseFloat(inputs[1].value) || 0;
        dp_limit_bar = parseFloat(inputs[2].value) || 0;
      }
    }
  }
  
  const dp_limit_pa = dp_limit_bar * 100000;
  
  // Helpers to color badges
  const badge = (id, text, type) => {
    const el = document.getElementById(id);
    if(el) {
      el.innerText = text;
      el.className = 'badge'; // reset
      if(type === 'ok') el.classList.add('badge-success');
      if(type === 'warn') el.classList.add('badge-warn');
      if(type === 'err') el.classList.add('badge-danger');
    }
  };
  
  // Check 1: Velocity Minimum
  if (data.velocity < v_min) {
    issuesCount++;
    html += `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span>[!] Low Velocity: ${data.velocity.toFixed(2)} m/s < Minimum ${v_min.toFixed(2)} m/s. Risk of phase separation or liquid pooling.</span>
        <button type="button" class="btn btn-sm" style="background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2); color: white;" onclick="window.applyGasNPSChange(-1)">DECREASE NPS ⚡</button>
      </div>`;
    badge('badge-gas-vel-min', 'LOW VELOCITY', 'warn');
  } else {
    badge('badge-gas-vel-min', 'OK', 'ok');
  }
  
  // Check 2: Velocity Maximum
  if (data.velocity > v_max) {
    issuesCount++;
    html += `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span>[!] High Velocity: ${data.velocity.toFixed(2)} m/s > Maximum ${v_max.toFixed(2)} m/s. High pressure drop expected.</span>
        <button type="button" class="btn btn-sm" style="background: rgba(255, 117, 56, 0.2); border: 1px solid var(--color-saffron); color: var(--color-saffron);" onclick="window.applyGasNPSChange(1)">INCREASE NPS ⚡</button>
      </div>`;
    badge('badge-gas-vel-max', 'EXCEEDS MAX', 'err');
    document.getElementById('gas-banner-velocity').style.display = 'block';
  } else {
    badge('badge-gas-vel-max', 'OK', 'ok');
    document.getElementById('gas-banner-velocity').style.display = 'none';
  }
  
  // Check 3: Pressure Drop
  if (data.dp_100m > dp_limit_pa) {
    issuesCount++;
    html += `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span>[!] High Pressure Loss: ${(data.dp_100m/100000).toFixed(3)} bar/100m > Limit ${dp_limit_bar} bar/100m.</span>
        <button type="button" class="btn btn-sm" style="background: rgba(255, 117, 56, 0.2); border: 1px solid var(--color-saffron); color: var(--color-saffron);" onclick="window.applyGasNPSChange(1)">INCREASE NPS ⚡</button>
      </div>`;
    badge('badge-gas-dp-status', 'EXCEEDS LIMIT', 'err');
    document.getElementById('gas-banner-dp').style.display = 'block';
  } else {
    badge('badge-gas-dp-status', 'OK', 'ok');
    document.getElementById('gas-banner-dp').style.display = 'none';
  }
  
  // Check 4 & 5: Mach Number
  document.getElementById('gas-banner-mach').style.display = 'none';
  document.getElementById('gas-banner-choke').style.display = 'none';
  if (data.mach >= 1.0) {
    issuesCount++;
    html += `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span style="color: var(--color-danger); font-weight: bold;">[CRITICAL] Choked Flow: Mach >= 1.0. System cannot pass requested flowrate!</span>
        <button type="button" class="btn btn-sm" style="background: var(--color-danger); color: white;" onclick="window.applyGasNPSChange(1)">URGENT INCREASE ⚡</button>
      </div>`;
    badge('badge-gas-mach-status', 'CHOKED (FAIL)', 'err');
    document.getElementById('gas-banner-choke').style.display = 'block';
  } else if (data.mach >= 0.3) {
    issuesCount++;
    html += `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span>[!] High Mach Number: Mach ${data.mach.toFixed(2)} >= 0.3. Compressibility effects must be considered.</span>
        <button type="button" class="btn btn-sm" style="background: rgba(255, 117, 56, 0.2); border: 1px solid var(--color-saffron); color: var(--color-saffron);" onclick="window.applyGasNPSChange(1)">INCREASE NPS ⚡</button>
      </div>`;
    badge('badge-gas-mach-status', 'COMPRESSIBILITY WARN', 'warn');
    document.getElementById('gas-banner-mach').style.display = 'block';
  } else {
    badge('badge-gas-mach-status', 'INCOMPRESSIBLE (<0.3)', 'ok');
  }
  
  // Check 6: Erosion
  if (data.velocity > data.erosion_v) {
    issuesCount++;
    html += `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span>[!] Erosion Risk: Velocity > API 14E allowable limit (${data.erosion_v.toFixed(2)} m/s).</span>
        <button type="button" class="btn btn-sm" style="background: rgba(255, 117, 56, 0.2); border: 1px solid var(--color-saffron); color: var(--color-saffron);" onclick="window.applyGasNPSChange(1)">INCREASE NPS ⚡</button>
      </div>`;
    badge('badge-gas-erosion-status', 'EROSION DAMAGE RISK', 'err');
  } else {
    badge('badge-gas-erosion-status', 'SAFE', 'ok');
  }
  
  // Check 7: Negative Pressure
  if (data.P_down < 0) {
    issuesCount++;
    html += `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span>[CRITICAL] Negative Downstream Pressure: P_down < 0 bar G. System is choking or unphysical.</span>
        <button type="button" class="btn btn-sm" style="background: var(--color-danger); color: white;" onclick="window.applyGasNPSChange(1)">URGENT INCREASE ⚡</button>
      </div>`;
  }
  
  // Check 8: Noise
  document.getElementById('gas-banner-noise').style.display = 'none';
  if (data.velocity > 40) {
    issuesCount++;
    html += `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <span>[!] Acoustic Noise Warning: Velocity > 40 m/s typically causes severe aerodynamic noise.</span>
      </div>`;
    document.getElementById('gas-banner-noise').style.display = 'block';
  }
  
  // Regimes
  if (data.reynolds < 2000) badge('badge-gas-regime-status', 'LAMINAR', 'warn');
  else if (data.reynolds < 4000) badge('badge-gas-regime-status', 'TRANSITIONAL', 'warn');
  else badge('badge-gas-regime-status', 'TURBULENT', 'ok');
  
  // Overall Audits
  const repVel = document.getElementById('rep-audit-gas-velocity');
  if(repVel) {
    repVel.innerText = (data.velocity > v_max || data.velocity < v_min) ? 'FAILED' : 'PASS';
    repVel.style.color = (data.velocity > v_max || data.velocity < v_min) ? 'var(--color-danger)' : 'var(--color-teal)';
  }
  const repDP = document.getElementById('rep-audit-gas-dp');
  if(repDP) {
    repDP.innerText = (data.dp_100m > dp_limit_pa) ? 'FAILED' : 'PASS';
    repDP.style.color = (data.dp_100m > dp_limit_pa) ? 'var(--color-danger)' : 'var(--color-teal)';
  }
  const repErosion = document.getElementById('rep-audit-gas-erosion');
  if(repErosion) {
    repErosion.innerText = (data.velocity > data.erosion_v) ? 'FAILED' : 'PASS';
    repErosion.style.color = (data.velocity > data.erosion_v) ? 'var(--color-danger)' : 'var(--color-teal)';
  }
  const repMach = document.getElementById('rep-audit-gas-mach');
  if(repMach) {
    if(data.mach >= 1.0) { repMach.innerText = 'CHOKED (FAIL)'; repMach.style.color = 'var(--color-danger)'; }
    else if(data.mach >= 0.3) { repMach.innerText = 'COMPRESSIBLE (WARN)'; repMach.style.color = 'var(--color-warn)'; }
    else { repMach.innerText = 'INCOMPRESSIBLE (PASS)'; repMach.style.color = 'var(--color-teal)'; }
  }

  // Final rendering
  if (issuesCount === 0) {
    html = `<div style="color: var(--color-teal); font-weight: bold;">✓ All design checks passed successfully. Pipeline is optimally sized.</div>`;
    badge('badge-gas-vel-rec', 'OPTIMAL', 'ok');
    panel.style.display = 'none';
  } else {
    badge('badge-gas-vel-rec', 'SUB-OPTIMAL', 'err');
    panel.style.display = 'block';
  }
  
  content.innerHTML = html;
};

window.applyGasNPSChange = function(direction) {
  const select = document.getElementById('gas-nps');
  if (!select) return;
  const newIndex = select.selectedIndex + direction;
  if (newIndex >= 0 && newIndex < select.options.length) {
    select.selectedIndex = newIndex;
    if (typeof window.updateGasMinorK === 'function') window.updateGasMinorK();
    window.runActualGasCalculations();
  }
};

window.updateGasMinorK = function() {
    const nps = document.getElementById('gas-nps')?.value;
    if (!nps || !window.fittingsData) return;
    
    // Exact mapping logic from Liquid Sizing adapted for Gas if K table is present
    const table = document.getElementById('gas-fittings-table');
    if (!table) return;
    
    const rows = table.querySelectorAll('tbody tr');
    // For simplicity and matching liquid, map the known values based on fitting type string in first TD
    const mappings = {
      "Gate Valve": "gateValve",
      "Globe Valve": "globeValve",
      "Angle Valve": "angleValve",
      "Ball Valve": "ballValve",
      "Plug Valve Straightway": "plugValveStraight",
      "Plug Valve 3-Way Through": "plugValve3Way",
      "Plug Valve Branch Flow": "plugValveBranch",
      "Swing Check Valve": "swingCheck",
      "Lift Check Valve": "liftCheck",
      "Standard Elbow 90°": "elbow90Std",
      "Standard Elbow 45°": "elbow45Std",
      "Long Radius Elbow 90°": "elbow90LR",
      "Tee Through Flow": "teeThrough",
      "Tee Through Branch": "teeBranch",
      "Mitre Bend α=0° Straight": "mitre0",
      "Mitre Bend α=30° Mild": "mitre30",
      "Mitre Bend α=60° Moderate": "mitre60",
      "Mitre Bend α=90° Sharp": "mitre90"
    };

    rows.forEach(row => {
      const name = row.cells[0].innerText.trim();
      const kInput = row.querySelector('.k-val');
      if (kInput && mappings[name]) {
        const fittingKey = mappings[name];
        if (window.fittingsData[nps] && window.fittingsData[nps][fittingKey] !== undefined) {
          kInput.value = window.fittingsData[nps][fittingKey].toFixed(2);
        }
      }
    });
};

window.updateGasFluidProperties = function() {
    const fluid = document.getElementById('gas-fluid')?.value;
    if (fluid === 'User') return; // Do nothing for user
    
    const gasLibrary = {
        "H2": {mw: 2.016, visc: 0.0089, gamma: 1.41},
        "He": {mw: 4.003, visc: 0.0196, gamma: 1.66},
        "CH4": {mw: 16.043, visc: 0.011, gamma: 1.31},
        "C2H4": {mw: 28.054, visc: 0.0094, gamma: 1.24},
        "N2": {mw: 28.013, visc: 0.0176, gamma: 1.4},
        "CO": {mw: 28.01, visc: 0.0174, gamma: 1.4},
        "Air": {mw: 28.97, visc: 0.0181, gamma: 1.4},
        "O2": {mw: 31.999, visc: 0.0202, gamma: 1.4},
        "H2S": {mw: 34.081, visc: 0.0134, gamma: 1.31},
        "NH3": {mw: 17.031, visc: 0.0098, gamma: 1.31},
        "CO2": {mw: 44.01, visc: 0.0148, gamma: 1.29},
        "N2O": {mw: 44.013, visc: 0.0147, gamma: 1.29},
        "C3H8": {mw: 44.097, visc: 0.0083, gamma: 1.13},
        "SO2": {mw: 64.066, visc: 0.0125, gamma: 1.26},
        "C4H10": {mw: 58.124, visc: 0.0078, gamma: 1.1},
        "Cl2": {mw: 70.906, visc: 0.013, gamma: 1.33},
        "C5H12": {mw: 72.151, visc: 0.007, gamma: 1.08},
        "C6H14": {mw: 86.178, visc: 0.0068, gamma: 1.08},
        "C2H6": {mw: 30.07, visc: 0.0092, gamma: 1.19},
        "iC4H10": {mw: 58.12, visc: 0.0079, gamma: 1.1},
        "nC4H10": {mw: 58.12, visc: 0.0078, gamma: 1.1},
        "iC5H12": {mw: 72.15, visc: 0.0071, gamma: 1.08},
        "nC5H12": {mw: 72.15, visc: 0.007, gamma: 1.08}
    };
    
    if (gasLibrary[fluid]) {
        document.getElementById('gas-mw').value = gasLibrary[fluid].mw;
        document.getElementById('gas-viscosity').value = gasLibrary[fluid].visc;
        document.getElementById('gas-gamma').value = gasLibrary[fluid].gamma;
        window.runActualGasCalculations();
    }
};

window.attachGasListeners = function() {
    const gasForm = document.getElementById('line-gas-form');
    if (gasForm) {
        gasForm.addEventListener('input', window.runActualGasCalculations);
        gasForm.addEventListener('change', window.runActualGasCalculations);
    }
    
    const nps = document.getElementById('gas-nps');
    if(nps) nps.addEventListener('change', () => {
        window.updateGasMinorK();
        window.runActualGasCalculations();
    });
    
    const fluid = document.getElementById('gas-fluid');
    if(fluid) fluid.addEventListener('change', window.updateGasFluidProperties);
    
    const material = document.getElementById('gas-material');
    if(material) material.addEventListener('change', function() {
        if(this.value !== 'User') {
            document.getElementById('gas-roughness').value = this.value;
            window.runActualGasCalculations();
        }
    });

    const serviceRadios = document.querySelectorAll('input[name="gas-active-service"]');
    serviceRadios.forEach(radio => {
        radio.addEventListener('change', function() {
            const parentRow = this.closest('tr');
            if (parentRow) {
                const inputs = parentRow.querySelectorAll('input[type="number"]');
                const name = parentRow.cells[1].innerText;
                if (inputs.length >= 3) {
                    const lbl = document.getElementById('lbl-active-gas-service');
                    if(lbl) lbl.innerText = `Active: ${name} | V: ${inputs[0].value}–${inputs[1].value} m/s | ΔP: ${inputs[2].value} bar/100m`;
                }
            }
            window.runActualGasCalculations();
        });
    });
};


  document.addEventListener("DOMContentLoaded", function() {
    if(typeof window.attachGasListeners === "function") window.attachGasListeners();
  });

  window.runActualSteamCalculations = function() {
    try {
      const steamType = document.querySelector('input[name="steam-type"]:checked').value;
      const pressure = getInputValueSI('steam-pressure');
      const tempInput = getInputValueSI('steam-temp');
      const massFlow = getInputValueSI('steam-mass-flow');
      const roughnessMm = getInputValueSI('steam-roughness');
      const idInches = parseFloat(document.getElementById('steam-id').value) || 0;
      const length = getInputValueSI('steam-length');
      const elevation = getInputValueSI('steam-elevation');
      const serviceType = document.getElementById('steam-service').value;
      const otherDp = getInputValueSI('steam-other-dp');
      const npsText = document.getElementById('steam-nps').value;
      const schText = document.getElementById('steam-schedule').value;

      const g = 9.80665;
      
      // Interpolate steam table expects pressure in bar
      const pressure_bar = pressure;
      const T_sat = interpolateSteamTable(pressure_bar, 'temp');
      let rho = 0, specificVolume = 0, mu = 0.012; 
      
      let temp = tempInput;
      if (steamType === 'sat') {
        temp = T_sat;
        rho = interpolateSteamTable(pressure_bar, 'rho_g');
        specificVolume = 1 / rho;
      } else {
        // superheated: simple ideal gas correction
        const rho_sat = interpolateSteamTable(pressure_bar, 'rho_g');
        rho = rho_sat * (T_sat + 273.15) / (temp + 273.15);
        specificVolume = 1 / rho;
      }

      const idM = idInches * 0.0254;
      const area = (Math.PI / 4) * (idM * idM);
      const mass_flow_kgs = massFlow / 3600;
      const volFlow_m3hr = (mass_flow_kgs / rho) * 3600;
      const velocity = mass_flow_kgs / (rho * area);

      const muPaS = mu * 0.001;
      const reynolds = (rho * velocity * idM) / muPaS;

      let regimeText = 'Turbulent';
      let frictionFactor = 0.02;
      if (reynolds <= 2300) {
        regimeText = 'Laminar';
        frictionFactor = 64 / reynolds;
      } else {
        regimeText = reynolds < 4000 ? 'Transition' : 'Turbulent';
        const relRoughness = (roughnessMm * 0.001) / idM;
        frictionFactor = solveColebrook(reynolds, relRoughness);
      }

      const dpPipe = frictionFactor * (length / idM) * (rho * velocity * velocity) / (2 * 1e5);

      let sumK = 0;
      const fittingsRows = document.querySelectorAll('.steam-fittings-table tbody tr');
      fittingsRows.forEach(row => {
        const key = row.getAttribute('data-fitting');
        const kValue = FITTINGS_K[key] || 0;
        const qty = parseFloat(row.querySelector('.table-input').value) || 0;
        sumK += kValue * qty;
      });

      const dpFittings = sumK * (rho * velocity * velocity) / (2 * 1e5);
      const dpElevation = (rho * g * elevation) / 1e5;
      const dpTotal = dpPipe + dpFittings + dpElevation + otherDp;
      const dp100m = frictionFactor * (100 / idM) * (rho * velocity * velocity) / (2 * 1e5);
      const vErosion = (122 / Math.sqrt(rho * 0.062428)) * 0.3048;

      const limits = SERVICE_LIMITS[serviceType] || SERVICE_LIMITS['sat_steam'];
      let velStatus = 'ok', velText = 'OK';
      if (velocity > limits.maxV) { velStatus = 'fail'; velText = 'TOO HIGH'; }
      else if (velocity < limits.minV) { velStatus = 'warn'; velText = 'TOO LOW'; }

      let dpStatus = 'ok', dpText = 'OK';
      if (dp100m > limits.maxDp100) { dpStatus = 'fail'; dpText = 'EXCEEDS LIMIT'; }

      let overallStatus = 'ok';
      if (velStatus === 'fail' || dpStatus === 'fail') overallStatus = 'fail';
      else if (velStatus === 'warn') overallStatus = 'warn';

      setOutputValue('out-steam-density', rho, 'density', 3);
      setOutputValue('out-steam-tsat', T_sat, 'temperature', 1);
      setOutputValue('out-steam-velocity', velocity, 'velocity', 2);
      setOutputValue('out-steam-dp-pipe', dpPipe, 'press-drop', 4);
      setOutputValue('out-steam-dp-fittings', dpFittings, 'press-drop', 4);
      setOutputValue('out-steam-dp-elevation', dpElevation, 'press-drop', 4);
      setOutputValue('out-steam-dp-other', otherDp, 'press-drop', 4);
      setOutputValue('out-steam-dp-total', dpTotal, 'press-drop', 4);
      setOutputValue('out-steam-dp-100m', dp100m, 'press-drop', 3);

      const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setEl('out-steam-sv', specificVolume.toFixed(4));
      setEl('out-steam-reynolds', reynolds.toLocaleString(undefined, {maximumFractionDigits: 0}));
      setEl('out-steam-f', frictionFactor.toFixed(5));
      setEl('out-steam-regime', regimeText.toUpperCase());
      setEl('out-steam-vol-flow', volFlow_m3hr.toFixed(2));

      updateStatusBadge('badge-steam-vel', velText, velStatus);
      updateStatusBadge('badge-steam-dp', dpText, dpStatus);

      updateStatusBadge("steam-results .status-banner", `STEAM LINE COMPLETED // DP = ${formatUnit(dpTotal, 'press-drop', 4).value} ${formatUnit(dpTotal, 'press-drop', 4).symbol} // VELOCITY = ${formatUnit(velocity, 'velocity', 2).value} ${formatUnit(velocity, 'velocity', 2).symbol} // STATUS: ${overallStatus.toUpperCase()}`, overallStatus);

      window.state = window.state || {};
      window.state.line = {
        calculated: true,
        activeType: 'steam',
        inputs: { steamType, pressure, tempInput, massFlow, npsText, schText, idInches, roughnessMm, length, elevation, serviceType, otherDp, sumK },
        results: { rho, mu, T_sat, specificVolume, volFlow_m3hr, velocity, reynolds, regimeText, frictionFactor, dpPipe, dpFittings, dpElevation, dpTotal, dp100m, vErosion, velStatus, velText, dpStatus, dpText, overallStatus, limits, idM, area }
      };

      logConsole(`SYSTEM STATUS: STEAM LINE CALCULATED. DENSITY: ${rho.toFixed(2)} KG/M³. VELOCITY: ${velocity.toFixed(1)} M/S. STATUS: ${overallStatus.toUpperCase()}`, overallStatus === 'fail' ? 'error' : 'success');
    } catch (err) {
      logConsole(`Steam calculation error: ${err.message}`, 'error');
    }
  };

  window.runActualSlurryCalculations = function() {
    try {
      const rho_l = getInputValueSI("slurry-carrier-density");
      const mu_l = getInputValueSI("slurry-carrier-viscosity");
      const rho_s = getInputValueSI("slurry-solid-density");
      const d50 = getInputValueSI("slurry-d50");
      const massFlow = getInputValueSI("slurry-mass-flow");
      const roughnessMm = getInputValueSI("slurry-roughness");
      const idInches = parseFloat(document.getElementById("slurry-id").value) || 0;
      const length = getInputValueSI("slurry-length");
      const elevation = getInputValueSI("slurry-elevation");
      const serviceType = document.getElementById("slurry-service").value;
      const otherDp = getInputValueSI("slurry-other-dp");
      const npsText = document.getElementById("slurry-nps").value;
      const schText = document.getElementById("slurry-schedule").value;
      const wtPercent = parseFloat(document.getElementById("slurry-solid-wt").value) || 15;

      const g = 9.80665;
      const idM = idInches * 0.0254;
      const area = (Math.PI / 4) * (idM * idM);

      const phi = wtPercent / 100;
      const rho_slurry = 1 / (phi / rho_s + (1 - phi) / rho_l);
      const Cv = (phi * rho_slurry) / rho_s;
      const mu_slurry_cP = mu_l * (1 + 2.5 * Cv + 10.05 * Cv * Cv);
      
      const mass_flow_kgs = massFlow / 3600;
      const volFlow_m3hr = (mass_flow_kgs / rho_slurry) * 3600;
      const velocity = mass_flow_kgs / (rho_slurry * area);
      const muPaS = mu_slurry_cP * 0.001;
      const reynolds = (rho_slurry * velocity * idM) / muPaS;

      let regimeText = "Turbulent";
      let frictionFactor = 0.02;
      if (reynolds <= 2300) {
        regimeText = "Laminar";
        frictionFactor = 64 / reynolds;
      } else {
        regimeText = reynolds < 4000 ? "Transition" : "Turbulent";
        const relRoughness = (roughnessMm * 0.001) / idM;
        frictionFactor = solveColebrook(reynolds, relRoughness);
      }

      const dpPipe = frictionFactor * (length / idM) * (rho_slurry * velocity * velocity) / (2 * 1e5);

      let sumK = 0;
      const fittingsRows = document.querySelectorAll(".slurry-fittings-table tbody tr");
      fittingsRows.forEach(row => {
        const key = row.getAttribute("data-fitting");
        const kValue = FITTINGS_K[key] || 0;
        const qty = parseFloat(row.querySelector(".table-input").value) || 0;
        sumK += kValue * qty;
      });

      const dpFittings = sumK * (rho_slurry * velocity * velocity) / (2 * 1e5);
      const dpElevation = (rho_slurry * g * elevation) / 1e5;
      const dpTotal = dpPipe + dpFittings + dpElevation + otherDp;
      const dp100m = frictionFactor * (100 / idM) * (rho_slurry * velocity * velocity) / (2 * 1e5);

      const s = rho_s / rho_l;
      const FL = 1.34; 
      const V_deposit = FL * Math.sqrt(2 * g * idM * (s - 1));

      const limits = SERVICE_LIMITS[serviceType] || SERVICE_LIMITS['slurry'];
      let velStatus = "ok", velText = "OK";
      if (velocity > limits.maxV) { velStatus = "fail"; velText = "TOO HIGH"; }
      else if (velocity < limits.minV) { velStatus = "warn"; velText = "TOO LOW"; }

      let dpStatus = "ok", dpText = "OK";
      if (dp100m > limits.maxDp100) { dpStatus = "fail"; dpText = "EXCEEDS LIMIT"; }

      let depStatus = "ok", depText = "NO RISK";
      if (velocity <= V_deposit) {
        depStatus = "fail";
        depText = "DEPOSITION RISK";
      }

      let overallStatus = "ok";
      if (velStatus === "fail" || dpStatus === "fail" || depStatus === "fail") overallStatus = "fail";
      else if (velStatus === "warn") overallStatus = "warn";

      setOutputValue("out-slurry-density", rho_slurry, "density", 3);
      setOutputValue("out-slurry-viscosity", mu_slurry_cP, "viscosity", 3);
      setOutputValue("out-slurry-vdep", V_deposit, "velocity", 2);
      setOutputValue("out-slurry-velocity", velocity, "velocity", 2);
      setOutputValue("out-slurry-dp-pipe", dpPipe, "press-drop", 4);
      setOutputValue("out-slurry-dp-fittings", dpFittings, "press-drop", 4);
      setOutputValue("out-slurry-dp-elevation", dpElevation, "press-drop", 4);
      setOutputValue("out-slurry-dp-other", otherDp, "press-drop", 4);
      setOutputValue("out-slurry-dp-total", dpTotal, "press-drop", 4);
      setOutputValue("out-slurry-dp-100m", dp100m, "press-drop", 3);

      const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setEl("out-slurry-reynolds", reynolds.toLocaleString(undefined, {maximumFractionDigits:0}));
      setEl("out-slurry-f", frictionFactor.toFixed(5));
      setEl("out-slurry-regime", regimeText.toUpperCase());
      setEl("out-slurry-vol-flow", volFlow_m3hr.toFixed(2));

      updateStatusBadge("badge-slurry-vel", velText, velStatus);
      updateStatusBadge("badge-slurry-dp", dpText, dpStatus);
      updateStatusBadge("badge-slurry-dep", depText, depStatus);

      updateStatusBadge("slurry-results .status-banner", `SLURRY LINE COMPLETED // DP = ${formatUnit(dpTotal, 'press-drop', 4).value} ${formatUnit(dpTotal, 'press-drop', 4).symbol} // V_dep = ${formatUnit(V_deposit, 'velocity', 2).value} // STATUS: ${overallStatus.toUpperCase()}`, overallStatus);

      window.state = window.state || {};
      window.state.line = {
        calculated: true,
        activeType: 'slurry',
        inputs: { rho_l, mu_l, rho_s, d50, massFlow, roughnessMm, npsText, schText, idInches, length, elevation, serviceType, otherDp, wtPercent, sumK },
        results: { rho_slurry, mu_slurry_cP, V_deposit, Cv, velocity, reynolds, regimeText, frictionFactor, dpPipe, dpFittings, dpElevation, dpTotal, dp100m, velStatus, velText, dpStatus, dpText, depStatus, depText, overallStatus, limits, idM, area }
      };

      logConsole(`SYSTEM STATUS: SLURRY LINE CALCULATED. V_actual: ${velocity.toFixed(2)} m/s (V_deposit: ${V_deposit.toFixed(2)} m/s). STATUS: ${overallStatus.toUpperCase()}`, overallStatus === 'fail' ? 'error' : 'success');
    } catch (err) {
      logConsole(`Slurry calculation error: ${err.message}`, 'error');
    }
  };

  window.runActualTwoPhaseCalculations = function() {
    try {
      const rho_l = getInputValueSI("tp-liquid-density");
      const mu_l = getInputValueSI("tp-liquid-viscosity");
      const rho_g = getInputValueSI("tp-gas-density");
      const mu_g = getInputValueSI("tp-gas-viscosity");
      const p_op = getInputValueSI("tp-pressure");
      const temp = getInputValueSI("tp-temp");
      const massFlow = getInputValueSI("tp-mass-flow");
      const roughnessMm = getInputValueSI("tp-roughness");
      const idInches = parseFloat(document.getElementById("tp-id").value) || 0;
      const length = getInputValueSI("tp-length");
      const elevation = getInputValueSI("tp-elevation");
      const serviceType = document.getElementById("tp-service").value;
      const otherDp = getInputValueSI("tp-other-dp");
      const npsText = document.getElementById("tp-nps").value;
      const schText = document.getElementById("tp-schedule").value;
      const quality = parseFloat(document.getElementById("tp-quality").value) || 0.1;
      const orientation = (document.querySelector('input[name="tp-orient"]:checked') || document.querySelector('input[name="tp-orientation"]:checked'))?.value || 'horizontal';

      const g = 9.80665;
      const idM = idInches * 0.0254;
      const area = (Math.PI / 4) * (idM * idM);

      const totalMassFlow = massFlow;
      const m_l = totalMassFlow * (1 - quality);
      const m_g = totalMassFlow * quality;

      const m_l_kgs = m_l / 3600;
      const m_g_kgs = m_g / 3600;

      const VL_superficial = m_l_kgs / (rho_l * area);
      const VG_superficial = m_g_kgs / (rho_g * area);
      const VM = VL_superficial + VG_superficial;

      const dp100m_L = (0.02 * (100 / idM) * (rho_l * VL_superficial * VL_superficial) / (2 * 1e5)) * 1e5;
      const dp100m_G = (0.02 * (100 / idM) * (rho_g * VG_superficial * VG_superficial) / (2 * 1e5)) * 1e5;

      const Xtt = Math.sqrt(dp100m_L / Math.max(dp100m_G, 1e-8));
      const C = 20; 
      const PhiL2 = 1 + C / Xtt + 1 / (Xtt * Xtt);

      const dpTP_per_m = (dp100m_L / 100) * PhiL2;
      const dpPipe_TP = dpTP_per_m * length / 1e5;

      let sumK = 0;
      const fittingsRows = document.querySelectorAll(".tp-fittings-table tbody tr");
      fittingsRows.forEach(row => {
        const key = row.getAttribute("data-fitting");
        const kValue = FITTINGS_K[key] || 0;
        const qty = parseFloat(row.querySelector(".table-input").value) || 0;
        sumK += kValue * qty;
      });

      const dpFittings_TP = sumK * (rho_l * VL_superficial * VL_superficial) * PhiL2 / (2 * 1e5);

      const beta = VG_superficial / Math.max(VM, 1e-8);
      const alpha = beta / (beta + (1 - beta) * Math.pow(rho_g / rho_l, 0.33));
      const rhoM = rho_l * (1 - alpha) + rho_g * alpha;
      const dpElevation = (rhoM * g * elevation) / 1e5;

      const dpTP_total_bar = dpPipe_TP + dpFittings_TP + dpElevation + otherDp;
      const dp100m = (dpTP_per_m * 100) / 1e5;

      let flowPattern = "Annular";
      if (orientation === "horizontal") {
        if (VG_superficial < 1) flowPattern = "Stratified / Plug";
        else if (VG_superficial < 5) flowPattern = "Wavy / Slug";
      } else {
        if (VG_superficial < 2) flowPattern = "Bubbly / Slug";
        else if (VG_superficial < 10) flowPattern = "Churn";
      }

      const limits = SERVICE_LIMITS[serviceType] || SERVICE_LIMITS['two_phase'];
      let velStatus = "ok", velText = "OK";
      if (VM > limits.maxV) { velStatus = "fail"; velText = "TOO HIGH"; }
      else if (VM < limits.minV) { velStatus = "warn"; velText = "TOO LOW"; }

      let dpStatus = "ok", dpText = "OK";
      if (dp100m > limits.maxDp100) { dpStatus = "fail"; dpText = "EXCEEDS LIMIT"; }

      let overallStatus = "ok";
      if (velStatus === "fail" || dpStatus === "fail") overallStatus = "fail";
      else if (velStatus === "warn") overallStatus = "warn";

      setOutputValue("out-tp-vl", VL_superficial, "velocity", 3);
      setOutputValue("out-tp-vg", VG_superficial, "velocity", 3);
      setOutputValue("out-tp-vm", VM, "velocity", 2);
      setOutputValue("out-tp-mix-density", rhoM, "density", 2);
      setOutputValue("out-tp-dp", dpTP_total_bar, "press-drop", 4);
      setOutputValue("out-tp-dp-100m", dp100m, "press-drop", 3);

      const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setEl("out-tp-xtt", Xtt.toFixed(4));
      setEl("out-tp-void", (alpha * 100).toFixed(2));
      setEl("out-tp-pattern", flowPattern.toUpperCase());
      setEl("out-tp-dp-pipe", dpPipe_TP.toFixed(4));
      setEl("out-tp-dp-fittings", dpFittings_TP.toFixed(4));
      setEl("out-tp-dp-elevation", dpElevation.toFixed(4));

      updateStatusBadge("badge-tp-vel", velText, velStatus);
      updateStatusBadge("badge-tp-dp", dpText, dpStatus);

      updateStatusBadge("tp-results .status-banner", `TWO-PHASE LINE COMPLETED // DP = ${formatUnit(dpTP_total_bar, 'press-drop', 4).value} ${formatUnit(dpTP_total_bar, 'press-drop', 4).symbol} // PATTERN = ${flowPattern.toUpperCase()} // STATUS: ${overallStatus.toUpperCase()}`, overallStatus);

      window.state = window.state || {};
      window.state.line = {
        calculated: true,
        activeType: 'two_phase',
        inputs: { rho_l, mu_l, rho_g, mu_g, p_op, temp, totalMassFlow, roughnessMm, npsText, schText, idInches, length, elevation, serviceType, otherDp, quality, orientation, sumK },
        results: { rhoM, alpha, VL_superficial, VG_superficial, VM, Xtt, PhiL2, dpPipe_TP, dpFittings_TP, dpElevation, dpTP_total_bar, dp100m, flowPattern, velStatus, velText, dpStatus, dpText, overallStatus, limits, idM, area, dpTP_per_m }
      };

      logConsole(`SYSTEM STATUS: TWO-PHASE LINE CALCULATED. VM: ${VM.toFixed(2)} m/s. Void fraction: ${(alpha*100).toFixed(1)}%. STATUS: ${overallStatus.toUpperCase()}`, overallStatus === 'fail' ? 'error' : 'success');
    } catch (err) {
      logConsole(`Two-phase calculation error: ${err.message}`, 'error');
    }
  };

  window.calculateSTHE = function() {
    logConsole('INITIALIZING STHE COMPREHENSIVE KERN METHOD...', 'info');

    // Collect Inputs
    const flowTypeInput = document.querySelector('input[name="sthe-flow"]');
    const flowType = flowTypeInput ? flowTypeInput.value : 'counter';

    const layoutSelect = document.getElementById('sthe-layout-select');
    const layout = layoutSelect ? layoutSelect.value : 'triangular';
    
    // Read Shell side mass flow rate and other inputs
    const m_shell = getInputValueSI('sthe-mass-shell');
    const Tin_tube = getInputValueSI('sthe-tin-tube');
    const Tin_shell = getInputValueSI('sthe-tin-shell');
    const Tout_tube = getInputValueSI('sthe-tout-tube');
    const Tout_shell = getInputValueSI('sthe-tout-shell');
    
    const Cp_tube = getInputValueSI('sthe-cp-tube'); // J/kg·K (or CGS)
    const Cp_shell = getInputValueSI('sthe-cp-shell');
    
    // Density & Viscosity
    const rho_tube = getInputValueSI('sthe-rho-tube');
    const rho_shell = getInputValueSI('sthe-rho-shell');
    const mu_tube_cP = getInputValueSI('sthe-mu-tube');
    const mu_shell_cP = getInputValueSI('sthe-mu-shell');
    const muw_tube_cP = getInputValueSI('sthe-muw-tube');
    const muw_shell_cP = getInputValueSI('sthe-muw-shell');

    // Dimensions (read raw mm values, not SI-converted)
    const Do_mm = parseFloat(document.getElementById('sthe-tube-od')?.value || 19);
    const Di_mm = parseFloat(document.getElementById('sthe-tube-id')?.value || 16);
    const L_mm = parseFloat(document.getElementById('sthe-tube-L')?.value || 7315);
    const Pt_ratio = parseFloat(document.getElementById('sthe-pitch-ratio')?.value || 1.25);
    const Np = parseInt(document.getElementById('sthe-tube-passes')?.value || 2);
    const baffleRatio = parseFloat(document.getElementById('sthe-baffle-ratio')?.value || 0.3);
    const baffleCut = parseFloat(document.getElementById('sthe-baffle-cut')?.value || 25);

    // Solid properties
    const kw = getInputValueSI('sthe-kw');
    const Rdi = getInputValueSI('sthe-rdi');
    const Rdo = getInputValueSI('sthe-rdo');
    const U_assumed = getInputValueSI('sthe-u-assumed');

    const v_tube_nozzle = getInputValueSI('sthe-v-tube');
    const v_shell_nozzle = getInputValueSI('sthe-v-shell');

    // Operating pressures
    const P_tube_op = getInputValueSI('sthe-press-tube');
    const P_shell_op = getInputValueSI('sthe-press-shell');

    try {
      // Tube and Shell fluid names
      const tubeSideFluid = document.getElementById('sthe-fluid-tube')?.value || '';
      const shellSideFluid = document.getElementById('sthe-fluid-shell')?.value || '';

      // Cp should be converted to J/kg.K for calculations
      const Cp_tube_J = Cp_tube;
      const Cp_shell_J = Cp_shell;

      // STEP 1 & 2: Smart Calc Mode — solve for selected unknown
      var stheCalcMode = document.getElementById('sthe-calc-mode')?.value || 'auto';
      let Q, m_tube;
      let Tin_tube_v = Tin_tube, Tout_tube_v = Tout_tube, Tin_shell_v = Tin_shell, Tout_shell_v = Tout_shell;
      let m_shell_v = m_shell;

      if (stheCalcMode === 'calc-shell-mass' && Cp_tube_J > 0 && Math.abs(Tout_tube - Tin_tube) > 0.001) {
        let m_tube_in = getInputValueSI('sthe-mass-tube');
        Q = m_tube_in * Cp_tube_J * Math.abs(Tout_tube - Tin_tube);
        m_shell_v = (Cp_shell_J > 0 && Math.abs(Tin_shell - Tout_shell) > 0.001) ? Q / (Cp_shell_J * Math.abs(Tin_shell - Tout_shell)) : 0;
        m_tube = m_tube_in;
        var el = document.getElementById('sthe-mass-shell'); if(el) el.value = formatUnit(m_shell_v, 'mass-flow-s', 4).value;
      } else if (stheCalcMode === 'calc-tout-tube' && m_shell > 0 && Cp_shell_J > 0) {
        Q = m_shell * Cp_shell_J * Math.abs(Tin_shell - Tout_shell);
        let m_tube_in = getInputValueSI('sthe-mass-tube');
        m_tube = m_tube_in > 0 ? m_tube_in : (Cp_tube_J > 0 ? Q / (Cp_tube_J * 20) : 1);
        Tout_tube_v = Tin_tube + Q / (m_tube * Cp_tube_J);
        var el = document.getElementById('sthe-tout-tube'); if(el) el.value = formatUnit(Tout_tube_v, 'temperature', 2).value;
      } else if (stheCalcMode === 'calc-tout-shell' && Cp_tube_J > 0 && Math.abs(Tout_tube - Tin_tube) > 0.001) {
        let m_tube_in = getInputValueSI('sthe-mass-tube');
        Q = m_tube_in * Cp_tube_J * Math.abs(Tout_tube - Tin_tube);
        m_tube = m_tube_in;
        Tout_shell_v = (m_shell > 0 && Cp_shell_J > 0) ? Tin_shell - Q / (m_shell * Cp_shell_J) : Tin_shell;
        var el = document.getElementById('sthe-tout-shell'); if(el) el.value = formatUnit(Tout_shell_v, 'temperature', 2).value;
      } else {
        // Default: calc tube mass flow (auto or calc-tube-mass)
        Q = m_shell * Cp_shell_J * Math.abs(Tin_shell - Tout_shell);
        let dt = Math.abs(Tout_tube - Tin_tube);
        if (dt <= 0.001) throw new Error("Tube side ΔT must be > 0");
        m_tube = Q / (Cp_tube_J * dt);
      }
      const Q_kW = Q / 1000;
      const dT_tube = Math.abs(Tout_tube_v - Tin_tube_v) || Math.abs(Tout_tube - Tin_tube);

      // Write m_tube back to DOM
      const m_tube_formatted = formatUnit(m_tube, "mass-flow-s", 4).value;
      const tubeMassInput = document.getElementById('sthe-mass-tube');
      if (tubeMassInput && (stheCalcMode === 'auto' || stheCalcMode === 'calc-tube-mass')) {
        tubeMassInput.value = m_tube_formatted;
      }
      setOutputValue("sthe-out-mass-tube", m_tube, "mass-flow-s", 4);
      setOutputValue("sthe-out-mass-tube-hr", m_tube * 3600, "mass-flow", 1);

      // STEP 3: LMTD Parallel Flow check
      let dT1, dT2;
      let isParallelImpossible = false;
      const isShellHot = Tin_shell > Tin_tube;

      if (flowType === 'counter') {
        dT1 = isShellHot ? (Tin_shell - Tout_tube) : (Tin_tube - Tout_shell);
        dT2 = isShellHot ? (Tout_shell - Tin_tube) : (Tout_tube - Tin_shell);
      } else {
        // Parallel Flow
        dT1 = isShellHot ? (Tin_shell - Tin_tube) : (Tin_tube - Tin_shell);
        dT2 = isShellHot ? (Tout_shell - Tout_tube) : (Tout_tube - Tout_shell);
        if (dT2 <= 0) {
          isParallelImpossible = true;
        }
      }

      const stheWaterWarning = document.getElementById("sthe-water-warning");
      if (stheWaterWarning) stheWaterWarning.style.display = 'none';

      if (isParallelImpossible) {
        const errorMsg = "Parallel flow thermodynamically impossible for these temps (temperature cross detected).";
        logConsole(errorMsg, "error");
        updateStatusBadge("sthe-results .status-banner", errorMsg, "fail");
        
        // Show error message on the screen
        if (stheWaterWarning) {
          stheWaterWarning.style.display = 'block';
          stheWaterWarning.innerHTML = `<span style="font-weight:bold; color:#ef4444;">⚠ THERMODYNAMIC CROSS:</span> Parallel flow arrangement is impossible because the outlet streams would cross temperatures. Switch to Counter Flow or modify temperatures.`;
        }
        return;
      }

      let LMTD = 0;
      if (Math.abs(dT1 - dT2) < 0.001) {
        LMTD = dT1;
      } else {
        LMTD = (dT1 - dT2) / Math.log(Math.abs(dT1 / dT2) || 1);
      }

      // Parallel flow gets ft = 1.0, counter flow gets TEMA 1-2 factor (approx 0.8)
      const ft = (flowType === 'parallel') ? 1.0 : 0.80;
      const dT_lm = ft * LMTD;

      const R = dT_tube > 0 ? (Math.abs(Tin_shell - Tout_shell) / dT_tube) : 999;
      const P = (Math.max(Tin_shell, Tin_tube) - Math.min(Tin_shell, Tin_tube)) !== 0 
                ? (dT_tube / (Math.abs(Tin_shell - Tin_tube))) : 0;

      // STEP 4: Trial Area & Nt
      const A_trial = Q / (U_assumed * dT_lm);
      // Convert mm to meters
      const Do_m = Do_mm / 1000;
      const Di_m = Di_mm / 1000;
      const L_m = L_mm / 1000;
      const A_per_tube = Math.PI * Do_m * L_m;
      const Nt = Math.max(1, Math.ceil(A_trial / A_per_tube));

      // Write Nt back to hidden field
      var ntEl = document.getElementById('sthe-num-tubes');
      if (ntEl) ntEl.value = Nt;

      // STEP 5: Bundle Diameter Db
      const Pt_m = Pt_ratio * Do_m;
      const KN = {
        triangular:   { 1:[0.319,2.142], 2:[0.249,2.207], 4:[0.175,2.285], 6:[0.0743,2.499], 8:[0.0365,2.675] },
        'rotated-tri':{ 1:[0.319,2.142], 2:[0.249,2.207], 4:[0.175,2.285], 6:[0.0743,2.499], 8:[0.0365,2.675] },
        square:       { 1:[0.215,2.207], 2:[0.156,2.291], 4:[0.158,2.263], 6:[0.0402,2.617], 8:[0.0331,2.643] },
        'rotated-sq': { 1:[0.215,2.207], 2:[0.156,2.291], 4:[0.158,2.263], 6:[0.0402,2.617], 8:[0.0331,2.643] }
      };

      let k_val = 0.319, n_val = 2.142;
      var knLayout = layout.includes('tri') ? 'triangular' : 'square';
      if (KN[knLayout] && KN[knLayout][Np]) {
        k_val = KN[knLayout][Np][0];
        n_val = KN[knLayout][Np][1];
      }
      const Db_m = Do_m * Math.pow(Nt / k_val, 1/n_val);
      const Db_mm = Db_m * 1000;

      // Shell diameter from bundle + clearance
      const rearHead = document.getElementById('sthe-rear-head')?.value || 'fixed';
      const clearMap = { 'fixed':12, 'outside-packed':18, 'split-ring':50, 'pull-through':92, 'u-tube':14 };
      const Ds_m = Db_m + (clearMap[rearHead] || 12) / 1000;
      const Ds_mm_orig = Ds_m * 1000;
      const Ds_mm = Ds_m;  // alias for legacy code (in meters despite name)
      const B_mm = B_m;    // alias for legacy code (in meters despite name)

      // Write Ds and baffle spacing back to DOM
      var dsEl = document.getElementById('sthe-shell-id');
      if (dsEl) dsEl.value = Ds_mm_orig.toFixed(0);
      const B_m = baffleRatio * Ds_m;
      var bsEl = document.getElementById('sthe-baffle-space');
      if (bsEl) bsEl.value = (B_m * 1000).toFixed(0);

      // STEP 6: Velocities
      const A_flow_tube = (Math.PI/4) * Di_m * Di_m * (Nt / Np);
      const v_tube_actual = (rho_tube > 0 && A_flow_tube > 0) ? m_tube / (rho_tube * A_flow_tube) : 0;

      const C_prime = Pt_m - Do_m;
      const A_flow_shell = (Ds_m > 0 && Pt_m > 0 && B_m > 0) ? (Ds_m * C_prime * B_m) / Pt_m : 0.001;
      const v_shell_actual = (rho_shell > 0 && A_flow_shell > 0) ? m_shell / (rho_shell * A_flow_shell) : 0;

      // STEP 7: Tube Side HTC & Special Water Correlation
      const mu_tube = mu_tube_cP / 1000;
      const Gt = m_tube / A_flow_tube;
      const Re_tube = Gt * Di_m / mu_tube;
      const Pr_tube = (Cp_tube_J * mu_tube) / getInputValueSI('sthe-k-tube');

      let hi = 0;
      const noteHiEl = document.getElementById("sthe-note-hi");
      if (noteHiEl) noteHiEl.style.display = "none";

      if (tubeSideFluid.toLowerCase().includes("water")) {
        // Kern water correlation
        const T_avg_tube = (Tin_tube + Tout_tube) / 2;
        const Di_mm_val = Di_m * 1000;
        hi = 4200 * (1.35 + 0.02 * T_avg_tube) * Math.pow(v_tube_actual, 0.8) / Math.pow(Di_mm_val, 0.2);
        if (noteHiEl) {
          noteHiEl.style.display = "block";
          noteHiEl.textContent = "✓ Special Kern water correlation applied";
        }
      } else {
        const Nu_tube = 0.023 * Math.pow(Re_tube, 0.8) * Math.pow(Pr_tube, 0.33) * Math.pow(mu_tube_cP / muw_tube_cP, 0.14);
        hi = Nu_tube * getInputValueSI('sthe-k-tube') / Di_m;
      }
      const hio = hi * (Di_m / Do_m);

      // STEP 8: Shell Side HTC & Special Water Correlation
      let De = 0;
      if (layout === 'triangular') {
        De = (4 * (Math.sqrt(3)/4 * Pt_m * Pt_m - Math.PI/8 * Do_m * Do_m)) / (Math.PI/2 * Do_m);
      } else {
        De = (4 * (Pt_m * Pt_m - Math.PI/4 * Do_m * Do_m)) / (Math.PI * Do_m);
      }

      const mu_shell = mu_shell_cP / 1000;
      const Gs = m_shell / A_flow_shell;
      const Re_shell = Gs * De / mu_shell;
      const Pr_shell = (Cp_shell_J * mu_shell) / getInputValueSI('sthe-k-shell');

      let ho = 0;
      const noteHoEl = document.getElementById("sthe-note-ho");
      if (noteHoEl) noteHoEl.style.display = "none";

      if (shellSideFluid.toLowerCase().includes("water")) {
        const T_avg_shell = (Tin_shell + Tout_shell) / 2;
        const De_mm_val = De * 1000;
        ho = 4200 * (1.35 + 0.02 * T_avg_shell) * Math.pow(v_shell_actual, 0.8) / Math.pow(De_mm_val, 0.2);
        if (noteHoEl) {
          noteHoEl.style.display = "block";
          noteHoEl.textContent = "✓ Special Kern water correlation applied";
        }
      } else {
        const Nu_shell = 0.36 * Math.pow(Re_shell, 0.55) * Math.pow(Pr_shell, 0.33) * Math.pow(mu_shell_cP / muw_shell_cP, 0.14);
        ho = Nu_shell * getInputValueSI('sthe-k-shell') / De;
      }

      // STEP 9: Overall U and Areas
      const Rw = (Do_m/2) * Math.log(Do_m/Di_m) / kw;
      const U_calc = 1 / (1/hio + Rdi + Rw + Rdo + 1/ho);

      const Ar = Q / (U_calc * dT_lm);
      const Aa = Nt * Math.PI * Do_m * L_m;
      const excess_pct = ((Aa - Ar) / Ar) * 100;

      // STEP 10: Pressure drops
      const f_tube = Math.exp(0.576 - 0.19 * Math.log(Math.max(Re_tube, 1)));
      const dp_tube_Pa = f_tube * (L_m / Di_m) * (rho_tube * v_tube_actual * v_tube_actual / 2) * Np;
      const dp_tube_kPa = dp_tube_Pa / 1000;
      const dp_tube_kgcm2 = dp_tube_Pa / 98066.5;

      const B_m_val = B_m;
      const Nb = Math.floor(L_m / B_m_val) - 1;
      const f_shell = Math.exp(0.576 - 0.19 * Math.log(Math.max(Re_shell, 1)));
      const dp_shell_Pa = f_shell * Gs * Gs * Ds_m * (Nb + 1) / (2 * rho_shell * De);
      const dp_shell_kPa = dp_shell_Pa / 1000;
      const dp_shell_kgcm2 = dp_shell_Pa / 98066.5;

      // STEP 11: Nozzles
      const Qv_tube = m_tube / rho_tube;
      const A_nozzle_tube = Qv_tube / v_tube_nozzle;
      const D_nozzle_tube_mm = Math.sqrt(4 * A_nozzle_tube / Math.PI) * 1000;

      const Qv_shell = m_shell / rho_shell;
      const A_nozzle_shell = Qv_shell / v_shell_nozzle;
      const D_nozzle_shell_mm = Math.sqrt(4 * A_nozzle_shell / Math.PI) * 1000;

      // --- UPDATE DOM ---
      setOutputValue('sthe-out-Q', Q_kW, 'heat-duty', 2);
      
      const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      setEl('sthe-out-lmtd', formatUnit(LMTD, 'temp-diff', 2).value);
      setEl('sthe-out-ft', ft.toFixed(2));
      setEl('sthe-out-dtlm', formatUnit(dT_lm, 'temp-diff', 2).value);
      setEl('sthe-out-R', R.toFixed(3));
      setEl('sthe-out-P', P.toFixed(3));

      setEl('sthe-out-Nt', Nt);
      setOutputValue('sthe-out-Db', Db_mm, 'length-mm', 1);
      setOutputValue('sthe-out-Ds', Ds_mm_orig, 'length-mm', 1);
      setOutputValue('sthe-out-Ar', Ar, 'area', 2);
      setOutputValue('sthe-out-Aa', Aa, 'area', 2);
      
      // Nusselt numbers
      setEl('sthe-out-Nu-tube', Re_tube > 0 ? Re_tube.toFixed(0) : '-'); // Wait, let's write exact Nu_tube!
      // Recalculate Nu_tube/Nu_shell for exact displays
      let Nu_tube_val, Nu_shell_val;
      if (tubeSideFluid.toLowerCase().includes("water")) {
        Nu_tube_val = hi * Di_m / getInputValueSI('sthe-k-tube');
      } else {
        Nu_tube_val = 0.023 * Math.pow(Re_tube, 0.8) * Math.pow(Pr_tube, 0.33) * Math.pow(mu_tube_cP / muw_tube_cP, 0.14);
      }
      if (shellSideFluid.toLowerCase().includes("water")) {
        Nu_shell_val = ho * De / getInputValueSI('sthe-k-shell');
      } else {
        Nu_shell_val = 0.36 * Math.pow(Re_shell, 0.55) * Math.pow(Pr_shell, 0.33) * Math.pow(mu_shell_cP / muw_shell_cP, 0.14);
      }
      setEl('sthe-out-Nu-tube', Nu_tube_val.toFixed(1));
      setEl('sthe-out-Nu-shell', Nu_shell_val.toFixed(1));

      setEl('sthe-out-excess', excess_pct.toFixed(1));
      
      const badgeExcess = document.getElementById('sthe-badge-excess');
      if (badgeExcess) {
        badgeExcess.style.display = 'inline-block';
        badgeExcess.className = 'banner-badge'; 
        let excessStatus = '';
        if (excess_pct >= 10 && excess_pct <= 40) {
          badgeExcess.innerText = "ACCEPTABLE";
          badgeExcess.classList.add('badge-teal');
          excessStatus = 'ACCEPTABLE';
        } else if (excess_pct > 40) {
          badgeExcess.innerText = "OVERSIZED";
          badgeExcess.classList.add('badge-amber');
          excessStatus = 'OVERSIZED';
        } else {
          badgeExcess.innerText = "UNDERSIZED";
          badgeExcess.classList.add('badge-red');
          excessStatus = 'UNDERSIZED';
        }
      }

      setEl('sthe-out-Retube', Re_tube.toFixed(0));
      setEl('sthe-out-Prtube', Pr_tube.toFixed(2));
      setOutputValue('sthe-out-hi', hi, 'htc', 1);
      setOutputValue('sthe-out-hio', hio, 'htc', 1);
      setEl('sthe-out-Reshell', Re_shell.toFixed(0));
      setEl('sthe-out-Prshell', Pr_shell.toFixed(2));
      setOutputValue('sthe-out-ho', ho, 'htc', 1);
      setEl('sthe-out-Rw', Rw.toExponential(3));
      setOutputValue('sthe-out-Ucalc', U_calc, 'htc', 1);
      
      const badgeU = document.getElementById('sthe-badge-U');
      if (badgeU) {
        badgeU.style.display = 'inline-block';
        badgeU.className = 'banner-badge';
        const uDiff = Math.abs(U_calc - U_assumed) / U_assumed * 100;
        if (uDiff < 15) {
          badgeU.innerText = "CONVERGED";
          badgeU.classList.add('badge-teal');
        } else {
          badgeU.innerText = "RE-ITERATE";
          badgeU.classList.add('badge-amber');
        }
      }

      setOutputValue('sthe-out-dp-tube', dp_tube_kPa, 'press-drop-kpa', 2);
      setOutputValue('sthe-out-dp-shell', dp_shell_kPa, 'press-drop-kpa', 2);
      setEl('sthe-out-Nb', Nb);

      setOutputValue('sthe-out-v-tube-calc', v_tube_actual, 'velocity', 2);
      setOutputValue('sthe-out-v-shell-calc', v_shell_actual, 'velocity', 2);

      // Velocity Warnings
      const isTubeGas = rho_tube < 100 || tubeSideFluid.toLowerCase().includes("vapor") || tubeSideFluid.toLowerCase().includes("steam") || tubeSideFluid.toLowerCase().includes("gas");
      const isShellGas = rho_shell < 100 || shellSideFluid.toLowerCase().includes("vapor") || shellSideFluid.toLowerCase().includes("steam") || shellSideFluid.toLowerCase().includes("gas");
      
      const minVT = isTubeGas ? 15.0 : 1.0;
      const maxVT = isTubeGas ? 30.0 : 2.5;
      const minVS = isShellGas ? 10.0 : 0.3;
      const maxVS = isShellGas ? 20.0 : 1.0;

      const warnTubeEl = document.getElementById("sthe-warn-v-tube");
      if (warnTubeEl) {
        warnTubeEl.style.display = "none";
        if (v_tube_actual < minVT) {
          warnTubeEl.style.display = "inline-block";
          warnTubeEl.textContent = "⚠ LOW VELOCITY: FOULING RISK";
          warnTubeEl.style.borderColor = "var(--border-warn)";
          warnTubeEl.style.color = "var(--color-warn)";
        } else if (v_tube_actual > maxVT) {
          warnTubeEl.style.display = "inline-block";
          warnTubeEl.textContent = "⚠ HIGH VELOCITY: EROSION RISK";
          warnTubeEl.style.borderColor = "var(--border-fail)";
          warnTubeEl.style.color = "var(--color-fail)";
        }
      }

      const warnShellEl = document.getElementById("sthe-warn-v-shell");
      if (warnShellEl) {
        warnShellEl.style.display = "none";
        if (v_shell_actual < minVS) {
          warnShellEl.style.display = "inline-block";
          warnShellEl.textContent = "⚠ LOW VELOCITY: FOULING RISK";
          warnShellEl.style.borderColor = "var(--border-warn)";
          warnShellEl.style.color = "var(--color-warn)";
        } else if (v_shell_actual > maxVS) {
          warnShellEl.style.display = "inline-block";
          warnShellEl.textContent = "⚠ HIGH VELOCITY: EROSION RISK";
          warnShellEl.style.borderColor = "var(--border-fail)";
          warnShellEl.style.color = "var(--color-fail)";
        }
      }

      setOutputValue('sthe-out-noz-ti', D_nozzle_tube_mm, 'length-mm', 1);
      setOutputValue('sthe-out-noz-to', D_nozzle_tube_mm, 'length-mm', 1);
      setOutputValue('sthe-out-noz-si', D_nozzle_shell_mm, 'length-mm', 1);
      setOutputValue('sthe-out-noz-so', D_nozzle_shell_mm, 'length-mm', 1);

      // Recommendations
      const recList = document.getElementById('sthe-rec-list');
      if (recList) {
        recList.innerHTML = '';
        const addFlag = (msg, colorType) => {
          const row = document.createElement('div');
          row.className = `check-item`;
          let colorHex = colorType === 'AMBER' ? '#f59e0b' : '#ef4444';
          let bgHex = colorType === 'AMBER' ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';
          row.style.borderLeft = `3px solid ${colorHex}`;
          row.style.backgroundColor = bgHex;
          row.innerHTML = `<div class="check-info"><span class="check-name" style="color:${colorHex}">${colorType} FLAG</span><span class="check-details" style="font-size:10px;">${msg}</span></div>`;
          recList.appendChild(row);
        };

        if (Re_tube < 10000) addFlag("Tube Re < 10,000 — increase passes or velocity", "AMBER");
        if (excess_pct > 40) addFlag("Oversized >40% — reduce Nt or tube length", "AMBER");
        if (excess_pct < 10) addFlag("Area insufficient — increase shell or tube count", "RED");
        if (dp_tube_kPa > 35) addFlag("Tube ΔP > 35 kPa — reduce tube passes", "RED");
        if (dp_shell_kPa > 35) addFlag("Shell ΔP > 35 kPa — increase baffle spacing", "RED");
        
        // Floating head recommendation for pressure > 10 bar
        const maxPres = Math.max(P_tube_op, P_shell_op);
        const tMax = Math.max(Tin_tube, Tout_tube, Tin_shell, Tout_shell);
        const isDirty = shellSideFluid.toLowerCase().includes('dirty') || shellSideFluid.toLowerCase().includes('toxic');
        let stheType = '';
        if (maxPres > 10) {
          stheType = "Internal Floating Head (High Pressure)";
        } else if (tMax < 90) {
          stheType = "Fixed Tube Sheet";
        } else if (tMax >= 90 && !isDirty) {
          stheType = "U-Tube";
        } else if (tMax >= 90 && isDirty) {
          stheType = "Internal Floating Head";
        }
        
        const typeRow = document.createElement('div');
        typeRow.className = `check-item`;
        typeRow.style.borderLeft = `3px solid var(--color-saffron)`;
        typeRow.style.backgroundColor = `rgba(255, 117, 56, 0.05)`;
        typeRow.innerHTML = `<div class="check-info"><span class="check-name" style="color:var(--color-saffron)">TYPE RECOMMENDED</span><span class="check-details" style="font-size:11px;">${stheType}</span></div>`;
        recList.appendChild(typeRow);
        
        window.state = window.state || {};
        window.state.sthe = {
          calculated: true,
          Q: Q_kW,
          U: U_calc,
          Nt,
          excessArea: excess_pct,
          status: excess_pct >= 10 && excess_pct <= 40 ? 'ACCEPTABLE' : (excess_pct > 40 ? 'OVERSIZED' : 'UNDERSIZED'),
          D_tube: D_nozzle_tube_mm,
          D_shell: D_nozzle_shell_mm,
          stheType,
          inputs: { tubeSideFluid, shellSideFluid, flowArrangement: flowType, Np, m_shell, Tin_tube, Tin_shell, Tout_tube, Tout_shell, Cp_tube, Cp_shell },
          results: { Q_kW, dT_lm, U_calc, Nt, Ds_used_mm: Ds_mm_orig, Db_mm, Aa, Ar, excessArea: excess_pct, dp_tube_kPa, dp_shell_kPa, D_nozzle_tube_in: D_nozzle_tube_mm, D_nozzle_tube_out: D_nozzle_tube_mm, D_nozzle_shell_in: D_nozzle_shell_mm, D_nozzle_shell_out: D_nozzle_shell_mm, stheType, areaStatus: excess_pct >= 10 && excess_pct <= 40 ? 'ACCEPTABLE' : (excess_pct > 40 ? 'OVERSIZED' : 'UNDERSIZED') }
        };
      }

      // Cooling Water exit temperature warning
      if (tubeSideFluid.toLowerCase().includes("water") && Tout_tube > 40) {
        if (stheWaterWarning) {
          const m_suggested = Q / (Cp_tube_J * (40 - Tin_tube));
          const m_suggested_formatted = formatUnit(m_suggested, "mass-flow-s", 2).value;
          const massFlowSymbol = formatUnit(m_suggested, "mass-flow-s", 2).symbol;
          stheWaterWarning.style.display = 'block';
          stheWaterWarning.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px; color:#ef4444;">⚠ COOLING WATER EXIT TEMP EXCEEDS 40°C</div>
            <div>Actual outlet temperature: <strong>${Tout_tube.toFixed(1)}°C</strong>. Outlet temperatures above 40°C increase the risk of severe calcium carbonate scaling/fouling.</div>
            <div style="margin-top: 8px;"><strong>Recommendation:</strong> Increase cooling water mass flow rate to <strong>${m_suggested_formatted} ${massFlowSymbol}</strong> to maintain outlet temperature at 40°C.</div>
          `;
        }
      }

      // Design Tuning Assistant Panel
      const stheTuningPanel = document.getElementById("sthe-tuning-panel");
      if (stheTuningPanel) {
        stheTuningPanel.style.display = 'none';
        if (excess_pct < 10 || excess_pct > 40) {
          stheTuningPanel.style.display = 'block';
          let suggestionsHTML = `
            <div style="font-weight: bold; text-transform: uppercase; margin-bottom: 8px; color: var(--color-saffron);">Design Tuning Assistant</div>
            <div style="font-size: 11px; margin-bottom: 10px; color: var(--text-muted);">
              The calculated excess area (${excess_pct.toFixed(1)}%) is outside the recommended 10% - 40% range. Review the suggestions below to optimize the design:
            </div>
            <table class="terminal-table" style="width: 100%; font-size: 10px;">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Current</th>
                  <th>Suggested Adjustment</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
          `;
          
          let lengthSuggestion = '';
          let targetLength = L_mm * 1000;
          if (excess_pct > 40 && L_mm > 4.88) {
            targetLength = L_mm > 6.0 ? 6000 : 4880;
            lengthSuggestion = `Reduce to ${targetLength} mm`;
          } else if (excess_pct < 10 && L_mm < 7.27) {
            targetLength = 7270;
            lengthSuggestion = `Increase to 7270 mm`;
          }
          
          if (lengthSuggestion) {
            suggestionsHTML += `
              <tr>
                <td>Tube Length</td>
                <td>${(L_mm*1000).toFixed(0)} mm</td>
                <td style="color: var(--color-saffron);">${lengthSuggestion}</td>
                <td><button type="button" class="btn btn-secondary" style="padding: 2px 6px; font-size: 9px;" onclick="tuneStheInput('sthe-tube-L', ${targetLength})">APPLY</button></td>
              </tr>
            `;
          }
          
          const stdShellSizes = [152, 203, 254, 305, 337, 387, 438, 489, 540, 591, 641, 692, 743, 794, 845, 895, 946, 997, 1048, 1100, 1150, 1200, 1250, 1300];
          let shellSuggestion = '';
          let targetShell = Ds_mm * 1000;
          if (excess_pct > 40) {
            const smallerSizes = stdShellSizes.filter(s => s < Ds_mm * 1000);
            if (smallerSizes.length > 0) {
              targetShell = smallerSizes[smallerSizes.length - 1];
              shellSuggestion = `Reduce to ${targetShell} mm`;
            }
          } else if (excess_pct < 10) {
            const largerSizes = stdShellSizes.filter(s => s > Ds_mm * 1000);
            if (largerSizes.length > 0) {
              targetShell = largerSizes[0];
              shellSuggestion = `Increase to ${targetShell} mm`;
            }
          }
          
          if (shellSuggestion) {
            suggestionsHTML += `
              <tr>
                <td>Shell Diameter</td>
                <td>${(Ds_mm*1000).toFixed(0)} mm</td>
                <td style="color: var(--color-saffron);">${shellSuggestion}</td>
                <td><button type="button" class="btn btn-secondary" style="padding: 2px 6px; font-size: 9px;" onclick="tuneStheInput('sthe-shell-id', ${targetShell})">APPLY</button></td>
              </tr>
            `;
          }

          let odSuggestion = '';
          let targetOD = Do_mm * 1000;
          let targetID = Di_mm * 1000;
          if (excess_pct > 40 && Do_mm * 1000 === 19) {
            odSuggestion = 'Increase to 25 mm';
            targetOD = 25; targetID = 21;
          } else if (excess_pct < 10 && Do_mm * 1000 === 19) {
            odSuggestion = 'Reduce to 12.7 mm';
            targetOD = 12.7; targetID = 10.2;
          }
          if (odSuggestion) {
            suggestionsHTML += `
              <tr>
                <td>Tube OD</td>
                <td>${(Do_mm*1000).toFixed(1)} mm</td>
                <td style="color: var(--color-saffron);">${odSuggestion}</td>
                <td><button type="button" class="btn btn-secondary" style="padding: 2px 6px; font-size: 9px;" onclick="tuneStheTubeOD(${targetOD}, ${targetID})">APPLY</button></td>
              </tr>
            `;
          }

          let passSuggestion = '';
          let targetNp = Np;
          if (Re_tube < 10000 && Np < 8) {
            const passesList = [1, 2, 4, 6, 8];
            const idx = passesList.indexOf(Np);
            if (idx !== -1 && idx < passesList.length - 1) {
              targetNp = passesList[idx + 1];
              passSuggestion = `Increase passes to ${targetNp}`;
            }
          } else if (dp_tube_kPa > 35 && Np > 1) {
            const passesList = [1, 2, 4, 6, 8];
            const idx = passesList.indexOf(Np);
            if (idx !== -1 && idx > 0) {
              targetNp = passesList[idx - 1];
              passSuggestion = `Reduce passes to ${targetNp}`;
            }
          }
          if (passSuggestion) {
            suggestionsHTML += `
              <tr>
                <td>Tube Passes</td>
                <td>${Np}</td>
                <td style="color: var(--color-saffron);">${passSuggestion}</td>
                <td><button type="button" class="btn btn-secondary" style="padding: 2px 6px; font-size: 9px;" onclick="tuneStheInput('sthe-tube-passes', ${targetNp})">APPLY</button></td>
              </tr>
            `;
          }

          let baffleSuggestion = '';
          let targetBVal = B_mm * 1000;
          if (dp_shell_kPa > 35) {
            targetBVal = Math.min(0.5 * Ds_mm * 1000, B_mm * 1300);
            baffleSuggestion = `Increase to ${targetBVal.toFixed(0)} mm`;
          } else if (Re_shell < 200) {
            targetBVal = Math.max(0.2 * Ds_mm * 1000, B_mm * 800);
            baffleSuggestion = `Reduce to ${targetBVal.toFixed(0)} mm`;
          }
          if (baffleSuggestion) {
            suggestionsHTML += `
              <tr>
                <td>Baffle Spacing</td>
                <td>${(B_mm*1000).toFixed(0)} mm</td>
                <td style="color: var(--color-saffron);">${baffleSuggestion}</td>
                <td><button type="button" class="btn btn-secondary" style="padding: 2px 6px; font-size: 9px;" onclick="tuneStheInput('sthe-baffle-space', ${targetBVal.toFixed(0)})">APPLY</button></td>
              </tr>
            `;
          }
          
          suggestionsHTML += `
              </tbody>
            </table>
          `;
          stheTuningPanel.innerHTML = suggestionsHTML;
        }
      }

      // Design Sequence Guide
      const stheSequenceGuide = document.getElementById("sthe-sequence-guide-body");
      if (stheSequenceGuide) {
        let step1Class = (Tin_tube > 0 && Tin_shell > 0 && Tout_tube > 0 && Tout_shell > 0) ? 'status-ok' : 'status-pending';
        let step2Class = (U_assumed > 0) ? 'status-ok' : 'status-pending';
        let step3Class = (Nt > 0) ? 'status-ok' : 'status-pending';
        let step4Class = (dp_tube_kPa <= 35 && dp_shell_kPa <= 35) ? 'status-ok' : (dp_tube_kPa > 35 || dp_shell_kPa > 35 ? 'status-fail' : 'status-pending');
        
        const getDotStyle = (cls) => {
          if (cls === 'status-ok') return 'background:#00c4a0; box-shadow:0 0 6px #00c4a0;';
          if (cls === 'status-fail') return 'background:#ef4444; box-shadow:0 0 6px #ef4444;';
          return 'background:#475569;';
        };

        stheSequenceGuide.innerHTML = `
          <div style="display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="step-dot" style="width: 8px; height: 8px; border-radius: 50%; display: inline-block; ${getDotStyle(step1Class)}"></span>
              <span>STAGE 1: FLUID INLET TEMPS & FLOW SYSTEM [${step1Class === 'status-ok' ? 'COMPLETED' : 'PENDING'}]</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="step-dot" style="width: 8px; height: 8px; border-radius: 50%; display: inline-block; ${getDotStyle(step2Class)}"></span>
              <span>STAGE 2: THERMAL TRIAL U SELECTION [${step2Class === 'status-ok' ? 'COMPLETED' : 'PENDING'}]</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="step-dot" style="width: 8px; height: 8px; border-radius: 50%; display: inline-block; ${getDotStyle(step3Class)}"></span>
              <span>STAGE 3: TUBE COUNT & GEOMETRIC LAYOUT [${step3Class === 'status-ok' ? 'COMPLETED' : 'PENDING'}]</span>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="step-dot" style="width: 8px; height: 8px; border-radius: 50%; display: inline-block; ${getDotStyle(step4Class)}"></span>
              <span>STAGE 4: HYDRAULIC VELOCITIES & PRESSURE DROPS [${step4Class === 'status-ok' ? 'PASS' : (step4Class === 'status-fail' ? 'WARN/FAIL' : 'PENDING')}]</span>
            </div>
          </div>
        `;
      }

      // Update Status Bar
      const areaStatus = excess_pct >= 10 && excess_pct <= 40 ? 'ACCEPTABLE' : (excess_pct > 40 ? 'OVERSIZED' : 'UNDERSIZED');
      const statusMsg = `STHE CALCULATED // METHOD: KERN // U = ${U_calc.toFixed(1)} W/m²·K // EXCESS AREA = ${excess_pct.toFixed(1)}% // Nt = ${Nt} // Ds = ${(Ds_m * 1000).toFixed(0)} mm // STATUS: ${areaStatus}`;
      const statusType = areaStatus === 'ACCEPTABLE' ? 'success' : (areaStatus === 'OVERSIZED' ? 'warn' : 'error');
      
      const statusEl = document.querySelector('.terminal-logs');
      if (statusEl) {
        statusEl.innerHTML = `<div class="logs-header"><span class="logs-title">STHE ENGINE</span> <span class="logs-status-val" style="color:${areaStatus==='ACCEPTABLE'?'#00b875':(areaStatus==='OVERSIZED'?'#f59e0b':'#ef4444')}">${statusMsg}</span></div>`;
      }
      logConsole(statusMsg, statusType);

      // ── Flow Analysis: Counter-Current vs Concurrent ──
      var dT1_fc = isShellHot ? (Tin_shell - Tout_tube) : (Tin_tube - Tout_shell);
      var dT2_fc = isShellHot ? (Tout_shell - Tin_tube) : (Tout_tube - Tin_shell);
      var LMTD_fc = (Math.abs(dT1_fc - dT2_fc) < 0.001) ? dT1_fc : ((dT1_fc - dT2_fc) / Math.log(Math.abs(dT1_fc / dT2_fc) || 1));
      var dT1_fp = isShellHot ? (Tin_shell - Tin_tube) : (Tin_tube - Tin_shell);
      var dT2_fp = isShellHot ? (Tout_shell - Tout_tube) : (Tout_tube - Tout_shell);
      var LMTD_fp = (dT2_fp <= 0) ? LMTD_fc * 0.8 : ((Math.abs(dT1_fp - dT2_fp) < 0.001) ? dT1_fp : ((dT1_fp - dT2_fp) / Math.log(Math.abs(dT1_fp / dT2_fp) || 1)));
      var Cmin_fa = Math.min(m_shell * Cp_shell_J, m_tube * Cp_tube_J);
      var eff_fa = (Cmin_fa > 0 && Math.abs(Tin_shell - Tin_tube) > 0) ? Q / (Cmin_fa * Math.abs(Tin_shell - Tin_tube)) : 0;
      var eff_fp = eff_fa * (LMTD_fp > 0 ? LMTD_fp / (LMTD_fc || 1) : 0.8);
      window.stheFlowAnalysis = {
        counterCurrent: { LMTD: LMTD_fc, effectiveness: Math.min(eff_fa, 1) },
        concurrent: { LMTD: LMTD_fp, effectiveness: Math.min(eff_fp, 1) }
      };

      // Trigger Comparison Table update
      const summaryBody = document.getElementById('sthe-summary-tbody');
      if (summaryBody) {
        // Counter LMTD
        let dT1_c = isShellHot ? (Tin_shell - Tout_tube) : (Tin_tube - Tout_shell);
        let dT2_c = isShellHot ? (Tout_shell - Tin_tube) : (Tout_tube - Tin_shell);
        let LMTD_c = (Math.abs(dT1_c - dT2_c) < 0.001) ? dT1_c : ((dT1_c - dT2_c) / Math.log(Math.abs(dT1_c / dT2_c) || 1));
        let dTLM_c = 0.8 * LMTD_c;
        let Ar_c = Q / (U_calc * dTLM_c);
        let excess_c = ((Aa - Ar_c) / Ar_c) * 100;

        // Parallel LMTD
        let dT1_p = isShellHot ? (Tin_shell - Tin_tube) : (Tin_tube - Tin_shell);
        let dT2_p = isShellHot ? (Tout_shell - Tout_tube) : (Tout_tube - Tout_shell);
        let LMTD_p = (dT2_p <= 0) ? LMTD_c : ((Math.abs(dT1_p - dT2_p) < 0.001) ? dT1_p : ((dT1_p - dT2_p) / Math.log(Math.abs(dT1_p / dT2_p) || 1)));
        let dTLM_p = 1.0 * LMTD_p; // ft = 1.0 for parallel
        let Ar_p = Q / (U_calc * dTLM_p);
        let excess_p = ((Aa - Ar_p) / Ar_p) * 100;

        // Store flow analysis for comparison panel
        var Cmin_sthe = Math.min(m_shell * Cp_shell_J, m_tube * Cp_tube_J);
        var eff_counter = (Cmin_sthe > 0 && (Tin_shell - Tin_tube) > 0) ? Q / (Cmin_sthe * Math.abs(Tin_shell - Tin_tube)) : 0;
        var eff_parallel = eff_counter * (LMTD_p > 0 ? LMTD_p / (LMTD_c || 1) : 0.8);
        window.stheFlowAnalysis = {
          counterCurrent: { LMTD: LMTD_c, effectiveness: Math.min(eff_counter, 1) },
          concurrent: { LMTD: LMTD_p, effectiveness: Math.min(eff_parallel, 1) }
        };

        const rows = [
          ['Heat Duty Q', formatUnit(Q_kW, 'heat-duty', 2).value + ' ' + formatUnit(Q_kW, 'heat-duty', 2).symbol, formatUnit(Q_kW, 'heat-duty', 2).value + ' ' + formatUnit(Q_kW, 'heat-duty', 2).symbol],
          ['LMTD', formatUnit(LMTD_c, 'temp-diff', 2).value + ' ' + formatUnit(LMTD_c, 'temp-diff', 2).symbol, (dT2_p <= 0 ? 'N/A (Cross)' : formatUnit(LMTD_p, 'temp-diff', 2).value + ' ' + formatUnit(LMTD_p, 'temp-diff', 2).symbol)],
          ['Corrected ΔT_lm', formatUnit(dTLM_c, 'temp-diff', 2).value + ' ' + formatUnit(dTLM_c, 'temp-diff', 2).symbol, (dT2_p <= 0 ? 'N/A (Cross)' : formatUnit(dTLM_p, 'temp-diff', 2).value + ' ' + formatUnit(dTLM_p, 'temp-diff', 2).symbol)],
          ['U_calculated', formatUnit(U_calc, 'htc', 2).value + ' ' + formatUnit(U_calc, 'htc', 2).symbol, formatUnit(U_calc, 'htc', 2).value + ' ' + formatUnit(U_calc, 'htc', 2).symbol],
          ['Area Required', formatUnit(Ar_c, 'area', 2).value + ' ' + formatUnit(Ar_c, 'area', 2).symbol, (dT2_p <= 0 ? 'N/A' : formatUnit(Ar_p, 'area', 2).value + ' ' + formatUnit(Ar_p, 'area', 2).symbol)],
          ['Area Available', formatUnit(Aa, 'area', 2).value + ' ' + formatUnit(Aa, 'area', 2).symbol, formatUnit(Aa, 'area', 2).value + ' ' + formatUnit(Aa, 'area', 2).symbol],
          ['% Excess Area', excess_c.toFixed(1) + '%', (dT2_p <= 0 ? 'N/A' : excess_p.toFixed(1) + '%')],
          ['Tube Side ΔP', formatUnit(dp_tube_kPa, 'press-drop-kpa', 2).value + ' ' + formatUnit(dp_tube_kPa, 'press-drop-kpa', 2).symbol, formatUnit(dp_tube_kPa, 'press-drop-kpa', 2).value + ' ' + formatUnit(dp_tube_kPa, 'press-drop-kpa', 2).symbol],
          ['Shell Side ΔP', formatUnit(dp_shell_kPa, 'press-drop-kpa', 2).value + ' ' + formatUnit(dp_shell_kPa, 'press-drop-kpa', 2).symbol, formatUnit(dp_shell_kPa, 'press-drop-kpa', 2).value + ' ' + formatUnit(dp_shell_kPa, 'press-drop-kpa', 2).symbol]
        ];
        
        summaryBody.innerHTML = rows.map(row =>
          `<tr><td class="lbl">${row[0]}</td><td class="val text-data">${row[1]}</td><td class="val text-data">${row[2]}</td></tr>`
        ).join('');
      }

    } catch (err) {
      logConsole(`STHE Sizing Calculation Error: ${err.message}`, "error");
      updateStatusBadge("sthe-results .status-banner", `STHE Sizing Error: ${err.message}`, "fail");
    }
  };

  // Tune STHE helper functions
  window.tuneStheInput = function(id, val) {
    const el = document.getElementById(id);
    if (el) {
      // If active unit system is not SI, convert val from standard SI metric to active unit first
      const type = el.getAttribute('data-unit-type');
      let finalVal = val;
      if (type && UNIT_CONVERSIONS[type] && activeUnitSystem !== 'SI') {
        // Val is provided in metric standard: L in mm, Shell ID in mm, Baffle spacing in mm, passes is count (no unit)
        let valSI = val;
        if (id === 'sthe-tube-L' || id === 'sthe-shell-id' || id === 'sthe-baffle-space') {
          valSI = val / 1000; // standard standard SI unit is meters!
        }
        finalVal = UNIT_CONVERSIONS[type].fromSI(valSI, activeUnitSystem);
      }
      el.value = finalVal;
      calculateSTHE();
    }
  };

  window.tuneStheTubeOD = function(od, id) {
    const elOD = document.getElementById('sthe-tube-od');
    const elID = document.getElementById('sthe-tube-id');
    if (elOD && elID) {
      let finalOD = od;
      let finalID = id;
      if (activeUnitSystem !== 'SI') {
        finalOD = UNIT_CONVERSIONS['length-mm'].fromSI(od / 1000, activeUnitSystem);
        finalID = UNIT_CONVERSIONS['length-mm'].fromSI(id / 1000, activeUnitSystem);
      }
      elOD.value = finalOD;
      elID.value = finalID;
      calculateSTHE();
    }
  };

  // Overridden generateSummaryReport to support active units and STHE
  window.generateSummaryReport = generateSummaryReport;

  // --- PDF DOWNLOAD & COPY CLIPBOARD HANDLERS ---
  document.addEventListener("DOMContentLoaded", () => {
    const btnPdf = document.getElementById("btn-download-pdf");
    if (btnPdf) {
      btnPdf.addEventListener("click", () => {
        logConsole("GENERATING PDF DATASHEET REPORT...", "info");
        const element = document.getElementById("report-tab");
        const opt = {
          margin:       0.3,
          filename:     `BHARAT_FLOWSIZE_REPORT_${new Date().toISOString().slice(0,10)}.pdf`,
          image:        { type: 'jpeg', quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#0a0e1a' },
          jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
        };
        html2pdf().set(opt).from(element).save().then(() => {
          logConsole("PDF REPORT DOWNLOADED SUCCESSFULLY", "success");
        }).catch(err => {
          logConsole(`PDF generation failed: ${err.message}`, "error");
        });
      });
    }

    const btnCopy = document.getElementById("btn-copy-report");
    if (btnCopy) {
      btnCopy.addEventListener("click", () => {
        logConsole("COPYING DATASHEET RESULTS TO CLIPBOARD...", "info");
        let resultsText = `BHARAT FLOWSIZE DIGITAL SUITE - SUMMARY REPORT\n`;
        resultsText += `GENERATED ON: ${getTimestamp()}\n`;
        resultsText += `UNIT SYSTEM: ${activeUnitSystem}\n`;
        resultsText += `==============================================\n\n`;

        if (state.pump.calculated) {
          const p = state.pump.results;
          resultsText += `--- PUMP HYDRAULICS REPORT ---\n`;
          resultsText += `Fluid: ${state.pump.inputs.fluidVal}\n`;
          resultsText += `Design Volumetric Flow: ${formatUnit(p.designVolFlow, 'vol-flow', 2).value} ${formatUnit(p.designVolFlow, 'vol-flow', 2).symbol}\n`;
          resultsText += `NPSHa: ${formatUnit(p.npsha, 'length-m', 2).value} ${formatUnit(p.npsha, 'length-m', 2).symbol}\n`;
          resultsText += `NPSHr: ${formatUnit(state.pump.inputs.npshr, 'length-m', 2).value} ${formatUnit(state.pump.inputs.npshr, 'length-m', 2).symbol}\n`;
          resultsText += `Cavitation Audit: ${p.cavText}\n`;
          resultsText += `BHP: ${formatUnit(p.bhp, 'power', 2).value} ${formatUnit(p.bhp, 'power', 2).symbol}\n`;
          resultsText += `Motor Power: ${formatUnit(p.motor, 'power', 2).value} ${formatUnit(p.motor, 'power', 2).symbol}\n\n`;
        }

        if (state.line.calculated) {
          const l = state.line.results;
          resultsText += `--- PIPELINE SIZING REPORT ---\n`;
          resultsText += `Type: ${state.line.activeType.toUpperCase()}\n`;
          resultsText += `Fluid Velocity: ${formatUnit(l.velocity, 'velocity', 2).value} ${formatUnit(l.velocity, 'velocity', 2).symbol}\n`;
          resultsText += `Friction Factor: ${l.frictionFactor.toFixed(5)}\n`;
          resultsText += `Total Pressure Drop: ${formatUnit(l.dpTotal, 'press-drop', 4).value} ${formatUnit(l.dpTotal, 'press-drop', 4).symbol}\n`;
          resultsText += `Pressure Drop per 100m: ${formatUnit(l.dp100m, 'press-drop', 3).value} ${formatUnit(l.dp100m, 'press-drop', 3).symbol}/100m\n`;
          resultsText += `Velocity Check: ${l.velText}\n`;
          resultsText += `Pressure Drop Check: ${l.dpText}\n\n`;
        }

        if (state.sthe && state.sthe.calculated) {
          const s = state.sthe.results;
          resultsText += `--- SHELL & TUBE HEAT EXCHANGER REPORT ---\n`;
          resultsText += `Recommended Type: ${s.stheType}\n`;
          resultsText += `Heat Duty Q: ${formatUnit(s.Q_kW, 'heat-duty', 2).value} ${formatUnit(s.Q_kW, 'heat-duty', 2).symbol}\n`;
          resultsText += `Corrected LMTD: ${formatUnit(s.dT_lm, 'temp-diff', 2).value} ${formatUnit(s.dT_lm, 'temp-diff', 2).symbol}\n`;
          resultsText += `Tube Count Nt: ${s.Nt}\n`;
          resultsText += `Calculated U: ${formatUnit(s.U_calc, 'htc', 2).value} ${formatUnit(s.U_calc, 'htc', 2).symbol}\n`;
          resultsText += `Excess Area: ${s.excessArea.toFixed(1)}% [${s.areaStatus}]\n`;
          resultsText += `Tube Side Velocity: ${formatUnit(window.getInputValueSI('sthe-v-tube'), 'velocity', 2).value} ${formatUnit(window.getInputValueSI('sthe-v-tube'), 'velocity', 2).symbol}\n`;
          resultsText += `Tube Side ΔP: ${formatUnit(s.dp_tube_kPa, 'press-drop-kpa', 2).value} ${formatUnit(s.dp_tube_kPa, 'press-drop-kpa', 2).symbol}\n`;
          resultsText += `Shell Side ΔP: ${formatUnit(s.dp_shell_kPa, 'press-drop-kpa', 2).value} ${formatUnit(s.dp_shell_kPa, 'press-drop-kpa', 2).symbol}\n`;
        }

        navigator.clipboard.writeText(resultsText).then(() => {
          logConsole("SUMMARY DATASHEET COPIED TO CLIPBOARD!", "success");
        }).catch(err => {
          logConsole(`Clipboard copy failed: ${err.message}`, "error");
        });
      });
    }
  });

  // --- 2D PHYSICS ANIMATIONS LOOP ENGINE (60FPS requestAnimationFrame) ---
  const animState = {
    pump: { isRunning: true, angle: 0, particles: [] },
    line: { isRunning: true, particles: [] },
    sthe: { isRunning: true, particles: [] }
  };

  // Seed particles
  for (let i = 0; i < 30; i++) {
    animState.pump.particles.push({ x: Math.random(), offset: Math.random() * 10 - 5 });
    animState.line.particles.push({ x: Math.random(), y: Math.random() * 20 - 10 });
    animState.sthe.particles.push({ x: Math.random(), type: 'tube', offset: Math.random() });
    animState.sthe.particles.push({ x: Math.random(), type: 'shell', offset: Math.random() });
  }

  // Draw Centrifugal Pump — Professional Engineering Cross-Section
  function drawPumpCanvas(canvas, ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const isLight = document.body.classList.contains("light-theme");
    const w = canvas.width, h = canvas.height;

    // ── Background gradient ──
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, isLight ? "#f0f4ff" : "#060c1a");
    bgGrad.addColorStop(1, isLight ? "#e8f0fe" : "#0a1628");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Pull live data from state
    let pResults = null, pInputs = null;
    if (window.state && window.state.pump && window.state.pump.calculated) {
      pResults = window.state.pump.results;
      pInputs  = window.state.pump.inputs;
    }
    const designFlow = pResults ? pResults.designVolFlow : 0.5;
    const diffHead   = pResults ? pResults.diffHeadCal : 25;
    const pSucA      = pResults ? pResults.pSucA : 1.0;
    const pDisA      = pResults ? pResults.pDischA : 5.0;
    const cavType    = pResults ? pResults.cavType : "ok";
    const npsha      = pResults ? pResults.npsha : 5;
    const npshr      = pResults ? (pInputs ? pInputs.npshr : 3) : 3;
    const motorLoad  = pResults ? pResults.motorLoading : 0;
    const velSuc     = pResults ? pResults.velSuc : 1.5;
    const velDis     = pResults ? pResults.velDis : 3.0;

    // Spin speed based on flow
    if (animState.pump.isRunning) {
      const spinSpeed = 0.03 + Math.min(0.15, (designFlow / 5) * 0.10);
      animState.pump.angle += spinSpeed;
    }

    // ── Colour palette ──
    const col = {
      casing:    isLight ? "#334155" : "#94a3b8",
      casingFill:isLight ? "#e2e8f0" : "#1e293b",
      impeller:  cavType === "fail" ? "#f87171" : "#00b4d8",
      impBlades: cavType === "fail" ? "#ef4444" : "#00c4a0",
      motor:     "#f97316",
      motorBody: isLight ? "#d97706" : "#92400e",
      shaft:     isLight ? "#94a3b8" : "#64748b",
      sucPipe:   "#3b82f6",
      disPipe:   "#f97316",
      particle:  cavType === "fail" ? "#f87171" : (cavType === "warn" ? "#f59e0b" : "#00c4a0"),
      text:      isLight ? "#1e293b" : "#e2e8f0",
      muted:     isLight ? "#64748b" : "#64748b",
      grid:      isLight ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.04)",
      flange:    isLight ? "#475569" : "#475569",
    };

    // ── Grid lines (engineering paper style) ──
    ctx.strokeStyle = col.grid;
    ctx.lineWidth = 0.5;
    for (let gx = 0; gx < w; gx += 24) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke(); }
    for (let gy = 0; gy < h; gy += 24) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke(); }

    // ── Layout constants ──
    const cx = w * 0.44;
    const cy = h * 0.52;
    const R  = Math.min(w, h) * 0.17;   // Volute outer radius
    const Ri = R * 0.62;                 // Impeller radius
    const Rh = R * 0.18;                 // Hub radius

    // ── Motor block (right of pump) ──
    const motorX = cx + R + 12;
    const motorW = w * 0.16;
    const motorH = R * 1.1;
    const motorY = cy - motorH / 2;
    // Motor body
    ctx.fillStyle = col.motorBody;
    ctx.beginPath();
    ctx.roundRect(motorX, motorY, motorW, motorH, 6);
    ctx.fill();
    ctx.strokeStyle = col.motor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Motor cooling fins
    ctx.strokeStyle = isLight ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    for (let fi = 1; fi < 6; fi++) {
      const fy = motorY + (motorH / 6) * fi;
      ctx.beginPath(); ctx.moveTo(motorX, fy); ctx.lineTo(motorX + motorW, fy); ctx.stroke();
    }
    // Motor label
    ctx.fillStyle = col.motor;
    ctx.font = `bold ${Math.round(R * 0.22)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText("MOTOR", motorX + motorW / 2, cy - 4);
    ctx.font = `${Math.round(R * 0.16)}px monospace`;
    ctx.fillStyle = isLight ? "#fff7ed" : "#fed7aa";
    ctx.fillText(`${motorLoad.toFixed(0)}% LOAD`, motorX + motorW / 2, cy + 12);

    // ── Shaft ──
    const shaftLen = R + 14;
    ctx.strokeStyle = col.shaft;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(motorX, cy);
    ctx.stroke();
    // Shaft coupling (small box)
    ctx.fillStyle = col.shaft;
    ctx.fillRect(motorX - 8, cy - 6, 8, 12);

    // ── Pump Volute Casing ──
    // Outer volute (spiral-ish via thick arc)
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 2 * Math.PI);
    ctx.fillStyle = col.casingFill;
    ctx.fill();
    ctx.strokeStyle = col.casing;
    ctx.lineWidth = 3;
    ctx.stroke();
    // Inner volute ring
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.76, 0, 2 * Math.PI);
    ctx.strokeStyle = isLight ? "#94a3b8" : "#334155";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Volute cutwater (triangular notch at top-right)
    ctx.beginPath();
    ctx.moveTo(cx + R * 0.75, cy - R * 0.05);
    ctx.lineTo(cx + R * 0.60, cy - R * 0.32);
    ctx.lineTo(cx + R * 0.92, cy - R * 0.24);
    ctx.closePath();
    ctx.fillStyle = isLight ? "#cbd5e1" : "#1e293b";
    ctx.fill();

    // ── Discharge nozzle (top of volute) ──
    const disNozzleX = cx + R * 0.18;
    const disNozzleTopY = cy - R - 50;
    const nozzleW = 22;
    // Pipe up
    ctx.fillStyle = col.disPipe;
    ctx.fillRect(disNozzleX - nozzleW / 2, disNozzleTopY + 30, nozzleW, R - 10);
    // Flange at casing
    ctx.fillStyle = col.flange;
    ctx.fillRect(disNozzleX - nozzleW / 2 - 5, cy - R + 2, nozzleW + 10, 8);
    // Flange at top
    ctx.fillRect(disNozzleX - nozzleW / 2 - 5, disNozzleTopY + 28, nozzleW + 10, 8);
    // Arrow head (upward)
    ctx.fillStyle = col.disPipe;
    ctx.beginPath();
    ctx.moveTo(disNozzleX, disNozzleTopY + 8);
    ctx.lineTo(disNozzleX - 10, disNozzleTopY + 28);
    ctx.lineTo(disNozzleX + 10, disNozzleTopY + 28);
    ctx.closePath();
    ctx.fill();
    // Discharge label
    ctx.fillStyle = col.disPipe;
    ctx.font = `bold ${Math.round(R * 0.19)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(`${pDisA.toFixed(2)} bar`, disNozzleX, disNozzleTopY);
    ctx.font = `${Math.round(R * 0.15)}px monospace`;
    ctx.fillStyle = col.muted;
    ctx.fillText("DISCHARGE", disNozzleX, disNozzleTopY + 15);
    ctx.fillStyle = isLight ? "#f97316" : "#fdba74";
    ctx.fillText(`${velDis.toFixed(2)} m/s`, disNozzleX, disNozzleTopY + 26);

    // ── Suction nozzle (left of volute) ──
    const sucNozzleX = cx - R - 50;
    const nozzleH2 = 22;
    // Pipe left
    ctx.fillStyle = col.sucPipe;
    ctx.fillRect(sucNozzleX, cy - nozzleH2 / 2, R - 10, nozzleH2);
    // Flange at casing
    ctx.fillStyle = col.flange;
    ctx.fillRect(cx - R - 2, cy - nozzleH2 / 2 - 5, 8, nozzleH2 + 10);
    // Flange at end
    ctx.fillRect(sucNozzleX - 2, cy - nozzleH2 / 2 - 5, 8, nozzleH2 + 10);
    // Arrow head (rightward)
    ctx.fillStyle = col.sucPipe;
    ctx.beginPath();
    ctx.moveTo(cx - R - 8, cy);
    ctx.lineTo(sucNozzleX + 28, cy - 10);
    ctx.lineTo(sucNozzleX + 28, cy + 10);
    ctx.closePath();
    ctx.fill();
    // Suction label
    ctx.fillStyle = col.sucPipe;
    ctx.font = `bold ${Math.round(R * 0.19)}px monospace`;
    ctx.textAlign = "center";
    ctx.fillText(`${pSucA.toFixed(2)} bar`, sucNozzleX - 12, cy - 18);
    ctx.font = `${Math.round(R * 0.15)}px monospace`;
    ctx.fillStyle = col.muted;
    ctx.fillText("SUCTION", sucNozzleX - 12, cy - 5);
    ctx.fillStyle = isLight ? "#3b82f6" : "#93c5fd";
    ctx.fillText(`${velSuc.toFixed(2)} m/s`, sucNozzleX - 12, cy + 8);

    // ── Impeller (spinning) ──
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(animState.pump.angle);
    // Impeller disc (back shroud)
    ctx.beginPath();
    ctx.arc(0, 0, Ri, 0, 2 * Math.PI);
    ctx.fillStyle = isLight ? "#dbeafe" : "rgba(0,180,216,0.12)";
    ctx.fill();
    ctx.strokeStyle = col.impeller;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Curved blades (7 blades)
    const numBlades = 7;
    for (let i = 0; i < numBlades; i++) {
      ctx.rotate((2 * Math.PI) / numBlades);
      ctx.beginPath();
      ctx.moveTo(Rh, 0);
      ctx.bezierCurveTo(Ri * 0.45, Ri * 0.12, Ri * 0.7, Ri * 0.35, Ri * 0.92, Ri * 0.20);
      ctx.strokeStyle = col.impBlades;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    // Hub
    ctx.beginPath();
    ctx.arc(0, 0, Rh, 0, 2 * Math.PI);
    ctx.fillStyle = col.motor;
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1;
    ctx.stroke();
    // Centre dot
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, 2 * Math.PI);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();

    // ── CAVITATION danger glow ──
    if (cavType === "fail") {
      const glowPulse = 0.4 + 0.4 * Math.abs(Math.sin(Date.now() / 350));
      const radGrad = ctx.createRadialGradient(cx, cy, Ri * 0.5, cx, cy, R * 1.2);
      radGrad.addColorStop(0, `rgba(239,68,68,${glowPulse * 0.18})`);
      radGrad.addColorStop(1, "rgba(239,68,68,0)");
      ctx.fillStyle = radGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, R * 1.2, 0, 2 * Math.PI);
      ctx.fill();
    }

    // ── Animated flow particles ──
    if (animState.pump.isRunning) {
      const speed = 0.004 + Math.min(0.018, (designFlow / 5) * 0.012);
      animState.pump.particles.forEach(p => {
        p.x += speed;
        if (p.x > 1.0) p.x = 0;
        ctx.fillStyle = col.particle;
        ctx.globalAlpha = 0.8;
        // Suction path (left pipe → pump)
        if (p.x < 0.38) {
          const t = p.x / 0.38;
          const px = sucNozzleX + t * (cx - R - sucNozzleX + 20);
          const py = cy + p.offset * 4;
          ctx.beginPath(); ctx.arc(px, py, 2.2, 0, 2 * Math.PI); ctx.fill();
        }
        // Inside impeller (swirling)
        else if (p.x < 0.54) {
          const t = (p.x - 0.38) / 0.16;
          const swirl = t * 2.5 * Math.PI + animState.pump.angle;
          const r = Rh + t * (Ri - Rh);
          ctx.beginPath(); ctx.arc(cx + Math.cos(swirl) * r, cy + Math.sin(swirl) * r, 2, 0, 2 * Math.PI); ctx.fill();
        }
        // Discharge path (up the nozzle)
        else {
          const t = (p.x - 0.54) / 0.46;
          const px = disNozzleX + p.offset * 4;
          const py = cy - R - t * (cy - R - disNozzleTopY + 20);
          ctx.beginPath(); ctx.arc(px, py, 2.2, 0, 2 * Math.PI); ctx.fill();
        }
      });
      ctx.globalAlpha = 1.0;
    }

    // ── Key metrics overlay (bottom ribbon) ──
    const ribbonY = h - 36;
    ctx.fillStyle = isLight ? "rgba(15,23,42,0.07)" : "rgba(0,0,0,0.45)";
    ctx.fillRect(0, ribbonY, w, 36);
    const metrics = [
      { label: "Q",     val: designFlow.toFixed(3), unit: "m³/hr", col: "#00c4a0" },
      { label: "H",     val: diffHead.toFixed(2),   unit: "m",     col: "#f97316" },
      { label: "NPSHa", val: npsha.toFixed(2),       unit: "m",     col: cavType === "fail" ? "#f87171" : (cavType === "warn" ? "#f59e0b" : "#4ade80") },
      { label: "Load",  val: motorLoad.toFixed(1),   unit: "%",     col: motorLoad > 90 ? "#f87171" : (motorLoad < 20 ? "#f59e0b" : "#a78bfa") },
    ];
    const slotW = w / metrics.length;
    ctx.textAlign = "center";
    metrics.forEach((m, i) => {
      const sx = slotW * i + slotW / 2;
      ctx.fillStyle = m.col;
      ctx.font = `bold ${Math.round(R * 0.2)}px monospace`;
      ctx.fillText(`${m.val} ${m.unit}`, sx, ribbonY + 15);
      ctx.fillStyle = col.muted;
      ctx.font = `${Math.round(R * 0.15)}px monospace`;
      ctx.fillText(m.label, sx, ribbonY + 28);
    });

    // ── NPSHa/NPSHr sidebar gauge ──
    const gx = w - 14, gW = 8, gH = h * 0.45, gY = h * 0.12;
    const npshMax = Math.max(10, npshr * 2.5);
    const npshaH  = Math.min(gH, (npsha / npshMax) * gH);
    const npshrY2 = gY + gH - (npshr / npshMax) * gH;
    // Background
    ctx.fillStyle = isLight ? "#e2e8f0" : "#1e293b";
    ctx.fillRect(gx - gW / 2, gY, gW, gH);
    // Fill
    ctx.fillStyle = cavType === "fail" ? "#ef4444" : (cavType === "warn" ? "#f59e0b" : "#00c4a0");
    ctx.fillRect(gx - gW / 2 + 1, gY + gH - npshaH, gW - 2, npshaH);
    // NPSHr marker
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(gx - gW, npshrY2); ctx.lineTo(gx + gW, npshrY2); ctx.stroke();
    ctx.fillStyle = col.muted;
    ctx.font = `${Math.round(R * 0.14)}px monospace`;
    ctx.textAlign = "right";
    ctx.fillText("NPSHa", gx - gW - 2, gY + gH - npshaH + 4);
    ctx.fillText("NPSHr", gx - gW - 2, npshrY2 + 4);
  }


  // Draw Pipeline 2D Animation
  function drawLineCanvas(canvas, ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const isLight = document.body.classList.contains("light-theme");
    const colorBg = isLight ? "#f8fafc" : "#0f1524";
    const colorText = isLight ? "#1e293b" : "#f8fafc";
    
    ctx.fillStyle = colorBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;
    const pipeY = h * 0.45;
    const pipeH = 34;
    
    // Determine color based on pipe material
    let matEl = document.getElementById("line-material");
    let material = matEl ? matEl.value : 'cs';
    let wallColor = "#475569"; // default Carbon steel
    if (material === 'gi') wallColor = "#94a3b8";
    else if (material.includes('ss') || material === 'ss304') wallColor = "#cbd5e1";
    else if (material.includes('pvc') || material === 'pvc') wallColor = "#2563eb";
    else if (material === 'hdpe') wallColor = "#020617";
    else if (material.includes('ptfe')) wallColor = "#e2e8f0";

    // Draw Pipe Walls
    ctx.fillStyle = wallColor;
    ctx.fillRect(40, pipeY, w - 80, 3); // top wall
    ctx.fillRect(40, pipeY + pipeH - 3, w - 80, 3); // bottom wall

    // Create linear gradient for pressure gradient (high to low pressure)
    let overallStatus = 'ok';
    if (window.state && window.state.line && window.state.line.calculated) {
      overallStatus = window.state.line.results.overallStatus;
    }
    
    const interiorGrad = ctx.createLinearGradient(40, 0, w - 40, 0);
    interiorGrad.addColorStop(0, "rgba(0, 196, 160, 0.15)"); // high pressure (teal)
    interiorGrad.addColorStop(1, overallStatus === 'fail' ? "rgba(239, 68, 68, 0.15)" : "rgba(245, 158, 11, 0.12)"); // low pressure
    
    ctx.fillStyle = interiorGrad;
    ctx.fillRect(40, pipeY + 3, w - 80, pipeH - 6);

    // Update and draw flow speed particles
    let velocity = 1.5;
    if (window.state && window.state.line && window.state.line.calculated) {
      velocity = window.state.line.results.velocity;
    }
    const particleSpeed = 0.003 + Math.min(0.025, (velocity / 10) * 0.015);

    if (animState.line.isRunning) {
      animState.line.particles.forEach(p => {
        p.x += particleSpeed;
        if (p.x > 1.0) {
          p.x = 0;
          p.y = Math.random() * (pipeH - 10) - (pipeH / 2 - 5);
        }
        
        ctx.fillStyle = "#00c4a0";
        ctx.beginPath();
        ctx.arc(40 + p.x * (w - 80), pipeY + pipeH/2 + p.y, 2, 0, 2 * Math.PI);
        ctx.fill();
      });
    }

    // Draw valve symbol in the middle
    const mx = w * 0.5;
    const my = pipeY + pipeH / 2;
    ctx.strokeStyle = wallColor;
    ctx.fillStyle = isLight ? "#e2e8f0" : "#1e293b";
    ctx.lineWidth = 2;
    
    // Draw Gate Valve shape
    ctx.beginPath();
    ctx.moveTo(mx - 8, my - 12);
    ctx.lineTo(mx + 8, my + 12);
    ctx.lineTo(mx + 8, my - 12);
    ctx.lineTo(mx - 8, my + 12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Stem and wheel
    ctx.beginPath();
    ctx.moveTo(mx, my - 6);
    ctx.lineTo(mx, my - 18);
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(mx, my - 20, 6, 0, 2 * Math.PI);
    ctx.stroke();

    ctx.fillStyle = colorText;
    ctx.font = "8px monospace";
    ctx.fillText("VALVE", mx - 12, pipeY + pipeH + 12);

    // Info overlay
    let regimeText = "TURBULENT";
    if (window.state && window.state.line && window.state.line.calculated) {
      regimeText = window.state.line.results.regimeText.toUpperCase();
    }
    ctx.fillText(`FLOW REGIME: ${regimeText}`, 45, pipeY - 8);
    ctx.fillText(`VELOCITY: ${formatUnit(velocity, 'velocity', 2).value} ${formatUnit(velocity, 'velocity', 2).symbol}`, w - 160, pipeY - 8);
  }

  // Draw Shell & Tube Exchanger 2D Animation
  function drawSTHECanvas(canvas, ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const isLight = document.body.classList.contains("light-theme");
    const colorBg = isLight ? "#f8fafc" : "#0f1524";
    const colorText = isLight ? "#1e293b" : "#f8fafc";
    
    ctx.fillStyle = colorBg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;

    // Shell coordinates
    const sx = 80;
    const sy = 40;
    const sw = w - 160;
    const sh = h - 80;

    // Render Shell Casing
    ctx.strokeStyle = isLight ? "#475569" : "#f97316"; // saffron accent
    ctx.lineWidth = 3;
    ctx.strokeRect(sx, sy, sw, sh);

    // Render Nozzles
    ctx.lineWidth = 2;
    // Tube Inlet (Left Top)
    ctx.strokeRect(sx - 20, sy + 15, 20, 15);
    // Tube Outlet (Right Bottom)
    ctx.strokeRect(sx + sw, sy + sh - 30, 20, 15);
    
    // Shell Inlet (Middle Top)
    ctx.strokeRect(sx + 40, sy - 15, 20, 15);
    // Shell Outlet (Right Top-Bottom)
    ctx.strokeRect(sx + sw - 60, sy + sh, 20, 15);

    // Labels
    ctx.fillStyle = colorText;
    ctx.font = "8px monospace";
    ctx.fillText("TUBE IN", sx - 25, sy + 10);
    ctx.fillText("TUBE OUT", sx + sw + 5, sy + sh - 35);
    ctx.fillText("SHELL IN", sx + 30, sy - 20);
    ctx.fillText("SHELL OUT", sx + sw - 75, sy + sh + 22);

    // Draw Baffles
    ctx.strokeStyle = isLight ? "#94a3b8" : "#475569";
    ctx.lineWidth = 2;
    const baffleSpacing = sw / 5;
    for (let i = 1; i <= 4; i++) {
      ctx.beginPath();
      const bx = sx + i * baffleSpacing;
      if (i % 2 === 1) {
        // Top baffle
        ctx.moveTo(bx, sy);
        ctx.lineTo(bx, sy + sh - 20);
      } else {
        // Bottom baffle
        ctx.moveTo(bx, sy + 20);
        ctx.lineTo(bx, sy + sh);
      }
      ctx.stroke();
    }

    // Draw Tube Lines
    ctx.strokeStyle = "#00c4a0";
    ctx.lineWidth = 1;
    const tubeSpacing = sh / 6;
    for (let i = 1; i <= 5; i++) {
      ctx.beginPath();
      ctx.moveTo(sx, sy + i * tubeSpacing);
      ctx.lineTo(sx + sw, sy + i * tubeSpacing);
      ctx.stroke();
    }

    // Animate Flow particles
    let Tin_tube = 25, Tout_tube = 45;
    let Tin_shell = 95, Tout_shell = 40;
    if (window.state && window.state.sthe && window.state.sthe.calculated) {
      const inp = window.state.sthe.inputs;
      Tin_tube = inp.Tin_tube || 25;
      Tout_tube = inp.Tout_tube || 45;
      Tin_shell = inp.Tin_shell || 95;
      Tout_shell = inp.Tout_shell || 40;
    }

    const isShellHot = Tin_shell > Tin_tube;

    if (animState.sthe.isRunning) {
      animState.sthe.particles.forEach(p => {
        p.x += 0.005;
        if (p.x > 1.0) p.x = 0;

        if (p.type === 'tube') {
          // Straight horizontal flow
          const currX = sx + p.x * sw;
          const tubeIdx = Math.floor(p.offset * 5) + 1; // 1 to 5
          const currY = sy + tubeIdx * tubeSpacing;

          // Color fade from inlet to outlet
          // Let's blend from cold to hot or hot to cold
          let r, g, b;
          if (isShellHot) {
            // Tube side is cold, getting warmer
            // start blue (0,0,255) -> fade to teal/green (0,255,200)
            r = 0;
            g = Math.floor(p.x * 200);
            b = Math.floor(255 - p.x * 55);
          } else {
            // Tube side is hot, getting cooler
            // start red (255,0,0) -> fade to orange/yellow (255,165,0)
            r = 255;
            g = Math.floor(p.x * 165);
            b = 0;
          }
          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.beginPath();
          ctx.arc(currX, currY, 2, 0, 2 * Math.PI);
          ctx.fill();
        } else {
          // Shell zigzag path around baffles
          const frac = p.x;
          let px, py;
          
          const numBaffs = 4;
          const segWidth = baffleSpacing;
          const idx = Math.floor(frac * 5); // 0 to 4 segment idx
          const subFrac = (frac * 5) % 1;

          px = sx + frac * sw;
          
          // Calculate zigzag Y coordinate
          if (idx === 0) {
            // From top inlet, going down
            py = sy + subFrac * (sh - 10);
          } else if (idx === 1) {
            // Going up
            py = sy + sh - 10 - subFrac * (sh - 20);
          } else if (idx === 2) {
            // Going down
            py = sy + 10 + subFrac * (sh - 20);
          } else if (idx === 3) {
            // Going up
            py = sy + sh - 10 - subFrac * (sh - 20);
          } else {
            // Going down to shell outlet
            py = sy + 10 + subFrac * (sh - 20);
          }

          let r, g, b;
          if (isShellHot) {
            // Shell side is hot, getting cooler
            // start red (255,0,0) -> fade to orange/yellow (255,150,0)
            r = 255;
            g = Math.floor(p.x * 150);
            b = 0;
          } else {
            // Shell side is cold, getting warmer
            // start blue (0,0,255) -> fade to teal (0,200,250)
            r = 0;
            g = Math.floor(p.x * 200);
            b = Math.floor(255 - p.x * 5);
          }

          ctx.fillStyle = `rgb(${r},${g},${b})`;
          ctx.beginPath();
          ctx.arc(px + p.offset * 4 - 2, py, 2.5, 0, 2 * Math.PI);
          ctx.fill();
        }
      });
    }
  }

  // Animation ticks manager
  function tickAnimations() {
    // Centrifugal pump animation
    const pumpCanvas = document.getElementById("pump-animation-canvas");
    if (pumpCanvas) {
      const ctx = pumpCanvas.getContext("2d");
      drawPumpCanvas(pumpCanvas, ctx);
    }

    // Line sizing animation
    const lineCanvas = document.getElementById("line-animation-canvas");
    if (lineCanvas) {
      const ctx = lineCanvas.getContext("2d");
      drawLineCanvas(lineCanvas, ctx);
    }

    // STHE animation
    const stheCanvas = document.getElementById("sthe-animation-canvas");
    if (stheCanvas) {
      const ctx = stheCanvas.getContext("2d");
      drawSTHECanvas(stheCanvas, ctx);
    }

    requestAnimationFrame(tickAnimations);
  }

  // Bind animation play/pause buttons
  document.addEventListener("DOMContentLoaded", () => {
    const bindToggle = (btnId, key) => {
      const btn = document.getElementById(btnId);
      if (btn) {
        btn.addEventListener("click", () => {
          animState[key].isRunning = !animState[key].isRunning;
          btn.textContent = animState[key].isRunning ? "PAUSE" : "PLAY";
        });
      }
    };
    bindToggle("btn-anim-pause-pump", "pump");
    bindToggle("btn-anim-pause-line", "line");
    bindToggle("btn-anim-pause-sthe", "sthe");

    // Start requestAnimationFrame ticks
    tickAnimations();
  });

})();


function drawPumpCharacteristicCurve(Q_design, H_design, H_static) {
    const canvas = document.getElementById("pump-curve-canvas");
    if (!canvas) return;
    
    const ctx = canvas.getContext("2d");
    const width = canvas.width = canvas.parentElement.clientWidth;
    const height = canvas.height = canvas.parentElement.clientHeight;
    
    ctx.clearRect(0, 0, width, height);
    
    if (Q_design <= 0 || H_design <= 0) return;
    
    const maxQ = Q_design * 1.5;
    const maxH = H_design * 1.5;
    
    const padding = 40;
    const plotWidth = width - padding * 2;
    const plotHeight = height - padding * 2;
    
    const getX = (q) => padding + (q / maxQ) * plotWidth;
    const getY = (h) => height - padding - (h / maxH) * plotHeight;
    
    // Draw Grid and Axes
    ctx.strokeStyle = "#1a3a1a";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 5; i++) {
        const x = padding + (i / 5) * plotWidth;
        const y = height - padding - (i / 5) * plotHeight;
        
        ctx.beginPath(); ctx.moveTo(x, padding); ctx.lineTo(x, height - padding); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(padding, y); ctx.lineTo(width - padding, y); ctx.stroke();
        
        ctx.fillStyle = "rgba(255,255,255,0.4)";
        ctx.font = "10px monospace";
        ctx.textAlign = "center";
        ctx.fillText(((i / 5) * maxQ).toFixed(0), x, height - padding + 15);
        ctx.textAlign = "right";
        ctx.fillText(((i / 5) * maxH).toFixed(0), padding - 5, y + 4);
    }
    
    // Axis labels
    ctx.fillStyle = "var(--color-saffron)";
    ctx.font = "bold 12px monospace";
    ctx.textAlign = "center";
    ctx.fillText("Flow Rate Q (m³/hr)", width / 2, height - 5);
    
    ctx.save();
    ctx.translate(12, height / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText("Head H (m)", 0, 0);
    ctx.restore();
    
    // Pump Curve
    ctx.beginPath();
    ctx.strokeStyle = "#f59e0b"; // Amber
    ctx.lineWidth = 3;
    for (let q = 0; q <= maxQ; q += maxQ / 50) {
        // H_pump(Q) = H_design * (1 + 0.3*(1 - (Q/Q_design)^2))
        const h = H_design * (1 + 0.3 * (1 - Math.pow(q / Q_design, 2)));
        if (q === 0) ctx.moveTo(getX(q), getY(h));
        else ctx.lineTo(getX(q), getY(h));
    }
    ctx.stroke();
    
    // System Curve
    ctx.beginPath();
    ctx.strokeStyle = "#22c55e"; // Green
    ctx.lineWidth = 3;
    const k_sys = (H_design - H_static) / Math.pow(Q_design, 2);
    for (let q = 0; q <= maxQ; q += maxQ / 50) {
        // H_sys(Q) = H_static + k * Q^2
        const h = H_static + k_sys * Math.pow(q, 2);
        if (q === 0) ctx.moveTo(getX(q), getY(h));
        else ctx.lineTo(getX(q), getY(h));
    }
    ctx.stroke();
    
    // Operating Point (Intersection)
    const opX = getX(Q_design);
    const opY = getY(H_design);
    
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.moveTo(opX, height - padding); ctx.lineTo(opX, opY);
    ctx.moveTo(padding, opY); ctx.lineTo(opX, opY);
    ctx.stroke();
    ctx.setLineDash([]);
    
    ctx.beginPath();
    ctx.arc(opX, opY, 6, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.stroke();
}

/* ═══════════════════════════════════════════════════════════════
   HEAT EXCHANGER — SUB-TAB TOGGLE (DPHE / STHE)
   ═══════════════════════════════════════════════════════════════ */
document.querySelectorAll('.hex-subtab').forEach(function(btn) {
    btn.addEventListener('click', function() {
        document.querySelectorAll('.hex-subtab').forEach(function(b){ b.classList.remove('active'); });
        btn.classList.add('active');
        var target = btn.getAttribute('data-subtab');
        document.getElementById('dphe-sub').style.display = target === 'dphe-sub' ? 'block' : 'none';
        document.getElementById('sthe-sub').style.display = target === 'sthe-sub' ? 'block' : 'none';
        // Lazy-init / resize the 3D scenes once their container becomes visible
        setTimeout(function() {
            if (target === 'sthe-sub') {
                var sc = document.getElementById('sthe-3d-container');
                if (sc && sc.clientWidth > 0) {
                    if (!sthe3D.initialized) { try { initSTHE3D(sc); } catch(e) { console.error(e); } }
                    else if (sthe3D.renderer) {
                        sthe3D.camera.aspect = sc.clientWidth / sc.clientHeight;
                        sthe3D.camera.updateProjectionMatrix();
                        sthe3D.renderer.setSize(sc.clientWidth, sc.clientHeight);
                    }
                }
            } else if (target === 'dphe-sub') {
                var dc = document.getElementById('dphe-3d-container');
                if (dc && dc.clientWidth > 0) {
                    if (!dphe3D.initialized) { try { initDPHE3D(dc); } catch(e) { console.error(e); } }
                    else if (dphe3D.renderer) {
                        dphe3D.camera.aspect = dc.clientWidth / dc.clientHeight;
                        dphe3D.camera.updateProjectionMatrix();
                        dphe3D.renderer.setSize(dc.clientWidth, dc.clientHeight);
                    }
                }
            }
        }, 120);
    });
});

/* ═══════════════════════════════════════════════════════════════
   DPHE FLUID PROPERTY LIBRARY
   ═══════════════════════════════════════════════════════════════ */
var DPHE_FLUIDS = {
  'water':              { name:'Water',               rho:997,  mu:0.89,  cp:4.18,  k:0.607 },
  'seawater':           { name:'Seawater',            rho:1025, mu:1.08,  cp:3.93,  k:0.596 },
  'ethylene-glycol-50': { name:'Ethylene Glycol 50%', rho:1082, mu:3.5,   cp:3.27,  k:0.385 },
  'propylene-glycol-50':{ name:'Propylene Glycol 50%',rho:1043, mu:5.3,   cp:3.55,  k:0.358 },
  'therminol-66':       { name:'Therminol 66',        rho:1005, mu:3.14,  cp:1.63,  k:0.118 },
  'therminol-vp1':      { name:'Therminol VP-1',      rho:1060, mu:2.88,  cp:1.56,  k:0.136 },
  'dowtherm-a':         { name:'Dowtherm A',          rho:1056, mu:3.71,  cp:1.58,  k:0.138 },
  'hot-oil':            { name:'Hot Oil (Mineral)',    rho:850,  mu:12.0,  cp:2.09,  k:0.131 },
  'kerosene':           { name:'Kerosene',            rho:780,  mu:1.64,  cp:2.01,  k:0.145 },
  'diesel':             { name:'Diesel',              rho:832,  mu:3.0,   cp:1.88,  k:0.140 },
  'gasoline':           { name:'Gasoline',            rho:720,  mu:0.56,  cp:2.22,  k:0.120 },
  'methanol':           { name:'Methanol',            rho:791,  mu:0.59,  cp:2.53,  k:0.200 },
  'ethanol':            { name:'Ethanol',             rho:789,  mu:1.20,  cp:2.44,  k:0.171 },
  'toluene':            { name:'Toluene',             rho:867,  mu:0.59,  cp:1.67,  k:0.131 },
  'benzene':            { name:'Benzene',             rho:879,  mu:0.65,  cp:1.74,  k:0.145 },
  'acetone':            { name:'Acetone',             rho:784,  mu:0.32,  cp:2.15,  k:0.161 },
  'hexane':             { name:'n-Hexane',            rho:655,  mu:0.30,  cp:2.27,  k:0.124 },
  'heptane':            { name:'n-Heptane',           rho:684,  mu:0.39,  cp:2.24,  k:0.128 },
  'crude-oil-light':    { name:'Crude Oil (Light)',   rho:825,  mu:5.0,   cp:1.88,  k:0.132 },
  'crude-oil-heavy':    { name:'Crude Oil (Heavy)',   rho:930,  mu:50.0,  cp:1.67,  k:0.125 },
  'naphtha':            { name:'Naphtha',             rho:740,  mu:0.65,  cp:2.14,  k:0.130 },
  'styrene':            { name:'Styrene',             rho:906,  mu:0.76,  cp:1.73,  k:0.137 },
  'acetic-acid':        { name:'Acetic Acid',         rho:1049, mu:1.22,  cp:2.05,  k:0.171 },
  'sulfuric-acid-98':   { name:'Sulfuric Acid 98%',   rho:1831, mu:26.7,  cp:1.38,  k:0.355 },
  'caustic-soda-50':    { name:'NaOH 50%',            rho:1525, mu:12.0,  cp:2.56,  k:0.600 },
  'ammonia-liquid':     { name:'Ammonia (Liquid)',     rho:603,  mu:0.13,  cp:4.74,  k:0.493 },
  'r134a':              { name:'R-134a (Liquid)',      rho:1206, mu:0.20,  cp:1.43,  k:0.082 },
  'steam-lp':           { name:'Steam (LP, 2 bar)',   rho:1.13, mu:0.013, cp:1.97,  k:0.025 },
  'air':                { name:'Air (1 atm)',         rho:1.18, mu:0.018, cp:1.005, k:0.026 },
  'nitrogen':           { name:'Nitrogen (gas)',      rho:1.14, mu:0.018, cp:1.04,  k:0.026 }
};

var DPHE_STD_PIPES = [
  { nps:'1/2"', od:21.3,  id:15.8,  sch:'40' },
  { nps:'3/4"', od:26.7,  id:20.9,  sch:'40' },
  { nps:'1"',   od:33.4,  id:26.6,  sch:'40' },
  { nps:'1-1/4"',od:42.2, id:35.1,  sch:'40' },
  { nps:'1-1/2"',od:48.3, id:40.9,  sch:'40' },
  { nps:'2"',   od:60.3,  id:52.5,  sch:'40' },
  { nps:'2-1/2"',od:73.0, id:62.7,  sch:'40' },
  { nps:'3"',   od:88.9,  id:77.9,  sch:'40' },
  { nps:'4"',   od:114.3, id:102.3, sch:'40' },
  { nps:'6"',   od:168.3, id:154.1, sch:'40' },
  { nps:'8"',   od:219.1, id:202.7, sch:'40' },
  { nps:'10"',  od:273.1, id:254.5, sch:'40' },
  { nps:'12"',  od:323.9, id:303.2, sch:'40' }
];

var DPHE_STD_LENGTHS = [1.5, 2.0, 2.5, 3.0, 3.66, 4.0, 4.5, 5.0, 6.0, 6.1, 7.32, 9.14, 12.0];

var DPHE_MATERIALS = {
  'CS':           { name:'Carbon Steel',    kw:50,   fouling:0.0002 },
  'SS304':        { name:'SS 304',          kw:16.2, fouling:0.0001 },
  'SS316':        { name:'SS 316',          kw:16.3, fouling:0.0001 },
  'SS316L':       { name:'SS 316L',         kw:16.3, fouling:0.0001 },
  'Copper':       { name:'Copper',          kw:385,  fouling:0.0001 },
  'CuNi-90/10':   { name:'Cu-Ni 90/10',    kw:45,   fouling:0.00015 },
  'CuNi-70/30':   { name:'Cu-Ni 70/30',    kw:29,   fouling:0.00015 },
  'Titanium':     { name:'Titanium Gr.2',   kw:21.9, fouling:0.0001 },
  'Inconel-625':  { name:'Inconel 625',     kw:9.8,  fouling:0.0001 },
  'Hastelloy-C276':{ name:'Hastelloy C-276',kw:10.2, fouling:0.0001 },
  'Duplex-2205':  { name:'Duplex 2205',     kw:19,   fouling:0.0001 },
  'Monel-400':    { name:'Monel 400',       kw:21.8, fouling:0.00015 }
};

var DPHE_COMMON_CONFIGS = [
  { label:'1" inner / 2" outer (Standard)', innerNps:'1"', outerNps:'2"', innerIdx:2, outerIdx:5 },
  { label:'3/4" inner / 1-1/2" outer', innerNps:'3/4"', outerNps:'1-1/2"', innerIdx:1, outerIdx:4 },
  { label:'1-1/4" inner / 2" outer', innerNps:'1-1/4"', outerNps:'2"', innerIdx:3, outerIdx:5 },
  { label:'1-1/2" inner / 2-1/2" outer', innerNps:'1-1/2"', outerNps:'2-1/2"', innerIdx:4, outerIdx:6 },
  { label:'2" inner / 3" outer', innerNps:'2"', outerNps:'3"', innerIdx:5, outerIdx:7 },
  { label:'2-1/2" inner / 4" outer', innerNps:'2-1/2"', outerNps:'4"', innerIdx:6, outerIdx:8 },
  { label:'3" inner / 4" outer', innerNps:'3"', outerNps:'4"', innerIdx:7, outerIdx:8 },
  { label:'4" inner / 6" outer', innerNps:'4"', outerNps:'6"', innerIdx:8, outerIdx:9 },
  { label:'6" inner / 8" outer', innerNps:'6"', outerNps:'8"', innerIdx:9, outerIdx:10 }
];

window.dpheFluidSelect = function(side) {
  var selId = side === 'hot' ? 'dphe-fluid-hot-select' : 'dphe-fluid-cold-select';
  var sel = document.getElementById(selId);
  if (!sel) return;
  var key = sel.value;
  var f = DPHE_FLUIDS[key];
  if (!f) return;
  var s = side === 'hot' ? 'hot' : 'cold';
  var nameEl = document.getElementById('dphe-fluid-' + s);
  if (nameEl) nameEl.value = f.name;
  var rhoEl = document.getElementById('dphe-rho-' + s);
  if (rhoEl) rhoEl.value = f.rho;
  var muEl = document.getElementById('dphe-mu-' + s);
  if (muEl) muEl.value = f.mu;
  var cpEl = document.getElementById('dphe-cp-' + s);
  if (cpEl) cpEl.value = f.cp;
  var kEl = document.getElementById('dphe-k-' + s);
  if (kEl) kEl.value = f.k;
};

window.dpheMatSelect = function(side) {
  var selId = side === 'hot' ? 'dphe-mat-hot' : 'dphe-mat-cold';
  var sel = document.getElementById(selId);
  if (!sel) return;
  var mat = DPHE_MATERIALS[sel.value];
  if (!mat) return;
  var rdiEl = document.getElementById('dphe-rdi');
  var rdoEl = document.getElementById('dphe-rdo');
  var kwEl = document.getElementById('dphe-kw');
  if (side === 'hot') {
    if (rdiEl) rdiEl.value = mat.fouling;
    if (kwEl) kwEl.value = mat.kw;
  } else {
    if (rdoEl) rdoEl.value = mat.fouling;
  }
};

window.dpheInnerPipeSelect = function() {
  var sel = document.getElementById('dphe-inner-pipe-select');
  if (!sel || sel.value === '') return;
  var p = DPHE_STD_PIPES[parseInt(sel.value)];
  if (!p) return;
  document.getElementById('dphe-di').value = (p.id / 1000).toFixed(4);
  document.getElementById('dphe-do').value = (p.od / 1000).toFixed(4);
};

window.dpheOuterPipeSelect = function() {
  var sel = document.getElementById('dphe-outer-pipe-select');
  if (!sel || sel.value === '') return;
  var p = DPHE_STD_PIPES[parseInt(sel.value)];
  if (!p) return;
  document.getElementById('dphe-d2').value = (p.id / 1000).toFixed(4);
};

window.dphePipeConfigSelect = function() {
  var sel = document.getElementById('dphe-pipe-config');
  if (!sel || sel.value === '') return;
  var idx = parseInt(sel.value);
  var cfg = DPHE_COMMON_CONFIGS[idx];
  if (!cfg) return;
  var ip = DPHE_STD_PIPES[cfg.innerIdx];
  var op = DPHE_STD_PIPES[cfg.outerIdx];
  document.getElementById('dphe-di').value = (ip.id / 1000).toFixed(4);
  document.getElementById('dphe-do').value = (ip.od / 1000).toFixed(4);
  document.getElementById('dphe-d2').value = (op.id / 1000).toFixed(4);
  var innerSel = document.getElementById('dphe-inner-pipe-select');
  var outerSel = document.getElementById('dphe-outer-pipe-select');
  if (innerSel) innerSel.value = cfg.innerIdx;
  if (outerSel) outerSel.value = cfg.outerIdx;
};

window.dpheLengthSelect = function() {
  var sel = document.getElementById('dphe-length-select');
  if (!sel || sel.value === '') return;
  document.getElementById('dphe-length').value = sel.value;
};

window.dpheHairpinSelect = function() {
  var sel = document.getElementById('dphe-hairpin-select');
  if (!sel || sel.value === '') return;
  document.getElementById('dphe-hairpins').value = sel.value;
};

// --- DPHE Chatbot Interface ---
window.dpheShowChatbot = function() {
  var panel = document.getElementById('dphe-chatbot');
  var msgDiv = document.getElementById('dphe-chat-messages');
  if (panel.style.display === 'none') {
    panel.style.display = 'block';
    if (msgDiv.innerHTML === '') {
      msgDiv.innerHTML = '<div style="color:#a0aec0;"><strong>Welcome to DPHE Design Assistant!</strong><br/>I can help explain:<br/>• Heat transfer calculations and correlations<br/>• ASME B36.10 pipe standards<br/>• Pressure drop limits and fouling factors<br/>• Flow arrangement comparisons<br/>• Design recommendations<br/><br/>💡 Ask me anything about your design!</div>';
    }
  } else {
    panel.style.display = 'none';
  }
};

window.dpheChatSend = function() {
  var input = document.getElementById('dphe-chat-input');
  var msgDiv = document.getElementById('dphe-chat-messages');
  var query = input.value.trim().toLowerCase();
  if (!query) return;

  // Add user message
  msgDiv.innerHTML += '<div style="margin:4px 0; text-align:right; color:#22c55e;"><strong>You:</strong> ' + input.value + '</div>';

  // Simple chatbot responses based on keywords
  var response = 'I understand your question. ';
  if (query.includes('pressure') || query.includes('drop') || query.includes('dp')) {
    response += 'Pressure drop is calculated using Darcy-Weisbach equation with Kern friction factor (f = 0.0035 + 0.264*Re^-0.42). High pressure drop (>100 kPa) increases pumping power cost. Reduce by: using larger pipes, fewer hairpins, or lower flow rates.';
  } else if (query.includes('counter') || query.includes('concurrent') || query.includes('flow')) {
    response += 'Counter-current flow provides better temperature approach and higher effectiveness. It\'s preferred in DPHE designs. Concurrent flow is simpler but less efficient—used only when space is extremely limited.';
  } else if (query.includes('reynolds') || query.includes('turbulence') || query.includes('laminar')) {
    response += 'Reynolds number indicates flow regime. Re > 10000 = turbulent (good heat transfer), Re 2300-10000 = transitional, Re < 2300 = laminar (poor heat transfer). Increase flow or reduce pipe diameter to improve Re and effectiveness.';
  } else if (query.includes('nusselt') || query.includes('correlation') || query.includes('dittus')) {
    response += 'Nusselt number (Nu) represents convective heat transfer. We use Dittus-Boelert correlation: Nu = 0.023 * Re^0.8 * Pr^n (n=0.33 for cooling, 0.4 for heating). Higher Nu means better heat transfer coefficient (h).';
  } else if (query.includes('area') || query.includes('hairpin') || query.includes('sizing')) {
    response += 'Required area = Q / (U * LMTD). Each hairpin provides area = π * OD * 2 * L. Design excess area should be 10-30% (ASME standard) to account for fouling and ensure safe operation margin.';
  } else if (query.includes('fouling') || query.includes('dirty') || query.includes('clean')) {
    response += 'Fouling resistance accounts for deposits on pipes reducing performance. Clean (Uc) ignores fouling; Dirty (Ud) includes fouling (Rdi + Rdo). Fouling factors depend on fluid type—oil ~0.0002, water ~0.0001 m²·K/W. Design using Ud for safety.';
  } else if (query.includes('material') || query.includes('carbon') || query.includes('steel')) {
    response += 'Pipe materials affect cost and corrosion resistance. Carbon Steel (CS) is economical for general duty. Wall conductivity (kw) typically 50 W/m·°C for steel. Use materials per ASME B36.10 standard.';
  } else if (query.includes('nozzle') || query.includes('velocity')) {
    response += 'Nozzle sizing is critical. Recommended velocities: Tube 2.5-3.5 m/s, Annulus 2.0-2.5 m/s (per ASME B16.5). Low velocity wastes pipe size; high velocity causes erosion and pressure drop. Use standard NPS sizes.';
  } else if (query.includes('recommendation') || query.includes('suggest')) {
    response += 'Review the AUTO-UPGRADE SUGGESTIONS panel for design recommendations. Each suggestion includes detailed reasoning (click to expand). Follow ASME B36.10 & TEMA standards for optimal, cost-effective design.';
  } else {
    response += 'I\'m a DPHE design assistant trained on ASME B36.10 and industry best practices. Ask me about: heat transfer, pressure drop, Reynolds/Prandtl/Nusselt numbers, pipe sizing, fouling, flow arrangements, or design standards!';
  }

  msgDiv.innerHTML += '<div style="margin:4px 0; color:#60a5fa;"><strong>Assistant:</strong> ' + response + '</div>';
  msgDiv.scrollTop = msgDiv.scrollHeight;
  input.value = '';
};

// --- DPHE Flow Comparison ---
window.dpheFlowComparison = function() {
  var panel = document.getElementById('dphe-flow-compare');
  var content = document.getElementById('dphe-flow-compare-content');

  if (!window.dpheFlowAnalysis) {
    content.innerHTML = '<div style="color:#ef4444;">Run calculation first to see flow comparison.</div>';
    panel.style.display = 'block';
    return;
  }

  var cc = window.dpheFlowAnalysis.counterCurrent;
  var conc = window.dpheFlowAnalysis.concurrent;

  var better = cc.effectiveness > conc.effectiveness ? '✓ Counter-Current' : '✓ Concurrent';
  var diff = Math.abs(cc.effectiveness - conc.effectiveness) * 100;

  var html = '<div style="margin-bottom:8px;padding:6px;background:rgba(236,72,153,0.15);border-radius:4px;font-size:10px;font-weight:700;color:#f9a8d4;">' +
    '📖 Counter-Current = Fluids flow in OPPOSITE directions (most efficient)<br/>' +
    '📖 Concurrent (Co-Current) = Fluids flow in SAME direction (less efficient)</div>' +
    '<table style="width:100%; border-collapse:collapse; font-size:10px;">' +
    '<tr style="border-bottom:2px solid rgba(236,72,153,0.4);background:rgba(236,72,153,0.1);"><th style="text-align:left; padding:6px;">Parameter</th><th style="text-align:center; padding:6px;">⇆ Counter-Current</th><th style="text-align:center; padding:6px;">⇉ Concurrent</th><th style="text-align:center; padding:6px;">Winner</th></tr>' +
    '<tr><td style="padding:6px;">Effectiveness (ε)</td><td style="text-align:center; padding:6px;color:#22c55e;">' + cc.effectiveness.toFixed(4) + '</td><td style="text-align:center; padding:6px;color:#f59e0b;">' + conc.effectiveness.toFixed(4) + '</td><td style="text-align:center; padding:6px;font-weight:700;">' + (cc.effectiveness > conc.effectiveness ? '✓ Counter-Current' : '✓ Concurrent') + '</td></tr>' +
    '<tr style="border-bottom:1px solid rgba(236,72,153,0.2);"><td style="padding:6px;">LMTD (°C)</td><td style="text-align:center; padding:6px;color:#22c55e;">' + cc.LMTD.toFixed(2) + '</td><td style="text-align:center; padding:6px;color:#f59e0b;">' + conc.LMTD.toFixed(2) + '</td><td style="text-align:center; padding:6px;font-weight:700;">' + (cc.LMTD > conc.LMTD ? '✓ Counter-Current' : '✓ Concurrent') + '</td></tr>' +
    '</table>' +
    '<div style="margin-top:8px; padding:8px; background:rgba(236,72,153,0.1); border-radius:4px;">' +
    '<strong>🏆 Recommendation:</strong> ' + better + ' is ' + diff.toFixed(1) + '% more effective.<br/><br/>' +
    '<strong>⇆ Counter-Current Flow:</strong> Hot & cold fluids flow in opposite directions. Provides better temperature driving force (higher LMTD), higher effectiveness, and is the ASME standard recommendation for industrial DPHE.<br/><br/>' +
    '<strong>⇉ Concurrent (Co-Current) Flow:</strong> Both fluids enter from same end and flow in same direction. Simpler piping but limited by outlet temperature crossover. Used only when thermal stress control is needed.<br/><br/>' +
    '<em>Industry Standard: Counter-current is preferred for 95%+ of DPHE applications.</em>' +
    '</div>';

  content.innerHTML = html;
  panel.style.display = 'block';
};

// DPHE Smart Calc Mode — lock/unlock fields based on what user wants to calculate
window.dpheCalcModeChange = function() {
  var mode = document.getElementById('dphe-calc-mode')?.value || 'calc-tout-hot';
  var fields = {
    'calc-flow-hot':  { id:'dphe-flow-hot',  tag:'dphe-flow-hot-tag' },
    'calc-flow-cold': { id:'dphe-flow-cold', tag:'dphe-flow-cold-tag' },
    'calc-tout-hot':  { id:'dphe-tout-hot',  tag:'dphe-tout-hot-tag' },
    'calc-tout-cold': { id:'dphe-tout-cold', tag:'dphe-tout-cold-tag' },
    'calc-tin-hot':   { id:'dphe-tin-hot',   tag:'dphe-tin-hot-tag' },
    'calc-tin-cold':  { id:'dphe-tin-cold',  tag:'dphe-tin-cold-tag' }
  };
  // Reset all
  Object.keys(fields).forEach(function(k) {
    var f = fields[k];
    var el = document.getElementById(f.id);
    var tg = document.getElementById(f.tag);
    if (el) { el.style.color = ''; el.style.background = ''; el.readOnly = false; el.style.opacity = '1'; }
    if (tg) tg.innerHTML = '';
  });
  // Mark the calculated field
  var sel = fields[mode];
  if (sel) {
    var el = document.getElementById(sel.id);
    var tg = document.getElementById(sel.tag);
    if (el) { el.style.color = '#4ade80'; el.style.background = 'rgba(34,197,94,0.08)'; el.readOnly = true; el.style.opacity = '0.8'; }
    if (tg) tg.innerHTML = '<span style="color:#4ade80;">⚡ AUTO-CALCULATED</span>';
  }
};

window.dpheApplyAutoUpgrade = function() {
  var d = window.dpheRecommended;
  if (!d) return;
  if (d.innerIdx !== undefined) {
    var ip = DPHE_STD_PIPES[d.innerIdx];
    document.getElementById('dphe-di').value = (ip.id / 1000).toFixed(4);
    document.getElementById('dphe-do').value = (ip.od / 1000).toFixed(4);
    var innerSel = document.getElementById('dphe-inner-pipe-select');
    if (innerSel) innerSel.value = d.innerIdx;
  }
  if (d.outerIdx !== undefined) {
    var op = DPHE_STD_PIPES[d.outerIdx];
    document.getElementById('dphe-d2').value = (op.id / 1000).toFixed(4);
    var outerSel = document.getElementById('dphe-outer-pipe-select');
    if (outerSel) outerSel.value = d.outerIdx;
  }
  if (d.length !== undefined) {
    document.getElementById('dphe-length').value = d.length;
    var lSel = document.getElementById('dphe-length-select');
    if (lSel) { for (var i = 0; i < lSel.options.length; i++) { if (parseFloat(lSel.options[i].value) === d.length) { lSel.selectedIndex = i; break; } } }
  }
  if (d.hairpins !== undefined) {
    document.getElementById('dphe-hairpins').value = d.hairpins;
    var hSel = document.getElementById('dphe-hairpin-select');
    if (hSel) { for (var i = 0; i < hSel.options.length; i++) { if (parseInt(hSel.options[i].value) === d.hairpins) { hSel.selectedIndex = i; break; } } }
  }
  var form = document.getElementById('dphe-form');
  if (form) form.dispatchEvent(new Event('submit'));
};

function dpheGetStdLength(L) {
  for (var i = 0; i < DPHE_STD_LENGTHS.length; i++) {
    if (DPHE_STD_LENGTHS[i] >= L) return DPHE_STD_LENGTHS[i];
  }
  return DPHE_STD_LENGTHS[DPHE_STD_LENGTHS.length - 1];
}

function dpheGetStdPipe(idMm, type) {
  if (type === 'inner') {
    for (var i = 0; i < DPHE_STD_PIPES.length; i++) {
      if (DPHE_STD_PIPES[i].id >= idMm) return DPHE_STD_PIPES[i];
    }
  } else {
    for (var i = 0; i < DPHE_STD_PIPES.length; i++) {
      if (DPHE_STD_PIPES[i].id >= idMm) return DPHE_STD_PIPES[i];
    }
  }
  return DPHE_STD_PIPES[DPHE_STD_PIPES.length - 1];
}

/* ═══════════════════════════════════════════════════════════════
   DPHE — DOUBLE PIPE HEAT EXCHANGER CALCULATION ENGINE
   Kern method: Dittus-Boelter correlation, counter-current LMTD
   ═══════════════════════════════════════════════════════════════ */
(function() {
    var form = document.getElementById('dphe-form');
    if (!form) return;

    function v(id) { return parseFloat(document.getElementById(id).value) || 0; }
    function fmt(n, d) { return isFinite(n) ? n.toFixed(d === undefined ? 2 : d) : '-'; }

    form.querySelectorAll('input, select').forEach(function(el) {
        el.addEventListener('input', function() { debouncedPushUndo('dphe', '#dphe-form'); });
        el.addEventListener('change', function() { debouncedPushUndo('dphe', '#dphe-form'); });
    });

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        window.showCalcFeedback(form);

        // --- Inputs (always read as SI) ---
        var gsi = window.getInputValueSI || v;
        var mc  = gsi('dphe-flow-cold'),  mh  = gsi('dphe-flow-hot');
        var Tci = gsi('dphe-tin-cold'),    Tco = gsi('dphe-tout-cold');
        var Thi = gsi('dphe-tin-hot'),     Tho_user = gsi('dphe-tout-hot');
        var Cpc = gsi('dphe-cp-cold'),     Cph = gsi('dphe-cp-hot');       // kJ/kg·K
        var kc  = gsi('dphe-k-cold'),      kh  = gsi('dphe-k-hot');        // W/m·°C
        var rhoc = gsi('dphe-rho-cold'),   rhoh = gsi('dphe-rho-hot');     // kg/m³
        var muc = gsi('dphe-mu-cold'),     muh = gsi('dphe-mu-hot');       // cP (viscosity type is identity)
        var Di  = gsi('dphe-di'),  Do = gsi('dphe-do'),  D2 = gsi('dphe-d2');
        var L   = gsi('dphe-length'),  nHairpins = v('dphe-hairpins');
        var Rdi = gsi('dphe-rdi'),  Rdo = gsi('dphe-rdo'),  kw = gsi('dphe-kw');

        // Convert cP (mPa·s) to Pa·s
        var mu_h = muh / 1000;
        var mu_c = muc / 1000;
        // Convert Cp from kJ/kg·K to J/kg·K for Prandtl
        var Cph_J = Cph * 1000;
        var Cpc_J = Cpc * 1000;

        // --- Smart Calc Mode: solve for the selected unknown variable ---
        var dpheCalcMode = document.getElementById('dphe-calc-mode')?.value || 'calc-tout-hot';
        var Q, Tho;

        if (dpheCalcMode === 'calc-flow-hot' && mc > 0 && Cpc > 0 && Cph > 0 && Math.abs(Thi - Tho_user) > 0.001) {
          Q = mc * Cpc * (Tco - Tci);
          mh = Q / (Cph * Math.abs(Thi - Tho_user));
          Tho = Tho_user;
          var el = document.getElementById('dphe-flow-hot'); if(el) el.value = mh.toFixed(4);
        } else if (dpheCalcMode === 'calc-flow-cold' && mh > 0 && Cph > 0 && Cpc > 0 && Math.abs(Tco - Tci) > 0.001) {
          Q = mh * Cph * Math.abs(Thi - Tho_user);
          mc = Q / (Cpc * Math.abs(Tco - Tci));
          Tho = Tho_user;
          var el = document.getElementById('dphe-flow-cold'); if(el) el.value = mc.toFixed(4);
        } else if (dpheCalcMode === 'calc-tout-cold' && mc > 0 && Cpc > 0 && mh > 0 && Cph > 0) {
          Q = mh * Cph * Math.abs(Thi - Tho_user);
          Tco = Tci + Q / (mc * Cpc);
          Tho = Tho_user;
          var el = document.getElementById('dphe-tout-cold'); if(el) el.value = Tco.toFixed(2);
        } else if (dpheCalcMode === 'calc-tin-hot' && mc > 0 && Cpc > 0 && mh > 0 && Cph > 0) {
          Q = mc * Cpc * (Tco - Tci);
          Thi = Tho_user + Q / (mh * Cph);
          Tho = Tho_user;
          var el = document.getElementById('dphe-tin-hot'); if(el) el.value = Thi.toFixed(2);
        } else if (dpheCalcMode === 'calc-tin-cold' && mc > 0 && Cpc > 0 && mh > 0 && Cph > 0) {
          Q = mh * Cph * Math.abs(Thi - Tho_user);
          Tci = Tco - Q / (mc * Cpc);
          Tho = Tho_user;
          var el = document.getElementById('dphe-tin-cold'); if(el) el.value = Tci.toFixed(2);
        } else {
          // Default: calc-tout-hot (original behavior)
          Q = mc * Cpc * (Tco - Tci);
          Tho = (mh > 0 && Cph > 0) ? Thi - Q / (mh * Cph) : Tho_user;
          var el = document.getElementById('dphe-tout-hot'); if(el) el.value = Tho.toFixed(2);
        }

        // --- LMTD (counter-current) ---
        var dT1_cc = Thi - Tco;
        var dT2_cc = Tho - Tci;
        var LMTD_cc;
        if (Math.abs(dT1_cc - dT2_cc) < 0.01) {
            LMTD_cc = dT1_cc;
        } else {
            LMTD_cc = (dT1_cc - dT2_cc) / Math.log(dT1_cc / dT2_cc);
        }
        var LMTD = LMTD_cc;  // Use counter-current as default

        // --- LMTD (concurrent) ---
        // For concurrent: dT1 = Thi - Tci, dT2 = Tho - Tco
        var dT1_conc = Thi - Tci;
        var dT2_conc = Tho - Tco;
        var LMTD_conc;
        if (Math.abs(dT1_conc - dT2_conc) < 0.01) {
            LMTD_conc = dT1_conc;
        } else {
            LMTD_conc = (dT1_conc - dT2_conc) / Math.log(dT1_conc / dT2_conc);
        }

        // --- Effectiveness (ε) for both arrangements ---
        var Cmin = Math.min(mh * Cph, mc * Cpc);
        var Cmax = Math.max(mh * Cph, mc * Cpc);
        var effectiveness = (Cmin > 0) ? Q / (Cmin * (Thi - Tci)) : 0;

        // Counter-current NTU (theoretical)
        var NTU_max = effectiveness > 0.999 ? 999 : -Math.log(1 - effectiveness) / (1 + Cmin / Cmax);

        // Concurrent NTU (C_ratio = Cmin/Cmax)
        var C_ratio = (Cmax > 0) ? Cmin / Cmax : 1;
        var effectiveness_conc = 0;
        if (C_ratio < 0.9999) {
            effectiveness_conc = (1 - Math.exp(-NTU_max * (1 + C_ratio))) / (1 + C_ratio);
        } else {
            effectiveness_conc = NTU_max / (1 + NTU_max);
        }

        // Store both results for comparison
        window.dpheFlowAnalysis = {
            counterCurrent: { LMTD: LMTD_cc, effectiveness: effectiveness },
            concurrent: { LMTD: LMTD_conc, effectiveness: effectiveness_conc }
        };

        // --- Flow areas ---
        var At = Math.PI / 4 * Di * Di;                  // inner pipe
        var Aa = Math.PI / 4 * (D2 * D2 - Do * Do);     // annulus

        // --- Equivalent diameter for annulus (Kern) ---
        var De = (D2 * D2 - Do * Do) / Do;

        // --- Mass velocity ---
        var Gt = (At > 0) ? mh / At : 0;   // hot in inner pipe
        var Ga = (Aa > 0) ? mc / Aa : 0;   // cold in annulus

        // --- Reynolds ---
        var Re_t = (mu_h > 0) ? Gt * Di / mu_h : 0;
        var Re_a = (mu_c > 0) ? Ga * De / mu_c : 0;

        // --- Prandtl ---
        var Pr_h = (kh > 0) ? Cph_J * mu_h / kh : 0;
        var Pr_c = (kc > 0) ? Cpc_J * mu_c / kc : 0;

        // --- Nusselt (Dittus-Boelter) ---
        // heating: n=0.4, cooling: n=0.3
        var Nu_h = 0.023 * Math.pow(Re_t, 0.8) * Math.pow(Pr_h, 0.33);
        var Nu_c = 0.023 * Math.pow(Re_a, 0.8) * Math.pow(Pr_c, 0.33);

        // --- Film coefficients ---
        var hi = (Di > 0) ? Nu_h * kh / Di : 0;
        var ho = (De > 0) ? Nu_c * kc / De : 0;

        // --- Corrected to OD ---
        var hio = (Do > 0) ? hi * Di / Do : 0;

        // --- Wall resistance (cylindrical wall) ---
        var Rw = (kw > 0 && Do > 0 && Di > 0) ? (Do / (2 * kw)) * Math.log(Do / Di) : 0;

        // --- Overall U (dirty) ---
        var denom_Ud = 0;
        if (hio > 0) denom_Ud += 1 / hio;
        if (ho > 0)  denom_Ud += 1 / ho;
        denom_Ud += Rdi + Rdo + Rw;
        var Ud = (denom_Ud > 0) ? 1 / denom_Ud : 0;

        // --- Overall U (clean, no fouling) ---
        var denom_Uc = 0;
        if (hio > 0) denom_Uc += 1 / hio;
        if (ho > 0)  denom_Uc += 1 / ho;
        denom_Uc += Rw;
        var Uc = (denom_Uc > 0) ? 1 / denom_Uc : 0;

        // --- Area ---
        var Q_W = Q * 1000;  // kW to W
        var Areq = (Ud > 0 && LMTD > 0) ? Q_W / (Ud * LMTD) : 0;

        // Area per hairpin: outer surface of inner pipe, both legs
        var Ahairpin = Math.PI * Do * 2 * L;
        var hairpinsCalc = (Ahairpin > 0) ? Areq / Ahairpin : 0;
        var hairpinsDesign = Math.ceil(hairpinsCalc);
        if (hairpinsDesign < 1) hairpinsDesign = 1;

        var Aavail = hairpinsDesign * Ahairpin;
        var excessArea = (Areq > 0) ? ((Aavail - Areq) / Areq) * 100 : 0;

        // --- Pressure Drop (Darcy-Weisbach simplified) ---
        var Ltotal = hairpinsDesign * 2 * L;
        // Friction factor: f = 0.0035 + 0.264 * Re^-0.42 (Kern / modified Blasius)
        var f_t = (Re_t > 0) ? 0.0035 + 0.264 * Math.pow(Re_t, -0.42) : 0;
        var f_a = (Re_a > 0) ? 0.0035 + 0.264 * Math.pow(Re_a, -0.42) : 0;

        var dP_inner = (rhoh > 0 && Di > 0) ? 4 * f_t * Ltotal * Gt * Gt / (2 * rhoh * Di) : 0;
        var dP_annulus = (rhoc > 0 && De > 0) ? 4 * f_a * Ltotal * Ga * Ga / (2 * rhoc * De) : 0;
        // Convert Pa to kPa
        dP_inner /= 1000;
        dP_annulus /= 1000;

        // --- Populate output fields (unit-aware) ---
        var sov = window.setOutputValue || function(id, val, type, dec) { document.getElementById(id).textContent = fmt(val, dec); };
        sov('dphe-out-heat-duty', Q, 'heat-duty', 2);
        sov('dphe-out-lmtd', LMTD, 'temp-diff', 2);
        sov('dphe-out-hot-tout', Tho, 'temperature', 2);
        sov('dphe-out-hio', hio, 'htc', 1);
        sov('dphe-out-ho', ho, 'htc', 1);
        sov('dphe-out-ud', Ud, 'htc', 2);
        sov('dphe-out-uc', Uc, 'htc', 2);
        sov('dphe-out-area-req', Areq, 'area', 4);
        sov('dphe-out-area-avail', Aavail, 'area', 4);
        document.getElementById('dphe-out-hairpins-calc').textContent  = fmt(hairpinsCalc, 2);
        document.getElementById('dphe-out-hairpins-design').textContent = hairpinsDesign;
        document.getElementById('dphe-out-excess-area').textContent = fmt(excessArea, 1) + ' %';
        sov('dphe-out-dp-inner', dP_inner, 'press-drop-kpa', 3);
        sov('dphe-out-dp-annulus', dP_annulus, 'press-drop-kpa', 3);

        // Detailed tube side
        var el;
        el = document.getElementById('dphe-out-re-tube'); if (el) el.textContent = fmt(Re_t, 0);
        el = document.getElementById('dphe-out-pr-tube'); if (el) el.textContent = fmt(Pr_h, 2);
        el = document.getElementById('dphe-out-nu-tube'); if (el) el.textContent = fmt(Nu_h, 2);
        el = document.getElementById('dphe-out-f-tube');  if (el) el.textContent = fmt(f_t, 6);
        // Detailed annulus side
        el = document.getElementById('dphe-out-re-ann'); if (el) el.textContent = fmt(Re_a, 0);
        el = document.getElementById('dphe-out-pr-ann'); if (el) el.textContent = fmt(Pr_c, 2);
        el = document.getElementById('dphe-out-nu-ann'); if (el) el.textContent = fmt(Nu_c, 2);
        el = document.getElementById('dphe-out-f-ann');  if (el) el.textContent = fmt(f_a, 6);

        // Show results panel
        document.getElementById('dphe-results').style.display = 'block';

        // --- Standard pipe lookup ---
        var stdInnerPipe = dpheGetStdPipe(Di * 1000, 'inner');
        var stdOuterPipe = dpheGetStdPipe(D2 * 1000, 'outer');
        var stdLength = dpheGetStdLength(L);
        var totalPipeLen = L * hairpinsDesign * 2;
        var nElbows = (hairpinsDesign * 2 - 1) * 2;
        var fluidHotName = document.getElementById('dphe-fluid-hot')?.value || 'Hot Fluid';
        var fluidColdName = document.getElementById('dphe-fluid-cold')?.value || 'Cold Fluid';
        var matHot = document.getElementById('dphe-mat-hot')?.value || 'CS';
        var matCold = document.getElementById('dphe-mat-cold')?.value || 'CS';

        // --- Nozzle sizing (based on velocity limits) ---
        var tubeNozVelMax = 3.0;
        var annNozVelMax = 2.5;
        var volFlowTube = (rhoh > 0) ? mh / rhoh : 0;
        var volFlowAnn = (rhoc > 0) ? mc / rhoc : 0;
        var tubeNozAreaReq = (tubeNozVelMax > 0) ? volFlowTube / tubeNozVelMax : 0;
        var annNozAreaReq = (annNozVelMax > 0) ? volFlowAnn / annNozVelMax : 0;
        var tubeNozIdReq = Math.sqrt(4 * tubeNozAreaReq / Math.PI) * 1000;
        var annNozIdReq = Math.sqrt(4 * annNozAreaReq / Math.PI) * 1000;
        var tubeNozPipe = dpheGetStdPipe(tubeNozIdReq, 'inner');
        var annNozPipe = dpheGetStdPipe(annNozIdReq, 'inner');
        var tubeNozVelActual = (tubeNozPipe.id > 0) ? volFlowTube / (Math.PI / 4 * Math.pow(tubeNozPipe.id / 1000, 2)) : 0;
        var annNozVelActual = (annNozPipe.id > 0) ? volFlowAnn / (Math.PI / 4 * Math.pow(annNozPipe.id / 1000, 2)) : 0;

        // Populate nozzle output fields
        el = document.getElementById('dphe-out-noz-tube'); if (el) el.textContent = 'NPS ' + tubeNozPipe.nps + ' (ID ' + fmt(tubeNozPipe.id,1) + ' mm) — ' + fmt(tubeNozVelActual,2) + ' m/s';
        el = document.getElementById('dphe-out-noz-ann');  if (el) el.textContent = 'NPS ' + annNozPipe.nps + ' (ID ' + fmt(annNozPipe.id,1) + ' mm) — ' + fmt(annNozVelActual,2) + ' m/s';

        // --- Flow arrangement recommendation ---
        var flowRec = 'Counter-Current (RECOMMENDED)';
        if (effectiveness_conc > effectiveness * 1.05) {
          flowRec = 'Concurrent (Higher effectiveness by ' + fmt((effectiveness_conc - effectiveness) * 100, 1) + '%)';
        }

        // --- Auto-correction suggestions (DETAILED) ---
        var suggestions = [];

        // FLOW ARRANGEMENT ANALYSIS
        var flowDiff = fmt(Math.abs(effectiveness_conc - effectiveness) * 100, 1);
        var effBetter = effectiveness_conc > effectiveness ? 'Concurrent' : 'Counter-Current';
        var effRatio = fmt(Math.max(effectiveness, effectiveness_conc) / Math.min(effectiveness, effectiveness_conc), 3);
        suggestions.push({
          type:'info',
          msg:'FLOW ANALYSIS: Counter-Current ε=' + fmt(effectiveness, 3) + ' vs Concurrent ε=' + fmt(effectiveness_conc, 3) + ' | Better: ' + effBetter + ' (by ' + flowDiff + '%) | LMTD_CC=' + fmt(LMTD_cc, 1) + '°C vs LMTD_Conc=' + fmt(LMTD_conc, 1) + '°C',
          reason: 'Counter-current provides better temperature approach and is preferred in most industrial applications for improved efficiency.'
        });

        // AREA & HAIRPIN ANALYSIS
        if (excessArea < 0) {
          suggestions.push({
            type:'error',
            msg:'❌ CRITICAL: Insufficient heat transfer area! Areq=' + fmt(Areq, 2) + ' m² vs Aavail=' + fmt(Aavail, 2) + ' m². Increase hairpins or pipe length.',
            reason: 'Heat transfer area is inadequate per ASME B36.10. Calculated requirement exceeds available surface area.'
          });
        }
        else if (excessArea > 50) {
          suggestions.push({
            type:'warn',
            msg:'⚠ OVERSIZED: Excess area = ' + fmt(excessArea, 1) + '% (limit: 30%). Current: ' + hairpinsDesign + ' hairpins → Recommend: ' + Math.max(1, Math.ceil(hairpinsCalc * 1.15)) + ' hairpins',
            reason: 'Oversizing increases cost and footprint. DPHE best practice: excess area 10-30% per industry standards.'
          });
        }
        else if (excessArea >= 10 && excessArea <= 30) {
          suggestions.push({
            type:'ok',
            msg:'✓ OPTIMAL: Design well-sized with ' + fmt(excessArea, 1) + '% excess area (ideal: 10-30%)',
            reason: 'Meets ASME guidelines and industry best practices for efficient heat exchanger design.'
          });
        }
        else if (excessArea >= 0 && excessArea < 10) {
          suggestions.push({
            type:'warn',
            msg:'⚠ TIGHT: Excess area only ' + fmt(excessArea, 1) + '% (margin < 10%). Low safety factor. Recommend adding 1 more hairpin.',
            reason: 'Design margin is below 10% safety buffer. Any variation in fouling or flow rate could cause underperformance.'
          });
        }

        // PRESSURE DROP ANALYSIS
        if (dP_inner > 100) {
          suggestions.push({
            type:'warn',
            msg:'⚠ HIGH PRESSURE DROP (TUBE): ΔP_inner = ' + fmt(dP_inner, 1) + ' kPa (limit: 50-100 kPa). Consider larger inner pipe diameter or reduce hairpins.',
            reason: 'Excessive pressure drop increases pumping power cost. ASME B36.10 recommends < 100 kPa for optimal operation.'
          });
        }
        if (dP_annulus > 70) {
          suggestions.push({
            type:'warn',
            msg:'⚠ HIGH PRESSURE DROP (ANNULUS): ΔP_annulus = ' + fmt(dP_annulus, 1) + ' kPa (limit: 50-70 kPa). Consider larger outer pipe diameter.',
            reason: 'Pressure drop in annulus exceeds industrial recommendation. Larger outer pipe improves flow distribution and reduces losses.'
          });
        }

        // REYNOLDS NUMBER ANALYSIS
        if (Re_t < 10000 && Re_t > 0) {
          suggestions.push({
            type:'warn',
            msg:'⚠ LOW TURBULENCE (TUBE): Re = ' + fmt(Re_t, 0) + ' (target: > 10000). Flow is transitional/laminar. Reduce inner pipe diameter for better heat transfer.',
            reason: 'Low Reynolds number reduces convective heat transfer coefficient. Turbulence improves mixing and film coefficient per Dittus-Boelert correlation.'
          });
        }
        if (Re_a < 10000 && Re_a > 0) {
          suggestions.push({
            type:'warn',
            msg:'⚠ LOW TURBULENCE (ANNULUS): Re = ' + fmt(Re_a, 0) + ' (target: > 10000). Check annular gap. Consider geometric adjustment.',
            reason: 'Laminar/transitional flow in annulus results in poor heat transfer. ASME Standard recommends Re > 10000 for effective DPHE operation.'
          });
        }

        var recHairpins = Math.ceil(hairpinsCalc * 1.15);
        if (recHairpins < 1) recHairpins = 1;

        suggestions.push({
          type:'info',
          msg:'HAIRPIN SUMMARY: Calculated=' + fmt(hairpinsCalc, 2) + ' | Design=' + hairpinsDesign + ' | Recommended (15% safety)=' + recHairpins,
          reason: 'Design uses ceiling function for safety. 15% margin is standard industrial practice per TEMA & ASME standards.'
        });
        suggestions.push({
          type:'info',
          msg:'NOZZLE SIZING: Tube NPS ' + tubeNozPipe.nps + ' (ID=' + fmt(tubeNozPipe.id, 1) + ' mm, V=' + fmt(tubeNozVelActual, 2) + ' m/s) | Annulus NPS ' + annNozPipe.nps + ' (ID=' + fmt(annNozPipe.id, 1) + ' mm, V=' + fmt(annNozVelActual, 2) + ' m/s)',
          reason: 'ASME B16.5 standard nozzle sizing. Velocities: Tube 2.5-3.5 m/s, Annulus 2.0-2.5 m/s. Extremes cause erosion or pressure drop issues.'
        });

        // --- Auto-upgrade recommendation engine ---
        var recommended = {};
        var needsUpgrade = false;
        // Find best pipe config for < 30% excess area
        if (excessArea > 30 || excessArea < 0) {
          needsUpgrade = true;
          // Try each config and find the one with excess area closest to 15% (ideal)
          var bestCfg = null, bestExcess = 999;
          for (var ci2 = 0; ci2 < DPHE_COMMON_CONFIGS.length; ci2++) {
            var tcfg = DPHE_COMMON_CONFIGS[ci2];
            var tip = DPHE_STD_PIPES[tcfg.innerIdx];
            var top2 = DPHE_STD_PIPES[tcfg.outerIdx];
            var tDo = tip.od / 1000;
            var tAhp = Math.PI * tDo * 2 * L;
            if (tAhp <= 0) continue;
            var tHpCalc = Areq / tAhp;
            var tHpDes = Math.ceil(tHpCalc * 1.15);
            if (tHpDes < 1) tHpDes = 1;
            var tAavail = tHpDes * tAhp;
            var tExcess = (Areq > 0) ? ((tAavail - Areq) / Areq) * 100 : 0;
            if (tExcess >= 0 && tExcess <= 30 && Math.abs(tExcess - 15) < Math.abs(bestExcess - 15)) {
              bestExcess = tExcess;
              bestCfg = { innerIdx: tcfg.innerIdx, outerIdx: tcfg.outerIdx, hairpins: tHpDes, excess: tExcess, label: tcfg.label };
            }
          }
          if (bestCfg) {
            recommended.innerIdx = bestCfg.innerIdx;
            recommended.outerIdx = bestCfg.outerIdx;
            recommended.hairpins = bestCfg.hairpins;
            suggestions.push({ type:'ok', msg:'RECOMMENDED: ' + bestCfg.label + ' with ' + bestCfg.hairpins + ' hairpins → ' + fmt(bestCfg.excess,1) + '% excess area' });
          } else {
            recommended.hairpins = recHairpins;
          }
        }
        // Recommend standard length if not standard
        var isStdLen = false;
        for (var li2 = 0; li2 < DPHE_STD_LENGTHS.length; li2++) { if (Math.abs(L - DPHE_STD_LENGTHS[li2]) < 0.01) { isStdLen = true; break; } }
        if (!isStdLen && L > 0) {
          recommended.length = dpheGetStdLength(L);
          needsUpgrade = true;
          suggestions.push({ type:'info', msg:'Non-standard length ' + fmt(L,2) + ' m. Nearest standard: ' + fmt(recommended.length,2) + ' m' });
        }

        window.dpheRecommended = needsUpgrade ? recommended : null;

        // Populate auto-suggest panel with detailed reasons
        var sugPanel = document.getElementById('dphe-auto-suggest');
        var sugContent = document.getElementById('dphe-suggest-content');
        if (sugPanel && sugContent) {
          sugPanel.style.display = 'block';
          var sugInner = '';
          for (var si3 = 0; si3 < suggestions.length; si3++) {
            var sg = suggestions[si3];
            var sgColor = sg.type === 'error' ? '#ef4444' : sg.type === 'warn' ? '#f59e0b' : sg.type === 'ok' ? '#22c55e' : '#60a5fa';
            var sgIcon = sg.type === 'error' ? '✗' : sg.type === 'warn' ? '⚠' : sg.type === 'ok' ? '✓' : 'ℹ';
            var expandId = 'dphe-sug-' + si3;
            var reasonText = sg.reason ? sg.reason : 'No additional details available.';
            sugInner += '<div style="padding:6px 8px;margin:4px 0;border-left:4px solid ' + sgColor + ';color:#cbd5e1;background:rgba(0,0,0,0.3);border-radius:3px;">' +
                        '<div style="cursor:pointer;font-weight:700;" onclick="document.getElementById(\'' + expandId + '\').style.display=document.getElementById(\'' + expandId + '\').style.display===\'none\'?\'block\':\'none\';">' +
                        sgIcon + ' ' + sg.msg + '</div>' +
                        '<div id="' + expandId + '" style="display:none;margin-top:4px;font-size:9px;color:#a0aec0;padding-left:8px;border-left:2px solid ' + sgColor + ';padding-top:4px;">' +
                        '💡 ' + reasonText + '</div></div>';
          }
          sugContent.innerHTML = sugInner;

          // Add chatbot suggestion button
          var chatbotBtn = document.getElementById('dphe-chatbot-btn');
          if (!chatbotBtn) {
            var btnDiv = document.createElement('div');
            btnDiv.style.marginTop = '8px';
            btnDiv.style.textAlign = 'center';
            btnDiv.innerHTML = '<button type="button" id="dphe-chatbot-btn" onclick="window.dpheShowChatbot()" style="background:linear-gradient(135deg,#8b5cf6,#a78bfa); color:white; border:none; padding:8px 20px; border-radius:4px; font-size:10px; font-weight:700; cursor:pointer; letter-spacing:0.05em;">💬 ASK DESIGN ASSISTANT</button>';
            sugPanel.appendChild(btnDiv);
          }
        }

        // Store state for report
        window.dpheReportData = {
          Di:Di, Do:Do, D2:D2, L:L, nHp:hairpinsDesign, mc:mc, mh:mh,
          Tci:Tci, Tco:Tco, Thi:Thi, Tho:Tho, Q:Q, Ud:Ud, Uc:Uc, LMTD:LMTD,
          hio:hio, ho:ho, Areq:Areq, Aavail:Aavail, hairpinsCalc:hairpinsCalc,
          excessArea:excessArea, dP_inner:dP_inner, dP_annulus:dP_annulus,
          Cpc:Cpc, Cph:Cph, kc:kc, kh:kh, rhoc:rhoc, rhoh:rhoh, muc:muc, muh:muh,
          Rdi:Rdi, Rdo:Rdo, kw:kw, fluidHot:fluidHotName, fluidCold:fluidColdName,
          matHot:matHot, matCold:matCold, stdInnerPipe:stdInnerPipe, stdOuterPipe:stdOuterPipe,
          stdLength:stdLength, totalPipeLen:totalPipeLen, nElbows:nElbows,
          tubeNozPipe:tubeNozPipe, annNozPipe:annNozPipe,
          tubeNozVel:tubeNozVelActual, annNozVel:annNozVelActual,
          suggestions:suggestions, Re_t:Re_t, Re_a:Re_a,
          Nu_h:Nu_h, Nu_c:Nu_c, Pr_h:Pr_h, Pr_c:Pr_c, f_t:f_t, f_a:f_a
        };

        // Use CALCULATED hairpins (rounded up) for SVG diagram, not user input
        var svgDiag = buildDPHESVGDiagram(Di, Do, D2, L, hairpinsDesign, mc, mh, Tci, Tco, Thi, Tho, Q, Ud, LMTD, {excess: excessArea});

        // Build auto-suggestion box in inline report
        var sugHTML = '<div style="margin:12px 0;padding:12px;background:rgba(15,23,42,0.9);border:1px solid #334155;border-radius:8px;">';
        sugHTML += '<div style="font-size:11px;font-weight:800;color:#f59e0b;margin-bottom:8px;letter-spacing:0.08em;">⚡ DESIGN EVALUATION</div>';
        for (var si4 = 0; si4 < suggestions.length; si4++) {
          var sg2 = suggestions[si4];
          var sgColor2 = sg2.type === 'error' ? '#ef4444' : sg2.type === 'warn' ? '#f59e0b' : sg2.type === 'ok' ? '#22c55e' : '#60a5fa';
          var sgIcon2 = sg2.type === 'error' ? '✗' : sg2.type === 'warn' ? '⚠' : sg2.type === 'ok' ? '✓' : 'ℹ';
          sugHTML += '<div style="padding:4px 8px;margin:3px 0;border-left:3px solid ' + sgColor2 + ';font-size:10px;color:#cbd5e1;">' + sgIcon2 + ' ' + sg2.msg + '</div>';
        }
        sugHTML += '<div style="margin-top:8px;padding:6px 10px;background:rgba(30,58,95,0.5);border-radius:4px;font-size:10px;color:#93c5fd;">';
        sugHTML += '<b>Area Required:</b> ' + fmt(Areq,4) + ' m² | <b>Available:</b> ' + fmt(Aavail,4) + ' m² | <b>Excess:</b> ' + fmt(excessArea,1) + '%';
        sugHTML += '</div></div>';

        // Build inline report summary
        var rptHTML = svgDiag + sugHTML;
        rptHTML += '<div style="margin-top:12px;text-align:center;"><button onclick="showDPHEReportModal()" style="background:linear-gradient(135deg,#1e40af,#3b82f6);color:white;border:none;padding:10px 28px;border-radius:6px;font-family:var(--font-mono);font-size:11px;font-weight:700;cursor:pointer;letter-spacing:0.05em;">VIEW FULL REPORT &amp; DOWNLOAD PDF</button></div>';
        document.getElementById('dphe-summary-report').innerHTML = rptHTML;

        // Update 3D scene with calculated values
        if (dphe3D.initialized) buildDPHEScene();
    });
})();

function showDPHEReportModal() {
  var d = window.dpheReportData;
  if (!d) { alert('Run DPHE calculation first.'); return; }
  var f = function(n, dp) { return isFinite(n) ? n.toFixed(dp === undefined ? 2 : dp) : '-'; };
  var row = function(label, val, color) { return '<tr><td style="padding:4px 8px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:11px;">' + label + '</td><td style="padding:4px 8px;border-bottom:1px solid #1e293b;color:' + (color || '#e2e8f0') + ';font-size:11px;font-weight:700;text-align:right;">' + val + '</td></tr>'; };

  var svgDiag = buildDPHESVGDiagram(d.Di, d.Do, d.D2, d.L, d.nHp, d.mc, d.mh, d.Tci, d.Tco, d.Thi, d.Tho, d.Q, d.Ud, d.LMTD, {excess: d.excessArea});

  var sug = [];
  if (d.excessArea > 50) sug.push('Excess area > 50% — consider reducing hairpins or pipe length.');
  if (d.excessArea < 0) sug.push('Insufficient area — increase hairpins, pipe length, or improve heat transfer.');
  if (d.dP_inner > 100) sug.push('Inner pipe pressure drop > 100 kPa — consider larger inner pipe.');
  if (d.dP_annulus > 100) sug.push('Annulus pressure drop > 100 kPa — consider larger outer pipe.');
  if (d.Ud < 10) sug.push('Very low Ud — check fouling resistances and fluid properties.');
  if (d.excessArea >= 0 && d.excessArea <= 50) sug.push('Design is well-sized with acceptable excess area.');
  var sugHTML = sug.map(function(s) { return '<div style="padding:4px 8px;margin:2px 0;background:rgba(245,158,11,0.1);border-left:3px solid #f59e0b;font-size:10px;color:#fbbf24;">' + s + '</div>'; }).join('');

  var html = '<div id="dphe-report-modal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:10000;display:flex;align-items:center;justify-content:center;overflow-y:auto;">'
    + '<div style="background:#0f172a;border:1px solid #334155;border-radius:12px;max-width:900px;width:95%;max-height:92vh;overflow-y:auto;padding:24px;margin:16px;">'
    + '<div style="text-align:center;margin-bottom:16px;"><span style="font-family:Arial;font-size:18px;font-weight:800;color:#f59e0b;letter-spacing:0.05em;">BHARAT FLOWSIZE — DPHE DESIGN REPORT</span><br><span style="font-size:10px;color:#64748b;">ANOVIX TECHNOLOGIES | DIGITAL INDIA INITIATIVE</span></div>'
    + svgDiag
    + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px;">'

    // INPUT SUMMARY — TUBE SIDE
    + '<div><div style="font-size:11px;font-weight:800;color:#ef4444;margin-bottom:6px;border-bottom:2px solid #ef4444;padding-bottom:3px;">TUBE SIDE (INNER PIPE)</div>'
    + '<table style="width:100%;border-collapse:collapse;">'
    + row('Fluid', d.fluidHot) + row('Material', d.matHot)
    + row('Flow Rate', f(d.mh, 2) + ' kg/hr') + row('Inlet Temp', f(d.Thi, 1) + ' °C')
    + row('Outlet Temp', f(d.Tho, 1) + ' °C') + row('Density', f(d.rhoh, 1) + ' kg/m³')
    + row('Viscosity', f(d.muh, 2) + ' mPa·s') + row('Cp', f(d.Cph, 2) + ' kJ/kg·K')
    + row('Conductivity', f(d.kh, 3) + ' W/m·°C')
    + '</table></div>'

    // INPUT SUMMARY — ANNULUS SIDE
    + '<div><div style="font-size:11px;font-weight:800;color:#3b82f6;margin-bottom:6px;border-bottom:2px solid #3b82f6;padding-bottom:3px;">ANNULUS SIDE (OUTER PIPE)</div>'
    + '<table style="width:100%;border-collapse:collapse;">'
    + row('Fluid', d.fluidCold) + row('Material', d.matCold)
    + row('Flow Rate', f(d.mc, 2) + ' kg/hr') + row('Inlet Temp', f(d.Tci, 1) + ' °C')
    + row('Outlet Temp', f(d.Tco, 1) + ' °C') + row('Density', f(d.rhoc, 1) + ' kg/m³')
    + row('Viscosity', f(d.muc, 2) + ' mPa·s') + row('Cp', f(d.Cpc, 2) + ' kJ/kg·K')
    + row('Conductivity', f(d.kc, 3) + ' W/m·°C')
    + '</table></div></div>'

    // GEOMETRY & PIPE SIZING
    + '<div style="margin-top:16px;"><div style="font-size:11px;font-weight:800;color:#22c55e;margin-bottom:6px;border-bottom:2px solid #22c55e;padding-bottom:3px;">GEOMETRY & PIPE SIZING</div>'
    + '<table style="width:100%;border-collapse:collapse;">'
    + row('Inner Pipe ID (Di)', f(d.Di * 1000, 1) + ' mm')
    + row('Inner Pipe OD (Do)', f(d.Do * 1000, 1) + ' mm')
    + row('Outer Pipe ID (D2)', f(d.D2 * 1000, 1) + ' mm')
    + row('Pipe Length per Hairpin', f(d.L, 2) + ' m')
    + row('Std. Commercial Length', f(d.stdLength, 2) + ' m', '#22c55e')
    + row('Nearest Std Inner Pipe', d.stdInnerPipe.nps + ' (OD ' + f(d.stdInnerPipe.od, 1) + ', ID ' + f(d.stdInnerPipe.id, 1) + ' mm, Sch ' + d.stdInnerPipe.sch + ')', '#22c55e')
    + row('Nearest Std Outer Pipe', d.stdOuterPipe.nps + ' (OD ' + f(d.stdOuterPipe.od, 1) + ', ID ' + f(d.stdOuterPipe.id, 1) + ' mm, Sch ' + d.stdOuterPipe.sch + ')', '#22c55e')
    + row('Fouling Inner (Rdi)', f(d.Rdi, 4) + ' m²·°C/W')
    + row('Fouling Outer (Rdo)', f(d.Rdo, 4) + ' m²·°C/W')
    + row('Wall Conductivity (kw)', f(d.kw, 1) + ' W/m·°C')
    + '</table></div>'

    // THERMAL RESULTS
    + '<div style="margin-top:16px;"><div style="font-size:11px;font-weight:800;color:#f59e0b;margin-bottom:6px;border-bottom:2px solid #f59e0b;padding-bottom:3px;">THERMAL RESULTS</div>'
    + '<table style="width:100%;border-collapse:collapse;">'
    + row('Heat Duty (Q)', f(d.Q, 2) + ' kW')
    + row('LMTD', f(d.LMTD, 2) + ' °C')
    + row('hio (Corrected to OD)', f(d.hio, 1) + ' W/m²·°C')
    + row('ho (Annulus)', f(d.ho, 1) + ' W/m²·°C')
    + row('Ud (Overall Dirty)', f(d.Ud, 2) + ' W/m²·°C')
    + row('Uc (Overall Clean)', f(d.Uc, 2) + ' W/m²·°C')
    + row('Area Required', f(d.Areq, 4) + ' m²')
    + row('Area Available', f(d.Aavail, 4) + ' m²')
    + row('Hairpins Calculated', f(d.hairpinsCalc, 2))
    + row('Hairpins Design', d.nHp, '#22c55e')
    + row('Excess Area', f(d.excessArea, 1) + ' %', d.excessArea >= 0 ? '#22c55e' : '#ef4444')
    + row('ΔP Inner Pipe', f(d.dP_inner, 3) + ' kPa')
    + row('ΔP Annulus', f(d.dP_annulus, 3) + ' kPa')
    + '</table></div>'

    // DETAILED TUBE SIDE
    + '<div style="margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:12px;">'
    + '<div><div style="font-size:11px;font-weight:800;color:#ef4444;margin-bottom:6px;border-bottom:2px solid #ef4444;padding-bottom:3px;">TUBE SIDE — DETAILED</div>'
    + '<table style="width:100%;border-collapse:collapse;">'
    + row('Reynolds Number', f(d.Re_t, 0))
    + row('Prandtl Number', f(d.Pr_h, 2))
    + row('Nusselt Number', f(d.Nu_h, 2))
    + row('Friction Factor', f(d.f_t, 6))
    + row('ΔP Tube', f(d.dP_inner, 3) + ' kPa')
    + row('Nozzle', d.tubeNozPipe ? 'NPS ' + d.tubeNozPipe.nps + ' (ID ' + f(d.tubeNozPipe.id, 1) + ' mm)' : '-', '#a855f7')
    + row('Nozzle Velocity', d.tubeNozVel ? f(d.tubeNozVel, 2) + ' m/s' : '-')
    + '</table></div>'

    // DETAILED ANNULUS SIDE
    + '<div><div style="font-size:11px;font-weight:800;color:#3b82f6;margin-bottom:6px;border-bottom:2px solid #3b82f6;padding-bottom:3px;">ANNULUS SIDE — DETAILED</div>'
    + '<table style="width:100%;border-collapse:collapse;">'
    + row('Reynolds Number', f(d.Re_a, 0))
    + row('Prandtl Number', f(d.Pr_c, 2))
    + row('Nusselt Number', f(d.Nu_c, 2))
    + row('Friction Factor', f(d.f_a, 6))
    + row('ΔP Annulus', f(d.dP_annulus, 3) + ' kPa')
    + row('Nozzle', d.annNozPipe ? 'NPS ' + d.annNozPipe.nps + ' (ID ' + f(d.annNozPipe.id, 1) + ' mm)' : '-', '#a855f7')
    + row('Nozzle Velocity', d.annNozVel ? f(d.annNozVel, 2) + ' m/s' : '-')
    + '</table></div></div>'

    // BILL OF MATERIALS
    + '<div style="margin-top:16px;"><div style="font-size:11px;font-weight:800;color:#06b6d4;margin-bottom:6px;border-bottom:2px solid #06b6d4;padding-bottom:3px;">BILL OF MATERIALS (ESTIMATED)</div>'
    + '<table style="width:100%;border-collapse:collapse;">'
    + row('Inner Pipe (' + d.matHot + ')', d.stdInnerPipe.nps + ' x ' + f(d.totalPipeLen, 1) + ' m total')
    + row('Outer Pipe (' + d.matCold + ')', d.stdOuterPipe.nps + ' x ' + f(d.totalPipeLen, 1) + ' m total')
    + row('Hairpins Required', d.nHp)
    + row('U-Bends (Return Bends)', d.nHp * 2 - 1 > 0 ? d.nHp * 2 - 1 : 1)
    + row('Flanges (approx)', d.nHp * 4)
    + row('Total Passes', d.nHp * 2)
    + row('Total Heat Transfer Length', f(d.totalPipeLen, 1) + ' m')
    + '</table></div>'

    // NOZZLE SIZING
    + '<div style="margin-top:16px;"><div style="font-size:11px;font-weight:800;color:#a855f7;margin-bottom:6px;border-bottom:2px solid #a855f7;padding-bottom:3px;">NOZZLE SIZING (AUTO-CALCULATED)</div>'
    + '<table style="width:100%;border-collapse:collapse;">'
    + row('Tube Inlet/Outlet Nozzle', d.tubeNozPipe ? ('NPS ' + d.tubeNozPipe.nps + ' (ID ' + f(d.tubeNozPipe.id, 1) + ' mm)') : '-', '#a855f7')
    + row('Tube Nozzle Velocity', d.tubeNozVel ? f(d.tubeNozVel, 2) + ' m/s' : '-')
    + row('Annulus Inlet/Outlet Nozzle', d.annNozPipe ? ('NPS ' + d.annNozPipe.nps + ' (ID ' + f(d.annNozPipe.id, 1) + ' mm)') : '-', '#a855f7')
    + row('Annulus Nozzle Velocity', d.annNozVel ? f(d.annNozVel, 2) + ' m/s' : '-')
    + row('Re (Tube Side)', d.Re_t ? f(d.Re_t, 0) : '-')
    + row('Re (Annulus Side)', d.Re_a ? f(d.Re_a, 0) : '-')
    + '</table></div>'

    // SUGGESTIONS
    + '<div style="margin-top:16px;"><div style="font-size:11px;font-weight:800;color:#d97706;margin-bottom:6px;border-bottom:2px solid #f59e0b;padding-bottom:3px;">AUTO-CORRECTION &amp; DESIGN SUGGESTIONS</div>'
    + (d.suggestions ? d.suggestions.map(function(sg) { var sgColor = sg.type === 'error' ? '#ef4444' : sg.type === 'warn' ? '#f59e0b' : sg.type === 'ok' ? '#22c55e' : '#60a5fa'; var sgIcon = sg.type === 'error' ? '✗' : sg.type === 'warn' ? '⚠' : sg.type === 'ok' ? '✓' : 'ℹ'; return '<div style="padding:4px 8px;margin:2px 0;border-left:3px solid ' + sgColor + ';font-size:10px;color:#cbd5e1;">' + sgIcon + ' ' + sg.msg + '</div>'; }).join('') : sugHTML)
    + '</div>'

    // BUTTONS
    + '<div style="display:flex;gap:12px;justify-content:center;padding:16px 0;border-top:1px solid #1e293b;margin-top:16px;">'
    + '<button onclick="downloadDPHEReportPDF()" style="background:linear-gradient(135deg,#1e40af,#3b82f6);color:white;border:none;padding:10px 24px;border-radius:6px;font-weight:700;font-size:11px;cursor:pointer;">⬇ DOWNLOAD PDF REPORT</button>'
    + '<button onclick="document.getElementById(\'dphe-report-modal\').remove()" style="background:#64748b;color:white;border:none;padding:10px 24px;border-radius:6px;font-weight:700;font-size:11px;cursor:pointer;">✕ CLOSE</button>'
    + '</div></div></div>';

  var existing = document.getElementById('dphe-report-modal');
  if (existing) existing.remove();
  document.body.insertAdjacentHTML('beforeend', html);
}

function downloadDPHEReportPDF() {
  var modal = document.getElementById('dphe-report-modal');
  if (!modal) return;
  var content = modal.querySelector('div > div');
  if (typeof html2pdf !== 'undefined' && content) {
    html2pdf().set({
      margin: 8, filename: 'DPHE_Heat_Exchanger_Report.pdf',
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, backgroundColor: '#0f172a' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    }).from(content).save();
  } else {
    alert('PDF library not loaded. Please try again.');
  }
}

function buildDPHESVGDiagram(Di, Do, D2, L, nHp, mc, mh, Tci, Tco, Thi, Tho, Q, Ud, LMTD, extras) {
  extras = extras || {};
  var W = 780, H = 520;
  var totalPasses = nHp * 2;
  var maxPasses = Math.min(totalPasses, 8);
  var pipeW = W * 0.48;
  var pipeH = 16;
  var outerH = 26;
  var gap = 38;
  var diagH = maxPasses * gap + 20;
  var startX = 130;
  var startY = 65;
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:780px;background:#0f172a;border-radius:8px;margin-bottom:12px;">';
  svg += '<defs><linearGradient id="dphe-hot" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ef4444"/><stop offset="100%" stop-color="#f97316"/></linearGradient>';
  svg += '<linearGradient id="dphe-cold" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#3b82f6"/><stop offset="100%" stop-color="#06b6d4"/></linearGradient>';
  svg += '<marker id="darr" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto"><path d="M0,0 L8,3 L0,6" fill="#94a3b8"/></marker></defs>';

  svg += '<text x="' + W/2 + '" y="22" text-anchor="middle" fill="#f59e0b" font-family="Arial" font-size="14" font-weight="bold">DPHE SYSTEM DIAGRAM</text>';
  svg += '<text x="' + W/2 + '" y="38" text-anchor="middle" fill="#94a3b8" font-family="Arial" font-size="9">Hairpins: ' + nHp + ' | Passes: ' + totalPasses + ' | Flow: Counter-Current</text>';

  for (var p = 0; p < maxPasses; p++) {
    var y = startY + p * gap;
    svg += '<rect x="' + startX + '" y="' + (y - outerH/2) + '" width="' + pipeW + '" height="' + outerH + '" rx="' + outerH/2 + '" fill="url(#dphe-cold)" opacity="0.45" stroke="#3b82f6" stroke-width="1.5"/>';
    svg += '<rect x="' + (startX + 7) + '" y="' + (y - pipeH/2) + '" width="' + (pipeW - 14) + '" height="' + pipeH + '" rx="' + pipeH/2 + '" fill="url(#dphe-hot)" opacity="0.75" stroke="#ef4444" stroke-width="1"/>';
    svg += '<rect x="' + (startX - 3) + '" y="' + (y - outerH/2 - 2) + '" width="6" height="' + (outerH + 4) + '" rx="1" fill="#78909c" opacity="0.7"/>';
    svg += '<rect x="' + (startX + pipeW - 3) + '" y="' + (y - outerH/2 - 2) + '" width="6" height="' + (outerH + 4) + '" rx="1" fill="#78909c" opacity="0.7"/>';

    if (p < maxPasses - 1) {
      var r = gap / 2;
      if (p % 2 === 0) {
        svg += '<path d="M' + (startX + pipeW) + ',' + y + ' A' + r + ',' + r + ' 0 0,1 ' + (startX + pipeW) + ',' + (y + gap) + '" fill="none" stroke="#ef4444" stroke-width="' + pipeH + '" opacity="0.55" stroke-linecap="round"/>';
        svg += '<path d="M' + (startX + pipeW + outerH/2) + ',' + y + ' A' + (r + outerH/2 - 3) + ',' + r + ' 0 0,1 ' + (startX + pipeW + outerH/2) + ',' + (y + gap) + '" fill="none" stroke="#3b82f6" stroke-width="2.5" opacity="0.35" stroke-linecap="round"/>';
      } else {
        svg += '<path d="M' + startX + ',' + y + ' A' + r + ',' + r + ' 0 0,0 ' + startX + ',' + (y + gap) + '" fill="none" stroke="#ef4444" stroke-width="' + pipeH + '" opacity="0.55" stroke-linecap="round"/>';
        svg += '<path d="M' + (startX - outerH/2) + ',' + y + ' A' + (r + outerH/2 - 3) + ',' + r + ' 0 0,0 ' + (startX - outerH/2) + ',' + (y + gap) + '" fill="none" stroke="#3b82f6" stroke-width="2.5" opacity="0.35" stroke-linecap="round"/>';
      }
    }
  }

  var topY = startY;
  svg += '<text x="' + (startX - 10) + '" y="' + (topY - 10) + '" text-anchor="end" fill="#f97316" font-family="Arial" font-size="9" font-weight="bold">HOT IN ' + Thi.toFixed(1) + '°C</text>';
  svg += '<line x1="' + (startX - 8) + '" y1="' + topY + '" x2="' + startX + '" y2="' + topY + '" stroke="#f97316" stroke-width="2"/>';

  var botY = startY + (maxPasses - 1) * gap;
  var exitSide = ((maxPasses - 1) % 2 === 0) ? 'right' : 'left';
  if (exitSide === 'right') {
    svg += '<line x1="' + (startX + pipeW) + '" y1="' + botY + '" x2="' + (startX + pipeW + 8) + '" y2="' + botY + '" stroke="#f97316" stroke-width="2"/>';
    svg += '<text x="' + (startX + pipeW + 12) + '" y="' + (botY - 8) + '" fill="#f97316" font-family="Arial" font-size="9" font-weight="bold">HOT OUT ' + Tho.toFixed(1) + '°C</text>';
  } else {
    svg += '<line x1="' + (startX - 8) + '" y1="' + botY + '" x2="' + startX + '" y2="' + botY + '" stroke="#f97316" stroke-width="2"/>';
    svg += '<text x="' + (startX - 12) + '" y="' + (botY - 8) + '" text-anchor="end" fill="#f97316" font-family="Arial" font-size="9" font-weight="bold">HOT OUT ' + Tho.toFixed(1) + '°C</text>';
  }
  svg += '<text x="' + (startX + pipeW + 12) + '" y="' + (topY - 10) + '" fill="#3b82f6" font-family="Arial" font-size="9" font-weight="bold">COLD IN ' + Tci.toFixed(1) + '°C</text>';
  svg += '<text x="' + (startX - 10) + '" y="' + (botY + 16) + '" text-anchor="end" fill="#06b6d4" font-family="Arial" font-size="9" font-weight="bold">COLD OUT ' + Tco.toFixed(1) + '°C</text>';

  // Dimension lines
  var dimY = startY + maxPasses * gap + 8;
  svg += '<line x1="' + startX + '" y1="' + dimY + '" x2="' + (startX + pipeW) + '" y2="' + dimY + '" stroke="#94a3b8" stroke-width="1" marker-end="url(#darr)"/>';
  svg += '<text x="' + (startX + pipeW / 2) + '" y="' + (dimY + 13) + '" text-anchor="middle" fill="#94a3b8" font-family="Arial" font-size="8">L = ' + L.toFixed(2) + ' m</text>';

  // Cross-section detail (right side)
  var csX = startX + pipeW + 60, csY = startY + 30;
  svg += '<text x="' + (csX + 40) + '" y="' + (csY - 8) + '" text-anchor="middle" fill="#f59e0b" font-family="Arial" font-size="9" font-weight="bold">CROSS SECTION</text>';
  var csOutR = 30, csInR = csOutR * (Do / D2), csIdR = csOutR * (Di / D2);
  svg += '<circle cx="' + (csX + 40) + '" cy="' + (csY + 35) + '" r="' + csOutR + '" fill="none" stroke="#3b82f6" stroke-width="2" opacity="0.6"/>';
  svg += '<circle cx="' + (csX + 40) + '" cy="' + (csY + 35) + '" r="' + csInR + '" fill="none" stroke="#ef4444" stroke-width="2" opacity="0.7"/>';
  svg += '<circle cx="' + (csX + 40) + '" cy="' + (csY + 35) + '" r="' + csIdR + '" fill="#ef4444" opacity="0.3"/>';
  svg += '<text x="' + (csX + 40) + '" y="' + (csY + 75) + '" text-anchor="middle" fill="#3b82f6" font-family="Arial" font-size="7">D2=' + (D2 * 1000).toFixed(1) + 'mm</text>';
  svg += '<text x="' + (csX + 40) + '" y="' + (csY + 85) + '" text-anchor="middle" fill="#ef4444" font-family="Arial" font-size="7">Do=' + (Do * 1000).toFixed(1) + ' | Di=' + (Di * 1000).toFixed(1) + 'mm</text>';

  // Pipe sizing table (bottom right)
  var tblX = startX + pipeW + 20, tblY = csY + 100;
  svg += '<rect x="' + tblX + '" y="' + tblY + '" width="155" height="90" rx="4" fill="rgba(30,41,59,0.8)" stroke="#475569" stroke-width="1"/>';
  svg += '<text x="' + (tblX + 78) + '" y="' + (tblY + 14) + '" text-anchor="middle" fill="#f59e0b" font-family="Arial" font-size="8" font-weight="bold">PIPE DATA</text>';
  svg += '<line x1="' + (tblX + 5) + '" y1="' + (tblY + 18) + '" x2="' + (tblX + 150) + '" y2="' + (tblY + 18) + '" stroke="#475569" stroke-width="0.5"/>';
  var rows = [
    ['Inner ID (Di)', (Di * 1000).toFixed(1) + ' mm'],
    ['Inner OD (Do)', (Do * 1000).toFixed(1) + ' mm'],
    ['Outer ID (D2)', (D2 * 1000).toFixed(1) + ' mm'],
    ['Length/Hairpin', L.toFixed(2) + ' m'],
    ['Hairpins', nHp],
    ['Total Length', (L * nHp * 2).toFixed(1) + ' m']
  ];
  for (var ri = 0; ri < rows.length; ri++) {
    var ry = tblY + 28 + ri * 10;
    svg += '<text x="' + (tblX + 8) + '" y="' + ry + '" fill="#94a3b8" font-family="Arial" font-size="7">' + rows[ri][0] + '</text>';
    svg += '<text x="' + (tblX + 147) + '" y="' + ry + '" text-anchor="end" fill="#e2e8f0" font-family="Arial" font-size="7" font-weight="bold">' + rows[ri][1] + '</text>';
  }

  // Results box (bottom center)
  var resY = dimY + 22;
  svg += '<rect x="' + (startX - 10) + '" y="' + resY + '" width="' + (pipeW + 20) + '" height="50" rx="4" fill="rgba(30,41,59,0.8)" stroke="#475569" stroke-width="1"/>';
  svg += '<text x="' + (startX + pipeW / 2) + '" y="' + (resY + 14) + '" text-anchor="middle" fill="#22c55e" font-family="Arial" font-size="9" font-weight="bold">THERMAL RESULTS</text>';
  svg += '<text x="' + (startX + pipeW / 2) + '" y="' + (resY + 28) + '" text-anchor="middle" fill="#e2e8f0" font-family="Arial" font-size="8">Q = ' + Q.toFixed(2) + ' kW | Ud = ' + Ud.toFixed(2) + ' W/m²·°C | LMTD = ' + LMTD.toFixed(2) + ' °C</text>';
  svg += '<text x="' + (startX + pipeW / 2) + '" y="' + (resY + 42) + '" text-anchor="middle" fill="#94a3b8" font-family="Arial" font-size="7">Hot: ' + mh.toFixed(2) + ' kg/hr | Cold: ' + mc.toFixed(2) + ' kg/hr | Excess: ' + (extras.excess || 0).toFixed(1) + '%</text>';

  svg += '<text x="8" y="' + (H - 5) + '" fill="#475569" font-family="Arial" font-size="7">BHARAT FLOWSIZE — DPHE DESIGN</text>';
  svg += '<text x="' + (W - 8) + '" y="' + (H - 5) + '" text-anchor="end" fill="#475569" font-family="Arial" font-size="7">ANOVIX TECHNOLOGIES</text>';
  svg += '</svg>';
  return svg;
}

/* ═══════════════════════════════════════════════════════════════
   3D DPHE (Double Pipe Heat Exchanger) Visualization
   ═══════════════════════════════════════════════════════════════ */
function initDPHE3D(container) {
  container.innerHTML = '';
  var w = container.clientWidth || 600;
  var h = container.clientHeight || 350;

  dphe3D.scene = new THREE.Scene();
  dphe3D.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 500);
  dphe3D.camera.position.set(12, 8, 18);

  dphe3D.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  dphe3D.renderer.setSize(w, h);
  dphe3D.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  dphe3D.renderer.shadowMap.enabled = true;
  container.appendChild(dphe3D.renderer.domElement);

  dphe3D.controls = new CustomOrbitControls(dphe3D.camera, dphe3D.renderer.domElement);
  dphe3D.controls.enableDamping = true;
  dphe3D.controls.dampingFactor = 0.08;
  dphe3D.controls.autoRotate = true;
  dphe3D.controls.autoRotateSpeed = 0.5;

  var ambLight = new THREE.AmbientLight(0xffffff, 0.5);
  dphe3D.scene.add(ambLight);
  var dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(5, 8, 5);
  dirLight.castShadow = true;
  dphe3D.scene.add(dirLight);
  var accentLight = new THREE.PointLight(0xff7538, 0.4, 30);
  accentLight.position.set(-3, 2, 3);
  dphe3D.scene.add(accentLight);

  buildDPHEScene();
  dphe3D.initialized = true;
  animateDPHE();

  window.addEventListener('resize', function() {
    var nw = container.clientWidth || 600;
    var nh = container.clientHeight || 350;
    dphe3D.camera.aspect = nw / nh;
    dphe3D.camera.updateProjectionMatrix();
    dphe3D.renderer.setSize(nw, nh);
  });
}

function buildDPHEScene() {
  if (!dphe3D.scene) return;
  while (dphe3D.scene.children.length > 3) dphe3D.scene.remove(dphe3D.scene.children[3]);
  dphe3D.hotParticles = [];
  dphe3D.coldParticles = [];

  var Di = parseFloat(document.getElementById('dphe-di')?.value) || 0.0266;
  var Do = parseFloat(document.getElementById('dphe-do')?.value) || 0.0334;
  var D2 = parseFloat(document.getElementById('dphe-d2')?.value) || 0.0525;
  var L  = parseFloat(document.getElementById('dphe-length')?.value) || 3;
  var nHp = parseInt(document.getElementById('dphe-hairpins')?.value) || 2;

  // Scale: pipes are horizontal along X, stacked along Z (side-by-side hairpins)
  var sf = 25;
  var innerR = Math.max(Di / 2 * sf, 0.12);
  var innerOR = Math.max(Do / 2 * sf, 0.18);
  var outerR = Math.max(D2 / 2 * sf, 0.35);
  var pipeLen = Math.max(L * 0.7, 2.5);
  var passGap = outerR * 3.2;
  var totalPasses = nHp * 2;
  var totalZ = (totalPasses - 1) * passGap;

  var group = new THREE.Group();

  // Materials
  var innerMat = new THREE.MeshStandardMaterial({ color: 0xe88033, metalness: 0.65, roughness: 0.2 });
  var outerMat = new THREE.MeshStandardMaterial({ color: 0x4488bb, metalness: 0.4, roughness: 0.2, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  var bendMat = new THREE.MeshStandardMaterial({ color: 0xcc4444, metalness: 0.6, roughness: 0.2 });
  var flangeMat = new THREE.MeshStandardMaterial({ color: 0x99aabb, metalness: 0.9, roughness: 0.15 });
  var metalMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, metalness: 0.85, roughness: 0.2 });
  var supportMat = new THREE.MeshStandardMaterial({ color: 0x556677, metalness: 0.7, roughness: 0.3 });
  var baseMat = new THREE.MeshStandardMaterial({ color: 0x3a4a5a, metalness: 0.5, roughness: 0.6 });
  var nozMat = new THREE.MeshStandardMaterial({ color: 0x77aacc, metalness: 0.7, roughness: 0.2 });
  var nozFlangeMat = new THREE.MeshStandardMaterial({ color: 0xaabbcc, metalness: 0.85, roughness: 0.15 });
  var flangeThk = 0.05;
  var flangeR = outerR * 1.5;
  var nozR = innerOR * 0.5; if (nozR < 0.06) nozR = 0.06;
  var annNozR = outerR * 0.4; if (annNozR < 0.08) annNozR = 0.08;
  var nozLen = outerR * 2.0; if (nozLen < 0.25) nozLen = 0.25;

  dphe3D.passData = [];
  // HORIZONTAL pipes along X, stacked along Z
  for (var p = 0; p < totalPasses; p++) {
    var z = -totalZ / 2 + p * passGap;
    var dir = (p % 2 === 0) ? 1 : -1;
    dphe3D.passData.push({ z: z, dir: dir, len: pipeLen });

    // Outer pipe (transparent blue)
    var oGeo = new THREE.CylinderGeometry(outerR, outerR, pipeLen, 32);
    var oMesh = new THREE.Mesh(oGeo, outerMat);
    oMesh.rotation.z = Math.PI / 2;
    oMesh.position.set(0, 0, z);
    group.add(oMesh);

    // Inner pipe (solid orange)
    var iGeo = new THREE.CylinderGeometry(innerOR, innerOR, pipeLen + 0.1, 20);
    var iMesh = new THREE.Mesh(iGeo, innerMat);
    iMesh.rotation.z = Math.PI / 2;
    iMesh.position.set(0, 0, z);
    group.add(iMesh);

    // Flanges at both ends
    for (var fi = 0; fi < 2; fi++) {
      var fShape = new THREE.Shape();
      fShape.absarc(0, 0, flangeR, 0, Math.PI * 2, false);
      var fHole = new THREE.Path();
      fHole.absarc(0, 0, outerR * 0.95, 0, Math.PI * 2, true);
      fShape.holes.push(fHole);
      var fGeo = new THREE.ExtrudeGeometry(fShape, { depth: flangeThk, bevelEnabled: false });
      var fMesh = new THREE.Mesh(fGeo, flangeMat);
      fMesh.position.set(fi === 0 ? -pipeLen / 2 : pipeLen / 2, 0, z);
      fMesh.rotation.y = Math.PI / 2;
      group.add(fMesh);
      // Bolts
      for (var bi = 0; bi < 8; bi++) {
        var ba = (bi / 8) * Math.PI * 2;
        var bGeo = new THREE.CylinderGeometry(flangeR * 0.05, flangeR * 0.05, flangeThk * 2.5, 6);
        var bMesh = new THREE.Mesh(bGeo, metalMat);
        var bx = fi === 0 ? -pipeLen / 2 - flangeThk * 0.5 : pipeLen / 2 + flangeThk * 0.5;
        bMesh.position.set(bx, Math.cos(ba) * flangeR * 0.8, z + Math.sin(ba) * flangeR * 0.8);
        bMesh.rotation.z = Math.PI / 2;
        group.add(bMesh);
      }
    }

    // U-bends connecting passes
    if (p < totalPasses - 1) {
      var bendR = passGap / 2;
      var bSide = (p % 2 === 0) ? pipeLen / 2 : -pipeLen / 2;
      // Outer bend
      var obGeo = new THREE.TorusGeometry(bendR, outerR, 16, 32, Math.PI);
      var obMesh = new THREE.Mesh(obGeo, bendMat);
      obMesh.position.set(bSide, 0, z + passGap / 2);
      obMesh.rotation.x = Math.PI / 2;
      obMesh.rotation.z = (p % 2 === 0) ? -Math.PI / 2 : Math.PI / 2;
      group.add(obMesh);
      // Inner bend
      var ibGeo = new THREE.TorusGeometry(bendR, innerOR, 12, 32, Math.PI);
      var ibMesh = new THREE.Mesh(ibGeo, innerMat);
      ibMesh.position.set(bSide, 0, z + passGap / 2);
      ibMesh.rotation.x = Math.PI / 2;
      ibMesh.rotation.z = (p % 2 === 0) ? -Math.PI / 2 : Math.PI / 2;
      group.add(ibMesh);
    }
  }

  // ── Saddle Supports (plant-grade, below pipes) ──
  var saddleH = outerR * 2.5;
  var baseY = -outerR - saddleH;
  for (var si = 0; si < 2; si++) {
    var sx = si === 0 ? -pipeLen * 0.3 : pipeLen * 0.3;
    // Saddle shape (half-cylinder cradle + legs)
    var sGeo = new THREE.BoxGeometry(outerR * 0.6, saddleH, totalZ + passGap);
    var sMesh = new THREE.Mesh(sGeo, supportMat);
    sMesh.position.set(sx, -outerR - saddleH / 2, 0);
    group.add(sMesh);
    // Cradle arc
    var cGeo = new THREE.TorusGeometry(outerR * 1.1, outerR * 0.15, 8, 16, Math.PI);
    var cMesh = new THREE.Mesh(cGeo, supportMat);
    cMesh.position.set(sx, 0, 0);
    cMesh.rotation.y = Math.PI / 2;
    group.add(cMesh);
    // Base plate
    var bpGeo = new THREE.BoxGeometry(outerR * 2.5, outerR * 0.15, totalZ + passGap * 1.5);
    var bpMesh = new THREE.Mesh(bpGeo, baseMat);
    bpMesh.position.set(sx, baseY, 0);
    group.add(bpMesh);
  }
  // Ground skid / platform
  var skidGeo = new THREE.BoxGeometry(pipeLen * 0.85, outerR * 0.1, totalZ + passGap * 2);
  var skidMesh = new THREE.Mesh(skidGeo, baseMat);
  skidMesh.position.set(0, baseY - outerR * 0.1, 0);
  group.add(skidMesh);

  // ── Nozzle helper ──
  function addNoz(x, y, z, nR, len, dirX, dirY, label, color) {
    var nGeo = new THREE.CylinderGeometry(nR, nR, len, 12);
    var nMesh = new THREE.Mesh(nGeo, nozMat);
    if (dirY !== 0) {
      nMesh.position.set(x, y + dirY * len / 2, z);
    } else {
      nMesh.rotation.z = Math.PI / 2;
      nMesh.position.set(x + dirX * len / 2, y, z);
    }
    group.add(nMesh);
    // Flange
    var nfS = new THREE.Shape(); nfS.absarc(0, 0, nR * 2, 0, Math.PI * 2, false);
    var nfH = new THREE.Path(); nfH.absarc(0, 0, nR * 0.9, 0, Math.PI * 2, true);
    nfS.holes.push(nfH);
    var nfGeo = new THREE.ExtrudeGeometry(nfS, { depth: flangeThk * 0.7, bevelEnabled: false });
    var nfMesh = new THREE.Mesh(nfGeo, nozFlangeMat);
    if (dirY !== 0) { nfMesh.position.set(x, y + dirY * len, z); nfMesh.rotation.x = -Math.PI / 2; }
    else { nfMesh.position.set(x + dirX * len, y, z); nfMesh.rotation.y = Math.PI / 2; }
    group.add(nfMesh);
    // Label
    var cv = document.createElement('canvas'); cv.width = 300; cv.height = 64;
    var cx = cv.getContext('2d');
    cx.fillStyle = 'rgba(0,0,0,0.85)'; cx.fillRect(0, 0, 300, 64);
    cx.strokeStyle = color; cx.lineWidth = 2; cx.strokeRect(2, 2, 296, 60);
    cx.font = 'bold 26px Arial'; cx.fillStyle = color; cx.textAlign = 'center';
    cx.fillText(label, 150, 42);
    var tex = new THREE.CanvasTexture(cv);
    var sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex }));
    var sc = Math.max(nozLen * 1.5, 0.5);
    sp.scale.set(sc, sc * 0.22, 1);
    if (dirY !== 0) sp.position.set(x, y + dirY * (len + nR * 4), z);
    else sp.position.set(x + dirX * (len + nR * 4), y, z);
    group.add(sp);
  }

  var firstZ = -totalZ / 2;
  var lastZ = totalZ / 2;
  var lastPassDir = ((totalPasses - 1) % 2 === 0) ? 1 : -1;

  // TUBE IN: left end of first pass (horizontal)
  addNoz(-pipeLen / 2 - flangeR, 0, firstZ, nozR, nozLen, -1, 0, 'TUBE IN', '#ff6644');
  // TUBE OUT: exit end of last pass (horizontal)
  var tOutX = lastPassDir === 1 ? pipeLen / 2 + flangeR : -pipeLen / 2 - flangeR;
  addNoz(tOutX, 0, lastZ, nozR, nozLen, lastPassDir, 0, 'TUBE OUT', '#ff9944');

  // ANNULUS IN: vertical up on first pass
  addNoz(pipeLen * 0.25, outerR, firstZ, annNozR, nozLen * 1.3, 0, 1, 'ANNULUS IN', '#44aaff');
  // ANNULUS OUT: vertical UP on last pass (visible above pipes, not hidden below)
  addNoz(-pipeLen * 0.25, outerR, lastZ, annNozR, nozLen * 1.3, 0, 1, 'ANNULUS OUT', '#66ccff');

  // ── Name plate ──
  var npCv = document.createElement('canvas'); npCv.width = 512; npCv.height = 128;
  var npCx = npCv.getContext('2d');
  npCx.fillStyle = '#0e1e2e'; npCx.fillRect(0, 0, 512, 128);
  npCx.strokeStyle = '#4488aa'; npCx.lineWidth = 3; npCx.strokeRect(4, 4, 504, 120);
  npCx.font = 'bold 26px Arial'; npCx.fillStyle = '#88ccff'; npCx.textAlign = 'center';
  npCx.fillText('DOUBLE PIPE HEAT EXCHANGER', 256, 40);
  npCx.font = '18px Arial'; npCx.fillStyle = '#aaddff';
  npCx.fillText('ANOVIX TECHNOLOGIES — BHARAT FLOWSIZE', 256, 70);
  npCx.font = '16px Arial'; npCx.fillStyle = '#66aacc';
  npCx.fillText(nHp + ' Hairpins | ' + totalPasses + ' Passes | Counter-Current Flow', 256, 100);
  var npTex = new THREE.CanvasTexture(npCv);
  var npSp = new THREE.Sprite(new THREE.SpriteMaterial({ map: npTex }));
  var npSc = Math.max(pipeLen * 0.55, 1.5);
  npSp.scale.set(npSc, npSc * 0.25, 1);
  npSp.position.set(0, outerR * 4 + nozLen, 0);
  group.add(npSp);

  dphe3D.scene.add(group);
  dphe3D.mainGroup = group;

  // ── Liquid Flow Streams (smooth ribbon-style, not particles) ──
  var hotStreamMat = new THREE.MeshBasicMaterial({ color: 0xff4422, transparent: true, opacity: 0.7 });
  var coldStreamMat = new THREE.MeshBasicMaterial({ color: 0x22aaff, transparent: true, opacity: 0.55 });
  var hotGlowMat = new THREE.MeshBasicMaterial({ color: 0xff8844, transparent: true, opacity: 0.35 });
  var coldGlowMat = new THREE.MeshBasicMaterial({ color: 0x66ddff, transparent: true, opacity: 0.25 });

  // Hot fluid: flowing slugs inside inner pipe
  var slugLen = pipeLen * 0.12;
  var slugR = innerR * 0.75;
  if (slugR < 0.04) slugR = 0.04;
  var slugGeo = new THREE.CylinderGeometry(slugR, slugR, slugLen, 8);
  var glowGeo = new THREE.CylinderGeometry(slugR * 1.4, slugR * 1.4, slugLen * 0.7, 8);

  for (var pp = 0; pp < totalPasses; pp++) {
    var pd = dphe3D.passData[pp];
    for (var pi = 0; pi < 5; pi++) {
      var slug = new THREE.Mesh(slugGeo, hotStreamMat);
      slug.rotation.z = Math.PI / 2;
      slug.userData = { pass: pp, t: pi / 5, passZ: pd.z, dir: pd.dir, len: pipeLen, type: 'inner' };
      dphe3D.scene.add(slug);
      dphe3D.hotParticles.push(slug);
      // Glow halo
      var glow = new THREE.Mesh(glowGeo, hotGlowMat);
      glow.rotation.z = Math.PI / 2;
      glow.userData = { pass: pp, t: pi / 5, passZ: pd.z, dir: pd.dir, len: pipeLen, type: 'inner' };
      dphe3D.scene.add(glow);
      dphe3D.hotParticles.push(glow);
    }
  }

  // Cold fluid: flowing arc segments in annulus
  var coldSlugR = (outerR + innerOR) / 2 * 0.5;
  if (coldSlugR < 0.04) coldSlugR = 0.04;
  var coldSlugLen = pipeLen * 0.1;
  var coldSlugGeo = new THREE.CylinderGeometry(coldSlugR, coldSlugR, coldSlugLen, 6);
  var coldGlGeo = new THREE.CylinderGeometry(coldSlugR * 1.5, coldSlugR * 1.5, coldSlugLen * 0.6, 6);

  for (var pp2 = 0; pp2 < totalPasses; pp2++) {
    var pd2 = dphe3D.passData[pp2];
    for (var ci2 = 0; ci2 < 6; ci2++) {
      var ang2 = (ci2 / 6) * Math.PI * 2;
      var cs = new THREE.Mesh(coldSlugGeo, coldStreamMat);
      cs.rotation.z = Math.PI / 2;
      cs.userData = { pass: pp2, t: ci2 / 6, passZ: pd2.z, dir: pd2.dir, len: pipeLen, type: 'annulus', angle: ang2, outerR: outerR, innerOR: innerOR };
      dphe3D.scene.add(cs);
      dphe3D.coldParticles.push(cs);
      // Cold glow
      var cg = new THREE.Mesh(coldGlGeo, coldGlowMat);
      cg.rotation.z = Math.PI / 2;
      cg.userData = { pass: pp2, t: ci2 / 6 + 0.02, passZ: pd2.z, dir: pd2.dir, len: pipeLen, type: 'annulus', angle: ang2 + 0.5, outerR: outerR, innerOR: innerOR };
      dphe3D.scene.add(cg);
      dphe3D.coldParticles.push(cg);
    }
  }

  // Camera
  var camDist = Math.max(totalZ * 1.2, pipeLen * 1.0, 5);
  dphe3D.camera.position.set(camDist * 0.8, camDist * 0.5, camDist * 0.9);
  dphe3D.controls.target.set(0, 0, 0);
  dphe3D.camera.updateProjectionMatrix();
  dphe3D.controls.update();

  // ── Natural Water Flow Sound (multi-layer Web Audio) ──
  if (!dphe3D.audioStarted) {
    try {
      var actx = new (window.AudioContext || window.webkitAudioContext)();
      // Layer 1: Low rumble (pipe vibration)
      var buf1 = actx.createBuffer(1, actx.sampleRate * 3, actx.sampleRate);
      var d1 = buf1.getChannelData(0);
      for (var ai = 0; ai < d1.length; ai++) {
        d1[ai] = (Math.random() * 2 - 1) * 0.02 * (0.7 + 0.3 * Math.sin(ai * 0.0003));
      }
      var s1 = actx.createBufferSource(); s1.buffer = buf1; s1.loop = true;
      var f1 = actx.createBiquadFilter(); f1.type = 'lowpass'; f1.frequency.value = 120;
      var g1 = actx.createGain(); g1.gain.value = 0.06;
      s1.connect(f1); f1.connect(g1); g1.connect(actx.destination); s1.start();

      // Layer 2: Mid-range water flow
      var buf2 = actx.createBuffer(1, actx.sampleRate * 2, actx.sampleRate);
      var d2 = buf2.getChannelData(0);
      for (var ai2 = 0; ai2 < d2.length; ai2++) {
        d2[ai2] = (Math.random() * 2 - 1) * 0.008 * (0.5 + 0.5 * Math.sin(ai2 * 0.001));
      }
      var s2 = actx.createBufferSource(); s2.buffer = buf2; s2.loop = true;
      var f2 = actx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 350; f2.Q.value = 0.8;
      var g2 = actx.createGain(); g2.gain.value = 0.04;
      s2.connect(f2); f2.connect(g2); g2.connect(actx.destination); s2.start();

      dphe3D.audioCtx = actx; dphe3D.audioStarted = true;
    } catch(e) {}
  }
}

function animateDPHE() {
  dphe3D.animationId = requestAnimationFrame(animateDPHE);
  if (!dphe3D.renderer) return;
  var time = Date.now() * 0.001;

  function updateFlow(p, speed) {
    var d = p.userData;
    d.t = (d.t + speed + 1) % 1;
    var dir = d.pass % 2 === 0 ? 1 : -1;
    var t = d.t;
    var x = -d.len / 2 + t * d.len * dir;
    if (d.type === 'inner') {
      // Smooth liquid flow along pipe center with slight wave
      var wave = Math.sin(t * Math.PI * 4 + time * 2) * 0.01;
      p.position.set(x, wave, d.passZ);
      // Pulsing opacity for liquid feel
      if (p.material.opacity !== undefined) {
        p.material.opacity = 0.5 + 0.3 * Math.sin(t * Math.PI * 2 + time * 3);
      }
    } else {
      // Annulus flow: spiral path around inner pipe
      var midR = (d.outerR + d.innerOR) / 2 * 0.55;
      var spiralAngle = d.angle + t * Math.PI * 6 + time * 1.5;
      p.position.set(x, Math.cos(spiralAngle) * midR, d.passZ + Math.sin(spiralAngle) * midR);
      if (p.material.opacity !== undefined) {
        p.material.opacity = 0.35 + 0.25 * Math.sin(t * Math.PI * 3 + time * 2);
      }
    }
  }

  dphe3D.hotParticles.forEach(function(p) { updateFlow(p, 0.003); });
  dphe3D.coldParticles.forEach(function(p) { updateFlow(p, 0.0025); });

  dphe3D.controls.update();
  dphe3D.renderer.render(dphe3D.scene, dphe3D.camera);
}

function updateDPHE3D() {
  if (!dphe3D.initialized) return;
  buildDPHEScene();
}

/* ═══════════════════════════════════════════════════════════════
   3D STHE (Shell & Tube Heat Exchanger) Visualization
   ═══════════════════════════════════════════════════════════════ */
function initSTHE3D(container) {
  container.innerHTML = '';
  var w = container.clientWidth || 600;
  var h = container.clientHeight || 350;

  sthe3D.scene = new THREE.Scene();
  sthe3D.scene.fog = new THREE.Fog(0x0a1020, 16, 46);
  sthe3D.camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 200);
  sthe3D.camera.position.set(0, 2, 10);

  sthe3D.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  sthe3D.renderer.setSize(w, h);
  sthe3D.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  sthe3D.renderer.shadowMap.enabled = true;
  sthe3D.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(sthe3D.renderer.domElement);

  sthe3D.controls = new CustomOrbitControls(sthe3D.camera, sthe3D.renderer.domElement);
  sthe3D.controls.enableDamping = true;
  sthe3D.controls.dampingFactor = 0.08;
  sthe3D.controls.autoRotate = true;
  sthe3D.controls.autoRotateSpeed = 1.2;

  // Industrial hall lighting: cool skylight + warm key with shadows + fill accents
  var hemi = new THREE.HemisphereLight(0xbcd4e8, 0x1c2127, 0.55);
  sthe3D.scene.add(hemi);
  var key = new THREE.DirectionalLight(0xfff1dd, 0.9);
  key.position.set(6, 10, 6);
  key.castShadow = true;
  key.shadow.mapSize.width = 1024;
  key.shadow.mapSize.height = 1024;
  key.shadow.camera.left = -8; key.shadow.camera.right = 8;
  key.shadow.camera.top = 8; key.shadow.camera.bottom = -8;
  key.shadow.camera.far = 40;
  sthe3D.scene.add(key);
  var fill = new THREE.PointLight(0x88b7ff, 0.28, 40);
  fill.position.set(-6, 3, -4);
  sthe3D.scene.add(fill);
  var accent = new THREE.PointLight(0xffa04d, 0.35, 30);
  accent.position.set(-3, 2.5, 4);
  sthe3D.scene.add(accent);

  buildSTHEScene();
  sthe3D.initialized = true;
  animateSTHE();

  window.addEventListener('resize', function() {
    var nw = container.clientWidth || 600;
    var nh = container.clientHeight || 350;
    sthe3D.camera.aspect = nw / nh;
    sthe3D.camera.updateProjectionMatrix();
    sthe3D.renderer.setSize(nw, nh);
  });
}

function stheMakeLabel(text, color) {
  var cv = document.createElement('canvas');
  cv.width = 320; cv.height = 80;
  var ctx = cv.getContext('2d');
  ctx.fillStyle = 'rgba(8,14,28,0.72)';
  var r = 16, bw = 312, bh = 62, bx = 4, by = 8;
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.arcTo(bx + bw, by, bx + bw, by + bh, r);
  ctx.arcTo(bx + bw, by + bh, bx, by + bh, r);
  ctx.arcTo(bx, by + bh, bx, by, r);
  ctx.arcTo(bx, by, bx + bw, by, r);
  ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = 3; ctx.stroke();
  ctx.font = 'bold 34px Arial';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 160, 41);
  var tex = new THREE.CanvasTexture(cv);
  var mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
  var sp = new THREE.Sprite(mat);
  sp.scale.set(1.5, 0.375, 1);
  return sp;
}

function buildSTHEScene() {
  if (!sthe3D.scene) return;
  if (sthe3D.root) sthe3D.scene.remove(sthe3D.root);
  sthe3D.hotParticles = [];
  sthe3D.coldParticles = [];

  var Nt = parseInt(document.getElementById('sthe-num-tubes')?.value) || 100;
  var tubeOD = parseFloat(document.getElementById('sthe-tube-od')?.value) || 19.05;
  var tubeL_mm = parseFloat(document.getElementById('sthe-tube-L')?.value) || 7315;
  if (tubeL_mm > 0 && tubeL_mm < 50) tubeL_mm *= 1000; // value entered in metres
  var tubeL_m = tubeL_mm / 1000;
  var Ds_mm = parseFloat(document.getElementById('sthe-shell-id')?.value) || 300;
  var baffleSpace_mm = parseFloat(document.getElementById('sthe-baffle-space')?.value) || 90;
  var baffleCut = parseFloat(document.getElementById('sthe-baffle-cut')?.value) || 25;

  var sf = 6;
  var shellR = (Ds_mm / 2000) * sf;
  if (!(shellR > 0.1)) shellR = 0.9;
  var tubeR = (tubeOD / 2000) * sf;
  if (!(tubeR > 0.01)) tubeR = 0.057;
  var pipeLen = tubeL_m * 1.0;
  if (!(pipeLen > 0.5)) pipeLen = 3;
  if (pipeLen > 8) pipeLen = 8;
  var baffleGap = (baffleSpace_mm / 1000) * sf;
  if (!(baffleGap > 0.2)) baffleGap = 0.5;

  var root = new THREE.Group();
  sthe3D.root = root;

  /* ---- Materials (industrial paint scheme) ---- */
  var shellPaint = new THREE.MeshStandardMaterial({ color: 0x9fb4c7, metalness: 0.55, roughness: 0.42, side: THREE.DoubleSide });
  var headPaint = new THREE.MeshStandardMaterial({ color: 0x37648f, metalness: 0.5, roughness: 0.45 });
  var metalMat = new THREE.MeshStandardMaterial({ color: 0x8a97a0, metalness: 0.85, roughness: 0.28 });
  var boltMat = new THREE.MeshStandardMaterial({ color: 0x4d565e, metalness: 0.9, roughness: 0.35 });
  var tubeMat = new THREE.MeshStandardMaterial({ color: 0xc98a4b, metalness: 0.8, roughness: 0.32 });
  var baffleMat = new THREE.MeshStandardMaterial({ color: 0x6f8290, metalness: 0.7, roughness: 0.4, transparent: true, opacity: 0.92, side: THREE.DoubleSide });
  var saddleMat = new THREE.MeshStandardMaterial({ color: 0x5c6770, metalness: 0.6, roughness: 0.55 });
  var concreteMat = new THREE.MeshStandardMaterial({ color: 0x565b63, metalness: 0.05, roughness: 0.95 });
  var edgeMat = new THREE.MeshStandardMaterial({ color: 0xd9e2ea, metalness: 0.4, roughness: 0.5 });

  var floorY = -shellR * 2.05;

  /* ---- Factory floor + grid ---- */
  var floorMat = new THREE.MeshStandardMaterial({ color: 0x2b3138, metalness: 0.1, roughness: 0.95 });
  var floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  floor.receiveShadow = true;
  root.add(floor);
  var grid = new THREE.GridHelper(30, 60, 0x44515e, 0x333c46);
  grid.position.y = floorY + 0.002;
  root.add(grid);

  /* ---- Shell barrel with cutaway window (upper-front quarter removed) ---- */
  var shellGeo = new THREE.CylinderGeometry(shellR, shellR, pipeLen, 48, 1, true, Math.PI / 2, Math.PI * 1.5);
  var shellMesh = new THREE.Mesh(shellGeo, shellPaint);
  shellMesh.rotation.z = Math.PI / 2;
  shellMesh.castShadow = true;
  root.add(shellMesh);
  // Bright cut edges along the cutaway opening
  var edge1 = new THREE.Mesh(new THREE.BoxGeometry(pipeLen, 0.02, 0.045), edgeMat);
  edge1.position.set(0, 0.01, shellR);
  root.add(edge1);
  var edge2 = new THREE.Mesh(new THREE.BoxGeometry(pipeLen, 0.045, 0.02), edgeMat);
  edge2.position.set(0, shellR, 0.01);
  root.add(edge2);

  /* ---- Tube sheets ---- */
  for (var tsi = 0; tsi < 2; tsi++) {
    var tsGeo = new THREE.CylinderGeometry(shellR * 1.28, shellR * 1.28, 0.06, 40);
    var tsMesh = new THREE.Mesh(tsGeo, metalMat);
    tsMesh.rotation.z = Math.PI / 2;
    tsMesh.position.x = tsi === 0 ? -pipeLen / 2 : pipeLen / 2;
    tsMesh.castShadow = true;
    root.add(tsMesh);
  }

  /* ---- Girth flanges + bolt rings at both ends ---- */
  var chLen = Math.max(shellR * 0.85, 0.45);
  for (var fli = 0; fli < 2; fli++) {
    var sgn = fli === 0 ? -1 : 1;
    for (var ff = 0; ff < 2; ff++) {
      var fx = sgn * (pipeLen / 2 + 0.06 + ff * 0.075);
      var flGeo = new THREE.CylinderGeometry(shellR * 1.22, shellR * 1.22, 0.065, 40);
      var flMesh = new THREE.Mesh(flGeo, metalMat);
      flMesh.rotation.z = Math.PI / 2;
      flMesh.position.x = fx;
      flMesh.castShadow = true;
      root.add(flMesh);
    }
    // Bolt circle
    for (var bo = 0; bo < 14; bo++) {
      var bAng = (bo / 14) * Math.PI * 2;
      var bGeo2 = new THREE.CylinderGeometry(shellR * 0.045, shellR * 0.045, 0.3, 8);
      var bMesh2 = new THREE.Mesh(bGeo2, boltMat);
      bMesh2.rotation.z = Math.PI / 2;
      bMesh2.position.set(sgn * (pipeLen / 2 + 0.1), Math.cos(bAng) * shellR * 1.13, Math.sin(bAng) * shellR * 1.13);
      root.add(bMesh2);
    }
  }

  /* ---- Channel head (front) and rear bonnet: barrel + dished end ---- */
  for (var hd = 0; hd < 2; hd++) {
    var hsgn = hd === 0 ? -1 : 1;
    var barrelGeo = new THREE.CylinderGeometry(shellR * 1.02, shellR * 1.02, chLen, 40, 1, true);
    var barrel = new THREE.Mesh(barrelGeo, headPaint);
    barrel.rotation.z = Math.PI / 2;
    barrel.position.x = hsgn * (pipeLen / 2 + 0.16 + chLen / 2);
    barrel.castShadow = true;
    root.add(barrel);
    // Elliptical dished end
    var dishGeo = new THREE.SphereGeometry(shellR * 1.02, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    var dish = new THREE.Mesh(dishGeo, headPaint);
    dish.rotation.z = hsgn === -1 ? Math.PI / 2 : -Math.PI / 2;
    dish.scale.x = 0.55;
    dish.position.x = hsgn * (pipeLen / 2 + 0.16 + chLen);
    dish.castShadow = true;
    root.add(dish);
  }

  /* ---- Tube bundle: triangular-pitch layout ---- */
  var pitch = tubeR * 2.6;
  var tubePositions = [];
  var maxShowTubes = Math.min(Nt, 110);
  var rowsMax = Math.floor((shellR * 0.86) / (pitch * 0.866)) + 1;
  outer:
  for (var row = -rowsMax; row <= rowsMax; row++) {
    var yPos = row * pitch * 0.866;
    var xOff = (row % 2 === 0) ? 0 : pitch / 2;
    var colsMax = Math.floor((shellR * 0.86) / pitch) + 1;
    for (var col = -colsMax; col <= colsMax; col++) {
      var zPos = col * pitch + xOff;
      if (Math.sqrt(yPos * yPos + zPos * zPos) <= shellR * 0.86 - tubeR) {
        tubePositions.push({ y: yPos, z: zPos });
        if (tubePositions.length >= maxShowTubes) break outer;
      }
    }
  }
  if (tubePositions.length === 0) tubePositions.push({ y: 0, z: 0 });

  tubePositions.forEach(function(pos) {
    var tGeo = new THREE.CylinderGeometry(tubeR, tubeR, pipeLen + 0.1, 8);
    var tMesh = new THREE.Mesh(tGeo, tubeMat);
    tMesh.rotation.z = Math.PI / 2;
    tMesh.position.set(0, pos.y, pos.z);
    root.add(tMesh);
  });

  /* ---- Segmental baffles (disc with chord cut, alternating) ---- */
  var numBaffles = Math.floor(pipeLen / baffleGap) - 1;
  if (numBaffles < 1) numBaffles = 1;
  if (numBaffles > 20) numBaffles = 20;
  var cutFraction = Math.min(Math.max(baffleCut / 100, 0.1), 0.45);
  var chordN = 1 - 2 * cutFraction;
  var th1 = Math.asin(Math.min(Math.max(chordN, -0.95), 0.95));
  var bR = shellR * 0.97;
  var bShape = new THREE.Shape();
  bShape.absarc(0, 0, bR, Math.PI - th1, Math.PI * 2 + th1, false);
  var bGeoBase = new THREE.ExtrudeGeometry(bShape, { depth: 0.025, bevelEnabled: false });
  for (var bi = 0; bi < numBaffles; bi++) {
    var bx = -pipeLen / 2 + baffleGap * (bi + 1);
    if (bx > pipeLen / 2 - 0.1) break;
    var bMesh = new THREE.Mesh(bGeoBase, baffleMat);
    bMesh.position.x = bx;
    bMesh.rotation.y = Math.PI / 2;
    if (bi % 2 === 1) bMesh.rotation.x = Math.PI; // alternate cut top/bottom
    root.add(bMesh);
  }

  /* ---- Nozzles with weld-neck flanges, flow arrows and labels ---- */
  var nozzleR = Math.max(shellR * 0.2, 0.12);
  function addNozzle(x, dirY, pipeR, len, mat, label, labelColor, arrowIn) {
    var yBase = dirY > 0 ? shellR * 0.9 : -shellR * 0.9;
    var g = new THREE.CylinderGeometry(pipeR, pipeR, len, 16);
    var m = new THREE.Mesh(g, mat);
    m.position.set(x, yBase + dirY * len / 2, 0);
    m.castShadow = true;
    root.add(m);
    var yTop = yBase + dirY * len;
    var fG = new THREE.CylinderGeometry(pipeR * 1.7, pipeR * 1.7, 0.055, 20);
    var fM = new THREE.Mesh(fG, metalMat);
    fM.position.set(x, yTop, 0);
    root.add(fM);
    // Small bolt heads on nozzle flange
    for (var nb = 0; nb < 8; nb++) {
      var nbA = (nb / 8) * Math.PI * 2;
      var nbG = new THREE.CylinderGeometry(pipeR * 0.14, pipeR * 0.14, 0.09, 6);
      var nbM = new THREE.Mesh(nbG, boltMat);
      nbM.position.set(x + Math.cos(nbA) * pipeR * 1.38, yTop, Math.sin(nbA) * pipeR * 1.38);
      root.add(nbM);
    }
    // Flow arrow (cone): inlet points toward vessel, outlet points away
    var arrowDir = arrowIn ? -dirY : dirY;
    var aG = new THREE.ConeGeometry(pipeR * 0.75, pipeR * 2.3, 12);
    var aM = new THREE.Mesh(aG, new THREE.MeshBasicMaterial({ color: labelColor }));
    aM.position.set(x, yTop + dirY * pipeR * 2.2, 0);
    aM.rotation.z = arrowDir > 0 ? 0 : Math.PI;
    root.add(aM);
    var sp = stheMakeLabel(label, '#' + labelColor.toString(16).padStart(6, '0'));
    sp.position.set(x, yTop + dirY * (pipeR * 2.2 + 0.55), 0);
    root.add(sp);
  }
  var chMidF = -(pipeLen / 2 + 0.16 + chLen / 2);
  var chMidR = pipeLen / 2 + 0.16 + chLen / 2;
  addNozzle(-pipeLen * 0.38, 1, nozzleR, shellR * 0.85, shellPaint, 'SHELL IN', 0x4aa8ff, true);
  addNozzle(pipeLen * 0.38, -1, nozzleR, shellR * 0.7, shellPaint, 'SHELL OUT', 0x9fd0ff, false);
  addNozzle(chMidF, -1, nozzleR * 0.85, shellR * 0.75, headPaint, 'TUBE IN', 0xff5533, true);
  addNozzle(chMidR, 1, nozzleR * 0.85, shellR * 0.75, headPaint, 'TUBE OUT', 0xffa05a, false);

  /* ---- Saddle supports on concrete pads ---- */
  for (var sdi = 0; sdi < 2; sdi++) {
    var sx = sdi === 0 ? -pipeLen * 0.28 : pipeLen * 0.28;
    var webH = (-shellR * 0.55) - (floorY + 0.16);
    var sdGeo = new THREE.BoxGeometry(0.14, webH, shellR * 1.9);
    var sdMesh = new THREE.Mesh(sdGeo, saddleMat);
    sdMesh.position.set(sx, floorY + 0.16 + webH / 2, 0);
    sdMesh.castShadow = true;
    root.add(sdMesh);
    // Curved saddle top (wraps under shell)
    var wrapGeo = new THREE.CylinderGeometry(shellR * 1.06, shellR * 1.06, 0.24, 24, 1, true, Math.PI * 0.72, Math.PI * 0.56);
    var wrap = new THREE.Mesh(wrapGeo, saddleMat);
    wrap.rotation.z = Math.PI / 2;
    wrap.position.set(sx, 0, 0);
    root.add(wrap);
    // Base plate
    var sbGeo = new THREE.BoxGeometry(0.3, 0.05, shellR * 2.2);
    var sbMesh = new THREE.Mesh(sbGeo, saddleMat);
    sbMesh.position.set(sx, floorY + 0.135, 0);
    root.add(sbMesh);
    // Concrete pad
    var cpGeo = new THREE.BoxGeometry(0.55, 0.11, shellR * 2.5);
    var cpMesh = new THREE.Mesh(cpGeo, concreteMat);
    cpMesh.position.set(sx, floorY + 0.055, 0);
    cpMesh.receiveShadow = true;
    root.add(cpMesh);
  }

  sthe3D.scene.add(root);

  /* ---- Flow particles ---- */
  var pGeo = new THREE.SphereGeometry(Math.max(tubeR * 0.55, 0.02), 6, 6);
  var showTubeParticles = Math.min(tubePositions.length, 14);
  for (var tpi = 0; tpi < showTubeParticles; tpi++) {
    var tp = tubePositions[Math.floor(tpi * tubePositions.length / showTubeParticles)];
    for (var ppi = 0; ppi < 3; ppi++) {
      var hP = new THREE.Mesh(pGeo, new THREE.MeshBasicMaterial({ color: 0xff4a26 }));
      hP.userData = { t: (ppi / 3 + tpi * 0.07) % 1, y: tp.y, z: tp.z, len: pipeLen, speed: 0.004 };
      root.add(hP);
      sthe3D.hotParticles.push(hP);
    }
  }

  // Shell-side particles: serpentine weave between baffles
  var shellPGeo = new THREE.SphereGeometry(Math.max(shellR * 0.055, 0.025), 6, 6);
  for (var spi = 0; spi < 26; spi++) {
    var cP = new THREE.Mesh(shellPGeo, new THREE.MeshBasicMaterial({ color: 0x3f8cff }));
    cP.userData = {
      t: Math.random(),
      zLane: (Math.random() - 0.5) * shellR * 1.1,
      amp: shellR * (0.45 + Math.random() * 0.18),
      gap: baffleGap,
      len: pipeLen,
      speed: 0.0022 + Math.random() * 0.0018,
      jitter: Math.random() * Math.PI * 2
    };
    root.add(cP);
    sthe3D.coldParticles.push(cP);
  }

  // Fit camera and sync orbit-control state so the fit actually takes effect
  var totalLen = pipeLen + 2 * (0.16 + chLen + shellR * 0.6);
  var viewDist = Math.max(totalLen * 1.0, shellR * 5.2);
  sthe3D.camera.position.set(viewDist * 0.3, viewDist * 0.4, viewDist * 0.95);
  sthe3D.controls.target.set(0, -shellR * 0.15, 0);
  sthe3D.controls.minDistance = viewDist * 0.25;
  sthe3D.controls.maxDistance = viewDist * 3;
  sthe3D.controls.updateSphericalFromCamera();
  sthe3D.controls.targetSpherical.radius = sthe3D.controls.spherical.radius;
  sthe3D.controls.targetSpherical.phi = sthe3D.controls.spherical.phi;
  sthe3D.controls.targetSpherical.theta = sthe3D.controls.spherical.theta;
}

function animateSTHE() {
  sthe3D.animationId = requestAnimationFrame(animateSTHE);
  if (!sthe3D.renderer) return;
  var time = Date.now() * 0.001;
  var cHot = { r: 1.0, g: 0.29, b: 0.15 }, cHotEnd = { r: 1.0, g: 0.69, b: 0.4 };
  var cCold = { r: 0.25, g: 0.55, b: 1.0 }, cColdEnd = { r: 0.62, g: 0.82, b: 1.0 };

  // Tube side: straight pass, colour cools from inlet to outlet
  sthe3D.hotParticles.forEach(function(p) {
    var d = p.userData;
    d.t = (d.t + d.speed) % 1;
    p.position.set(-d.len / 2 + d.t * d.len, d.y, d.z);
    p.material.color.setRGB(
      cHot.r + (cHotEnd.r - cHot.r) * d.t,
      cHot.g + (cHotEnd.g - cHot.g) * d.t,
      cHot.b + (cHotEnd.b - cHot.b) * d.t
    );
  });

  // Shell side: serpentine path crossing the bundle between baffles, warming up
  sthe3D.coldParticles.forEach(function(p) {
    var d = p.userData;
    d.t = (d.t + d.speed) % 1;
    var x = -d.len / 2 + d.t * d.len;
    var y = d.amp * Math.cos(Math.PI * (x + d.len / 2) / d.gap);
    var z = d.zLane + Math.sin(time * 1.4 + d.jitter) * 0.04;
    p.position.set(x, y, z);
    p.material.color.setRGB(
      cCold.r + (cColdEnd.r - cCold.r) * d.t,
      cCold.g + (cColdEnd.g - cCold.g) * d.t,
      cCold.b + (cColdEnd.b - cCold.b) * d.t
    );
  });

  sthe3D.controls.update();
  sthe3D.renderer.render(sthe3D.scene, sthe3D.camera);
}

function updateSTHE3D() {
  if (!sthe3D.initialized) return;
  buildSTHEScene();
}

// Wire DPHE inputs to rebuild 3D on change
['dphe-di','dphe-do','dphe-d2','dphe-length','dphe-hairpins'].forEach(function(id) {
  var el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', function() { if (dphe3D.initialized) updateDPHE3D(); });
    el.addEventListener('change', function() { if (dphe3D.initialized) updateDPHE3D(); });
  }
});

// Wire STHE inputs to rebuild 3D on change
['sthe-num-tubes','sthe-tube-od','sthe-tube-id','sthe-tube-L','sthe-shell-id','sthe-baffle-space','sthe-baffle-cut','sthe-baffle-ratio','sthe-rear-head'].forEach(function(id) {
  var el = document.getElementById(id);
  if (el) {
    el.addEventListener('input', function() { if (sthe3D.initialized) updateSTHE3D(); });
    el.addEventListener('change', function() { if (sthe3D.initialized) updateSTHE3D(); });
  }
});

/* ═══════════════════════════════════════════════════════════════
   3D GAS LINE VISUALIZATION
   ═══════════════════════════════════════════════════════════════ */
function initGas3D(container) {
  container.innerHTML = '';
  var w = container.clientWidth || 600;
  var h = container.clientHeight || 300;

  gas3D.scene = new THREE.Scene();
  gas3D.camera = new THREE.PerspectiveCamera(35, w / h, 0.1, 200);
  gas3D.camera.position.set(0, 4, 14);

  gas3D.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  gas3D.renderer.setSize(w, h);
  gas3D.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  gas3D.renderer.shadowMap.enabled = true;
  container.appendChild(gas3D.renderer.domElement);

  gas3D.controls = new CustomOrbitControls(gas3D.camera, gas3D.renderer.domElement);
  gas3D.controls.enableDamping = true;
  gas3D.controls.dampingFactor = 0.08;
  gas3D.controls.autoRotate = true;
  gas3D.controls.autoRotateSpeed = 0.4;

  gas3D.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  var dLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dLight.position.set(5, 8, 5);
  dLight.castShadow = true;
  gas3D.scene.add(dLight);
  gas3D.scene.add(new THREE.PointLight(0x4fc3f7, 0.4, 30));

  buildGas3DScene();
  gas3D.initialized = true;
  animateGas3D();

  window.addEventListener('resize', function() {
    var nw = container.clientWidth || 600;
    var nh = container.clientHeight || 300;
    gas3D.camera.aspect = nw / nh;
    gas3D.camera.updateProjectionMatrix();
    gas3D.renderer.setSize(nw, nh);
  });
}

function buildGas3DScene() {
  if (!gas3D.scene) return;
  while (gas3D.scene.children.length > 3) gas3D.scene.remove(gas3D.scene.children[3]);
  gas3D.particles = [];

  // Read pipe dimensions from inputs
  var npsEl = document.getElementById('gas-nps');
  var schEl = document.getElementById('gas-schedule');
  var nps = npsEl ? parseFloat(npsEl.value) || 3 : 3;
  var sch = schEl ? schEl.value : '40';
  var lengthM = parseFloat(document.getElementById('gas-length')?.value) || 10;
  var elevM = parseFloat(document.getElementById('gas-elevation')?.value) || 0;

  // Get pipe OD and ID from lineSizeData if available
  var pipeOD_mm = nps * 25.4;
  var pipeID_mm = pipeOD_mm * 0.85;
  if (window.lineSizeData && window.lineSizeData[nps] && window.lineSizeData[nps].od) {
    pipeOD_mm = window.lineSizeData[nps].od;
    if (window.lineSizeData[nps].schedules && window.lineSizeData[nps].schedules[sch]) {
      pipeID_mm = window.lineSizeData[nps].schedules[sch];
    }
  }

  // Scale for visualization (scene units ~1-8)
  var sf = 0.012;
  var pipeR = (pipeOD_mm / 2) * sf;
  var pipeIR = (pipeID_mm / 2) * sf;
  if (pipeR < 0.15) pipeR = 0.15;
  if (pipeIR < 0.1) pipeIR = 0.1;
  var sceneLen = Math.min(Math.max(lengthM * 0.5, 3), 10);
  var sceneElev = Math.min(elevM * 0.1, 3);

  var group = new THREE.Group();
  var metalMat = new THREE.MeshStandardMaterial({ color: 0x78909c, metalness: 0.85, roughness: 0.2 });
  var pipeMat = new THREE.MeshStandardMaterial({ color: 0x546e7a, metalness: 0.7, roughness: 0.3 });
  var innerMat = new THREE.MeshStandardMaterial({
    color: 0x263238, metalness: 0.3, roughness: 0.5, transparent: true, opacity: 0.4, side: THREE.DoubleSide
  });

  // Horizontal inlet pipe section
  var horizLen = sceneLen * 0.4;
  var hPipeGeo = new THREE.CylinderGeometry(pipeR, pipeR, horizLen, 20);
  var hPipe = new THREE.Mesh(hPipeGeo, pipeMat);
  hPipe.rotation.z = Math.PI / 2;
  hPipe.position.set(-sceneLen * 0.3, 0, 0);
  group.add(hPipe);

  // Elbow (90 bend going up)
  if (sceneElev > 0.2) {
    var bendR = pipeR * 3;
    var elbowGeo = new THREE.TorusGeometry(bendR, pipeR, 12, 16, Math.PI / 2);
    var elbow = new THREE.Mesh(elbowGeo, pipeMat);
    elbow.position.set(-sceneLen * 0.1 + bendR, bendR, 0);
    elbow.rotation.z = Math.PI;
    group.add(elbow);

    // Vertical riser
    var vertLen = sceneElev;
    var vPipeGeo = new THREE.CylinderGeometry(pipeR, pipeR, vertLen, 20);
    var vPipe = new THREE.Mesh(vPipeGeo, pipeMat);
    vPipe.position.set(-sceneLen * 0.1, bendR * 2 + vertLen / 2, 0);
    group.add(vPipe);

    // Top elbow
    var elbow2Geo = new THREE.TorusGeometry(bendR, pipeR, 12, 16, Math.PI / 2);
    var elbow2 = new THREE.Mesh(elbow2Geo, pipeMat);
    elbow2.position.set(-sceneLen * 0.1 + bendR, bendR * 2 + vertLen + bendR, 0);
    elbow2.rotation.z = Math.PI / 2;
    group.add(elbow2);

    // Horizontal outlet pipe after riser
    var outLen = sceneLen * 0.4;
    var oPipeGeo = new THREE.CylinderGeometry(pipeR, pipeR, outLen, 20);
    var oPipe = new THREE.Mesh(oPipeGeo, pipeMat);
    oPipe.rotation.z = Math.PI / 2;
    oPipe.position.set(sceneLen * 0.15, bendR * 2 + vertLen + bendR * 2, 0);
    group.add(oPipe);
  } else {
    // Just a straight pipe with flanges
    var straightLen = sceneLen * 0.6;
    var sPipeGeo = new THREE.CylinderGeometry(pipeR, pipeR, straightLen, 20);
    var sPipe = new THREE.Mesh(sPipeGeo, pipeMat);
    sPipe.rotation.z = Math.PI / 2;
    sPipe.position.set(sceneLen * 0.1, 0, 0);
    group.add(sPipe);
  }

  // Flanges at pipe ends
  for (var fi = 0; fi < 2; fi++) {
    var fShape = new THREE.Shape();
    fShape.absarc(0, 0, pipeR * 1.5, 0, Math.PI * 2, false);
    var fHole = new THREE.Path();
    fHole.absarc(0, 0, pipeR, 0, Math.PI * 2, true);
    fShape.holes.push(fHole);
    var fGeo = new THREE.ExtrudeGeometry(fShape, { depth: 0.04, bevelEnabled: false });
    var fMesh = new THREE.Mesh(fGeo, metalMat);
    if (fi === 0) {
      fMesh.position.set(-sceneLen * 0.5, 0, 0);
    } else {
      if (sceneElev > 0.2) {
        var bendR2 = pipeR * 3;
        fMesh.position.set(sceneLen * 0.35, bendR2 * 2 + sceneElev + bendR2 * 2, 0);
      } else {
        fMesh.position.set(sceneLen * 0.4, 0, 0);
      }
    }
    fMesh.rotation.y = Math.PI / 2;
    group.add(fMesh);
  }

  // Gate valve (wedge body on horizontal inlet)
  var valveBodyGeo = new THREE.CylinderGeometry(pipeR * 1.3, pipeR * 1.3, pipeR * 2, 8);
  var valveBody = new THREE.Mesh(valveBodyGeo, metalMat);
  valveBody.position.set(-sceneLen * 0.35, 0, 0);
  group.add(valveBody);
  // Valve stem
  var stemGeo = new THREE.CylinderGeometry(pipeR * 0.15, pipeR * 0.15, pipeR * 4, 8);
  var stem = new THREE.Mesh(stemGeo, metalMat);
  stem.position.set(-sceneLen * 0.35, pipeR * 2.5, 0);
  group.add(stem);
  // Valve handwheel
  var hwGeo = new THREE.TorusGeometry(pipeR * 1.2, pipeR * 0.12, 8, 16);
  var hw = new THREE.Mesh(hwGeo, metalMat);
  hw.position.set(-sceneLen * 0.35, pipeR * 4.5, 0);
  hw.rotation.x = Math.PI / 2;
  group.add(hw);

  // Pressure gauge on inlet
  var gaugeGeo = new THREE.SphereGeometry(pipeR * 0.6, 12, 12);
  var gaugeMat = new THREE.MeshStandardMaterial({ color: 0xffc107, metalness: 0.5, roughness: 0.4 });
  var gauge = new THREE.Mesh(gaugeGeo, gaugeMat);
  gauge.position.set(-sceneLen * 0.2, pipeR * 1.8, 0);
  group.add(gauge);
  var gaugeStubGeo = new THREE.CylinderGeometry(pipeR * 0.15, pipeR * 0.15, pipeR * 1.5, 6);
  var gaugeStub = new THREE.Mesh(gaugeStubGeo, metalMat);
  gaugeStub.position.set(-sceneLen * 0.2, pipeR * 0.8, 0);
  group.add(gaugeStub);

  // Pipe supports
  for (var si = 0; si < 3; si++) {
    var sx = -sceneLen * 0.4 + si * sceneLen * 0.35;
    var supportGeo = new THREE.BoxGeometry(0.06, pipeR * 2, pipeR * 2.5);
    var support = new THREE.Mesh(supportGeo, metalMat);
    support.position.set(sx, -pipeR * 1.5, 0);
    group.add(support);
  }

  // Center the group
  group.position.set(0, -0.5, 0);
  gas3D.scene.add(group);

  // Flow particles (gas = small cyan dots moving through pipe)
  var particleMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff });
  var pGeo = new THREE.SphereGeometry(pipeR * 0.2, 6, 6);
  for (var pi = 0; pi < 25; pi++) {
    var p = new THREE.Mesh(pGeo, particleMat);
    var angle = Math.random() * Math.PI * 2;
    var rad = Math.random() * pipeIR * 0.7;
    p.userData = {
      t: Math.random(),
      angle: angle,
      radius: rad,
      sceneLen: sceneLen,
      sceneElev: sceneElev,
      pipeR: pipeR,
      speed: 0.003 + Math.random() * 0.004
    };
    gas3D.scene.add(p);
    gas3D.particles.push(p);
  }

  gas3D.camera.position.set(0, 3, Math.max(sceneLen * 1.3, 8));
  gas3D.controls.target.set(0, sceneElev > 0.2 ? sceneElev * 0.3 : 0, 0);
}

function animateGas3D() {
  gas3D.animationId = requestAnimationFrame(animateGas3D);
  if (!gas3D.renderer) return;

  gas3D.particles.forEach(function(p) {
    var d = p.userData;
    d.t = (d.t + d.speed) % 1;
    var sl = d.sceneLen;
    var se = d.sceneElev;
    var br = d.pipeR * 3;

    if (se > 0.2) {
      // Path: horizontal -> bend -> vertical -> bend -> horizontal
      var totalPath = sl * 0.4 + Math.PI * br / 2 + se + Math.PI * br / 2 + sl * 0.4;
      var pos = d.t * totalPath;
      var seg1 = sl * 0.4;
      var seg2 = seg1 + Math.PI * br / 2;
      var seg3 = seg2 + se;
      var seg4 = seg3 + Math.PI * br / 2;

      if (pos < seg1) {
        p.position.set(-sl * 0.5 + pos + Math.cos(d.angle) * d.radius * 0.1, Math.sin(d.angle) * d.radius, Math.cos(d.angle + 1) * d.radius);
      } else if (pos < seg2) {
        var a = (pos - seg1) / (Math.PI * br / 2) * Math.PI / 2;
        p.position.set(-sl * 0.1 + br - Math.cos(a) * br, br - br + Math.sin(a) * br, Math.cos(d.angle) * d.radius);
      } else if (pos < seg3) {
        var vy = pos - seg2;
        p.position.set(-sl * 0.1 + Math.cos(d.angle) * d.radius * 0.1, br * 2 + vy, Math.cos(d.angle) * d.radius);
      } else if (pos < seg4) {
        var a2 = (pos - seg3) / (Math.PI * br / 2) * Math.PI / 2;
        var topY = br * 2 + se;
        p.position.set(-sl * 0.1 + br * Math.sin(a2), topY + br * (1 - Math.cos(a2)), Math.cos(d.angle) * d.radius);
      } else {
        var hx = pos - seg4;
        p.position.set(-sl * 0.1 + br + hx, br * 2 + se + br * 2, Math.cos(d.angle) * d.radius);
      }
    } else {
      p.position.set(-sl * 0.5 + d.t * sl, Math.sin(d.angle) * d.radius, Math.cos(d.angle) * d.radius);
    }
    p.position.y -= 0.5;
  });

  gas3D.controls.update();
  gas3D.renderer.render(gas3D.scene, gas3D.camera);
}

function updateGas3D() {
  if (!gas3D.initialized) return;
  buildGas3DScene();
}

// Wire gas inputs to rebuild 3D on change
['gas-nps','gas-schedule','gas-length','gas-elevation'].forEach(function(id) {
  var el = document.getElementById(id);
  if (el) {
    el.addEventListener('change', function() { if (gas3D.initialized) updateGas3D(); });
  }
});

/* ═══════════════════════════════════════════════════════════════
   INDIVIDUAL SECTION DOWNLOAD REPORT BUTTONS
   ═══════════════════════════════════════════════════════════════ */
(function() {
  function downloadTextReport(filename, content) {
    var blob = new Blob([content], { type: 'text/plain' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  var sep = '═══════════════════════════════════════════════════\n';
  var line = '───────────────────────────────────────────────────\n';
  var ts = function() { return new Date().toLocaleString(); };
  var gt = function(id) { var el = document.getElementById(id); return el ? el.textContent.trim() : '-'; };
  var fmtU = function(val, type, dp) {
    if (typeof window.formatUnit === 'function') {
      var f = window.formatUnit(val, type, dp);
      return f.value + ' ' + f.symbol;
    }
    return val.toFixed(dp || 2);
  };

  // 1. PUMP REPORT — Preview Modal + Download
  function buildPumpSVGDiagram(pIn, pOut) {
    var vesselP_g = pIn.vesselPressG || 0;
    var vesselP_a = pIn.vesselPressA || pIn.pVesselA || 1.013;
    var vesselEl = pIn.zVessel || 0;
    var lll = pIn.lll || 0;
    var centreEl = pIn.zPump || 0;
    var staticHead = pOut.Hs || 0;
    var sucPress = pOut.pSucA !== undefined ? (pOut.pSucA - (pIn.pAtm || 1.01325)) : 0;
    var disPress = pOut.pDischG !== undefined ? pOut.pDischG : 0;
    var npsha = pOut.npsha || 0;
    var npshr = pIn.npshr || 0;
    var cavOK = pOut.cavType === 'ok';
    var dischEl = pIn.zDisch || 0;
    var destP = pIn.destA || 0;
    // Both auto-selected and user-selected nozzles
    var autoSucNozzle = pOut.sucNozzle;
    var autoDisNozzle = pOut.disNozzle;
    var checkSucNozzle = pOut.checkSucNozzle || autoSucNozzle;
    var checkDisNozzle = pOut.checkDisNozzle || autoDisNozzle;
    var sucDp = pIn.sucDp || 0;
    var disDp = pIn.dischDp || 0;
    var diffHead = pOut.diffHeadCal || 0;
    var pumpDp = pOut.pumpDp || 0;
    var isAtmospheric = pIn.sucSourceType === 'atmospheric';
    var isNegativeEl = vesselEl < 0;

    // Fixed layout zones
    var gradeY = 380;
    var vesselTopY = 30;
    var vesselH = 180;
    var vesselBaseY = vesselTopY + vesselH;
    var vesselMidX = 140;

    // Pump/motor area
    var pumpCX = 420;
    var pumpY = gradeY - 15;
    var dischPipeEndY = Math.max(80, gradeY - 50 - Math.min(Math.max(dischEl, 0) * 5, 140));

    var svg = '<svg viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:800px;background:#f8fafc;border-radius:8px;border:1px solid #cbd5e1;">'
      + '<defs><linearGradient id="tankG" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#93c5fd"/><stop offset="100%" stop-color="#2563eb"/></linearGradient>'
      + '<linearGradient id="pumpG" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#6366f1"/><stop offset="100%" stop-color="#4f46e5"/></linearGradient>'
      + '<marker id="arrowP" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 0 L 10 5 L 0 10 z" fill="#475569"/></marker></defs>';

    // === VESSEL ===
    svg += '<rect x="90" y="' + vesselTopY + '" width="100" height="' + vesselH + '" rx="6" fill="url(#tankG)" stroke="#1e40af" stroke-width="2"/>';
    if (isAtmospheric) {
      svg += '<line x1="90" y1="' + vesselTopY + '" x2="90" y2="' + (vesselTopY - 12) + '" stroke="#1e40af" stroke-width="2.5"/>'
        + '<line x1="190" y1="' + vesselTopY + '" x2="190" y2="' + (vesselTopY - 12) + '" stroke="#1e40af" stroke-width="2.5"/>'
        + '<text x="' + vesselMidX + '" y="' + (vesselTopY - 15) + '" text-anchor="middle" font-size="7" fill="#1e40af">(Open / Atmospheric)</text>';
    } else {
      svg += '<ellipse cx="' + vesselMidX + '" cy="' + vesselTopY + '" rx="50" ry="10" fill="#93c5fd" stroke="#1e40af" stroke-width="2"/>';
    }
    svg += '<ellipse cx="' + vesselMidX + '" cy="' + vesselBaseY + '" rx="50" ry="10" fill="#2563eb" stroke="#1e40af" stroke-width="2"/>';
    var liqH = Math.min(Math.abs(lll) * 8, vesselH - 10);
    svg += '<rect x="90" y="' + (vesselBaseY - liqH) + '" width="100" height="' + liqH + '" fill="rgba(37,99,235,0.3)"/>';
    svg += '<text x="' + vesselMidX + '" y="' + (vesselTopY - (isAtmospheric ? 28 : 18)) + '" text-anchor="middle" font-size="11" font-weight="bold" fill="#1e40af">Suction Vessel</text>';

    // Vessel pressure (left side)
    svg += '<text x="10" y="' + (vesselTopY + 35) + '" font-size="9" font-weight="bold" fill="#1e40af">Vessel Pressure</text>'
      + '<text x="10" y="' + (vesselTopY + 48) + '" font-size="11" font-weight="bold" fill="#dc2626">' + vesselP_g.toFixed(1) + ' bar (G)</text>'
      + '<text x="10" y="' + (vesselTopY + 60) + '" font-size="9" fill="#1e40af">= ' + vesselP_a.toFixed(3) + ' bar (A)</text>';

    // LLL (right of vessel)
    svg += '<text x="200" y="' + (vesselTopY + 35) + '" font-size="9" font-weight="bold" fill="#1e40af">Liquid Level (LLL)</text>'
      + '<text x="200" y="' + (vesselTopY + 50) + '" font-size="11" font-weight="bold" fill="#2563eb">= ' + lll.toFixed(1) + ' m</text>';

    // Elevation label (below vessel)
    svg += '<text x="10" y="' + (vesselBaseY + 25) + '" font-size="9" font-weight="bold" fill="#1e40af">Elevation</text>'
      + '<text x="10" y="' + (vesselBaseY + 38) + '" font-size="10" fill="' + (isNegativeEl ? '#dc2626' : '#1e40af') + '">= ' + vesselEl.toFixed(1) + ' m' + (isNegativeEl ? ' (UNDERGROUND)' : '') + '</text>';

    // Support legs (for positive elevation)
    if (!isNegativeEl) {
      svg += '<line x1="100" y1="' + (vesselBaseY + 10) + '" x2="100" y2="' + gradeY + '" stroke="#64748b" stroke-width="3"/>'
        + '<line x1="180" y1="' + (vesselBaseY + 10) + '" x2="180" y2="' + gradeY + '" stroke="#64748b" stroke-width="3"/>'
        + '<line x1="80" y1="' + gradeY + '" x2="200" y2="' + gradeY + '" stroke="#64748b" stroke-width="3"/>';
    } else {
      svg += '<rect x="80" y="' + gradeY + '" width="120" height="20" rx="0" fill="rgba(220,38,38,0.08)" stroke="#dc2626" stroke-width="1" stroke-dasharray="4,2"/>';
    }

    // Suction pipe from vessel bottom to pump
    var sucPipeY = Math.min(vesselBaseY + 15, pumpY);
    svg += '<line x1="' + vesselMidX + '" y1="' + vesselBaseY + '" x2="' + vesselMidX + '" y2="' + sucPipeY + '" stroke="#475569" stroke-width="6" stroke-dasharray="8,4"/>'
      + '<line x1="' + vesselMidX + '" y1="' + sucPipeY + '" x2="' + (pumpCX - 40) + '" y2="' + pumpY + '" stroke="#475569" stroke-width="6"/>';

    // Pump circle
    svg += '<circle cx="' + pumpCX + '" cy="' + pumpY + '" r="28" fill="url(#pumpG)" stroke="#312e81" stroke-width="2.5"/>'
      + '<text x="' + pumpCX + '" y="' + (pumpY - 4) + '" text-anchor="middle" font-size="8" font-weight="bold" fill="white">PUMP</text>'
      + '<text x="' + pumpCX + '" y="' + (pumpY + 8) + '" text-anchor="middle" font-size="7" fill="#c7d2fe">' + (pOut.stdMotorKw || 0).toFixed(1) + ' kW</text>';

    // Motor
    svg += '<rect x="' + (pumpCX + 30) + '" y="' + (pumpY - 14) + '" width="55" height="28" rx="4" fill="#4338ca" stroke="#312e81" stroke-width="1.5"/>'
      + '<text x="' + (pumpCX + 57) + '" y="' + (pumpY + 4) + '" text-anchor="middle" font-size="8" font-weight="bold" fill="white">MOTOR</text>';

    // Discharge pipe
    var dischLineX = 580;
    svg += '<line x1="' + (pumpCX + 85) + '" y1="' + pumpY + '" x2="' + dischLineX + '" y2="' + pumpY + '" stroke="#475569" stroke-width="6"/>'
      + '<line x1="' + dischLineX + '" y1="' + pumpY + '" x2="' + dischLineX + '" y2="' + dischPipeEndY + '" stroke="#475569" stroke-width="6"/>'
      + '<line x1="' + dischLineX + '" y1="' + dischPipeEndY + '" x2="720" y2="' + dischPipeEndY + '" stroke="#475569" stroke-width="4" marker-end="url(#arrowP)"/>';

    // Valve symbols on discharge pipe
    var cvSymY = pumpY - (pumpY - dischPipeEndY) * 0.2;
    var gvSymY = pumpY - (pumpY - dischPipeEndY) * 0.45;
    var fmSymY = pumpY - (pumpY - dischPipeEndY) * 0.7;
    svg += '<circle cx="' + (dischLineX + 12) + '" cy="' + cvSymY + '" r="6" fill="#d97706" stroke="#92400e" stroke-width="1"/><text x="' + (dischLineX + 12) + '" y="' + (cvSymY + 3) + '" text-anchor="middle" font-size="5" fill="white">CV</text>'
      + '<circle cx="' + (dischLineX + 12) + '" cy="' + gvSymY + '" r="6" fill="#dc2626" stroke="#991b1b" stroke-width="1"/><text x="' + (dischLineX + 12) + '" y="' + (gvSymY + 3) + '" text-anchor="middle" font-size="5" fill="white">GV</text>'
      + '<rect x="' + (dischLineX + 6) + '" y="' + (fmSymY - 6) + '" width="12" height="12" rx="2" fill="#0ea5e9" stroke="#0369a1" stroke-width="1"/><text x="' + (dischLineX + 12) + '" y="' + (fmSymY + 3) + '" text-anchor="middle" font-size="5" fill="white">FM</text>';

    // === NOZZLE INFO TABLE (below vessel, showing both auto and selected) ===
    var nzY = vesselBaseY + 55;
    var autoSucLabel = autoSucNozzle ? 'NPS ' + autoSucNozzle.nps + '" (ID ' + autoSucNozzle.id.toFixed(1) + ' mm)' : '-';
    var autoDisLabel = autoDisNozzle ? 'NPS ' + autoDisNozzle.nps + '" (ID ' + autoDisNozzle.id.toFixed(1) + ' mm)' : '-';
    var chkSucLabel = checkSucNozzle ? 'NPS ' + checkSucNozzle.nps + '" (ID ' + checkSucNozzle.id.toFixed(1) + ' mm)' : '-';
    var chkDisLabel = checkDisNozzle ? 'NPS ' + checkDisNozzle.nps + '" (ID ' + checkDisNozzle.id.toFixed(1) + ' mm)' : '-';
    svg += '<rect x="10" y="' + nzY + '" width="260" height="52" rx="4" fill="#f8fafc" stroke="#94a3b8" stroke-width="1"/>'
      + '<text x="140" y="' + (nzY + 12) + '" text-anchor="middle" font-size="7" font-weight="bold" fill="#475569">NOZZLE SIZING</text>'
      + '<text x="15" y="' + (nzY + 25) + '" font-size="6.5" fill="#1e40af">Suc (auto): ' + autoSucLabel + '</text>'
      + '<text x="15" y="' + (nzY + 35) + '" font-size="6.5" fill="#16a34a" font-weight="bold">Suc (selected): ' + chkSucLabel + ' | ΔP: ' + sucDp.toFixed(3) + ' bar</text>'
      + '<text x="15" y="' + (nzY + 46) + '" font-size="6.5" fill="#dc2626" font-weight="bold">Dis (selected): ' + chkDisLabel + ' | ΔP: ' + disDp.toFixed(3) + ' bar</text>';

    // Discharge elevation & nozzle label
    svg += '<rect x="620" y="' + (dischPipeEndY - 30) + '" width="110" height="28" rx="4" fill="#f0fdf4" stroke="#16a34a" stroke-width="1.5"/>'
      + '<text x="675" y="' + (dischPipeEndY - 18) + '" text-anchor="middle" font-size="8" font-weight="bold" fill="#16a34a">Disch. Elevation</text>'
      + '<text x="675" y="' + (dischPipeEndY - 6) + '" text-anchor="middle" font-size="10" font-weight="bold" fill="#15803d">' + dischEl.toFixed(1) + ' m</text>';

    // P_dis badge
    svg += '<rect x="610" y="' + (dischPipeEndY - 58) + '" width="120" height="20" rx="4" fill="#fef3c7" stroke="#d97706" stroke-width="1"/>'
      + '<text x="670" y="' + (dischPipeEndY - 44) + '" text-anchor="middle" font-size="8" font-weight="bold" fill="#d97706">P_dis: ' + disPress.toFixed(3) + ' bar(g)</text>';

    // === PUMP CL annotation (right of pump, clear of other elements) ===
    svg += '<line x1="' + (pumpCX - 35) + '" y1="' + gradeY + '" x2="' + (pumpCX - 35) + '" y2="' + pumpY + '" stroke="#ff7538" stroke-width="1.5" stroke-dasharray="4,3"/>'
      + '<line x1="' + (pumpCX - 42) + '" y1="' + pumpY + '" x2="' + (pumpCX - 28) + '" y2="' + pumpY + '" stroke="#ff7538" stroke-width="1.5"/>'
      + '<line x1="' + (pumpCX - 42) + '" y1="' + gradeY + '" x2="' + (pumpCX - 28) + '" y2="' + gradeY + '" stroke="#ff7538" stroke-width="1.5"/>'
      + '<rect x="' + (pumpCX - 33) + '" y="' + (pumpY + 12) + '" width="75" height="14" rx="3" fill="#fff7ed" stroke="#ff7538" stroke-width="1"/>'
      + '<text x="' + (pumpCX + 4) + '" y="' + (pumpY + 22) + '" text-anchor="middle" font-size="7" font-weight="bold" fill="#ea580c">CL: ' + centreEl.toFixed(2) + ' m</text>';

    // === PLANT GRADE LINE ===
    svg += '<line x1="70" y1="' + gradeY + '" x2="730" y2="' + gradeY + '" stroke="#dc2626" stroke-width="1.5" stroke-dasharray="6,3"/>'
      + '<text x="730" y="' + (gradeY - 4) + '" text-anchor="end" font-size="9" font-weight="bold" fill="#dc2626">Plant Grade (0 m)</text>';

    // === STATIC HEAD / P_suc (above suction pipe, clear area) ===
    svg += '<rect x="200" y="' + (sucPipeY - 55) + '" width="155" height="50" rx="5" fill="#eff6ff" stroke="#3b82f6" stroke-width="1"/>'
      + '<text x="277" y="' + (sucPipeY - 42) + '" text-anchor="middle" font-size="8" font-weight="bold" fill="#1e40af">Static Head = ' + staticHead.toFixed(2) + ' m</text>'
      + '<text x="277" y="' + (sucPipeY - 30) + '" text-anchor="middle" font-size="6.5" fill="#64748b">Hs = LLL(' + lll.toFixed(1) + ') - CL(' + centreEl.toFixed(2) + ')</text>'
      + '<text x="277" y="' + (sucPipeY - 18) + '" text-anchor="middle" font-size="8" font-weight="bold" fill="' + (sucPress >= 0 ? '#16a34a' : '#dc2626') + '">P_suc: ' + sucPress.toFixed(3) + ' bar(g)</text>'
      + '<text x="277" y="' + (sucPipeY - 8) + '" text-anchor="middle" font-size="6.5" fill="#64748b">Vel: ' + (pOut.velSuc || 0).toFixed(2) + ' m/s | ' + (pOut.velDis || 0).toFixed(2) + ' m/s</text>';

    // === DIFF HEAD / NPSH box (top right area, clear) ===
    svg += '<rect x="400" y="15" width="180" height="60" rx="6" fill="' + (cavOK ? '#dcfce7' : '#fef2f2') + '" stroke="' + (cavOK ? '#16a34a' : '#dc2626') + '" stroke-width="1.5"/>'
      + '<text x="490" y="30" text-anchor="middle" font-size="8" fill="#475569">NPSHa: ' + npsha.toFixed(2) + ' m | NPSHr: ' + npshr.toFixed(2) + ' m</text>'
      + '<text x="490" y="44" text-anchor="middle" font-size="8" font-weight="bold" fill="#4338ca">ΔH: ' + diffHead.toFixed(2) + ' m | ΔP: ' + pumpDp.toFixed(3) + ' bar</text>'
      + '<text x="490" y="56" text-anchor="middle" font-size="7" fill="#475569">Dest. P: ' + destP.toFixed(2) + ' bar(g)</text>'
      + '<text x="490" y="68" text-anchor="middle" font-size="7" font-weight="bold" fill="' + (cavOK ? '#16a34a' : '#dc2626') + '">' + (cavOK ? '✓ SAFE' : '⚠ CAVITATION RISK') + '</text>';

    // Cavitation status (bottom)
    svg += '<text x="400" y="' + (gradeY + 25) + '" text-anchor="middle" font-size="10" font-weight="bold" fill="' + (cavOK ? '#16a34a' : '#dc2626') + '">' + (cavOK ? '✓ SAFE — NO CAVITATION' : '⚠ CAVITATION RISK') + '</text>';

    svg += '</svg>';
    return svg;
  }

  function showPumpReportModal() {
    var pIn = window.state.pump.inputs, pOut = window.state.pump.results;
    var f = function(v, t, d) { return fmtU(v, t, d); };
    var cavColor = pOut.cavType === 'ok' ? '#16a34a' : pOut.cavType === 'warn' ? '#d97706' : '#dc2626';
    var motorColor = pOut.motorLoading < 50 ? '#d97706' : pOut.motorLoading > 100 ? '#dc2626' : '#16a34a';
    var suggestions = [];
    if (pOut.motorLoading < 50) suggestions.push({icon:'⚡', text:'Motor loading is low (' + pOut.motorLoading.toFixed(1) + '%). Consider a smaller motor for better efficiency.', color:'#d97706'});
    if (pOut.motorLoading > 100) suggestions.push({icon:'🔴', text:'Motor is overloaded (' + pOut.motorLoading.toFixed(1) + '%). Select a larger motor immediately.', color:'#dc2626'});
    if (pOut.cavType !== 'ok') suggestions.push({icon:'⚠', text:'NPSH margin is insufficient. Increase vessel elevation or reduce suction line losses.', color:'#dc2626'});
    if (pOut.velSuc > 1.5) suggestions.push({icon:'💨', text:'Suction velocity (' + pOut.velSuc.toFixed(2) + ' m/s) is high. Consider a larger suction nozzle.', color:'#d97706'});
    if (pOut.velDis > 5.0) suggestions.push({icon:'💨', text:'Discharge velocity (' + pOut.velDis.toFixed(2) + ' m/s) is high. Consider a larger discharge nozzle.', color:'#d97706'});
    if (suggestions.length === 0) suggestions.push({icon:'✅', text:'Design parameters are within acceptable limits. No corrections needed.', color:'#16a34a'});

    var sugHTML = suggestions.map(function(s) {
      return '<div style="display:flex;align-items:start;gap:8px;padding:8px 12px;background:' + s.color + '10;border-left:3px solid ' + s.color + ';border-radius:4px;margin-bottom:6px;">'
        + '<span style="font-size:16px;">' + s.icon + '</span>'
        + '<span style="font-size:11px;color:#334155;">' + s.text + '</span></div>';
    }).join('');

    var row = function(lbl, val, color) {
      return '<tr><td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;color:#475569;font-size:11px;">' + lbl + '</td>'
        + '<td style="padding:6px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;color:' + (color || '#1e293b') + ';font-size:11px;text-align:right;">' + val + '</td></tr>';
    };

    var html = '<div id="pump-report-modal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px;">'
      + '<div style="background:white;border-radius:12px;max-width:900px;width:100%;max-height:90vh;overflow-y:auto;box-shadow:0 25px 50px rgba(0,0,0,0.25);">'
      + '<div style="background:linear-gradient(135deg,#1e3a5f,#0f172a);padding:20px 24px;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center;">'
      + '<div><div style="color:#f97316;font-size:18px;font-weight:800;letter-spacing:1px;">BHARAT FLOWSIZE</div>'
      + '<div style="color:#94a3b8;font-size:11px;margin-top:2px;">Pump Hydraulics — Design Report</div></div>'
      + '<div style="text-align:right;"><div style="color:#cbd5e1;font-size:10px;">Generated: ' + ts() + '</div>'
      + '<div style="color:#cbd5e1;font-size:10px;">Tag: ' + (pIn.pumpTag || 'N/A') + '</div></div></div>'
      + '<div style="padding:20px 24px;">'
      + '<div style="text-align:center;margin-bottom:20px;">' + buildPumpSVGDiagram(pIn, pOut) + '</div>'
      + '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">'
      + '<div><div style="font-size:12px;font-weight:800;color:#1e40af;margin-bottom:8px;border-bottom:2px solid #3b82f6;padding-bottom:4px;">📋 INPUT PARAMETERS</div>'
      + '<table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;">'
      + row('Service Fluid', pIn.fluidVal || '-')
      + row('Density', f(pIn.rho, 'density', 2))
      + row('Viscosity', f(pIn.mu, 'viscosity', 2))
      + row('Vapour Pressure', pIn.pVapBarA.toFixed(4) + ' bar A')
      + row('Normal Vol Flow', f(pIn.normalVolFlow, 'vol-flow', 1))
      + row('Vessel Pressure', (pIn.vesselPressG || 0).toFixed(2) + ' bar G')
      + row('Vessel Elevation', (pIn.zVessel || 0).toFixed(2) + ' m')
      + row('LLL', (pIn.lll || 0).toFixed(2) + ' m')
      + row('Pump Centreline El', (pIn.zPump || 0).toFixed(2) + ' m')
      + row('Discharge Elevation', (pIn.zDisch || 0).toFixed(2) + ' m')
      + row('Suction Source', pIn.sucSourceType === 'atmospheric' ? 'Atmospheric' : 'Pressurized')
      + '</table></div>'
      + '<div><div style="font-size:12px;font-weight:800;color:#16a34a;margin-bottom:8px;border-bottom:2px solid #22c55e;padding-bottom:4px;">📊 OUTPUT RESULTS</div>'
      + '<table style="width:100%;border-collapse:collapse;font-family:Arial,sans-serif;">'
      + row('Design Vol Flow', f(pOut.designVolFlow, 'vol-flow', 1), '#1e40af')
      + row('Static Head (Hs)', (pOut.Hs || 0).toFixed(2) + ' m = LLL(' + (pIn.lll || 0).toFixed(1) + ') - CL(' + (pIn.zPump || 0).toFixed(2) + ')', '#2563eb')
      + row('Diff Head', f(pOut.diffHeadCal, 'length-m', 2), '#1e40af')
      + row('Diff Pressure', (pOut.pumpDp || 0).toFixed(4) + ' bar', '#1e40af')
      + row('NPSHa / NPSHr', pOut.npsha.toFixed(2) + ' / ' + pIn.npshr.toFixed(2) + ' m', cavColor)
      + row('Cavitation', pOut.cavText, cavColor)
      + row('BHP', f(pOut.bhp, 'power', 2))
      + row('Motor Selected', (pOut.stdMotorKw || 0).toFixed(2) + ' kW')
      + row('Motor Loading', (pOut.motorLoading).toFixed(1) + '%', motorColor)
      + row('Suction Nozzle (Auto)', pOut.sucNozzle ? 'NPS ' + pOut.sucNozzle.nps + '" (ID ' + pOut.sucNozzle.id.toFixed(1) + ' mm)' : '-')
      + row('Suction Nozzle (Selected)', pOut.checkSucNozzle ? 'NPS ' + pOut.checkSucNozzle.nps + '" (ID ' + pOut.checkSucNozzle.id.toFixed(1) + ' mm)' : '-')
      + row('Discharge Nozzle (Auto)', pOut.disNozzle ? 'NPS ' + pOut.disNozzle.nps + '" (ID ' + pOut.disNozzle.id.toFixed(1) + ' mm)' : '-')
      + row('Discharge Nozzle (Selected)', pOut.checkDisNozzle ? 'NPS ' + pOut.checkDisNozzle.nps + '" (ID ' + pOut.checkDisNozzle.id.toFixed(1) + ' mm)' : '-')
      + row('Suction Velocity (Auto)', (pOut.velSuc || 0).toFixed(3) + ' m/s')
      + row('Suction Velocity (Selected)', (pOut.velCheckSuc || 0).toFixed(3) + ' m/s')
      + row('Discharge Velocity (Auto)', (pOut.velDis || 0).toFixed(3) + ' m/s')
      + row('Discharge Velocity (Selected)', (pOut.velCheckDis || 0).toFixed(3) + ' m/s')
      + '</table></div></div>'
      + '<div style="margin-bottom:20px;"><div style="font-size:12px;font-weight:800;color:#d97706;margin-bottom:8px;border-bottom:2px solid #f59e0b;padding-bottom:4px;">💡 DESIGN SUGGESTIONS</div>' + sugHTML + '</div>'
      + '<div style="display:flex;gap:12px;justify-content:center;padding:16px 0;border-top:1px solid #e2e8f0;">'
      + '<button onclick="downloadPumpReportHTML()" style="background:linear-gradient(135deg,#1e40af,#3b82f6);color:white;border:none;padding:10px 24px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;">⬇ DOWNLOAD REPORT</button>'
      + '<button onclick="document.getElementById(\'pump-report-modal\').remove()" style="background:#64748b;color:white;border:none;padding:10px 24px;border-radius:6px;font-weight:700;font-size:12px;cursor:pointer;">✕ CLOSE</button>'
      + '</div></div></div></div>';

    var existing = document.getElementById('pump-report-modal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', html);
  }

  window.downloadPumpReportHTML = function() {
    var modal = document.getElementById('pump-report-modal');
    if (!modal) return;
    var reportContent = modal.querySelector('div > div');
    var downloadBtns = reportContent.querySelector('div:last-child');
    if (downloadBtns) downloadBtns.style.display = 'none';
    var opt = {
      margin: [10, 10, 10, 10],
      filename: 'Pump_Hydraulics_Report.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    if (typeof html2pdf !== 'undefined') {
      html2pdf().set(opt).from(reportContent).save().then(function() {
        if (downloadBtns) downloadBtns.style.display = '';
      });
    } else {
      var blob = new Blob([reportContent.innerHTML], { type: 'text/html' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'Pump_Hydraulics_Report.html';
      a.click();
      URL.revokeObjectURL(a.href);
      if (downloadBtns) downloadBtns.style.display = '';
    }
  };

  var pumpBtn = document.getElementById('pump-download-report');
  if (pumpBtn) pumpBtn.addEventListener('click', function() {
    if (!window.state || !window.state.pump || !window.state.pump.calculated) {
      alert('Please run pump calculations first by entering input values.'); return;
    }
    showPumpReportModal();
  });

  // 2. LINE SIZING DOWNLOAD (covers liquid, gas, steam, slurry, two-phase)
  var lineBtn = document.getElementById('line-download-report');
  if (lineBtn) lineBtn.addEventListener('click', function() {
    if (!window.state || !window.state.line || !window.state.line.calculated) {
      alert('Run line sizing calculations first.'); return;
    }
    var lIn = window.state.line.inputs;
    var lOut = window.state.line.results;
    var lineType = window.state.line.activeType || 'liquid';
    var txt = sep;
    txt += '  BHARAT FLOWSIZE — LINE SIZING REPORT (' + lineType.toUpperCase() + ')\n';
    txt += '  Generated: ' + ts() + '\n';
    txt += sep + '\n';
    txt += '  PIPE SPECIFICATIONS\n' + line;
    txt += '  Line Size:                 NPS ' + lIn.npsText + '" Schedule ' + lIn.schText + '\n';
    txt += '  Inside Diameter:           ' + (lOut.idM * 1000).toFixed(1) + ' mm\n';
    txt += '  Pipe Length:               ' + (lIn.length !== undefined ? lIn.length.toFixed(1) + ' m' : '-') + '\n\n';

    if (lineType === 'liquid') {
      txt += '  LIQUID FLOW DATA\n' + line;
      txt += '  Service:                   ' + (lIn.serviceType || '-') + '\n';
      txt += '  Volumetric Flow:           ' + fmtU(lIn.qVol, 'vol-flow', 1) + '\n';
      txt += '  Fluid Velocity:            ' + fmtU(lOut.velocity, 'velocity', 2) + '\n';
      txt += '  Velocity Limits:           ' + lOut.limits.minV.toFixed(1) + ' - ' + lOut.limits.maxV.toFixed(1) + ' m/s\n';
      txt += '  Erosion Velocity:          ' + fmtU(lOut.vErosion, 'velocity', 2) + '\n';
      txt += '  Reynolds Number:           ' + lOut.reynolds.toLocaleString(undefined, {maximumFractionDigits:0}) + ' [' + lOut.regimeText + ']\n';
      txt += '  Friction Factor:           ' + lOut.frictionFactor.toFixed(5) + '\n\n';
      txt += '  PRESSURE DROP\n' + line;
      txt += '  Pipe Friction:             ' + fmtU(lOut.dpPipe, 'press-drop', 4) + '\n';
      txt += '  Fittings:                  ' + fmtU(lOut.dpFittings, 'press-drop', 4) + '\n';
      txt += '  Elevation:                 ' + fmtU(lOut.dpElevation, 'press-drop', 4) + '\n';
      txt += '  Total Pressure Drop:       ' + fmtU(lOut.dpTotal, 'press-drop', 4) + '\n';
      txt += '  Unit Drop (/100m):         ' + fmtU(lOut.dp100m, 'press-drop', 3) + '\n';
    } else if (lineType === 'gas') {
      txt += '  GAS FLOW DATA\n' + line;
      txt += '  Gas Density:               ' + (lOut.rho_gas || lOut.rho || 0).toFixed(3) + ' kg/m3\n';
      txt += '  Gas Velocity:              ' + fmtU(lOut.velocity, 'velocity', 2) + '\n';
      txt += '  Mach Number:               ' + (lOut.Mach || 0).toFixed(4) + '\n';
      txt += '  Total Pressure Drop:       ' + fmtU(lOut.dpTotal, 'press-drop', 4) + '\n';
      txt += '  Unit Drop (/100m):         ' + fmtU(lOut.dp100m, 'press-drop', 3) + '\n';
    } else if (lineType === 'steam') {
      txt += '  STEAM FLOW DATA\n' + line;
      txt += '  Steam Density:             ' + lOut.rho.toFixed(3) + ' kg/m3\n';
      txt += '  T_sat:                     ' + lOut.T_sat.toFixed(1) + ' C\n';
      txt += '  Specific Volume:           ' + lOut.specificVolume.toFixed(4) + ' m3/kg\n';
      txt += '  Velocity:                  ' + fmtU(lOut.velocity, 'velocity', 2) + '\n';
      txt += '  Total Pressure Drop:       ' + fmtU(lOut.dpTotal, 'press-drop', 4) + '\n';
      txt += '  Unit Drop (/100m):         ' + fmtU(lOut.dp100m, 'press-drop', 3) + '\n';
    } else if (lineType === 'slurry') {
      txt += '  SLURRY FLOW DATA\n' + line;
      txt += '  Slurry Density:            ' + lOut.rho_slurry.toFixed(1) + ' kg/m3\n';
      txt += '  Slurry Viscosity:          ' + lOut.mu_slurry_cP.toFixed(3) + ' cP\n';
      txt += '  Volume Fraction (Cv):      ' + (lOut.Cv * 100).toFixed(2) + '%\n';
      txt += '  Deposition Velocity:       ' + fmtU(lOut.V_deposit, 'velocity', 2) + '\n';
      txt += '  Actual Velocity:           ' + fmtU(lOut.velocity, 'velocity', 2) + '\n';
      txt += '  Total Pressure Drop:       ' + fmtU(lOut.dpTotal, 'press-drop', 4) + '\n';
    } else if (lineType === 'two_phase') {
      txt += '  TWO-PHASE FLOW DATA\n' + line;
      txt += '  Mixture Velocity:          ' + lOut.VM.toFixed(2) + ' m/s\n';
      txt += '  Void Fraction:             ' + (lOut.alpha * 100).toFixed(2) + '%\n';
      txt += '  L-M Parameter (Xtt):       ' + lOut.Xtt.toFixed(4) + '\n';
      txt += '  Two-Phase Multiplier:      ' + lOut.PhiL2.toFixed(3) + '\n';
      txt += '  Flow Pattern:              ' + lOut.flowPattern + '\n';
      txt += '  Total dP (TP):             ' + lOut.dpTP_total_bar.toFixed(4) + ' bar\n';
    }
    txt += '\n  COMPLIANCE VERDICTS\n' + line;
    txt += '  Velocity:                  ' + lOut.velText + '\n';
    txt += '  Pressure Drop:             ' + lOut.dpText + '\n';
    txt += '  Overall Status:            ' + (lOut.overallStatus || '-').toUpperCase() + '\n';
    txt += '\n' + sep;
    txt += '  BHARAT FLOWSIZE — ISO SPEC COMPLIANT\n';
    txt += sep;
    downloadTextReport('Line_Sizing_Report_' + lineType.toUpperCase() + '.txt', txt);
  });

  // 3. DPHE DOWNLOAD
  var dpheBtn = document.getElementById('dphe-download-report');
  if (dpheBtn) dpheBtn.addEventListener('click', function() {
    var reportEl = document.getElementById('dphe-summary-report');
    var pre = reportEl ? reportEl.querySelector('pre') : null;
    if (!pre || pre.textContent.indexOf('Run calculation') >= 0) {
      alert('Run DPHE calculations first.'); return;
    }
    var txt = '  BHARAT FLOWSIZE — DPHE HEAT EXCHANGER REPORT\n';
    txt += '  Generated: ' + ts() + '\n\n';
    txt += pre.textContent;
    txt += '\n\n  BHARAT FLOWSIZE — ISO SPEC COMPLIANT\n';
    downloadTextReport('DPHE_Heat_Exchanger_Report.txt', txt);
  });

  // 4. STHE DOWNLOAD
  var stheBtn = document.getElementById('sthe-download-report');
  if (stheBtn) stheBtn.addEventListener('click', function() {
    if (!window.state || !window.state.sthe || !window.state.sthe.calculated) {
      alert('Run STHE calculations first.'); return;
    }
    var r = window.state.sthe.results || window.state.sthe;
    var inp = window.state.sthe.inputs || {};
    var txt = sep;
    txt += '  BHARAT FLOWSIZE — STHE HEAT EXCHANGER REPORT\n';
    txt += '  Generated: ' + ts() + '\n';
    txt += sep + '\n';
    txt += '  CONFIGURATION\n' + line;
    txt += '  STHE Type:                 ' + (r.stheType || window.state.sthe.stheType || '-') + '\n';
    txt += '  Area Status:               ' + (r.areaStatus || window.state.sthe.status || '-') + '\n';
    txt += '  Tube Side Fluid:           ' + (inp.tubeSideFluid || '-') + '\n';
    txt += '  Shell Side Fluid:          ' + (inp.shellSideFluid || '-') + '\n';
    txt += '  Flow Arrangement:          ' + (inp.flowArrangement || '-').toUpperCase() + '\n';
    txt += '  Number of Tube Passes:     ' + (inp.Np || '-') + '\n\n';
    txt += '  THERMAL PERFORMANCE\n' + line;
    txt += '  Heat Duty (Q):             ' + (r.Q_kW !== undefined ? r.Q_kW.toFixed(2) : (window.state.sthe.Q || '-')) + ' kW\n';
    txt += '  LMTD:                      ' + (r.dT_lm !== undefined ? r.dT_lm.toFixed(3) : '-') + ' C\n';
    txt += '  Overall HTC (Ud):          ' + (r.U_calc !== undefined ? r.U_calc.toFixed(2) : (window.state.sthe.U || '-')) + ' W/m2.K\n\n';
    txt += '  GEOMETRY\n' + line;
    txt += '  Number of Tubes (Nt):      ' + (r.Nt || window.state.sthe.Nt || '-') + '\n';
    txt += '  Shell Diameter:            ' + (r.Ds_used_mm !== undefined ? r.Ds_used_mm.toFixed(1) : '-') + ' mm\n';
    txt += '  Area Available:            ' + (r.Aa !== undefined ? r.Aa.toFixed(2) : '-') + ' m2\n';
    txt += '  Area Required:             ' + (r.Ar !== undefined ? r.Ar.toFixed(2) : '-') + ' m2\n';
    txt += '  Excess Area:               ' + (r.excessArea !== undefined ? r.excessArea.toFixed(1) : (window.state.sthe.excessArea || '-')) + '%\n\n';
    txt += '  PRESSURE DROP\n' + line;
    txt += '  Tube Side dP:              ' + (r.dp_tube_kPa !== undefined ? r.dp_tube_kPa.toFixed(2) : '-') + ' kPa\n';
    txt += '  Shell Side dP:             ' + (r.dp_shell_kPa !== undefined ? r.dp_shell_kPa.toFixed(2) : '-') + ' kPa\n\n';
    txt += '  NOZZLE SIZES\n' + line;
    txt += '  Tube Inlet:                ' + (r.D_nozzle_tube_in !== undefined ? r.D_nozzle_tube_in.toFixed(1) : (window.state.sthe.D_tube || '-')) + ' mm\n';
    txt += '  Tube Outlet:               ' + (r.D_nozzle_tube_out !== undefined ? r.D_nozzle_tube_out.toFixed(1) : '-') + ' mm\n';
    txt += '  Shell Inlet:               ' + (r.D_nozzle_shell_in !== undefined ? r.D_nozzle_shell_in.toFixed(1) : (window.state.sthe.D_shell || '-')) + ' mm\n';
    txt += '  Shell Outlet:              ' + (r.D_nozzle_shell_out !== undefined ? r.D_nozzle_shell_out.toFixed(1) : '-') + ' mm\n';
    txt += '\n' + sep;
    txt += '  BHARAT FLOWSIZE — ISO SPEC COMPLIANT\n';
    txt += sep;
    downloadTextReport('STHE_Heat_Exchanger_Report.txt', txt);
  });
})();
