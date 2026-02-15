package com.margelo.nitro.bufferedblob

import android.os.Environment
import com.facebook.proguard.annotations.DoNotStrip
import com.facebook.react.bridge.ReactApplicationContext
import com.margelo.nitro.core.Promise
import kotlinx.coroutines.Dispatchers
import java.io.File
import java.io.FileInputStream
import java.security.MessageDigest

@DoNotStrip
class HybridBufferedBlobModule(
  private val reactContext: ReactApplicationContext
) : HybridBufferedBlobModuleSpec() {

  companion object {
    private const val MIN_BUFFER_SIZE = 4096
    private const val MAX_BUFFER_SIZE = 67108864 // 64MB
    private const val HASH_CHUNK_SIZE = 8192
  }

  // Directory paths
  override val documentDir: String
    get() = reactContext.filesDir.absolutePath

  override val cacheDir: String
    get() = reactContext.cacheDir.absolutePath

  override val tempDir: String
    get() = System.getProperty("java.io.tmpdir") ?: reactContext.cacheDir.absolutePath

  override val downloadDir: String
    get() = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS).absolutePath

  // Stream Factories
  override fun openRead(path: String, bufferSize: Double): HybridNativeFileReaderSpec {
    val bufferSizeInt = bufferSize.toInt()

    if (bufferSizeInt < MIN_BUFFER_SIZE || bufferSizeInt > MAX_BUFFER_SIZE) {
      throw Exception("[INVALID_ARGUMENT] Buffer size must be $MIN_BUFFER_SIZE-$MAX_BUFFER_SIZE: $bufferSizeInt")
    }

    val file = File(path)
    if (!file.exists()) {
      throw Exception("[FILE_NOT_FOUND] File does not exist: $path")
    }
    if (!file.isFile) {
      throw Exception("[INVALID_ARGUMENT] Path is not a file: $path")
    }

    return HybridNativeFileReader(path, bufferSizeInt)
  }

  override fun openWrite(path: String, append: Boolean): HybridNativeFileWriterSpec {
    return HybridNativeFileWriter(path, append)
  }

  override fun createDownload(
    url: String,
    destPath: String,
    headers: Map<String, String>
  ): HybridNativeDownloaderSpec {
    return HybridNativeDownloader(url, destPath, headers)
  }

  // File System Operations
  override fun exists(path: String): Promise<Boolean> {
    return Promise.async(Dispatchers.IO) {
      File(path).exists()
    }
  }

  override fun stat(path: String): Promise<FileInfo> {
    return Promise.async(Dispatchers.IO) {
      val file = File(path)
      if (!file.exists()) {
        throw Exception("[FILE_NOT_FOUND] File does not exist: $path")
      }

      val type = when {
        file.isFile -> FileType.FILE
        file.isDirectory -> FileType.DIRECTORY
        else -> FileType.UNKNOWN
      }

      FileInfo(
        path = file.absolutePath,
        name = file.name,
        size = if (file.isFile) file.length() else 0L,
        type = type,
        lastModified = file.lastModified().toDouble()
      )
    }
  }

  override fun unlink(path: String): Promise<Unit> {
    return Promise.async(Dispatchers.IO) {
      val file = File(path)
      if (!file.exists()) {
        throw Exception("[FILE_NOT_FOUND] File does not exist: $path")
      }
      if (!file.delete()) {
        throw Exception("[DELETE_FAILED] Failed to delete file: $path")
      }
    }
  }

  override fun mkdir(path: String): Promise<Unit> {
    return Promise.async(Dispatchers.IO) {
      val file = File(path)
      if (file.exists()) {
        if (!file.isDirectory) {
          throw Exception("[PATH_EXISTS] Path exists and is not a directory: $path")
        }
        return@async
      }
      if (!file.mkdirs()) {
        throw Exception("[MKDIR_FAILED] Failed to create directory: $path")
      }
    }
  }

  override fun ls(path: String): Promise<Array<FileInfo>> {
    return Promise.async(Dispatchers.IO) {
      val dir = File(path)
      if (!dir.exists()) {
        throw Exception("[FILE_NOT_FOUND] Directory does not exist: $path")
      }
      if (!dir.isDirectory) {
        throw Exception("[NOT_DIRECTORY] Path is not a directory: $path")
      }

      val files = dir.listFiles() ?: emptyArray()
      files.map { file ->
        val type = when {
          file.isFile -> FileType.FILE
          file.isDirectory -> FileType.DIRECTORY
          else -> FileType.UNKNOWN
        }

        FileInfo(
          path = file.absolutePath,
          name = file.name,
          size = if (file.isFile) file.length() else 0L,
          type = type,
          lastModified = file.lastModified().toDouble()
        )
      }.toTypedArray()
    }
  }

  override fun cp(srcPath: String, destPath: String): Promise<Unit> {
    return Promise.async(Dispatchers.IO) {
      val srcFile = File(srcPath)
      if (!srcFile.exists()) {
        throw Exception("[FILE_NOT_FOUND] Source file does not exist: $srcPath")
      }
      if (!srcFile.isFile) {
        throw Exception("[INVALID_ARGUMENT] Source path is not a file: $srcPath")
      }

      val destFile = File(destPath)
      destFile.parentFile?.mkdirs()

      srcFile.copyTo(destFile, overwrite = true)
    }
  }

  override fun mv(srcPath: String, destPath: String): Promise<Unit> {
    return Promise.async(Dispatchers.IO) {
      val srcFile = File(srcPath)
      if (!srcFile.exists()) {
        throw Exception("[FILE_NOT_FOUND] Source file does not exist: $srcPath")
      }

      val destFile = File(destPath)
      destFile.parentFile?.mkdirs()

      if (!srcFile.renameTo(destFile)) {
        // Fallback to copy + delete if rename fails (e.g., across filesystems)
        if (srcFile.isFile) {
          srcFile.copyTo(destFile, overwrite = true)
          if (!srcFile.delete()) {
            throw Exception("[IO_ERROR] Move partially failed: copied but could not delete source: $srcPath")
          }
        } else {
          throw Exception("[MOVE_FAILED] Failed to move file: $srcPath")
        }
      }
    }
  }

  // Hashing
  override fun hashFile(path: String, algorithm: HashAlgorithm): Promise<String> {
    return Promise.async(Dispatchers.IO) {
      val file = File(path)
      if (!file.exists()) {
        throw Exception("[FILE_NOT_FOUND] File does not exist: $path")
      }
      if (!file.isFile) {
        throw Exception("[INVALID_ARGUMENT] Path is not a file: $path")
      }

      val algorithmName = when (algorithm) {
        HashAlgorithm.SHA256 -> "SHA-256"
        HashAlgorithm.MD5 -> "MD5"
      }

      val digest = MessageDigest.getInstance(algorithmName)
      FileInputStream(file).use { inputStream ->
        val buffer = ByteArray(HASH_CHUNK_SIZE)
        var bytesRead: Int

        while (inputStream.read(buffer).also { bytesRead = it } != -1) {
          digest.update(buffer, 0, bytesRead)
        }
      }

      // Convert to hex string
      digest.digest().joinToString("") { "%02x".format(it) }
    }
  }
}
