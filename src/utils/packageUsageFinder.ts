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
  importStyle?: 'ES6Import' | 'CommonJS' | 'RequireJS' | 'DynamicImport' | 'ESModuleInterop' | 'SystemJS' | 'UMD' | 'GlobalVariable' | 'ImportMaps' | 'AMD' | 'Unknown'; // Extended import style tracking
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
      console.warn(`Warning: Error reading tsconfig.json: ${error}. Using default compiler options.`);
    }
  }

  // Get all .js, .jsx, .ts, .tsx files
  const extensions = ['.js', '.jsx', '.ts', '.tsx'];
  const fileNames: string[] = [];

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

  // If we have a parsed config, use its file names, otherwise scan the directory
  if (parsedConfig && parsedConfig.fileNames.length > 0) {
    fileNames.push(...parsedConfig.fileNames);
  } else {
    readFilesRecursively(projectRoot);
  }

  // Create program from the files
  const program = ts.createProgram(fileNames, compilerOptions);
  
  const typeChecker = program.getTypeChecker();
  const results: PackageUsage[] = [];
  
  // Map to store imported symbols by file for tracking usages
  const importedSymbolsByFile = new Map<string, Map<string, ts.Identifier>>();
  
  // Define the visit function outside the loop to fix strict mode error
  function visitNode(node: ts.Node, sourceFile: ts.SourceFile): void {
    // Check for ES6 static imports
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
            importStyle: 'ES6Import',
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
          importStyle: 'DynamicImport',
          isDynamicImport: true,
          symbolUsages: [] // Empty for dynamic imports
        });
      } catch (error) {
        console.error(`Error processing dynamic import in ${sourceFile.fileName}:`, error);
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
        // Get position of require statement
        const pos = node.getStart(sourceFile);
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
        
        // Track which symbols are being used from the required module
        const importedSymbols: string[] = [];
        let importStyle: 'CommonJS' | 'RequireJS' | 'Unknown' = 'CommonJS';
        
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
                const symbolName = element.name.getText(sourceFile);
                importedSymbols.push(symbolName);
                
                // Add to tracking map if it's an identifier
                if (ts.isIdentifier(element.name)) {
                  if (!importedSymbolsByFile.has(sourceFile.fileName)) {
                    importedSymbolsByFile.set(sourceFile.fileName, new Map<string, ts.Identifier>());
                  }
                  importedSymbolsByFile.get(sourceFile.fileName)!.set(symbolName, element.name);
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
            }
          }
        } else if (parent && ts.isPropertyAccessExpression(parent)) {
          // For direct property access: require('pkg').something
          const propName = parent.name.getText(sourceFile);
          importedSymbols.push(propName);
        } else {
          // Add package name as the default imported symbol for standalone requires
          importedSymbols.push(packageName);
        }
        
        results.push({
          fileName: sourceFile.fileName,
          importStatement: node.getText(sourceFile),
          line: line + 1,
          character: character + 1,
          importedSymbols,
          importStyle,
          isDynamicImport: false,
          symbolUsages: [] // Will be populated later
        });
      } catch (error) {
        console.error(`Error processing CommonJS require in ${sourceFile.fileName}:`, error);
      }
    }
    
    // Check for AMD define statements: define(['package-name', ...], function(pkg, ...) { ... })
    if (ts.isCallExpression(node) && 
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'define') {
      
      // Check for define(['module1', 'module2', ...], function(...) { ... })
      if (node.arguments.length >= 2 && 
          ts.isArrayLiteralExpression(node.arguments[0])) {
        
        const dependencies = node.arguments[0] as ts.ArrayLiteralExpression;
        let packageIndex = -1;
        let hasPackage = false;
        
        // Find our package in the dependencies array
        for (let i = 0; i < dependencies.elements.length; i++) {
          const element = dependencies.elements[i];
          if (ts.isStringLiteral(element) && element.text === packageName) {
            hasPackage = true;
            packageIndex = i;
            break;
          }
        }
        
        if (hasPackage) {
          try {
            // Get position of define statement
            const pos = node.getStart(sourceFile);
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
            
            // Get the function parameter that corresponds to our package
            let paramName = packageName; // Default to package name instead of anonymous
            if (packageIndex !== -1 && 
                ts.isFunctionExpression(node.arguments[1]) &&
                packageIndex < node.arguments[1].parameters.length) {
              paramName = node.arguments[1].parameters[packageIndex].name.getText(sourceFile);
              
              // Add to tracking map for usage analysis
              if (!importedSymbolsByFile.has(sourceFile.fileName)) {
                importedSymbolsByFile.set(sourceFile.fileName, new Map<string, ts.Identifier>());
              }
              
              const fileSymbolsMap = importedSymbolsByFile.get(sourceFile.fileName)!;
              if (ts.isIdentifier(node.arguments[1].parameters[packageIndex].name)) {
                fileSymbolsMap.set(paramName, node.arguments[1].parameters[packageIndex].name as ts.Identifier);
              }
            }
            
            results.push({
              fileName: sourceFile.fileName,
              importStatement: `define([..., '${packageName}', ...], function(..., ${paramName}, ...) { ... })`,
              line: line + 1,
              character: character + 1,
              importedSymbols: [paramName],
              importStyle: 'AMD',
              isDynamicImport: false,
              symbolUsages: [] // Will populate symbol usages later
            });
          } catch (error) {
            console.error(`Error processing AMD define in ${sourceFile.fileName}:`, error);
          }
        }
      }
    }
    
    // Check for AMD require statements: require(['package-name', ...], function(pkg, ...) { ... })
    if (ts.isCallExpression(node) && 
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'require' &&
        node.arguments.length >= 2 && 
        ts.isArrayLiteralExpression(node.arguments[0])) {
        
      const dependencies = node.arguments[0] as ts.ArrayLiteralExpression;
      dependencies.elements.forEach((element, index) => {
        if (ts.isStringLiteral(element) && element.text === packageName) {
          try {
            // Get position of require statement
            const pos = node.getStart(sourceFile);
            const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
            
            // Get the function parameter that corresponds to our package
            let paramName = packageName; // Default to package name instead of anonymous
            if (ts.isFunctionExpression(node.arguments[1]) &&
                index < node.arguments[1].parameters.length) {
              paramName = node.arguments[1].parameters[index].name.getText(sourceFile);
              
              // Add to tracking map for usage analysis
              if (!importedSymbolsByFile.has(sourceFile.fileName)) {
                importedSymbolsByFile.set(sourceFile.fileName, new Map<string, ts.Identifier>());
              }
              
              const fileSymbolsMap = importedSymbolsByFile.get(sourceFile.fileName)!;
              if (ts.isIdentifier(node.arguments[1].parameters[index].name)) {
                fileSymbolsMap.set(paramName, node.arguments[1].parameters[index].name as ts.Identifier);
              }
            }
            
            results.push({
              fileName: sourceFile.fileName,
              importStatement: `require([..., '${packageName}', ...], function(..., ${paramName}, ...) { ... })`,
              line: line + 1,
              character: character + 1,
              importedSymbols: [paramName],
              importStyle: 'RequireJS',
              isDynamicImport: false,
              symbolUsages: [] // Will populate symbol usages later
            });
          } catch (error) {
            console.error(`Error processing AMD require in ${sourceFile.fileName}:`, error);
          }
        }
      });
    }
    
    // Check for UMD factory pattern: (function(root, factory) { ... })(this, function(dependency) { ... })
    if (ts.isCallExpression(node) && 
        ts.isParenthesizedExpression(node.expression) && 
        ts.isFunctionExpression(node.expression.expression) &&
        node.arguments.length >= 2 &&
        node.arguments[0].kind === ts.SyntaxKind.ThisKeyword) {
      
      // This is potentially a UMD pattern, look for our package in factory dependencies
      const factory = node.arguments[1];
      
      if (ts.isFunctionExpression(factory)) {
        // Check function body for requires of our package
        const traverseForRequires = (n: ts.Node) => {
          if (ts.isCallExpression(n) && 
              ts.isIdentifier(n.expression) &&
              n.expression.text === 'require' &&
              n.arguments.length === 1 &&
              ts.isStringLiteral(n.arguments[0]) &&
              n.arguments[0].text === packageName) {
            
            try {
              // Get position of require statement within UMD
              const pos = n.getStart(sourceFile);
              const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
              
              results.push({
                fileName: sourceFile.fileName,
                importStatement: `UMD factory with require('${packageName}')`,
                line: line + 1,
                character: character + 1,
                importedSymbols: ['(UMD require)'],
                importStyle: 'UMD',
                isDynamicImport: false,
                symbolUsages: [] // Will populate symbol usages later
              });
            } catch (error) {
              console.error(`Error processing UMD factory in ${sourceFile.fileName}:`, error);
            }
          }
          
          ts.forEachChild(n, traverseForRequires);
        };
        
        traverseForRequires(factory.body);
      }
    }
    
    // Check for global variable usage or direct script inclusion
    if (ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === 'window') {
      
      // Look for window.PackageName or similar globals
      // This is a heuristic - assumes the global var name is same as package
      const packageNameCapitalized = packageName.charAt(0).toUpperCase() + packageName.slice(1);
      
      if (ts.isIdentifier(node.name) && 
          (node.name.text === packageName || 
           node.name.text === packageNameCapitalized || 
           node.name.text === packageName.toUpperCase())) {
        
        try {
          // Get position of global usage
          const pos = node.getStart(sourceFile);
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
          
          results.push({
            fileName: sourceFile.fileName,
            importStatement: `window.${node.name.text}`,
            line: line + 1,
            character: character + 1,
            importedSymbols: [node.name.text],
            importStyle: 'GlobalVariable',
            isDynamicImport: false,
            symbolUsages: [] // Will populate symbol usages later
          });
        } catch (error) {
          console.error(`Error processing global variable in ${sourceFile.fileName}:`, error);
        }
      }
    }
    
    ts.forEachChild(node, child => visitNode(child, sourceFile));
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
      
      // Check if it's from a type definition package or a .d.ts file
      const isFromTypeDefinition = declarationPath.includes('node_modules/@types/') || 
                                  declarationPath.endsWith('.d.ts');
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
      
      // Also check for property access on namespace imports
      if (ts.isPropertyAccessExpression(node) && ts.isIdentifier(node.expression)) {
        const namespaceName = node.expression.text;
        
        // Check if this is accessing a property on an imported namespace
        if (fileSymbolsMap.has(namespaceName)) {
          const propertyName = node.name.text;
          const symbolName = `${namespaceName}.${propertyName}`;
          
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
      }
      
      // Check for __esModule interop pattern
      if (ts.isPropertyAccessExpression(node) &&
          ts.isIdentifier(node.name) && 
          node.name.text === 'default' &&
          ts.isIdentifier(node.expression) &&
          fileSymbolsMap.has(node.expression.text)) {
        
        // This is a potential __esModule interop pattern
        // Check if the symbol's declaration is a CommonJS require
        const importedSymbol = node.expression.text;
        const result = results.find(r => 
          r.fileName === sourceFile.fileName && 
          r.importedSymbols.includes(importedSymbol) &&
          r.importStyle === 'CommonJS'
        );
        
        if (result) {
          // Mark this as ESModuleInterop style
          result.importStyle = 'ESModuleInterop';
        }
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

// Extract package name from type definition path
function extractPackageNameFromTypeDef(path: string): string {
  // Case 1: @types package (e.g. node_modules/@types/react)
  const typesMatch = path.match(/node_modules\/@types\/([^\/]+)/);
  if (typesMatch) {
    return typesMatch[1];
  }
  
  // Case 2: Package's own type definitions (e.g. node_modules/react-query/types/...)
  const packageTypeMatch = path.match(/node_modules\/([^\/]+)(?:\/[^\/]+)?\/types\//);
  if (packageTypeMatch) {
    return packageTypeMatch[1];
  }
  
  // Case 3: Package's .d.ts files outside of types directory
  const dtsMatch = path.match(/node_modules\/([^\/]+)(?:\/[^\/]+)?\/.*\.d\.ts$/);
  if (dtsMatch) {
    return dtsMatch[1];
  }
  
  // Fallback: Unknown
  return 'unknown';
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
    console.log(`Import Style: ${result.importStyle || 'Unknown'}`);
    console.log(`Imported Symbols: ${result.importedSymbols.join(', ')}`);
    
    if (result.symbolResolutions && result.symbolResolutions.length > 0) {
      console.log('Symbol Resolutions:');
      result.symbolResolutions.forEach(resolution => {
        console.log(`  - ${resolution.symbolName} (from ${resolution.resolvedFrom})`);
        console.log(`    Resolved to: ${resolution.actualDefinitionPath}`);
        console.log(`    Is Type Definition: ${resolution.isFromTypeDefinition}`);
        if (resolution.importPosition) {
          console.log(`    Import Position: Line ${resolution.importPosition.line}, Character ${resolution.importPosition.character}`);
        }
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
    
    // Filter out placeholder symbols
    const placeholders = ['(AMD)', 'AMD', '(anonymous)', '(require)', '(side-effect only)', 
                          '(dynamic import)', '(UMD require)', '(UMD factory)', '(SystemJS)',
                          '(SystemJS import)', '(SystemJS config)', '(SystemJS register)',
                          '(ImportMaps)', '(GlobalVariable)'];
    
    // Clean the results by filtering out placeholder symbols
    const cleanedResults = results.map(result => {
      // Filter out placeholder symbols from importedSymbols array
      const filteredSymbols = result.importedSymbols.filter(symbol => 
        !placeholders.includes(symbol) && !symbol.startsWith('('));
      
      // Clean up symbol usages as well
      let filteredSymbolUsages = result.symbolUsages || [];
      filteredSymbolUsages = filteredSymbolUsages.filter(usage => 
        !placeholders.includes(usage.symbolName) && !usage.symbolName.startsWith('('));
      
      return {
        ...result,
        importedSymbols: filteredSymbols,
        symbolUsages: filteredSymbolUsages
      };
    });
    
    if (outputPath) {
      // Save to file
      fs.writeFileSync(outputPath, JSON.stringify(cleanedResults, null, 2), 'utf8');
      console.log(`Results saved to ${outputPath}`);
    } else {
      // Print to console
      printPackageUsage(cleanedResults);
    }
  } catch (error) {
    console.error('Error analyzing package usage:', error);
  }
} 