import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';
import { PackageUsage, SymbolUsage } from './packageUsageFinder';

export interface SymbolUsageResult {
  filePath: string;
  importStatement: string;
  line: number;  // 0-based line number from TypeScript AST
  character: number;  // 0-based character number
  importedSymbol: string;
  importStyle: string;
  usageLocations: Array<{
    line: number;  // 0-based line number from TypeScript AST
    character: number;  // 0-based character number
    context: string;
  }>;
}

// Helper function for recursive file reading
function readFilesRecursively(dir: string, extensions: string[], fileNames: string[]): void {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory() && !fullPath.includes('node_modules')) {
      readFilesRecursively(fullPath, extensions, fileNames);
    } else {
      const ext = path.extname(fullPath);
      if (extensions.includes(ext)) {
        fileNames.push(fullPath);
      }
    }
  }
}

/**
 * Finds all usages of a specific symbol from a package in the project
 * @param projectRoot Path to the project root
 * @param packageName Name of the package to search for
 * @param symbolName Name of the symbol to find usages of
 * @returns Array of symbol usage information objects
 */
export function findSymbolUsage(
  projectRoot: string,
  packageName: string,
  symbolName: string
): SymbolUsageResult[] {
  // Create options for parsing JavaScript files as well as TypeScript
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
      // Silently use default compiler options
    }
  }

  // Get all .js, .jsx, .ts, .tsx files
  const extensions = ['.js', '.jsx', '.ts', '.tsx'];
  const fileNames: string[] = [];

  // If we have a parsed config, use its file names, otherwise scan the directory
  if (parsedConfig && parsedConfig.fileNames.length > 0) {
    fileNames.push(...parsedConfig.fileNames);
  } else {
    readFilesRecursively(projectRoot, extensions, fileNames);
  }

  // Create program from the files
  const program = ts.createProgram(fileNames, compilerOptions);
  
  const packageUsages: PackageUsage[] = [];
  
  // Map to store imported symbols by file for tracking usages
  const importedSymbolsByFile = new Map<string, Map<string, ts.Identifier>>();
  
  // Process all source files to find imports
  for (const sourceFile of program.getSourceFiles()) {
    // Skip declaration files and node_modules files
    if (sourceFile.isDeclarationFile || sourceFile.fileName.includes('node_modules')) {
      continue;
    }
    
    visitNodeForImports(sourceFile, packageName, symbolName, packageUsages, importedSymbolsByFile);
  }
  
  // Second pass: Find all usages of the imported symbols
  for (const sourceFile of program.getSourceFiles()) {
    // Skip declaration files and node_modules files
    if (sourceFile.isDeclarationFile || sourceFile.fileName.includes('node_modules')) {
      continue;
    }
    
    // Get imported symbols for this file
    const fileSymbolsMap = importedSymbolsByFile.get(sourceFile.fileName);
    if (!fileSymbolsMap || fileSymbolsMap.size === 0) {
      continue; // Skip if no imports from the target package
    }
    
    // If we're only looking for a specific symbol, filter the map
    if (symbolName !== '*') {
      // Keep only the target symbol in the map
      const keysToDelete: string[] = [];
      fileSymbolsMap.forEach((value, key) => {
        if (key !== symbolName) {
          keysToDelete.push(key);
        }
      });
      
      // Delete keys in a separate loop to avoid modifying while iterating
      for (const key of keysToDelete) {
        fileSymbolsMap.delete(key);
      }
      
      // Skip this file if it doesn't import our symbol
      if (fileSymbolsMap.size === 0) {
        continue;
      }
    }
    
    // Map to store usages for each symbol
    const usagesBySymbol = new Map<string, SymbolUsage>();
    
    // Find usages in this file
    visitNodeForUsages(sourceFile, fileSymbolsMap, usagesBySymbol, symbolName);
    
    // Add usage info to the package usages results
    for (const usage of packageUsages) {
      if (usage.fileName === sourceFile.fileName) {
        // Convert usage map to array for the result
        usage.symbolUsages = Array.from(usagesBySymbol.values());
      }
    }
  }
  
  // Convert PackageUsage to SymbolUsageResult
  const results: SymbolUsageResult[] = [];
  
  for (const usage of packageUsages) {
    // For each import of the package
    if (usage.symbolUsages) {
      for (const symbolUsage of usage.symbolUsages) {
        const importedSymbol = symbolName === '*' ? symbolUsage.symbolName : symbolName;
        
        results.push({
          filePath: usage.fileName,
          importStatement: usage.importStatement,
          line: usage.line,  // TypeScript's line number (0-based)
          character: usage.character,
          importedSymbol,
          importStyle: usage.importStyle || 'Unknown',
          usageLocations: symbolUsage.locations
        });
      }
    } else if (symbolName === '*') {
      // If no usages found but we want all imports, include the import itself
      for (const importedSymbol of usage.importedSymbols) {
        // Skip placeholder symbols
        if (importedSymbol.startsWith('(') || importedSymbol === '') continue;
        
        results.push({
          filePath: usage.fileName,
          importStatement: usage.importStatement,
          line: usage.line,  // TypeScript's line number (0-based)
          character: usage.character,
          importedSymbol,
          importStyle: usage.importStyle || 'Unknown',
          usageLocations: []
        });
      }
    }
  }
  
  return results;
}

