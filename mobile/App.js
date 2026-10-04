import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import * as Device from 'expo-device';
import { readHardwareSnapshot } from './modules/sop-hardware';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

const getSnapshot = async () => {
  const hardware = await readHardwareSnapshot();

  return {
    model: Device.modelName || Device.modelId || 'Model unavailable',
    manufacturer: Device.manufacturer || 'Not reported',
    capturedAt: hardware.capturedAt || Date.now(),
    hardware,
  };
};

const groups = [
  { id: 'overview', label: 'Summary' },
  { id: 'soc', label: 'SoC' },
  { id: 'cpu', label: 'CPU cores' },
  { id: 'gpu', label: 'GPU' },
  { id: 'caches', label: 'Caches' },
  { id: 'board', label: 'Board & RAM' },
];

function DataRow({ label, value, mono = false }) {
  return (
    <View style={styles.dataRow}>
      <Text style={styles.dataLabel}>{label}</Text>
      <Text selectable style={[styles.dataValue, mono && styles.mono]}>{value || 'Not reported'}</Text>
    </View>
  );
}

function Panel({ title, eyebrow, children, wide = false }) {
  return (
    <View style={[styles.panel, wide && styles.panelWide]}>
      <View style={styles.panelHeading}>
        <View>
          <Text style={styles.panelEyebrow}>{eyebrow}</Text>
          <Text style={styles.panelTitle}>{title}</Text>
        </View>
        <View style={styles.panelMark}><View style={styles.panelSquare} /><View style={styles.panelSquare} /><View style={styles.panelSquare} /><View style={styles.panelSquare} /></View>
      </View>
      <View style={styles.panelBody}>{children}</View>
    </View>
  );
}

