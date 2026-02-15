export enum ErrorCode {
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  FILE_ALREADY_EXISTS = 'FILE_ALREADY_EXISTS',
  NOT_A_FILE = 'NOT_A_FILE',
  NOT_A_DIRECTORY = 'NOT_A_DIRECTORY',
  DIRECTORY_NOT_EMPTY = 'DIRECTORY_NOT_EMPTY',
  IO_ERROR = 'IO_ERROR',
  INVALID_ARGUMENT = 'INVALID_ARGUMENT',
  DOWNLOAD_FAILED = 'DOWNLOAD_FAILED',
  DOWNLOAD_CANCELLED = 'DOWNLOAD_CANCELLED',
  READER_CLOSED = 'READER_CLOSED',
  WRITER_CLOSED = 'WRITER_CLOSED',
  UNKNOWN = 'UNKNOWN',
}

export class BlobError extends Error {
  public readonly code: ErrorCode;
  public readonly path?: string;

  constructor(code: ErrorCode, message: string, path?: string) {
    super(message);
    this.name = 'BlobError';
    this.code = code;
    this.path = path;
    Object.setPrototypeOf(this, BlobError.prototype);
  }
}

/**
 * Parse native error with format "[ERROR_CODE] message" into BlobError.
 */
export function wrapError(e: unknown, path?: string): BlobError {
  if (e instanceof BlobError) {
    return e;
  }

  const message = e instanceof Error ? e.message : String(e);
  const match = /^\[([A-Z_]+)\]\s*(.*)$/.exec(message);

  if (match) {
    const [, code, msg] = match;
    const errorCode = Object.values(ErrorCode).includes(code as ErrorCode)
      ? (code as ErrorCode)
      : ErrorCode.UNKNOWN;
    return new BlobError(errorCode, msg || message, path);
  }

  return new BlobError(ErrorCode.UNKNOWN, message, path);
}