// Function to visit nodes looking for imports
function visitNodeForImports(
  sourceFile: ts.SourceFile,
  packageName: string,
  symbolName: string,
  packageUsages: PackageUsage[],
  importedSymbolsByFile: Map<string, Map<string, ts.Identifier>>
): void {
  function visitNode(node: ts.Node): void {
    // Check for ES6 static imports
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      if (ts.isStringLiteral(node.moduleSpecifier) && 
          node.moduleSpecifier.text === packageName) {
        
        try {
          // Get position of the module specifier string literal instead of the import statement
          const moduleSpecifier = node.moduleSpecifier;
          const pos = moduleSpecifier.getStart(sourceFile) + 1; // +1 to skip the opening quote
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
          
          // Get imported symbols
          const importedSymbols: string[] = [];
          
          // Create a new Map for this file if it doesn't exist
          if (!importedSymbolsByFile.has(sourceFile.fileName)) {
            importedSymbolsByFile.set(sourceFile.fileName, new Map<string, ts.Identifier>());
          }
          const fileSymbolsMap = importedSymbolsByFile.get(sourceFile.fileName)!;
          
          // Store the import statement for context
          const importStatement = node.getText(sourceFile);
          
          if (node.importClause) {
            // Default import
            if (node.importClause.name) {
              const importedSymbolName = node.importClause.name.text;
              importedSymbols.push(importedSymbolName);
              
              // Store the import node for later usage tracking
              fileSymbolsMap.set(importedSymbolName, node.importClause.name);
            }
            
            // Named imports
            const namedBindings = node.importClause.namedBindings;
            if (namedBindings) {
              if (ts.isNamedImports(namedBindings)) {
                namedBindings.elements.forEach(element => {
                  const importedSymbolName = element.name.text;
                  importedSymbols.push(importedSymbolName);
                  
                  // Store the import node for later usage tracking
                  fileSymbolsMap.set(importedSymbolName, element.name);
                  
                  // If this is our target symbol, get its exact position
                  if (importedSymbolName === symbolName || symbolName === '*') {
                    const symbolPos = element.name.getStart(sourceFile);
                    const symbolLocation = sourceFile.getLineAndCharacterOfPosition(symbolPos);
                    
                    // Only add to results if this is the target symbol or we want all symbols
                    if (importedSymbolName === symbolName || symbolName === '*') {
                      packageUsages.push({
                        fileName: sourceFile.fileName,
                        importStatement: importStatement,
                        line: symbolLocation.line, // Use the exact line of the symbol
                        character: symbolLocation.character,
                        importedSymbols,
                        importStyle: 'ES6Import',
                        isDynamicImport: false,
                        symbolUsages: [] // Will be populated later
                      });
                    }
                  }
                });
              } else if (ts.isNamespaceImport(namedBindings)) {
                // Namespace import (e.g., import * as React from 'react')
                const nsName = namedBindings.name.text;
                const importedSymbolName = `* as ${nsName}`;
                importedSymbols.push(importedSymbolName);
                
                // Store the import node for later usage tracking
                fileSymbolsMap.set(nsName, namedBindings.name);
                
                // Add to results if we want all symbols
                if (symbolName === '*') {
                  const symbolPos = namedBindings.name.getStart(sourceFile);
                  const symbolLocation = sourceFile.getLineAndCharacterOfPosition(symbolPos);
                  
                  packageUsages.push({
                    fileName: sourceFile.fileName,
                    importStatement: importStatement,
                    line: symbolLocation.line,
                    character: symbolLocation.character,
                    importedSymbols,
                    importStyle: 'ES6Import',
                    isDynamicImport: false,
                    symbolUsages: [] // Will be populated later
                  });
                }
              }
            }
          } else {
            // Side-effect only import (e.g., import 'package')
            importedSymbols.push('(side-effect only)');
            
            // Add to results if we want all symbols
            if (symbolName === '*') {
              packageUsages.push({
                fileName: sourceFile.fileName,
                importStatement: importStatement,
                line: line,
                character: character,
                importedSymbols,
                importStyle: 'ES6Import',
                isDynamicImport: false,
                symbolUsages: [] // Will be populated later
              });
            }
          }
        } catch (error) {
          // Skip errors in processing imports
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
        // Get position of the package name string literal without the quotes
        const moduleSpecifier = node.arguments[0];
        const pos = moduleSpecifier.getStart(sourceFile) + 1; // +1 to skip the opening quote
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
        
        // Track which symbols are being used from the required module
        const importedSymbols: string[] = [];
        let importStyle: 'CommonJS' | 'RequireJS' | 'Unknown' = 'CommonJS';
        
        // Store the import statement for context
        const importStatement = node.parent ? node.parent.getText(sourceFile) : node.getText(sourceFile);
        
        // Check the parent node to see how require is being used
        let parent = node.parent;
        
        // If it's in a variable declaration, extract the variable name
        if (parent && ts.isVariableDeclaration(parent)) {
          const varName = parent.name.getText(sourceFile);
          
          // For object destructuring: const { x, y } = require('pkg')
          if (ts.isObjectBindingPattern(parent.name)) {
            const bindingElements = parent.name.elements;
            bindingElements.forEach(element => {
              if (ts.isBindingElement(element) && element.name) {
                const elementSymbolName = element.name.getText(sourceFile);
                importedSymbols.push(elementSymbolName);
                
                // Add to tracking map if it's an identifier
                if (ts.isIdentifier(element.name)) {
                  if (!importedSymbolsByFile.has(sourceFile.fileName)) {
                    importedSymbolsByFile.set(sourceFile.fileName, new Map<string, ts.Identifier>());
                  }
                  importedSymbolsByFile.get(sourceFile.fileName)!.set(elementSymbolName, element.name);
                  
                  // If this is our target symbol, get its exact position
                  if (elementSymbolName === symbolName || symbolName === '*') {
                    const symbolPos = element.name.getStart(sourceFile);
                    const symbolLocation = sourceFile.getLineAndCharacterOfPosition(symbolPos);
                    
                    packageUsages.push({
                      fileName: sourceFile.fileName,
                      importStatement: importStatement,
                      line: symbolLocation.line, // Use the exact line of the symbol
                      character: symbolLocation.character,
                      importedSymbols,
                      importStyle,
                      isDynamicImport: false,
                      symbolUsages: [] // Will be populated later
                    });
                  }
                }
              }
            });
          } else {
            // For simple assignment: const pkg = require('pkg')
            importedSymbols.push(varName);
            
            // Add to tracking map if it's an identifier
            if (ts.isIdentifier(parent.name)) {
              if (!importedSymbolsByFile.has(sourceFile.fileName)) {
                importedSymbolsByFile.set(sourceFile.fileName, new Map<string, ts.Identifier>());
              }
              importedSymbolsByFile.get(sourceFile.fileName)!.set(varName, parent.name);
              
              // If we're looking for all symbols, or this matches our target
              if (symbolName === '*' || varName === symbolName) {
                const symbolPos = parent.name.getStart(sourceFile);
                const symbolLocation = sourceFile.getLineAndCharacterOfPosition(symbolPos);
                
                packageUsages.push({
                  fileName: sourceFile.fileName,
                  importStatement: importStatement,
                  line: symbolLocation.line,
                  character: symbolLocation.character,
                  importedSymbols,
                  importStyle,
                  isDynamicImport: false,
                  symbolUsages: [] // Will be populated later
                });
              }
            }
          }
        } else if (parent && ts.isPropertyAccessExpression(parent)) {
          // For direct property access: require('pkg').something
          const propName = parent.name.getText(sourceFile);
          importedSymbols.push(propName);
          
          // If we're looking for all symbols, or this matches our target
          if (symbolName === '*' || propName === symbolName) {
            const symbolPos = parent.name.getStart(sourceFile);
            const symbolLocation = sourceFile.getLineAndCharacterOfPosition(symbolPos);
            
            packageUsages.push({
              fileName: sourceFile.fileName,
              importStatement: importStatement,
              line: symbolLocation.line,
              character: symbolLocation.character,
              importedSymbols,
              importStyle,
              isDynamicImport: false,
              symbolUsages: [] // Will be populated later
            });
          }
        } else {
          // Add package name as the default imported symbol for standalone requires
          importedSymbols.push(packageName);
          
          // If we're looking for all symbols
          if (symbolName === '*') {
            packageUsages.push({
              fileName: sourceFile.fileName,
              importStatement: importStatement,
              line: line,
              character: character,
              importedSymbols,
              importStyle,
              isDynamicImport: false,
              symbolUsages: [] // Will be populated later
            });
          }
        }
      } catch (error) {
        // Skip errors in processing CommonJS requires
      }
    }
    
    ts.forEachChild(node, visitNode);
  }
  
  // Start the recursive visit from the source file
  visitNode(sourceFile);
}

