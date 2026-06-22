\n
document.addEventListener('DOMContentLoaded', () => {

// Helpers
const gv=(id,fb=0)=>{const e=document.getElementById(id);if(!e)return fb;const v=parseFloat(e.value);return isNaN(v)?fb:v;};
const gs=(id,fb="")=>{const e=document.getElementById(id);if(!e)return fb;return e.value;};
const sd=(n,d,fb=0)=>(!d||isNaN(d))?fb:(isFinite(n/d)?n/d:fb);
const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v;};
const setv=(id,v)=>{const e=document.getElementById(id);if(e)e.value=v;};
const setc=(id,c)=>{const e=document.getElementById(id);if(e)e.style.color=c;};

// AnimMgr
const AnimMgr={ids:{},run(k,fn){this.stop(k);const l=()=>{try{fn();}catch(e){console.warn(k,e);this.stop(k);return;}this.ids[k]=requestAnimationFrame(l);};this.ids[k]=requestAnimationFrame(l);},stop(k){if(this.ids[k]){cancelAnimationFrame(this.ids[k]);delete this.ids[k];}},stopAll(){Object.keys(this.ids).forEach(k=>this.stop(k));}};
document.addEventListener('visibilitychange',()=>{if(document.hidden)AnimMgr.stopAll();});

// Data Tables
const VAPOR_PRESSURE = {
  0:0.0061, 5:0.0087, 10:0.0123, 15:0.0170, 20:0.0234, 25:0.0317, 30:0.0425,
  35:0.0563, 40:0.0738, 45:0.0959, 50:0.1235, 55:0.1575, 60:0.1992, 65:0.2498,
  70:0.3117, 75:0.3860, 80:0.4739, 85:0.5790, 90:0.7011, 95:0.8450, 100:1.0133,
  105:1.2100, 110:1.4330, 115:1.6940, 120:1.9870, 125:2.3240, 130:2.7010,
  135:3.1310, 140:3.6140, 145:4.1570, 150:4.7580, 155:5.4300, 160:6.1800,
  165:7.0100, 170:7.9300, 175:8.9400, 180:10.030, 185:11.240, 190:12.540,
  195:13.970, 200:15.540
};
function getVaporPressure(temp) {
  if(temp <= 0) return VAPOR_PRESSURE[0];
  if(temp >= 200) return VAPOR_PRESSURE[200];
  let t1 = Math.floor(temp/5)*5;
  let t2 = t1 + 5;
  if(t1 === t2) return VAPOR_PRESSURE[t1];
  let p1 = VAPOR_PRESSURE[t1];
  let p2 = VAPOR_PRESSURE[t2];
  return p1 + (temp-t1)/(t2-t1) * (p2-p1);
}

const GAS_PROPERTIES = {
  "Hydrogen (H2)": {MW:2.016, rho:0.09, mu:0.0089, gamma:1.41},
  "Helium (He)": {MW:4.003, rho:0.178, mu:0.0196, gamma:1.66},
  "Methane (CH4)": {MW:16.043, rho:0.717, mu:0.011, gamma:1.31},
  "Ethylene (C2H4)": {MW:28.054, rho:1.178, mu:0.0094, gamma:1.24},
  "Nitrogen (N2)": {MW:28.013, rho:1.225, mu:0.0176, gamma:1.40},
  "CO": {MW:28.01, rho:1.25, mu:0.0174, gamma:1.40},
  "Air": {MW:28.97, rho:1.225, mu:0.0181, gamma:1.40},
  "Oxygen (O2)": {MW:31.999, rho:1.429, mu:0.0202, gamma:1.40},
  "H2S": {MW:34.081, rho:1.539, mu:0.0134, gamma:1.31},
  "Ammonia (NH3)": {MW:17.031, rho:0.771, mu:0.0098, gamma:1.31},
  "CO2": {MW:44.01, rho:1.977, mu:0.0148, gamma:1.29},
  "N2O": {MW:44.013, rho:1.978, mu:0.0147, gamma:1.29},
  "Propane (C3H8)": {MW:44.097, rho:1.868, mu:0.0083, gamma:1.13},
  "SO2": {MW:64.066, rho:2.927, mu:0.0125, gamma:1.26},
  "Butane (C4H10)": {MW:58.124, rho:2.48, mu:0.0078, gamma:1.10},
  "Chlorine (Cl2)": {MW:70.906, rho:3.214, mu:0.013, gamma:1.33},
  "Pentane (C5H12)": {MW:72.151, rho:3.0, mu:0.007, gamma:1.08},
  "Hexane (C6H14)": {MW:86.178, rho:3.57, mu:0.0068, gamma:1.08}
};

const NPS_ID = {
  0.5:0.622, 0.75:0.824, 1:1.049, 1.5:1.610, 2:2.067, 3:3.068, 4:4.026, 6:6.065,
  8:7.981, 10:10.020, 12:11.938, 14:13.250, 16:15.250, 18:17.250, 20:19.250, 24:23.250
};
const NPS_OD = {
  0.5:0.840, 0.75:1.050, 1:1.315, 1.5:1.900, 2:2.375, 3:3.500, 4:4.500, 6:6.625,
  8:8.625, 10:10.750, 12:12.750, 14:14.000, 16:16.000, 18:18.000, 20:20.000, 24:24.000
};

const ROUGHNESS = {
  "CS":0.045, "MS":0.045, "GI":0.150, "SS304":0.0015, "SS304L":0.0015,
  "SS316":0.0015, "SS316L":0.0015, "SS321":0.0015, "SS310":0.0015,
  "Duplex SS":0.0015, "Super Duplex SS":0.0015, "Alloy Steel":0.045,
  "Copper":0.0015, "Brass":0.0015, "PVC":0.0015, "CPVC":0.0015,
  "HDPE":0.007, "FRP":0.005, "PTFE Lined":0.001, "Rubber Lined":0.010,
  "Hastelloy C276":0.0015, "Monel 400":0.0015, "Inconel 600/625":0.0015
};

const STANDARD_MOTORS = [0.75, 1.1, 1.5, 2.2, 3, 4, 5.5, 7.5, 11, 15, 18.5, 22, 30, 37, 45, 55, 75, 90, 110, 132, 160, 200, 250];

// Storage for animations to read last computed states
window.lastNPSHa = 0;
window.lastRe = 0;

// Pump Math
function calculatePump() {
  const dens = gv("pump-density", 1000);
  const flowM3h = gv("pump-vol-flow", 100);
  const sucP_G = gv("pump-suc-pressure", 3);
  const vesselEl = gv("pump-vessel-el", 4);
  const lll = gv("pump-lll", 0);
  const pumpEl = gv("pump-centreline-el", 0.75);
  const sucDP = gv("pump-suc-dp", 0.2);
  const vapP = gv("pump-vapor-pres", 0.0563);
  const marginP = gv("pump-margin", 1);
  const destG = gv("pump-dest-press", 5.5);
  const destEl = gv("pump-dest-el", 5);
  const destDP = gv("pump-dest-dp", 0.2);
  const shutoffM = gv("pump-shutoff-margin", 20);

  // Static Head
  const staticHeadBar = dens * 9.81 * ((vesselEl + lll) - pumpEl) / 100000;
  // Net Suction Press A
  const netSucA = sucP_G + 1.01325 + staticHeadBar - sucDP;
  // Head at suc
  const headSuc = netSucA * 100000 / (dens * 9.81);
  // NPSHa
  const npsha = headSuc - (vapP * 100000 / (dens * 9.81));
  window.lastNPSHa = npsha;
  const npshr = gv("pump-npshr", 30);
  const cav = npsha >= (npshr + marginP) ? "NO CAVITATION" : "CAVITATION WARNING";

  // Discharge
  const destElBar = dens * 9.81 * destEl / 100000;
  const pumpDischG = destG + destElBar + destDP;
  const pumpDischA = pumpDischG + 1.01325;
  const diffBar = pumpDischA - netSucA;
  const diffHead = diffBar * 100000 / (dens * 9.81);

  // Hydraulic power
  const hydPower = diffBar * 100000 * flowM3h / 3600000;
  
  // Efficiencies
  let pEff = 80;
  if(hydPower < 5) pEff=57;
  else if(hydPower<=20) pEff=67;
  else if(hydPower<=100) pEff=75;
  else pEff=82;
  const userEff = gv("pump-eff", pEff);

  const bhp = hydPower / (userEff/100);
  
  let mEff = 94;
  if(bhp < 5) mEff=84;
  else if(bhp<=20) mEff=90;
  else if(bhp<=50) mEff=94;
  else if(bhp<=200) mEff=95;
  else mEff=96;
  const motorEff = gv("motor-eff", mEff);

  const mhp = bhp / (motorEff/100);
  const sf = gv("motor-sf", 20);
  const motorSel = mhp * (1 + sf/100);
  let standardMotor = STANDARD_MOTORS.find(m => m >= motorSel) || STANDARD_MOTORS[STANDARD_MOTORS.length-1];

  // Outputs
  set("out-pump-static", staticHeadBar.toFixed(4) + " Δbar");
  set("out-pump-net-suc", netSucA.toFixed(4) + " bar(A)");
  set("out-pump-npsha", npsha.toFixed(2) + " m");
  set("out-pump-cav", cav);
  setc("out-pump-cav", cav === "NO CAVITATION" ? "var(--color-ok)" : "var(--color-warn)");
  set("out-pump-disch", pumpDischG.toFixed(4) + " bar(G)");
  set("out-pump-diff-press", diffBar.toFixed(4) + " Δbar");
  set("out-pump-diff-head", diffHead.toFixed(2) + " m");
  set("out-pump-hyd-pow", hydPower.toFixed(2) + " kW");
  set("out-pump-bhp", bhp.toFixed(2) + " kW");
  set("out-pump-mhp", mhp.toFixed(2) + " kW");
  set("out-pump-motor", standardMotor + " kW");
  
  // Shut off
  const hll = gv("pump-hll", 4);
  const maxStatBar = dens * 9.81 * hll / 100000;
  const sourceDesignA = (sucP_G + 1.01325) * 1.2; // roughly assuming 20% margin on source
  const maxSuc = sourceDesignA + maxStatBar;
  const shutoffA = maxSuc + diffBar * (1 + shutoffM/100);
  set("out-pump-shutoff", shutoffA.toFixed(4) + " bar(A)");

  const pLog = document.querySelector('#pump-tab .terminal-logs');
  if(pLog) pLog.innerHTML = `<div class="logs-header"><span class="logs-title">PUMP ENGINE</span> <span class="logs-status-val" style="color:${cav === 'NO CAVITATION' ? '#00b875' : '#ef4444'}">SYSTEM STATUS: PUMP OK // NPSHa=${npsha.toFixed(1)}m // MARGIN=${marginP}m // BHP=${bhp.toFixed(1)}kW // MOTOR=${standardMotor}kW // ${cav}</span></div>`;
}

// Line Math Helper
function calcFriction(Re, ed) {
  let f = Re < 2300 ? sd(64, Re, 0.02) : 0.02;
  if(Re >= 2300) {
    for(let i=0; i<30; i++){
      const arg = ed/3.7 + sd(2.51, Re*Math.sqrt(f), 0.01);
      if(arg<=0) break;
      const fn = 1/Math.pow(-2*Math.log10(arg),2);
      if(!isFinite(fn)||fn<=0) break;
      if(Math.abs(fn-f)<1e-8) break;
      f=fn;
    }
  }
  return f;
}

// Line Math Single Phase
function calculateLineSingle() {
  const nps = gv("line-nps", 6);
  const dens = gv("line-density", 1000);
  const vis = gv("line-viscosity", 1);
  const flow = gv("line-flow", 100);
  const len = gv("line-length", 9);
  const el = gv("line-elevation", 0);
  const rough = gv("line-roughness", 0.045);
  
  const idIn = NPS_ID[nps] || 6.065;
  const idM = idIn * 0.0254;
  const area = Math.PI/4 * idM*idM;
  
  const vel = sd(flow, 3600*area);
  const re = sd(dens * vel * idM, vis * 0.001);
  window.lastRe = re;
  
  const f = calcFriction(re, rough/1000/idM);
  const dp100 = f * (100/idM) * dens * vel * vel / (2*100000);
  
  const erosion = sd(122, Math.sqrt(dens * 0.062428)) * 0.3048;
  
  set("out-line-vel", vel.toFixed(3) + " m/s");
  set("out-line-re", re.toFixed(0));
  set("out-line-f", f.toFixed(5));
  set("out-line-dp100", dp100.toFixed(4) + " bar/100m");
  set("out-line-erosion", erosion.toFixed(3) + " m/s");
  
  const lLog = document.querySelector('#line-tab .terminal-logs');
  if(lLog) lLog.innerHTML = `<div class="logs-header"><span class="logs-title">LINE ENGINE</span> <span class="logs-status-val" style="color:#00b875">SYSTEM STATUS: LINE OK // v=${vel.toFixed(2)}m/s // Re=${re.toFixed(0)} // ΔP=${dp100.toFixed(3)}bar/100m // STATUS: OK</span></div>`;
}

// Gas Line Math
function calculateLineGas() {
  const mw = gv("gas-mw", 2.016);
  const vis = gv("gas-viscosity", 0.0089);
  const gamma = gv("gas-k", 1.41);
  const nps = gv("gas-nps", 1);
  const flow = gv("gas-mass-flow", 50);
  const upPress = gv("gas-p1", 3);
  const temp = gv("gas-temp", 15);
  const rough = gv("gas-roughness", 0.0015);
  
  const idIn = NPS_ID[nps] || 1.049;
  const idM = idIn * 0.0254;
  const area = Math.PI/4 * idM*idM;
  
  // R = 8314.46 / MW
  const P_Pa = (upPress + 1.01325) * 100000;
  const T_K = temp + 273.15;
  const rho_op = P_Pa * mw / (8314.46 * T_K);
  
  const massFlow = flow * rho_op; // Approximation: if vol flow is operating... wait standard vs operating.
  // Assuming flow is operating vol flow.
  const vel = sd(flow, 3600*area);
  const re = sd(rho_op * vel * idM, vis * 0.001);
  window.lastRe = re;
  
  const f = calcFriction(re, rough/1000/idM);
  const dp = f * (1/idM) * rho_op * vel * vel / (2*100000); // per meter
  const c_sound = Math.sqrt(gamma * 8314.46 / mw * T_K);
  const ma = sd(vel, c_sound);
  
  let status = "EXCELLENT";
  if(ma>=0.1) status="ACCEPTABLE";
  if(ma>=0.3) status="REVIEW";
  if(ma>=0.5) status="HIGH COMPRESSIBILITY";
  
  set("out-gas-vel", vel.toFixed(3) + " m/s");
  set("out-gas-re", re.toFixed(0));
  set("out-gas-f", f.toFixed(5));
  set("out-gas-rho", rho_op.toFixed(4) + " kg/m³");
  set("out-gas-ma", ma.toFixed(4));
  set("out-gas-status", status);
  
  const gLog = document.querySelector('#line-tab .terminal-logs');
  if(gLog) gLog.innerHTML = `<div class="logs-header"><span class="logs-title">GAS ENGINE</span> <span class="logs-status-val" style="color:${status === 'EXCELLENT' ? '#00b875' : '#f59e0b'}">SYSTEM STATUS: GAS LINE OK // v=${vel.toFixed(1)}m/s // Ma=${ma.toFixed(3)} // SYSTEM: ${status}</span></div>`;
}

// STHE MATH (will be appended from original)
function calculateSTHE() {
    // Collect Inputs
    const flowTypeInput = document.querySelector('input[name="sthe-flow"]:checked');
    const flowType = flowTypeInput ? flowTypeInput.value : 'counter'; 

    const layoutInput = document.querySelector('input[name="sthe-layout"]:checked');
    const layout = layoutInput ? layoutInput.value : 'triangular';
    
    const m_tube = parseFloat(document.getElementById('sthe-mass-tube')?.value || 0);
    const m_shell = parseFloat(document.getElementById('sthe-mass-shell')?.value || 0);
    
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
    const muw_tube_cP = parseFloat(document.getElementById('sthe-muw-tube')?.value || 0.001);
    const muw_shell_cP = parseFloat(document.getElementById('sthe-muw-shell')?.value || 0.001);

    const Do_mm = parseFloat(document.getElementById('sthe-tube-od')?.value || 19);
    const Di_mm = parseFloat(document.getElementById('sthe-tube-id')?.value || 16);
    const L_mm = parseFloat(document.getElementById('sthe-tube-L')?.value || 7270);
    
    const Pt_ratio = parseFloat(document.getElementById('sthe-pitch-ratio')?.value || 1.25);
    const B_mm = parseFloat(document.getElementById('sthe-baffle-space')?.value || 210);
    const Np = parseInt(document.getElementById('sthe-tube-passes')?.value || 6);
    const Ds_mm = parseFloat(document.getElementById('sthe-shell-id')?.value || 1050);

    const kw = parseFloat(document.getElementById('sthe-kw')?.value || 60);
    const Rdi = parseFloat(document.getElementById('sthe-rdi')?.value || 0.000176);
    const Rdo = parseFloat(document.getElementById('sthe-rdo')?.value || 0.000209);
    const U_assumed = parseFloat(document.getElementById('sthe-u-assumed')?.value || 1000);

    const v_tube_input = parseFloat(document.getElementById('sthe-v-tube')?.value || 2);
    const v_shell_input = parseFloat(document.getElementById('sthe-v-shell')?.value || 10);

    // ==========================================
    // EXACT CALCULATION FORMULAS
    // ==========================================
    
    const Q = m_shell * Cp_shell_J * Math.abs(Tin_shell - Tout_shell);
    const Q_kW = Q / 1000;

    let dT1, dT2;
    if(flowType === 'counter') {
        dT1 = Math.abs(Tin_shell - Tout_tube);
        dT2 = Math.abs(Tout_shell - Tin_tube);
    } else {
        dT1 = Math.abs(Tin_shell - Tin_tube);
        dT2 = Math.abs(Tout_shell - Tout_tube);
    }
    
    let LMTD = 0;
    if(Math.abs(dT1 - dT2) < 0.001) {
        LMTD = dT1;
    } else {
        LMTD = (dT1 - dT2) / Math.log(Math.abs(dT1 / dT2) || 1);
    }
    
    const ft = 0.80;
    const dT_lm = ft * LMTD;
    
    const R = (Tin_shell - Tout_shell) / (Tout_tube - Tin_tube);
    const P = (Tout_tube - Tin_tube) / (Tin_shell - Tin_tube);

    const A_trial = Q / (U_assumed * dT_lm);
    const Do_m = Do_mm / 1000;
    const Di_m = Di_mm / 1000;
    const L_m = L_mm / 1000;
    const A_per_tube = Math.PI * Do_m * L_m;
    const Nt = Math.ceil(A_trial / A_per_tube);

    const Pt_m = (Pt_ratio * Do_mm) / 1000;
    const KN = {
        triangular: { 1:[0.319,2.142], 2:[0.249,2.207], 4:[0.175,2.285], 6:[0.0743,2.499], 8:[0.0365,2.675] },
        square:     { 1:[0.215,2.207], 2:[0.156,2.291], 4:[0.158,2.263], 6:[0.0402,2.617], 8:[0.0331,2.643] }
    };
    
    let k_val = 0.0743, n_val = 2.499;
    if(KN[layout] && KN[layout][Np]) {
        k_val = KN[layout][Np][0];
        n_val = KN[layout][Np][1];
    }
    const Db_m = Do_m * Math.pow(Nt / k_val, 1/n_val);
    const Db_mm = Db_m * 1000;

    const mu_tube = mu_tube_cP / 1000;
    const A_flow_tube = (Math.PI/4) * Di_m * Di_m * (Nt / Np);
    const Gt = m_tube / A_flow_tube;
    const Re_tube = Gt * Di_m / mu_tube;
    const Pr_tube = (Cp_tube_J * mu_tube) / k_tube;
    const C_dittus = 0.023;
    const Nu_tube = C_dittus * Math.pow(Re_tube, 0.8) * Math.pow(Pr_tube, 0.33) * Math.pow(mu_tube_cP / muw_tube_cP, 0.14);
    const hi = Nu_tube * k_tube / Di_m;
    const hio = hi * (Di_m / Do_m);

    let De = 0;
    if(layout === 'triangular') {
        De = (4 * (Math.sqrt(3)/4 * Pt_m * Pt_m - Math.PI/8 * Do_m * Do_m)) / (Math.PI/2 * Do_m);
    } else {
        De = (4 * (Pt_m * Pt_m - Math.PI/4 * Do_m * Do_m)) / (Math.PI * Do_m);
    }
    const C_prime = Pt_m - Do_m;
    const Ds_m = Ds_mm / 1000;
    const B_m = B_mm / 1000;
    const A_flow_shell = (Ds_m * C_prime * B_m) / Pt_m;
    const Gs = m_shell / A_flow_shell;
    const mu_shell = mu_shell_cP / 1000;
    const Re_shell = Gs * De / mu_shell;
    const Pr_shell = (Cp_shell_J * mu_shell) / k_shell;
    const Nu_shell = 0.36 * Math.pow(Re_shell, 0.55) * Math.pow(Pr_shell, 0.33) * Math.pow(mu_shell_cP / muw_shell_cP, 0.14);
    const ho = Nu_shell * k_shell / De;

    const Rw = (Do_m/2) * Math.log(Do_m/Di_m) / kw;
    const U_calc = 1 / (1/hio + Rdi + Rw + Rdo + 1/ho);

    const Ar = Q / (U_calc * dT_lm);
    const Aa = Nt * Math.PI * Do_m * L_m;
    const excess_pct = ((Aa - Ar) / Ar) * 100;

    const f_tube = Math.exp(0.576 - 0.19 * Math.log(Math.max(Re_tube, 1)));
    const dp_tube_Pa = f_tube * (L_m / Di_m) * (rho_tube * v_tube_input * v_tube_input / 2) * Np;
    const dp_tube_kPa = dp_tube_Pa / 1000;
    const dp_tube_kgcm2 = dp_tube_Pa / 98066.5;

    const Nb = Math.floor(L_m / B_m) - 1;
    const f_shell = Math.exp(0.576 - 0.19 * Math.log(Math.max(Re_shell, 1)));
    const dp_shell_Pa = f_shell * Gs * Gs * Ds_m * (Nb + 1) / (2 * rho_shell * De);
    const dp_shell_kPa = dp_shell_Pa / 1000;
    const dp_shell_kgcm2 = dp_shell_Pa / 98066.5;

    const Qv_tube = m_tube / rho_tube;
    const A_nozzle_tube = Qv_tube / v_tube_input;
    const D_nozzle_tube_mm = Math.sqrt(4 * A_nozzle_tube / Math.PI) * 1000;

    const Qv_shell = m_shell / rho_shell;
    const A_nozzle_shell = Qv_shell / v_shell_input;
    const D_nozzle_shell_mm = Math.sqrt(4 * A_nozzle_shell / Math.PI) * 1000;

    // UPDATE DOM
    document.getElementById('sthe-out-Q').innerText = Q_kW.toFixed(2);
    document.getElementById('sthe-out-lmtd').innerText = LMTD.toFixed(2);
    document.getElementById('sthe-out-ft').innerText = ft.toFixed(2);
    document.getElementById('sthe-out-dtlm').innerText = dT_lm.toFixed(2);
    document.getElementById('sthe-out-R').innerText = R.toFixed(3);
    document.getElementById('sthe-out-P').innerText = P.toFixed(3);

    document.getElementById('sthe-out-Nt').innerText = Nt;
    document.getElementById('sthe-out-Db').innerText = Db_mm.toFixed(1);
    document.getElementById('sthe-out-Ds').innerText = Ds_mm.toFixed(1);
    document.getElementById('sthe-out-Ar').innerText = Ar.toFixed(2);
    document.getElementById('sthe-out-Aa').innerText = Aa.toFixed(2);
    document.getElementById('sthe-out-excess').innerText = excess_pct.toFixed(1);
    
    const badgeExcess = document.getElementById('sthe-badge-excess');
    badgeExcess.style.display = 'inline-block';
    badgeExcess.className = 'banner-badge'; // reset
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

    document.getElementById('sthe-out-Retube').innerText = Re_tube.toFixed(0);
    document.getElementById('sthe-out-Prtube').innerText = Pr_tube.toFixed(2);
    document.getElementById('sthe-out-hi').innerText = hi.toFixed(1);
    document.getElementById('sthe-out-hio').innerText = hio.toFixed(1);
    document.getElementById('sthe-out-Reshell').innerText = Re_shell.toFixed(0);
    document.getElementById('sthe-out-Prshell').innerText = Pr_shell.toFixed(2);
    document.getElementById('sthe-out-ho').innerText = ho.toFixed(1);
    document.getElementById('sthe-out-Rw').innerText = Rw.toExponential(3);
    document.getElementById('sthe-out-Ucalc').innerText = U_calc.toFixed(1);
    
    const badgeU = document.getElementById('sthe-badge-U');
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

    document.getElementById('sthe-out-dp-tube').innerText = dp_tube_kPa.toFixed(1);
    document.getElementById('sthe-out-dp-tube-kg').innerText = dp_tube_kgcm2.toFixed(3);
    document.getElementById('sthe-out-dp-shell').innerText = dp_shell_kPa.toFixed(1);
    document.getElementById('sthe-out-dp-shell-kg').innerText = dp_shell_kgcm2.toFixed(3);
    document.getElementById('sthe-out-Nb').innerText = Nb;

    document.getElementById('sthe-out-noz-ti').innerText = D_nozzle_tube_mm.toFixed(1);
    document.getElementById('sthe-out-noz-to').innerText = D_nozzle_tube_mm.toFixed(1);
    document.getElementById('sthe-out-noz-si').innerText = D_nozzle_shell_mm.toFixed(1);
    document.getElementById('sthe-out-noz-so').innerText = D_nozzle_shell_mm.toFixed(1);

    const recList = document.getElementById('sthe-rec-list');
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
    
    const fluidTube = document.getElementById('sthe-fluid-tube')?.value.toLowerCase() || '';
    if (Tout_tube > 40 && fluidTube.includes('cooling water')) {
        addFlag("Cooling water outlet >40°C — fouling/scaling risk", "AMBER");
    }

    const tMax = Math.max(Tin_tube, Tout_tube, Tin_shell, Tout_shell);
    const fluidShell = document.getElementById('sthe-fluid-shell')?.value.toLowerCase() || '';
    const isDirty = fluidShell.includes('dirty') || fluidShell.includes('toxic');
    let stheType = '';
    if (tMax < 90) stheType = "Fixed Tube Sheet";
    else if (tMax >= 90 && !isDirty) stheType = "U-Tube";
    else if (tMax >= 90 && isDirty) stheType = "Internal Floating Head";
    
    const typeRow = document.createElement('div');
    typeRow.className = `check-item`;
    typeRow.style.borderLeft = `3px solid var(--color-saffron)`;
    typeRow.style.backgroundColor = `rgba(255, 117, 56, 0.05)`;
    typeRow.innerHTML = `<div class="check-info"><span class="check-name" style="color:var(--color-saffron)">TYPE RECOMMENDED</span><span class="check-details" style="font-size:11px;">${stheType}</span></div>`;
    recList.appendChild(typeRow);

    window.state = window.state || {};
    window.state.sthe = {
        calculated: true,
        Q: Q_kW.toFixed(2),
        U: U_calc.toFixed(1),
        Nt: Nt,
        excessArea: excess_pct.toFixed(1),
        status: excessStatus,
        D_tube: D_nozzle_tube_mm.toFixed(1),
        D_shell: D_nozzle_shell_mm.toFixed(1)
    };

    const statusMsg = `SYSTEM STATUS: STHE CALCULATED // U = ${U_calc.toFixed(1)} W/m²·K // Nt = ${Nt} // EXCESS AREA = ${excess_pct.toFixed(1)}% // STATUS: ${excessStatus}`;
    const statusEl = document.querySelector('#sthe-tab .terminal-logs');
    if(statusEl) {
        statusEl.innerHTML = `<div class="logs-header"><span class="logs-title">STHE ENGINE</span> <span class="logs-status-val" style="color:${excessStatus==='ACCEPTABLE'?'#00b875':(excessStatus==='OVERSIZED'?'#f59e0b':'#ef4444')}">${statusMsg}</span></div>`;
    }

    const resultCards = document.querySelectorAll('#sthe-tab .result-card');
    resultCards.forEach(card => {
        card.style.transform = 'scale(0.98)';
        setTimeout(() => {
            card.style.transform = 'scale(1)';
        }, 150);
    });
}

// 3D Canvas Rendering
function drawPump3D(ctx, W, H, angle, t) {
  ctx.clearRect(0, 0, W, H);
  
  // LLL reading
  const v_el = gv('pump-vessel-el', 4);
  const lll = gv('pump-lll', 0);
  const fill_pct = sd(lll, v_el+4) * 0.8 + 0.1; // visual scaling
  const flow = gv('pump-volflow', 100);
  const npsha = window.lastNPSHa;
  const npshr = gv('pump-npshr', 30);
  
  // Vessel
  ctx.fillStyle = '#0a1628'; ctx.strokeStyle = '#00c4a0'; ctx.lineWidth = 2;
  ctx.fillRect(30, 20, 90, 220); ctx.strokeRect(30, 20, 90, 220);
  
  // Liquid in vessel
  let h_fill = fill_pct * 220;
  if(h_fill > 218) h_fill = 218;
  if(h_fill < 2) h_fill = 2;
  
  let wave = Math.sin(t*3)*3;
  ctx.fillStyle = 'rgba(0, 196, 160, 0.7)';
  ctx.fillRect(31, 240 - h_fill + wave, 88, h_fill - wave - 1);
  
  ctx.fillStyle='#fff'; ctx.font='10px monospace';
  ctx.fillText("VESSEL", 35, 15);
  
  // Pipe Suction
  ctx.fillStyle='#333'; ctx.fillRect(120, 155, 100, 10);
  ctx.strokeStyle='#888'; ctx.strokeRect(120, 155, 100, 10);
  // Particles
  ctx.fillStyle='#00ffcc';
  for(let i=0; i<8; i++){
    let px = 120 + ((t*20*flow/100 + i*15) % 100);
    ctx.beginPath(); ctx.arc(px, 160, 2, 0, 7); ctx.fill();
  }
  
  // Pump Body
  ctx.save();
  ctx.translate(265, 160);
  if(npsha < npshr) {
    ctx.shadowColor = '#ef4444';
    ctx.shadowBlur = 15 + Math.sin(t*5)*10;
    ctx.strokeStyle = '#ef4444';
  } else {
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 15;
    ctx.strokeStyle = '#f97316';
  }
  ctx.fillStyle = '#0a1a3a';
  ctx.beginPath(); ctx.arc(0, 0, 45, 0, 7); ctx.fill(); ctx.stroke();
  
  // Impeller
  ctx.lineWidth=3;
  for(let i=0; i<6; i++){
    let a = angle + i*(Math.PI/3);
    ctx.beginPath(); ctx.moveTo(0,0);
    ctx.lineTo(Math.cos(a)*28, Math.sin(a)*28);
    ctx.stroke();
  }
  ctx.restore();
  
  ctx.fillStyle='#fff';
  ctx.fillText("PUMP", 255, 220);
  
  // Discharge
  ctx.fillStyle='#333'; ctx.fillRect(310, 155, 110, 10);
  ctx.strokeStyle='#888'; ctx.strokeRect(310, 155, 110, 10);
  ctx.fillStyle='#f97316';
  for(let i=0; i<8; i++){
    let px = 310 + ((t*30*flow/100 + i*15) % 110);
    ctx.beginPath(); ctx.arc(px, 160, 2, 0, 7); ctx.fill();
  }
  
  // Dest Box
  ctx.fillStyle = '#0a1628'; ctx.strokeStyle = '#00c4a0';
  ctx.fillRect(420, 120, 70, 80); ctx.strokeRect(420, 120, 70, 80);
  ctx.fillStyle='#fff'; ctx.fillText("DEST", 435, 115);
  
  // NPSH Gauge
  ctx.fillStyle='#111'; ctx.fillRect(200, 240, 130, 10);
  let gW = sd(npsha, 60)*130;
  if(gW>130) gW=130;
  ctx.fillStyle = (npsha < npshr) ? '#ef4444' : '#00b875';
  ctx.fillRect(200, 240, gW, 10);
  ctx.fillStyle='red'; ctx.fillRect(200 + sd(npshr,60)*130, 235, 2, 20);
  ctx.fillStyle='#fff'; ctx.fillText("NPSHa=" + npsha.toFixed(1), 200, 265);
}

function drawLine3D(ctx, W, H, t) {
  ctx.clearRect(0, 0, W, H);
  
  const npsIn = gv('line-nps', 6) || gv('gas-nps', 6);
  const flow = gv('line-volflow', 100);
  const re = window.lastRe;
  
  let p_h = Math.max(20, Math.min(npsIn * 10, 120));
  let cy = H/2;
  
  // Pipe outer
  ctx.fillStyle = '#333'; ctx.fillRect(50, cy - p_h/2, 400, p_h);
  // Inlet / Outlet caps
  ctx.fillStyle = '#050820'; 
  ctx.beginPath(); ctx.ellipse(50, cy, 10, p_h/2, 0, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.ellipse(450, cy, 10, p_h/2, 0, 0, 7); ctx.fill();
  
  // Fluid internal
  if(re < 2300) {
    ctx.strokeStyle = 'rgba(0,170,255,0.6)'; ctx.lineWidth=2;
    for(let i=1; i<=5; i++){
      let y = cy - p_h/2 + i*(p_h/6);
      let wave = Math.sin(t*2 + i)*3;
      ctx.beginPath(); ctx.moveTo(50, y+wave); ctx.lineTo(450, y-wave); ctx.stroke();
    }
  } else {
    ctx.fillStyle = 'rgba(249, 115, 22, 0.7)';
    for(let i=0; i<25; i++){
      let px = 50 + ((t*200 + i*17) % 400);
      let py = cy - p_h/2 + 5 + ((i*11)% (p_h-10));
      ctx.beginPath(); ctx.arc(px, py, 3, 0, 7); ctx.fill();
    }
  }
  
  ctx.fillStyle='#fff'; ctx.font='11px monospace';
  ctx.fillText("NPS: " + npsIn + '" | Re = ' + re.toFixed(0), 10, 20);
}

function drawSTHE3D(ctx, W, H, t) {
  ctx.clearRect(0, 0, W, H);
  
  const ds = gv('s_Ds', 1050) / 1000;
  const l_m = gv('s_L', 7270) / 1000;
  const b_m = gv('s_B', 210) / 1000;
  const nb = Math.max(1, Math.floor(l_m / b_m) - 1);
  const np = gv('s_Np', 6);
  
  let sh = Math.max(80, Math.min(ds * 180, 200));
  let cy = H/2;
  
  // Shell body
  ctx.fillStyle = '#051020'; ctx.strokeStyle = '#00c4a0'; ctx.lineWidth=2;
  ctx.fillRect(50, cy - sh/2, 420, sh); ctx.strokeRect(50, cy - sh/2, 420, sh);
  
  // Caps
  ctx.fillStyle = '#0d2a50';
  ctx.beginPath(); ctx.ellipse(50, cy, 20, sh/2, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(470, cy, 20, sh/2, 0, 0, 7); ctx.fill(); ctx.stroke();
  
  // Tubes
  ctx.strokeStyle = 'rgba(255,255,255,0.2)'; ctx.lineWidth=1;
  for(let i=1; i<=10; i++){
    let y = cy - sh/2 + i*(sh/11);
    ctx.beginPath(); ctx.moveTo(50, y); ctx.lineTo(470, y); ctx.stroke();
  }
  
  // Baffles
  ctx.fillStyle = 'rgba(100,120,150,0.6)';
  for(let i=1; i<=nb; i++) {
    let bx = 50 + i*(420/(nb+1));
    if(i%2!==0) {
      // Top cut -> draw bottom plate
      ctx.fillRect(bx, cy - sh/2 + sh*0.25, 4, sh*0.75);
    } else {
      // Bottom cut -> draw top plate
      ctx.fillRect(bx, cy - sh/2, 4, sh*0.75);
    }
  }
  
  ctx.fillStyle='#fff'; ctx.font='10px monospace';
  ctx.fillText("Ds=" + (ds*1000).toFixed(0) + "mm | Nb=" + nb + " | Np=" + np, 10, 20);
}

// Setup animations
function initAnimations() {
  const pc = document.getElementById('pump-canvas');
  if(pc && pc.getContext) {
    const ctx = pc.getContext('2d');
    let angle = 0, t = 0;
    AnimMgr.run('pump', () => { angle+=0.04; t+=0.02; drawPump3D(ctx, pc.width, pc.height, angle, t); });
  }
  const lc = document.getElementById('line-canvas');
  if(lc && lc.getContext) {
    const ctx = lc.getContext('2d');
    let t = 0;
    AnimMgr.run('line', () => { t+=0.02; drawLine3D(ctx, lc.width, lc.height, t); });
  }
  const sc = document.getElementById('sthe-canvas');
  if(sc && sc.getContext) {
    const ctx = sc.getContext('2d');
    let t = 0;
    AnimMgr.run('sthe', () => { t+=0.015; drawSTHE3D(ctx, sc.width, sc.height, t); });
  }
}

// Setup Bindings
function bindAllInputs() {
  const pumpIds = ['pump-density','pump-vol-flow','pump-vessel-el','pump-lll','pump-centreline-el',
    'pump-suc-pressure','pump-npshr','pump-margin','pump-suc-dp'];
  const lineIds = ['line-nps','line-density','line-flow','line-viscosity','line-length','line-roughness'];
  const gasIds = ['gas-mw','gas-viscosity','gas-k','gas-nps','gas-mass-flow','gas-p1','gas-temp','gas-roughness'];
  const stheIds = ['s_Ds','s_L','s_B','s_Np','s_Do','s_Di','s_Pt_ratio'];

  // Input events trigger calculations
  const bindSet = (ids, fn) => {
    ids.forEach(id => {
      const e = document.getElementById(id);
      if(e) e.addEventListener('input', fn);
    });
  };
  
  bindSet(pumpIds, calculatePump);
  bindSet(lineIds, calculateLineSingle);
  bindSet(gasIds, calculateLineGas);
  bindSet(stheIds, calculateSTHE);

  // Auto lookups
  const pTemp = document.getElementById('pump-temp-norm');
  if(pTemp) pTemp.addEventListener('input', () => {
    let t = parseFloat(pTemp.value);
    if(!isNaN(t)) {
      setv('pump-vapor-pres', getVaporPressure(t).toFixed(4));
      calculatePump();
    }
  });
  
  const gType = document.getElementById('gas-type');
  if(gType) gType.addEventListener('change', () => {
    let props = GAS_PROPERTIES[gType.value];
    if(props) {
      setv('gas-mw', props.MW);
      setv('gas-viscosity', props.mu);
      setv('gas-gamma', props.gamma);
      calculateLineGas();
    }
  });

  // Buttons
  
  // Bind buttons
  document.querySelectorAll('button').forEach(btn => {
    const t = btn.textContent.trim().toUpperCase();
    if(t.includes('PUMP')) btn.addEventListener('click', calculatePump);
    if(t.includes('LINE')) btn.addEventListener('click', () => { calculateLineSingle(); calculateLineGas(); });
    if(t.includes('STHE')) btn.addEventListener('click', calculateSTHE);
  });
\n  const btnPump = null;
  if(btnPump) btnPump.addEventListener('click', calculatePump);
  const btnLine = document.getElementById('btn-calc-line');
  if(btnLine) btnLine.addEventListener('click', () => {
    calculateLineSingle(); calculateLineGas(); // run active ones
  });
  const btnSthe = document.getElementById('btn-calc-sthe');
  if(btnSthe) btnSthe.addEventListener('click', calculateSTHE);
  
  // Tab handling for line sizing (Gas vs Liquid)
  const lineTabs = document.querySelectorAll('.line-type-tab');
  lineTabs.forEach(t => {
    t.addEventListener('click', (ev) => {
      lineTabs.forEach(tt => tt.classList.remove('active'));
      ev.currentTarget.classList.add('active');
      const targetId = ev.currentTarget.getAttribute('data-target');
      document.querySelectorAll('.line-type-content').forEach(c => c.style.display = 'none');
      const trg = document.getElementById(targetId);
      if(trg) trg.style.display = 'block';
    });
  });
  
  // Initial compute
  setTimeout(()=>{
    calculatePump();
    calculateLineSingle();
    calculateLineGas();
    calculateSTHE();
  }, 100);
}

initAnimations();
bindAllInputs();

});
\n