import { BlobError, ErrorCode, wrapError } from '../errors';

describe('BlobError', () => {
  it('should create error with code, message, and path', () => {
    const error = new BlobError(
      ErrorCode.FILE_NOT_FOUND,
      'File not found',
      '/test/path'
    );

    expect(error.code).toBe(ErrorCode.FILE_NOT_FOUND);
    expect(error.message).toBe('File not found');
    expect(error.path).toBe('/test/path');
    expect(error.name).toBe('BlobError');
  });

  it('should create error without path', () => {
    const error = new BlobError(ErrorCode.IO_ERROR, 'IO error');

    expect(error.code).toBe(ErrorCode.IO_ERROR);
    expect(error.message).toBe('IO error');
    expect(error.path).toBeUndefined();
  });

  it('should be instanceof Error', () => {
    const error = new BlobError(ErrorCode.UNKNOWN, 'Unknown error');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(BlobError);
  });
});

describe('wrapError', () => {
  it('should parse error with format "[ERROR_CODE] message"', () => {
    const error = new Error('[FILE_NOT_FOUND] Could not find the file');
    const wrapped = wrapError(error, '/test/path');

    expect(wrapped).toBeInstanceOf(BlobError);
    expect(wrapped.code).toBe(ErrorCode.FILE_NOT_FOUND);
    expect(wrapped.message).toBe('Could not find the file');
    expect(wrapped.path).toBe('/test/path');
  });

  it('should handle unknown error codes and map to UNKNOWN', () => {
    const error = new Error('[INVALID_CODE] Some error');
    const wrapped = wrapError(error);

    expect(wrapped.code).toBe(ErrorCode.UNKNOWN);
    expect(wrapped.message).toBe('Some error');
  });

  it('should handle errors without code prefix', () => {
    const error = new Error('Plain error message');
    const wrapped = wrapError(error, '/test/path');

    expect(wrapped.code).toBe(ErrorCode.UNKNOWN);
    expect(wrapped.message).toBe('Plain error message');
    expect(wrapped.path).toBe('/test/path');
  });

  it('should handle non-Error inputs (strings)', () => {
    const wrapped = wrapError('String error', '/test/path');

    expect(wrapped.code).toBe(ErrorCode.UNKNOWN);
    expect(wrapped.message).toBe('String error');
    expect(wrapped.path).toBe('/test/path');
  });

  it('should handle non-Error inputs (objects)', () => {
    const wrapped = wrapError({ foo: 'bar' });

    expect(wrapped.code).toBe(ErrorCode.UNKNOWN);
    expect(wrapped.message).toBe('[object Object]');
  });

  it('should preserve existing BlobError instances', () => {
    const original = new BlobError(
      ErrorCode.PERMISSION_DENIED,
      'Permission denied',
      '/original'
    );
    const wrapped = wrapError(original, '/new/path');

    expect(wrapped).toBe(original);
    expect(wrapped.path).toBe('/original');
  });

  it('should parse all valid error codes', () => {
    const codes = [
      'FILE_NOT_FOUND',
      'PERMISSION_DENIED',
      'FILE_ALREADY_EXISTS',
      'NOT_A_FILE',
      'NOT_A_DIRECTORY',
      'DIRECTORY_NOT_EMPTY',
      'IO_ERROR',
      'INVALID_ARGUMENT',
      'DOWNLOAD_FAILED',
      'DOWNLOAD_CANCELLED',
      'READER_CLOSED',
      'WRITER_CLOSED',
    ];

    codes.forEach((code) => {
      const error = new Error(`[${code}] Test message`);
      const wrapped = wrapError(error);
      expect(wrapped.code).toBe(code);
      expect(wrapped.message).toBe('Test message');
    });
  });

  it('should handle empty message after code', () => {
    const error = new Error('[IO_ERROR]');
    const wrapped = wrapError(error);

    expect(wrapped.code).toBe(ErrorCode.IO_ERROR);
    expect(wrapped.message).toBe('[IO_ERROR]');
  });
});
