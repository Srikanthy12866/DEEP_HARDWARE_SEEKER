# Fieldnote Device Report

Fieldnote reads hardware from the same device that runs the app. It has a React interface with separate host collectors for desktop and Android. A browser-only session can show only browser-approved estimates; it is not the full hardware application.

## Quick Start

From the repository root (`shr/`):

```powershell
npm install
npm run desktop
```

`npm run desktop` starts the Create React App development server on port 3000 and opens the Electron desktop window. Stop it with `Ctrl+C` in that terminal. If port 3000 is already occupied, stop the other process or use the browser-only command `npm start` (the Electron launcher currently expects port 3000).

The browser-only UI can be opened at `http://localhost:3000` after running `npm start`. It intentionally reports that CPU, installed memory, module layout, motherboard and BIOS information are unavailable from browser APIs.

## Architecture

```text
Desktop (Windows / macOS / Linux / Raspberry Pi)
React UI (src/App.js)
	-> window.deviceHardware.getSnapshot() (electron/preload.cjs)
	-> IPC: device:get-hardware-snapshot
	-> systeminformation (electron/main.cjs)
	-> local OS APIs, drivers and firmware interfaces

Android
React Native UI (mobile/App.js)
	-> local Expo module wrapper (mobile/modules/sop-hardware/index.js)
	-> Kotlin module (mobile/modules/sop-hardware/android/.../SopHardwareModule.kt)
	-> Android build properties, ActivityManager and readable kernel sysfs
```

The desktop renderer has `nodeIntegration: false`, `contextIsolation: true` and a sandboxed preload. Do not import Node modules or `systeminformation` from React. Add narrowly scoped IPC methods in the Electron preload/main process if the UI needs another host capability.

## Project Map

- `src/App.js`: React UI, browser fallback, report sections, refresh/export, and one-second polling when the Electron bridge exists.
- `src/App.css` and `src/index.css`: web and Electron renderer styling.
- `src/App.test.js`: React Testing Library smoke test for browser rendering.
- `electron/main.cjs`: Electron lifecycle, hardware snapshot collection, IPC handler, window security, and development/packaged loading.
- `electron/preload.cjs`: exposes the read-only `window.deviceHardware.getSnapshot()` bridge.
- `mobile/App.js`: separate React Native SOP interface and polling loop.
- `mobile/modules/sop-hardware/`: local Expo module with Android Kotlin collector.
- `mobile/README.md`: Android SDK/development build requirements and native field limitations.

## Desktop Development

Prerequisites: Node.js/npm and the native build tools required by Electron for the host OS. On Windows, run PowerShell or a terminal from `shr/`.

```powershell
npm install
npm run desktop
```

The Electron main process answers `device:get-hardware-snapshot` requests. The React UI polls once per second while the app is open. Manual refresh is also available. Run the usual web-only checks with:

```powershell
npm test -- --watchAll=false --runInBand
npm run build
```

`npm start` starts only the browser UI. `npm run desktop` starts both the React development server and Electron. `npm run build` creates the static React bundle consumed by packaged Electron builds.

## Desktop Packaging

Build on the target operating system so Electron Builder can use that platform's native packaging tools:

```powershell
npm run desktop:build
```

Configured outputs are Windows NSIS installer, macOS DMG, and Linux AppImage/DEB. Linux ARM64 packaging has a separate script:

```powershell
npm run desktop:linux-arm64
```

Run that command from an appropriate Linux build environment with ARM64 packaging support. Raspberry Pi OS should use a build that matches the Pi OS architecture (commonly ARM64). A Windows installer does not run on macOS/Linux; publish a separate artifact for each OS and architecture.

## Android Development

The mobile app is a separate Expo/React Native project. From `shr/mobile/`:

```powershell
npm install
npm run android
```

Native Android builds need a Java development kit and Android SDK/platform tools. `npm run android` installs the app onto an Android emulator or Android device selected by Android tooling; the app reads the device it is installed on. It does not use that phone to inspect the desktop host. Expo Go cannot load the custom Kotlin collector; use the development build created by `expo run:android`.

For Android-only JavaScript bundling, use `npx expo export --platform android`. This does not compile or exercise Kotlin. Use Android Studio/Gradle and an actual device to validate native sysfs reads.

## Hardware Data and Accuracy

The desktop collector calls `systeminformation` for CPU identity, current per-core speeds, cache sizes, memory and memory-module layout, graphics controllers/displays, system, baseboard, BIOS and OS data. The values are queried on the local host. Drivers, firmware and OS permissions determine which fields are populated. Missing or unsupported values should remain unavailable; do not infer values from a CPU marketing name or another device property.

The Android collector uses public Android build properties, `ActivityManager` memory data, EGL/OpenGL renderer data, and best-effort kernel paths under `/sys`. OEM kernels and app permissions vary. CPU/GPU frequency, hybrid-core topology, caches and GPU names can be unavailable. Stock Android does not expose semiconductor process node or RAM type/timings through a standard app API. Android devices do not have a PC-style BIOS.

Neither platform can guarantee CPU process node, every per-core clock, every GPU clock, RAM module type, or temperatures on every model. These are capabilities of a specific OS/driver/device combination, not promises of the UI. Do not add fabricated fallbacks.

## Extending the App

1. Identify the target platform and use its collector; do not route hardware reads through browser APIs.
2. Add the native read to that platform's collector and keep the returned data serializable (plain objects, arrays, strings, numbers, booleans, or null).
3. Preserve a consistent UI shape where the platforms report the same concept; leave platform-only values optional.
4. Update the relevant platform panel and document permission/driver limitations.
5. Verify in the browser test, run the React production build, then build and test the native target on hardware. A web bundle alone does not validate native code.

For desktop changes, the collector-to-UI contract is the object returned by `getHardwareSnapshot()` in `electron/main.cjs`. For Android, it is the map returned by `readSnapshot()` in `SopHardwareModule.kt`.

## Support Matrix

- Windows, macOS and Linux desktop: Electron host collector is implemented; create and test a native package for each OS.
- 64-bit Raspberry Pi OS: use the Linux ARM64 desktop build; test performance and which kernel/driver data is available on the target board.
- Android phones: separate Kotlin collector is implemented; native build and device validation are required.
- Android TV: the Android project may be a starting point, but remote navigation, TV layout, installation policy and hardware reads need device testing.
- Android Automotive, proprietary car systems, iOS/iPadOS and other embedded TV platforms: not currently certified or implemented as target-specific applications. They need platform-approved packaging, APIs and validation.


```
Reminder for me: Not to describe the app as running on "any OS" until that OS has a build target, collector implementation, and hardware validation.
```
