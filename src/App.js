import { useEffect, useState } from 'react';
import './App.css';

const formatBytes = (value) => {
  if (!Number.isFinite(value) || value <= 0) return 'Not reported';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const unitIndex = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** unitIndex).toFixed(unitIndex < 2 ? 0 : 1)} ${units[unitIndex]}`;
};

const readHardware = async () => {
  if (window.deviceHardware?.getSnapshot) {
    const snapshot = await window.deviceHardware.getSnapshot();
    return { ...snapshot, updatedAt: new Date(snapshot.capturedAt) };
  }

  const nav = window.navigator;
  const screenInfo = window.screen;
  const connection = nav.connection || nav.mozConnection || nav.webkitConnection;
  const userAgent = nav.userAgent || '';
  const browser = userAgent.includes('Edg/')
    ? 'Microsoft Edge'
    : userAgent.includes('Firefox/')
      ? 'Mozilla Firefox'
      : userAgent.includes('Chrome/')
        ? 'Google Chrome'
        : userAgent.includes('Safari/')
          ? 'Safari'
          : 'Unknown browser';

  let graphics = 'Not exposed by this browser';
  try {
    if (/jsdom/i.test(userAgent)) throw new Error('Graphics information is not available in the test environment');
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    const extension = context && context.getExtension('WEBGL_debug_renderer_info');
    if (extension) graphics = context.getParameter(extension.UNMASKED_RENDERER_WEBGL);
    else if (context) graphics = context.getParameter(context.RENDERER);
  } catch (error) {
    graphics = 'Unavailable';
  }

  let battery = 'Not supported';
  if (typeof nav.getBattery === 'function') {
    try {
      const batteryInfo = await nav.getBattery();
      battery = `${Math.round(batteryInfo.level * 100)}%${batteryInfo.charging ? ' · charging' : ''}`;
    } catch (error) {
      battery = 'Permission unavailable';
    }
  }

  let storage = 'Unavailable';
  if (nav.storage && nav.storage.estimate) {
    try {
      const estimate = await nav.storage.estimate();
      const available = estimate.quota ? `${(estimate.quota / 1024 ** 3).toFixed(1)} GB available to this site` : 'Estimate unavailable';
      const used = estimate.usage ? `${(estimate.usage / 1024 ** 2).toFixed(1)} MB used` : '0 MB used';
      storage = `${used} · ${available}`;
    } catch (error) {
      storage = 'Estimate unavailable';
    }
  }

  return {
    updatedAt: new Date(),
    browser,
    operatingSystem: nav.userAgentData?.platform || nav.platform || 'Not exposed',
    browserVersion: userAgent.match(/(?:Chrome|Firefox|Edg|Version)\/[^\s]+/)?.[0]?.split('/')[1] || 'Not exposed',
    cpuThreads: nav.hardwareConcurrency ? `${nav.hardwareConcurrency} logical processors` : 'Not exposed',
    memory: nav.deviceMemory ? `About ${nav.deviceMemory} GB` : 'Not exposed',
    graphics,
    screen: `${screenInfo.width} × ${screenInfo.height}`,
    availableScreen: `${screenInfo.availWidth} × ${screenInfo.availHeight}`,
    viewport: `${window.innerWidth} × ${window.innerHeight}`,
    pixelRatio: `${window.devicePixelRatio || 1}×`,
    colorDepth: `${screenInfo.colorDepth || 'Unknown'} bit`,
    orientation: screenInfo.orientation?.type?.replace('-', ' ') || 'Not exposed',
    networkStatus: nav.onLine ? 'Online' : 'Offline',
    networkType: connection?.effectiveType || 'Not reported',
    downlink: connection?.downlink ? `${connection.downlink} Mbps` : 'Not reported',
    latency: connection?.rtt ? `${connection.rtt} ms` : 'Not reported',
    dataSaver: connection?.saveData ? 'On' : 'Off / not reported',
    battery,
    storage,
    touchPoints: nav.maxTouchPoints ? `${nav.maxTouchPoints} touch points` : 'No touch input reported',
    language: nav.language || 'Not exposed',
    languages: nav.languages?.join(', ') || nav.language || 'Not exposed',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    cookies: nav.cookieEnabled ? 'Enabled' : 'Disabled',
    userAgent,
  };
};

const sections = [
  { id: 'overview', label: 'Overview', icon: 'grid' },
  { id: 'compute', label: 'Compute & graphics', icon: 'chip' },
  { id: 'memory', label: 'Memory', icon: 'chip' },
  { id: 'board', label: 'Board & BIOS', icon: 'display' },
  { id: 'display', label: 'Display', icon: 'display' },
  { id: 'connectivity', label: 'Connectivity', icon: 'wifi' },
  { id: 'environment', label: 'Browser environment', icon: 'globe' },
];

function Icon({ name, size = 18 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    chip: <><rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 1v5m6-5v5m-6 12v5m6-5v5M1 9h5m-5 6h5m12-6h5m-5 6h5" /></>,
    display: <><rect x="3" y="4" width="18" height="13" rx="2" /><path d="M8 21h8m-4-4v4" /></>,
    wifi: <><path d="M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0M12 20h.01" /><path d="M2 9a15 15 0 0 1 20 0" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18m0-18a15 15 0 0 0 0 18" /></>,
    refresh: <><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9a7 7 0 0 1 11.7-2L20 12M4 12l2.7 5a7 7 0 0 0 11.7-2" /></>,
    download: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m7 10 5 5 5-5m-5 5V3" /></>,
    copy: <><rect x="8" y="8" width="13" height="13" rx="2" /><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    lock: <><rect x="4" y="10" width="16" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  };
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

const displayValue = (value, fallback = 'Not reported') => {
  if (value === null || value === undefined || value === '') return fallback;
  return value;
};

function DataRow({ label, value, mono = false }) {
  const renderedValue = displayValue(value, 'Not reported');
  return <div className="data-row"><span>{label}</span><strong className={mono ? 'mono' : ''}>{renderedValue}</strong></div>;
}

function DataPanel({ title, icon, children, className = '' }) {
  return <section className={`data-panel ${className}`}><div className="panel-heading"><span className="panel-icon"><Icon name={icon} size={17} /></span><h2>{title}</h2></div><div className="panel-content">{children}</div></section>;
}

function App() {
  const [hardware, setHardware] = useState(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const refresh = async () => {
    setLoading(true);
    setHardware(await readHardware());
    setLoading(false);
  };

  useEffect(() => {
    let mounted = true;
    let reading = false;
    const poll = async () => {
      if (reading) return;
      reading = true;
      try {
        const nextHardware = await readHardware();
        if (mounted) setHardware(nextHardware);
      } finally {
        reading = false;
        if (mounted) setLoading(false);
      }
    };
    poll();
    const updateNetwork = () => setHardware(current => current ? { ...current, networkStatus: navigator.onLine ? 'Online' : 'Offline' } : current);
    window.addEventListener('online', updateNetwork);
    window.addEventListener('offline', updateNetwork);
    const timer = window.deviceHardware ? window.setInterval(poll, 1000) : null;
    return () => {
      mounted = false;
      window.removeEventListener('online', updateNetwork);
      window.removeEventListener('offline', updateNetwork);
      if (timer) window.clearInterval(timer);
    };
  }, []);

  const exportReport = () => {
    const blob = new Blob([JSON.stringify(hardware, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'device-report.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyReport = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(hardware, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch (error) {
      setCopied(false);
    }
  };

  const visible = activeSection;

  const cpuName = hardware?.soc?.name || hardware?.cpu?.name || 'Processor not reported';
  const socName = hardware?.soc?.summary || hardware?.soc?.name || cpuName;
  const socManufacturer = displayValue(hardware?.soc?.manufacturer);
  const socFamily = displayValue(hardware?.soc?.family);
  const socModel = displayValue(hardware?.soc?.model);
  const socProcess = displayValue(hardware?.soc?.processNode);

  const safeCpuDetails = hardware ? {
    cpuName,
    socName,
    socManufacturer,
    socFamily,
    socModel,
    socProcess,
  } : null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#overview" onClick={() => setActiveSection('overview')} aria-label="Fieldnote home">
          <span className="brand-mark"><span /><span /><span /><span /></span>
          <span className="brand-name">FIELDNOTE<span> / SYSTEMS</span></span>
        </a>
        <div className="sidebar-label">DEVICE REPORT</div>
        <nav className="side-nav" aria-label="Report sections">
          {sections.map(section => <button key={section.id} className={`nav-item ${activeSection === section.id ? 'active' : ''}`} onClick={() => setActiveSection(section.id)}><Icon name={section.icon} /><span>{section.label}</span>{activeSection === section.id && <i />}</button>)}
        </nav>
        <div className="sidebar-bottom"><span className="live-dot" /> LOCAL SESSION<br /><strong>Data stays on this device</strong></div>
      </aside>

      <main className="main-area">
        <header className="topbar"><div className="breadcrumb">DIAGNOSTICS <span>/</span> DEVICE PROFILE</div><div className="topbar-status"><span className="live-dot" /> {window.deviceHardware ? 'LIVE · 1 SECOND' : 'BROWSER SNAPSHOT'}</div></header>
        <div className="content-wrap">
          <div className="page-heading">
            <div><div className="eyebrow">HARDWARE & SYSTEM PROFILE <span>•</span> LIVE READOUT</div><h1>Your device,<br className="mobile-break" /> in detail.</h1><p className="subtitle">{window.deviceHardware ? 'Local operating-system hardware telemetry, sampled continuously.' : 'Browser-limited snapshot. Run the desktop app for host hardware details.'}</p></div>
            <div className="heading-actions"><button className="icon-button" onClick={copyReport} disabled={!hardware} title="Copy report JSON" aria-label="Copy report JSON"><Icon name={copied ? 'check' : 'copy'} /></button><button className="secondary-button" onClick={exportReport} disabled={!hardware}><Icon name="download" /> Export report</button><button className="primary-button" onClick={refresh} disabled={loading}><Icon name="refresh" /> {loading ? 'Reading…' : 'Refresh'}</button></div>
          </div>

          {!window.deviceHardware && <div className="notice-bar"><span className="notice-symbol">i</span><p><strong>Browser-limited report.</strong> Exact CPU model, installed RAM, disk inventory, serial numbers, and sensors are restricted to native system tools. Launch the desktop build to read the computer running this app.</p><button onClick={() => setActiveSection('environment')}>ABOUT ACCESS <span>↗</span></button></div>}

          {hardware && <>
            <div className="snapshot-line"><span><span className="live-dot" /> CAPTURED {hardware.updatedAt.toLocaleTimeString()}</span><span>COLLECTION SOURCE <strong>{hardware.runtime === 'desktop' ? `${hardware.operatingSystem} · LOCAL HOST` : 'WEB PLATFORM APIs'}</strong></span></div>

            {hardware.runtime === 'desktop' && (visible === 'overview' || visible === 'compute') && <>
              {visible === 'overview' && <div className="metric-strip">
                <div className="metric"><span className="metric-label">PROCESSOR CORES</span><strong>{hardware.cpu.logicalCores}</strong><span className="metric-foot">{hardware.cpu.physicalCores || 'N/A'} PHYSICAL CORES</span><span className="metric-glyph">01</span></div>
                <div className="metric"><span className="metric-label">SYSTEM MEMORY</span><strong>{formatBytes(hardware.memory.totalBytes)}</strong><span className="metric-foot">OS-REPORTED INSTALLED RAM</span><span className="metric-glyph">02</span></div>
                <div className="metric"><span className="metric-label">CPU SPEED · CURRENT</span><strong className="metric-resolution">{hardware.cpu.averageSpeedGhz ? `${hardware.cpu.averageSpeedGhz.toFixed(2)} GHz` : 'N/A'}</strong><span className="metric-foot">LIVE AVERAGE</span><span className="metric-glyph">03</span></div>
                <div className="metric"><span className="metric-label">GRAPHICS ADAPTERS</span><strong className="metric-online">{hardware.graphics.length}</strong><span className="metric-foot">DETECTED CONTROLLERS</span><span className="metric-glyph">04</span></div>
              </div>}
              <div className="panel-grid">
                <DataPanel title="Processor & live clocks" icon="chip"><DataRow label="SoC / CPU" value={safeCpuDetails?.socName || safeCpuDetails?.cpuName || 'Not reported'} /><DataRow label="Vendor" value={safeCpuDetails?.socManufacturer || 'Not reported'} /><DataRow label="Family / model" value={`${safeCpuDetails?.socFamily || 'Not reported'} / ${safeCpuDetails?.socModel || 'Not reported'}`} /><DataRow label="Architecture" value={hardware.cpu.architecture} /><DataRow label="Process node" value={safeCpuDetails?.socProcess || 'Not reported'} /><DataRow label="Max rated frequency" value={hardware.cpu.maxSpeedGhz ? `${hardware.cpu.maxSpeedGhz} GHz` : 'Not reported'} /><DataRow label="Current per-core frequency" value={hardware.cpu.current.length ? hardware.cpu.current.map((speed, index) => `C${index} ${speed} GHz`).join(' · ') : 'Per-core readings unavailable'} /><DataRow label="Hybrid core counts" value={`${hardware.cpu.performanceCores ?? 'N/A'} performance · ${hardware.cpu.efficiencyCores ?? 'N/A'} efficiency`} /></DataPanel>
                <DataPanel title="GPU & caches" icon="display">{hardware.graphics.length ? hardware.graphics.map((gpu, index) => <div key={`${gpu.model}-${index}`}><DataRow label={`GPU ${index + 1}`} value={`${gpu.vendor || ''} ${gpu.model || gpu.name || 'Unknown model'}`} /><DataRow label="VRAM" value={gpu.vram ? `${gpu.vram} MB` : 'Shared / unavailable'} /><DataRow label="GPU clock" value={gpu.clockCore ? `${gpu.clockCore} MHz` : 'Driver does not report'} /></div>) : <DataRow label="Graphics" value="No controller details reported" />}<DataRow label="L1 data / instruction" value={`${formatBytes(hardware.cpu.caches.l1d)} / ${formatBytes(hardware.cpu.caches.l1i)}`} /><DataRow label="L2 cache" value={formatBytes(hardware.cpu.caches.l2)} /><DataRow label="L3 cache" value={formatBytes(hardware.cpu.caches.l3)} /><DataRow label="CPU temperature" value={hardware.cpu.temperatureC != null ? `${hardware.cpu.temperatureC} °C` : 'Sensor unavailable'} /></DataPanel>
              </div>
            </>}

            {hardware.runtime === 'desktop' && (visible === 'overview' || visible === 'memory') && <DataPanel title="Memory modules" icon="chip"><DataRow label="Total physical memory" value={formatBytes(hardware.memory.totalBytes)} /><DataRow label="Available to OS" value={formatBytes(hardware.memory.availableBytes)} />{hardware.memory.modules.length ? hardware.memory.modules.map((module, index) => <div key={`${module.bank || module.partNum}-${index}`}><DataRow label={`Module ${index + 1}`} value={`${formatBytes(module.size)} ${module.type || 'memory'}`} /><DataRow label="Speed / form factor" value={`${module.clockSpeed || 'N/A'} MHz · ${module.formFactor || 'N/A'}`} /><DataRow label="Manufacturer / part" value={`${module.manufacturer || 'N/A'} · ${module.partNum || 'N/A'}`} mono /></div>) : <DataRow label="Module layout" value="Not exposed by this OS or permission level" />}</DataPanel>}

            {hardware.runtime === 'desktop' && (visible === 'overview' || visible === 'board') && <div className="panel-grid"><DataPanel title="System & mainboard" icon="display"><DataRow label="System manufacturer" value={hardware.system.manufacturer} /><DataRow label="System model" value={hardware.system.model} /><DataRow label="Mainboard manufacturer" value={hardware.mainboard.manufacturer} /><DataRow label="Mainboard model" value={hardware.mainboard.model} /><DataRow label="Board version" value={hardware.mainboard.version} /><DataRow label="Virtual machine" value={hardware.system.virtual ? `Yes · ${hardware.system.virtualHost || 'host unknown'}` : 'No / unknown'} /></DataPanel><DataPanel title="BIOS / firmware" icon="chip"><DataRow label="Vendor" value={hardware.bios.vendor} /><DataRow label="Version" value={hardware.bios.version} /><DataRow label="Release date" value={hardware.bios.releaseDate} /><DataRow label="Revision" value={hardware.bios.revision} /><DataRow label="SoC process node" value={safeCpuDetails?.socProcess || 'Not reported'} /></DataPanel></div>}

            {hardware.runtime !== 'desktop' && (visible === 'overview' || visible === 'display') && <div className="panel-grid">
              <DataPanel title="Display & viewport" icon="display"><DataRow label="Screen resolution" value={hardware.screen} /><DataRow label="Available area" value={hardware.availableScreen} /><DataRow label="Browser viewport" value={hardware.viewport} /><DataRow label="Pixel density" value={hardware.pixelRatio} /><DataRow label="Color depth" value={hardware.colorDepth} /><DataRow label="Orientation" value={hardware.orientation} /></DataPanel>
              {visible === 'display' && <DataPanel title="Input capabilities" icon="chip"><DataRow label="Touch points" value={hardware.touchPoints} /><DataRow label="Pointer capabilities" value={window.matchMedia('(pointer: coarse)').matches ? 'Coarse pointer available' : 'Fine pointer available'} /><DataRow label="Reduced motion" value={window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'Enabled' : 'Not enabled'} /></DataPanel>}
            </div>}

            {hardware.runtime !== 'desktop' && (visible === 'overview' || visible === 'connectivity') && <div className="panel-grid">
              <DataPanel title="Network connection" icon="wifi"><DataRow label="Connection" value={hardware.networkStatus} /><DataRow label="Effective type" value={hardware.networkType} /><DataRow label="Estimated downlink" value={hardware.downlink} /><DataRow label="Round-trip latency" value={hardware.latency} /><DataRow label="Data saver" value={hardware.dataSaver} /></DataPanel>
              {visible === 'connectivity' && <DataPanel title="Power & storage" icon="chip"><DataRow label="Battery" value={hardware.battery} /><DataRow label="Site storage" value={hardware.storage} /><DataRow label="Storage scope" value="This website only" /></DataPanel>}
            </div>}

            {hardware.runtime !== 'desktop' && (visible === 'overview' || visible === 'environment') && <div className="panel-grid">
              <DataPanel title="Browser environment" icon="globe"><DataRow label="Browser" value={hardware.browser} /><DataRow label="Browser version" value={hardware.browserVersion} /><DataRow label="Operating system" value={hardware.operatingSystem} /><DataRow label="Preferred language" value={hardware.language} /><DataRow label="Time zone" value={hardware.timezone} /><DataRow label="Cookies" value={hardware.cookies} /></DataPanel>
              {visible === 'environment' && <DataPanel title="Privacy & access" icon="lock"><DataRow label="Battery status" value={hardware.battery} /><DataRow label="Site storage" value={hardware.storage} /><DataRow label="Language preferences" value={hardware.languages} /><DataRow label="User agent" value={hardware.userAgent} mono /><div className="privacy-note"><Icon name="lock" size={16} /><span>Nothing is sent to a server. Values are read locally by your browser.</span></div></DataPanel>}
            </div>}
          </>}
          {loading && !hardware && <div className="loading-state"><span className="loader" /> Reading available device information…</div>}
          <footer className="page-footer"><span>FIELDNOTE SYSTEMS <span className="footer-divider">/</span> DEVICE REPORT</span><span>LOCAL READOUT · NO DATA UPLOAD</span></footer>
        </div>
      </main>
    </div>
  );
}

export default App;
