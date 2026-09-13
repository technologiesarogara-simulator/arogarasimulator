/* ══════════════════════════════════════════════════════════════════════
   AROGARA DESKTOP — Electron main process

   Serves the existing AROGARA web build (dist/, produced unmodified by
   build_dist.py) through a privileged custom protocol (app://) instead of
   a bare file:// load, so the app's existing relative-path <script src>
   tags, its service worker, and any future same-origin fetch() all behave
   the way they already do in a real browser. No application code (app.js,
   lib/*.js) is touched by this file — this only changes HOW the same
   static files are served.

   Security posture (Electron best practice, Phase 11 of the desktop plan):
   contextIsolation + a sandboxed renderer with nodeIntegration disabled;
   the renderer gets no Node/Electron API access beyond whatever preload.js
   explicitly exposes via contextBridge (currently just a version/platform
   readout — see preload.js).
   ══════════════════════════════════════════════════════════════════════ */
'use strict';

const { app, BrowserWindow, protocol, session } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_SCHEME = 'app';
const APP_HOST = 'arogara';

// dist/ is produced by `python3 build_dist.py` and is the same static
// output the web build's Firebase Hosting pipeline deploys — packaged
// verbatim into the Electron app via electron-builder's "files" list.
const DIST_DIR = path.join(app.getAppPath(), 'dist');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
  '.txt': 'text/plain'
};

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      allowServiceWorkers: true,
      stream: true
    }
  }
]);

function serveFromDist(request) {
  const url = new URL(request.url);
  // app://arogara/lib/foo.js?v=113  ->  pathname "/lib/foo.js" (query dropped,
  // matching how the existing cache-busting <script src="...?v=N"> tags in
  // index.html are meant to be read: as the same file regardless of the
  // version query string).
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === '' || pathname === '/') pathname = '/index.html';

  const filePath = path.normalize(path.join(DIST_DIR, pathname));
  // Refuse to serve anything outside dist/ (defends against a crafted
  // "../../" path reaching outside the packaged app's static files).
  if (!filePath.startsWith(DIST_DIR)) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const mime = MIME_TYPES[ext] || 'application/octet-stream';
    return new Response(data, { headers: { 'content-type': mime } });
  } catch (e) {
    // Includes /__/firebase/init.js, which Firebase Hosting auto-generates
    // on the web but which has no equivalent here — arogara-auth.js /
    // arogara-data.js already treat a failed Firebase SDK load as
    // "degrade gracefully, demo mode still works" rather than crashing, so
    // a plain 404 is the correct, already-anticipated behavior, not a bug.
    return new Response('Not found', { status: 404 });
  }
}

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1024,
    minHeight: 700,
    title: 'AROGARA',
    backgroundColor: '#0b1220',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadURL(`${APP_SCHEME}://${APP_HOST}/index.html`);

  // Internal dev convenience only — `app.isPackaged` is false exactly
  // when running via `npm run electron:dev` (electron-builder always
  // produces a packaged app), so this never reaches an installed build.
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools();
  }

  // Never let the renderer navigate this window to an external site or
  // spawn a new window pointed at one (Phase 11: no arbitrary remote
  // content) — the app has no legitimate reason to leave app://arogara/.
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (!targetUrl.startsWith(`${APP_SCHEME}://${APP_HOST}/`)) event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(() => {
  protocol.handle(APP_SCHEME, serveFromDist);

  // Belt-and-braces alongside webPreferences.sandbox/nodeIntegration:
  // reject any permission request (camera, mic, notifications, etc.) the
  // renderer might ask for — this app has never asked for any, and the
  // default should be to refuse rather than silently allow.
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => callback(false));

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
