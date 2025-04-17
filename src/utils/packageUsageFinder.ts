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

export function findPackageUsage(projectRoot: string, packageName: string, enhancedDetection: boolean = false): PackageUsage[] {
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
        const importedSymbols: string[] = ['(require)'];
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
          } 
          // For regular variable: const x = require('pkg')
          else if (ts.isIdentifier(parent.name)) {
            importedSymbols.push(varName);
            
            // Add to tracking map
            if (!importedSymbolsByFile.has(sourceFile.fileName)) {
              importedSymbolsByFile.set(sourceFile.fileName, new Map<string, ts.Identifier>());
            }
            importedSymbolsByFile.get(sourceFile.fileName)!.set(varName, parent.name);
          }
        }
        // For RequireJS style: define(['pkg'], function(pkg) {...})
        else if (parent && 
                 ts.isArrayLiteralExpression(parent) && 
                 parent.parent && 
                 ts.isCallExpression(parent.parent) && 
                 ts.isIdentifier(parent.parent.expression) && 
                 parent.parent.expression.text === 'define') {
          importStyle = 'RequireJS';
          
          // Try to find the callback function to extract parameter names
          const defineCall = parent.parent;
          if (defineCall.arguments.length >= 2 && ts.isFunctionExpression(defineCall.arguments[1])) {
            const callback = defineCall.arguments[1] as ts.FunctionExpression;
            const params = callback.parameters;
            
            // Find the parameter index corresponding to this module
            const moduleElements = (parent as ts.ArrayLiteralExpression).elements;
            const moduleIndex = moduleElements.findIndex(e => 
              ts.isStringLiteral(e) && e.text === packageName
            );
            
            if (moduleIndex >= 0 && moduleIndex < params.length) {
              const param = params[moduleIndex];
              if (ts.isIdentifier(param.name)) {
                const paramName = param.name.text;
                importedSymbols.push(paramName);
                
                // Add to tracking map
                if (!importedSymbolsByFile.has(sourceFile.fileName)) {
                  importedSymbolsByFile.set(sourceFile.fileName, new Map<string, ts.Identifier>());
                }
                importedSymbolsByFile.get(sourceFile.fileName)!.set(paramName, param.name);
              }
            }
          }
        }
        
        results.push({
          fileName: sourceFile.fileName,
          importStatement: node.getText(sourceFile),
          line: line + 1,
          character: character + 1,
          importedSymbols,
          importStyle,
          isDynamicImport: true,
          symbolUsages: [] // Will be populated later
        });
      } catch (error) {
        console.error(`Error processing require in ${sourceFile.fileName}:`, error);
      }
    }
    
    // Check for AMD define statements
    if (enhancedDetection && 
        ts.isCallExpression(node) && 
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
            let paramName = '(anonymous)';
            if (packageIndex !== -1 && 
                ts.isFunctionExpression(node.arguments[1]) &&
                packageIndex < node.arguments[1].parameters.length) {
              paramName = node.arguments[1].parameters[packageIndex].name.getText(sourceFile);
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
      
      // Check for require(['module1', 'module2', ...], function(...) { ... })
      if (node.arguments.length >= 2 && 
          ts.isArrayLiteralExpression(node.arguments[0])) {
          
        const dependencies = node.arguments[0] as ts.ArrayLiteralExpression;
        dependencies.elements.forEach((element, index) => {
          if (ts.isStringLiteral(element) && element.text === packageName) {
            try {
              // Get position of require statement
              const pos = node.getStart(sourceFile);
              const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
              
              // Get the function parameter that corresponds to our package
              let paramName = '(anonymous)';
              if (ts.isFunctionExpression(node.arguments[1]) &&
                  index < node.arguments[1].parameters.length) {
                paramName = node.arguments[1].parameters[index].name.getText(sourceFile);
              }
              
              results.push({
                fileName: sourceFile.fileName,
                importStatement: `require([..., '${packageName}', ...], function(..., ${paramName}, ...) { ... })`,
                line: line + 1,
                character: character + 1,
                importedSymbols: [paramName],
                importStyle: 'AMD',
                isDynamicImport: false,
                symbolUsages: [] // Will populate symbol usages later
              });
            } catch (error) {
              console.error(`Error processing AMD require in ${sourceFile.fileName}:`, error);
            }
          }
        });
      }
    }
    
    // Check for SystemJS imports: System.import('package-name')
    if (ts.isCallExpression(node) && 
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'System' &&
        node.expression.name.text === 'import' &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0]) &&
        node.arguments[0].text === packageName) {
      
      try {
        // Get position of System.import statement
        const pos = node.getStart(sourceFile);
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
        
        results.push({
          fileName: sourceFile.fileName,
          importStatement: node.getText(sourceFile),
          line: line + 1,
          character: character + 1,
          importedSymbols: ['(SystemJS import)'],
          importStyle: 'SystemJS',
          isDynamicImport: true,
          symbolUsages: [] // Will be populated later
        });
      } catch (error) {
        console.error(`Error processing SystemJS import in ${sourceFile.fileName}:`, error);
      }
    }
    
    // Check for UMD global variable access: window.packageName or global.packageName
    if (ts.isPropertyAccessExpression(node) &&
        ts.isIdentifier(node.expression) &&
        (node.expression.text === 'window' || node.expression.text === 'global') &&
        ts.isIdentifier(node.name) &&
        node.name.text === packageName) {
      
      try {
        // Get position of global variable access
        const pos = node.getStart(sourceFile);
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
        
        results.push({
          fileName: sourceFile.fileName,
          importStatement: node.getText(sourceFile),
          line: line + 1,
          character: character + 1,
          importedSymbols: [node.name.text],
          importStyle: 'GlobalVariable',
          isDynamicImport: false,
          symbolUsages: [] // Will be populated later
        });
      } catch (error) {
        console.error(`Error processing global variable access in ${sourceFile.fileName}:`, error);
      }
    }
    
    // Check for UMD-style factory pattern: (function(root, factory) { ... })(this, function() { ... })
    if (ts.isCallExpression(node) &&
        ts.isParenthesizedExpression(node.expression) &&
        ts.isFunctionExpression(node.expression.expression) &&
        node.expression.expression.parameters.length >= 2) {
      
      // Look for references to the package inside the factory function
      let hasPackageReference = false;
      
      // Check if the factory function body has a require call for our package
      const factoryFunc = node.expression.expression;
      factoryFunc.body.statements.forEach(stmt => {
        if (ts.isVariableStatement(stmt)) {
          stmt.declarationList.declarations.forEach(decl => {
            if (decl.initializer && 
                ts.isCallExpression(decl.initializer) &&
                ts.isIdentifier(decl.initializer.expression) &&
                decl.initializer.expression.text === 'require' &&
                decl.initializer.arguments.length === 1 &&
                ts.isStringLiteral(decl.initializer.arguments[0]) &&
                decl.initializer.arguments[0].text === packageName) {
              hasPackageReference = true;
            }
          });
        }
      });
      
      if (hasPackageReference) {
        try {
          // Get position of UMD wrapper
          const pos = node.getStart(sourceFile);
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
          
          results.push({
            fileName: sourceFile.fileName,
            importStatement: "UMD factory pattern",
            line: line + 1,
            character: character + 1,
            importedSymbols: ['(UMD factory)'],
            importStyle: 'UMD',
            isDynamicImport: false,
            symbolUsages: [] // Will be populated later
          });
        } catch (error) {
          console.error(`Error processing UMD factory in ${sourceFile.fileName}:`, error);
        }
      }
    }
    
    // Check for SystemJS.config with map configuration
    if (ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'SystemJS' &&
        node.expression.name.text === 'config' &&
        node.arguments.length === 1 &&
        ts.isObjectLiteralExpression(node.arguments[0])) {
      
      const configObj = node.arguments[0] as ts.ObjectLiteralExpression;
      
      // Look for map property
      const mapProperty = configObj.properties.find(prop => 
        ts.isPropertyAssignment(prop) && 
        prop.name.getText(sourceFile) === 'map'
      );
      
      if (mapProperty && ts.isPropertyAssignment(mapProperty) && 
          ts.isObjectLiteralExpression(mapProperty.initializer)) {
        
        const mapObject = mapProperty.initializer;
        
        // Check if our package is in the map
        for (const prop of mapObject.properties) {
          if (ts.isPropertyAssignment(prop) && prop.name.getText(sourceFile) === packageName) {
            try {
              // Get position of SystemJS.config
              const pos = node.getStart(sourceFile);
              const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
              
              results.push({
                fileName: sourceFile.fileName,
                importStatement: `SystemJS.config({ map: { '${packageName}': ... } })`,
                line: line + 1,
                character: character + 1,
                importedSymbols: ['(SystemJS config)'],
                importStyle: 'SystemJS',
                isDynamicImport: false,
                symbolUsages: [] // Will be populated later
              });
              break;
            } catch (error) {
              console.error(`Error processing SystemJS.config in ${sourceFile.fileName}:`, error);
            }
          }
        }
      }
    }
    
    // Check for SystemJS.register with dependencies
    if (ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'SystemJS' &&
        node.expression.name.text === 'register' &&
        node.arguments.length >= 2 &&
        ts.isArrayLiteralExpression(node.arguments[1])) {
        
      const dependencies = node.arguments[1] as ts.ArrayLiteralExpression;
      
      // Check if our package is in the dependencies
      const packageIndex = dependencies.elements.findIndex(e => 
        ts.isStringLiteral(e) && e.text === packageName
      );
      
      if (packageIndex >= 0) {
        try {
          // Get position of SystemJS.register
          const pos = node.getStart(sourceFile);
          const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
          
          const importedSymbols: string[] = ['(SystemJS register)'];
          
          // If there's a factory function, check for the param name
          if (node.arguments.length >= 3 && 
              ts.isFunctionExpression(node.arguments[2]) &&
              packageIndex < node.arguments[2].parameters.length) {
            
            const param = node.arguments[2].parameters[packageIndex];
            if (ts.isIdentifier(param.name)) {
              importedSymbols.push(param.name.text);
            }
          }
          
          results.push({
            fileName: sourceFile.fileName,
            importStatement: "SystemJS.register([..., '" + packageName + "', ...], function(...) {...})",
            line: line + 1,
            character: character + 1,
            importedSymbols,
            importStyle: 'SystemJS',
            isDynamicImport: false,
            symbolUsages: [] // Will be populated later
          });
        } catch (error) {
          console.error(`Error processing SystemJS.register in ${sourceFile.fileName}:`, error);
        }
      }
    }
    
    // Check for ESM with import.meta.resolve (import maps style)
    if (ts.isCallExpression(node) && 
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isPropertyAccessExpression(node.expression.expression) &&
        ts.isPropertyAccessExpression(node.expression.expression.expression) &&
        node.expression.expression.expression.getText() === 'import' &&
        node.expression.expression.name.text === 'meta' &&
        node.expression.name.text === 'resolve' &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0]) &&
        node.arguments[0].text === packageName) {
      
      try {
        // Get position of import.meta.resolve statement
        const pos = node.getStart(sourceFile);
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
        
        results.push({
          fileName: sourceFile.fileName,
          importStatement: node.getText(sourceFile),
          line: line + 1,
          character: character + 1,
          importedSymbols: ['(ImportMaps)'],
          importStyle: 'ImportMaps',
          isDynamicImport: true,
          symbolUsages: [] // Will be populated later
        });
      } catch (error) {
        console.error(`Error processing import.meta.resolve in ${sourceFile.fileName}:`, error);
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
  outputPath?: string,
  enhancedDetection: boolean = false
): void {
  console.log(`Analyzing usage of package "${packageName}" in project at ${projectRoot}...`);
  
  try {
    const results = findPackageUsage(projectRoot, packageName, enhancedDetection);
    
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