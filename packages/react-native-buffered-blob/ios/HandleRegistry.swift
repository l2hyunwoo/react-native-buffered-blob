import Foundation

final class HandleRegistry {
  static let shared = HandleRegistry()

  private var nextId: Int = 1
  private var handles: [Int: AnyObject] = [:]
  private let lock = NSLock()

  private init() {}

  func register(_ obj: AnyObject) -> Int {
    lock.lock()
    defer { lock.unlock() }
    let id = nextId
    nextId += 1
    handles[id] = obj
    return id
  }

  func get<T: AnyObject>(_ id: Int) -> T? {
    lock.lock()
    defer { lock.unlock() }
    return handles[id] as? T
  }

  func remove(_ id: Int) {
    lock.lock()
    let obj = handles.removeValue(forKey: id)
    lock.unlock()
    // Close if applicable
    if let closeable = obj as? HandleCloseable {
      closeable.closeHandle()
    }
  }

  func clear() {
    lock.lock()
    let allIds = Array(handles.keys)
    lock.unlock()
    allIds.forEach { remove($0) }
  }
}

@objc protocol HandleCloseable {
  func closeHandle()
}
