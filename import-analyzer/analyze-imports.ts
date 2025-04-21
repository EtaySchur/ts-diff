#!/usr/bin/env node

import * as fs from 'fs';
import * as path from 'path';
import { parse, ParserOptions } from '@babel/parser';
import traverse from '@babel/traverse';
import { Node, ImportDeclaration, VariableDeclarator, ImportSpecifier } from '@babel/types';

// Define result interface
interface ImportResult {
  fileName: string;
  importStatement: string;
  line: number;
  character: number;
  importedSymbol: string;
  importStyle: 'ES6' | 'CommonJS';
}

// Stats interface
interface AnalysisStats {
  filesProcessed: number;
  filesSkipped: number;
  importCount: number;
}

// Process command line arguments
const [,, projectPath, packageName, symbolName, outputFile, verboseArg] = process.argv;
const verbose = verboseArg === '--verbose' || verboseArg === '-v';

if (!projectPath || !packageName || !symbolName) {
  console.error('Usage: node analyze-imports.js <projectPath> <packageName> <symbolName> [outputFile] [--verbose]');
  process.exit(1);
}

// Helper function for logging in verbose mode
function logVerbose(...args: any[]): void {
  if (verbose) {
    console.log(...args);
  }
}

// Results array
const results: ImportResult[] = [];

// Stats object
const stats: AnalysisStats = {
  filesProcessed: 0,
  filesSkipped: 0,
  importCount: 0
};

// Function to check if a file is JavaScript or TypeScript
function isJsOrTsFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.js', '.jsx', '.ts', '.tsx'].includes(ext);
}

// Function to read a file and analyze imports
function analyzeFile(filePath: string): void {
  stats.filesProcessed++;
  
  try {
    // Convert to absolute path if it's a relative path
    const absoluteFilePath = path.isAbsolute(filePath) ? 
      filePath : path.resolve(process.cwd(), filePath);
    
    const content = fs.readFileSync(absoluteFilePath, 'utf8');
    const extension = path.extname(absoluteFilePath).toLowerCase();
    
    // Parse the file content into an AST
    const parserOptions: ParserOptions = {
      sourceType: 'module',
      plugins: [
        'jsx',
        'typescript',
        'decorators-legacy',
        'classProperties',
        'objectRestSpread',
        'dynamicImport',
        'optionalChaining',
        'nullishCoalescingOperator',
      ],
      tokens: true,
    };
    
    // Add extension-specific options
    if (['.jsx', '.tsx'].includes(extension)) {
      parserOptions.plugins = [...parserOptions.plugins || [], 'jsx'];
    }
    
    let ast;
    try {
      ast = parse(content, parserOptions);
    } catch (parseError) {
      // Handle parsing errors gracefully
      logVerbose(`Warning: Could not parse file ${absoluteFilePath}. Skipping.`);
      stats.filesSkipped++;
      return;
    }

    // Traverse the AST to find imports
    try {
      traverse(ast, {
        ImportDeclaration(nodePath) {
          const node = nodePath.node as ImportDeclaration;
          const importSource = node.source.value;
          
          // Check if the import is from the package we're interested in
          if (importSource === packageName || importSource.startsWith(`${packageName}/`)) {
            const importStatement = content.slice(node.start!, node.end!);
            const importStyle = 'ES6';
            
            // Check each specifier to see if our symbol is imported
            node.specifiers.forEach(specifier => {
              if ((specifier.type === 'ImportSpecifier' && 
                   'imported' in specifier && 
                   'name' in specifier.imported && 
                   specifier.imported.name === symbolName) ||
                  (specifier.type === 'ImportDefaultSpecifier' && 
                   symbolName === 'default') ||
                  (specifier.type === 'ImportNamespaceSpecifier' && 
                   symbolName === '*')) {
                     
                // Get the local imported name (in case of renaming)
                const importedSymbol = specifier.local!.name;
                
                // Get the exact position from the AST node location data
                // For ImportSpecifier, we can use the location of the imported/local property
                let positionLine = 0;
                let positionChar = 0;
                
                if (specifier.type === 'ImportSpecifier' && specifier.loc) {
                  // For named imports, use the imported identifier's location
                  positionLine = specifier.loc.start.line - 1; // Convert to 0-based
                  positionChar = specifier.loc.start.column;
                } else if (specifier.type === 'ImportDefaultSpecifier' && specifier.loc) {
                  // For default imports, use the local identifier's location
                  positionLine = specifier.loc.start.line - 1; // Convert to 0-based
                  positionChar = specifier.loc.start.column;
                } else if (specifier.type === 'ImportNamespaceSpecifier' && specifier.loc) {
                  // For namespace imports, use the local identifier's location
                  positionLine = specifier.loc.start.line - 1; // Convert to 0-based
                  positionChar = specifier.loc.start.column + 1; // +1 to account for the "*"
                } else if (node.loc) {
                  // Fallback to import declaration location
                  positionLine = node.loc.start.line - 1; // Convert to 0-based
                  positionChar = node.loc.start.column;
                }
                
                results.push({
                  fileName: absoluteFilePath,
                  importStatement,
                  line: positionLine,
                  character: positionChar,
                  importedSymbol,
                  importStyle
                });
              }
            });
          }
        },
        
        // Handle CommonJS require statements
        VariableDeclarator(nodePath) {
          const node = nodePath.node as VariableDeclarator;
          
          // Check if it's a require statement
          if (node.init && 
              node.init.type === 'CallExpression' && 
              'name' in node.init.callee && 
              node.init.callee.name === 'require') {
              
            const args = node.init.arguments;
            
            // Check if requiring the package we're looking for
            if (args.length > 0 && 
                args[0].type === 'StringLiteral' && 
                (args[0].value === packageName || args[0].value.startsWith(`${packageName}/`))) {
                
              // Get parent node which is the variable declaration
              const parentNode = nodePath.parent;
              const importStatement = content.slice(parentNode.start!, parentNode.end!);
              const importStyle = 'CommonJS';
              
              // Handle different destructuring patterns
              if (node.id.type === 'ObjectPattern') {
                // Destructured require: const { symbol } = require('package')
                node.id.properties.forEach(prop => {
                  if (prop.type === 'ObjectProperty' && 
                      'name' in prop.key && 
                      'name' in prop.value && 
                      ((prop.key.name === symbolName) || 
                       (prop.value.name === symbolName))) {
                    
                    const importedSymbol = prop.value.name;
                    
                    // Get position directly from the AST node
                    let positionLine = 0;
                    let positionChar = 0;
                    
                    if (prop.loc) {
                      // Use the property's location in the AST
                      positionLine = prop.loc.start.line - 1; // Convert to 0-based
                      positionChar = prop.loc.start.column;
                    } else if (parentNode.loc) {
                      // Fallback to parent node location
                      positionLine = parentNode.loc.start.line - 1; // Convert to 0-based
                      positionChar = parentNode.loc.start.column;
                    }
                    
                    results.push({
                      fileName: absoluteFilePath,
                      importStatement,
                      line: positionLine,
                      character: positionChar,
                      importedSymbol,
                      importStyle
                    });
                  }
                });
              } else if (node.id.type === 'Identifier') {
                // Direct require: const pkg = require('package')
                // If we're looking for the default export
                if (symbolName === 'default') {
                  const importedSymbol = node.id.name;
                  
                  // Get position directly from the AST node
                  let positionLine = 0;
                  let positionChar = 0;
                  
                  if (node.id.loc) {
                    positionLine = node.id.loc.start.line - 1; // Convert to 0-based
                    positionChar = node.id.loc.start.column;
                  } else if (parentNode.loc) {
                    positionLine = parentNode.loc.start.line - 1; // Convert to 0-based
                    positionChar = parentNode.loc.start.column;
                  }
                  
                  results.push({
                    fileName: absoluteFilePath,
                    importStatement,
                    line: positionLine,
                    character: positionChar,
                    importedSymbol,
                    importStyle
                  });
                }
              }
            }
          }
        }
      });
    } catch (traverseError) {
      logVerbose(`Warning: Error traversing AST in file ${absoluteFilePath}. Skipping.`);
      stats.filesSkipped++;
    }
  } catch (error) {
    // Handle general file processing errors gracefully
    logVerbose(`Warning: Could not process file ${filePath}: ${(error as Error).message}`);
    stats.filesSkipped++;
  }
}

