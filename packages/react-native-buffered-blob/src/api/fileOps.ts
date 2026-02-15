import { NativeModule } from '../module';
import { wrapError } from '../errors';
import type { FileInfo } from '../types';
import { FileType } from '../types';

function toFileType(raw: string): FileType {
  const values: string[] = Object.values(FileType);
  return values.includes(raw) ? (raw as FileType) : FileType.UNKNOWN;
}

function mapFileInfo(raw: {
  path: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
}): FileInfo {
  return {
    path: raw.path,
    name: raw.name,
    size: raw.size,
    type: toFileType(raw.type),
    lastModified: raw.lastModified,
  };
}

export async function exists(path: string): Promise<boolean> {
  try {
    return await NativeModule.exists(path);
  } catch (e) {
    throw wrapError(e, path);
  }
}

export async function stat(path: string): Promise<FileInfo> {
  try {
    const raw = await NativeModule.stat(path);
    return mapFileInfo(raw);
  } catch (e) {
    throw wrapError(e, path);
  }
}

export async function unlink(path: string): Promise<void> {
  try {
    await NativeModule.unlink(path);
  } catch (e) {
    throw wrapError(e, path);
  }
}

export async function mkdir(path: string): Promise<void> {
  try {
    await NativeModule.mkdir(path);
  } catch (e) {
    throw wrapError(e, path);
  }
}

export async function ls(path: string): Promise<FileInfo[]> {
  try {
    const rawList = await NativeModule.ls(path);
    return rawList.map(mapFileInfo);
  } catch (e) {
    throw wrapError(e, path);
  }
}

export async function cp(srcPath: string, destPath: string): Promise<void> {
  try {
    await NativeModule.cp(srcPath, destPath);
  } catch (e) {
    throw wrapError(e, srcPath);
  }
}

export async function mv(srcPath: string, destPath: string): Promise<void> {
  try {
    await NativeModule.mv(srcPath, destPath);
  } catch (e) {
    throw wrapError(e, srcPath);
  }
}
