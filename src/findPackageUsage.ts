import * as path from 'path';
import { analyzeAndSavePackageUsage } from './utils/packageUsageFinder';

// Get command line arguments - when run with npm run, the actual arguments start at index 2
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Please provide a package name as an argument');
  console.error('Usage: npm run find-package-usage -- <package-name> [output-file]');
  process.exit(1);
}

const packageName = args[0];
const outputPath = args[1]; // Optional output path

// Get the project root directory
const projectRoot = path.resolve(__dirname, '..');

// Run the package usage analysis
try {
  console.log(`Analyzing usage of package '${packageName}' in the project...`);
  analyzeAndSavePackageUsage(projectRoot, packageName, outputPath);
} catch (error) {
  console.error('Error analyzing package usage:', error);
} 