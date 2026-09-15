const { contextBridge } = require('electron');

// Minimal surface: index.html reads isDesktop to skip service-worker
// registration. Native file save/open lands here in v0.1.1.
contextBridge.exposeInMainWorld('AROGARA_DESKTOP', {
  isDesktop: true,
  version: (process.argv.find((a) => a.startsWith('--arogara-version=')) || '=0.1.0').split('=')[1],
  platform: process.platform
});
