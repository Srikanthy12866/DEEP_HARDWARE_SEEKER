const path = require('node:path');
const os = require('node:os');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const systemInformation = require('systeminformation');

const readSafely = async (reader, fallback = null) => {
  try {
    return await reader();
  } catch (error) {
    return fallback;
  }
};

const pick = (source, keys) => Object.fromEntries(
  keys.map((key) => [key, source?.[key] ?? null])
);

async function getHardwareSnapshot() {
  const [cpu, currentSpeed, temperature, memory, memoryLayout, graphics, system, baseboard, bios, osInfo] = await Promise.all([
    readSafely(() => systemInformation.cpu(), {}),
    readSafely(() => systemInformation.cpuCurrentSpeed(), {}),
    readSafely(() => systemInformation.cpuTemperature(), {}),
    readSafely(() => systemInformation.mem(), {}),
    readSafely(() => systemInformation.memLayout(), []),
    readSafely(() => systemInformation.graphics(), { controllers: [], displays: [] }),
    readSafely(() => systemInformation.system(), {}),
    readSafely(() => systemInformation.baseboard(), {}),
    readSafely(() => systemInformation.bios(), {}),
    readSafely(() => systemInformation.osInfo(), {}),
  ]);

  return {
    runtime: 'desktop',
    capturedAt: Date.now(),
    platform: process.platform,
    operatingSystem: `${osInfo.distro || osInfo.platform || os.type()} ${osInfo.release || os.release()}`,
    architecture: os.arch(),
    hostname: os.hostname(),
    soc: {
      name: cpu.brand || 'Not reported by OS',
      manufacturer: cpu.manufacturer || 'Not reported',
      processNode: 'Not exposed by standard host APIs',
      family: cpu.family || 'Not reported',
      model: cpu.model || 'Not reported',
      stepping: cpu.stepping || 'Not reported',
      socket: cpu.socket || 'Not reported',
    },
    cpu: {
      logicalCores: cpu.cores ?? os.cpus().length,
      physicalCores: cpu.physicalCores ?? null,
      performanceCores: cpu.performanceCores ?? null,
      efficiencyCores: cpu.efficiencyCores ?? null,
      architecture: `${cpu.family || 'Family n/a'} / ${cpu.model || 'Model n/a'}`,
      maxSpeedGhz: cpu.speedMax ?? null,
      current: currentSpeed.cores || [],
      averageSpeedGhz: currentSpeed.avg ?? null,
      caches: cpu.cache || {},
      temperatureC: temperature.main ?? null,
      perCoreTemperatureC: temperature.cores || [],
    },
    graphics: (graphics.controllers || []).map((controller) => pick(controller, [
      'vendor', 'model', 'name', 'bus', 'vram', 'vramDynamic', 'driverVersion',
      'clockCore', 'clockMemory', 'utilizationGpu', 'temperatureGpu',
    ])),
    memory: {
      totalBytes: memory.total ?? null,
      availableBytes: memory.available ?? null,
      modules: (memoryLayout || []).map((module) => pick(module, [
        'size', 'type', 'clockSpeed', 'formFactor', 'manufacturer', 'partNum', 'ecc',
      ])),
    },
    system: pick(system, ['manufacturer', 'model', 'version', 'sku', 'virtual', 'virtualHost']),
    mainboard: pick(baseboard, ['manufacturer', 'model', 'version', 'memMax', 'memSlots']),
    bios: pick(bios, ['vendor', 'version', 'releaseDate', 'revision', 'language']),
    display: (graphics.displays || []).map((display) => pick(display, [
      'model', 'main', 'builtin', 'connection', 'resolutionX', 'resolutionY', 'currentRefreshRate', 'pixelDepth',
    ])),
  };
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 640,
    backgroundColor: '#f7f8f3',
    title: 'Fieldnote Systems | Device Report',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });

  if (app.isPackaged) {
    window.loadFile(path.join(__dirname, '..', 'build', 'index.html'));
  } else {
    window.loadURL(process.env.ELECTRON_START_URL || 'http://localhost:3000');
  }
}

ipcMain.handle('device:get-hardware-snapshot', getHardwareSnapshot);

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});