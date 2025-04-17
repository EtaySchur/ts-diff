import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';

export interface SymbolUsage {
  symbolName: string;
  locations: Array<{
    line: number;
    character: number;
    context: string; // Surrounding code snippet for context
  }>;
}

export interface PackageUsage {
  fileName: string;
  importStatement: string;
  line: number;
  character: number;
  importedSymbols: string[];
  isDynamicImport?: boolean;
  symbolResolutions?: SymbolResolution[];
  symbolUsages?: SymbolUsage[]; // New property to track symbol usages
}

export interface SymbolResolution {
  symbolName: string;
  resolvedFrom: string;
  actualDefinitionPath: string;
  isFromTypeDefinition: boolean;
  importPosition?: {
    line: number;
    character: number;
  };
}

export function findPackageUsage(projectRoot: string, packageName: string): PackageUsage[] {
  // Read tsconfig.json
  const tsconfigPath = path.join(projectRoot, 'tsconfig.json');
  if (!fs.existsSync(tsconfigPath)) {
    throw new Error('tsconfig.json not found');
  }
  
  const configFile = ts.readConfigFile(tsconfigPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(`Error reading tsconfig.json: ${configFile.error.messageText}`);
  }
  
  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    projectRoot
  );
  
  // Create program from tsconfig
  const program = ts.createProgram({
    rootNames: parsedConfig.fileNames,
    options: parsedConfig.options
  });
  
  const typeChecker = program.getTypeChecker();
  const results: PackageUsage[] = [];
  
  // Map to store imported symbols by file for tracking usages
  const importedSymbolsByFile = new Map<string, Map<string, ts.Identifier>>();
  
  // Define the visit function outside the loop to fix strict mode error
  function visitNode(node: ts.Node, sourceFile: ts.SourceFile): void {
    // Check for static imports
    if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
      if (ts.isStringLiteral(node.moduleSpecifier) && 
          node.moduleSpecifier.text === packageName) {
        
        try {
          // Get position of import statement
          const pos = node.getStart(sourceFile);
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
          
          // Get imported symbols
          const importedSymbols: string[] = [];
          const symbolResolutions: SymbolResolution[] = [];
          
          // Create a new Map for this file if it doesn't exist
          if (!importedSymbolsByFile.has(sourceFile.fileName)) {
            importedSymbolsByFile.set(sourceFile.fileName, new Map<string, ts.Identifier>());
          }
          const fileSymbolsMap = importedSymbolsByFile.get(sourceFile.fileName)!;
          
          if (node.importClause) {
            // Default import
            if (node.importClause.name) {
              const symbolName = node.importClause.name.text;
              importedSymbols.push(symbolName);
              
              // Store the import node for later usage tracking
              fileSymbolsMap.set(symbolName, node.importClause.name);
              
              // Try to resolve the symbol definition
              tryResolveSymbol(node.importClause.name, symbolName, symbolResolutions, packageName);
            }
            
            // Named imports
            const namedBindings = node.importClause.namedBindings;
            if (namedBindings) {
              if (ts.isNamedImports(namedBindings)) {
                namedBindings.elements.forEach(element => {
                  const symbolName = element.name.text;
                  importedSymbols.push(symbolName);
                  
                  // Store the import node for later usage tracking
                  fileSymbolsMap.set(symbolName, element.name);
                  
                  // Try to resolve the symbol definition
                  tryResolveSymbol(element.name, symbolName, symbolResolutions, packageName);
                });
              } else if (ts.isNamespaceImport(namedBindings)) {
                // Namespace import (e.g., import * as React from 'react')
                const symbolName = `* as ${namedBindings.name.text}`;
                importedSymbols.push(symbolName);
                
                // Store the import node for later usage tracking
                fileSymbolsMap.set(namedBindings.name.text, namedBindings.name);
                
                // Try to resolve the symbol definition
                tryResolveSymbol(namedBindings.name, namedBindings.name.text, symbolResolutions, packageName);
              }
            }
          } else {
            // Side-effect only import (e.g., import 'package')
            importedSymbols.push('(side-effect only)');
          }
          
          results.push({
            fileName: sourceFile.fileName,
            importStatement: node.getText(sourceFile),
            line: line + 1, // Make line numbers 1-based
            character: character + 1,
            importedSymbols,
            isDynamicImport: false,
            symbolResolutions,
            symbolUsages: [] // Will be populated later
          });
        } catch (error) {
          console.error(`Error processing import in ${sourceFile.fileName}:`, error);
        }
      }
    }
    
    // Check for dynamic imports: import('package-name')
    if (ts.isCallExpression(node) && 
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0]) &&
        node.arguments[0].text === packageName) {
      
      try {
        // Get position of dynamic import
        const pos = node.getStart(sourceFile);
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
        
        results.push({
          fileName: sourceFile.fileName,
          importStatement: node.getText(sourceFile),
          line: line + 1,
          character: character + 1,
          importedSymbols: ['(dynamic import)'],
          isDynamicImport: true,
          symbolUsages: [] // Empty for dynamic imports
        });
      } catch (error) {
        console.error(`Error processing dynamic import in ${sourceFile.fileName}:`, error);
      }
    }
    
    // Check for require statements: require('package-name')
    if (ts.isCallExpression(node) && 
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require' &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0]) &&
        node.arguments[0].text === packageName) {
      
      try {
        // Get position of require statement
        const pos = node.getStart(sourceFile);
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
        
        results.push({
          fileName: sourceFile.fileName,
          importStatement: node.getText(sourceFile),
          line: line + 1,
          character: character + 1,
          importedSymbols: ['(require)'],
          isDynamicImport: true,
          symbolUsages: [] // Empty for require statements
        });
      } catch (error) {
        console.error(`Error processing require in ${sourceFile.fileName}:`, error);
      }
    }
    
    // Recursively visit all child nodes
    ts.forEachChild(node, childNode => visitNode(childNode, sourceFile));
  }
  
  // Helper function to try resolving a symbol's actual definition location
  function tryResolveSymbol(
    node: ts.Node,
    symbolName: string,
    resolutions: SymbolResolution[],
    importPackageName: string
  ): void {
    try {
      // Get symbol at location
      const symbol = typeChecker.getSymbolAtLocation(node);
      if (!symbol) return;
      
      // Try to get the declaration
      let declaration: ts.Declaration | undefined;
      
      // Check if this is an alias (for imports)
      if (symbol.flags & ts.SymbolFlags.Alias) {
        const aliasedSymbol = typeChecker.getAliasedSymbol(symbol);
        if (aliasedSymbol.declarations && aliasedSymbol.declarations.length > 0) {
          declaration = aliasedSymbol.declarations[0];
        }
      } else if (symbol.declarations && symbol.declarations.length > 0) {
        declaration = symbol.declarations[0];
      }
      
      if (!declaration) return;
      
      // Get source file of the declaration
      const declarationSourceFile = declaration.getSourceFile();
      const declarationPath = declarationSourceFile.fileName;
      
      // Check if it's from a type definition package
      const isFromTypeDefinition = declarationPath.includes('node_modules/@types/');
      let actualPackageName = importPackageName;
      
      if (isFromTypeDefinition) {
        const typePackageName = extractPackageNameFromTypeDef(declarationPath);
        if (typePackageName) {
          actualPackageName = typePackageName;
        }
      }
      
      // Get the position of the import
      const pos = node.getStart();
      const sourceFile = node.getSourceFile();
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
      
      resolutions.push({
        symbolName,
        resolvedFrom: importPackageName,
        actualDefinitionPath: declarationPath,
        isFromTypeDefinition,
        importPosition: {
          line: line + 1, // Make line numbers 1-based
          character: character + 1
        }
      });
    } catch (error) {
      console.error(`Error resolving symbol ${symbolName}:`, error);
    }
  }
  
  // Process all source files to find imports
  for (const sourceFile of program.getSourceFiles()) {
    // Skip declaration files and node_modules files
    if (sourceFile.isDeclarationFile || sourceFile.fileName.includes('node_modules')) {
      continue;
    }
    
    // Start the recursive visit from the source file
    visitNode(sourceFile, sourceFile);
  }
  
  // Now look for usages of the imported symbols
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
    
    // Map to store usages for each symbol
    const usagesBySymbol = new Map<string, SymbolUsage>();
    
    // Create a visitor to find all identifiers in the file
    const visitNodeForUsages = (node: ts.Node) => {
      // Check for identifier usages
      if (ts.isIdentifier(node)) {
        const symbolName = node.text;
        
        // Skip if the symbol was not imported from our target package
        if (!fileSymbolsMap.has(symbolName)) {
          return;
        }
        
        // Skip import declarations (we're looking for usages, not imports)
        if (ts.isImportDeclaration(node.parent) || 
            (node.parent && ts.isImportSpecifier(node.parent)) ||
            (node.parent && ts.isImportClause(node.parent))) {
          return;
        }
        
        // Get position info
        const pos = node.getStart(sourceFile);
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
        
        // Get context (surrounding code)
        const lineText = sourceFile.text.split('\n')[line];
        const context = lineText ? lineText.trim() : '';
        
        // Add to usages
        if (!usagesBySymbol.has(symbolName)) {
          usagesBySymbol.set(symbolName, {
            symbolName,
            locations: []
          });
        }
        
        const symbolUsage = usagesBySymbol.get(symbolName)!;
        symbolUsage.locations.push({
          line: line + 1, // Make line numbers 1-based
          character: character + 1,
          context
        });
      }
      
      // Recursively visit all child nodes
      ts.forEachChild(node, visitNodeForUsages);
    };
    
    // Start the recursive visit to find usages
    visitNodeForUsages(sourceFile);
    
    // Add usage info to the results
    for (const result of results) {
      if (result.fileName === sourceFile.fileName) {
        // Convert usage map to array for the result
        result.symbolUsages = Array.from(usagesBySymbol.values());
      }
    }
  }
  
  return results;
}

