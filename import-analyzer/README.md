# Import Analyzer

A TypeScript tool to analyze imports in a JavaScript/TypeScript project using Abstract Syntax Tree (AST) parsing.

This tool scans a project directory to find where a specific symbol from a specific package is imported. It works with both ES6 imports and CommonJS require statements, and provides the exact location of each imported symbol.

## Installation

```sh
# Install dependencies
npm install

# Build the project
npm run build
```

You can also make the script executable:

```sh
chmod +x dist/analyze-imports.js
```

## Usage

Run the script with the following parameters:

```sh
# Using ts-node (for development)
npm start -- <projectPath> <packageName> <symbolName> [outputFile]

# Using compiled JavaScript
node dist/analyze-imports.js <projectPath> <packageName> <symbolName> [outputFile]

# Or if you made it executable
./dist/analyze-imports.js <projectPath> <packageName> <symbolName> [outputFile]
```

### Parameters

- `projectPath`: Path to the project directory to analyze
- `packageName`: Name of the package to look for imports from
- `symbolName`: Name of the symbol to look for (use 'default' for default exports)
- `outputFile` (optional): Path to a file where the results will be written as JSON

### Example

```sh
# Find all imports of useState from react and output to console
npm start -- ./my-project react useState

# Find all imports of useState from react and save to a file
npm start -- ./my-project react useState results.json
```

### Output

The script outputs a JSON array of objects with the following structure:

```json
[
  {
    "fileName": "/absolute/path/to/file.js",
    "importStatement": "import { useState } from 'react';",
    "line": 0,
    "character": 9,
    "importedSymbol": "useState",
    "importStyle": "ES6"
  }
]
```

If an output file is specified, the results will be written to that file. Otherwise, they will be printed to the console.

Each object contains:

- `fileName`: The absolute path to the file containing the import
- `importStatement`: The full import statement text
- `line`: 0-based line number of the import symbol (not the import statement)
- `character`: 0-based character position of the import symbol (not the import statement)
- `importedSymbol`: The name of the symbol as used in the file (may be different if renamed)
- `importStyle`: The import style (ES6 or CommonJS)

## How Position Information Works

The script uses the Babel parser to create an Abstract Syntax Tree (AST) of each file, and then traverses this tree to find imports from the specified package. When it finds an import of the specified symbol, it extracts the exact position directly from the AST's location information.

### AST-based Position Finding

The Babel parser annotates each node in the AST with a `loc` property that contains the exact source position:
- `loc.start.line`: The line number (1-based, converted to 0-based in our output)
- `loc.start.column`: The character position (0-based)

For different import types, the position is extracted from different AST nodes:

1. **ES6 Named Imports**:
   ```javascript
   import { Field } from 'formik';
   ```
   The position comes from the `ImportSpecifier` node for `Field`.

2. **ES6 Default Imports**:
   ```javascript
   import React from 'react';
   ```
   The position comes from the `ImportDefaultSpecifier` node.

3. **ES6 Namespace Imports**:
   ```javascript
   import * as React from 'react';
   ```
   The position comes from the `ImportNamespaceSpecifier` node.

4. **CommonJS Destructured Requires**:
   ```javascript
   const { map } = require('lodash');
   ```
   The position comes from the `ObjectProperty` node for `map`.

5. **CommonJS Default Requires**:
   ```javascript
   const React = require('react');
   ```
   The position comes from the `Identifier` node for `React`.

### Multi-line Import Support

The script correctly handles both single-line and multi-line imports. For example:

```javascript
// Single-line import
import { useState } from 'react';

// Multi-line import
import {
  Field,
  Formik
} from 'formik';
```

In both cases, the position will point to the exact location of the specified symbol.

## How It Works

This tool uses the Babel parser to convert JavaScript/TypeScript code into an Abstract Syntax Tree (AST). It then traverses the AST to find import statements and require calls that match the specified package and symbol.

The tool handles various import styles:

1. ES6 imports:
   - Named imports: `import { useState } from 'react'`
   - Default imports: `import React from 'react'`
   - Namespace imports: `import * as React from 'react'`
   - Renamed imports: `import { useState as useStateHook } from 'react'`

2. CommonJS imports:
   - Direct requires: `const React = require('react')`
   - Destructured requires: `const { useState } = require('react')`

## Error Handling

The script includes robust error handling to deal with:
- Files that can't be read
- Files that can't be parsed
- Errors during AST traversal

When an error occurs, the script will log a warning message and continue processing other files, rather than failing completely.

## Statistics

After running, the script displays statistics about the analysis:
- Total files processed
- Files skipped due to errors
- Import occurrences found
- Analysis duration in seconds

## Example Use Cases

- Find all usages of a deprecated symbol across a large codebase
- Identify how widely a particular package is used
- Generate documentation about dependencies
- Prepare for refactoring by understanding symbol usage patterns 