// Function to visit nodes looking for symbol usages
function visitNodeForUsages(
  sourceFile: ts.SourceFile,
  fileSymbolsMap: Map<string, ts.Identifier>,
  usagesBySymbol: Map<string, SymbolUsage>,
  symbolName: string
): void {
  function visitNode(node: ts.Node): void {
    // Check for identifier usages
    if (ts.isIdentifier(node)) {
      const nodeSymbolName = node.text;
      
      // Skip if the symbol was not imported from our target package
      if (!fileSymbolsMap.has(nodeSymbolName)) {
        return;
      }
      
      // Skip import declarations (we're looking for usages, not imports)
      if (ts.isImportDeclaration(node.parent) || 
          (node.parent && ts.isImportSpecifier(node.parent)) ||
          (node.parent && ts.isImportClause(node.parent)) ||
          // Also skip require declarations
          (node.parent && ts.isCallExpression(node.parent) && node.getText() === 'require')) {
        return;
      }
      
      // Skip if this is a property name in object literal
      if (node.parent && ts.isPropertyAssignment(node.parent) && node.parent.name === node) {
        return;
      }
      
      // Get position info
      const pos = node.getStart(sourceFile);
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
      
      // Get context (surrounding code)
      const lineText = sourceFile.text.split('\n')[line];
      const context = lineText ? lineText.trim() : '';
      
      // Add to usages
      if (!usagesBySymbol.has(nodeSymbolName)) {
        usagesBySymbol.set(nodeSymbolName, {
          symbolName: nodeSymbolName,
          locations: []
        });
      }
      
      const symbolUsage = usagesBySymbol.get(nodeSymbolName)!;
      symbolUsage.locations.push({
        line: line,
        character: character,
        context
      });
    }
    
    // Also check for property access on namespace imports
    if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
      const namespaceName = node.expression.text;
      
      // Check if this is accessing a property on an imported namespace
      if (fileSymbolsMap.has(namespaceName)) {
        const propertyName = node.name.text;
        
        // If we're looking for a specific property on the namespace
        if (symbolName.includes('.')) {
          const [ns, prop] = symbolName.split('.');
          // Skip if this doesn't match our target property
          if (namespaceName !== ns || propertyName !== prop) {
            return;
          }
        }
        
        const fullSymbolName = `${namespaceName}.${propertyName}`;
        
        // Get position info
        const pos = node.getStart(sourceFile);
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
        
        // Get context (surrounding code)
        const lineText = sourceFile.text.split('\n')[line];
        const context = lineText ? lineText.trim() : '';
        
        // Add to usages
        if (!usagesBySymbol.has(fullSymbolName)) {
          usagesBySymbol.set(fullSymbolName, {
            symbolName: fullSymbolName,
            locations: []
          });
        }
        
        const symbolUsage = usagesBySymbol.get(fullSymbolName)!;
        symbolUsage.locations.push({
          line: line,
          character: character,
          context
        });
      }
    }
    
    // Recursively visit all child nodes
    ts.forEachChild(node, visitNode);
  }
  
  // Start the recursive visit
  visitNode(sourceFile);
}

/**
 * Analyzes symbol usage and returns results
 * @param projectRoot Project root path
 * @param packageName Package name to search
 * @param symbolName Symbol name to find usages of ('*' for all symbols)
 * @param outputPath Optional path to save results to
 */
export function analyzeSymbolUsage(
  projectRoot: string,
  packageName: string,
  symbolName: string,
  outputPath?: string
): SymbolUsageResult[] {
  try {
    const results = findSymbolUsage(projectRoot, packageName, symbolName);
    
    // Default output path if none provided
    const defaultOutputPath = path.join(projectRoot, 'symbol_usage_results.json');
    const finalOutputPath = outputPath || defaultOutputPath;
    
    // Save to file
    fs.writeFileSync(finalOutputPath, JSON.stringify(results, null, 2), 'utf8');
    
    return results;
  } catch (error) {
    return [];
  }
} 