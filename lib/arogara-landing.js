/* ══════════════════════════════════════════════════════════════════════
   AROGARA — LANDING / FRONT PAGE
   A professional, warm welcome page shown on first visit (no session yet):
   hero → vision & mission → modules → capabilities → CTA → footer.
   "Get Started" reveals the sign-in gate (mounted by arogara-auth.js) that
   sits underneath. Returning users (with a session) skip straight to the app.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var SESSION_KEY = 'aro_session_v1';
  function hasSession() { try { return !!JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return false; } }

  function css() {
    return '<style id="aro-land-css">'
      + '#aro-landing{position:fixed;inset:0;z-index:100001;overflow-y:auto;background:#050912;color:#dbe7ff;font-family:"Outfit",sans-serif;-webkit-font-smoothing:antialiased;}'
      + '#aro-landing *{box-sizing:border-box;}'
      + '#aro-landing a{color:inherit;text-decoration:none;}'
      + '.al-bg{position:fixed;inset:0;overflow:hidden;pointer-events:none;z-index:0;}'
      + '.al-orb{position:absolute;border-radius:50%;filter:blur(90px);opacity:.5;animation:alFloat 16s ease-in-out infinite;}'
      + '.al-grid{position:absolute;inset:0;background-image:linear-gradient(rgba(126,162,255,.06) 1px,transparent 1px),linear-gradient(90deg,rgba(126,162,255,.06) 1px,transparent 1px);background-size:44px 44px;mask-image:radial-gradient(ellipse at 50% 0%,#000 40%,transparent 78%);}'
      + '@keyframes alFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-28px)}}'
      + '.al-wrap{position:relative;z-index:1;max-width:1180px;margin:0 auto;padding:0 24px;}'
      + '.al-nav{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;padding:16px 24px;max-width:1180px;margin:0 auto;backdrop-filter:blur(8px);}'
      + '.al-brand{display:flex;align-items:center;gap:11px;}'
      + '.al-brand img{width:38px;height:38px;border-radius:11px;box-shadow:0 6px 22px rgba(255,117,56,.32);}'
      + '.al-brand .bn{font-weight:700;font-size:16px;letter-spacing:.14em;color:#fff;}'
      + '.al-brand .bt{font-size:10px;letter-spacing:.24em;color:#8fa6d4;font-weight:600;}'
      + '.al-navlinks{display:flex;align-items:center;gap:26px;font-size:14px;color:#a9bce0;font-weight:500;}'
      + '.al-navlinks a:hover{color:#fff;}'
      + '.al-btn{cursor:pointer;font-family:inherit;font-weight:600;border-radius:11px;border:none;transition:transform .12s,box-shadow .2s,background .2s;}'
      + '.al-btn:active{transform:translateY(1px);}'
      + '.al-btn-primary{background:linear-gradient(135deg,#ff7538,#ff9d4d);color:#231000;padding:11px 22px;font-size:14px;box-shadow:0 10px 30px rgba(255,117,56,.35);}'
      + '.al-btn-primary:hover{box-shadow:0 14px 40px rgba(255,117,56,.5);}'
      + '.al-btn-ghost{background:rgba(126,162,255,.08);border:1px solid rgba(126,162,255,.25);color:#dbe7ff;padding:11px 22px;font-size:14px;}'
      + '.al-btn-ghost:hover{background:rgba(126,162,255,.16);}'
      + '.al-hero{text-align:center;padding:64px 24px 44px;position:relative;z-index:1;max-width:900px;margin:0 auto;}'
      + '.al-pill{display:inline-flex;align-items:center;gap:8px;padding:6px 14px;border:1px solid rgba(126,162,255,.24);border-radius:999px;background:rgba(13,22,47,.55);font-size:12px;color:#9fb4e0;letter-spacing:.04em;margin-bottom:22px;}'
      + '.al-pill .dot{width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 10px #22c55e;}'
      + '.al-hero h1{font-size:clamp(34px,6vw,58px);line-height:1.08;font-weight:700;color:#fff;margin:0 0 20px;letter-spacing:-.01em;}'
      + '.al-hero h1 .g{background:linear-gradient(90deg,#ff9d66,#7ea2ff 75%);-webkit-background-clip:text;background-clip:text;color:transparent;}'
      + '.al-hero p{font-size:clamp(15px,2.2vw,19px);line-height:1.6;color:#93a8d4;max-width:660px;margin:0 auto 32px;}'
      + '.al-cta{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;}'
      + '.al-trust{margin-top:26px;font-size:12.5px;color:#6f86b6;letter-spacing:.03em;}'
      + '.al-stats{display:flex;gap:14px;justify-content:center;flex-wrap:wrap;margin:44px auto 0;max-width:760px;}'
      + '.al-stat{flex:1 1 150px;border:1px solid rgba(126,162,255,.14);border-radius:16px;padding:18px 14px;background:rgba(13,22,47,.45);}'
      + '.al-stat .n{font-size:26px;font-weight:700;color:#fff;}'
      + '.al-stat .l{font-size:12px;color:#8fa6d4;margin-top:3px;}'
      + '.al-sec{padding:56px 0;}'
      + '.al-eyebrow{text-align:center;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:#ff9d66;font-weight:700;margin-bottom:12px;}'
      + '.al-h2{text-align:center;font-size:clamp(26px,4vw,38px);font-weight:700;color:#fff;margin:0 0 12px;}'
      + '.al-lead{text-align:center;font-size:15.5px;color:#93a8d4;max-width:640px;margin:0 auto 40px;line-height:1.6;}'
      + '.al-vm{display:grid;grid-template-columns:1fr 1fr;gap:20px;}'
      + '.al-vmc{border:1px solid rgba(126,162,255,.16);border-radius:20px;padding:30px;background:linear-gradient(160deg,rgba(16,26,54,.7),rgba(9,15,33,.85));position:relative;overflow:hidden;}'
      + '.al-vmc::before{content:"";position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#ff7538,#2a52be);}'
      + '.al-vmc .ic{font-size:30px;margin-bottom:14px;display:block;}'
      + '.al-vmc h3{font-size:20px;color:#fff;margin:0 0 10px;font-weight:600;}'
      + '.al-vmc p{font-size:14.5px;color:#9fb4e0;line-height:1.66;margin:0;}'
      + '.al-mods{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;}'
      + '.al-mod{border:1px solid rgba(126,162,255,.14);border-radius:18px;padding:24px;background:rgba(13,22,47,.5);transition:transform .18s,border-color .18s,background .18s;}'
      + '.al-mod:hover{transform:translateY(-4px);border-color:rgba(255,117,56,.5);background:rgba(19,30,60,.7);}'
      + '.al-mod .mi{width:48px;height:48px;border-radius:13px;display:flex;align-items:center;justify-content:center;font-size:24px;background:linear-gradient(135deg,rgba(255,117,56,.18),rgba(42,82,190,.18));border:1px solid rgba(126,162,255,.18);margin-bottom:16px;}'
      + '.al-mod h4{font-size:16.5px;color:#fff;margin:0 0 7px;font-weight:600;}'
      + '.al-mod p{font-size:13.5px;color:#93a8d4;line-height:1.6;margin:0;}'
      + '.al-caps{display:grid;grid-template-columns:repeat(2,1fr);gap:14px 30px;max-width:860px;margin:0 auto;}'
      + '.al-cap{display:flex;gap:12px;align-items:flex-start;}'
      + '.al-cap .ck{flex:none;width:26px;height:26px;border-radius:8px;background:rgba(34,197,94,.14);border:1px solid rgba(34,197,94,.4);color:#4ade80;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;}'
      + '.al-cap b{color:#e6eeff;font-size:14.5px;font-weight:600;}.al-cap span{display:block;color:#8fa6d4;font-size:13px;margin-top:2px;line-height:1.5;}'
      + '.al-band{margin:20px auto 0;border-radius:24px;padding:48px 32px;text-align:center;background:linear-gradient(135deg,rgba(255,117,56,.14),rgba(42,82,190,.16));border:1px solid rgba(126,162,255,.2);}'
      + '.al-band h2{font-size:clamp(24px,4vw,34px);color:#fff;margin:0 0 12px;font-weight:700;}'
      + '.al-band p{color:#a9bce0;font-size:15px;margin:0 0 26px;}'
      + '.al-foot{border-top:1px solid rgba(126,162,255,.12);margin-top:40px;padding:28px 24px;text-align:center;color:#6f86b6;font-size:12.5px;line-height:1.8;}'
      + '.al-foot .fb{color:#a9bce0;font-weight:600;letter-spacing:.1em;}'
      + '@media(max-width:820px){.al-navlinks a:not(.al-btn){display:none;}.al-vm,.al-mods,.al-caps{grid-template-columns:1fr;}}'
      + '</style>';
  }

  function mod(ic, t, d) {
    return '<div class="al-mod"><div class="mi">' + ic + '</div><h4>' + t + '</h4><p>' + d + '</p></div>';
  }
  function cap(t, d) {
    return '<div class="al-cap"><span class="ck">✓</span><div><b>' + t + '</b><span>' + d + '</span></div></div>';
  }

  function html() {
    return css()
      + '<div class="al-bg">'
      + '  <div class="al-grid"></div>'
      + '  <div class="al-orb" style="width:460px;height:460px;background:#2a52be;top:-160px;left:-120px;"></div>'
      + '  <div class="al-orb" style="width:380px;height:380px;background:#ff7538;top:120px;right:-120px;animation-delay:-7s;"></div>'
      + '</div>'
      + '<nav class="al-nav">'
      + '  <div class="al-brand"><img src="icon-192.png" alt="AROGARA"/><div><div class="bn">AROGARA</div><div class="bt">TECHNOLOGIES</div></div></div>'
      + '  <div class="al-navlinks"><a href="#al-vision">Vision</a><a href="#al-modules">Modules</a><a href="#al-why">Why AROGARA</a><button class="al-btn al-btn-primary" data-launch>Launch App →</button></div>'
      + '</nav>'
      + '<header class="al-hero">'
      + '  <div class="al-pill"><span class="dot"></span> Digital India Initiative · Process Engineering Suite</div>'
      + '  <h1>Design, size and visualise plants <span class="g">in one intelligent workbench.</span></h1>'
      + '  <p>AROGARA brings pump hydraulics, pipe line-sizing and heat-exchanger design together with live 3D visualisation, auto-optimisation to industrial norms, and one-click fabrication drawings & reports — so engineers move from duty to datasheet in minutes, not days.</p>'
      + '  <div class="al-cta"><button class="al-btn al-btn-primary" data-launch>Get Started — it\'s free</button><button class="al-btn al-btn-ghost" data-scroll="al-modules">Explore the suite</button></div>'
      + '  <div class="al-trust">🔒 Verified access · Your design data stays with you · Built for Indian industry</div>'
      + '  <div class="al-stats">'
      + '    <div class="al-stat"><div class="n">6+</div><div class="l">Design modules</div></div>'
      + '    <div class="al-stat"><div class="n">Live 3D</div><div class="l">Plant visualisation</div></div>'
      + '    <div class="al-stat"><div class="n">ASME·TEMA·API</div><div class="l">Standards-aligned</div></div>'
      + '    <div class="al-stat"><div class="n">PDF</div><div class="l">Drawings & reports</div></div>'
      + '  </div>'
      + '</header>'
      + '<div class="al-wrap">'
      + '  <section class="al-sec" id="al-vision">'
      + '    <div class="al-eyebrow">Our purpose</div><h2 class="al-h2">Vision &amp; Mission</h2>'
      + '    <div class="al-vm">'
      + '      <div class="al-vmc"><span class="ic">🌏</span><h3>Our Vision</h3><p>To make world-class process-engineering design accessible to every process engineer — replacing scattered spreadsheets and costly desktop tools with a single, intuitive, cloud workbench that turns rigorous calculation into a delightful experience.</p></div>'
      + '      <div class="al-vmc"><span class="ic">🎯</span><h3>Our Mission</h3><p>To help teams size pumps, pipelines and heat exchangers accurately and confidently — coupling transparent, standards-based engineering with live 3D insight, smart optimisation and instant, fabrication-ready documentation.</p></div>'
      + '    </div>'
      + '  </section>'
      + '  <section class="al-sec" id="al-modules">'
      + '    <div class="al-eyebrow">What\'s inside</div><h2 class="al-h2">Everything you need to size a plant</h2>'
      + '    <p class="al-lead">Six integrated modules share one clean interface, one unit system and one report engine — so you never leave the workbench.</p>'
      + '    <div class="al-mods">'
      + mod('🌀', 'Pump Hydraulics', 'NPSH, TDH, system curves and motor sizing to API 610, with a live 3D pump loop and cavitation-margin checks.')
      + mod('📏', 'Line Sizing', 'Liquid, gas, steam, slurry and two-phase pipe sizing with velocity, pressure-drop and erosion limits.')
      + mod('🔩', 'Shell &amp; Tube (STHE)', 'Thermal &amp; hydraulic design with TEMA layouts, industrial 3D views, and full design datasheets.')
      + mod('🔁', 'Double-Pipe (DPHE)', 'Hairpin heat-exchanger sizing with counter/co-current comparison and manufacturing drawings.')
      + mod('🟧', 'Plate HEx (PHE)', 'Chevron-plate design with ε-NTU, auto-optimised over-surface, GA fabrication drawing, BOM &amp; performance graphs.')
      + mod('🧊', '3D Workbench + AI', 'Rotating 3D plant views and the ARO AI copilot to answer questions about your design in plain language.')
      + '    </div>'
      + '  </section>'
      + '  <section class="al-sec" id="al-why">'
      + '    <div class="al-eyebrow">Why teams choose it</div><h2 class="al-h2">A warm, modern engineering experience</h2>'
      + '    <p class="al-lead">Powerful where it counts, friendly everywhere else.</p>'
      + '    <div class="al-caps">'
      + cap('Live 3D visualisation', 'See every design update as a rotating 3D model and internal-flow animation.')
      + cap('Auto-optimisation', 'Suggestions and one-click tuning keep designs inside the 10–30% industrial band.')
      + cap('Standards-aligned', 'Calculations follow ASME, TEMA, API and PED/EN practice with transparent formulae.')
      + cap('Multi-unit ready', 'Switch SI · US · CGS instantly — every value converts, nothing breaks.')
      + cap('Instant documentation', 'Fabrication GA drawings, BOMs and engineering reports export to clean PDFs.')
      + cap('Secure & private', 'Sign in once; your design data stays with you. Installable as an app.')
      + '    </div>'
      + '  </section>'
      + '  <section class="al-sec"><div class="al-band">'
      + '    <h2>Ready to design smarter?</h2>'
      + '    <p>Create your free engineer profile and open the workbench in seconds.</p>'
      + '    <button class="al-btn al-btn-primary" data-launch>Get Started →</button>'
      + '  </div></section>'
      + '</div>'
      + '<footer class="al-foot"><div class="fb">AROGARA TECHNOLOGIES</div>Bharat FlowSize — Process Engineering, Reimagined.<br>Made in India 🇮🇳 · Digital India Initiative · © ' + (new Date().getFullYear()) + ' AROGARA Technologies. All rights reserved.</footer>';
  }

  function launch() {
    var el = document.getElementById('aro-landing');
    if (!el) return;
    el.style.transition = 'opacity .4s ease';
    el.style.opacity = '0';
    setTimeout(function () { if (el && el.parentNode) el.parentNode.removeChild(el); }, 420);
  }

  function wire(root) {
    root.querySelectorAll('[data-launch]').forEach(function (b) { b.addEventListener('click', launch); });
    root.querySelectorAll('[data-scroll]').forEach(function (b) {
      b.addEventListener('click', function () { var t = document.getElementById(b.getAttribute('data-scroll')); if (t) t.scrollIntoView({ behavior: 'smooth' }); });
    });
    root.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) { var t = document.getElementById(a.getAttribute('href').slice(1)); if (t) { e.preventDefault(); t.scrollIntoView({ behavior: 'smooth' }); } });
    });
  }

  function mount() {
    if (hasSession()) return;                       // returning user → straight to app
    if (document.getElementById('aro-landing')) return;
    var d = document.createElement('div');
    d.id = 'aro-landing';
    d.innerHTML = html();
    document.body.appendChild(d);
    wire(d);
    window.AROLanding = { launch: launch };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(mount, 60); });
  else setTimeout(mount, 60);
})();
