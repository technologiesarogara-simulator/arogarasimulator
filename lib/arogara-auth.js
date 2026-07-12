/* ═══════════════════════════════════════════════════════════════════════
   BHARAT FLOWSIZE — ACCESS GATEWAY
   Professional sign-in gate: engineer profile (name / email / mobile),
   user-selectable verification channel (Email link or SMS OTP via
   Firebase Authentication), developer demo access, session persistence
   and a header profile chip with logout.
   ═══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var SESSION_KEY = 'aro_session_v1';
  var PENDING_EMAIL_KEY = 'aro_pending_email';
  var PENDING_PROFILE_KEY = 'aro_pending_profile';
  var DEMO_CODE = 'ARO-DEV-2026';

  /* EmailJS delivery for 6-digit email OTP codes (free tier, no billing).
     Fill these three IDs from the EmailJS dashboard to activate real
     email OTP. Until then the email channel falls back to a Firebase
     sign-in link. window.ARO_EMAILJS can override for testing. */
  var EMAILJS = window.ARO_EMAILJS || {
    serviceId: 'service_9eqc5is',
    templateId: 'template_548fttj',
    publicKey: 'q2ET5hsFnU2boLg3r'
  };
  function emailOtpReady() { return !!(EMAILJS.serviceId && EMAILJS.templateId && EMAILJS.publicKey); }

  var state = {
    step: 'profile',          // profile | otp | emailsent | success
    method: 'email',          // email | sms
    name: '', email: '', ccode: '+91', phone: '',
    confirmation: null,       // firebase phone confirmationResult
    emailOtp: null,           // { code, exp, tries } for EmailJS OTP
    resendTimer: null,
    firebaseStatus: 'idle'    // idle | loading | ready | unavailable
  };

  /* ── Session helpers ─────────────────────────────────────────────── */
  function getSession() {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { return null; }
  }
  function setSession(s) { try { localStorage.setItem(SESSION_KEY, JSON.stringify(s)); } catch (e) {} }
  function clearSession() { try { localStorage.removeItem(SESSION_KEY); } catch (e) {} }

  /* ── Firebase loader (auto-config from Firebase Hosting) ────────── */
  function loadScript(src) {
    return new Promise(function (res, rej) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = res;
      s.onerror = function () { rej(new Error('failed: ' + src)); };
      document.head.appendChild(s);
    });
  }
  var fbPromise = null;
  function loadFirebase() {
    if (fbPromise) return fbPromise;
    state.firebaseStatus = 'loading';
    fbPromise = loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
      .then(function () { return loadScript('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth-compat.js'); })
      .then(function () { return loadScript('/__/firebase/init.js'); })
      .then(function () {
        if (!window.firebase || !firebase.apps || !firebase.apps.length) throw new Error('no firebase app');
        state.firebaseStatus = 'ready';
        return window.firebase;
      })
      .catch(function (err) {
        state.firebaseStatus = 'unavailable';
        throw err;
      });
    return fbPromise;
  }

  /* ── Styles ──────────────────────────────────────────────────────── */
  var css = ''
    + '#aro-gate{position:fixed;inset:0;z-index:100000;display:flex;background:#040815;font-family:"Outfit",sans-serif;overflow:auto;}'
    + '#aro-gate *{box-sizing:border-box;}'
    + '.aro-gate-bg{position:absolute;inset:0;overflow:hidden;pointer-events:none;}'
    + '.aro-gate-bg .grid{position:absolute;inset:-50%;background-image:linear-gradient(rgba(42,82,190,0.12) 1px,transparent 1px),linear-gradient(90deg,rgba(42,82,190,0.12) 1px,transparent 1px);background-size:44px 44px;transform:perspective(600px) rotateX(58deg) translateY(-10%);animation:aroGridMove 24s linear infinite;}'
    + '@keyframes aroGridMove{from{background-position:0 0;}to{background-position:0 440px;}}'
    + '.aro-orb{position:absolute;border-radius:50%;filter:blur(90px);opacity:.5;animation:aroOrb 12s ease-in-out infinite alternate;}'
    + '@keyframes aroOrb{from{transform:translateY(-24px) scale(1);}to{transform:translateY(24px) scale(1.15);}}'
    + '.aro-gate-inner{position:relative;margin:auto;display:flex;gap:48px;align-items:center;justify-content:center;padding:48px 32px;width:100%;max-width:1120px;flex-wrap:wrap;}'
    + '.aro-hero{flex:1 1 420px;max-width:520px;color:#dbe7ff;}'
    + '.aro-hero .mark{display:flex;align-items:center;gap:14px;margin-bottom:26px;}'
    + '.aro-hero .mark .ring{width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#ff7538,#2a52be);display:flex;align-items:center;justify-content:center;box-shadow:0 8px 32px rgba(255,117,56,.35);font-size:26px;}'
    + '.aro-hero h1{font-size:34px;font-weight:700;margin:0;letter-spacing:.02em;color:#fff;line-height:1.15;}'
    + '.aro-hero h1 .grad{background:linear-gradient(90deg,#ff9d66,#7ea2ff 70%);-webkit-background-clip:text;background-clip:text;color:transparent;}'
    + '.aro-hero .sub{margin:16px 0 30px;font-size:15.5px;line-height:1.65;color:#8fa6d4;max-width:440px;}'
    + '.aro-feats{display:grid;grid-template-columns:1fr 1fr;gap:12px;max-width:460px;}'
    + '.aro-feat{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border:1px solid rgba(126,162,255,.14);border-radius:12px;background:rgba(13,22,47,.5);backdrop-filter:blur(6px);}'
    + '.aro-feat .ic{font-size:18px;line-height:1;}'
    + '.aro-feat b{display:block;font-size:12.5px;color:#e6eeff;font-weight:600;margin-bottom:2px;}'
    + '.aro-feat span{font-size:11px;color:#7f96c2;line-height:1.45;}'
    + '.aro-card{flex:0 1 420px;width:100%;max-width:430px;background:linear-gradient(160deg,rgba(16,26,54,.92),rgba(9,15,33,.96));border:1px solid rgba(126,162,255,.18);border-radius:20px;padding:30px 30px 24px;box-shadow:0 30px 80px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.05);position:relative;overflow:hidden;}'
    + '.aro-card::before{content:"";position:absolute;top:0;left:10%;right:10%;height:1px;background:linear-gradient(90deg,transparent,#ff7538,#2a52be,transparent);}'
    + '.aro-card h2{margin:0 0 4px;font-size:20px;color:#fff;font-weight:600;}'
    + '.aro-card .hint{font-size:12.5px;color:#7f96c2;margin:0 0 22px;line-height:1.5;}'
    + '.aro-field{margin-bottom:14px;}'
    + '.aro-field label{display:block;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#8fa6d4;margin-bottom:6px;font-weight:600;}'
    + '.aro-field input,.aro-field select{width:100%;padding:11px 13px;background:rgba(4,9,22,.85);border:1px solid rgba(126,162,255,.2);border-radius:10px;color:#e6eeff;font-size:14px;font-family:inherit;outline:none;transition:border .15s, box-shadow .15s;}'
    + '.aro-field input:focus,.aro-field select:focus{border-color:#ff7538;box-shadow:0 0 0 3px rgba(255,117,56,.15);}'
    + '.aro-phone-row{display:flex;gap:8px;}'
    + '.aro-phone-row select{width:112px;flex:none;}'
    + '.aro-choose{display:flex;gap:10px;margin:6px 0 18px;}'
    + '.aro-choice{flex:1;padding:12px 10px;border-radius:12px;border:1px solid rgba(126,162,255,.2);background:rgba(4,9,22,.6);cursor:pointer;text-align:center;transition:all .15s;}'
    + '.aro-choice .ci{font-size:20px;display:block;margin-bottom:4px;}'
    + '.aro-choice b{display:block;font-size:12.5px;color:#dbe7ff;font-weight:600;}'
    + '.aro-choice span{font-size:10.5px;color:#7f96c2;}'
    + '.aro-choice.sel{border-color:#ff7538;background:rgba(255,117,56,.1);box-shadow:0 0 0 3px rgba(255,117,56,.12);}'
    + '.aro-btn{width:100%;padding:13px;border:none;border-radius:12px;background:linear-gradient(90deg,#ff7538,#e85d2a);color:#fff;font-size:14.5px;font-weight:700;font-family:inherit;letter-spacing:.03em;cursor:pointer;transition:transform .12s, box-shadow .12s;box-shadow:0 10px 28px rgba(255,117,56,.3);}'
    + '.aro-btn:hover{transform:translateY(-1px);box-shadow:0 14px 34px rgba(255,117,56,.4);}'
    + '.aro-btn:disabled{opacity:.55;cursor:wait;transform:none;}'
    + '.aro-btn.ghost{background:transparent;border:1px solid rgba(126,162,255,.3);box-shadow:none;color:#9fb4de;font-weight:600;}'
    + '.aro-alt{margin-top:16px;text-align:center;font-size:12px;color:#7f96c2;}'
    + '.aro-alt a{color:#7ea2ff;cursor:pointer;text-decoration:none;border-bottom:1px dotted rgba(126,162,255,.5);}'
    + '.aro-err{display:none;margin:0 0 14px;padding:10px 12px;border-radius:10px;background:rgba(239,68,68,.12);border:1px solid rgba(239,68,68,.35);color:#fca5a5;font-size:12.5px;line-height:1.5;}'
    + '.aro-info{display:none;margin:0 0 14px;padding:10px 12px;border-radius:10px;background:rgba(0,184,117,.1);border:1px solid rgba(0,184,117,.3);color:#6ee7b7;font-size:12.5px;line-height:1.5;}'
    + '.aro-otp-row{display:flex;gap:9px;justify-content:center;margin:20px 0 22px;}'
    + '.aro-otp-row input{width:46px;height:54px;text-align:center;font-size:22px;font-weight:700;background:rgba(4,9,22,.85);border:1px solid rgba(126,162,255,.25);border-radius:12px;color:#fff;outline:none;font-family:"IBM Plex Mono",monospace;transition:border .15s;}'
    + '.aro-otp-row input:focus{border-color:#ff7538;box-shadow:0 0 0 3px rgba(255,117,56,.15);}'
    + '.aro-back{position:absolute;top:20px;left:22px;background:none;border:none;color:#7f96c2;font-size:13px;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:4px;}'
    + '.aro-back:hover{color:#dbe7ff;}'
    + '.aro-success{ text-align:center;padding:30px 0 14px;}'
    + '.aro-check{width:84px;height:84px;margin:0 auto 20px;border-radius:50%;background:rgba(0,184,117,.12);border:2px solid #00b875;display:flex;align-items:center;justify-content:center;animation:aroPop .5s cubic-bezier(.2,1.6,.4,1);}'
    + '.aro-check svg{width:40px;height:40px;stroke:#00b875;stroke-width:3;fill:none;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:48;stroke-dashoffset:48;animation:aroDraw .6s .25s ease forwards;}'
    + '@keyframes aroPop{from{transform:scale(.4);opacity:0;}to{transform:scale(1);opacity:1;}}'
    + '@keyframes aroDraw{to{stroke-dashoffset:0;}}'
    + '.aro-demo-wrap{display:none;margin-top:14px;}'
    + '.aro-badge-secure{display:flex;align-items:center;justify-content:center;gap:6px;margin-top:18px;font-size:10.5px;color:#5770a3;letter-spacing:.05em;}'
    + '.aro-user-chip{display:flex;align-items:center;gap:8px;padding:3px 10px 3px 4px;border:1px solid rgba(126,162,255,.25);border-radius:999px;background:rgba(13,22,47,.6);}'
    + '.aro-user-chip .av{width:22px;height:22px;border-radius:50%;background:linear-gradient(135deg,#ff7538,#2a52be);color:#fff;font-size:10px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:"Outfit",sans-serif;}'
    + '.aro-user-chip .nm{font-size:11px;color:#dbe7ff;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:"Outfit",sans-serif;}'
    + '.aro-user-chip button{background:none;border:none;color:#7f96c2;cursor:pointer;font-size:12px;padding:2px;line-height:1;}'
    + '.aro-user-chip button:hover{color:#ff7538;}'
    + '@media (max-width:900px){.aro-hero{display:none;}.aro-gate-inner{padding:24px 16px;}}';

  function injectCSS() {
    var st = document.createElement('style');
    st.id = 'aro-gate-css';
    st.textContent = css;
    document.head.appendChild(st);
  }

  /* ── Gate markup ─────────────────────────────────────────────────── */
  function gateHTML() {
    return ''
    + '<div class="aro-gate-bg">'
    + '  <div class="grid"></div>'
    + '  <div class="aro-orb" style="width:420px;height:420px;background:#2a52be;top:-120px;left:-120px;"></div>'
    + '  <div class="aro-orb" style="width:360px;height:360px;background:#ff7538;bottom:-140px;right:-90px;animation-delay:-6s;"></div>'
    + '</div>'
    + '<div class="aro-gate-inner">'
    + '  <div class="aro-hero">'
    + '    <div class="mark"><div class="ring">⚙️</div><div style="font-size:12px;letter-spacing:.28em;color:#8fa6d4;font-weight:600;">AROGARA&nbsp;TECHNOLOGIES</div></div>'
    + '    <h1>BHARAT FLOWSIZE<br><span class="grad">Process Engineering, Reimagined.</span></h1>'
    + '    <p class="sub">A next-generation digital sizing suite for pumps, pipelines and heat exchangers — with live 3D plant visualisation and an AI engineering copilot built in.</p>'
    + '    <div class="aro-feats">'
    + '      <div class="aro-feat"><span class="ic">🌀</span><div><b>Pump Hydraulics</b><span>NPSH, TDH, motor sizing to API 610</span></div></div>'
    + '      <div class="aro-feat"><span class="ic">📏</span><div><b>Line Sizing</b><span>Liquid · Gas · Steam · Slurry · Two-phase</span></div></div>'
    + '      <div class="aro-feat"><span class="ic">🔥</span><div><b>Heat Exchangers</b><span>DPHE &amp; STHE with industrial 3D views</span></div></div>'
    + '      <div class="aro-feat"><span class="ic">🤖</span><div><b>ARO AI Copilot</b><span>Ask anything about your design</span></div></div>'
    + '    </div>'
    + '  </div>'
    + '  <div class="aro-card" id="aro-card"></div>'
    + '</div>'
    + '<div id="aro-recaptcha"></div>';
  }

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

  /* ── Card steps ──────────────────────────────────────────────────── */
  function renderProfile(card) {
    card.innerHTML = ''
      + '<h2>Create your engineer profile</h2>'
      + '<p class="hint">Verify once with your email <b>or</b> mobile number — your choice — and get full access to every tool in the suite.</p>'
      + '<div class="aro-err" id="aro-err"></div>'
      + '<div class="aro-field"><label>Full name</label><input id="aro-name" type="text" placeholder="e.g. A. Sharma" autocomplete="name" value="' + esc(state.name) + '"></div>'
      + '<div class="aro-field"><label>Work email</label><input id="aro-email" type="email" placeholder="you@company.com" autocomplete="email" value="' + esc(state.email) + '"></div>'
      + '<div class="aro-field"><label>Mobile number</label><div class="aro-phone-row">'
      + '  <select id="aro-ccode">'
      +      ['+91|🇮🇳 +91', '+1|🇺🇸 +1', '+44|🇬🇧 +44', '+971|🇦🇪 +971', '+966|🇸🇦 +966', '+65|🇸🇬 +65', '+61|🇦🇺 +61', '+49|🇩🇪 +49', '+81|🇯🇵 +81'].map(function (o) {
               var p = o.split('|');
               return '<option value="' + p[0] + '"' + (p[0] === state.ccode ? ' selected' : '') + '>' + p[1] + '</option>';
             }).join('')
      + '  </select>'
      + '  <input id="aro-phone" type="tel" placeholder="98765 43210" autocomplete="tel" value="' + esc(state.phone) + '">'
      + '</div></div>'
      + '<div class="aro-field"><label>Verify via</label><div class="aro-choose">'
      + '  <div class="aro-choice' + (state.method === 'email' ? ' sel' : '') + '" data-m="email"><span class="ci">📧</span><b>' + (emailOtpReady() ? 'Email OTP' : 'Email link') + '</b><span>' + (emailOtpReady() ? '6-digit code to inbox' : 'Secure sign-in link') + '</span></div>'
      + '  <div class="aro-choice' + (state.method === 'sms' ? ' sel' : '') + '" data-m="sms"><span class="ci">📱</span><b>SMS OTP</b><span>6-digit code</span></div>'
      + '</div></div>'
      + '<button class="aro-btn" id="aro-continue">CONTINUE&nbsp;&nbsp;→</button>'
      + '<div class="aro-alt">Working on the project? <a id="aro-demo-link">Developer access</a></div>'
      + '<div class="aro-demo-wrap" id="aro-demo-wrap">'
      + '  <div class="aro-field"><label>Developer access code</label><input id="aro-demo-code" type="password" placeholder="Enter access code"></div>'
      + '  <button class="aro-btn ghost" id="aro-demo-btn">ENTER DEMO MODE</button>'
      + '</div>'
      + '<div class="aro-badge-secure">🔒 VERIFIED ACCESS · YOUR DETAILS STAY WITH AROGARA</div>';

    card.querySelectorAll('.aro-choice').forEach(function (el) {
      el.addEventListener('click', function () {
        state.method = el.getAttribute('data-m');
        card.querySelectorAll('.aro-choice').forEach(function (e2) { e2.classList.remove('sel'); });
        el.classList.add('sel');
      });
    });
    card.querySelector('#aro-demo-link').addEventListener('click', function () {
      var w = card.querySelector('#aro-demo-wrap');
      w.style.display = w.style.display === 'block' ? 'none' : 'block';
    });
    card.querySelector('#aro-demo-btn').addEventListener('click', function () {
      var code = (card.querySelector('#aro-demo-code').value || '').trim();
      if (code !== DEMO_CODE) { showErr('Invalid developer access code.'); return; }
      grabProfile();
      finish({ demo: true });
    });
    card.querySelector('#aro-continue').addEventListener('click', onContinue);
    card.querySelectorAll('input').forEach(function (inp) {
      inp.addEventListener('keypress', function (e) { if (e.key === 'Enter') onContinue(); });
    });
  }

  function showErr(msg) {
    var el = document.getElementById('aro-err');
    if (el) { el.innerHTML = msg; el.style.display = 'block'; }
  }
  function showInfo(msg) {
    var el = document.getElementById('aro-info');
    if (el) { el.innerHTML = msg; el.style.display = 'block'; }
  }

  function grabProfile() {
    var g = function (id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; };
    state.name = g('aro-name') || state.name;
    state.email = g('aro-email') || state.email;
    state.phone = (g('aro-phone') || state.phone).replace(/[^\d]/g, '');
    var cc = document.getElementById('aro-ccode');
    if (cc) state.ccode = cc.value;
  }

  function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e); }

  function onContinue() {
    grabProfile();
    if (state.name.length < 2) { showErr('Please enter your full name.'); return; }
    if (!validEmail(state.email)) { showErr('Please enter a valid email address.'); return; }
    if (state.phone.length < 6 || state.phone.length > 14) { showErr('Please enter a valid mobile number.'); return; }
    var btn = document.getElementById('aro-continue');
    btn.disabled = true; btn.textContent = state.method === 'email' && emailOtpReady() ? 'SENDING CODE…' : 'CONNECTING…';

    var fail = function (err) {
      btn.disabled = false; btn.innerHTML = 'CONTINUE&nbsp;&nbsp;→';
      showErr(friendlyAuthError(err));
    };
    if (state.method === 'email' && emailOtpReady()) {
      startEmailOTP().catch(fail);          // direct email OTP — no Firebase needed
    } else {
      loadFirebase().then(function (fb) {
        if (state.method === 'sms') return startSMS(fb);
        return startEmail(fb);
      }).catch(fail);
    }
  }

  /* ── Email OTP via EmailJS (real-time 6-digit code, free tier) ──── */
  function startEmailOTP() {
    var code = String(Math.floor(100000 + Math.random() * 900000));
    var payload = {
      service_id: EMAILJS.serviceId,
      template_id: EMAILJS.templateId,
      user_id: EMAILJS.publicKey,
      template_params: {
        to_email: state.email,
        to_name: state.name || 'Engineer',
        otp_code: code,
        valid_minutes: '10'
      }
    };
    return fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).then(function (r) {
      if (!r.ok) return r.text().then(function (t) { throw new Error('email-send-failed: ' + t.slice(0, 120)); });
      state.emailOtp = { code: code, exp: Date.now() + 10 * 60 * 1000, tries: 0 };
      renderOTPScreen({
        dest: state.email,
        channelLabel: 'an email',
        onResend: function () { return startEmailOTP(); },
        onVerify: function (entered) {
          var o = state.emailOtp;
          if (!o) return Promise.reject(new Error('no-otp'));
          if (Date.now() > o.exp) { var e1 = new Error('expired'); e1.code = 'auth/code-expired'; return Promise.reject(e1); }
          o.tries++;
          if (o.tries > 5) { var e2 = new Error('too many'); e2.code = 'auth/too-many-requests'; return Promise.reject(e2); }
          if (entered !== o.code) { var e3 = new Error('wrong'); e3.code = 'auth/invalid-verification-code'; return Promise.reject(e3); }
          return Promise.resolve();
        },
        channel: 'email-otp'
      });
    });
  }

  function friendlyAuthError(err) {
    var code = err && err.code ? err.code : '';
    if (err && String(err.message || '').indexOf('email-send-failed') === 0) {
      return 'Could not send the email code right now. Check the address and try again in a minute, or use SMS / <b>Developer access</b>.';
    }
    if (state.firebaseStatus === 'unavailable' && !(state.method === 'email' && emailOtpReady())) {
      return 'Verification service is not reachable from this environment. Use <b>Developer access</b> below, or try again on the live site.';
    }
    var map = {
      'auth/operation-not-allowed': 'This verification channel is not enabled yet on the server. Try the other channel, or use <b>Developer access</b>.',
      'auth/invalid-phone-number': 'That mobile number was rejected — check the country code and digits.',
      'auth/too-many-requests': 'Too many attempts from this device. Please wait a few minutes and try again.',
      'auth/invalid-verification-code': 'That code is incorrect. Double-check the 6 digits and try again.',
      'auth/code-expired': 'This code has expired. Tap “Resend code” to get a new one.',
      'auth/quota-exceeded': 'The SMS quota is exhausted for today. Use <b>Email OTP</b> instead — it\'s free and instant.',
      'auth/billing-not-enabled': 'Real SMS needs the Firebase Blaze plan. Use <b>Email OTP</b> instead — it\'s free and instant.',
      'auth/network-request-failed': 'Network problem while contacting the verification service. Check your connection and retry.'
    };
    return map[code] || ('Verification failed' + (code ? ' (' + code + ')' : '') + '. Try the other channel or use <b>Developer access</b>.');
  }

  /* ── SMS OTP flow ────────────────────────────────────────────────── */
  function startSMS(fb) {
    if (!window.__aroRecaptcha) {
      window.__aroRecaptcha = new fb.auth.RecaptchaVerifier('aro-recaptcha', { size: 'invisible' });
    }
    var full = state.ccode + state.phone;
    return fb.auth().signInWithPhoneNumber(full, window.__aroRecaptcha).then(function (conf) {
      state.confirmation = conf;
      renderOTPScreen({
        dest: state.ccode + ' ' + state.phone,
        channelLabel: 'an SMS',
        onResend: function () { return loadFirebase().then(startSMS); },
        onVerify: function (entered) { return state.confirmation.confirm(entered); },
        channel: 'sms'
      });
    });
  }

  function renderOTPScreen(opts) {
    state.step = 'otp';
    var card = document.getElementById('aro-card');
    card.innerHTML = ''
      + '<button class="aro-back" id="aro-back">← Back</button>'
      + '<div style="height:14px;"></div>'
      + '<h2>Enter the 6-digit code</h2>'
      + '<p class="hint">We sent ' + opts.channelLabel + ' to <b style="color:#dbe7ff;">' + esc(opts.dest) + '</b>. Enter the code below to verify. It expires in 10 minutes.</p>'
      + '<div class="aro-err" id="aro-err"></div>'
      + '<div class="aro-otp-row" id="aro-otp">' + '<input maxlength="1" inputmode="numeric">'.repeat(6) + '</div>'
      + '<button class="aro-btn" id="aro-verify">VERIFY &amp; ENTER</button>'
      + '<div class="aro-alt"><a id="aro-resend">Resend code</a> <span id="aro-resend-t"></span></div>';

    var boxes = Array.prototype.slice.call(card.querySelectorAll('#aro-otp input'));
    boxes.forEach(function (b, i) {
      b.addEventListener('input', function () {
        b.value = b.value.replace(/\D/g, '').slice(0, 1);
        if (b.value && i < 5) boxes[i + 1].focus();
      });
      b.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !b.value && i > 0) boxes[i - 1].focus();
      });
      b.addEventListener('paste', function (e) {
        var txt = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '');
        if (txt.length >= 2) {
          e.preventDefault();
          for (var k = 0; k < 6 && k < txt.length; k++) boxes[k].value = txt[k];
          boxes[Math.min(txt.length, 5)].focus();
        }
      });
    });
    boxes[0].focus();

    var t = 30;
    var timerEl = card.querySelector('#aro-resend-t');
    if (state.resendTimer) clearInterval(state.resendTimer);
    state.resendTimer = setInterval(function () {
      t--; timerEl.textContent = t > 0 ? '(' + t + 's)' : '';
      if (t <= 0) clearInterval(state.resendTimer);
    }, 1000);

    card.querySelector('#aro-back').addEventListener('click', function () { renderProfile(card); });
    card.querySelector('#aro-resend').addEventListener('click', function () {
      if (t > 0) return;
      opts.onResend().catch(function (err) { showErr(friendlyAuthError(err)); });
    });
    card.querySelector('#aro-verify').addEventListener('click', function () {
      var code = boxes.map(function (b) { return b.value; }).join('');
      if (code.length !== 6) { showErr('Enter all 6 digits of the code.'); return; }
      var btn = card.querySelector('#aro-verify');
      btn.disabled = true; btn.textContent = 'VERIFYING…';
      opts.onVerify(code).then(function () {
        finish({ demo: false, channel: opts.channel });
      }).catch(function (err) {
        btn.disabled = false; btn.innerHTML = 'VERIFY &amp; ENTER';
        showErr(friendlyAuthError(err));
      });
    });
  }

  /* ── Email link flow ─────────────────────────────────────────────── */
  function startEmail(fb) {
    var settings = {
      url: window.location.origin + window.location.pathname,
      handleCodeInApp: true
    };
    return fb.auth().sendSignInLinkToEmail(state.email, settings).then(function () {
      try {
        localStorage.setItem(PENDING_EMAIL_KEY, state.email);
        localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify({ name: state.name, email: state.email, phone: state.ccode + state.phone }));
      } catch (e) {}
      renderEmailSent(document.getElementById('aro-card'));
    });
  }

  function renderEmailSent(card) {
    state.step = 'emailsent';
    card.innerHTML = ''
      + '<button class="aro-back" id="aro-back">← Back</button>'
      + '<div style="height:14px;"></div>'
      + '<h2>Check your inbox 📬</h2>'
      + '<p class="hint">We sent a secure sign-in link to <b style="color:#dbe7ff;">' + esc(state.email) + '</b>.<br><br>Open the email <b>on this device</b> and click the link — you\'ll land back here fully verified. (Check spam if you don\'t see it within a minute.)</p>'
      + '<div class="aro-info" id="aro-info" style="display:block;">Waiting for you to click the link… this page will verify automatically when you return.</div>'
      + '<div class="aro-err" id="aro-err"></div>'
      + '<button class="aro-btn ghost" id="aro-resend-mail">RESEND LINK</button>'
      + '<div class="aro-alt">Prefer a code instead? <a id="aro-switch-sms">Verify via SMS OTP</a></div>';
    card.querySelector('#aro-back').addEventListener('click', function () { renderProfile(card); });
    card.querySelector('#aro-resend-mail').addEventListener('click', function () {
      loadFirebase().then(startEmail).catch(function (err) { showErr(friendlyAuthError(err)); });
    });
    card.querySelector('#aro-switch-sms').addEventListener('click', function () {
      state.method = 'sms';
      loadFirebase().then(startSMS).catch(function (err) { showErr(friendlyAuthError(err)); });
    });
  }

  function completeEmailLinkIfPresent() {
    var href = window.location.href;
    if (href.indexOf('mode=signIn') === -1 || href.indexOf('oobCode=') === -1) return false;
    injectCSS();
    mountGate();
    var card = document.getElementById('aro-card');
    card.innerHTML = '<h2>Verifying your email…</h2><p class="hint">One moment while we confirm your sign-in link.</p><div class="aro-err" id="aro-err"></div>';
    loadFirebase().then(function (fb) {
      if (!fb.auth().isSignInWithEmailLink(href)) throw new Error('not a sign-in link');
      var email = null;
      try { email = localStorage.getItem(PENDING_EMAIL_KEY); } catch (e) {}
      if (!email) email = window.prompt('Please confirm the email address you used to sign in:');
      return fb.auth().signInWithEmailLink(email, href);
    }).then(function () {
      var prof = {};
      try { prof = JSON.parse(localStorage.getItem(PENDING_PROFILE_KEY) || '{}'); } catch (e) {}
      state.name = prof.name || state.name || 'Engineer';
      state.email = prof.email || state.email;
      if (prof.phone) { state.phone = prof.phone.replace(/^\+\d+/, ''); }
      try { history.replaceState(null, '', window.location.pathname); } catch (e) {}
      finish({ demo: false, channel: 'email' });
    }).catch(function (err) {
      showErr(friendlyAuthError(err) + '<br><br>You can restart the sign-up below.');
      setTimeout(function () { renderProfile(card); }, 3500);
    });
    return true;
  }

  /* ── Finish / success ────────────────────────────────────────────── */
  function finish(opts) {
    var session = {
      name: state.name || 'Developer',
      email: state.email || '',
      phone: state.phone ? (state.ccode + state.phone) : '',
      demo: !!opts.demo,
      channel: opts.channel || (opts.demo ? 'demo' : ''),
      verifiedAt: new Date().toISOString()
    };
    setSession(session);
    try { localStorage.removeItem(PENDING_EMAIL_KEY); localStorage.removeItem(PENDING_PROFILE_KEY); } catch (e) {}
    var card = document.getElementById('aro-card');
    if (card) {
      card.innerHTML = ''
        + '<div class="aro-success">'
        + '<div class="aro-check"><svg viewBox="0 0 24 24"><polyline points="4 12.5 10 18.5 20 6.5"/></svg></div>'
        + '<h2>Welcome, ' + esc(session.name.split(' ')[0]) + '!</h2>'
        + '<p class="hint" style="margin-top:6px;">' + (session.demo ? 'Developer demo session active.' : 'Your identity is verified.') + ' Loading the suite…</p>'
        + '</div>';
    }
    setTimeout(function () {
      var gate = document.getElementById('aro-gate');
      if (gate) { gate.style.transition = 'opacity .45s'; gate.style.opacity = '0'; }
      setTimeout(function () { if (gate) gate.remove(); mountUserChip(); }, 460);
    }, 1300);
  }

  /* ── Header user chip ────────────────────────────────────────────── */
  function mountUserChip() {
    var s = getSession();
    if (!s) return;
    var host = document.querySelector('.header-status');
    if (!host || document.getElementById('aro-user-chip')) return;
    var initials = (s.name || 'U').split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
    var chip = document.createElement('div');
    chip.className = 'aro-user-chip';
    chip.id = 'aro-user-chip';
    chip.innerHTML = '<span class="av">' + esc(initials) + '</span><span class="nm" title="' + esc(s.email || s.phone || '') + '">' + esc(s.name) + (s.demo ? ' · DEV' : '') + '</span><button title="Sign out">⏻</button>';
    chip.querySelector('button').addEventListener('click', function () {
      if (!window.confirm('Sign out of BHARAT FLOWSIZE?')) return;
      clearSession();
      try { if (window.firebase && firebase.apps && firebase.apps.length) firebase.auth().signOut(); } catch (e) {}
      window.location.reload();
    });
    host.insertBefore(chip, host.firstChild);
  }

  /* ── Mount ───────────────────────────────────────────────────────── */
  function mountGate() {
    if (document.getElementById('aro-gate')) return;
    var gate = document.createElement('div');
    gate.id = 'aro-gate';
    gate.innerHTML = gateHTML();
    document.body.appendChild(gate);
    renderProfile(document.getElementById('aro-card'));
  }

  function init() {
    if (completeEmailLinkIfPresent()) return;
    if (getSession()) { mountUserChip(); return; }
    injectCSS();
    mountGate();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
