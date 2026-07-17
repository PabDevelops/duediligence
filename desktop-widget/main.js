const { app, BrowserWindow, ipcMain, screen, Menu, Tray } = require('electron');
const path = require('path');
const fs = require('fs');

// Config por defecto para que el instalador funcione sin pasos manuales.
// Se puede sobrescribir editando el config.json que se crea en userData.
const DEFAULT_CONFIG = {
  apiUrl: 'https://traqcker.com/api/admin/user-stats',
  secret: '2303372cf64a084995ebde6ec21c7da1e5ec6c9b1ffe1cc7',
  pollIntervalSeconds: 30,
};

function loadConfig() {
  const devConfigPath = path.join(__dirname, 'config.json');
  const userConfigPath = path.join(app.getPath('userData'), 'config.json');

  if (!app.isPackaged && fs.existsSync(devConfigPath)) {
    return JSON.parse(fs.readFileSync(devConfigPath, 'utf-8'));
  }
  if (fs.existsSync(userConfigPath)) {
    return JSON.parse(fs.readFileSync(userConfigPath, 'utf-8'));
  }
  fs.mkdirSync(path.dirname(userConfigPath), { recursive: true });
  fs.writeFileSync(userConfigPath, JSON.stringify(DEFAULT_CONFIG, null, 2));
  return DEFAULT_CONFIG;
}

let win;
let tray;
let pollTimer;

async function fetchStats(config) {
  const res = await fetch(config.apiUrl, {
    headers: { 'x-widget-secret': config.secret },
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
  return body;
}

function startPolling(config) {
  const tick = async () => {
    try {
      const stats = await fetchStats(config);
      win?.webContents.send('stats-update', { ok: true, stats });
    } catch (err) {
      win?.webContents.send('stats-update', { ok: false, error: err.message });
    }
  };
  tick();
  pollTimer = setInterval(tick, Math.max(5, config.pollIntervalSeconds || 30) * 1000);
}

function createWindow(config) {
  const { width: sw } = screen.getPrimaryDisplay().workAreaSize;
  const width = 260;
  const height = 150;

  win = new BrowserWindow({
    width,
    height,
    x: sw - width - 20,
    y: 20,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('index.html');
  win.setAlwaysOnTop(true, 'screen-saver');

  startPolling(config);
}

function createTray() {
  tray = new Tray(path.join(__dirname, 'icon.png'));
  const menu = Menu.buildFromTemplate([
    { label: 'Mostrar/Ocultar', click: () => win?.isVisible() ? win.hide() : win?.show() },
    { label: 'Salir', click: () => app.quit() },
  ]);
  tray.setToolTip('Traqcker User Stats');
  tray.setContextMenu(menu);
}

ipcMain.handle('close-app', () => app.quit());
ipcMain.handle('hide-window', () => win?.hide());

app.whenReady().then(() => {
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    console.error(err.message);
    app.quit();
    return;
  }

  if (app.isPackaged) {
    app.setLoginItemSettings({ openAtLogin: true, path: process.execPath });
  }

  createWindow(config);
  if (fs.existsSync(path.join(__dirname, 'icon.png'))) createTray();
});

app.on('window-all-closed', () => {
  if (pollTimer) clearInterval(pollTimer);
  app.quit();
});
