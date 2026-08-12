import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const zipName = 'dist.zip';
const distDir = 'dist';

// Check if dist exists
if (!fs.existsSync(distDir)) {
  console.error(`Error: "${distDir}" folder not found. Please run "npm run build" first.`);
  process.exit(1);
}

// ALWAYS DELETE THE OLD ZIP FIRST
if (fs.existsSync(zipName)) {
  console.log(`Removing existing ${zipName}...`);
  fs.unlinkSync(zipName);
}

console.log(`Creating fresh ${zipName} at root (together with "${distDir}" folder)...`);

// Wait a moment for the build process to fully release all file handles
console.log('Waiting for file handles to release...');
try {
  if (process.platform === 'win32') {
    // Windows PowerShell - Use dist\\* to zip contents
    // Removed -Update as we delete the zip beforehand
    // Added a 1 second delay via PowerShell sleep to be extra safe
    const cmd = `powershell -command "Start-Sleep -s 1; Compress-Archive -Path ${distDir}\\* -DestinationPath ${zipName} -Force"`;
    execSync(cmd, { stdio: 'inherit' });
  } else {
    // Linux/Mac
    execSync(`sleep 1 && zip -r ${zipName} ${distDir}/*`, { stdio: 'inherit' });
  }
  console.log(`\x1b[32mSuccessfully archived contents of ${distDir} to ${zipName}\x1b[0m`);
} catch (error) {
  console.error('Archive operation failed:', error.message);
  process.exit(1);
}
