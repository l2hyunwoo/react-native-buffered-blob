import Foundation
import CommonCrypto

@objc(BufferedBlobModule)
class BufferedBlobModule: NSObject {
  private let fileManager = FileManager.default

  @objc static func moduleName() -> String! {
    return "BufferedBlob"
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }

  @objc func constantsToExport() -> [AnyHashable: Any]! {
    let docDir: String = {
      let paths = NSSearchPathForDirectoriesInDomains(.documentDirectory, .userDomainMask, true)
      return paths.first ?? ""
    }()
    let cacheDir: String = {
      let paths = NSSearchPathForDirectoriesInDomains(.cachesDirectory, .userDomainMask, true)
      return paths.first ?? ""
    }()
    let tempDir = NSTemporaryDirectory()
    let downloadDir: String = {
      if #available(iOS 16.0, *) {
        let paths = NSSearchPathForDirectoriesInDomains(.downloadsDirectory, .userDomainMask, true)
        return paths.first ?? docDir
      }
      return docDir
    }()

    return [
      "documentDir": docDir,
      "cacheDir": cacheDir,
      "tempDir": tempDir,
      "downloadDir": downloadDir
    ]
  }

  // --- Handle Factories ---
  @objc func openRead(_ path: String, bufferSize: Double) -> NSNumber {
    do {
      let size = Int(bufferSize)
      if size < 4096 || size > 67108864 {
        throw NSError(domain: "BufferedBlob", code: 1,
          userInfo: [NSLocalizedDescriptionKey: "[INVALID_ARGUMENT] Buffer size must be 4096-67108864: \(size)"])
      }
      guard fileManager.fileExists(atPath: path) else {
        throw NSError(domain: "BufferedBlob", code: 2,
          userInfo: [NSLocalizedDescriptionKey: "[FILE_NOT_FOUND] File does not exist: \(path)"])
      }
      let reader = try ReaderHandleIOS(path: path, bufferSize: size)
      let handleId = HandleRegistry.shared.register(reader)
      return NSNumber(value: handleId)
    } catch {
      return NSNumber(value: -1)
    }
  }

  @objc func openWrite(_ path: String, append: Bool) -> NSNumber {
    do {
      let parentDir = (path as NSString).deletingLastPathComponent
      if !fileManager.fileExists(atPath: parentDir) {
        try fileManager.createDirectory(atPath: parentDir, withIntermediateDirectories: true, attributes: nil)
      }
      let writer = try WriterHandleIOS(path: path, append: append)
      let handleId = HandleRegistry.shared.register(writer)
      return NSNumber(value: handleId)
    } catch {
      return NSNumber(value: -1)
    }
  }

  @objc func createDownload(_ url: String, destPath: String, headers: NSDictionary) -> NSNumber {
    let parentDir = (destPath as NSString).deletingLastPathComponent
    if !fileManager.fileExists(atPath: parentDir) {
      try? fileManager.createDirectory(atPath: parentDir, withIntermediateDirectories: true, attributes: nil)
    }
    var headerMap: [String: String] = [:]
    for (key, value) in headers {
      if let k = key as? String, let v = value as? String {
        headerMap[k] = v
      }
    }
    let handle = DownloaderHandleIOS(url: url, destPath: destPath, headers: headerMap)
    let handleId = HandleRegistry.shared.register(handle)
    return NSNumber(value: handleId)
  }

  @objc func closeHandle(_ handleId: Double) {
    HandleRegistry.shared.remove(Int(handleId))
  }

  // --- FS Operations ---
  @objc func exists(_ path: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    resolve(fileManager.fileExists(atPath: path))
  }

  @objc func stat(_ path: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      guard let self = self else {
        reject("ERR_FS", "Module deallocated", nil)
        return
      }
      guard self.fileManager.fileExists(atPath: path) else {
        reject("ERR_FS", "[FILE_NOT_FOUND] File does not exist: \(path)", nil)
        return
      }
      do {
        let attrs = try self.fileManager.attributesOfItem(atPath: path)
        let size = attrs[.size] as? Int64 ?? 0
        let modDate = attrs[.modificationDate] as? Date ?? Date()
        let fileType = attrs[.type] as? FileAttributeType
        let type: String
        if fileType == .typeDirectory { type = "directory" }
        else if fileType == .typeRegular { type = "file" }
        else { type = "unknown" }
        let name = (path as NSString).lastPathComponent
        resolve([
          "path": path,
          "name": name,
          "size": NSNumber(value: size),
          "type": type,
          "lastModified": NSNumber(value: modDate.timeIntervalSince1970 * 1000)
        ])
      } catch {
        reject("ERR_FS", error.localizedDescription, error)
      }
    }
  }

  @objc func unlink(_ path: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      guard let self = self else { reject("ERR_FS", "Module deallocated", nil); return }
      guard self.fileManager.fileExists(atPath: path) else {
        reject("ERR_FS", "[FILE_NOT_FOUND] File does not exist: \(path)", nil); return
      }
      do {
        try self.fileManager.removeItem(atPath: path)
        resolve(nil)
      } catch {
        reject("ERR_FS", error.localizedDescription, error)
      }
    }
  }

  @objc func mkdir(_ path: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      guard let self = self else { reject("ERR_FS", "Module deallocated", nil); return }
      var isDir: ObjCBool = false
      if self.fileManager.fileExists(atPath: path, isDirectory: &isDir) {
        if isDir.boolValue {
          resolve(nil); return
        }
        reject("ERR_FS", "[PATH_EXISTS] Path exists and is not a directory: \(path)", nil); return
      }
      do {
        try self.fileManager.createDirectory(atPath: path, withIntermediateDirectories: true, attributes: nil)
        resolve(nil)
      } catch {
        reject("ERR_FS", error.localizedDescription, error)
      }
    }
  }

  @objc func ls(_ path: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      guard let self = self else { reject("ERR_FS", "Module deallocated", nil); return }
      guard self.fileManager.fileExists(atPath: path) else {
        reject("ERR_FS", "[FILE_NOT_FOUND] Directory does not exist: \(path)", nil); return
      }
      do {
        let contents = try self.fileManager.contentsOfDirectory(atPath: path)
        var results: [[String: Any]] = []
        for item in contents {
          let fullPath = (path as NSString).appendingPathComponent(item)
          let attrs = try self.fileManager.attributesOfItem(atPath: fullPath)
          let size = attrs[.size] as? Int64 ?? 0
          let modDate = attrs[.modificationDate] as? Date ?? Date()
          let fileType = attrs[.type] as? FileAttributeType
          let type: String
          if fileType == .typeDirectory { type = "directory" }
          else if fileType == .typeRegular { type = "file" }
          else { type = "unknown" }
          results.append([
            "path": fullPath, "name": item,
            "size": NSNumber(value: size), "type": type,
            "lastModified": NSNumber(value: modDate.timeIntervalSince1970 * 1000)
          ])
        }
        resolve(results)
      } catch {
        reject("ERR_FS", error.localizedDescription, error)
      }
    }
  }

  @objc func cp(_ srcPath: String, destPath: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      guard let self = self else { reject("ERR_FS", "Module deallocated", nil); return }
      guard self.fileManager.fileExists(atPath: srcPath) else {
        reject("ERR_FS", "[FILE_NOT_FOUND] Source does not exist: \(srcPath)", nil); return
      }
      do {
        let parentDir = (destPath as NSString).deletingLastPathComponent
        if !self.fileManager.fileExists(atPath: parentDir) {
          try self.fileManager.createDirectory(atPath: parentDir, withIntermediateDirectories: true, attributes: nil)
        }
        try self.fileManager.copyItem(atPath: srcPath, toPath: destPath)
        resolve(nil)
      } catch {
        reject("ERR_FS", error.localizedDescription, error)
      }
    }
  }

  @objc func mv(_ srcPath: String, destPath: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      guard let self = self else { reject("ERR_FS", "Module deallocated", nil); return }
      guard self.fileManager.fileExists(atPath: srcPath) else {
        reject("ERR_FS", "[FILE_NOT_FOUND] Source does not exist: \(srcPath)", nil); return
      }
      do {
        let parentDir = (destPath as NSString).deletingLastPathComponent
        if !self.fileManager.fileExists(atPath: parentDir) {
          try self.fileManager.createDirectory(atPath: parentDir, withIntermediateDirectories: true, attributes: nil)
        }
        try self.fileManager.moveItem(atPath: srcPath, toPath: destPath)
        resolve(nil)
      } catch {
        reject("ERR_FS", error.localizedDescription, error)
      }
    }
  }

  @objc func hashFile(_ path: String, algorithm: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    DispatchQueue.global(qos: .userInitiated).async { [weak self] in
      guard let self = self else { reject("ERR_FS", "Module deallocated", nil); return }
      guard self.fileManager.fileExists(atPath: path) else {
        reject("ERR_FS", "[FILE_NOT_FOUND] File does not exist: \(path)", nil); return
      }
      guard let inputStream = InputStream(fileAtPath: path) else {
        reject("ERR_FS", "[READ_ERROR] Could not open file: \(path)", nil); return
      }
      inputStream.open()
      defer { inputStream.close() }

      let bufferSize = 8192
      let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
      defer { buffer.deallocate() }

      switch algorithm {
      case "sha256":
        var context = CC_SHA256_CTX()
        CC_SHA256_Init(&context)
        while inputStream.hasBytesAvailable {
          let bytesRead = inputStream.read(buffer, maxLength: bufferSize)
          if bytesRead < 0 { reject("ERR_FS", "[READ_ERROR] Error reading file", nil); return }
          if bytesRead == 0 { break }
          CC_SHA256_Update(&context, buffer, CC_LONG(bytesRead))
        }
        var digest = [UInt8](repeating: 0, count: Int(CC_SHA256_DIGEST_LENGTH))
        CC_SHA256_Final(&digest, &context)
        resolve(digest.map { String(format: "%02x", $0) }.joined())

      case "md5":
        var context = CC_MD5_CTX()
        CC_MD5_Init(&context)
        while inputStream.hasBytesAvailable {
          let bytesRead = inputStream.read(buffer, maxLength: bufferSize)
          if bytesRead < 0 { reject("ERR_FS", "[READ_ERROR] Error reading file", nil); return }
          if bytesRead == 0 { break }
          CC_MD5_Update(&context, buffer, CC_LONG(bytesRead))
        }
        var digest = [UInt8](repeating: 0, count: Int(CC_MD5_DIGEST_LENGTH))
        CC_MD5_Final(&digest, &context)
        resolve(digest.map { String(format: "%02x", $0) }.joined())

      default:
        reject("ERR_FS", "[INVALID_ARGUMENT] Unknown algorithm: \(algorithm)", nil)
      }
    }
  }
}
