/* ═══════════════════════════════════════════════════════════════════════
   ARO AI — Process Engineering Copilot
   Global floating AI assistant for BHARAT FLOWSIZE.
   Two brains:
     1. Claude API (user connects their own key in Settings — the key is
        stored only in this browser's localStorage and calls go directly
        from the browser to Anthropic).
     2. Built-in expert engine — an offline knowledge base covering pump
        hydraulics, line sizing, and heat-exchanger design, plus live
        context awareness of the tool the user is currently working in.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CFG_KEY = 'aro_ai_cfg_v1';
  var HIST_KEY = 'aro_ai_hist_v1';

  var cfg = { engine: 'builtin', apiKey: '', model: 'claude-sonnet-5' };
  try { cfg = Object.assign(cfg, JSON.parse(localStorage.getItem(CFG_KEY) || '{}')); } catch (e) {}
  var history = [];
  try { history = JSON.parse(localStorage.getItem(HIST_KEY) || '[]'); } catch (e) {}

  function saveCfg() { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) {} }
  function saveHist() { try { localStorage.setItem(HIST_KEY, JSON.stringify(history.slice(-40))); } catch (e) {} }

  /* ── Styles ──────────────────────────────────────────────────────── */
  var css = ''
    + '#aro-ai-fab{position:fixed;bottom:22px;right:22px;z-index:99990;width:58px;height:58px;border-radius:50%;border:none;cursor:pointer;background:linear-gradient(135deg,#ff7538,#2a52be);box-shadow:0 8px 30px rgba(42,82,190,.5);display:flex;align-items:center;justify-content:center;transition:transform .15s;}'
    + '#aro-ai-fab:hover{transform:scale(1.08);}'
    + '#aro-ai-fab svg{width:28px;height:28px;fill:#fff;}'
    + '#aro-ai-fab::after{content:"";position:absolute;inset:-5px;border-radius:50%;border:2px solid rgba(255,117,56,.5);animation:aroAiPulse 2.4s ease-out infinite;}'
    + '@keyframes aroAiPulse{0%{transform:scale(.85);opacity:.9;}70%{transform:scale(1.25);opacity:0;}100%{opacity:0;}}'
    + '#aro-ai-panel{position:fixed;bottom:92px;right:22px;z-index:99991;width:min(410px,calc(100vw - 32px));height:min(600px,calc(100vh - 120px));display:none;flex-direction:column;background:linear-gradient(170deg,rgba(14,22,46,.98),rgba(7,12,26,.99));border:1px solid rgba(126,162,255,.22);border-radius:18px;box-shadow:0 26px 70px rgba(0,0,0,.6);overflow:hidden;font-family:"Outfit",sans-serif;}'
    + '#aro-ai-panel.open{display:flex;animation:aroAiIn .22s cubic-bezier(.2,1.2,.4,1);}'
    + '@keyframes aroAiIn{from{transform:translateY(14px) scale(.97);opacity:0;}to{transform:none;opacity:1;}}'
    + '.aro-ai-head{display:flex;align-items:center;gap:10px;padding:13px 14px;border-bottom:1px solid rgba(126,162,255,.15);background:rgba(13,22,47,.55);}'
    + '.aro-ai-head .av{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#ff7538,#2a52be);display:flex;align-items:center;justify-content:center;font-size:17px;flex:none;}'
    + '.aro-ai-head .ttl{flex:1;min-width:0;}'
    + '.aro-ai-head .ttl b{display:block;color:#fff;font-size:13.5px;font-weight:600;letter-spacing:.02em;}'
    + '.aro-ai-head .ttl span{display:flex;align-items:center;gap:5px;font-size:10.5px;color:#7f96c2;}'
    + '.aro-ai-head .dot{width:6px;height:6px;border-radius:50%;background:#00b875;box-shadow:0 0 6px #00b875;}'
    + '.aro-ai-head button{background:none;border:none;color:#7f96c2;cursor:pointer;font-size:15px;padding:4px 6px;border-radius:6px;}'
    + '.aro-ai-head button:hover{color:#fff;background:rgba(126,162,255,.12);}'
    + '#aro-ai-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:10px;}'
    + '#aro-ai-msgs::-webkit-scrollbar{width:5px;}#aro-ai-msgs::-webkit-scrollbar-thumb{background:rgba(126,162,255,.25);border-radius:3px;}'
    + '.aro-ai-msg{max-width:86%;padding:10px 13px;border-radius:14px;font-size:12.8px;line-height:1.6;word-wrap:break-word;}'
    + '.aro-ai-msg.user{align-self:flex-end;background:linear-gradient(135deg,rgba(255,117,56,.22),rgba(255,117,56,.12));border:1px solid rgba(255,117,56,.3);color:#ffd9c4;border-bottom-right-radius:4px;}'
    + '.aro-ai-msg.bot{align-self:flex-start;background:rgba(13,22,47,.7);border:1px solid rgba(126,162,255,.18);color:#c9d7f2;border-bottom-left-radius:4px;}'
    + '.aro-ai-msg.bot b{color:#fff;}'
    + '.aro-ai-msg.bot code{background:rgba(42,82,190,.25);padding:1px 5px;border-radius:4px;font-family:"IBM Plex Mono",monospace;font-size:11.5px;color:#9fc1ff;}'
    + '.aro-ai-msg.bot ul{margin:6px 0;padding-left:18px;}'
    + '.aro-ai-msg.bot li{margin:3px 0;}'
    + '.aro-ai-typing{align-self:flex-start;display:flex;gap:4px;padding:12px 16px;background:rgba(13,22,47,.7);border:1px solid rgba(126,162,255,.18);border-radius:14px;border-bottom-left-radius:4px;}'
    + '.aro-ai-typing i{width:7px;height:7px;border-radius:50%;background:#7ea2ff;animation:aroAiDot 1.2s infinite;}'
    + '.aro-ai-typing i:nth-child(2){animation-delay:.15s;}.aro-ai-typing i:nth-child(3){animation-delay:.3s;}'
    + '@keyframes aroAiDot{0%,60%,100%{transform:translateY(0);opacity:.4;}30%{transform:translateY(-5px);opacity:1;}}'
    + '.aro-ai-chips{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 8px;}'
    + '.aro-ai-chip{padding:6px 11px;font-size:11px;color:#9fb4de;background:rgba(42,82,190,.14);border:1px solid rgba(126,162,255,.25);border-radius:999px;cursor:pointer;transition:all .13s;font-family:inherit;}'
    + '.aro-ai-chip:hover{background:rgba(255,117,56,.16);border-color:rgba(255,117,56,.4);color:#ffd9c4;}'
    + '.aro-ai-inbar{display:flex;gap:8px;padding:11px 12px;border-top:1px solid rgba(126,162,255,.15);background:rgba(13,22,47,.55);}'
    + '.aro-ai-inbar textarea{flex:1;resize:none;max-height:90px;padding:10px 12px;background:rgba(4,9,22,.85);border:1px solid rgba(126,162,255,.22);border-radius:11px;color:#e6eeff;font-size:12.8px;font-family:inherit;outline:none;line-height:1.45;}'
    + '.aro-ai-inbar textarea:focus{border-color:#ff7538;}'
    + '.aro-ai-inbar button{width:42px;height:42px;flex:none;align-self:flex-end;border:none;border-radius:11px;background:linear-gradient(135deg,#ff7538,#e85d2a);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:transform .12s;}'
    + '.aro-ai-inbar button:hover{transform:scale(1.06);}'
    + '.aro-ai-inbar button svg{width:18px;height:18px;fill:#fff;}'
    + '.aro-ai-foot{padding:5px 14px 9px;font-size:9.5px;color:#5770a3;text-align:center;letter-spacing:.04em;}'
    + '#aro-ai-settings{position:absolute;inset:0;display:none;flex-direction:column;background:rgba(7,12,26,.99);z-index:5;padding:16px;overflow-y:auto;}'
    + '#aro-ai-settings.open{display:flex;}'
    + '#aro-ai-settings h3{margin:4px 0 14px;color:#fff;font-size:15px;font-weight:600;display:flex;justify-content:space-between;align-items:center;}'
    + '#aro-ai-settings h3 button{background:none;border:none;color:#7f96c2;font-size:15px;cursor:pointer;}'
    + '.aro-ai-set-opt{padding:12px;border:1px solid rgba(126,162,255,.2);border-radius:12px;margin-bottom:10px;cursor:pointer;transition:all .13s;}'
    + '.aro-ai-set-opt.sel{border-color:#ff7538;background:rgba(255,117,56,.08);}'
    + '.aro-ai-set-opt b{display:block;color:#e6eeff;font-size:13px;margin-bottom:3px;}'
    + '.aro-ai-set-opt span{font-size:11px;color:#7f96c2;line-height:1.5;display:block;}'
    + '.aro-ai-set-field{margin:10px 0;}'
    + '.aro-ai-set-field label{display:block;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#8fa6d4;margin-bottom:5px;font-weight:600;}'
    + '.aro-ai-set-field input,.aro-ai-set-field select{width:100%;padding:9px 11px;background:rgba(4,9,22,.85);border:1px solid rgba(126,162,255,.22);border-radius:9px;color:#e6eeff;font-size:12.5px;font-family:inherit;outline:none;box-sizing:border-box;}'
    + '.aro-ai-set-save{width:100%;padding:11px;margin-top:6px;border:none;border-radius:10px;background:linear-gradient(90deg,#ff7538,#e85d2a);color:#fff;font-weight:700;font-size:13px;cursor:pointer;font-family:inherit;}'
    + '.aro-ai-set-note{font-size:10.5px;color:#5770a3;line-height:1.55;margin-top:10px;}'
    + '@media (max-width:520px){#aro-ai-panel{right:8px;bottom:84px;}}';

  /* ── Markdown-lite ───────────────────────────────────────────────── */
  function esc(s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); }
  function md(t) {
    var h = esc(t);
    h = h.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
    h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
    // bullet lists
    h = h.replace(/(^|\n)((?:[-•] .*(?:\n|$))+)/g, function (m, pre, block) {
      var items = block.trim().split(/\n/).map(function (l) { return '<li>' + l.replace(/^[-•] /, '') + '</li>'; }).join('');
      return pre + '<ul>' + items + '</ul>';
    });
    h = h.replace(/\n/g, '<br>');
    h = h.replace(/<\/ul><br>/g, '</ul>');
    return h;
  }

  /* ── Live app context ────────────────────────────────────────────── */
  function appContext() {
    var out = [];
    var tabBtn = document.querySelector('.nav-tab.active');
    var tabName = tabBtn ? tabBtn.textContent.replace(/\s+/g, ' ').trim() : 'unknown';
    out.push('Active tool: ' + tabName);
    var sec = document.querySelector('.tab-content.active');
    if (sec) {
      var sub = sec.querySelector('.hex-subtab.active, .line-type-tab.active');
      if (sub) out.push('Active sub-tool: ' + sub.textContent.trim());
      // Result cards currently rendered
      var cards = sec.querySelectorAll('.result-card');
      var vals = [];
      for (var i = 0; i < cards.length && vals.length < 36; i++) {
        var l = cards[i].querySelector('.card-label');
        var v = cards[i].querySelector('.card-value');
        if (l && v && v.textContent.trim() && v.textContent.trim() !== '-') {
          vals.push(l.textContent.trim() + ' = ' + v.textContent.trim());
        }
      }
      if (vals.length) out.push('Current results: ' + vals.join('; '));
      var banner = sec.querySelector('.status-banner');
      if (banner && banner.textContent.trim()) out.push('Status: ' + banner.textContent.replace(/\s+/g, ' ').trim().slice(0, 200));
    }
    return out.join('\n');
  }

  /* ── Claude API brain ────────────────────────────────────────────── */
  function askClaude(userText, done, fail) {
    var sys = 'You are ARO AI, the expert process-engineering copilot inside BHARAT FLOWSIZE, '
      + 'a web suite for pump sizing (API 610), line sizing (liquid/gas/steam/slurry/two-phase) and '
      + 'heat exchanger design (DPHE and shell-&-tube per TEMA/Kern). Be precise, quantitative and practical. '
      + 'Use short paragraphs and bullet points; show formulas in plain text. '
      + 'You can answer general questions too, but you excel at chemical/mechanical process engineering.\n\n'
      + 'Live context from the user\'s current screen:\n' + appContext();
    var msgs = [];
    history.slice(-12).forEach(function (m) { msgs.push({ role: m.role === 'bot' ? 'assistant' : 'user', content: m.text }); });
    msgs.push({ role: 'user', content: userText });
    fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': cfg.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({ model: cfg.model, max_tokens: 1400, system: sys, messages: msgs })
    }).then(function (r) {
      if (!r.ok) return r.json().then(function (j) { throw new Error((j.error && j.error.message) || ('HTTP ' + r.status)); });
      return r.json();
    }).then(function (j) {
      var txt = (j.content || []).map(function (b) { return b.text || ''; }).join('');
      done(txt || '…');
    }).catch(function (e) {
      fail('**Claude API error:** ' + esc(e.message) + '\n\nCheck your API key in ⚙ Settings, or switch back to the built-in engine.');
    });
  }

  /* ── Built-in expert engine ──────────────────────────────────────── */
  var KB = [
    { k: ['npsh', 'cavitation', 'suction pressure', 'vapour pressure', 'vapor pressure'], a: '**NPSH — Net Positive Suction Head**\n- `NPSHa = Hatm + Hstatic − Hfriction − Hvapour` (all in metres of liquid)\n- NPSHr comes from the pump vendor curve\n- **Rule (API 610 / HI):** NPSHa ≥ NPSHr + margin; ratio ≥ 1.3 is a common criterion\n- If NPSHa < NPSHr → **cavitation**: bubbles collapse on the impeller → pitting, noise, vibration, head loss\n- Fixes for low NPSHa: raise liquid level, larger/shorter suction line, fewer fittings, cooler liquid, or a low-NPSHr pump/inducer' },
    { k: ['tdh', 'total dynamic head', 'differential head', 'pump head'], a: '**Total Dynamic Head (TDH)**\n- `TDH = ΔHstatic + ΔHfriction + ΔHpressure`\n- Static = discharge elevation − suction elevation\n- Friction from Darcy-Weisbach across pipe + fittings + valves\n- Pressure term converts vessel pressure difference to liquid head: `H = ΔP × 10.2 / SG` (bar → m)\n- Always express head in **metres of the pumped liquid**, not water, when selecting the pump' },
    { k: ['motor', 'bhp', 'brake power', 'power sizing', 'kw rating'], a: '**Motor & power sizing**\n- Hydraulic power `Ph = ρ·g·Q·H / 1000` (kW, Q in m³/s, H in m)\n- Brake power `BHP = Ph / η_pump`\n- **API 610 motor margins:** ≤22 kW → 125% of BHP; 22–55 kW → 115%; >55 kW → 110%\n- Pick the next standard IEC/NEMA frame rating; aim for 75–90% motor loading at rated duty' },
    { k: ['affinity', 'speed change', 'vfd', 'impeller trim'], a: '**Affinity laws**\n- Flow: `Q2/Q1 = N2/N1`\n- Head: `H2/H1 = (N2/N1)²`\n- Power: `P2/P1 = (N2/N1)³`\n- Same ratios apply approximately to impeller diameter trim (within ~±10%)\n- A VFD exploits the cubic power law — a 20% speed reduction saves ~half the power' },
    { k: ['bep', 'operating point', 'pump curve', 'system curve', 'preferred operating region'], a: '**Pump & system curves**\n- Operating point = intersection of pump H-Q curve and system curve `Hsys = Hstatic + K·Q²`\n- **BEP:** operate within 70–120% of best-efficiency flow (API 610 preferred region 80–110%)\n- Left of BEP → recirculation, high radial thrust, temperature rise\n- Right of BEP → NPSH problems, overload, shaft deflection' },
    { k: ['mechanical seal', 'seal plan', 'gland packing', 'flush plan'], a: '**Sealing**\n- Mechanical seals for pressures >10 bar, toxic/flammable or high-speed duties; packing only for benign low-pressure services\n- Common API 682 flush plans: **Plan 11** (recirculation from discharge), **Plan 21** (cooled recirculation), **Plan 53/54** (pressurised barrier for dirty/hazardous fluids)\n- Seal chamber pressure should exceed vapour pressure by at least ~1 bar to prevent flashing at the faces' },
    { k: ['api 610', 'iso 5199', 'asme b73', 'pump standard', 'hydraulic institute'], a: '**Pump standards**\n- **API 610** — heavy-duty refinery/petrochemical centrifugal pumps (centreline-mounted, high casing design margins)\n- **ISO 5199 / ISO 2858** — chemical duty, European practice\n- **ASME B73.1** — ANSI chemical process pumps\n- **HI standards** — test tolerances, NPSH margin and vibration acceptance levels' },
    { k: ['vibration', 'bearing', 'alignment', 'l10'], a: '**Vibration & bearings**\n- API 610 vibration acceptance: ~2.5–3.0 mm/s RMS at bearing housings (size-dependent)\n- Bearing life target: **L10 ≥ 25,000 h** continuous per API 610\n- Usual culprits: misalignment, unbalance, cavitation, pipe strain, soft foot\n- Trend velocity (mm/s) monthly; investigate step changes >25%' },
    { k: ['specific speed', 'pump type', 'radial', 'axial impeller'], a: '**Specific speed Ns**\n- `Ns = N·√Q / H^0.75` (rpm, m³/s, m)\n- Ns < ~1000 → radial (high head / low flow)\n- 1000–5000 → mixed flow\n- > 5000 → axial (low head / high flow)\n- Higher Ns generally means a flatter H-Q curve and steeper power curve' },
    { k: ['line sizing', 'pipe velocity', 'velocity limit', 'liquid line'], a: '**Liquid line sizing guidelines**\n- Pump suction: **0.6–1.5 m/s** (keep low to protect NPSH)\n- Pump discharge: **2–4 m/s**\n- Gravity/drain lines: 0.5–1 m/s\n- Also check pressure gradient: typically **≤ 4.5 bar/km** for long transfer lines\n- Then verify against erosion velocity `Ve = C/√ρmix` (API RP 14E, C ≈ 100–160 for continuous service)' },
    { k: ['gas line', 'gas sizing', 'compressible', 'mach'], a: '**Gas line sizing**\n- Velocity guideline: **10–25 m/s** for process gas headers (up to 34 m/s for utility/flare cases per norms)\n- Keep Mach number < 0.3 to treat flow as incompressible per segment; otherwise use compressible equations (Weymouth / Panhandle / general isothermal flow)\n- Pressure drop target often ≤ 1–2% of line pressure per 100 m\n- Watch acoustic-induced vibration (AIV) at high ΔP letdowns' },
    { k: ['steam line', 'steam sizing', 'steam velocity'], a: '**Steam line sizing**\n- Saturated steam: **25–40 m/s**\n- Superheated steam: **35–60 m/s**\n- Exhaust/low-pressure steam: up to 60 m/s\n- Size on velocity first, then verify total ΔP (rule of thumb ≤ 0.1 bar per 100 m for distribution)\n- Provide drip legs + steam traps every 30–50 m on saturated lines to manage condensate' },
    { k: ['slurry', 'settling', 'durand'], a: '**Slurry line sizing**\n- Key rule: stay **above the critical deposition velocity** (Durand: `Vc = FL·√(2·g·D·(S−1))`) so solids don\'t settle — typically 1.2–1.5× margin\n- Typical operating range 1.5–3 m/s; above ~4 m/s erosion accelerates sharply with particle hardness\n- Use rubber-lined or hardened pipe for abrasive service; long-radius bends' },
    { k: ['two phase', 'two-phase', 'flow regime', 'slug'], a: '**Two-phase line sizing**\n- Determine the flow regime first (Baker / Mandhane map): bubble, slug, churn, annular, mist\n- **Avoid slug flow** in process piping — it hammers equipment; route/size to stay in annular or bubble regimes\n- Erosional velocity per API RP 14E: `Ve = C/√ρmix` with ρmix the homogeneous density\n- Pressure drop via Lockhart-Martinelli or homogeneous model — this app reports both where applicable' },
    { k: ['lmtd', 'log mean', 'temperature difference', 'ft factor', 'correction factor'], a: '**LMTD method**\n- `LMTD = (ΔT1 − ΔT2) / ln(ΔT1/ΔT2)` with terminal approaches ΔT1, ΔT2\n- Counter-current gives the highest LMTD; co-current the lowest\n- Multi-pass shell-&-tube needs the **Ft correction**: `Q = U·A·Ft·LMTD` — keep **Ft ≥ 0.75**, otherwise add shells in series\n- Temperature cross (cold outlet > hot outlet) usually forces counter-current or more shell passes' },
    { k: ['fouling', 'dirt factor', 'tema fouling'], a: '**Fouling resistances (TEMA typical)**\n- Cooling tower water: 0.00018–0.00035 m²K/W\n- Sea water: ~0.0001\n- Light hydrocarbons: 0.0002\n- Heavy fuel oils: 0.0005–0.0009\n- Steam (clean): ~0.0001\n- Design with dirty U (`1/Ud = 1/Uc + Rf_total`) and 10–30% excess area; too much excess promotes low velocity → **more** fouling' },
    { k: ['overall u', 'u value', 'heat transfer coefficient', 'typical u'], a: '**Typical overall U values (service → W/m²K)**\n- Water/water: 800–1500\n- Steam/water: 1500–4000\n- Water/light organics: 350–900\n- Water/heavy oils: 60–300\n- Gas/liquid (low-P gas): 20–60\n- Condensing HC/water: 400–1100\nUse them for first-pass area estimates: `A = Q/(U·LMTD·Ft)`' },
    { k: ['baffle', 'baffle cut', 'baffle spacing'], a: '**Baffles (segmental)**\n- Baffle cut: **20–35%** of shell ID (25% is the workhorse) — too small → high ΔP; too large → bypassing and dead zones\n- Spacing: **0.2–1.0 × shell ID** (never < 50 mm); TEMA max unsupported tube span governs the upper limit\n- Closer spacing → higher shell-side h **and** higher ΔP\n- Alternating cut orientation forces the serpentine cross-flow you can see in the 3D view' },
    { k: ['tube pitch', 'triangular', 'square pitch', 'tube layout'], a: '**Tube layout**\n- Pitch ratio: **1.25 × tube OD** minimum (TEMA)\n- **Triangular (30°)** — more tubes per shell, higher h, but no mechanical cleaning lanes → for clean shell-side fluids\n- **Square (90°/45°)** — cleaning lanes for fouling services, slightly lower h\n- Common tube: 19.05 mm (3/4") or 25.4 mm (1") OD, lengths 3.66/4.88/6.1/7.32 m' },
    { k: ['tema', 'shell type', 'aes', 'bem', 'floating head'], a: '**TEMA designations (front–shell–rear)**\n- **BEM** — bonnet, one-pass shell, fixed tubesheet: cheapest, no thermal-expansion relief, shell-side not cleanable\n- **AES** — channel + floating head: handles differential expansion, fully cleanable, most common refinery choice\n- **U-tube (BEU)** — cheap expansion relief but tube-side cleaning is hard and interior rows can\'t be replaced\n- Pick rear head based on ΔT between shell & tube metal and fouling cleanability needs' },
    { k: ['kern', 'bell delaware', 'shell side coefficient'], a: '**Shell-side methods**\n- **Kern** — quick, ±25–40% accuracy: `Nu = 0.36·Re^0.55·Pr^(1/3)·(μ/μw)^0.14` on the shell-equivalent diameter (this app\'s STHE module uses Kern)\n- **Bell-Delaware** — corrects for baffle leakage, bypass and window flows; ±15% and the standard for detailed design\n- If your Kern-based excess area is marginal (<15%), a Bell-Delaware check is prudent before ordering' },
    { k: ['dittus', 'nusselt', 'tube side coefficient', 'sieder'], a: '**Tube-side heat transfer**\n- Turbulent: **Dittus-Boelter** `Nu = 0.023·Re^0.8·Pr^n` (n = 0.4 heating, 0.3 cooling)\n- Viscous fluids: **Sieder-Tate** with `(μ/μw)^0.14` wall correction\n- Keep tube velocity 1–2.5 m/s (water) — below 1 m/s fouling accelerates, above ~3 m/s erosion\n- Laminar (Re < 2300) heat transfer is poor: consider more passes or smaller tubes' },
    { k: ['reynolds', 'laminar', 'turbulent', 'transition'], a: '**Reynolds number**\n- `Re = ρ·v·D/μ`\n- Pipe flow: laminar < 2300, transitional 2300–4000 (avoid designing here), turbulent > 4000\n- Higher Re → thinner boundary layer → better heat transfer and mixing, at the cost of ΔP (∝ v² roughly)' },
    { k: ['pressure drop', 'darcy', 'friction factor', 'colebrook'], a: '**Pressure drop (single phase)**\n- Darcy-Weisbach: `ΔP = f·(L/D)·(ρv²/2)`\n- f from Colebrook-White (or Churchill explicit) using roughness ε: commercial steel ≈ 0.045 mm\n- Add fittings via K-factors or equivalent lengths\n- Typical allowances: exchanger tube-side ≤ 70 kPa, shell-side ≤ 50–70 kPa; pump discharge lines sized for economics (ΔP vs pipe cost)' },
    { k: ['dphe', 'double pipe', 'hairpin'], a: '**Double-pipe (hairpin) exchangers**\n- Best below ~30 m² duty; true counter-current so **no Ft penalty**\n- Inner pipe carries the fouling/high-pressure fluid (easier to clean/contain)\n- Annulus h uses the equivalent diameter `De = (D2² − Do²)/Do`\n- Add hairpins in series for area; in parallel for ΔP relief\n- Use the DPHE tab\'s auto-upgrade suggestions to hit 10–30% excess area' },
    { k: ['sthe', 'shell and tube', 'shell & tube', 'heat exchanger design'], a: '**Shell-&-tube design flow (as this app implements)**\n1. Duty `Q = m·Cp·ΔT`, then LMTD and Ft\n2. Assume U → first-pass area → tube count for chosen OD/length\n3. Tube-side h (Dittus-Boelter/Sieder-Tate), shell-side h (Kern)\n4. `1/Uc = 1/hio + 1/ho + wall`; add fouling → Ud\n5. Iterate geometry until excess area 10–30% with ΔP inside limits\nOpen the **HEAT EXCHANGER → STHE DESIGN** tab and the 3D industrial view updates live with your geometry' },
    { k: ['excess area', 'overdesign', 'design margin'], a: '**Excess area / overdesign**\n- `Excess % = (A_available/A_required − 1) × 100`\n- Target **10–30%**: covers fouling growth and data uncertainty\n- >40% is not "safer": velocities drop, fouling accelerates, and cost rises\n- <10% leaves no cleaning interval margin — expect early performance loss' },
    { k: ['water outlet 40', 'cooling water outlet', 'scaling temperature'], a: '**Why cooling-water outlet ≤ 40–45 °C?**\n- Above ~40 °C the inverse-solubility salts (CaCO₃, CaSO₄, MgSO₄) precipitate onto hot tube walls\n- Scale layer k ≈ 0.5–2 W/mK — a 0.5 mm layer can halve U\n- Remedies: raise water flow, use treated/closed-loop water, or accept a larger exchanger with lower wall temperature' },
    { k: ['erosion velocity', 'api 14e', 'erosional'], a: '**Erosional velocity (API RP 14E)**\n- `Ve = C/√ρm` (Ve in ft/s, ρm in lb/ft³) — C ≈ 100 continuous, 125 intermittent, up to 150–200 for clean solids-free service with CRA metallurgy\n- Operating above Ve with solids present strips the protective oxide film → rapid wall loss at bends/tees\n- Solids present? Cap velocity harder and use long-radius bends or target tees' },
    { k: ['unit', 'convert', 'si', 'us customary'], a: '**Units in this app**\n- Use the **unit-system selector** in the top-right header (SI / US Customary / Mixed-CGS) — inputs and results convert automatically\n- Handy: 1 bar = 10.2 m water = 14.5 psi; 1 m³/h = 4.4 gpm; 1 kW = 1.34 hp; 1 W/m²K = 0.176 Btu/hr·ft²·°F' },
    { k: ['report', 'pdf', 'export', 'download'], a: '**Reports**\n- Each tool has a **Download Report** button after a successful calculation — it produces a formatted PDF (via html2pdf) with your inputs, results and charts\n- Run the calculation first; the button stays inactive until results exist' },
    { k: ['3d', 'animation', 'visualization', 'industrial view'], a: '**3D views**\n- Pump tab: full hydraulic loop with vessel, impeller and live flow\n- Heat exchanger tab: DPHE hairpin and the **STHE industrial view** (cutaway shell, tube bundle, baffles, labelled nozzles)\n- Drag to rotate, scroll to zoom — the model rebuilds instantly when you change geometry inputs like tube count, shell ID or baffle spacing' },
    { k: ['who are you', 'what can you do', 'help', 'about you', 'features'], a: '**I\'m ARO AI** — the engineering copilot for BHARAT FLOWSIZE. Ask me about:\n- Pump hydraulics: NPSH, TDH, motor sizing, seals, standards\n- Line sizing: liquid, gas, steam, slurry, two-phase velocities & ΔP\n- Heat exchangers: LMTD, fouling, U values, baffles, TEMA, Kern vs Bell-Delaware\n- This app itself: where things are, what results mean, reports, 3D views\n\n💡 For fully open-ended questions, connect a Claude API key in **⚙ Settings** and I\'ll get a much bigger brain.' }
  ];

  var GREET = /^(hi+|hello+|hey+|namaste|good (morning|afternoon|evening)|yo)\b/i;
  var THANKS = /(thank|thanks|thx|great|awesome|nice|good job|well done)/i;

  function askBuiltin(q, done) {
    var text = q.toLowerCase();
    if (GREET.test(text.trim())) {
      done('Namaste! 👋 I\'m **ARO AI**, your process-engineering copilot.\n\nAsk me about pump hydraulics, line sizing, or heat-exchanger design — or about anything on your current screen. Try: `what should my NPSH margin be?`');
      return;
    }
    if (THANKS.test(text) && text.length < 40) {
      done('Glad to help! 🙌 Anything else on your design — NPSH, pressure drop, exchanger area?');
      return;
    }
    // score KB entries
    var best = null, bestScore = 0;
    KB.forEach(function (e) {
      var s = 0;
      e.k.forEach(function (kw) {
        if (text.indexOf(kw) !== -1) s += kw.length >= 8 ? 3 : kw.length >= 5 ? 2 : 1;
      });
      if (s > bestScore) { bestScore = s; best = e; }
    });
    // second-best for related reading
    if (best) {
      var ans = best.a;
      // context-aware garnish
      var ctx = appContext();
      if (/Current results:/.test(ctx) && /result|my design|my calc|current|this design/.test(text)) {
        ans += '\n\n📋 **From your screen:** ' + ctx.split('Current results: ')[1].split('\n')[0].split('; ').slice(0, 5).join('; ') + ' …';
      }
      done(ans);
      return;
    }
    if (/result|explain my|my design|current|what does this mean/.test(text)) {
      var c = appContext();
      done('Here\'s what I can see on your screen right now:\n\n' + c.split('\n').map(function (l) { return '- ' + l; }).join('\n') + '\n\nAsk me about any specific value — e.g. `is this NPSH margin ok?` or `is my excess area enough?`');
      return;
    }
    done('I don\'t have a confident built-in answer for that one. I\'m strongest on:\n- **Pumps** — NPSH, head, power, seals, API 610\n- **Lines** — velocity limits, ΔP, erosion, two-phase\n- **Heat exchangers** — LMTD, U, fouling, baffles, TEMA\n\n💡 **Tip:** connect a Claude API key in **⚙ Settings** and I can answer any question — engineering or otherwise — with full reasoning.');
  }

  /* ── UI ──────────────────────────────────────────────────────────── */
  function build() {
    var st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);

    var fab = document.createElement('button');
    fab.id = 'aro-ai-fab';
    fab.title = 'ARO AI — Engineering Copilot';
    fab.innerHTML = '<svg viewBox="0 0 24 24"><path d="M12 2l1.9 5.6L19.5 9l-5.6 1.9L12 16.5l-1.9-5.6L4.5 9l5.6-1.4L12 2zm7 12l.9 2.6 2.6.9-2.6.9L19 21l-.9-2.6-2.6-.9 2.6-.9L19 14zM5 14l.7 2 2 .7-2 .7L5 19.5l-.7-2.1-2-.7 2-.7L5 14z"/></svg>';
    document.body.appendChild(fab);

    var panel = document.createElement('div');
    panel.id = 'aro-ai-panel';
    panel.innerHTML = ''
      + '<div class="aro-ai-head">'
      + '  <div class="av">✨</div>'
      + '  <div class="ttl"><b>ARO AI</b><span><i class="dot"></i><span id="aro-ai-mode">Built-in expert engine</span></span></div>'
      + '  <button id="aro-ai-clear" title="Clear conversation">🗑</button>'
      + '  <button id="aro-ai-gear" title="Settings">⚙</button>'
      + '  <button id="aro-ai-min" title="Close">✕</button>'
      + '</div>'
      + '<div id="aro-ai-msgs"></div>'
      + '<div class="aro-ai-chips" id="aro-ai-chips"></div>'
      + '<div class="aro-ai-inbar">'
      + '  <textarea id="aro-ai-in" rows="1" placeholder="Ask about your design, or anything…"></textarea>'
      + '  <button id="aro-ai-send" title="Send"><svg viewBox="0 0 24 24"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg></button>'
      + '</div>'
      + '<div class="aro-ai-foot" id="aro-ai-foot">ARO AI · BHARAT FLOWSIZE COPILOT</div>'
      + '<div id="aro-ai-settings"></div>';
    document.body.appendChild(panel);

    fab.addEventListener('click', function () {
      panel.classList.toggle('open');
      if (panel.classList.contains('open')) {
        if (!history.length) greet();
        else redraw();
        document.getElementById('aro-ai-in').focus();
      }
    });
    panel.querySelector('#aro-ai-min').addEventListener('click', function () { panel.classList.remove('open'); });
    panel.querySelector('#aro-ai-clear').addEventListener('click', function () {
      history = []; saveHist(); greet();
    });
    panel.querySelector('#aro-ai-gear').addEventListener('click', openSettings);
    panel.querySelector('#aro-ai-send').addEventListener('click', sendCurrent);
    var ta = panel.querySelector('#aro-ai-in');
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendCurrent(); }
    });
    ta.addEventListener('input', function () {
      ta.style.height = 'auto';
      ta.style.height = Math.min(ta.scrollHeight, 90) + 'px';
    });
    updateModeLabel();
  }

  function updateModeLabel() {
    var el = document.getElementById('aro-ai-mode');
    if (el) el.textContent = cfg.engine === 'claude' ? 'Claude API · ' + cfg.model.replace('claude-', '') : 'Built-in expert engine';
  }

  var CHIPS = ['Explain my current results', 'What NPSH margin do I need?', 'Typical fouling factors?', 'Steam line velocity limits', 'Kern vs Bell-Delaware?'];

  function greet() {
    var msgs = document.getElementById('aro-ai-msgs');
    msgs.innerHTML = '';
    addBubble('bot', 'Namaste! 👋 I\'m **ARO AI**, your process-engineering copilot.\n\nI can explain your live results, size checks, exchanger design rules and much more. What are we working on today?', false);
    drawChips();
  }

  function drawChips() {
    var host = document.getElementById('aro-ai-chips');
    host.innerHTML = '';
    CHIPS.forEach(function (c) {
      var b = document.createElement('button');
      b.className = 'aro-ai-chip';
      b.textContent = c;
      b.addEventListener('click', function () { send(c); });
      host.appendChild(b);
    });
  }

  function redraw() {
    var msgs = document.getElementById('aro-ai-msgs');
    msgs.innerHTML = '';
    history.slice(-40).forEach(function (m) { addBubble(m.role, m.text, true); });
    drawChips();
    msgs.scrollTop = msgs.scrollHeight;
  }

  function addBubble(role, text, instant) {
    var msgs = document.getElementById('aro-ai-msgs');
    var d = document.createElement('div');
    d.className = 'aro-ai-msg ' + role;
    d.innerHTML = role === 'bot' ? md(text) : esc(text);
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    return d;
  }

  function typing(on) {
    var msgs = document.getElementById('aro-ai-msgs');
    var t = document.getElementById('aro-ai-typing');
    if (on && !t) {
      t = document.createElement('div');
      t.id = 'aro-ai-typing';
      t.className = 'aro-ai-typing';
      t.innerHTML = '<i></i><i></i><i></i>';
      msgs.appendChild(t);
      msgs.scrollTop = msgs.scrollHeight;
    } else if (!on && t) t.remove();
  }

  function sendCurrent() {
    var ta = document.getElementById('aro-ai-in');
    var q = ta.value.trim();
    if (!q) return;
    ta.value = ''; ta.style.height = 'auto';
    send(q);
  }

  var busy = false;
  function send(q) {
    if (busy) return;
    busy = true;
    addBubble('user', q, false);
    history.push({ role: 'user', text: q }); saveHist();
    typing(true);
    var finish = function (ans) {
      typing(false);
      addBubble('bot', ans, false);
      history.push({ role: 'bot', text: ans }); saveHist();
      busy = false;
    };
    if (cfg.engine === 'claude' && cfg.apiKey) {
      askClaude(q, finish, finish);
    } else {
      // small human-feel delay
      setTimeout(function () { askBuiltin(q, finish); }, 450 + Math.random() * 500);
    }
  }

  /* ── Settings ────────────────────────────────────────────────────── */
  function openSettings() {
    var s = document.getElementById('aro-ai-settings');
    s.classList.add('open');
    s.innerHTML = ''
      + '<h3>Assistant settings <button id="aro-ai-set-x">✕</button></h3>'
      + '<div class="aro-ai-set-opt' + (cfg.engine === 'builtin' ? ' sel' : '') + '" data-e="builtin"><b>🧠 Built-in expert engine</b><span>Offline knowledge base for pumps, lines and heat exchangers. Free, instant, private — works without any setup.</span></div>'
      + '<div class="aro-ai-set-opt' + (cfg.engine === 'claude' ? ' sel' : '') + '" data-e="claude"><b>🚀 Claude API (Anthropic)</b><span>Full AI reasoning for any question, aware of your live screen context. Bring your own API key.</span></div>'
      + '<div id="aro-ai-claude-cfg" style="display:' + (cfg.engine === 'claude' ? 'block' : 'none') + ';">'
      + '  <div class="aro-ai-set-field"><label>Anthropic API key</label><input id="aro-ai-key" type="password" placeholder="sk-ant-…" value="' + esc(cfg.apiKey) + '"></div>'
      + '  <div class="aro-ai-set-field"><label>Model</label><select id="aro-ai-model">'
      + '    <option value="claude-sonnet-5"' + (cfg.model === 'claude-sonnet-5' ? ' selected' : '') + '>Claude Sonnet 5 — best balance</option>'
      + '    <option value="claude-haiku-4-5-20251001"' + (cfg.model === 'claude-haiku-4-5-20251001' ? ' selected' : '') + '>Claude Haiku 4.5 — fastest / cheapest</option>'
      + '    <option value="claude-opus-4-8"' + (cfg.model === 'claude-opus-4-8' ? ' selected' : '') + '>Claude Opus 4.8 — deepest reasoning</option>'
      + '  </select></div>'
      + '  <div class="aro-ai-set-note">🔒 Your key is stored <b>only in this browser</b> (localStorage) and is sent directly to Anthropic — never to Arogara servers. Get a key at console.anthropic.com.</div>'
      + '</div>'
      + '<button class="aro-ai-set-save" id="aro-ai-set-save">SAVE SETTINGS</button>';
    s.querySelector('#aro-ai-set-x').addEventListener('click', function () { s.classList.remove('open'); });
    s.querySelectorAll('.aro-ai-set-opt').forEach(function (o) {
      o.addEventListener('click', function () {
        s.querySelectorAll('.aro-ai-set-opt').forEach(function (x) { x.classList.remove('sel'); });
        o.classList.add('sel');
        document.getElementById('aro-ai-claude-cfg').style.display = o.getAttribute('data-e') === 'claude' ? 'block' : 'none';
      });
    });
    s.querySelector('#aro-ai-set-save').addEventListener('click', function () {
      var sel = s.querySelector('.aro-ai-set-opt.sel');
      cfg.engine = sel ? sel.getAttribute('data-e') : 'builtin';
      var k = document.getElementById('aro-ai-key');
      var m = document.getElementById('aro-ai-model');
      if (k) cfg.apiKey = k.value.trim();
      if (m) cfg.model = m.value;
      if (cfg.engine === 'claude' && !cfg.apiKey) {
        alert('Enter your Anthropic API key to use the Claude engine, or choose the built-in engine.');
        return;
      }
      saveCfg();
      updateModeLabel();
      s.classList.remove('open');
      addBubble('bot', cfg.engine === 'claude'
        ? '🚀 **Claude engine connected** (' + cfg.model + '). Ask me anything — I can also see your current screen context.'
        : '🧠 Switched to the **built-in expert engine**.', false);
    });
  }

  function init() { build(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
