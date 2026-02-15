package com.bufferedblob

import android.os.Environment
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.ReadableMap
import com.facebook.react.bridge.WritableNativeArray
import com.facebook.react.bridge.WritableNativeMap
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.security.MessageDigest
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

class BufferedBlobModule(reactContext: ReactApplicationContext)
  : NativeBufferedBlobSpec(reactContext) {

  companion object {
    const val NAME = "BufferedBlob"
    private const val MIN_BUFFER_SIZE = 4096
    private const val MAX_BUFFER_SIZE = 4194304 // 4MB
    private const val HASH_CHUNK_SIZE = 8192
  }

  private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

  override fun getName(): String = NAME

  override fun install(): Boolean {
    return try {
      val jsContext = reactApplicationContext.javaScriptContextHolder?.get() ?: return false
      if (jsContext == 0L) return false
      val callInvokerHolder = reactApplicationContext.jsCallInvokerHolder ?: return false
      nativeInstall(jsContext, callInvokerHolder)
      true
    } catch (e: Exception) {
      false
    }
  }

  private external fun nativeInstall(jsiPtr: Long, callInvokerHolder: Any)

  init {
    System.loadLibrary("bufferedblobstreaming")
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun openRead(path: String, bufferSize: Double): Double {
    val size = bufferSize.toInt()
    if (size < MIN_BUFFER_SIZE || size > MAX_BUFFER_SIZE) {
      throw RuntimeException("[INVALID_ARGUMENT] Buffer size must be $MIN_BUFFER_SIZE-$MAX_BUFFER_SIZE: $size")
    }
    val file = File(path)
    if (!file.exists()) throw RuntimeException("[FILE_NOT_FOUND] File does not exist: $path")
    if (!file.isFile) throw RuntimeException("[INVALID_ARGUMENT] Path is not a file: $path")
    val stream = try {
      FileInputStream(file)
    } catch (e: java.io.FileNotFoundException) {
      throw RuntimeException("[FILE_NOT_FOUND] File was removed during open: $path")
    }
    val reader = ReaderHandle(stream, size, file.length())
    return HandleRegistry.register(reader).toDouble()
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun openWrite(path: String, append: Boolean): Double {
    val file = File(path)
    file.parentFile?.mkdirs()
    val stream = FileOutputStream(file, append)
    val writer = WriterHandle(stream)
    return HandleRegistry.register(writer).toDouble()
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun createDownload(url: String, destPath: String, headers: ReadableMap): Double {
    val headerMap = mutableMapOf<String, String>()
    val iter = headers.keySetIterator()
    while (iter.hasNextKey()) {
      val key = iter.nextKey()
      headerMap[key] = headers.getString(key) ?: ""
    }
    val handle = DownloaderHandle(url, destPath, headerMap)
    return HandleRegistry.register(handle).toDouble()
  }

  @ReactMethod(isBlockingSynchronousMethod = true)
  override fun closeHandle(handleId: Double) {
    HandleRegistry.remove(handleId.toInt())
  }

  override fun getTypedExportedConstants(): Map<String, Any> {
    return mapOf(
      "documentDir" to reactApplicationContext.filesDir.absolutePath,
      "cacheDir" to reactApplicationContext.cacheDir.absolutePath,
      "tempDir" to (System.getProperty("java.io.tmpdir") ?: reactApplicationContext.cacheDir.absolutePath),
      "downloadDir" to Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).absolutePath
    )
  }

  override fun exists(path: String, promise: Promise) {
    scope.launch {
      try {
        promise.resolve(File(path).exists())
      } catch (e: Exception) {
        promise.reject("ERR_FS", e.message, e)
      }
    }
  }

  override fun stat(path: String, promise: Promise) {
    scope.launch {
      try {
        val file = File(path)
        if (!file.exists()) throw RuntimeException("[FILE_NOT_FOUND] File does not exist: $path")
        val type = when {
          file.isFile -> "file"
          file.isDirectory -> "directory"
          else -> "unknown"
        }
        val map = WritableNativeMap().apply {
          putString("path", file.absolutePath)
          putString("name", file.name)
          putDouble("size", (if (file.isFile) file.length() else 0L).toDouble())
          putString("type", type)
          putDouble("lastModified", file.lastModified().toDouble())
        }
        promise.resolve(map)
      } catch (e: Exception) {
        promise.reject("ERR_FS", e.message, e)
      }
    }
  }

  override fun unlink(path: String, promise: Promise) {
    scope.launch {
      try {
        val file = File(path)
        if (!file.exists()) throw RuntimeException("[FILE_NOT_FOUND] File does not exist: $path")
        if (!file.delete()) throw RuntimeException("[IO_ERROR] Failed to delete: $path")
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("ERR_FS", e.message, e)
      }
    }
  }

  override fun mkdir(path: String, promise: Promise) {
    scope.launch {
      try {
        val file = File(path)
        if (file.exists()) {
          if (!file.isDirectory) {
            throw RuntimeException("[INVALID_ARGUMENT] Path exists and is not a directory: $path")
          }
          promise.resolve(null)
          return@launch
        }
        if (!file.mkdirs()) throw RuntimeException("[IO_ERROR] Failed to create directory: $path")
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("ERR_FS", e.message, e)
      }
    }
  }

  override fun ls(path: String, promise: Promise) {
    scope.launch {
      try {
        val dir = File(path)
        if (!dir.exists()) throw RuntimeException("[FILE_NOT_FOUND] Directory does not exist: $path")
        if (!dir.isDirectory) throw RuntimeException("[NOT_A_DIRECTORY] Path is not a directory: $path")
        val arr = WritableNativeArray()
        (dir.listFiles() ?: emptyArray()).forEach { file ->
          val type = when {
            file.isFile -> "file"
            file.isDirectory -> "directory"
            else -> "unknown"
          }
          arr.pushMap(WritableNativeMap().apply {
            putString("path", file.absolutePath)
            putString("name", file.name)
            putDouble("size", (if (file.isFile) file.length() else 0L).toDouble())
            putString("type", type)
            putDouble("lastModified", file.lastModified().toDouble())
          })
        }
        promise.resolve(arr)
      } catch (e: Exception) {
        promise.reject("ERR_FS", e.message, e)
      }
    }
  }

  override fun cp(srcPath: String, destPath: String, promise: Promise) {
    scope.launch {
      try {
        val src = File(srcPath)
        if (!src.exists()) throw RuntimeException("[FILE_NOT_FOUND] Source does not exist: $srcPath")
        if (!src.isFile) throw RuntimeException("[INVALID_ARGUMENT] Source is not a file: $srcPath")
        val dest = File(destPath)
        dest.parentFile?.mkdirs()
        src.copyTo(dest, overwrite = true)
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("ERR_FS", e.message, e)
      }
    }
  }

  override fun mv(srcPath: String, destPath: String, promise: Promise) {
    scope.launch {
      try {
        val src = File(srcPath)
        if (!src.exists()) throw RuntimeException("[FILE_NOT_FOUND] Source does not exist: $srcPath")
        val dest = File(destPath)
        dest.parentFile?.mkdirs()
        if (!src.renameTo(dest)) {
          if (src.isFile) {
            src.copyTo(dest, overwrite = true)
            if (!src.delete()) {
              throw RuntimeException("[IO_ERROR] Move partially failed: copied but could not delete source: $srcPath")
            }
          } else {
            throw RuntimeException("[IO_ERROR] Failed to move: $srcPath")
          }
        }
        promise.resolve(null)
      } catch (e: Exception) {
        promise.reject("ERR_FS", e.message, e)
      }
    }
  }

  override fun hashFile(path: String, algorithm: String, promise: Promise) {
    scope.launch {
      try {
        val file = File(path)
        if (!file.exists()) throw RuntimeException("[FILE_NOT_FOUND] File does not exist: $path")
        if (!file.isFile) throw RuntimeException("[INVALID_ARGUMENT] Path is not a file: $path")
        val algoName = when (algorithm) {
          "sha256" -> "SHA-256"
          "md5" -> "MD5"
          else -> throw RuntimeException("[INVALID_ARGUMENT] Unknown algorithm: $algorithm")
        }
        val digest = MessageDigest.getInstance(algoName)
        FileInputStream(file).use { stream ->
          val buffer = ByteArray(HASH_CHUNK_SIZE)
          var bytesRead: Int
          while (stream.read(buffer).also { bytesRead = it } != -1) {
            digest.update(buffer, 0, bytesRead)
          }
        }
        promise.resolve(digest.digest().joinToString("") { "%02x".format(it) })
      } catch (e: Exception) {
        promise.reject("ERR_FS", e.message, e)
      }
    }
  }

  override fun invalidate() {
    scope.cancel()
    HandleRegistry.clear()
    super.invalidate()
  }
}
