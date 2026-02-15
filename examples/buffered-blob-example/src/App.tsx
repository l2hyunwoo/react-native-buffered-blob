import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
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

function App(): React.JSX.Element {
  const [log, setLog] = useState<string[]>([]);

  const addLog = (message: string) => {
    console.log(message);
    setLog((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  const clearLog = () => setLog([]);

  // Helper to encode strings (Hermes TextEncoder fallback)
  const encode = (str: string): Uint8Array => {
    if (typeof TextEncoder !== 'undefined') {
      return new TextEncoder().encode(str);
    }
    const arr = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      arr[i] = str.charCodeAt(i);
    }
    return arr;
  };

  // Helper to decode Uint8Array to string (Hermes TextDecoder fallback)
  const decode = (bytes: Uint8Array): string => {
    let text = '';
    for (let i = 0; i < bytes.length; i++) {
      text += String.fromCharCode(bytes[i]!);
    }
    return text;
  };

  // Test file system operations
  const testFileSystemOps = async () => {
    try {
      addLog('=== Testing File System Operations ===');

      // Get directories
      addLog(`Document Dir: ${Dirs.document}`);
      addLog(`Cache Dir: ${Dirs.cache}`);
      addLog(`Temp Dir: ${Dirs.temp}`);

      const testDir = join(Dirs.temp, 'blob-test');

      // Create directory
      await mkdir(testDir);
      addLog(`Created directory: ${testDir}`);

      // Check if directory exists
      const dirExists = await exists(testDir);
      addLog(`Directory exists: ${dirExists}`);

      // Clean up
      await unlink(testDir);
      addLog('Cleaned up test directory');

      addLog('✅ File system operations test passed');
    } catch (error) {
      if (error instanceof BlobError) {
        addLog(`❌ BlobError [${error.code}]: ${error.message}`);
      } else {
        addLog(`❌ Error: ${error}`);
      }
    }
  };

  // Test file reader/writer
  const testFileReadWrite = async () => {
    try {
      addLog('=== Testing File Read/Write ===');

      const testDir = join(Dirs.temp, 'blob-test');
      const testFile = join(testDir, 'readwrite-test.txt');
      const streamFile = join(testDir, 'stream.txt');

      await mkdir(testDir);

      // Write file
      const testData = 'Hello from Buffered Blob!';
      const w = createWriter(testFile);
      const data = encode(testData);
      await w.write(data.buffer as ArrayBuffer);
      await w.flush();
      w.close();
      addLog('Opened writer and wrote data');
      addLog(`Writer bytesWritten: ${w.bytesWritten}`);

      // Read file back
      const r = createReader(testFile);
      addLog(`Opened reader, fileSize: ${r.fileSize}`);

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
      const content = decode(merged);
      addLog(`Read data: "${content}"`);
      addLog(`Reader bytesRead: ${r.bytesRead}, isEOF: ${r.isEOF}`);

      // Streaming write
      const writer = createWriter(streamFile);
      for (let i = 0; i < 3; i++) {
        const chunk = encode(`Chunk ${i}\n`);
        await writer.write(chunk.buffer as ArrayBuffer);
      }
      await writer.flush();
      writer.close();
      addLog(`Streaming write: 3 chunks, bytesWritten=${writer.bytesWritten}`);

      // Streaming read
      const reader = createReader(streamFile);
      let chunks = 0;
      while (!reader.isEOF) {
        const chunk = await reader.readNextChunk();
        if (chunk) chunks++;
      }
      reader.close();
      addLog(`Streaming read: ${chunks} chunk(s), fileSize=${reader.fileSize}`);

      // Stat file
      const info = await stat(testFile);
      addLog(`File stat - size: ${info.size}, type: ${info.type}`);

      // Hash file
      const hash = await hashFile(testFile, HashAlgorithm.SHA256);
      addLog(`File hash (SHA256): ${hash}`);

      const md5 = await hashFile(testFile, HashAlgorithm.MD5);
      addLog(`File hash (MD5): ${md5}`);

      // Clean up
      await unlink(testFile);
      await unlink(streamFile);
      await unlink(testDir);
      addLog('Cleaned up test files');

      addLog('✅ File read/write test passed');
    } catch (error) {
      if (error instanceof BlobError) {
        addLog(`❌ BlobError [${error.code}]: ${error.message}`);
      } else {
        addLog(`❌ Error: ${error}`);
      }
    }
  };

  // Test file copy and move
  const testCopyMove = async () => {
    try {
      addLog('=== Testing File Copy/Move ===');

      const testDir = join(Dirs.temp, 'blob-test');
      const srcPath = join(testDir, 'source.txt');
      const copyPath = join(testDir, 'copied.txt');
      const movePath = join(testDir, 'moved.txt');

      await mkdir(testDir);

      // Clean up any leftover files from previous runs
      for (const p of [srcPath, copyPath, movePath]) {
        if (await exists(p)) {
          await unlink(p);
        }
      }

      // Create source file
      const w = createWriter(srcPath);
      await w.write(encode('Copy/Move test').buffer as ArrayBuffer);
      await w.flush();
      w.close();
      addLog('Created source file');

      // Copy file
      await cp(srcPath, copyPath);
      const copyExists = await exists(copyPath);
      addLog(`File copied: ${copyExists}`);

      // Move file
      await mv(copyPath, movePath);
      const moveExists = await exists(movePath);
      const copyStillExists = await exists(copyPath);
      addLog(`File moved: ${moveExists}, copy removed: ${!copyStillExists}`);

      // List directory
      const files = await ls(testDir);
      addLog(`Found ${files.length} files/dirs in test directory`);

      // Clean up
      await unlink(srcPath);
      await unlink(movePath);
      await unlink(testDir);
      addLog('Cleaned up test files');

      addLog('✅ Copy/move test passed');
    } catch (error) {
      if (error instanceof BlobError) {
        addLog(`❌ BlobError [${error.code}]: ${error.message}`);
      } else {
        addLog(`❌ Error: ${error}`);
      }
    }
  };

  // Test downloader
  const testDownloader = async () => {
    try {
      addLog('=== Testing Downloader ===');

      const destPath = join(Dirs.temp, 'download-test.bin');

      const dl = download({
        url: 'https://httpbin.org/bytes/1024',
        destPath,
        onProgress: (progress) => {
          addLog(
            `Download progress: ${progress.bytesDownloaded}/${progress.totalBytes} ` +
              `(${Math.round(progress.progress * 100)}%)`
          );
        },
      });

      addLog('Started download');
      await dl.promise;
      addLog('Download complete');

      // Verify file exists
      const fileExists = await exists(destPath);
      addLog(`Downloaded file exists: ${fileExists}`);

      if (fileExists) {
        const info = await stat(destPath);
        addLog(`Downloaded file size: ${info.size} bytes`);
        await unlink(destPath);
        addLog('Cleaned up downloaded file');
      }

      addLog('✅ Downloader test passed');
    } catch (error) {
      if (error instanceof BlobError) {
        if (error.code === 'DOWNLOAD_CANCELLED') {
          addLog('Download was cancelled');
        } else {
          addLog(`❌ BlobError [${error.code}]: ${error.message}`);
        }
      } else {
        addLog(`❌ Error: ${error}`);
      }
    }
  };

  // Run all tests
  const runAllTests = async () => {
    clearLog();
    await testFileSystemOps();
    await testFileReadWrite();
    await testCopyMove();
    await testDownloader();
    addLog('=== All tests completed ===');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Buffered Blob Example</Text>
        <Text style={styles.subtitle}>Wrapper API Tests</Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.button} onPress={testFileSystemOps}>
          <Text style={styles.buttonText}>Test File System Ops</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testFileReadWrite}>
          <Text style={styles.buttonText}>Test File Read/Write</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testCopyMove}>
          <Text style={styles.buttonText}>Test Copy/Move</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testDownloader}>
          <Text style={styles.buttonText}>Test Downloader</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={runAllTests}
        >
          <Text style={styles.buttonText}>Run All Tests</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={clearLog}
        >
          <Text style={styles.buttonText}>Clear Log</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.logContainer}>
        {log.map((entry, index) => (
          <Text key={index} style={styles.logEntry}>
            {entry}
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
  header: {
    padding: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  buttonContainer: {
    padding: 16,
    gap: 8,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: '#34C759',
    marginTop: 8,
  },
  clearButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  logContainer: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    padding: 12,
  },
  logEntry: {
    color: '#d4d4d4',
    fontSize: 12,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
});

export default App;
