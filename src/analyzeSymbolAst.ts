import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';

// Interface for the output data
interface SymbolUsageInfo {
  filePath: string;            // Path to the file
  packageName: string;         // Name of the package
  symbolName: string;          // Name of the imported symbol
  importStatement: string;     // Full import statement
  line: number;                // Line number of the import
  character: number;           // Character position in the line
}

/**
 * Analyzes a project directory to find imports of a specific package and symbol
 * @param projectRoot Path to the project root directory
 * @param packageName Name of the package to search for
 * @param symbolName Name of the symbol to find usages of (or '*' for all symbols)
 * @returns Array of symbol usage information objects
 */
export function analyzeSymbolImports(
  projectRoot: string,
  packageName: string,
  symbolName: string = '*'
): SymbolUsageInfo[] {
  // Create compiler options for parsing JavaScript and TypeScript files
  let compilerOptions: ts.CompilerOptions = {
    allowJs: true,
    checkJs: true,
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    resolveJsonModule: true,
    esModuleInterop: true,
    jsx: ts.JsxEmit.React
  };

  // Try to read tsconfig.json if it exists
  let parsedConfig: ts.ParsedCommandLine | undefined;
  const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
  
  if (fs.existsSync(tsconfigPath)) {
    try {
      const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
      if (!configFile.error) {
        parsedConfig = ts.parseJsonConfigFileContent(
          configFile.config,
          ts.sys,
          projectRoot
        );
        // Merge with our essential options
        compilerOptions = { ...compilerOptions, ...parsedConfig.options };
      }
    } catch (error) {
      console.warn(`Warning: Error reading tsconfig.json: ${error}. Using default compiler options.`);
    }
  }

  // Get all .js, .jsx, .ts, .tsx files
  const extensions = ['.js', '.jsx', '.ts', '.tsx'];
  const fileNames: string[] = [];

  // Function to read files recursively
  function readFilesRecursively(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      if (fs.statSync(fullPath).isDirectory() && !fullPath.includes('node_modules')) {
        readFilesRecursively(fullPath);
      } else {
        const ext = path.extname(fullPath);
        if (extensions.includes(ext)) {
          fileNames.push(fullPath);
        }
      }
    }
  }

  // Get source files from tsconfig or by scanning the directory
  if (parsedConfig && parsedConfig.fileNames.length > 0) {
    fileNames.push(...parsedConfig.fileNames);
  } else {
    readFilesRecursively(projectRoot);
  }

  // Create program from the files
  const program = ts.createProgram(fileNames, compilerOptions);
  
  const results: SymbolUsageInfo[] = [];

  // Helper function to find the exact character position of a symbol in an import statement
  function findSymbolPosition(sourceFile: ts.SourceFile, importStatement: string, symbolName: string, lineStart: number): number {
    // Get the line containing the import
    const lineText = sourceFile.text.split('\n')[lineStart];
    if (!lineText) return 0;
    
    // Try to find the exact position of the symbol in the line
    const regex = new RegExp(`\\b${symbolName}\\b`);
    const match = regex.exec(lineText);
    
    if (match) {
      return match.index;
    }
    
    // If exact match not found, provide a fallback
    return 0;
  }

  // Define a visitor function to traverse the AST
  function visitNode(sourceFile: ts.SourceFile, node: ts.Node): void {
    // Check for ES6 static imports
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      if (ts.isStringLiteral(node.moduleSpecifier) && 
          node.moduleSpecifier.text === packageName) {
        
        try {
          // Get the full import statement
          const importStatement = node.getText(sourceFile);
          
          // Get position of the import declaration
          const pos = node.getStart(sourceFile);
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
          
          let importedSymbols: string[] = [];
          let symbolPositions: Map<string, number> = new Map();
          
          // Handle default import: import React from 'react'
          if (node.importClause?.name) {
            const defaultSymbol = node.importClause.name.text;
            importedSymbols.push(defaultSymbol);
            // Store symbol position
            const symbolPos = node.importClause.name.getStart(sourceFile);
            const { character } = sourceFile.getLineAndCharacterOfPosition(symbolPos);
            symbolPositions.set(defaultSymbol, character);
          }
          
          // Handle named imports: import { useState, useEffect } from 'react'
          if (node.importClause?.namedBindings) {
            if (ts.isNamedImports(node.importClause.namedBindings)) {
              // Individual named imports
              for (const element of node.importClause.namedBindings.elements) {
                const elementName = element.name.text;
                // If element has a different local name via 'as', use the original name
                const importName = element.propertyName ? element.propertyName.text : elementName;
                
                importedSymbols.push(importName);
                
                // Get the position of this specific import element
                const elementPos = element.getStart(sourceFile);
                const { character } = sourceFile.getLineAndCharacterOfPosition(elementPos);
                symbolPositions.set(importName, character);
              }
            } else if (ts.isNamespaceImport(node.importClause.namedBindings)) {
              // Namespace import: import * as React from 'react'
              importedSymbols.push('*');
              // Store namespace position
              const namespacePos = node.importClause.namedBindings.getStart(sourceFile);
              const { character } = sourceFile.getLineAndCharacterOfPosition(namespacePos);
              symbolPositions.set('*', character);
            }
          }
          
          // If symbol name is '*', add all symbols, otherwise filter for the specific symbol
          if (symbolName === '*') {
            // Add all imported symbols
            for (const symbol of importedSymbols) {
              results.push({
                filePath: sourceFile.fileName,
                packageName,
                symbolName: symbol,
                importStatement,
                line,
                character: symbolPositions.get(symbol) || findSymbolPosition(sourceFile, importStatement, symbol, line)
              });
            }
          } else {
            // Only add the specific symbol if it's imported
            if (importedSymbols.includes(symbolName) || importedSymbols.includes('*')) {
              results.push({
                filePath: sourceFile.fileName,
                packageName,
                symbolName,
                importStatement,
                line,
                character: symbolPositions.get(symbolName) || findSymbolPosition(sourceFile, importStatement, symbolName, line)
              });
            }
          }
        } catch (error) {
          console.error(`Error processing import in ${sourceFile.fileName}:`, error);
        }
      }
    }
    
    // Check for CommonJS require statements: require('package-name')
    if (ts.isCallExpression(node) && 
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require' &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0]) &&
        node.arguments[0].text === packageName) {
      
      try {
        // Get the full require statement text
        const importStatement = node.parent?.getText(sourceFile) || node.getText(sourceFile);
        
        // Get position of the require statement
        const pos = node.getStart(sourceFile);
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
        
        // Determine which symbols are being used from the required module
        let importedSymbols: string[] = [];
        let symbolPositions: Map<string, number> = new Map();
        
        // Check the parent node to see how require is being used
        let parent = node.parent;
        
        // For variable declarations: const x = require('pkg')
        if (parent && ts.isVariableDeclaration(parent)) {
          const varName = parent.name.getText(sourceFile);
          
          // For object destructuring: const { x, y } = require('pkg')
          if (ts.isObjectBindingPattern(parent.name)) {
            const bindingElements = parent.name.elements;
            bindingElements.forEach(element => {
              if (ts.isBindingElement(element) && element.name) {
                const elementName = element.name.getText(sourceFile);
                // If element has a property name, use it; otherwise use the element name
                const importName = element.propertyName ? element.propertyName.getText(sourceFile) : elementName;
                
                importedSymbols.push(importName);
                
                // Get the position of this specific binding element
                const elementPos = element.getStart(sourceFile);
                const { character } = sourceFile.getLineAndCharacterOfPosition(elementPos);
                symbolPositions.set(importName, character);
              }
            });
          } else {
            // For simple assignment: const pkg = require('pkg')
            // In this case, we're importing the whole package
            importedSymbols.push('*');
            
            // Get the position of the variable name
            const namePos = parent.name.getStart(sourceFile);
            const { character } = sourceFile.getLineAndCharacterOfPosition(namePos);
            symbolPositions.set('*', character);
          }
          
          // If symbol name is '*', add all symbols, otherwise filter for the specific symbol
          if (symbolName === '*') {
            // Add all imported symbols
            for (const symbol of importedSymbols) {
              results.push({
                filePath: sourceFile.fileName,
                packageName,
                symbolName: symbol,
                importStatement,
                line,
                character: symbolPositions.get(symbol) || findSymbolPosition(sourceFile, importStatement, symbol, line)
              });
            }
          } else {
            // Only add the specific symbol if it's imported
            if (importedSymbols.includes(symbolName) || importedSymbols.includes('*')) {
              results.push({
                filePath: sourceFile.fileName,
                packageName,
                symbolName,
                importStatement,
                line,
                character: symbolPositions.get(symbolName) || findSymbolPosition(sourceFile, importStatement, symbolName, line)
              });
            }
          }
        }
      } catch (error) {
        console.error(`Error processing require in ${sourceFile.fileName}:`, error);
      }
    }
    
    // Continue traversing the AST
    ts.forEachChild(node, node => visitNode(sourceFile, node));
  }
  
  // Process all source files
  for (const sourceFile of program.getSourceFiles()) {
    // Skip declaration files and node_modules files
    if (sourceFile.isDeclarationFile || sourceFile.fileName.includes('node_modules')) {
      continue;
    }
    
    // Start the recursive traversal
    visitNode(sourceFile, sourceFile);
  }
  
  return results;
}

// Command line interface
if (require.main === module) {
  // Get command line arguments
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Please provide required arguments');
    console.error('Usage: npm run analyze-symbol-ast -- <project-path> <package-name> [symbol-name] [output-file]');
    process.exit(1);
  }
  
  const projectPath = args[0];
  const packageName = args[1];
  const symbolName = args.length > 2 ? args[2] : '*';
  const outputPath = args.length > 3 ? args[3] : undefined;
  
  try {
    console.log(`Analyzing imports of ${symbolName === '*' ? 'all symbols' : symbolName} from ${packageName} in ${projectPath}...`);
    
    // Run the analysis
    const results = analyzeSymbolImports(projectPath, packageName, symbolName);
    
    // Print results
    console.log(`Found ${results.length} import${results.length === 1 ? '' : 's'}`);
    
    // Save to file if output path is provided
    if (outputPath) {
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
      console.log(`Results saved to ${outputPath}`);
    } else {
      // Otherwise print to console
      console.log(JSON.stringify(results, null, 2));
    }
  } catch (error) {
    console.error('Error analyzing symbol imports:', error);
    process.exit(1);
  }
} 