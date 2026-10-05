const path = require('node:path');
const os = require('node:os');
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const si = require('systeminformation');

const readSafely = async (reader, fallback = null) => {
  try {
    const value = await reader();
    return value ?? fallback;
  } catch (error) {
    return fallback;
  }
};

const pick = (source, keys) => Object.fromEntries(
  keys.map((key) => [key, source?.[key] ?? null])
);

function buildSocDetails(cpu, hostCpu) {
  const fallbackModel = hostCpu?.model || 'Not reported';
  const vendor = cpu?.manufacturer || hostCpu?.vendor || 'Not reported';
  const family = cpu?.family || 'Not reported';
  const model = cpu?.model || cpu?.brand || fallbackModel || 'Not reported';
  const brand = cpu?.brand || model || 'Not reported';

  return {
    name: brand,
    manufacturer: vendor,
    processNode: cpu?.process ? String(cpu.process) : 'Not exposed by standard host APIs',
    family,
    model,
    stepping: cpu?.stepping || 'Not reported',
    socket: cpu?.socket || 'Not reported',
    summary: `${vendor} ${family} ${model}`.replace(/\s+/g, ' ').trim(),
  };
}

async function getHardwareSnapshot() {
  const [cpuLoad, memInfo, osInfo, biosInfo, baseboardInfo, systemInfo] = await Promise.all([
    readSafely(() => si.currentLoad(), { currentLoad: null }),
    readSafely(() => si.mem(), {}),
    readSafely(() => si.osInfo(), {}),
    readSafely(() => si.bios(), {}),
    readSafely(() => si.baseboard(), {}),
    readSafely(() => si.system(), {}),
  ]);

  const cpuRaw = await readSafely(() => si.cpu(), {});
  const cpus = os.cpus() || [];
  const hostCpu = cpus[0] || {};
  const cpuBrand = cpuRaw?.brand || hostCpu.model || 'Not reported';
  const cpu = {
    brand: cpuBrand,
    manufacturer: cpuRaw?.manufacturer || 'Not reported',
    family: cpuRaw?.family || 'Not reported',
    model: cpuRaw?.model || cpuBrand,
    cores: cpuRaw?.cores ?? (cpus.length || null),
    physicalCores: cpuRaw?.physicalCores ?? (cpus.length || null),
    performanceCores: cpuRaw?.performanceCores ?? null,
    efficiencyCores: cpuRaw?.efficiencyCores ?? null,
    speedMax: cpuRaw?.speedMax ?? null,
    cache: cpuRaw?.cache || {},
    process: cpuRaw?.process || null,
    stepping: cpuRaw?.stepping || 'Not reported',
    socket: cpuRaw?.socket || 'Not reported',
  };

  const soc = buildSocDetails(cpu, hostCpu);
  const cpuUsage = typeof cpuLoad?.currentLoad === 'number' ? cpuLoad.currentLoad : 0;
  const osName = osInfo?.distro || osInfo?.platform || os.type();
  const osVersion = osInfo?.release || os.release();

  return {
    runtime: 'desktop',
    capturedAt: Date.now(),
    platform: process.platform,
    operatingSystem: `${osName} ${osVersion}`.trim(),
    architecture: os.arch(),
    hostname: osInfo?.hostname || os.hostname(),
    soc,
    cpu: {
      logicalCores: cpu.cores || 0,
      physicalCores: cpu.physicalCores ?? null,
      performanceCores: cpu.performanceCores ?? null,
      efficiencyCores: cpu.efficiencyCores ?? null,
      architecture: `${cpu.family || hostCpu.model || 'Family n/a'} / ${cpu.model || hostCpu.model || 'Model n/a'}`,
      maxSpeedGhz: cpu.speedMax ?? null,
      current: [],
      averageSpeedGhz: typeof cpuUsage === 'number' ? Number((cpuUsage / 100).toFixed(2)) : null,
      caches: cpu.cache || {},
      temperatureC: null,
      perCoreTemperatureC: [],
    },
    graphics: [],
    memory: {
      totalBytes: memInfo.total ?? null,
      availableBytes: memInfo.available ?? null,
      modules: [],
    },
    system: {
      manufacturer: systemInfo?.manufacturer || 'Not reported',
      model: systemInfo?.model || 'Not reported',
      version: systemInfo?.version || 'Not reported',
      sku: systemInfo?.sku || null,
      virtual: Boolean(systemInfo?.virtual),
      virtualHost: null,
    },
    mainboard: {
      manufacturer: baseboardInfo?.manufacturer || 'Not reported',
      model: baseboardInfo?.model || 'Not reported',
      version: baseboardInfo?.version || 'Not reported',
      memMax: baseboardInfo?.memMax ?? null,
      memSlots: baseboardInfo?.memSlots ?? null,
    },
    bios: {
      vendor: biosInfo?.vendor || 'Not reported',
      version: biosInfo?.version || 'Not reported',
      releaseDate: biosInfo?.releaseDate || 'Not reported',
      revision: biosInfo?.revision || 'Not reported',
      language: 'Not reported',
    },
    display: [],
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