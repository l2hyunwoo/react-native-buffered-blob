import NitroModules
import Foundation

class HybridNativeFileReader: HybridNativeFileReaderSpec {
  private let inputStream: InputStream
  private let bufferSize: Int
  private var _bytesRead: Int64 = 0
  private let _fileSize: Int64
  private var _isEOF: Bool = false
  private var _isClosed: Bool = false
  private let queue: DispatchQueue

  var fileSize: Int64 {
    return _fileSize
  }

  var bytesRead: Int64 {
    return queue.sync { _bytesRead }
  }

  var isEOF: Bool {
    return queue.sync { _isEOF }
  }

  private var isClosed: Bool {
    get { queue.sync { _isClosed } }
    set { queue.sync { _isClosed = newValue } }
  }

  override var memorySize: Int {
    return bufferSize + MemoryLayout<HybridNativeFileReader>.size
  }

  init(path: String, bufferSize: Int, fileSize: Int64) throws {
    guard let stream = InputStream(fileAtPath: path) else {
      throw NSError(
        domain: "BufferedBlob",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "[FILE_NOT_FOUND] Could not open file: \(path)"]
      )
    }

    self.inputStream = stream
    self.bufferSize = bufferSize
    self._fileSize = fileSize
    self.queue = DispatchQueue(label: "com.bufferedblob.reader", qos: .userInitiated)

    super.init()

    stream.open()
    if stream.streamStatus == .error {
      throw NSError(
        domain: "BufferedBlob",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "[FILE_NOT_FOUND] Failed to open stream: \(path)"]
      )
    }
  }

  func readNextChunk() throws -> Promise<ArrayBuffer?> {
    if isClosed {
      throw NSError(
        domain: "BufferedBlob",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "[INVALID_STATE] Reader is closed"]
      )
    }

    if isEOF {
      return Promise.resolved(with: nil)
    }

    return Promise.async { [weak self] in
      guard let self = self else {
        throw NSError(
          domain: "BufferedBlob",
          code: 3,
          userInfo: [NSLocalizedDescriptionKey: "[INVALID_STATE] Reader deallocated"]
        )
      }

      return try await withCheckedThrowingContinuation { continuation in
        self.queue.async {
          do {
            let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: self.bufferSize)
            defer { buffer.deallocate() }

            let bytesRead = self.inputStream.read(buffer, maxLength: self.bufferSize)

            if bytesRead < 0 {
              self._isEOF = true
              continuation.resume(returning: nil)
              return
            }

            if bytesRead == 0 {
              self._isEOF = true
              continuation.resume(returning: nil)
              return
            }

            self._bytesRead += Int64(bytesRead)

            let data = Data(bytes: buffer, count: bytesRead)
            let arrayBuffer = ArrayBuffer(data: data)

            continuation.resume(returning: arrayBuffer)
          } catch {
            continuation.resume(throwing: error)
          }
        }
      }
    }
  }

  func close() throws {
    if isClosed {
      return
    }

    isClosed = true
    inputStream.close()
  }

  deinit {
    try? close()
  }
}