// Function to recursively traverse directories
function traverseDirectory(dir: string): void {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const filePath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      // Skip node_modules and hidden directories
      if (file.name !== 'node_modules' && !file.name.startsWith('.')) {
        traverseDirectory(filePath);
      }
    } else if (isJsOrTsFile(filePath)) {
      analyzeFile(filePath);
    }
  }
}

// Function to write results to a file
function writeResultsToFile(results: ImportResult[], outputFile: string): void {
  try {
    const jsonResults = JSON.stringify(results, null, 2);
    fs.writeFileSync(outputFile, jsonResults);
    logVerbose(`Results successfully written to ${outputFile}`);
  } catch (error) {
    console.error(`Error writing to file ${outputFile}:`, (error as Error).message);
  }
}

// Start the analysis
try {
  logVerbose(`Scanning ${projectPath} for imports of symbol "${symbolName}" from package "${packageName}"...`);
  
  const startTime = Date.now();
  
  traverseDirectory(projectPath);
  
  // Record import count
  stats.importCount = results.length;
  
  const endTime = Date.now();
  const duration = (endTime - startTime) / 1000; // in seconds
  
  // Print summary
  if (verbose) {
    logVerbose('\nAnalysis Summary:');
    logVerbose('------------------------');
    logVerbose(`Total files processed: ${stats.filesProcessed}`);
    logVerbose(`Files skipped: ${stats.filesSkipped}`);
    logVerbose(`Import occurrences found: ${stats.importCount}`);
    logVerbose(`Analysis duration: ${duration.toFixed(2)} seconds`);
    logVerbose('------------------------');
  }
  
  // If an output file is specified, write results to the file
  if (outputFile) {
    writeResultsToFile(results, outputFile);
  } else {
    // Otherwise print to console
    // Always output the results, regardless of verbose mode
    console.log(JSON.stringify(results, null, 2));
  }
} catch (error) {
  console.error('Error:', (error as Error).message);
  process.exit(1);
} 