function App() {
  const [snapshot, setSnapshot] = useState(null);
  const [section, setSection] = useState('overview');
  const [copied, setCopied] = useState(false);
  const [liveEnabled, setLiveEnabled] = useState(true);
  const { width } = useWindowDimensions();
  const columns = width >= 760 ? 2 : 1;

  useEffect(() => {
    let mounted = true;
    let reading = false;
    const poll = async () => {
      if (reading) return;
      reading = true;
      const report = await getSnapshot();
      if (mounted) setSnapshot(report);
      reading = false;
    };
    poll();
    if (liveEnabled) {
      const timer = setInterval(poll, 1000);
      return () => {
        mounted = false;
        clearInterval(timer);
      };
    }
    return () => { mounted = false; };
  }, [liveEnabled]);

  const copyReport = async () => {
    if (!snapshot) return;
    await Clipboard.setStringAsync(JSON.stringify(snapshot, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const show = (...ids) => ids.includes(section);
  const hardware = snapshot?.hardware;
  const formatMemory = (bytes) => bytes ? `${(bytes / 1024 ** 3).toFixed(1)} GB` : 'Not reported';
  const formatClock = (mhz) => mhz == null ? 'Not exposed' : `${mhz} MHz`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="light" backgroundColor={palette.forest} />
      <View style={styles.appShell}>
        <View style={styles.topBar}>
          <View style={styles.brand}>
            <View style={styles.brandMark}><View style={styles.brandSquare} /><View style={styles.brandSquare} /><View style={styles.brandSquare} /><View style={styles.brandSquare} /></View>
            <View><Text style={styles.brandName}>FIELDNOTE</Text><Text style={styles.brandCaption}>DEVICE SYSTEMS</Text></View>
          </View>
          <Pressable onPress={() => setLiveEnabled((enabled) => !enabled)} style={styles.statusPill} accessibilityRole="switch" accessibilityState={{ checked: liveEnabled }}>
            <View style={[styles.statusDot, !liveEnabled && styles.statusDotPaused]} />
            <Text style={styles.statusText}>{liveEnabled ? 'LIVE · 1 SEC' : 'PAUSED'}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.introRow}>
            <View style={styles.introCopy}>
              <Text style={styles.eyebrow}>HARDWARE / LIVE READOUT</Text>
              <Text style={styles.title}>Device{ '\n' }profile.</Text>
              <Text style={styles.subtitle}>A closer look at the hardware this app can see.</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Copy device report" onPress={copyReport} disabled={!snapshot} style={({ pressed }) => [styles.copyButton, pressed && styles.pressed, !snapshot && styles.disabled]}>
              <Text style={styles.copyGlyph}>{copied ? '✓' : '⧉'}</Text>
              <Text style={styles.copyText}>{copied ? 'COPIED' : 'COPY'}</Text>
            </Pressable>
          </View>

          <View style={styles.identityPanel}>
            <View style={styles.identityTopline}><Text style={styles.identityEyebrow}>CURRENT DEVICE</Text><Text style={styles.identityType}>{hardware?.platform || 'READING'}</Text></View>
            <Text style={styles.deviceName}>{hardware?.soc?.name || snapshot?.model || 'Reading device…'}</Text>
            <Text style={styles.deviceSubtitle}>{hardware ? `${hardware.board?.manufacturer || snapshot?.manufacturer}  /  ${hardware.platform}` : 'Collecting native hardware information'}</Text>
            <View style={styles.identityRule} />
            <View style={styles.quickFacts}>
              <View style={styles.quickFact}><Text style={styles.quickFactLabel}>SYSTEM RAM</Text><Text style={styles.quickFactValue}>{formatMemory(hardware?.memory?.totalBytes)}</Text></View>
              <View style={styles.factDivider} />
              <View style={styles.quickFact}><Text style={styles.quickFactLabel}>CPU CORES</Text><Text style={styles.quickFactValue}>{hardware?.cpu?.cores?.length ?? '—'}</Text></View>
              <View style={styles.factDivider} />
              <View style={styles.quickFact}><Text style={styles.quickFactLabel}>LIVE SAMPLE</Text><Text style={styles.quickFactValue}>{liveEnabled ? '1 sec' : 'Paused'}</Text></View>
            </View>
          </View>

          <View style={styles.notice}>
            <Text style={styles.noticeMark}>i</Text>
            <Text style={styles.noticeText}>Values are sampled every second from Android build properties and kernel sysfs where permitted. Vendor permissions vary; inaccessible values stay marked unavailable. Process node and RAM technology are not exposed by standard Android APIs.</Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} accessibilityLabel="Device report sections">
            {groups.map((item) => (
              <Pressable key={item.id} accessibilityRole="tab" accessibilityState={{ selected: section === item.id }} onPress={() => setSection(item.id)} style={[styles.tab, section === item.id && styles.tabActive]}>
                <Text style={[styles.tabText, section === item.id && styles.tabTextActive]}>{item.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {hardware?.collectorAvailable && <Text style={styles.sampleTime}>LAST SAMPLE · {new Date(hardware.capturedAt).toLocaleTimeString()}</Text>}

          {!snapshot && <View style={styles.loading}><ActivityIndicator color={palette.green} /><Text style={styles.loadingText}>Reading device capabilities…</Text></View>}

          {hardware?.collectorAvailable === false && <View style={styles.notice}><Text style={styles.noticeText}>{hardware.message}</Text></View>}

          {hardware?.collectorAvailable && show('overview', 'soc') && (
            <Panel title="System-on-chip" eyebrow="01 / SILICON">
              <DataRow label="SoC name" value={hardware.soc.name} />
              <DataRow label="SoC manufacturer" value={hardware.soc.manufacturer} />
              <DataRow label="OS-supported CPU ABIs" value={hardware.soc.architecture} mono />
              <DataRow label="Manufacturing process" value={hardware.soc.processNode} />
              <DataRow label="Hardware identifier" value={hardware.soc.hardwareId} mono />
            </Panel>
          )}

          {hardware?.collectorAvailable && show('overview', 'cpu') && (
            <View style={[styles.panelGrid, columns === 2 && styles.panelGridWide]}>
              <Panel title="Per-core live clocks" eyebrow="02 / CPU" wide={columns === 2}>
                <DataRow label="Online cores reported" value={`${hardware.cpu.reportedCoreCount} / ${hardware.cpu.cores.length}`} />
                <DataRow label="Topology access" value={hardware.cpu.topologyStatus} />
                {hardware.cpu.cores.map((core) => (
                  <View key={core.id} style={styles.coreRow}>
                    <View style={styles.coreIdentity}><Text style={styles.coreTitle}>CORE {core.id}</Text><Text style={styles.coreSub}>Cluster {core.clusterCpus || 'unknown'} · {core.online === false ? 'offline' : core.online === true ? 'online' : 'state unknown'}</Text></View>
                    <View style={styles.coreClocks}><Text style={styles.coreCurrent}>{formatClock(core.currentMhz)}</Text><Text style={styles.coreMaximum}>MAX {formatClock(core.maximumMhz)}</Text></View>
                  </View>
                ))}
              </Panel>
              <Panel title="Core type & topology" eyebrow="03 / CLUSTERS" wide={columns === 2}>
                <DataRow label="Cluster groupings" value={[...new Set(hardware.cpu.cores.map((core) => core.clusterCpus).filter(Boolean))].join(' / ') || 'Not exposed'} />
                <DataRow label="Kernel core_type (raw)" value={hardware.cpu.cores.some((core) => core.coreType) ? hardware.cpu.cores.map((core) => `CPU ${core.id}: ${core.coreType || '—'}`).join(', ') : 'Not exposed by kernel'} />
                <DataRow label="Capacity values" value={hardware.cpu.cores.some((core) => core.capacity) ? hardware.cpu.cores.map((core) => `CPU ${core.id}: ${core.capacity || '—'}`).join(', ') : 'Not exposed'} />
              </Panel>
            </View>
          )}

          {hardware?.collectorAvailable && show('overview', 'gpu') && (
            <Panel title="Graphics processor" eyebrow="04 / GPU">
              <DataRow label="GPU name" value={hardware.gpu.name || 'Not exposed by vendor interface'} />
              <DataRow label="Current clock" value={formatClock(hardware.gpu.currentMhz)} />
              <DataRow label="Maximum clock" value={formatClock(hardware.gpu.maximumMhz)} />
              <DataRow label="Telemetry source" value={hardware.gpu.status} />
            </Panel>
          )}

          {hardware?.collectorAvailable && show('overview', 'caches') && (
            <Panel title="CPU cache topology" eyebrow="05 / CACHE">
              {hardware.caches.length ? hardware.caches.map((cache, index) => (
                <View key={`${cache.level}-${cache.type}-${cache.sharedCpus}-${index}`} style={styles.cacheRow}>
                  <View style={styles.cacheBadge}><Text style={styles.cacheBadgeText}>L{cache.level ?? '?'}</Text></View>
                  <View style={styles.cacheInfo}><Text style={styles.cacheName}>{cache.type} cache · {cache.size || 'size unavailable'}</Text><Text style={styles.cacheSub}>Shared by CPUs {cache.sharedCpus || 'not reported'}</Text></View>
                </View>
              )) : <DataRow label="Cache topology" value="Kernel cache sysfs is unavailable" />}
            </Panel>
          )}

          {hardware?.collectorAvailable && show('overview', 'board') && (
            <View style={[styles.panelGrid, columns === 2 && styles.panelGridWide]}>
              <Panel title="Mainboard & firmware" eyebrow="06 / BOARD" wide={columns === 2}>
                <DataRow label="Manufacturer" value={hardware.board.manufacturer} />
                <DataRow label="Board identifier" value={hardware.board.board} mono />
                <DataRow label="Product" value={hardware.board.product} mono />
                <DataRow label="Device codename" value={hardware.board.device} mono />
                <DataRow label="Bootloader" value={hardware.board.bootloader} mono />
                <DataRow label="BIOS" value={hardware.board.bios} />
              </Panel>
              <Panel title="Physical memory" eyebrow="07 / RAM" wide={columns === 2}>
                <DataRow label="Installed memory" value={formatMemory(hardware.memory.totalBytes)} />
                <DataRow label="Memory type" value={hardware.memory.type} />
                <DataRow label="Read access" value={hardware.access.cpuSysfsReadable ? 'CPU sysfs readable' : 'CPU sysfs restricted'} />
                <DataRow label="Kernel source" value="Android ActivityManager / sysfs" mono />
              </Panel>
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>FIELDNOTE SYSTEMS  /  DEVICE REPORT</Text>
            <Text style={styles.footerText}>ON-DEVICE READOUT · NO UPLOAD</Text>
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const palette = {
  forest: '#162923',
  forestLight: '#294237',
  paper: '#f4f6f0',
  white: '#ffffff',
  ink: '#23372d',
  muted: '#748279',
  line: '#dfe5da',
  green: '#638b43',
  lime: '#c6e779',
};

const styles = StyleSheet.create({
  safeArea: { backgroundColor: palette.forest, flex: 1 },
  appShell: { backgroundColor: palette.paper, flex: 1 },
  topBar: { alignItems: 'center', backgroundColor: palette.forest, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 22, paddingVertical: 17 },
  brand: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  brandMark: { flexDirection: 'row', flexWrap: 'wrap', gap: 3, height: 22, transform: [{ rotate: '-8deg' }], width: 22 },
  brandSquare: { backgroundColor: palette.lime, height: 9, width: 9 },
  brandName: { color: '#f4f6ec', fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  brandCaption: { color: '#a6b4a8', fontSize: 8, letterSpacing: 1.2, marginTop: 3 },
  statusPill: { alignItems: 'center', borderColor: '#486152', borderRadius: 20, borderWidth: 1, flexDirection: 'row', gap: 7, paddingHorizontal: 10, paddingVertical: 6 },
  statusDot: { backgroundColor: palette.lime, borderRadius: 4, height: 7, width: 7 },
  statusDotPaused: { backgroundColor: '#859187' },
  statusText: { color: '#d5e0d5', fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  scrollContent: { paddingBottom: 25, paddingHorizontal: 20, paddingTop: 27 },
  introRow: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', marginBottom: 19 },
  introCopy: { flex: 1, paddingRight: 12 },
  eyebrow: { color: '#738279', fontSize: 9, fontWeight: '700', letterSpacing: 1.5, marginBottom: 10 },
  title: { color: palette.ink, fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 38, fontWeight: '400', lineHeight: 39 },
  subtitle: { color: '#6b7870', fontSize: 12, lineHeight: 18, marginTop: 9, maxWidth: 320 },
  copyButton: { alignItems: 'center', borderColor: palette.line, borderRadius: 4, borderWidth: 1, height: 49, justifyContent: 'center', width: 57 },
  copyGlyph: { color: palette.ink, fontSize: 19, lineHeight: 21 },
  copyText: { color: '#738279', fontSize: 7, fontWeight: '700', letterSpacing: 1, marginTop: 2 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.98 }] },
  disabled: { opacity: 0.5 },
  identityPanel: { backgroundColor: palette.forest, borderRadius: 5, marginBottom: 12, overflow: 'hidden', paddingHorizontal: 18, paddingTop: 16 },
  identityTopline: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  identityEyebrow: { color: '#9cae9f', fontSize: 8, fontWeight: '700', letterSpacing: 1.3 },
  identityType: { color: palette.lime, fontSize: 8, fontWeight: '700', letterSpacing: 1 },
  deviceName: { color: '#f5f6ee', fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif', fontSize: 25, marginTop: 11 },
  deviceSubtitle: { color: '#b2c1b5', fontSize: 10, marginTop: 5 },
  identityRule: { backgroundColor: '#385044', height: 1, marginTop: 18 },
  quickFacts: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 13 },
  quickFact: { flex: 1 },
  quickFactLabel: { color: '#95a99a', fontSize: 7, fontWeight: '700', letterSpacing: 1.1 },
  quickFactValue: { color: '#f1f4eb', fontSize: 12, fontWeight: '600', marginTop: 5, textTransform: 'capitalize' },
  factDivider: { backgroundColor: '#40574a', height: 26, marginHorizontal: 10, width: 1 },
  notice: { alignItems: 'flex-start', backgroundColor: '#e9eee1', borderLeftColor: '#a4c866', borderLeftWidth: 3, flexDirection: 'row', gap: 9, marginBottom: 15, paddingHorizontal: 11, paddingVertical: 10 },
  noticeMark: { alignItems: 'center', borderColor: '#7a9064', borderRadius: 9, borderWidth: 1, color: '#60794a', fontFamily: 'Georgia', fontSize: 11, fontStyle: 'italic', height: 18, lineHeight: 16, textAlign: 'center', width: 18 },
  noticeText: { color: '#57655a', flex: 1, fontSize: 9, lineHeight: 14 },
  tabs: { gap: 7, paddingBottom: 12, paddingTop: 1 },
  sampleTime: { color: '#829087', fontSize: 8, fontWeight: '700', letterSpacing: 0.8, marginBottom: 10, marginTop: -3 },
  tab: { borderColor: '#dce2d8', borderRadius: 3, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 9 },
  tabActive: { backgroundColor: palette.forest, borderColor: palette.forest },
  tabText: { color: '#66756b', fontSize: 10, fontWeight: '600' },
  tabTextActive: { color: '#eff5e8' },
  panelGrid: { gap: 11 },
  panelGridWide: { flexDirection: 'row' },
  panel: { backgroundColor: palette.white, borderColor: palette.line, borderRadius: 4, borderWidth: 1, marginBottom: 11, minWidth: 0, overflow: 'hidden', paddingHorizontal: 14, paddingTop: 13 },
  panelWide: { flex: 1 },
  panelHeading: { alignItems: 'center', borderBottomColor: '#e9eee6', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 10 },
  panelEyebrow: { color: '#849188', fontSize: 7, fontWeight: '700', letterSpacing: 1.2 },
  panelTitle: { color: palette.ink, fontSize: 13, fontWeight: '700', marginTop: 4 },
  panelMark: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, height: 17, width: 17 },
  panelSquare: { backgroundColor: palette.lime, height: 7, opacity: 0.85, width: 7 },
  panelBody: { paddingBottom: 2, paddingTop: 2 },
  dataRow: { alignItems: 'flex-start', borderBottomColor: '#edf0ea', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 34, paddingVertical: 9 },
  dataLabel: { color: '#7a867e', flex: 1, fontSize: 10, paddingRight: 8 },
  dataValue: { color: '#354a3c', flex: 1, fontSize: 10, fontWeight: '600', textAlign: 'right' },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 9 },
  coreRow: { alignItems: 'center', borderBottomColor: '#edf0ea', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', justifyContent: 'space-between', minHeight: 47, paddingVertical: 7 },
  coreIdentity: { flex: 1 },
  coreTitle: { color: palette.ink, fontSize: 10, fontWeight: '800', letterSpacing: 0.6 },
  coreSub: { color: '#849188', fontSize: 8, marginTop: 4 },
  coreClocks: { alignItems: 'flex-end', flex: 1 },
  coreCurrent: { color: '#354a3c', fontSize: 10, fontWeight: '700' },
  coreMaximum: { color: '#849188', fontSize: 8, marginTop: 3 },
  cacheRow: { alignItems: 'center', borderBottomColor: '#edf0ea', borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 11, minHeight: 49, paddingVertical: 8 },
  cacheBadge: { alignItems: 'center', backgroundColor: '#edf2e6', borderRadius: 3, height: 28, justifyContent: 'center', width: 34 },
  cacheBadgeText: { color: '#567343', fontSize: 9, fontWeight: '800' },
  cacheInfo: { flex: 1 },
  cacheName: { color: '#354a3c', fontSize: 10, fontWeight: '600' },
  cacheSub: { color: '#849188', fontSize: 8, marginTop: 4 },
  loading: { alignItems: 'center', gap: 10, justifyContent: 'center', minHeight: 110 },
  loadingText: { color: palette.muted, fontSize: 11 },
  footer: { borderTopColor: palette.line, borderTopWidth: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginTop: 14, paddingTop: 12, rowGap: 6 },
  footerText: { color: '#8a978e', fontSize: 7, fontWeight: '700', letterSpacing: 0.7 },
});
