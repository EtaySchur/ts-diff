import * as path from 'path';
import { analyzeSymbolUsage } from './utils/findSymbolUsage';

// Get command line arguments - when run with npm run, the actual arguments start at index 2
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Please provide both a package name and symbol name as arguments');
  console.error('Usage: npm run find-symbol-usage -- <package-name> <symbol-name> [options]');
  console.error('');
  console.error('Options:');
  console.error('  --output=<file.json>   Specify output file (must end with .json)');
  console.error('  --path=<project-path>  Specify project path to analyze');
  process.exit(1);
}

const packageName = args[0];
const symbolName = args[1];
let outputPath = undefined;
let projectPath = undefined;

// Parse additional arguments
for (let i = 2; i < args.length; i++) {
  const arg = args[i];
  
  // Handle --output parameter
  if (arg.startsWith('--output=')) {
    outputPath = arg.substring('--output='.length);
  }
  // Handle --path parameter
  else if (arg.startsWith('--path=')) {
    projectPath = arg.substring('--path='.length);
  }
  // Handle for backward compatibility (positional arguments)
  else if (arg.endsWith('.json') && !outputPath) {
    outputPath = arg;
  }
  else if (!projectPath) {
    projectPath = arg;
  }
}

// Get the project root directory - use provided path or default to project root
const projectRoot = projectPath 
  ? path.resolve(projectPath) 
  : path.resolve(__dirname, '..');

// Run the symbol usage analysis
try {
  analyzeSymbolUsage(projectRoot, packageName, symbolName, outputPath);
} catch (error) {
  console.error('Error analyzing symbol usage:', error);
} 