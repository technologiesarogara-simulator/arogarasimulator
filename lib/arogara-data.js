/* ══════════════════════════════════════════════════════════════════════
   AROGARA — CLOUD DATA LAYER  (window.ARODATA)
   Firestore-backed storage for:
     • users/{uid}            → engineer profile (name, email, phone, org)
     • projects/{projectId}   → saved work (workbench, pump, line, sthe,
                                dphe, phe) as { module, name, payload }
   Every write is scoped to the signed-in Firebase user (ownerUid), and
   firestore.rules enforces that server-side.

   Degrades gracefully: if Firestore or the network is unavailable, reads
   and writes fall back to localStorage so the app keeps working offline.
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var SDK = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore-compat.js';
  var LS_PREFIX = 'aro_cloud_';
  var dbPromise = null;

  function loadScript(src) {
    return new Promise(function (res, rej) {
      if ([].slice.call(document.scripts).some(function (s) { return s.src === src; })) return res();
      var s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = function () { rej(new Error('failed: ' + src)); };
      document.head.appendChild(s);
    });
  }

  /* Firestore handle — assumes arogara-auth.js has already initialised the
     Firebase app (it loads /__/firebase/init.js). */
  function db() {
    if (dbPromise) return dbPromise;
    dbPromise = loadScript(SDK).then(function () {
      if (!window.firebase || !firebase.apps || !firebase.apps.length) throw new Error('firebase app not initialised');
      var d = firebase.firestore();
      // Offline cache — designs stay available on a plant floor with no signal.
      try { d.enablePersistence({ synchronizeTabs: true }).catch(function () {}); } catch (e) {}
      return d;
    }).catch(function (err) { dbPromise = null; throw err; });
    return dbPromise;
  }

  function uid() {
    try {
      var u = window.firebase && firebase.apps && firebase.apps.length && firebase.auth().currentUser;
      return u ? u.uid : null;
    } catch (e) { return null; }
  }
  function ts() { return new Date().toISOString(); }

  /* ── local fallback ─────────────────────────────────────────────── */
  function lsGet(k, d) { try { return JSON.parse(localStorage.getItem(LS_PREFIX + k) || 'null') || d; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(LS_PREFIX + k, JSON.stringify(v)); } catch (e) {} }

  /* ── Profile ────────────────────────────────────────────────────── */
  function saveProfile(profile) {
    var p = Object.assign({}, profile, { updatedAt: ts() });
    lsSet('profile', p);                                  // always keep a local copy
    var id = uid();
    if (!id) return Promise.resolve(p);                   // demo / offline session
    return db().then(function (d) {
      return d.collection('users').doc(id).set(
        Object.assign({ uid: id, createdAt: p.createdAt || ts() }, p), { merge: true }
      );
    }).then(function () { return p; })
      .catch(function (err) { console.warn('[ARODATA] profile save fell back to local:', err && err.message); return p; });
  }

  function getProfile() {
    var id = uid();
    if (!id) return Promise.resolve(lsGet('profile', null));
    return db().then(function (d) { return d.collection('users').doc(id).get(); })
      .then(function (snap) {
        var v = snap.exists ? snap.data() : null;
        if (v) lsSet('profile', v);
        return v || lsGet('profile', null);
      })
      .catch(function () { return lsGet('profile', null); });
  }

  /* ── Projects / saved work ──────────────────────────────────────── */
  // module: 'workbench' | 'pump' | 'line' | 'sthe' | 'dphe' | 'phe'
  function saveProject(module, name, payload, projectId) {
    var id = uid();
    var rec = {
      module: module || 'workbench',
      name: name || 'Untitled',
      payload: payload || {},
      updatedAt: ts()
    };
    if (!id) {                                            // offline / demo → local only
      var list = lsGet('projects', []);
      rec.id = projectId || ('local-' + Date.now());
      rec.createdAt = rec.createdAt || ts();
      var i = list.findIndex(function (r) { return r.id === rec.id; });
      if (i >= 0) list[i] = rec; else list.unshift(rec);
      lsSet('projects', list);
      return Promise.resolve(rec);
    }
    return db().then(function (d) {
      var col = d.collection('projects');
      var doc = projectId ? col.doc(projectId) : col.doc();
      return doc.set(Object.assign({ ownerUid: id, createdAt: ts() }, rec), { merge: true })
        .then(function () { rec.id = doc.id; return rec; });
    });
  }

  function listProjects(module) {
    var id = uid();
    if (!id) {
      var list = lsGet('projects', []);
      return Promise.resolve(module ? list.filter(function (r) { return r.module === module; }) : list);
    }
    return db().then(function (d) {
      var q = d.collection('projects').where('ownerUid', '==', id);
      if (module) q = q.where('module', '==', module);
      return q.get();
    }).then(function (snap) {
      var out = [];
      snap.forEach(function (doc) { out.push(Object.assign({ id: doc.id }, doc.data())); });
      out.sort(function (a, b) { return String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')); });
      return out;
    }).catch(function (err) {
      console.warn('[ARODATA] listProjects fell back to local:', err && err.message);
      var l = lsGet('projects', []);
      return module ? l.filter(function (r) { return r.module === module; }) : l;
    });
  }

  function loadProject(projectId) {
    var id = uid();
    if (!id) {
      return Promise.resolve(lsGet('projects', []).filter(function (r) { return r.id === projectId; })[0] || null);
    }
    return db().then(function (d) { return d.collection('projects').doc(projectId).get(); })
      .then(function (s) { return s.exists ? Object.assign({ id: s.id }, s.data()) : null; })
      .catch(function () { return null; });
  }

  function deleteProject(projectId) {
    var id = uid();
    if (!id) {
      lsSet('projects', lsGet('projects', []).filter(function (r) { return r.id !== projectId; }));
      return Promise.resolve(true);
    }
    return db().then(function (d) { return d.collection('projects').doc(projectId).delete(); })
      .then(function () { return true; }).catch(function () { return false; });
  }

  window.ARODATA = {
    ready: function () { return db(); },
    uid: uid,
    saveProfile: saveProfile,
    getProfile: getProfile,
    saveProject: saveProject,
    listProjects: listProjects,
    loadProject: loadProject,
    deleteProject: deleteProject
  };
})();
