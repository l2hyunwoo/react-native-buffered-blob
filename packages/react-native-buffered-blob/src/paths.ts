import { NativeModule } from './module';

const constants = NativeModule.getConstants();

export const Dirs = Object.freeze({
  document: constants.documentDir,
  cache: constants.cacheDir,
  temp: constants.tempDir,
  download: constants.downloadDir,
});

export function join(...parts: string[]): string {
  const result = parts.filter(Boolean).join('/').replace(/\/+/g, '/');
  return result.length > 1 ? result.replace(/\/$/, '') : result;
}

export function dirname(path: string): string {
  const idx = path.lastIndexOf('/');
  return idx === -1 ? '.' : path.substring(0, idx);
}

export function basename(path: string, ext?: string): string {
  const idx = path.lastIndexOf('/');
  const name = idx === -1 ? path : path.substring(idx + 1);
  if (ext && name.endsWith(ext)) {
    return name.substring(0, name.length - ext.length);
  }
  return name;
}

export function extname(path: string): string {
  const name = basename(path);
  const idx = name.lastIndexOf('.');
  return idx <= 0 ? '' : name.substring(idx);
}
