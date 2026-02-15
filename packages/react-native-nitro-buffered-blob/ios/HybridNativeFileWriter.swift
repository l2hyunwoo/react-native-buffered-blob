import NitroModules
import Foundation

class HybridNativeFileWriter: HybridNativeFileWriterSpec {
  private let outputStream: OutputStream
  private var _bytesWritten: Int64 = 0
  private var _isClosed: Bool = false
  private let queue: DispatchQueue

  var bytesWritten: Int64 {
    return queue.sync { _bytesWritten }
  }

  private var isClosed: Bool {
    get { queue.sync { _isClosed } }
    set { queue.sync { _isClosed = newValue } }
  }

  var memorySize: Int {
    return MemoryLayout<HybridNativeFileWriter>.size
  }

  init(path: String, append: Bool) throws {
    guard let stream = OutputStream(toFileAtPath: path, append: append) else {
      throw NSError(
        domain: "BufferedBlob",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "[FILE_NOT_FOUND] Could not open file for writing: \(path)"]
      )
    }

    self.outputStream = stream
    self.queue = DispatchQueue(label: "com.bufferedblob.writer", qos: .userInitiated)

    super.init()

    stream.open()
    if stream.streamStatus == .error {
      throw NSError(
        domain: "BufferedBlob",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "[FILE_NOT_FOUND] Failed to open write stream: \(path)"]
      )
    }
  }

  func write(data: ArrayBuffer) throws -> Promise<Int64> {
    if isClosed {
      throw NSError(
        domain: "BufferedBlob",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "[INVALID_STATE] Writer is closed"]
      )
    }

    // Copy the ArrayBuffer data synchronously before dispatching to background queue.
    // JS ArrayBuffers are non-owning and their memory is only valid in the synchronous scope.
    let ownedData = data.asOwning()

    return Promise.async { [weak self] in
      guard let self = self else {
        throw NSError(
          domain: "BufferedBlob",
          code: 3,
          userInfo: [NSLocalizedDescriptionKey: "[INVALID_STATE] Writer deallocated"]
        )
      }

      return try await withCheckedThrowingContinuation { continuation in
        self.queue.async {
          let buffer = ownedData.data
          let totalBytes = ownedData.size

          guard totalBytes > 0 else {
            continuation.resume(returning: 0)
            return
          }

          var offset = 0
          var totalWritten = 0

          while offset < totalBytes {
            let remaining = totalBytes - offset
            let bytesWritten = self.outputStream.write(buffer + offset, maxLength: remaining)

            if bytesWritten < 0 {
              continuation.resume(throwing: NSError(
                domain: "BufferedBlob",
                code: 5,
                userInfo: [NSLocalizedDescriptionKey: "[WRITE_ERROR] Stream write failed"]
              ))
              return
            }

            if bytesWritten == 0 {
              continuation.resume(throwing: NSError(
                domain: "BufferedBlob",
                code: 5,
                userInfo: [NSLocalizedDescriptionKey: "[WRITE_ERROR] Stream write returned 0 bytes - stream may be full"]
              ))
              return
            }

            offset += bytesWritten
            totalWritten += bytesWritten
          }

          self._bytesWritten += Int64(totalWritten)
          continuation.resume(returning: Int64(totalWritten))
        }
      }
    }
  }

  func flush() throws -> Promise<Void> {
    // iOS OutputStream writes are immediate, no buffering to flush
    return Promise.resolved()
  }

  func close() throws {
    if isClosed {
      return
    }

    isClosed = true
    outputStream.close()
  }

  deinit {
    try? close()
  }
}
