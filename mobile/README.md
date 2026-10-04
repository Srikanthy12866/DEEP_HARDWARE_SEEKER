# Fieldnote Device Report

This is the Android native hardware collector for the device SOP. It polls once per second while live mode is enabled.

## Run

Install dependencies with `npm install`, then run `npm run android` to build and launch the custom Android development app. `npm start` starts Metro in development-client mode. Expo Go cannot load the local Kotlin hardware module. An Android SDK and Java development kit are required for native builds.

## Reported fields

- SoC model and manufacturer when exposed by Android build properties; supported CPU ABIs
- Per-core current and maximum frequencies, CPU online state, kernel cluster membership, capacity and raw `core_type` where sysfs permits access
- CPU cache level, type, size and shared CPU list where sysfs permits access
- GPU renderer via EGL/OpenGL, plus vendor sysfs clock values where readable
- Android board, product, device identifiers and bootloader string
- Installed physical memory capacity

## Platform limits

Stock Android does not provide apps a standard API for semiconductor process node or installed RAM technology/timings. CPU/GPU sysfs access and topology vary across OEM kernels and may be denied. Inaccessible values are reported as unavailable rather than inferred. Android devices do not expose a PC-style BIOS. Full hardware telemetry may require OEM/system privileges or a rooted test device. The native collector currently supports Android; other platforms show an explicit unsupported message.