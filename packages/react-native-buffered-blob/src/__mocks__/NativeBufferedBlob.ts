import type { Spec } from '../NativeBufferedBlob';

const mockConstants = {
  documentDir: '/mock/document',
  cacheDir: '/mock/cache',
  tempDir: '/mock/temp',
  downloadDir: '/mock/download',
};

const mockNativeModule: Spec = {
  install: jest.fn(() => true),
  openRead: jest.fn(() => 1),
  openWrite: jest.fn(() => 2),
  createDownload: jest.fn(() => 3),
  closeHandle: jest.fn(),
  exists: jest.fn(async () => true),
  stat: jest.fn(async (path: string) => ({
    path,
    name: path.split('/').pop() || '',
    size: 1024,
    type: 'file',
    lastModified: Date.now(),
  })),
  unlink: jest.fn(async () => {}),
  mkdir: jest.fn(async () => {}),
  ls: jest.fn(async () => []),
  cp: jest.fn(async () => {}),
  mv: jest.fn(async () => {}),
  hashFile: jest.fn(async () => 'mockhash'),
  getConstants: jest.fn(() => mockConstants),
};

export default mockNativeModule;
