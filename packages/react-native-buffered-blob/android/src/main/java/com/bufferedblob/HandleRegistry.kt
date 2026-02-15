package com.bufferedblob

import java.io.Closeable
import java.io.FileInputStream
import java.io.FileOutputStream
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

object HandleRegistry {
  private val nextId = AtomicInteger(1)
  private val handles = ConcurrentHashMap<Int, Any>()

  fun register(obj: Any): Int {
    val id = nextId.getAndIncrement()
    handles[id] = obj
    return id
  }

  @Suppress("UNCHECKED_CAST")
  fun <T> get(id: Int): T? = handles[id] as? T

  fun remove(id: Int): Any? {
    val obj = handles.remove(id)
    if (obj is Closeable) {
      try { obj.close() } catch (_: Exception) {}
    }
    return obj
  }

  fun clear() {
    handles.keys.toList().forEach { remove(it) }
  }
}

data class ReaderHandle(
  val stream: FileInputStream,
  val bufferSize: Int,
  val fileSize: Long,
  @Volatile var bytesRead: Long = 0L,
  @Volatile var isEOF: Boolean = false,
  @Volatile var isClosed: Boolean = false
) : Closeable {
  override fun close() {
    if (!isClosed) {
      isClosed = true
      try { stream.close() } catch (_: Exception) {}
    }
  }
}

data class WriterHandle(
  val stream: FileOutputStream,
  @Volatile var bytesWritten: Long = 0L,
  @Volatile var isClosed: Boolean = false
) : Closeable {
  override fun close() {
    if (!isClosed) {
      isClosed = true
      try { stream.flush(); stream.close() } catch (_: Exception) {}
    }
  }
}

data class DownloaderHandle(
  val url: String,
  val destPath: String,
  val headers: Map<String, String>,
  @Volatile var isCancelled: Boolean = false,
  @Volatile var call: okhttp3.Call? = null
) : Closeable {
  fun cancel() {
    isCancelled = true
    call?.cancel()
  }
  override fun close() {
    cancel()
  }
}
