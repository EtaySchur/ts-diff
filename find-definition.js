const ts = require('typescript');
const path = require('path');
const fs = require('fs');

/**
 * Find the definition of a symbol in a TypeScript/JavaScript file
 * @param {string} fileName - Source file to search in
 * @param {string} symbolName - Symbol to find definition for
 * @returns {Object|null} - Definition location information or null if not found
 */
function findDefinition(fileName, symbolName) {
  // Get compiler options from tsconfig.json if it exists
  let compilerOptions = {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.CommonJS,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    jsx: ts.JsxEmit.React,
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    allowJs: true, // Allow JavaScript files
    checkJs: true  // Type check JavaScript files
  };

  try {
    const configFile = ts.findConfigFile(
      path.dirname(fileName), 
      ts.sys.fileExists, 
      'tsconfig.json'
    );
    
    if (configFile) {
      const { config } = ts.readConfigFile(configFile, ts.sys.readFile);
      const { options } = ts.parseJsonConfigFileContent(
        config, 
        ts.sys, 
        path.dirname(configFile)
      );
      compilerOptions = options;
    }
  } catch (error) {
    console.warn('Could not load tsconfig.json, using default compiler options');
  }

  // Create a program from the source file
  const program = ts.createProgram([fileName], compilerOptions);
  const sourceFile = program.getSourceFile(fileName);
  const typeChecker = program.getTypeChecker();
  
  if (!sourceFile) {
    console.error(`Could not find source file: ${fileName}`);
    return null;
  }

  let definition = null;
  let importDeclarations = [];
  let requireStatements = [];

  // First pass: collect all import declarations and require statements
  function collectImportsAndRequires(node) {
    // Collect import declarations
    if (ts.isImportDeclaration(node)) {
      importDeclarations.push(node);
    }
    
    // Collect require statements
    if (ts.isVariableDeclaration(node) && node.initializer) {
      // Check for: const x = require('module')
      if (ts.isCallExpression(node.initializer) && 
          node.initializer.expression && 
          ts.isIdentifier(node.initializer.expression) && 
          node.initializer.expression.text === 'require') {
        requireStatements.push(node);
      }
      
      // Check for: const { a, b } = require('module')
      if (ts.isCallExpression(node.initializer) && 
          node.initializer.expression && 
          ts.isIdentifier(node.initializer.expression) && 
          node.initializer.expression.text === 'require' && 
          node.name && 
          ts.isObjectBindingPattern(node.name)) {
        requireStatements.push(node);
      }
    }
    
    ts.forEachChild(node, collectImportsAndRequires);
  }

  collectImportsAndRequires(sourceFile);

  // Find a specific property in an object binding pattern
  function findPropertyInObjectBindingPattern(bindingPattern, propertyName) {
    for (const element of bindingPattern.elements) {
      if (element.name && ts.isIdentifier(element.name) && element.name.text === propertyName) {
        return element;
      }
    }
    return null;
  }

  // Find module path from a require call
  function getModuleSpecifierFromRequire(node) {
    if (ts.isCallExpression(node.initializer) && 
        node.initializer.arguments && 
        node.initializer.arguments.length > 0 && 
        ts.isStringLiteral(node.initializer.arguments[0])) {
      return node.initializer.arguments[0].text;
    }
    return null;
  }

  // Process the source for the symbol
  function findSymbol(node) {
    // Check if this is our target symbol as an identifier
    if (ts.isIdentifier(node) && node.text === symbolName) {
      // Skip if this is part of an import declaration
      if (node.parent && (
        ts.isImportSpecifier(node.parent) || 
        ts.isImportClause(node.parent) ||
        ts.isNamespaceImport(node.parent)
      )) {
        // For imports, we need to track where they're coming from
        const importDecl = node.parent;
        let moduleSpecifier = '';
        
        // Navigate up to find the import declaration
        let parent = importDecl;
        while (parent && !ts.isImportDeclaration(parent)) {
          parent = parent.parent;
        }
        
        if (parent && ts.isImportDeclaration(parent) && parent.moduleSpecifier) {
          moduleSpecifier = parent.moduleSpecifier.text;
        }

        try {
          // Try to resolve the module
          const symbol = typeChecker.getSymbolAtLocation(node);
          if (symbol) {
            // Check if this is an alias (for imports)
            let actualSymbol = symbol;
            if (symbol.flags & ts.SymbolFlags.Alias) {
              actualSymbol = typeChecker.getAliasedSymbol(symbol);
            }
            
            if (actualSymbol.declarations && actualSymbol.declarations.length > 0) {
              const decl = actualSymbol.declarations[0];
              const declFile = decl.getSourceFile();
              
              definition = {
                symbolName,
                importedFrom: moduleSpecifier,
                fileName: declFile.fileName,
                line: ts.getLineAndCharacterOfPosition(declFile, decl.getStart()).line,
                character: ts.getLineAndCharacterOfPosition(declFile, decl.getStart()).character,
                isNodeModule: declFile.fileName.includes('node_modules'),
                text: decl.getText(declFile)
              };
              
              // Exit early
              return true;
            }
          }
        } catch (error) {
          console.warn(`Error resolving import for ${symbolName}:`, error.message);
        }
      } 
      // Check for destrucctured require statements like: const { map, filter } = require('lodash')
      else if (node.parent && ts.isBindingElement(node.parent)) {
        const bindingElement = node.parent;
        
        // Find the variable declaration
        let parent = bindingElement;
        while (parent && !ts.isVariableDeclaration(parent)) {
          parent = parent.parent;
        }
        
        if (parent && ts.isVariableDeclaration(parent) && 
            parent.initializer && 
            ts.isCallExpression(parent.initializer) &&
            ts.isIdentifier(parent.initializer.expression) && 
            parent.initializer.expression.text === 'require') {
          
          // Get the module name
          if (parent.initializer.arguments.length > 0 && 
              ts.isStringLiteral(parent.initializer.arguments[0])) {
            const moduleName = parent.initializer.arguments[0].text;
            
            try {
              // Try to resolve the actual module
              const moduleResolution = ts.resolveModuleName(
                moduleName, 
                sourceFile.fileName, 
                compilerOptions, 
                ts.sys
              );
              
              if (moduleResolution.resolvedModule) {
                const modulePath = moduleResolution.resolvedModule.resolvedFileName;
                
                // Try to find the definition
                const definition = {
                  symbolName,
                  importedFrom: moduleName,
                  fileName: modulePath,
                  line: 0, // We don't know exact location within module
                  character: 0,
                  isNodeModule: modulePath.includes('node_modules'),
                  text: `Property '${symbolName}' from module '${moduleName}'`
                };
                
                // For node_modules, try to find actual definition file
                if (modulePath.includes('node_modules')) {
                  try {
                    // Try to find individual file for the symbol (many packages have this pattern)
                    const packageDir = path.dirname(modulePath);
                    const symbolFile = path.join(packageDir, `${symbolName}.js`);
                    
                    if (fs.existsSync(symbolFile)) {
                      definition.fileName = symbolFile;
                      definition.text = `// Function definition from ${symbolFile}\n` + 
                                      fs.readFileSync(symbolFile, 'utf8').substring(0, 500);
                    }
                    
                    // Check for @types definitions
                    const typesDir = path.join(
                      path.dirname(path.dirname(modulePath)), 
                      '@types', 
                      moduleName
                    );
                    
                    if (fs.existsSync(typesDir)) {
                      const indexDts = path.join(typesDir, 'index.d.ts');
                      if (fs.existsSync(indexDts)) {
                        const content = fs.readFileSync(indexDts, 'utf8');
                        const lines = content.split('\n');
                        
                        // Simple search for the symbol in .d.ts file
                        for (let i = 0; i < lines.length; i++) {
                          if (lines[i].includes(`export function ${symbolName}(`)) {
                            definition.fileName = indexDts;
                            definition.line = i;
                            definition.text = lines.slice(i, i + 10).join('\n');
                            break;
                          }
                        }
                      }
                    }
                  } catch (error) {
                    console.warn(`Error finding specific definition for ${symbolName}:`, error.message);
                  }
                }
                
                return definition;
              }
            } catch (error) {
              console.warn(`Error resolving module ${moduleName}:`, error.message);
            }
          }
        }
      }
      else {
        // Regular symbol in code
        try {
          const symbol = typeChecker.getSymbolAtLocation(node);
          if (symbol) {
            let actualSymbol = symbol;
            if (symbol.flags & ts.SymbolFlags.Alias) {
              actualSymbol = typeChecker.getAliasedSymbol(symbol);
            }
            
            if (actualSymbol.declarations && actualSymbol.declarations.length > 0) {
              const decl = actualSymbol.declarations[0];
              const declFile = decl.getSourceFile();
              
              definition = {
                symbolName,
                fileName: declFile.fileName,
                line: ts.getLineAndCharacterOfPosition(declFile, decl.getStart()).line,
                character: ts.getLineAndCharacterOfPosition(declFile, decl.getStart()).character,
                isNodeModule: declFile.fileName.includes('node_modules'),
                text: decl.getText(declFile)
              };
              
              // Exit early
              return true;
            }
          }
        } catch (error) {
          console.warn(`Error resolving symbol ${symbolName}:`, error.message);
        }
      }
    }
    
    // Continue traversing if definition is not found
    if (!definition) {
      return ts.forEachChild(node, findSymbol);
    }
    
    return false;
  }

  // Try to find the symbol
  const symbolResult = findSymbol(sourceFile);
  
  // Check if we found something using the AST traversal
  if (definition) {
    return definition;
  }
  
  // If we didn't find it with AST traversal, try manual approach with requires
  for (const req of requireStatements) {
    if (ts.isObjectBindingPattern(req.name)) {
      const bindingElement = findPropertyInObjectBindingPattern(req.name, symbolName);
      if (bindingElement) {
        const moduleName = getModuleSpecifierFromRequire(req);
        if (moduleName) {
          // Try to manually find function file (works for many modular packages)
          try {
            // Find the main module file
            const moduleResolution = ts.resolveModuleName(
              moduleName, 
              sourceFile.fileName, 
              compilerOptions, 
              ts.sys
            );
            
            if (moduleResolution.resolvedModule) {
              const moduleDir = path.dirname(moduleResolution.resolvedModule.resolvedFileName);
              
              // Check for individual files for each export (common pattern)
              const functionFile = path.join(moduleDir, `${symbolName}.js`);
              
              if (fs.existsSync(functionFile)) {
                const functionText = fs.readFileSync(functionFile, 'utf8');
                
                return {
                  symbolName,
                  importedFrom: moduleName,
                  fileName: functionFile,
                  line: 0,
                  character: 0,
                  isNodeModule: true,
                  text: functionText.substring(0, 500) + (functionText.length > 500 ? '...' : '')
                };
              }
              
              // If we don't find individual files, look for the symbol in the package's main file
              const mainFile = moduleResolution.resolvedModule.resolvedFileName;
              if (fs.existsSync(mainFile)) {
                try {
                  const mainContent = fs.readFileSync(mainFile, 'utf8');
                  const exportRegex = new RegExp(`exports?\\.${symbolName}\\s*=|export\\s+(?:const|let|var|function|class)\\s+${symbolName}\\b|export\\s+\\{[^}]*\\b${symbolName}\\b[^}]*\\}`, 'g');
                  if (exportRegex.test(mainContent)) {
                    return {
                      symbolName,
                      importedFrom: moduleName,
                      fileName: mainFile,
                      line: 0, // We'd need to parse the file to find the exact line
                      character: 0,
                      isNodeModule: true,
                      text: `// Symbol '${symbolName}' is exported from ${mainFile}\n// Use a proper IDE to see the exact definition`
                    };
                  }
                } catch (error) {
                  console.warn(`Error reading main file: ${error.message}`);
                }
              }
            }
          } catch (error) {
            console.warn('Error resolving module file:', error.message);
          }
          
          // Try to find in @types
          try {
            // Check node_modules
            const basePath = path.dirname(fileName);
            let currentDir = basePath;
            
            // Walk up until we find node_modules
            while (currentDir !== path.dirname(currentDir)) {
              const potentialNodeModules = path.join(currentDir, 'node_modules');
              if (fs.existsSync(potentialNodeModules)) {
                const typesPath = path.join(potentialNodeModules, '@types', moduleName);
                if (fs.existsSync(typesPath)) {
                  const indexDts = path.join(typesPath, 'index.d.ts');
                  if (fs.existsSync(indexDts)) {
                    // Simple grep for the function
                    const content = fs.readFileSync(indexDts, 'utf8');
                    const lines = content.split('\n');
                    
                    for (let i = 0; i < lines.length; i++) {
                      const line = lines[i];
                      if (line.includes(`export function ${symbolName}(`) || 
                          line.includes(`export declare function ${symbolName}(`)) {
                        return {
                          symbolName,
                          importedFrom: moduleName,
                          fileName: indexDts,
                          line: i,
                          character: line.indexOf(symbolName),
                          isNodeModule: true,
                          text: lines.slice(i, Math.min(i + 10, lines.length)).join('\n')
                        };
                      }
                    }
                  }
                }
                break;
              }
              currentDir = path.dirname(currentDir);
            }
          } catch (error) {
            console.warn('Error searching @types:', error.message);
          }
          
          // Generic solution when we can't find specific file
          return {
            symbolName,
            importedFrom: moduleName,
            fileName: `node_modules/${moduleName}`,
            line: 0,
            character: 0,
            isNodeModule: true,
            text: `// Definition of "${symbolName}" from "${moduleName}" (exact location not found)`
          };
        }
      }
    }
  }
  
  return null;
}

// Execute if run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: node find-definition.js <file-path> <symbol-name>');
    process.exit(1);
  }
  
  const [file, symbol] = args;
  const absolutePath = path.resolve(file);
  
  if (!fs.existsSync(absolutePath)) {
    console.error(`File not found: ${absolutePath}`);
    process.exit(1);
  }
  
  const result = findDefinition(absolutePath, symbol);
  
  if (result) {
    console.log('\nDefinition found:');
    console.log('Symbol:', result.symbolName);
    
    if (result.importedFrom) {
      console.log('Imported from:', result.importedFrom);
    }
    
    console.log('File:', result.fileName);
    console.log('Location:', `Line ${result.line + 1}, Column ${result.character + 1}`);
    console.log('Is in node_modules:', result.isNodeModule);
    
    console.log('\nDefinition:');
    console.log(result.text.substring(0, 500) + (result.text.length > 500 ? '...' : ''));
  } else {
    console.log(`Definition for symbol '${symbol}' not found in ${file}`);
  }
}

module.exports = { findDefinition }; 