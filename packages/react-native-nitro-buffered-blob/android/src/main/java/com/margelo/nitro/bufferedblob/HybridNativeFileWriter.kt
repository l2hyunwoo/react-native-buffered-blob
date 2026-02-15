package com.margelo.nitro.bufferedblob

import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.ArrayBuffer
import com.margelo.nitro.core.Promise
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.FileOutputStream
import java.io.File

@DoNotStrip
class HybridNativeFileWriter(
  private val filePath: String,
  private val append: Boolean
) : HybridNativeFileWriterSpec() {

  private var outputStream: FileOutputStream? = null
  @Volatile private var _bytesWritten: Long = 0
  @Volatile private var isClosed: Boolean = false

  override val bytesWritten: Long
    get() = _bytesWritten

  init {
    val file = File(filePath)
    // Create parent directories if they don't exist
    file.parentFile?.mkdirs()
    outputStream = FileOutputStream(file, append)
  }

  override fun write(data: ArrayBuffer): Promise<Long> {
    return Promise.async(Dispatchers.IO) {
      synchronized(this) {
        if (isClosed) {
          throw Exception("[STREAM_CLOSED] FileWriter already closed: $filePath")
        }

        val stream = outputStream ?: throw Exception("[STREAM_CLOSED] FileWriter already closed: $filePath")

        // CRITICAL: Copy data from non-owning JS ArrayBuffer before async use
        val bytes = ByteArray(data.size)
        data.read(bytes, 0, data.size)

        stream.write(bytes)
        _bytesWritten += bytes.size.toLong()

        return@async bytes.size.toLong()
      }
    }
  }

  override fun flush(): Promise<Unit> {
    return Promise.async(Dispatchers.IO) {
      synchronized(this) {
        if (isClosed) {
          throw Exception("[STREAM_CLOSED] FileWriter already closed: $filePath")
        }

        val stream = outputStream ?: throw Exception("[STREAM_CLOSED] FileWriter already closed: $filePath")
        stream.flush()
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
        outputStream?.flush()
        outputStream?.close()
      } catch (e: Exception) {
        // Ignore close errors
      } finally {
        outputStream = null
      }
    }
  }
}
