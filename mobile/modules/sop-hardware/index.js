import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

let nativeModule = null;
if (Platform.OS === 'android') {
  try {
    nativeModule = requireNativeModule('SopHardware');
  } catch (error) {
    nativeModule = null;
  }
}

export const isNativeCollectorAvailable = Boolean(nativeModule);

export async function readHardwareSnapshot() {
  if (!nativeModule) {
    return {
      platform: Platform.OS,
      collectorAvailable: false,
      message: Platform.OS === 'android'
        ? 'Install a custom Android development build to enable native hardware reads.'
        : 'This hardware collector currently supports Android only.',
    };
  }

  try {
    return { ...(await nativeModule.readSnapshot()), collectorAvailable: true };
  } catch (error) {
    return {
      platform: 'android',
      collectorAvailable: false,
      message: `Native hardware sampling failed: ${error.message || 'unknown error'}`,
    };
  }
}