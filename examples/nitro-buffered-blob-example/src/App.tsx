import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { NitroModules } from 'react-native-nitro-modules';
import type {
  BufferedBlobModule,
  NativeFileReader,
  NativeFileWriter,
  NativeDownloader,
} from 'react-native-nitro-buffered-blob';
import { HashAlgorithm } from 'react-native-nitro-buffered-blob';

// Create the Nitro module instance
const nitroModule =
  NitroModules.createHybridObject<BufferedBlobModule>('BufferedBlobModule');

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

  // Test file system operations
  const testFileSystemOps = async () => {
    try {
      addLog('=== Testing File System Operations ===');

      // Get directories
      addLog(`Document Dir: ${nitroModule.documentDir}`);
      addLog(`Cache Dir: ${nitroModule.cacheDir}`);
      addLog(`Temp Dir: ${nitroModule.tempDir}`);
      addLog(`Download Dir: ${nitroModule.downloadDir}`);

      const testPath = `${nitroModule.tempDir}/test.txt`;

      // Check if file exists
      const exists = await nitroModule.exists(testPath);
      addLog(`File exists: ${exists}`);

      if (exists) {
        await nitroModule.unlink(testPath);
        addLog('Cleaned up existing file');
      }

      // Create directory
      const testDir = `${nitroModule.tempDir}/testdir`;
      await nitroModule.mkdir(testDir);
      addLog(`Created directory: ${testDir}`);

      addLog('✅ File system operations test passed');
    } catch (error) {
      addLog(`❌ Error: ${error}`);
    }
  };

  // Test file reader/writer
  const testFileReadWrite = async () => {
    try {
      addLog('=== Testing File Read/Write ===');

      const testPath = `${nitroModule.tempDir}/readwrite-test.txt`;
      const testData = 'Hello from Nitro BufferedBlob!';

      // Write file
      const writer: NativeFileWriter = nitroModule.openWrite(testPath, false);
      addLog('Opened writer');

      const encoder = new TextEncoder();
      const buffer = encoder.encode(testData);

      const bytesWritten = await writer.write(buffer.buffer);
      addLog(`Wrote ${bytesWritten} bytes`);
      addLog(`Writer bytesWritten: ${writer.bytesWritten}`);

      await writer.flush();
      writer.close();
      addLog('Closed writer');

      // Read file back
      const reader: NativeFileReader = nitroModule.openRead(testPath, 4096);
      addLog(`Opened reader, fileSize: ${reader.fileSize}`);

      const chunk = await reader.readNextChunk();
      if (chunk) {
        // Hermes does not support TextDecoder; decode UTF-8 manually
        const bytes = new Uint8Array(chunk);
        let text = '';
        for (let i = 0; i < bytes.length; i++) {
          text += String.fromCharCode(bytes[i]!);
        }
        addLog(`Read data: "${text}"`);
        addLog(`Reader bytesRead: ${reader.bytesRead}, isEOF: ${reader.isEOF}`);
      }

      reader.close();
      addLog('Closed reader');

      // Stat file
      const stat = await nitroModule.stat(testPath);
      addLog(`File stat - size: ${stat.size}, type: ${stat.type}`);

      // Hash file
      const hash = await nitroModule.hashFile(testPath, HashAlgorithm.SHA256);
      addLog(`File hash (SHA256): ${hash}`);

      // Clean up
      await nitroModule.unlink(testPath);
      addLog('Cleaned up test file');

      addLog('✅ File read/write test passed');
    } catch (error) {
      addLog(`❌ Error: ${error}`);
    }
  };

  // Test file copy and move
  const testCopyMove = async () => {
    try {
      addLog('=== Testing File Copy/Move ===');

      const srcPath = `${nitroModule.tempDir}/source.txt`;
      const copyPath = `${nitroModule.tempDir}/copied.txt`;
      const movePath = `${nitroModule.tempDir}/moved.txt`;

      // Clean up any leftover files from previous runs
      for (const p of [srcPath, copyPath, movePath]) {
        if (await nitroModule.exists(p)) {
          await nitroModule.unlink(p);
        }
      }

      // Create source file
      const writer = nitroModule.openWrite(srcPath, false);
      const encoder = new TextEncoder();
      await writer.write(encoder.encode('Copy/Move test').buffer);
      await writer.flush();
      writer.close();
      addLog('Created source file');

      // Copy file
      await nitroModule.cp(srcPath, copyPath);
      const copyExists = await nitroModule.exists(copyPath);
      addLog(`File copied: ${copyExists}`);

      // Move file
      await nitroModule.mv(copyPath, movePath);
      const moveExists = await nitroModule.exists(movePath);
      const copyStillExists = await nitroModule.exists(copyPath);
      addLog(`File moved: ${moveExists}, copy removed: ${!copyStillExists}`);

      // List directory
      const files = await nitroModule.ls(nitroModule.tempDir);
      addLog(`Found ${files.length} files/dirs in temp`);

      // Clean up
      await nitroModule.unlink(srcPath);
      await nitroModule.unlink(movePath);
      addLog('Cleaned up test files');

      addLog('✅ Copy/move test passed');
    } catch (error) {
      addLog(`❌ Error: ${error}`);
    }
  };

  // Test downloader
  const testDownloader = async () => {
    try {
      addLog('=== Testing Downloader ===');

      const url = 'https://httpbin.org/bytes/1024';
      const destPath = `${nitroModule.downloadDir}/download-test.bin`;

      const downloader: NativeDownloader = nitroModule.createDownload(
        url,
        destPath,
        { 'User-Agent': 'NitroBlob/1.0' }
      );
      addLog('Created downloader');

      await downloader.start((progress) => {
        addLog(
          `Download progress: ${progress.bytesDownloaded}/${progress.totalBytes} ` +
            `(${Math.round(progress.progress * 100)}%)`
        );
      });

      addLog(`Download complete, cancelled: ${downloader.isCancelled}`);

      // Verify file exists
      const exists = await nitroModule.exists(destPath);
      addLog(`Downloaded file exists: ${exists}`);

      if (exists) {
        const stat = await nitroModule.stat(destPath);
        addLog(`Downloaded file size: ${stat.size} bytes`);
        await nitroModule.unlink(destPath);
        addLog('Cleaned up downloaded file');
      }

      addLog('✅ Downloader test passed');
    } catch (error) {
      addLog(`❌ Error: ${error}`);
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
        <Text style={styles.title}>Nitro BufferedBlob Module Test</Text>
        <Text style={styles.subtitle}>Direct Nitro Module API Tests</Text>
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
