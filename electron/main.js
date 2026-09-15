const { app, BrowserWindow, protocol, shell, net } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const SCHEME = 'app';
const HOST = 'arogara';
const DIST_ROOT = path.join(__dirname, '..', 'dist');

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.gz': 'application/gzip',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.txt': 'text/plain',
  '.pdf': 'application/pdf'
};

// Must run before app.whenReady(): a privileged scheme gives the renderer a
// real secure origin, so relative <script src> paths, fetch() and storage all
// behave as they do over http — unlike a bare file:// load.
protocol.registerSchemesAsPrivileged([{
  scheme: SCHEME,
  privileges: {
    standard: true,
    secure: true,
    supportFetchAPI: true,
    corsEnabled: true,
    stream: true
  }
}]);

function resolveWithinDist(pathname) {
  // The ~106 existing script tags carry a ?v=N cache-bust query; URL parsing
  // has already split it off by the time we see pathname.
  const decoded = decodeURIComponent(pathname);
  const relative = decoded === '/' || decoded === '' ? 'index.html' : decoded.replace(/^\/+/, '');
  const resolved = path.resolve(DIST_ROOT, relative);
  const root = path.resolve(DIST_ROOT);
  if (resolved !== root && !resolved.startsWith(root + path.sep)) return null;
  return resolved;
}

function registerAppProtocol() {
  protocol.handle(SCHEME, async (request) => {
    const url = new URL(request.url);
    const filePath = resolveWithinDist(url.pathname);
    if (!filePath) return new Response('Forbidden', { status: 403 });
    // net.fetch streams the body. Handing protocol.handle a Buffer instead
    // silently truncates anything past the first chunk — index.html lost every
    // library <script> past 256 KB with no error logged anywhere.
    const res = await net.fetch(pathToFileURL(filePath).toString());
    if (!res.ok) return new Response('Not Found', { status: 404 });
    const type = MIME[path.extname(filePath).toLowerCase()];
    if (!type) return res;
    return new Response(res.body, { status: 200, headers: { 'content-type': type } });
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    backgroundColor: '#0e1116',
    title: 'AROGARA',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      additionalArguments: ['--arogara-version=' + app.getVersion()]
    }
  });

  win.once('ready-to-show', () => win.show());

  // Keep the window pinned to the packaged app; anything external opens in the
  // user's real browser instead of navigating the app away.
  win.webContents.on('will-navigate', (event, targetUrl) => {
    if (new URL(targetUrl).protocol !== SCHEME + ':') {
      event.preventDefault();
      shell.openExternal(targetUrl);
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  win.loadURL(`${SCHEME}://${HOST}/index.html`);

  if (process.env.AROGARA_DEVTOOLS === '1') win.webContents.openDevTools({ mode: 'detach' });

  return win;
}

app.whenReady().then(() => {
  registerAppProtocol();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
