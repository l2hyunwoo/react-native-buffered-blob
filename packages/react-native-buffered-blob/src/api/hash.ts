import { NativeModule } from '../module';
import { wrapError } from '../errors';
import { HashAlgorithm } from '../types';

export async function hashFile(
  path: string,
  algorithm: HashAlgorithm = HashAlgorithm.SHA256
): Promise<string> {
  try {
    return await NativeModule.hashFile(path, algorithm);
  } catch (e) {
    throw wrapError(e);
  }
}
