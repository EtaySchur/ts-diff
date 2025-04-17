import * as path from 'path';
import { analyzeImports, printImportResults } from './utils/importAnalyzer';

// Get the project root directory
const projectRoot = path.resolve(__dirname, '..');

// Run the import analysis
try {
  console.log('Analyzing imports in the project...');
  const results = analyzeImports(projectRoot);
  
  console.log(`\nFound ${results.length} imports in the project\n`);
  printImportResults(results);
  
  // Example: Filter for react-router-dom imports
  const reactRouterImports = results.filter(result => 
    result.importedFrom === 'react-router-dom'
  );
  
  if (reactRouterImports.length > 0) {
    console.log('\n=== react-router-dom imports ===');
    printImportResults(reactRouterImports);
  }
} catch (error) {
  console.error('Error analyzing imports:', error);
} 