import Foundation

@objc class ReaderHandleIOS: NSObject, HandleCloseable {
  let inputStream: InputStream
  let bufferSize: Int
  let fileSize: Int64
  var bytesRead: Int64 = 0
  var isEOF: Bool = false
  var isClosed: Bool = false
  private let queue = DispatchQueue(label: "com.bufferedblob.reader", qos: .userInitiated)

  init(path: String, bufferSize: Int) throws {
    guard let stream = InputStream(fileAtPath: path) else {
      throw NSError(domain: "BufferedBlob", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "[FILE_NOT_FOUND] Could not open file: \(path)"])
    }
    self.inputStream = stream
    self.bufferSize = bufferSize

    let fileManager = FileManager.default
    let attrs = try fileManager.attributesOfItem(atPath: path)
    self.fileSize = attrs[.size] as? Int64 ?? 0

    super.init()

    stream.open()
    if stream.streamStatus == .error {
      throw NSError(domain: "BufferedBlob", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "[FILE_NOT_FOUND] Failed to open stream: \(path)"])
    }
  }

  @objc func closeHandle() {
    guard !isClosed else { return }
    isClosed = true
    inputStream.close()
  }

  deinit {
    closeHandle()
  }
}

@objc class WriterHandleIOS: NSObject, HandleCloseable {
  let outputStream: OutputStream
  var bytesWritten: Int64 = 0
  var isClosed: Bool = false

  init(path: String, append: Bool) throws {
    guard let stream = OutputStream(toFileAtPath: path, append: append) else {
      throw NSError(domain: "BufferedBlob", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "[FILE_NOT_FOUND] Could not open file for writing: \(path)"])
    }
    self.outputStream = stream
    super.init()
    stream.open()
    if stream.streamStatus == .error {
      throw NSError(domain: "BufferedBlob", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "[FILE_NOT_FOUND] Failed to open write stream: \(path)"])
    }
  }

  @objc func closeHandle() {
    guard !isClosed else { return }
    isClosed = true
    outputStream.close()
  }

  deinit {
    closeHandle()
  }
}

@objc class DownloaderHandleIOS: NSObject, HandleCloseable {
  let url: String
  let destPath: String
  let headers: [String: String]
  var isCancelled: Bool = false

  init(url: String, destPath: String, headers: [String: String]) {
    self.url = url
    self.destPath = destPath
    self.headers = headers
    super.init()
  }

  func cancel() {
    isCancelled = true
  }

  @objc func closeHandle() {
    cancel()
  }
}
