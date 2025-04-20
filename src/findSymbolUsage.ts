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
  console.error('');
  console.error('Notes:');
  console.error('  - All line/character positions in the output JSON are 0-based');
  console.error('  - To find all symbols from a package use "*" as the symbol name');
  console.error('');
  console.error('Examples:');
  console.error('  npm run find-symbol-usage -- formik Formik');
  console.error('  npm run find-symbol-usage -- react useState --output=results.json');
  console.error('  npm run find-symbol-usage -- lodash map --path=../another-project');
  console.error('  npm run find-symbol-usage -- redux createStore --output=redux.json --path=/path/to/project');
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
    if (!outputPath.endsWith('.json')) {
      console.warn('Warning: Output file should have a .json extension');
    }
  }
  // Handle --path parameter
  else if (arg.startsWith('--path=')) {
    projectPath = arg.substring('--path='.length);
  }
  // Handle for backward compatibility (positional arguments)
  else if (arg.endsWith('.json') && !outputPath) {
    console.warn('Warning: Using deprecated positional arguments. Please use --output=<file.json> instead');
    outputPath = arg;
  }
  else if (!projectPath) {
    console.warn('Warning: Using deprecated positional arguments. Please use --path=<project-path> instead');
    projectPath = arg;
  }
}

// Get the project root directory - use provided path or default to project root
const projectRoot = projectPath 
  ? path.resolve(projectPath) 
  : path.resolve(__dirname, '..');

// Run the symbol usage analysis
try {
  console.log(`Analyzing usage of symbol '${symbolName}' from package '${packageName}' in the project at ${projectRoot}...`);
  const results = analyzeSymbolUsage(projectRoot, packageName, symbolName, outputPath);
  
  if (!outputPath) {
    // Results are already printed by analyzeSymbolUsage if no outputPath
    console.log('Analysis complete.');
  } else {
    console.log(`Results saved to ${outputPath} (line/character positions are 0-based)`);
  }
} catch (error) {
  console.error('Error analyzing symbol usage:', error);
} 