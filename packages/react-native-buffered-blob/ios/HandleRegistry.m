#import "HandleRegistry.h"

@implementation HandleRegistry {
  NSInteger _nextId;
  NSMutableDictionary<NSNumber *, id> *_handles;
  NSLock *_lock;
}

+ (instancetype)shared {
  static HandleRegistry *instance;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    instance = [[HandleRegistry alloc] initPrivate];
  });
  return instance;
}

- (instancetype)initPrivate {
  self = [super init];
  if (self) {
    _nextId = 1;
    _handles = [NSMutableDictionary new];
    _lock = [NSLock new];
  }
  return self;
}

- (NSInteger)registerObject:(id)obj {
  [_lock lock];
  NSInteger handleId = _nextId++;
  _handles[@(handleId)] = obj;
  [_lock unlock];
  return handleId;
}

- (id)objectForId:(NSInteger)handleId {
  [_lock lock];
  id obj = _handles[@(handleId)];
  [_lock unlock];
  return obj;
}

- (void)removeObjectForId:(NSInteger)handleId {
  [_lock lock];
  id obj = _handles[@(handleId)];
  [_handles removeObjectForKey:@(handleId)];
  [_lock unlock];

  if ([obj conformsToProtocol:@protocol(HandleCloseable)]) {
    [(id<HandleCloseable>)obj closeHandle];
  }
}

- (void)clear {
  [_lock lock];
  NSDictionary<NSNumber *, id> *snapshot = [_handles copy];
  [_handles removeAllObjects];
  [_lock unlock];

  for (id obj in snapshot.allValues) {
    if ([obj conformsToProtocol:@protocol(HandleCloseable)]) {
      [(id<HandleCloseable>)obj closeHandle];
    }
  }
}

@end
