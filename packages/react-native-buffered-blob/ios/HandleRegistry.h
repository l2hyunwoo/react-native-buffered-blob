#pragma once

#import <Foundation/Foundation.h>

@protocol HandleCloseable <NSObject>
- (void)closeHandle;
@end

/**
 * Thread-safe singleton registry that maps integer IDs to handle objects.
 * Used to pass opaque handles between JS and native.
 */
@interface HandleRegistry : NSObject

+ (instancetype)shared;

/** Register an object and return its unique ID. */
- (NSInteger)registerObject:(id)obj;

/** Look up an object by ID. Returns nil if not found. */
- (id)objectForId:(NSInteger)handleId;

/** Remove and close (if HandleCloseable) the object for the given ID. */
- (void)removeObjectForId:(NSInteger)handleId;

/** Remove and close all registered objects. */
- (void)clear;

@end
