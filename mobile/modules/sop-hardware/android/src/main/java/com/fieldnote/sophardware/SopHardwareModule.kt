package com.fieldnote.sophardware

import android.app.ActivityManager
import android.content.Context
import android.opengl.EGL14
import android.opengl.EGLConfig
import android.opengl.EGLContext
import android.opengl.EGLDisplay
import android.opengl.EGLSurface
import android.opengl.GLES20
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

class SopHardwareModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("SopHardware")

    AsyncFunction("readSnapshot") {
      readSnapshot()
    }
  }

  private fun readSnapshot(): Map<String, Any?> {
    val cpuDirectory = File("/sys/devices/system/cpu")
    val cpuDirectories = cpuDirectory.listFiles()
      ?.filter { it.name.matches(Regex("cpu\\d+")) }
      ?.sortedBy { it.name.removePrefix("cpu").toIntOrNull() ?: Int.MAX_VALUE }
      .orEmpty()

    val cores = cpuDirectories.map { directory ->
      val topology = File(directory, "topology")
      val cluster = firstReadable(
        File(topology, "cluster_cpus_list"),
        File(topology, "core_siblings_list"),
        File(directory, "cpufreq/related_cpus")
      )
      val currentKhz = firstReadable(
        File(directory, "cpufreq/scaling_cur_freq"),
        File(directory, "cpufreq/cpuinfo_cur_freq")
      )?.toDoubleOrNull()
      val maximumKhz = firstReadable(
        File(directory, "cpufreq/cpuinfo_max_freq"),
        File(directory, "cpufreq/scaling_max_freq")
      )?.toDoubleOrNull()
      val onlineValue = readText(File(directory, "online"))
      val coreId = directory.name.removePrefix("cpu").toIntOrNull()

      mapOf(
        "id" to coreId,
        "online" to (onlineValue?.let { it != "0" } ?: (coreId == 0)),
        "clusterCpus" to cluster,
        "currentMhz" to currentKhz?.div(1000.0)?.let { Math.round(it).toInt() },
        "maximumMhz" to maximumKhz?.div(1000.0)?.let { Math.round(it).toInt() },
        "capacity" to readText(File(topology, "cpu_capacity"))?.toIntOrNull(),
        "coreType" to readText(File(topology, "core_type"))
      )
    }

    val cacheEntries = linkedMapOf<String, Map<String, Any?>>()
    cpuDirectories.forEach { directory ->
      File(directory, "cache").listFiles()
        ?.filter { it.name.matches(Regex("index\\d+")) }
        ?.forEach { cacheDirectory ->
          val sharedCpus = readText(File(cacheDirectory, "shared_cpu_list")) ?: ""
          val level = readText(File(cacheDirectory, "level")) ?: continue
          val type = readText(File(cacheDirectory, "type")) ?: "Unknown"
          val key = "$level|$type|$sharedCpus"
          cacheEntries.putIfAbsent(key, mapOf(
            "level" to level.toIntOrNull(),
            "type" to type,
            "size" to readText(File(cacheDirectory, "size")),
            "sharedCpus" to sharedCpus
          ))
        }
    }

    val gpu = readGpu()
    val memoryInfo = ActivityManager.MemoryInfo()
    val activityManager = appContext.reactContext?.getSystemService(Context.ACTIVITY_SERVICE) as? ActivityManager
    activityManager?.getMemoryInfo(memoryInfo)

    val cpuInfo = readText(File("/proc/cpuinfo")).orEmpty()
    val socName = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) Build.SOC_MODEL else ""
    val socManufacturer = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) Build.SOC_MANUFACTURER else ""

    return mapOf(
      "platform" to "Android",
      "capturedAt" to System.currentTimeMillis(),
      "soc" to mapOf(
        "name" to socName.ifBlank { extractCpuInfo(cpuInfo, "Hardware") ?: "Not exposed" },
        "manufacturer" to socManufacturer.ifBlank { "Not exposed" },
        "architecture" to Build.SUPPORTED_ABIS.joinToString(", ").ifBlank { "Not exposed" },
        "processNode" to "Not exposed by Android APIs",
        "hardwareId" to Build.HARDWARE.ifBlank { "Not exposed" }
      ),
      "cpu" to mapOf(
        "reportedCoreCount" to Runtime.getRuntime().availableProcessors(),
        "cores" to cores,
        "topologyStatus" to if (cores.any { it["clusterCpus"] != null }) "Kernel topology reported" else "Cluster topology unavailable"
      ),
      "gpu" to gpu,
      "caches" to cacheEntries.values.toList(),
      "board" to mapOf(
        "manufacturer" to Build.MANUFACTURER,
        "board" to Build.BOARD.ifBlank { "Not exposed" },
        "product" to Build.PRODUCT.ifBlank { "Not exposed" },
        "device" to Build.DEVICE.ifBlank { "Not exposed" },
        "bootloader" to Build.BOOTLOADER.ifBlank { "Not exposed" },
        "bios" to "Not applicable on Android devices"
      ),
      "memory" to mapOf(
        "totalBytes" to if (memoryInfo.totalMem > 0) memoryInfo.totalMem else null,
        "type" to "Not exposed by Android public APIs"
      ),
      "access" to mapOf(
        "cpuSysfsReadable" to cores.any { it["currentMhz"] != null || it["maximumMhz"] != null },
        "cacheSysfsReadable" to cacheEntries.isNotEmpty(),
        "gpuSysfsReadable" to (gpu["name"] != null || gpu["currentMhz"] != null || gpu["maximumMhz"] != null)
      )
    )
  }

  private fun readGpu(): Map<String, Any?> {
    val nameFiles = listOf(
      File("/sys/class/kgsl/kgsl-3d0/gpu_model"),
      File("/sys/class/misc/mali0/device/name"),
      File("/sys/kernel/gpu/gpu_model")
    )
    val clockFiles = listOf(
      File("/sys/class/kgsl/kgsl-3d0/gpuclk"),
      File("/sys/class/kgsl/kgsl-3d0/devfreq/cur_freq"),
      File("/sys/class/misc/mali0/device/clock")
    )
    val maximumClockFiles = listOf(
      File("/sys/class/kgsl/kgsl-3d0/max_gpuclk"),
      File("/sys/class/kgsl/kgsl-3d0/devfreq/max_freq")
    )
    val current = firstReadable(*clockFiles.toTypedArray())?.toDoubleOrNull()
    val maximum = firstReadable(*maximumClockFiles.toTypedArray())?.toDoubleOrNull()

    return mapOf(
      "name" to firstReadable(*nameFiles.toTypedArray()) ?: readOpenGlRenderer(),
      "currentMhz" to current?.let(::frequencyToMhz),
      "maximumMhz" to maximum?.let(::frequencyToMhz),
      "status" to if (current != null || maximum != null) "Vendor sysfs data" else "GPU telemetry unavailable"
    )
  }

  private fun extractCpuInfo(contents: String, key: String): String? {
    return contents.lineSequence()
      .firstOrNull { it.substringBefore(':').trim().equals(key, ignoreCase = true) }
      ?.substringAfter(':')
      ?.trim()
      ?.takeIf { it.isNotBlank() }
  }

  private fun frequencyToMhz(value: Double): Int {
    val mhz = when {
      value >= 10_000_000.0 -> value / 1_000_000.0
      value >= 10_000.0 -> value / 1_000.0
      else -> value
    }
    return Math.round(mhz).toInt()
  }

  private fun readOpenGlRenderer(): String? {
    var display: EGLDisplay? = null
    var surface: EGLSurface? = null
    var context: EGLContext? = null
    return try {
      display = EGL14.eglGetDisplay(EGL14.EGL_DEFAULT_DISPLAY)
      if (display == EGL14.EGL_NO_DISPLAY) return null

      val versions = IntArray(2)
      if (!EGL14.eglInitialize(display, versions, 0, versions, 1)) return null

      val configs = arrayOfNulls<EGLConfig>(1)
      val configCount = IntArray(1)
      val configAttributes = intArrayOf(
        EGL14.EGL_RENDERABLE_TYPE, EGL14.EGL_OPENGL_ES2_BIT,
        EGL14.EGL_SURFACE_TYPE, EGL14.EGL_PBUFFER_BIT,
        EGL14.EGL_NONE
      )
      if (!EGL14.eglChooseConfig(display, configAttributes, 0, configs, 0, 1, configCount, 0)) return null
      val config = configs[0] ?: return null
      val contextAttributes = intArrayOf(EGL14.EGL_CONTEXT_CLIENT_VERSION, 2, EGL14.EGL_NONE)
      context = EGL14.eglCreateContext(display, config, EGL14.EGL_NO_CONTEXT, contextAttributes, 0)
      if (context == EGL14.EGL_NO_CONTEXT) return null
      val surfaceAttributes = intArrayOf(EGL14.EGL_WIDTH, 1, EGL14.EGL_HEIGHT, 1, EGL14.EGL_NONE)
      surface = EGL14.eglCreatePbufferSurface(display, config, surfaceAttributes, 0)
      if (surface == EGL14.EGL_NO_SURFACE || !EGL14.eglMakeCurrent(display, surface, surface, context)) return null
      GLES20.glGetString(GLES20.GL_RENDERER)?.trim()?.takeIf { it.isNotBlank() }
    } catch (_: Exception) {
      null
    } finally {
      if (display != null && display != EGL14.EGL_NO_DISPLAY) {
        if (surface != null && surface != EGL14.EGL_NO_SURFACE) EGL14.eglDestroySurface(display, surface)
        if (context != null && context != EGL14.EGL_NO_CONTEXT) EGL14.eglDestroyContext(display, context)
        EGL14.eglTerminate(display)
      }
    }
  }

  private fun firstReadable(vararg files: File): String? {
    return files.firstNotNullOfOrNull(::readText)
  }

  private fun readText(file: File): String? {
    return try {
      if (!file.canRead() || !file.isFile) null else file.readText().trim().takeIf { it.isNotBlank() }
    } catch (_: Exception) {
      null
    }
  }
}