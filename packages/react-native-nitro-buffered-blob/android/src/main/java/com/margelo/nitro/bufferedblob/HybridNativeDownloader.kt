package com.margelo.nitro.bufferedblob

import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.core.Promise
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Response
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.concurrent.TimeUnit
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

@DoNotStrip
class HybridNativeDownloader(
  private val url: String,
  private val destPath: String,
  private val headers: Map<String, String>
) : HybridNativeDownloaderSpec() {

  companion object {
    private val client = OkHttpClient.Builder()
      .connectTimeout(30, TimeUnit.SECONDS)
      .readTimeout(30, TimeUnit.SECONDS)
      .writeTimeout(30, TimeUnit.SECONDS)
      .build()
  }

  private var call: Call? = null
  @Volatile private var _isCancelled: Boolean = false

  override val isCancelled: Boolean
    get() = _isCancelled

  override fun start(onProgress: (progress: DownloadProgress) -> Unit): Promise<Unit> {
    return Promise.async(Dispatchers.IO) {
      if (_isCancelled) {
        throw Exception("[DOWNLOAD_CANCELLED] Download was cancelled: $url")
      }

      val requestBuilder = Request.Builder().url(url)
      headers.forEach { (key, value) ->
        requestBuilder.addHeader(key, value)
      }
      val request = requestBuilder.build()
      val currentCall = client.newCall(request)

      synchronized(this@HybridNativeDownloader) {
        call = currentCall
      }

      suspendCancellableCoroutine<Unit> { cont ->
        cont.invokeOnCancellation {
          currentCall.cancel()
        }

        currentCall.enqueue(object : Callback {
          override fun onFailure(call: Call, e: IOException) {
            synchronized(this@HybridNativeDownloader) {
              this@HybridNativeDownloader.call = null
            }
            if (_isCancelled) {
              cont.resumeWithException(Exception("[DOWNLOAD_CANCELLED] Download was cancelled: $url"))
            } else {
              cont.resumeWithException(Exception("[DOWNLOAD_FAILED] ${e.message}: $url"))
            }
          }

          override fun onResponse(call: Call, response: Response) {
            try {
              if (!response.isSuccessful) {
                synchronized(this@HybridNativeDownloader) {
                  this@HybridNativeDownloader.call = null
                }
                cont.resumeWithException(Exception("[DOWNLOAD_FAILED] HTTP ${response.code}: ${response.message}"))
                return
              }

              val body = response.body ?: run {
                synchronized(this@HybridNativeDownloader) {
                  this@HybridNativeDownloader.call = null
                }
                cont.resumeWithException(Exception("[DOWNLOAD_FAILED] Empty response body"))
                return
              }

              val totalBytes = body.contentLength()
              var bytesDownloaded = 0L

              val destFile = File(destPath)
              destFile.parentFile?.mkdirs()

              FileOutputStream(destFile).use { outputStream ->
                body.byteStream().use { inputStream ->
                  val buffer = ByteArray(8192)
                  var bytesRead: Int

                  while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                    if (_isCancelled) {
                      synchronized(this@HybridNativeDownloader) {
                        this@HybridNativeDownloader.call = null
                      }
                      cont.resumeWithException(Exception("[DOWNLOAD_CANCELLED] Download was cancelled: $url"))
                      return
                    }

                    outputStream.write(buffer, 0, bytesRead)
                    bytesDownloaded += bytesRead

                    val progress = if (totalBytes > 0) {
                      bytesDownloaded.toDouble() / totalBytes.toDouble()
                    } else {
                      0.0
                    }

                    onProgress(DownloadProgress(bytesDownloaded, totalBytes, progress))
                  }
                }
              }

              val finalProgress = if (totalBytes > 0) 1.0 else 0.0
              onProgress(DownloadProgress(bytesDownloaded, totalBytes, finalProgress))

              synchronized(this@HybridNativeDownloader) {
                this@HybridNativeDownloader.call = null
              }
              cont.resume(Unit)
            } catch (e: Exception) {
              synchronized(this@HybridNativeDownloader) {
                this@HybridNativeDownloader.call = null
              }
              if (_isCancelled) {
                cont.resumeWithException(Exception("[DOWNLOAD_CANCELLED] Download was cancelled: $url"))
              } else {
                cont.resumeWithException(Exception("[DOWNLOAD_FAILED] ${e.message}: $url"))
              }
            }
          }
        })
      }
    }
  }

  override fun cancel() {
    synchronized(this) {
      _isCancelled = true
      call?.cancel()
      call = null
    }
  }
}
