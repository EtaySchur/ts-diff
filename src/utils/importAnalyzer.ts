import * as ts from 'typescript';
import * as path from 'path';
import * as fs from 'fs';

interface ImportDetail {
  importName: string;
  importedFrom: string;
  resolvedPath: string;
  isNodeModule: boolean;
  originalLocation: {
    fileName: string;
    line: number;
    character: number;
  };
}

export function analyzeImports(projectRoot: string): ImportDetail[] {
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
  
  const checker = program.getTypeChecker();
  const results: ImportDetail[] = [];
  
  // Process all source files
  for (const sourceFile of program.getSourceFiles()) {
    // Skip declaration files and node_modules files
    if (sourceFile.isDeclarationFile || sourceFile.fileName.includes('node_modules')) {
      continue;
    }
    
    // Visit all nodes in the source file
    ts.forEachChild(sourceFile, node => {
      visitNode(node, sourceFile);
    });
  }
  
  function visitNode(node: ts.Node, sourceFile: ts.SourceFile): void {
    // Look for import declarations
    if (ts.isImportDeclaration(node)) {
      if (ts.isStringLiteral(node.moduleSpecifier)) {
        const importPath = node.moduleSpecifier.text;
        
        // Get imported symbols
        if (node.importClause) {
          const namedBindings = node.importClause.namedBindings;
          
          if (namedBindings && ts.isNamedImports(namedBindings)) {
            // Process each named import
            namedBindings.elements.forEach(element => {
              processNamedImport(element, importPath, sourceFile);
            });
          } else if (node.importClause.name) {
            // Default import
            const defaultImport = node.importClause.name.text;
            processDefaultImport(defaultImport, importPath, sourceFile);
          }
        }
      }
    }
    
    // Recursively visit all child nodes
    ts.forEachChild(node, childNode => {
      visitNode(childNode, sourceFile);
    });
  }
  
  function processNamedImport(
    element: ts.ImportSpecifier, 
    importPath: string, 
    sourceFile: ts.SourceFile
  ): void {
    const importName = element.name.text;
    const position = element.getStart(sourceFile);
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(position);
    
    try {
      // Resolve the module
      const resolvedModule = resolveModulePath(importPath, sourceFile.fileName);
      
      results.push({
        importName,
        importedFrom: importPath,
        resolvedPath: resolvedModule,
        isNodeModule: resolvedModule.includes('node_modules'),
        originalLocation: {
          fileName: sourceFile.fileName,
          line: line + 1, // Add 1 to make it 1-based
          character: character + 1
        }
      });
    } catch (error) {
      console.error(`Error resolving module "${importPath}": ${error}`);
    }
  }
  
  function processDefaultImport(
    importName: string, 
    importPath: string, 
    sourceFile: ts.SourceFile
  ): void {
    const position = sourceFile.getStart();
    const { line, character } = sourceFile.getLineAndCharacterOfPosition(position);
    
    try {
      // Resolve the module
      const resolvedModule = resolveModulePath(importPath, sourceFile.fileName);
      
      results.push({
        importName,
        importedFrom: importPath,
        resolvedPath: resolvedModule,
        isNodeModule: resolvedModule.includes('node_modules'),
        originalLocation: {
          fileName: sourceFile.fileName,
          line: line + 1,
          character: character + 1
        }
      });
    } catch (error) {
      console.error(`Error resolving module "${importPath}": ${error}`);
    }
  }
  
  function resolveModulePath(importPath: string, containingFile: string): string {
    const resolvedModule = ts.resolveModuleName(
      importPath,
      containingFile,
      parsedConfig.options,
      ts.sys
    );
    
    if (resolvedModule.resolvedModule) {
      return resolvedModule.resolvedModule.resolvedFileName;
    }
    
    throw new Error(`Could not resolve module "${importPath}" from "${containingFile}"`);
  }
  
  return results;
}

// Function to print results in a readable format
export function printImportResults(results: ImportDetail[]): void {
  results.forEach(result => {
    console.log(`Import: ${result.importName}`);
    console.log(`  Imported from: ${result.importedFrom}`);
    console.log(`  Resolved to: ${result.resolvedPath}`);
    console.log(`  Is node module: ${result.isNodeModule}`);
    console.log(`  Location: ${result.originalLocation.fileName}:${result.originalLocation.line}:${result.originalLocation.character}`);
    console.log('---');
  });
} 