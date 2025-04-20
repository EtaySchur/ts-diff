import * as path from 'path';
import { analyzeAndSavePackageUsage } from './utils/packageUsageFinder';

// Get command line arguments - when run with npm run, the actual arguments start at index 2
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Please provide a package name as an argument');
  console.error('Usage: npm run find-package-usage -- <package-name> [output-file] [project-path]');
  process.exit(1);
}

const packageName = args[0];
let outputPath = undefined;
let projectPath = undefined;

// Check if we have more than 1 argument
if (args.length > 1) {
  // If the second argument ends with .json, it's likely the output file
  if (args[1].endsWith('.json')) {
    outputPath = args[1];
    projectPath = args.length > 2 ? args[2] : undefined;
  } else {
    // Otherwise, assume it's the project path
    projectPath = args[1];
    outputPath = args.length > 2 ? args[2] : undefined;
  }
}

// Get the project root directory - use provided path or default to project root
const projectRoot = projectPath 
  ? path.resolve(projectPath) 
  : path.resolve(__dirname, '..');

// Run the package usage analysis
try {
  console.log(`Analyzing usage of package '${packageName}' in the project at ${projectRoot}...`);
  analyzeAndSavePackageUsage(projectRoot, packageName, outputPath);
} catch (error) {
  console.error('Error analyzing package usage:', error);
} 