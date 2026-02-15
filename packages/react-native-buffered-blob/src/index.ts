// Errors
export { ErrorCode, BlobError, wrapError } from './errors';

// Paths
export { Dirs, join, dirname, basename, extname } from './paths';

// Types
export type {
  FileInfo,
  DownloadProgress,
  BlobReader,
  BlobWriter,
} from './types';
export { HashAlgorithm, FileType } from './types';

// API - Streaming
export { createReader } from './api/readFile';
export { createWriter } from './api/writeFile';

// API - File Operations
export { exists, stat, unlink, mkdir, ls, cp, mv } from './api/fileOps';

// API - Hashing
export { hashFile } from './api/hash';

// API - Download
export { download } from './api/download';
export type { DownloadOptions } from './api/download';