// Extract package name from @types path
function extractPackageNameFromTypeDef(path: string): string {
  const match = path.match(/node_modules\/@types\/([^\/]+)/);
  return match ? match[1] : 'unknown';
}

// Function to print package usage results in a readable format
export function printPackageUsage(results: PackageUsage[]): void {
  if (results.length === 0) {
    console.log('No usage found.');
    return;
  }
  
  console.log(`Found ${results.length} usage(s):\n`);
  
  results.forEach(result => {
    console.log(`File: ${result.fileName}`);
    console.log(`Import: ${result.importStatement}`);
    console.log(`At: Line ${result.line}, Character ${result.character}`);
    console.log(`Imported Symbols: ${result.importedSymbols.join(', ')}`);
    
    if (result.symbolResolutions && result.symbolResolutions.length > 0) {
      console.log('Symbol Resolutions:');
      result.symbolResolutions.forEach(resolution => {
        console.log(`  - ${resolution.symbolName} (from ${resolution.resolvedFrom})`);
        console.log(`    Resolved to: ${resolution.actualDefinitionPath}`);
        console.log(`    Is Type Definition: ${resolution.isFromTypeDefinition}`);
      });
    }
    
    if (result.symbolUsages && result.symbolUsages.length > 0) {
      console.log('Symbol Usages:');
      result.symbolUsages.forEach(usage => {
        console.log(`  - ${usage.symbolName} - ${usage.locations.length} usages:`);
        usage.locations.forEach((loc, index) => {
          console.log(`    ${index + 1}. Line ${loc.line}, Character ${loc.character}`);
          console.log(`       Context: ${loc.context}`);
        });
      });
    }
    
    console.log('---------------------------------------------------\n');
  });
}

// Function to analyze package usage and save results to a file
export function analyzeAndSavePackageUsage(
  projectRoot: string,
  packageName: string,
  outputPath?: string
): void {
  console.log(`Analyzing usage of package "${packageName}" in project at ${projectRoot}...`);
  
  try {
    const results = findPackageUsage(projectRoot, packageName);
    
    if (outputPath) {
      // Save to file
      fs.writeFileSync(outputPath, JSON.stringify(results, null, 2), 'utf8');
      console.log(`Results saved to ${outputPath}`);
    } else {
      // Print to console
      printPackageUsage(results);
    }
  } catch (error) {
    console.error('Error analyzing package usage:', error);
  }
} 