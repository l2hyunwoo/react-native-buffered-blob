import NitroModules
import Foundation
import CommonCrypto

class HybridBufferedBlobModule: HybridBufferedBlobModuleSpec {
  private let fileManager = FileManager.default

  var documentDir: String {
    let paths = NSSearchPathForDirectoriesInDomains(.documentDirectory, .userDomainMask, true)
    return paths.first ?? ""
  }

  var cacheDir: String {
    let paths = NSSearchPathForDirectoriesInDomains(.cachesDirectory, .userDomainMask, true)
    return paths.first ?? ""
  }

  var tempDir: String {
    return NSTemporaryDirectory()
  }

  var downloadDir: String {
    if #available(iOS 16.0, *) {
      let paths = NSSearchPathForDirectoriesInDomains(.downloadsDirectory, .userDomainMask, true)
      return paths.first ?? documentDir
    } else {
      return documentDir
    }
  }

  override var memorySize: Int {
    return MemoryLayout<HybridBufferedBlobModule>.size
  }

  func openRead(path: String, bufferSize: Double) throws -> any HybridNativeFileReaderSpec {
    let size = Int(bufferSize)

    if size < 4096 || size > 67108864 {
      throw NSError(
        domain: "BufferedBlob",
        code: 1,
        userInfo: [NSLocalizedDescriptionKey: "[INVALID_ARGUMENT] Buffer size must be 4096-67108864: \(size)"]
      )
    }

    guard fileManager.fileExists(atPath: path) else {
      throw NSError(
        domain: "BufferedBlob",
        code: 2,
        userInfo: [NSLocalizedDescriptionKey: "[FILE_NOT_FOUND] File does not exist: \(path)"]
      )
    }

    let attrs = try fileManager.attributesOfItem(atPath: path)
    let fileSize = attrs[.size] as? Int64 ?? 0

    return try HybridNativeFileReader(path: path, bufferSize: size, fileSize: fileSize)
  }

  func openWrite(path: String, append: Bool) throws -> any HybridNativeFileWriterSpec {
    // Ensure parent directory exists
    let parentDir = (path as NSString).deletingLastPathComponent
    if !fileManager.fileExists(atPath: parentDir) {
      try fileManager.createDirectory(atPath: parentDir, withIntermediateDirectories: true, attributes: nil)
    }

    return try HybridNativeFileWriter(path: path, append: append)
  }

  func createDownload(url: String, destPath: String, headers: Dictionary<String, String>) throws -> any HybridNativeDownloaderSpec {
    // Ensure parent directory exists
    let parentDir = (destPath as NSString).deletingLastPathComponent
    if !fileManager.fileExists(atPath: parentDir) {
      try fileManager.createDirectory(atPath: parentDir, withIntermediateDirectories: true, attributes: nil)
    }

    return HybridNativeDownloader(url: url, destPath: destPath, headers: headers)
  }

  func exists(path: String) throws -> Promise<Bool> {
    return Promise.resolved(with: fileManager.fileExists(atPath: path))
  }

  func stat(path: String) throws -> Promise<FileInfo> {
    return Promise.async { [weak self] in
      guard let self = self else {
        throw NSError(
          domain: "BufferedBlob",
          code: 3,
          userInfo: [NSLocalizedDescriptionKey: "[INVALID_STATE] Module deallocated"]
        )
      }

      guard self.fileManager.fileExists(atPath: path) else {
        throw NSError(
          domain: "BufferedBlob",
          code: 2,
          userInfo: [NSLocalizedDescriptionKey: "[FILE_NOT_FOUND] File does not exist: \(path)"]
        )
      }

      let attrs = try self.fileManager.attributesOfItem(atPath: path)
      let size = attrs[.size] as? Int64 ?? 0
      let modDate = attrs[.modificationDate] as? Date ?? Date()
      let fileType = attrs[.type] as? FileAttributeType

      let type: FileType
      if fileType == .typeDirectory {
        type = .directory
      } else if fileType == .typeRegular {
        type = .file
      } else {
        type = .unknown
      }

      let name = (path as NSString).lastPathComponent

      return FileInfo(
        path: path,
        name: name,
        size: size,
        type: type,
        lastModified: modDate.timeIntervalSince1970 * 1000
      )
    }
  }

  func unlink(path: String) throws -> Promise<Void> {
    return Promise.async { [weak self] in
      guard let self = self else {
        throw NSError(
          domain: "BufferedBlob",
          code: 3,
          userInfo: [NSLocalizedDescriptionKey: "[INVALID_STATE] Module deallocated"]
        )
      }

      guard self.fileManager.fileExists(atPath: path) else {
        throw NSError(
          domain: "BufferedBlob",
          code: 2,
          userInfo: [NSLocalizedDescriptionKey: "[FILE_NOT_FOUND] File does not exist: \(path)"]
        )
      }

      try self.fileManager.removeItem(atPath: path)
    }
  }

  func mkdir(path: String) throws -> Promise<Void> {
    return Promise.async { [weak self] in
      guard let self = self else {
        throw NSError(domain: "BufferedBlob", code: 3,
          userInfo: [NSLocalizedDescriptionKey: "[INVALID_STATE] Module deallocated"])
      }

      var isDirectory: ObjCBool = false
      if self.fileManager.fileExists(atPath: path, isDirectory: &isDirectory) {
        if isDirectory.boolValue {
          return  // Already exists as directory, silently return
        }
        throw NSError(domain: "BufferedBlob", code: 5,
          userInfo: [NSLocalizedDescriptionKey: "[PATH_EXISTS] Path exists and is not a directory: \(path)"])
      }

      try self.fileManager.createDirectory(atPath: path, withIntermediateDirectories: true, attributes: nil)
    }
  }

  func ls(path: String) throws -> Promise<[FileInfo]> {
    return Promise.async { [weak self] in
      guard let self = self else {
        throw NSError(
          domain: "BufferedBlob",
          code: 3,
          userInfo: [NSLocalizedDescriptionKey: "[INVALID_STATE] Module deallocated"]
        )
      }

      guard self.fileManager.fileExists(atPath: path) else {
        throw NSError(
          domain: "BufferedBlob",
          code: 2,
          userInfo: [NSLocalizedDescriptionKey: "[FILE_NOT_FOUND] Directory does not exist: \(path)"]
        )
      }

      let contents = try self.fileManager.contentsOfDirectory(atPath: path)
      var results: [FileInfo] = []

      for item in contents {
        let fullPath = (path as NSString).appendingPathComponent(item)
        let attrs = try self.fileManager.attributesOfItem(atPath: fullPath)
        let size = attrs[.size] as? Int64 ?? 0
        let modDate = attrs[.modificationDate] as? Date ?? Date()
        let fileType = attrs[.type] as? FileAttributeType

        let type: FileType
        if fileType == .typeDirectory {
          type = .directory
        } else if fileType == .typeRegular {
          type = .file
        } else {
          type = .unknown
        }

        results.append(FileInfo(
          path: fullPath,
          name: item,
          size: size,
          type: type,
          lastModified: modDate.timeIntervalSince1970 * 1000
        ))
      }

      return results
    }
  }

  func cp(srcPath: String, destPath: String) throws -> Promise<Void> {
    return Promise.async { [weak self] in
      guard let self = self else {
        throw NSError(
          domain: "BufferedBlob",
          code: 3,
          userInfo: [NSLocalizedDescriptionKey: "[INVALID_STATE] Module deallocated"]
        )
      }

      guard self.fileManager.fileExists(atPath: srcPath) else {
        throw NSError(
          domain: "BufferedBlob",
          code: 2,
          userInfo: [NSLocalizedDescriptionKey: "[FILE_NOT_FOUND] Source file does not exist: \(srcPath)"]
        )
      }

      // Ensure parent directory exists
      let parentDir = (destPath as NSString).deletingLastPathComponent
      if !self.fileManager.fileExists(atPath: parentDir) {
        try self.fileManager.createDirectory(atPath: parentDir, withIntermediateDirectories: true, attributes: nil)
      }

      try self.fileManager.copyItem(atPath: srcPath, toPath: destPath)
    }
  }

  func mv(srcPath: String, destPath: String) throws -> Promise<Void> {
    return Promise.async { [weak self] in
      guard let self = self else {
        throw NSError(
          domain: "BufferedBlob",
          code: 3,
          userInfo: [NSLocalizedDescriptionKey: "[INVALID_STATE] Module deallocated"]
        )
      }

      guard self.fileManager.fileExists(atPath: srcPath) else {
        throw NSError(
          domain: "BufferedBlob",
          code: 2,
          userInfo: [NSLocalizedDescriptionKey: "[FILE_NOT_FOUND] Source file does not exist: \(srcPath)"]
        )
      }

      // Ensure parent directory exists
      let parentDir = (destPath as NSString).deletingLastPathComponent
      if !self.fileManager.fileExists(atPath: parentDir) {
        try self.fileManager.createDirectory(atPath: parentDir, withIntermediateDirectories: true, attributes: nil)
      }

      try self.fileManager.moveItem(atPath: srcPath, toPath: destPath)
    }
  }

  func hashFile(path: String, algorithm: HashAlgorithm) throws -> Promise<String> {
    return Promise.async { [weak self] in
      guard let self = self else {
        throw NSError(domain: "BufferedBlob", code: 3,
          userInfo: [NSLocalizedDescriptionKey: "[INVALID_STATE] Module deallocated"])
      }

      guard self.fileManager.fileExists(atPath: path) else {
        throw NSError(domain: "BufferedBlob", code: 2,
          userInfo: [NSLocalizedDescriptionKey: "[FILE_NOT_FOUND] File does not exist: \(path)"])
      }

      guard let inputStream = InputStream(fileAtPath: path) else {
        throw NSError(domain: "BufferedBlob", code: 6,
          userInfo: [NSLocalizedDescriptionKey: "[READ_ERROR] Could not open file for hashing: \(path)"])
      }

      inputStream.open()
      defer { inputStream.close() }

      let bufferSize = 8192
      let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
      defer { buffer.deallocate() }

      switch algorithm {
      case .sha256:
        var context = CC_SHA256_CTX()
        CC_SHA256_Init(&context)

        while inputStream.hasBytesAvailable {
          let bytesRead = inputStream.read(buffer, maxLength: bufferSize)
          if bytesRead < 0 {
            throw NSError(domain: "BufferedBlob", code: 6,
              userInfo: [NSLocalizedDescriptionKey: "[READ_ERROR] Error reading file for hashing: \(path)"])
          }
          if bytesRead == 0 { break }
          CC_SHA256_Update(&context, buffer, CC_LONG(bytesRead))
        }

        var digest = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        CC_SHA256_Final(&digest, &context)
        return digest.map { String(format: "%02x", $0) }.joined()

      case .md5:
        var context = CC_MD5_CTX()
        CC_MD5_Init(&context)

        while inputStream.hasBytesAvailable {
          let bytesRead = inputStream.read(buffer, maxLength: bufferSize)
          if bytesRead < 0 {
            throw NSError(domain: "BufferedBlob", code: 6,
              userInfo: [NSLocalizedDescriptionKey: "[READ_ERROR] Error reading file for hashing: \(path)"])
          }
          if bytesRead == 0 { break }
          CC_MD5_Update(&context, buffer, CC_LONG(bytesRead))
        }

        var digest = [UInt8](repeating: 0, count: Int(CC_MD5_DIGEST_LENGTH))
        CC_MD5_Final(&digest, &context)
        return digest.map { String(format: "%02x", $0) }.joined()
      }
    }
  }
}
