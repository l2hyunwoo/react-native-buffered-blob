import NitroModules
import Foundation

class HybridNativeDownloader: NSObject, HybridNativeDownloaderSpec, URLSessionDataDelegate {
  private let url: String
  private let destPath: String
  private let headers: [String: String]
  private var outputStream: OutputStream?
  private var session: URLSession?
  private var dataTask: URLSessionDataTask?
  private var _isCancelled: Bool = false
  private var onProgressCallback: ((_ progress: DownloadProgress) -> Void)?
  private var totalBytes: Int64 = 0
  private var downloadedBytes: Int64 = 0
  private var continuation: CheckedContinuation<Void, Error>?
  private let continuationLock = NSLock()

  var isCancelled: Bool {
    return _isCancelled
  }

  override var memorySize: Int {
    return MemoryLayout<HybridNativeDownloader>.size
  }

  init(url: String, destPath: String, headers: [String: String]) {
    self.url = url
    self.destPath = destPath
    self.headers = headers
    super.init()

    let config = URLSessionConfiguration.default
    self.session = URLSession(configuration: config, delegate: self, delegateQueue: nil)
  }

  func start(onProgress: @escaping (_ progress: DownloadProgress) -> Void) throws -> Promise<Void> {
    if _isCancelled {
      throw NSError(
        domain: "BufferedBlob",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "[INVALID_STATE] Download already cancelled"]
      )
    }

    if dataTask != nil {
      throw NSError(
        domain: "BufferedBlob",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "[INVALID_STATE] Download already started"]
      )
    }

    self.onProgressCallback = onProgress

    return Promise.async { [weak self] in
      guard let self = self else {
        throw NSError(
          domain: "BufferedBlob",
          code: 3,
          userInfo: [NSLocalizedDescriptionKey: "[INVALID_STATE] Downloader deallocated"]
        )
      }

      return try await withCheckedThrowingContinuation { continuation in
        self.continuationLock.lock()
        self.continuation = continuation
        self.continuationLock.unlock()

        guard let url = URL(string: self.url) else {
          self.resumeContinuation(with: .failure(NSError(
            domain: "BufferedBlob",
            code: 4,
            userInfo: [NSLocalizedDescriptionKey: "[INVALID_ARGUMENT] Invalid URL: \(self.url)"]
          )))
          return
        }

        guard let stream = OutputStream(toFileAtPath: self.destPath, append: false) else {
          self.resumeContinuation(with: .failure(NSError(
            domain: "BufferedBlob",
            code: 5,
            userInfo: [NSLocalizedDescriptionKey: "[FILE_NOT_FOUND] Could not create output stream: \(self.destPath)"]
          )))
          return
        }

        self.outputStream = stream
        stream.open()

        if stream.streamStatus == .error {
          self.resumeContinuation(with: .failure(NSError(
            domain: "BufferedBlob",
            code: 5,
            userInfo: [NSLocalizedDescriptionKey: "[FILE_NOT_FOUND] Failed to open output stream: \(self.destPath)"]
          )))
          return
        }

        var request = URLRequest(url: url)
        for (key, value) in self.headers {
          request.setValue(value, forHTTPHeaderField: key)
        }

        self.dataTask = self.session?.dataTask(with: request)
        self.dataTask?.resume()
      }
    }
  }

  func cancel() throws {
    _isCancelled = true
    dataTask?.cancel()
    outputStream?.close()
    outputStream = nil
  }

  private func resumeContinuation(with result: Result<Void, Error>) {
    continuationLock.lock()
    let cont = continuation
    continuation = nil
    continuationLock.unlock()

    switch result {
    case .success:
      cont?.resume()
    case .failure(let error):
      cont?.resume(throwing: error)
    }
  }

  // URLSessionDataDelegate methods
  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse, completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
    if let httpResponse = response as? HTTPURLResponse {
      if httpResponse.statusCode >= 400 {
        completionHandler(.cancel)
        resumeContinuation(with: .failure(NSError(
          domain: "BufferedBlob",
          code: 6,
          userInfo: [NSLocalizedDescriptionKey: "[DOWNLOAD_ERROR] HTTP error \(httpResponse.statusCode): \(url)"]
        )))
        return
      }
    }

    totalBytes = response.expectedContentLength
    completionHandler(.allow)
  }

  func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
    guard let stream = outputStream, !_isCancelled else { return }

    data.withUnsafeBytes { (bytes: UnsafeRawBufferPointer) in
      guard let baseAddress = bytes.baseAddress else { return }
      let buffer = baseAddress.assumingMemoryBound(to: UInt8.self)
      var offset = 0
      let totalToWrite = data.count

      while offset < totalToWrite {
        let remaining = totalToWrite - offset
        let bytesWritten = stream.write(buffer + offset, maxLength: remaining)

        if bytesWritten < 0 {
          break
        }

        if bytesWritten == 0 {
          break
        }

        offset += bytesWritten
      }
    }

    downloadedBytes += Int64(data.count)

    let progress: Double
    if totalBytes > 0 {
      progress = Double(downloadedBytes) / Double(totalBytes)
    } else {
      progress = 0.0
    }

    let downloadProgress = DownloadProgress(
      bytesDownloaded: downloadedBytes,
      totalBytes: totalBytes,
      progress: progress
    )

    onProgressCallback?(downloadProgress)
  }

  func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
    outputStream?.close()
    outputStream = nil

    if let error = error {
      if _isCancelled {
        resumeContinuation(with: .failure(NSError(
          domain: "BufferedBlob",
          code: 7,
          userInfo: [NSLocalizedDescriptionKey: "[DOWNLOAD_CANCELLED] Download was cancelled"]
        )))
      } else {
        resumeContinuation(with: .failure(NSError(
          domain: "BufferedBlob",
          code: 8,
          userInfo: [NSLocalizedDescriptionKey: "[DOWNLOAD_ERROR] Download failed: \(error.localizedDescription)"]
        )))
      }
    } else {
      resumeContinuation(with: .success(()))
    }
  }

  deinit {
    try? cancel()
  }
}
