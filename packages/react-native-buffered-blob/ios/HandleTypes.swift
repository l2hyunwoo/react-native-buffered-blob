import Foundation

@objc class ReaderHandleIOS: NSObject, HandleCloseable {
  private static var _nextId = 0
  private static let idLock = NSLock()
  private static func nextUniqueId() -> Int {
    idLock.lock()
    defer { idLock.unlock() }
    _nextId += 1
    return _nextId
  }

  @objc let inputStream: InputStream
  @objc let bufferSize: Int
  @objc let fileSize: Int64
  private var _bytesRead: Int64 = 0
  private var _isEOF: Bool = false
  private var _isClosed: Bool = false
  private let lock = NSLock()

  /// Serial queue for dispatching I/O operations from the C++ bridge.
  /// All readNextChunk calls are dispatched here to serialize access.
  @objc let queue: DispatchQueue

  @objc var bytesRead: Int64 {
    get { lock.lock(); defer { lock.unlock() }; return _bytesRead }
    set { lock.lock(); defer { lock.unlock() }; _bytesRead = newValue }
  }

  @objc var isEOF: Bool {
    get { lock.lock(); defer { lock.unlock() }; return _isEOF }
    set { lock.lock(); defer { lock.unlock() }; _isEOF = newValue }
  }

  @objc var isClosed: Bool {
    get { lock.lock(); defer { lock.unlock() }; return _isClosed }
    set { lock.lock(); defer { lock.unlock() }; _isClosed = newValue }
  }

  init(path: String, bufferSize: Int) throws {
    guard let stream = InputStream(fileAtPath: path) else {
      throw NSError(domain: "BufferedBlob", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "[FILE_NOT_FOUND] Could not open file: \(path)"])
    }
    self.inputStream = stream
    self.bufferSize = bufferSize
    self.queue = DispatchQueue(
      label: "com.bufferedblob.reader.\(Self.nextUniqueId())",
      qos: .userInitiated
    )

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
    lock.lock()
    defer { lock.unlock() }
    guard !_isClosed else { return }
    _isClosed = true
    inputStream.close()
  }

  deinit {
    closeHandle()
  }
}

@objc class WriterHandleIOS: NSObject, HandleCloseable {
  private static var _nextId = 0
  private static let idLock = NSLock()
  private static func nextUniqueId() -> Int {
    idLock.lock()
    defer { idLock.unlock() }
    _nextId += 1
    return _nextId
  }

  @objc let outputStream: OutputStream
  private var _bytesWritten: Int64 = 0
  private var _isClosed: Bool = false
  private let lock = NSLock()

  /// Serial queue for dispatching I/O operations from the C++ bridge.
  /// All write/flush calls are dispatched here to serialize access.
  @objc let queue: DispatchQueue

  @objc var bytesWritten: Int64 {
    get { lock.lock(); defer { lock.unlock() }; return _bytesWritten }
    set { lock.lock(); defer { lock.unlock() }; _bytesWritten = newValue }
  }

  @objc var isClosed: Bool {
    get { lock.lock(); defer { lock.unlock() }; return _isClosed }
    set { lock.lock(); defer { lock.unlock() }; _isClosed = newValue }
  }

  init(path: String, append: Bool) throws {
    guard let stream = OutputStream(toFileAtPath: path, append: append) else {
      throw NSError(domain: "BufferedBlob", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "[FILE_NOT_FOUND] Could not open file for writing: \(path)"])
    }
    self.outputStream = stream
    self.queue = DispatchQueue(
      label: "com.bufferedblob.writer.\(Self.nextUniqueId())",
      qos: .userInitiated
    )
    super.init()
    stream.open()
    if stream.streamStatus == .error {
      throw NSError(domain: "BufferedBlob", code: 1,
        userInfo: [NSLocalizedDescriptionKey: "[FILE_NOT_FOUND] Failed to open write stream: \(path)"])
    }
  }

  @objc func closeHandle() {
    lock.lock()
    defer { lock.unlock() }
    guard !_isClosed else { return }
    _isClosed = true
    outputStream.close()
  }

  deinit {
    closeHandle()
  }
}

@objc class DownloaderHandleIOS: NSObject, HandleCloseable {
  private static var _nextId = 0
  private static let idLock = NSLock()
  private static func nextUniqueId() -> Int {
    idLock.lock()
    defer { idLock.unlock() }
    _nextId += 1
    return _nextId
  }

  let url: String
  let destPath: String
  let headers: [String: String]
  private var _isCancelled: Bool = false
  private var _session: URLSession?
  private var _task: URLSessionTask?
  private let lock = NSLock()

  /// Serial queue exposed for future use if needed.
  @objc let queue: DispatchQueue

  @objc var isCancelled: Bool {
    get { lock.lock(); defer { lock.unlock() }; return _isCancelled }
    set { lock.lock(); defer { lock.unlock() }; _isCancelled = newValue }
  }

  init(url: String, destPath: String, headers: [String: String]) {
    self.url = url
    self.destPath = destPath
    self.headers = headers
    self.queue = DispatchQueue(
      label: "com.bufferedblob.downloader.\(Self.nextUniqueId())",
      qos: .userInitiated
    )
    super.init()
  }

  @objc func storeSession(_ session: URLSession, task: URLSessionTask) {
    lock.lock()
    defer { lock.unlock() }
    _session = session
    _task = task
  }

  @objc func cancel() {
    lock.lock()
    guard !_isCancelled else { lock.unlock(); return }
    _isCancelled = true
    let session = _session
    let task = _task
    lock.unlock()
    // Cancel outside the lock to avoid potential deadlock with delegate callbacks
    task?.cancel()
    session?.invalidateAndCancel()
  }

  @objc func closeHandle() {
    cancel()
  }
}
