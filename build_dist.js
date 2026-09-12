/* Node equivalent of build_dist.py, doing the exact same copy — kept as a
   separate file (not a replacement) so the existing web deploy pipeline
   (.github/workflows/firebase-deploy.yml, which runs `python3
   build_dist.py`) is completely untouched. This one exists purely so the
   Electron dev/build npm scripts don't depend on a `python3` command
   being on PATH on a Windows development machine that already has Node
   installed for Electron itself. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST_DIR = path.join(ROOT, 'dist');

function rimraf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const item of fs.readdirSync(src)) {
      copyRecursive(path.join(src, item), path.join(dest, item));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

function build() {
  rimraf(DIST_DIR);
  fs.mkdirSync(DIST_DIR, { recursive: true });

  const filesToCopy = [
    'index.html', 'app.js', 'style.css', 'manifest.json', 'sw.js',
    'icon-192.png', 'icon-512.png', 'icon-512-maskable.png'
  ];
  for (const file of filesToCopy) {
    const src = path.join(ROOT, file);
    if (fs.existsSync(src)) fs.copyFileSync(src, path.join(DIST_DIR, file));
  }

  for (const srcDirName of ['lib', 'assets']) {
    const srcDir = path.join(ROOT, srcDirName);
    if (!fs.existsSync(srcDir)) continue;
    copyRecursive(srcDir, path.join(DIST_DIR, srcDirName));
  }

  console.log('Successfully built/updated deployment directory: ' + DIST_DIR);
}

build();
