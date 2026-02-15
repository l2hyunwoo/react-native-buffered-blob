package com.margelo.nitro.bufferedblob

import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.ArrayBuffer
import com.margelo.nitro.core.Promise
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import java.io.FileInputStream
import java.io.File

@DoNotStrip
class HybridNativeFileReader(
  private val filePath: String,
  private val bufferSize: Int
) : HybridNativeFileReaderSpec() {

  private val file = File(filePath)
  private var inputStream: FileInputStream? = null
  @Volatile private var _bytesRead: Long = 0
  @Volatile private var _isEOF: Boolean = false
  @Volatile private var isClosed: Boolean = false

  override val memorySize: Long
    get() = bufferSize.toLong()

  override val fileSize: Long
    get() = file.length()

  override val bytesRead: Long
    get() = _bytesRead

  override val isEOF: Boolean
    get() = _isEOF

  init {
    if (!file.exists()) {
      throw Exception("[FILE_NOT_FOUND] File does not exist: $filePath")
    }
    if (!file.isFile) {
      throw Exception("[INVALID_ARGUMENT] Path is not a file: $filePath")
    }
    inputStream = FileInputStream(file)
  }

  override fun readNextChunk(): Promise<ArrayBuffer?> {
    return Promise.async(CoroutineScope(Dispatchers.IO)) {
      synchronized(this) {
        if (isClosed) {
          throw Exception("[STREAM_CLOSED] FileReader already closed: $filePath")
        }
        if (_isEOF) {
          return@async null
        }

        val stream = inputStream ?: throw Exception("[STREAM_CLOSED] FileReader already closed: $filePath")
        val buffer = ByteArray(bufferSize)
        val bytesReadNow = stream.read(buffer)

        if (bytesReadNow == -1) {
          _isEOF = true
          return@async null
        }

        _bytesRead += bytesReadNow

        val result = ArrayBuffer.allocate(bytesReadNow)
        result.getBuffer(false).put(buffer, 0, bytesReadNow)

        return@async result
      }
    }
  }

  override fun close() {
    synchronized(this) {
      if (isClosed) {
        return
      }
      isClosed = true
      try {
        inputStream?.close()
      } catch (e: Exception) {
        // Ignore close errors
      } finally {
        inputStream = null
      }
    }
  }
}
