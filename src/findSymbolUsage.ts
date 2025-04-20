import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';

// Interfaces for Symbol Usage
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
  importStyle?: 'ES6Import' | 'CommonJS' | 'RequireJS' | 'DynamicImport' | 'ESModuleInterop' | 'SystemJS' | 'UMD' | 'GlobalVariable' | 'ImportMaps' | 'AMD' | 'Unknown';
  isDynamicImport?: boolean;
  symbolUsages?: SymbolUsage[];
}

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
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      try {
        if (fs.statSync(fullPath).isDirectory() && !fullPath.includes('node_modules')) {
          readFilesRecursively(fullPath, extensions, fileNames);
        } else {
          const ext = path.extname(fullPath);
          if (extensions.includes(ext)) {
            fileNames.push(fullPath);
          }
        }
      } catch (err) {
        console.error(`Error processing file ${fullPath}: ${err}`);
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}: ${err}`);
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
      console.error(`Error reading tsconfig: ${error}`);
    }
  }

  // Get all .js, .jsx, .ts, .tsx files
  const extensions = ['.js', '.jsx', '.ts', '.tsx'];
  const fileNames: string[] = [];

  // If we have a parsed config, use its file names, otherwise scan the directory
  if (parsedConfig && parsedConfig.fileNames.length > 0) {
    fileNames.push(...parsedConfig.fileNames);
    console.log(`Using ${fileNames.length} files from tsconfig.json`);
  } else {
    console.log(`Scanning directory ${projectRoot} for files with extensions: ${extensions.join(', ')}`);
    readFilesRecursively(projectRoot, extensions, fileNames);
  }

  console.log(`Found ${fileNames.length} files to analyze`);
  
  // Print some sample files to verify we're finding the right ones
  if (fileNames.length > 0) {
    console.log("Sample files found:");
    for (let i = 0; i < Math.min(5, fileNames.length); i++) {
      console.log(`  - ${fileNames[i]}`);
    }
    
    // Specifically check for the lodash examples
    const lodashFiles = fileNames.filter(file => file.includes('lodash'));
    console.log(`Found ${lodashFiles.length} lodash-related files:`);
    lodashFiles.forEach(file => console.log(`  - ${file}`));
  }

  // Create program from the files
  const program = ts.createProgram(fileNames, compilerOptions);
  
  const packageUsages: PackageUsage[] = [];
  
  // Map to store imported symbols by file for tracking usages
  const importedSymbolsByFile = new Map<string, Map<string, ts.Identifier>>();
  
  let importFilesCount = 0;
  // Process all source files to find imports
  for (const sourceFile of program.getSourceFiles()) {
    // Skip declaration files and node_modules files
    if (sourceFile.isDeclarationFile || sourceFile.fileName.includes('node_modules')) {
      continue;
    }
    
    // Debug log the file being processed
    console.log(`Processing file: ${sourceFile.fileName}`);
    
    // Check if the file imports the target package and specific symbol
    const fileImportsCount = packageUsages.length;
    processFileForImports(sourceFile, packageName, symbolName, packageUsages, importedSymbolsByFile);
    
    // If we found imports in this file, increment the counter
    if (packageUsages.length > fileImportsCount) {
      importFilesCount++;
    }
  }
  
  console.log(`Found ${importFilesCount} files that import '${packageName}'`);
  console.log(`Found ${packageUsages.length} imports of '${symbolName}' from '${packageName}'`);
  
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
    
    console.log(`Looking for usages in ${sourceFile.fileName}`);
    console.log(`Imported symbols: ${Array.from(fileSymbolsMap.keys()).join(', ')}`);
    
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
        console.log(`  No matching imports for symbol '${symbolName}' - skipping`);
        continue;
      }
      
      console.log(`  Filtered to symbol '${symbolName}'`);
    }
    
    // Map to store usages for each symbol
    const usagesBySymbol = new Map<string, SymbolUsage>();
    
    // Find usages in this file
    processFileForUsages(sourceFile, fileSymbolsMap, usagesBySymbol, symbolName);
    
    console.log(`  Found ${usagesBySymbol.size} symbol usages`);
    
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

// Function to check if a file imports the target package and symbol
function processFileForImports(
  sourceFile: ts.SourceFile,
  packageName: string,
  symbolName: string,
  packageUsages: PackageUsage[],
  importedSymbolsByFile: Map<string, Map<string, ts.Identifier>>
): void {
  // Initialize a map for this file
  if (!importedSymbolsByFile.has(sourceFile.fileName)) {
    importedSymbolsByFile.set(sourceFile.fileName, new Map<string, ts.Identifier>());
  }
  const fileSymbolsMap = importedSymbolsByFile.get(sourceFile.fileName)!;
  
  // Check for imports from the target package
  ts.forEachChild(sourceFile, node => {
    // ES6 imports: import { x } from 'package'
    if (ts.isImportDeclaration(node) && 
        node.moduleSpecifier && 
        ts.isStringLiteral(node.moduleSpecifier) &&
        node.moduleSpecifier.text === packageName) {
      
      const importedSymbols: string[] = [];
      const importStatement = node.getText(sourceFile);
      const pos = node.moduleSpecifier.getStart(sourceFile) + 1; // +1 to skip opening quote
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
      
      // Default import: import x from 'package'
      if (node.importClause?.name) {
        const name = node.importClause.name.text;
        importedSymbols.push(name);
        fileSymbolsMap.set(name, node.importClause.name);
        
        if (symbolName === '*' || name === symbolName) {
          packageUsages.push({
            fileName: sourceFile.fileName,
            importStatement,
            line,
            character,
            importedSymbols,
            importStyle: 'ES6Import',
            isDynamicImport: false,
            symbolUsages: []
          });
        }
      }
      
      // Named imports: import { x, y } from 'package'
      const namedBindings = node.importClause?.namedBindings;
      if (namedBindings && ts.isNamedImports(namedBindings)) {
        for (const element of namedBindings.elements) {
          const name = element.name.text;
          importedSymbols.push(name);
          fileSymbolsMap.set(name, element.name);
          
          if (symbolName === '*' || name === symbolName) {
            const elementPos = element.name.getStart(sourceFile);
            const elementLoc = sourceFile.getLineAndCharacterOfPosition(elementPos);
            
            packageUsages.push({
              fileName: sourceFile.fileName,
              importStatement,
              line: elementLoc.line,
              character: elementLoc.character,
              importedSymbols,
              importStyle: 'ES6Import',
              isDynamicImport: false,
              symbolUsages: []
            });
          }
        }
      }
      
      // Namespace import: import * as x from 'package'
      if (namedBindings && ts.isNamespaceImport(namedBindings)) {
        const name = namedBindings.name.text;
        importedSymbols.push(`* as ${name}`);
        fileSymbolsMap.set(name, namedBindings.name);
        
        if (symbolName === '*' || name === symbolName) {
          const nsPos = namedBindings.name.getStart(sourceFile);
          const nsLoc = sourceFile.getLineAndCharacterOfPosition(nsPos);
          
          packageUsages.push({
            fileName: sourceFile.fileName,
            importStatement,
            line: nsLoc.line,
            character: nsLoc.character,
            importedSymbols,
            importStyle: 'ES6Import',
            isDynamicImport: false,
            symbolUsages: []
          });
        }
      }
    }
    
    // CommonJS: const { x } = require('package')
    if (ts.isVariableDeclaration(node) && 
        node.initializer && 
        ts.isCallExpression(node.initializer) && 
        ts.isIdentifier(node.initializer.expression) &&
        node.initializer.expression.text === 'require' &&
        node.initializer.arguments.length === 1 &&
        ts.isStringLiteral(node.initializer.arguments[0]) &&
        node.initializer.arguments[0].text === packageName) {
      
      const importedSymbols: string[] = [];
      const importStatement = (node.parent && ts.isVariableDeclarationList(node.parent))
        ? node.parent.parent?.getText(sourceFile) || node.getText(sourceFile)
        : node.getText(sourceFile);
      
      const pos = node.initializer.arguments[0].getStart(sourceFile) + 1;
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
      
      // Object destructuring: const { x, y } = require('package')
      if (ts.isObjectBindingPattern(node.name)) {
        for (const element of node.name.elements) {
          if (ts.isBindingElement(element) && ts.isIdentifier(element.name)) {
            const name = element.name.text;
            importedSymbols.push(name);
            fileSymbolsMap.set(name, element.name);
            
            // Debug log for map symbol
            if (name === 'map') {
              console.log(`Found 'map' require in ${sourceFile.fileName}`);
            }
            
            if (symbolName === '*' || name === symbolName) {
              const elementPos = element.name.getStart(sourceFile);
              const elementLoc = sourceFile.getLineAndCharacterOfPosition(elementPos);
              
              packageUsages.push({
                fileName: sourceFile.fileName,
                importStatement,
                line: elementLoc.line,
                character: elementLoc.character,
                importedSymbols,
                importStyle: 'CommonJS',
                isDynamicImport: false,
                symbolUsages: []
              });
            }
          }
        }
      }
      // Simple require: const x = require('package')
      else if (ts.isIdentifier(node.name)) {
        const name = node.name.text;
        importedSymbols.push(name);
        fileSymbolsMap.set(name, node.name);
        
        if (symbolName === '*' || name === symbolName) {
          const namePos = node.name.getStart(sourceFile);
          const nameLoc = sourceFile.getLineAndCharacterOfPosition(namePos);
          
          packageUsages.push({
            fileName: sourceFile.fileName,
            importStatement,
            line: nameLoc.line,
            character: nameLoc.character,
            importedSymbols,
            importStyle: 'CommonJS',
            isDynamicImport: false,
            symbolUsages: []
          });
        }
      }
    }
    
    // Handle direct require().property access
    if (ts.isPropertyAccessExpression(node) &&
        ts.isCallExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'require' &&
        node.expression.arguments.length === 1 &&
        ts.isStringLiteral(node.expression.arguments[0]) &&
        node.expression.arguments[0].text === packageName) {
      
      const importedSymbols: string[] = [];
      const name = node.name.text;
      importedSymbols.push(name);
      
      if (symbolName === '*' || name === symbolName) {
        const importStatement = node.parent?.getText(sourceFile) || node.getText(sourceFile);
        const pos = node.name.getStart(sourceFile);
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
        
        packageUsages.push({
          fileName: sourceFile.fileName,
          importStatement,
          line,
          character,
          importedSymbols,
          importStyle: 'CommonJS',
          isDynamicImport: false,
          symbolUsages: []
        });
      }
    }
  });
}

// Function to find usages of imported symbols in a file
function processFileForUsages(
  sourceFile: ts.SourceFile,
  fileSymbolsMap: Map<string, ts.Identifier>,
  usagesBySymbol: Map<string, SymbolUsage>,
  symbolName: string
): void {
  const visitNode = (node: ts.Node): void => {
    // Direct symbol usage
    if (ts.isIdentifier(node)) {
      const name = node.text;
      
      // Skip if not the target symbol or not imported from target package
      if (!fileSymbolsMap.has(name)) {
        return;
      }
      
      // Skip import/require declarations
      if (isPartOfImportOrRequire(node)) {
        return;
      }
      
      const pos = node.getStart(sourceFile);
      const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
      const context = getLineContext(sourceFile, line);
      
      // Add to usages
      if (!usagesBySymbol.has(name)) {
        usagesBySymbol.set(name, {
          symbolName: name,
          locations: []
        });
      }
      
      usagesBySymbol.get(name)!.locations.push({
        line,
        character,
        context
      });
    }
    
    // Usage of properties on namespace import: _.map(...)
    if (ts.isPropertyAccessExpression(node) && 
        ts.isIdentifier(node.expression)) {
      const namespace = node.expression.text;
      const property = node.name.text;
      
      // Skip if namespace not imported from target package
      if (!fileSymbolsMap.has(namespace)) {
        return;
      }
      
      // For dot notation property access (e.g., _.map)
      if (symbolName === '*' || property === symbolName) {
        const fullName = `${namespace}.${property}`;
        const pos = node.name.getStart(sourceFile);
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(pos);
        const context = getLineContext(sourceFile, line);
        
        // Add to usages
        if (!usagesBySymbol.has(fullName)) {
          usagesBySymbol.set(fullName, {
            symbolName: fullName,
            locations: []
          });
        }
        
        usagesBySymbol.get(fullName)!.locations.push({
          line,
          character,
          context
        });
      }
    }
    
    // Continue traversing
    ts.forEachChild(node, visitNode);
  };
  
  visitNode(sourceFile);
}

// Helper to check if a node is part of an import/require declaration
function isPartOfImportOrRequire(node: ts.Identifier): boolean {
  let parent = node.parent;
  
  // Check for import specifier
  if (parent && 
      (ts.isImportSpecifier(parent) || 
       ts.isImportClause(parent) || 
       ts.isNamespaceImport(parent))) {
    return true;
  }
  
  // Check for require argument
  if (parent && 
      ts.isCallExpression(parent) && 
      ts.isIdentifier(parent.expression) &&
      parent.expression.text === 'require') {
    return true;
  }
  
  // Check for object binding in require
  let currentNode: ts.Node = node;
  while (currentNode.parent) {
    const p = currentNode.parent;
    
    if (ts.isBindingElement(p) && 
        p.parent && 
        ts.isObjectBindingPattern(p.parent) &&
        p.parent.parent && 
        ts.isVariableDeclaration(p.parent.parent) &&
        p.parent.parent.initializer && 
        ts.isCallExpression(p.parent.parent.initializer) &&
        ts.isIdentifier(p.parent.parent.initializer.expression) &&
        p.parent.parent.initializer.expression.text === 'require') {
      return true;
    }
    
    currentNode = p;
  }
  
  return false;
}

// Helper to get line context
function getLineContext(sourceFile: ts.SourceFile, lineNum: number): string {
  const lines = sourceFile.text.split('\n');
  if (lineNum >= 0 && lineNum < lines.length) {
    return lines[lineNum].trim();
  }
  return '';
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
    console.log(`Analyzing symbol '${symbolName}' in package '${packageName}'...`);
    console.log(`Project root: ${projectRoot}`);
    
    let results = findSymbolUsage(projectRoot, packageName, symbolName);
    
    // If no results were found, try a fallback direct file analysis approach
    if (results.length === 0) {
      console.log("No results found with TypeScript Parser. Trying fallback approach...");
      results = findSymbolUsageWithDirectParsing(projectRoot, packageName, symbolName);
    }
    
    console.log(`Found ${results.length} results`);
    
    // Default output path if none provided
    const defaultOutputPath = path.join(projectRoot, 'symbol_usage_results.json');
    const finalOutputPath = outputPath || defaultOutputPath;
    
    // Save to file
    fs.writeFileSync(finalOutputPath, JSON.stringify(results, null, 2), 'utf8');
    console.log(`Results saved to ${finalOutputPath}`);
    
    return results;
  } catch (error) {
    console.error('Error analyzing symbol usage:', error);
    return [];
  }
}

// Fallback method: find symbol usage using direct file reading and pattern matching
function findSymbolUsageWithDirectParsing(
  projectRoot: string,
  packageName: string,
  symbolName: string
): SymbolUsageResult[] {
  const results: SymbolUsageResult[] = [];
  const fileNames: string[] = [];
  const extensions = ['.js', '.jsx', '.ts', '.tsx'];
  
  console.log("Using direct file parsing fallback approach");
  
  // Get all files recursively
  readFilesRecursively(projectRoot, extensions, fileNames);
  
  const escapedPackageName = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const escapedSymbolName = symbolName !== '*' ? symbolName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : '\\w+';
  
  const packageImportPattern = new RegExp(
    // ES6 import patterns
    `import\\s+(?:{[^}]*\\b${escapedSymbolName}\\b[^}]*}|\\*\\s+as\\s+\\w+|\\w+)\\s+from\\s+['"]${escapedPackageName}['"]|` +
    // CommonJS require patterns
    `(?:const|let|var)\\s+(?:{[^}]*\\b${escapedSymbolName}\\b[^}]*}|\\w+)\\s*=\\s*require\\s*\\(\\s*['"]${escapedPackageName}['"]\\s*\\)|` +
    // Direct require 
    `require\\s*\\(\\s*['"]${escapedPackageName}['"]\\s*\\)`
  );
  
  // If we're looking for all symbols, use a simpler pattern that just finds the package
  const packageOnlyPattern = new RegExp(`['"]${escapedPackageName}['"]`);
  
  // For each file, check if it contains imports of the package
  for (const fileName of fileNames) {
    try {
      const fileContent = fs.readFileSync(fileName, 'utf8');
      const lines = fileContent.split('\n');
      
      // Skip node_modules
      if (fileName.includes('node_modules')) {
        continue;
      }
      
      // First check if the file imports the package at all
      const patternToCheck = symbolName === '*' ? packageOnlyPattern : packageImportPattern;
      if (!patternToCheck.test(fileContent)) {
        continue;
      }
      
      console.log(`Found import of '${packageName}' in file: ${fileName}`);
      
      // Process each line to find imports and symbol usages
      for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
        const line = lines[lineIndex];
        
        // Skip empty lines
        if (!line.trim()) continue;
        
        // Skip comment lines
        if (line.trim().startsWith('//') || line.trim().startsWith('/*') || line.trim().startsWith('*')) continue;
        
        // Check for imports of the package
        if (line.includes(packageName) && (line.includes('import') || line.includes('require'))) {
          console.log(`  Checking line ${lineIndex + 1}: ${line.trim()}`);
          
          // For "wildcard" search, include all import statements for the package
          if (symbolName === '*') {
            const importStatement = line.trim();
            const importedSymbols = extractImportedSymbols(line, packageName);
            
            if (importedSymbols.length > 0) {
              for (const importedSymbol of importedSymbols) {
                console.log(`    Found imported symbol: ${importedSymbol}`);
                
                // Get usages of this symbol in the file
                const usageLocations = findSymbolUsagesInFile(lines, importedSymbol, undefined);
                console.log(`    Found ${usageLocations.length} usages of ${importedSymbol}`);
                
                results.push({
                  filePath: fileName,
                  importStatement,
                  line: lineIndex,
                  character: line.indexOf(packageName),
                  importedSymbol,
                  importStyle: line.includes('require') ? 'CommonJS' : 'ES6Import',
                  usageLocations
                });
              }
            } else {
              // If no symbols were extracted but there's a package reference, use a default
              console.log(`    No specific symbols found, using default`);
              results.push({
                filePath: fileName,
                importStatement: line.trim(),
                line: lineIndex,
                character: line.indexOf(packageName),
                importedSymbol: packageName, // Use package as default symbol name
                importStyle: line.includes('require') ? 'CommonJS' : 'ES6Import',
                usageLocations: []
              });
            }
          } 
          // For specific symbol search
          else {
            // Extract variable name from import (for property access detection)
            let importVariableName: string | undefined;
            const constMatch = line.match(/(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(\s*['"]lodash['"]\s*\)/);
            if (constMatch && constMatch[1]) {
              importVariableName = constMatch[1];
            }
            
            const importMatch = line.match(/import\s+(\w+)\s+from\s+['"]lodash['"]/);
            if (importMatch && importMatch[1]) {
              importVariableName = importMatch[1];
            }
            
            // Check for direct import of the symbol or whole package import
            if (line.includes(symbolName) || 
                // Check for object destructuring pattern
                (line.includes('{') && line.includes('}') && 
                 extractImportedSymbols(line, packageName).includes(symbolName)) ||
                // If we found a variable name, this could be a whole package import
                importVariableName) {
              
              if (line.includes(symbolName)) {
                console.log(`    Found import with target symbol '${symbolName}'`);
              } else if (importVariableName) {
                console.log(`    Found whole package import as '${importVariableName}', looking for '${importVariableName}.${symbolName}' usages`);
              }
              
              // Get usages of this symbol in the file, including as property on import variable
              const usageLocations = findSymbolUsagesInFile(lines, symbolName, importVariableName);
              console.log(`    Found ${usageLocations.length} usages of ${symbolName}`);
              
              if (usageLocations.length > 0 || line.includes(symbolName)) {
                results.push({
                  filePath: fileName,
                  importStatement: line.trim(),
                  line: lineIndex,
                  character: line.indexOf(packageName),
                  importedSymbol: symbolName,
                  importStyle: line.includes('require') ? 'CommonJS' : 'ES6Import',
                  usageLocations
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.error(`Error processing file ${fileName}: ${error}`);
    }
  }
  
  return results;
}

// Helper to extract imported symbols from an import statement
function extractImportedSymbols(line: string, packageName: string): string[] {
  const symbols: string[] = [];
  const escapedPackageName = packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // Check for destructured imports: import { x, y } from 'pkg'
  const destructuredMatch = line.match(new RegExp(`import\\s+{([^}]+)}\\s+from\\s+['"]${escapedPackageName}['"]`));
  if (destructuredMatch && destructuredMatch[1]) {
    symbols.push(...destructuredMatch[1].split(',').map(s => s.trim()));
    return symbols;
  }
  
  // Check for default import: import x from 'pkg'
  const defaultMatch = line.match(new RegExp(`import\\s+(\\w+)\\s+from\\s+['"]${escapedPackageName}['"]`));
  if (defaultMatch && defaultMatch[1]) {
    symbols.push(defaultMatch[1]);
    return symbols;
  }
  
  // Check for namespace import: import * as x from 'pkg'
  const namespaceMatch = line.match(new RegExp(`import\\s+\\*\\s+as\\s+(\\w+)\\s+from\\s+['"]${escapedPackageName}['"]`));
  if (namespaceMatch && namespaceMatch[1]) {
    symbols.push(namespaceMatch[1]);
    return symbols;
  }
  
  // Check for CommonJS destructured: const { x, y } = require('pkg')
  const commonJsDestructured = line.match(new RegExp(`(?:const|let|var)\\s+{([^}]+)}\\s*=\\s*require\\s*\\(\\s*['"]${escapedPackageName}['"]\\s*\\)`));
  if (commonJsDestructured && commonJsDestructured[1]) {
    symbols.push(...commonJsDestructured[1].split(',').map(s => s.trim()));
    return symbols;
  }
  
  // Check for CommonJS default: const x = require('pkg')
  const commonJsDefault = line.match(new RegExp(`(?:const|let|var)\\s+(\\w+)\\s*=\\s*require\\s*\\(\\s*['"]${escapedPackageName}['"]\\s*\\)`));
  if (commonJsDefault && commonJsDefault[1]) {
    symbols.push(commonJsDefault[1]);
    return symbols;
  }
  
  return symbols;
}

// Helper to find usages of a symbol in file contents
function findSymbolUsagesInFile(lines: string[], symbolName?: string, importVariableName?: string): Array<{line: number, character: number, context: string}> {
  const usages: Array<{line: number, character: number, context: string}> = [];
  
  // If no symbol name provided, return empty array
  if (!symbolName) {
    return usages;
  }
  
  // Simple regex to find direct symbol usage
  const symbolPattern = new RegExp(`\\b${symbolName}\\b`, 'g');
  
  // If we have an import variable (like _ for lodash), also look for property access
  const propertyPattern = importVariableName ? 
    new RegExp(`\\b${importVariableName}\\.${symbolName}\\b`, 'g') : null;
  
  // Check each line for usages
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex].trim();
    
    // Skip empty lines or import/require statements
    if (!line || line.includes('import') || line.includes('require(')) {
      continue;
    }
    
    // Skip comment lines
    if (line.startsWith('//') || line.startsWith('/*') || line.startsWith('*')) {
      continue;
    }
    
    // Look for direct symbol usages (for destructured imports)
    let match;
    while ((match = symbolPattern.exec(line)) !== null) {
      usages.push({
        line: lineIndex,
        character: match.index,
        context: line
      });
    }
    
    // Look for property access usages if we have an import variable (e.g., _.map)
    if (propertyPattern) {
      let propertyMatch;
      while ((propertyMatch = propertyPattern.exec(line)) !== null) {
        usages.push({
          line: lineIndex,
          character: propertyMatch.index,
          context: line
        });
      }
    }
  }
  
  return usages;
}

// Get command line arguments - when run with npm run, the actual arguments start at index 2
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Please provide both a package name and symbol name as arguments');
  console.error('Usage: npm run find-symbol-usage -- <package-name> <symbol-name> [options]');
  console.error('');
  console.error('Options:');
  console.error('  --output=<file.json>   Specify output file (must end with .json)');
  console.error('  --path=<project-path>  Specify project path to analyze');
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
  }
  // Handle --path parameter
  else if (arg.startsWith('--path=')) {
    projectPath = arg.substring('--path='.length);
  }
  // Handle for backward compatibility (positional arguments)
  else if (arg.endsWith('.json') && !outputPath) {
    outputPath = arg;
  }
  else if (!projectPath) {
    projectPath = arg;
  }
}

// Get the project root directory - use provided path or default to project root
const projectRoot = projectPath 
  ? path.resolve(projectPath) 
  : path.resolve(__dirname, '..');

// Run the symbol usage analysis
try {
  analyzeSymbolUsage(projectRoot, packageName, symbolName, outputPath);
} catch (error) {
  console.error('Error analyzing symbol usage:', error);
}