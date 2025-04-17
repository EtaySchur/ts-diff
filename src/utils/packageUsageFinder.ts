import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';

export interface PackageUsage {
  fileName: string;
  importStatement: string;
  line: number;
  character: number;
  importedSymbols: string[];
  isDynamicImport?: boolean;
  symbolResolutions?: SymbolResolution[];
}

export interface SymbolResolution {
  symbolName: string;
  resolvedFrom: string;
  actualDefinitionPath: string;
  isFromTypeDefinition: boolean;
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
          
          if (node.importClause) {
            // Default import
            if (node.importClause.name) {
              const symbolName = node.importClause.name.text;
              importedSymbols.push(symbolName);
              
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
                  
                  // Try to resolve the symbol definition
                  tryResolveSymbol(element.name, symbolName, symbolResolutions, packageName);
                });
              } else if (ts.isNamespaceImport(namedBindings)) {
                // Namespace import (e.g., import * as React from 'react')
                const symbolName = `* as ${namedBindings.name.text}`;
                importedSymbols.push(symbolName);
                
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
            symbolResolutions
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
          isDynamicImport: true
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
          isDynamicImport: true
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
      
      resolutions.push({
        symbolName,
        resolvedFrom: importPackageName,
        actualDefinitionPath: declarationPath,
        isFromTypeDefinition
      });
    } catch (error) {
      console.error(`Error resolving symbol ${symbolName}:`, error);
    }
  }
  
  // Process all source files
  for (const sourceFile of program.getSourceFiles()) {
    // Skip declaration files and node_modules files
    if (sourceFile.isDeclarationFile || sourceFile.fileName.includes('node_modules')) {
      continue;
    }
    
    // Start the recursive visit from the source file
    visitNode(sourceFile, sourceFile);
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
  
  results.forEach((usage, index) => {
    console.log(`[${index + 1}] ${path.relative(process.cwd(), usage.fileName)}:${usage.line}:${usage.character}`);
    console.log(`    Import: ${usage.importStatement.trim()}`);
    console.log(`    Symbols: ${usage.importedSymbols.join(', ')}`);
    if (usage.isDynamicImport) {
      console.log(`    Type: Dynamic Import`);
    }
    
    // Print resolution information
    if (usage.symbolResolutions && usage.symbolResolutions.length > 0) {
      console.log(`    Symbol Resolutions:`);
      usage.symbolResolutions.forEach(resolution => {
        console.log(`      - ${resolution.symbolName}`);
        console.log(`        Imported from: ${resolution.resolvedFrom}`);
        console.log(`        Actual definition: ${resolution.actualDefinitionPath}`);
        if (resolution.isFromTypeDefinition) {
          console.log(`        ⚠️  WARNING: This symbol is actually defined in a type declaration package (@types/${extractPackageNameFromTypeDef(resolution.actualDefinitionPath)})`);
        }
      });
    }
    
    console.log('---');
  });
}

// Function to analyze package usage and save it to a JSON file
export function analyzeAndSavePackageUsage(
  projectRoot: string,
  packageName: string,
  outputPath?: string
): void {
  const results = findPackageUsage(projectRoot, packageName);
  printPackageUsage(results);
  
  if (outputPath) {
    fs.writeFileSync(
      outputPath, 
      JSON.stringify(results, null, 2),
      'utf8'
    );
    console.log(`\nResults saved to ${outputPath}`);
  }
} 