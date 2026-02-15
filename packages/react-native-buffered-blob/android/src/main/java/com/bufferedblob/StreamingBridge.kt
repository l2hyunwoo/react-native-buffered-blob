package com.bufferedblob

import okhttp3.Call
import okhttp3.Callback
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * Static bridge methods called from C++ via JNI.
 * All methods operate on handles from HandleRegistry.
 */
object StreamingBridge {

  private val httpClient = OkHttpClient.Builder()
    .connectTimeout(30, TimeUnit.SECONDS)
    .readTimeout(60, TimeUnit.SECONDS)
    .writeTimeout(60, TimeUnit.SECONDS)
    .build()

  /**
   * Read the next chunk from a ReaderHandle.
   * Returns null when EOF is reached.
   */
  @JvmStatic
  fun readNextChunk(handleId: Int): ByteArray? {
    val reader = HandleRegistry.get<ReaderHandle>(handleId)
      ?: throw RuntimeException("[READER_CLOSED] Reader handle not found: $handleId")

    if (reader.isClosed) throw RuntimeException("[READER_CLOSED] Reader is closed")
    if (reader.isEOF) return null

    val buffer = ByteArray(reader.bufferSize)
    val bytesRead = reader.stream.read(buffer)

    if (bytesRead == -1) {
      reader.isEOF = true
      return null
    }

    reader.bytesRead += bytesRead

    return if (bytesRead == buffer.size) {
      buffer
    } else {
      buffer.copyOf(bytesRead)
    }
  }

  /**
   * Write data to a WriterHandle.
   * Returns the number of bytes written.
   */
  @JvmStatic
  fun write(handleId: Int, data: ByteArray): Int {
    val writer = HandleRegistry.get<WriterHandle>(handleId)
      ?: throw RuntimeException("[WRITER_CLOSED] Writer handle not found: $handleId")

    if (writer.isClosed) throw RuntimeException("[WRITER_CLOSED] Writer is closed")

    writer.stream.write(data)
    writer.bytesWritten += data.size
    return data.size
  }

  /**
   * Flush a WriterHandle.
   */
  @JvmStatic
  fun flush(handleId: Int) {
    val writer = HandleRegistry.get<WriterHandle>(handleId)
      ?: throw RuntimeException("[WRITER_CLOSED] Writer handle not found: $handleId")

    if (writer.isClosed) throw RuntimeException("[WRITER_CLOSED] Writer is closed")

    writer.stream.flush()
  }

  /**
   * Close a handle (reader, writer, or downloader).
   */
  @JvmStatic
  fun close(handleId: Int) {
    HandleRegistry.remove(handleId)
  }

  /**
   * Start a download synchronously (blocking the calling thread).
   * Progress is not reported in this simple version.
   */
  @JvmStatic
  fun startDownload(handleId: Int) {
    val handle = HandleRegistry.get<DownloaderHandle>(handleId)
      ?: throw RuntimeException("[DOWNLOAD_FAILED] Download handle not found: $handleId")

    if (handle.isCancelled) {
      throw RuntimeException("[DOWNLOAD_CANCELLED] Download was cancelled")
    }

    val requestBuilder = Request.Builder().url(handle.url)
    for ((key, value) in handle.headers) {
      requestBuilder.addHeader(key, value)
    }
    val request = requestBuilder.build()

    val latch = CountDownLatch(1)
    @Volatile var downloadError: String? = null

    val call = httpClient.newCall(request)
    handle.call = call

    call.enqueue(object : Callback {
      override fun onFailure(call: Call, e: IOException) {
        if (handle.isCancelled) {
          downloadError = "[DOWNLOAD_CANCELLED] Download was cancelled"
        } else {
          downloadError = "[DOWNLOAD_FAILED] ${e.message}"
        }
        latch.countDown()
      }

      override fun onResponse(call: Call, response: Response) {
        if (!response.isSuccessful) {
          downloadError = "[DOWNLOAD_FAILED] HTTP ${response.code}"
          response.close()
          latch.countDown()
          return
        }

        try {
          val destFile = File(handle.destPath)
          destFile.parentFile?.mkdirs()

          response.body?.let { body ->
            FileOutputStream(destFile).use { fos ->
              val buffer = ByteArray(8192)
              var bytesRead: Int
              body.byteStream().use { inputStream ->
                while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                  if (handle.isCancelled) {
                    downloadError = "[DOWNLOAD_CANCELLED] Download was cancelled"
                    return@use
                  }
                  fos.write(buffer, 0, bytesRead)
                }
              }
            }
          } ?: run {
            downloadError = "[DOWNLOAD_FAILED] Empty response body"
          }
        } catch (e: Exception) {
          if (handle.isCancelled) {
            downloadError = "[DOWNLOAD_CANCELLED] Download was cancelled"
          } else {
            downloadError = "[DOWNLOAD_FAILED] ${e.message}"
          }
        } finally {
          response.close()
          latch.countDown()
        }
      }
    })

    // Block until download completes
    latch.await()

    downloadError?.let { throw RuntimeException(it) }
  }

  /**
   * Cancel a download.
   */
  @JvmStatic
  fun cancelDownload(handleId: Int) {
    val handle = HandleRegistry.get<DownloaderHandle>(handleId) ?: return
    handle.cancel()
  }

  // --- Reader info getters ---

  @JvmStatic
  fun getReaderFileSize(handleId: Int): Long {
    val reader = HandleRegistry.get<ReaderHandle>(handleId) ?: return 0L
    return reader.fileSize
  }

  @JvmStatic
  fun getReaderBytesRead(handleId: Int): Long {
    val reader = HandleRegistry.get<ReaderHandle>(handleId) ?: return 0L
    return reader.bytesRead
  }

  @JvmStatic
  fun getReaderIsEOF(handleId: Int): Boolean {
    val reader = HandleRegistry.get<ReaderHandle>(handleId) ?: return true
    return reader.isEOF
  }

  // --- Writer info getters ---

  @JvmStatic
  fun getWriterBytesWritten(handleId: Int): Long {
    val writer = HandleRegistry.get<WriterHandle>(handleId) ?: return 0L
    return writer.bytesWritten
  }

  interface DownloadCallback {
    fun onProgress(bytesDownloaded: Long, totalBytes: Long, progress: Double)
    fun onSuccess()
    fun onError(message: String)
  }
}
