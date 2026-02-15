import { useState, useCallback } from 'react';
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import {
  createReader,
  createWriter,
  exists,
  stat,
  unlink,
  mkdir,
  ls,
  cp,
  mv,
  hashFile,
  download,
  Dirs,
  join,
  HashAlgorithm,
  BlobError,
} from 'react-native-buffered-blob';

type LogEntry = { text: string; success: boolean };

function useLogger() {
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const log = useCallback((text: string, success = true) => {
    setLogs((prev) => [...prev, { text, success }]);
  }, []);

  const clear = useCallback(() => {
    setLogs([]);
  }, []);

  return { logs, log, clear };
}

export default function App() {
  const { logs, log, clear } = useLogger();
  const [running, setRunning] = useState(false);

  const runFileTests = useCallback(async () => {
    setRunning(true);
    clear();

    try {
      // Show directory paths
      log(`Document dir: ${Dirs.document}`);
      log(`Cache dir: ${Dirs.cache}`);
      log(`Temp dir: ${Dirs.temp}`);

      const testDir = join(Dirs.temp, 'blob-test');
      const testFile = join(testDir, 'hello.txt');
      const copyFile = join(testDir, 'hello-copy.txt');
      const movedFile = join(testDir, 'hello-moved.txt');

      // mkdir
      await mkdir(testDir);
      log('mkdir: created test directory');

      // Write file using createWriter
      const encoder = new TextEncoder();
      const data = encoder.encode('Hello from Buffered Blob!');
      const w = createWriter(testFile);
      await w.write(data.buffer as ArrayBuffer);
      await w.flush();
      w.close();
      log('createWriter: wrote test file');

      // exists
      const fileExists = await exists(testFile);
      log(`exists: ${fileExists}`, fileExists);

      // stat
      const info = await stat(testFile);
      log(`stat: size=${info.size}, name=${info.name}`);

      // Read file using createReader
      const r = createReader(testFile);
      const readChunks: ArrayBuffer[] = [];
      while (!r.isEOF) {
        const chunk = await r.readNextChunk();
        if (chunk) readChunks.push(chunk);
      }
      r.close();
      const merged = new Uint8Array(
        readChunks.reduce((sum, c) => sum + c.byteLength, 0)
      );
      let offset = 0;
      for (const c of readChunks) {
        merged.set(new Uint8Array(c), offset);
        offset += c.byteLength;
      }
      const decoder = new TextDecoder();
      const content = decoder.decode(merged);
      log(
        `createReader: "${content}"`,
        content === 'Hello from Buffered Blob!'
      );

      // Streaming write
      const streamFile = join(testDir, 'stream.txt');
      const writer = createWriter(streamFile);
      for (let i = 0; i < 3; i++) {
        const chunk = encoder.encode(`Chunk ${i}\n`);
        await writer.write(chunk.buffer as ArrayBuffer);
      }
      await writer.flush();
      writer.close();
      log(`createWriter: wrote 3 chunks, bytesWritten=${writer.bytesWritten}`);

      // Streaming read
      const reader = createReader(streamFile);
      let chunks = 0;
      while (!reader.isEOF) {
        const chunk = await reader.readNextChunk();
        if (chunk) chunks++;
      }
      reader.close();
      log(`createReader: read ${chunks} chunk(s), fileSize=${reader.fileSize}`);

      // cp
      await cp(testFile, copyFile);
      const copyExists = await exists(copyFile);
      log(`cp: copied file, exists=${copyExists}`, copyExists);

      // mv
      await mv(copyFile, movedFile);
      const movedExists = await exists(movedFile);
      const origGone = !(await exists(copyFile));
      log(
        `mv: moved file, new exists=${movedExists}, old gone=${origGone}`,
        movedExists && origGone
      );

      // ls
      const entries = await ls(testDir);
      log(
        `ls: ${entries.length} entries: ${entries
          .map((e) => e.name)
          .join(', ')}`
      );

      // hashFile
      const hash = await hashFile(testFile, HashAlgorithm.SHA256);
      log(`hashFile(SHA256): ${hash.slice(0, 16)}...`);

      const md5 = await hashFile(testFile, HashAlgorithm.MD5);
      log(`hashFile(MD5): ${md5}`);

      // Cleanup
      await unlink(testFile);
      await unlink(movedFile);
      await unlink(streamFile);
      await unlink(testDir);
      log('unlink: cleaned up test files');

      log('--- All file tests passed! ---');
    } catch (e) {
      if (e instanceof BlobError) {
        log(`BlobError [${e.code}]: ${e.message} (path: ${e.path})`, false);
      } else {
        log(`Error: ${e instanceof Error ? e.message : String(e)}`, false);
      }
    } finally {
      setRunning(false);
    }
  }, [log, clear]);

  const runDownloadTest = useCallback(async () => {
    setRunning(true);
    clear();

    try {
      const destPath = join(Dirs.temp, 'download-test.json');

      log('Starting download...');
      await download({
        url: 'https://httpbin.org/bytes/1024',
        destPath,
        onProgress: (progress) => {
          log(
            `Progress: ${progress.bytesDownloaded}/${
              progress.totalBytes
            } (${Math.round(progress.progress * 100)}%)`
          );
        },
      });

      const fileExists = await exists(destPath);
      log(`Download complete, file exists: ${fileExists}`, fileExists);

      if (fileExists) {
        const info = await stat(destPath);
        log(`Downloaded file size: ${info.size} bytes`);
        await unlink(destPath);
        log('Cleaned up downloaded file');
      }

      log('--- Download test passed! ---');
    } catch (e) {
      if (e instanceof BlobError) {
        if (e.code === 'DOWNLOAD_CANCELLED') {
          log('Download was cancelled by user');
        } else {
          log(`BlobError [${e.code}]: ${e.message}`, false);
        }
      } else {
        log(`Error: ${e instanceof Error ? e.message : String(e)}`, false);
      }
    } finally {
      setRunning(false);
    }
  }, [log, clear]);

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Buffered Blob Example</Text>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={[styles.button, running && styles.buttonDisabled]}
          onPress={runFileTests}
          disabled={running}
        >
          <Text style={styles.buttonText}>Run File Tests</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, running && styles.buttonDisabled]}
          onPress={runDownloadTest}
          disabled={running}
        >
          <Text style={styles.buttonText}>Test Download</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.logContainer}>
        {logs.map((entry, i) => (
          <Text
            key={i}
            style={[styles.logText, !entry.success && styles.logError]}
          >
            {entry.text}
          </Text>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    paddingVertical: 16,
    color: '#333',
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    margin: 16,
    borderRadius: 8,
    padding: 12,
  },
  logText: {
    color: '#4EC9B0',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  logError: {
    color: '#F44747',
  },
});
