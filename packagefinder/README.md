# Package Usage Finder

A Go tool to find all usages of a specific NPM/JavaScript package in a project. Similar to the TypeScript implementation, this tool can detect various import styles and track symbol usages.

## Features

- Detects multiple import styles:
  - ES6 imports (`import x from 'package'`, `import {x} from 'package'`)
  - CommonJS imports (`const x = require('package')`)
  - Dynamic imports (`import('package')`)
  - SystemJS imports (`System.import('package')`)
  - Global variables (`window.package`)
  - AMD define (`define(['package'], function(pkg) {})`)
  - UMD factory pattern (Universal Module Definition)
  - ESM import maps (`import.meta.resolve('package')`)
- Tracks symbol usages throughout the codebase
- JSON output for programmatic consumption
- Human-readable console output

## Installation

```sh
# Clone the repository
git clone https://github.com/user/packagefinder.git
cd packagefinder

# Build the project
go build -o packagefinder ./cmd
```

## Usage

```sh
# Basic usage
./packagefinder react

# Specify a project directory
./packagefinder -project /path/to/your/project formik

# Save results to JSON file
./packagefinder -output results.json lodash

# Get help
./packagefinder -help
```

## Example Output

```
Found 3 usage(s):

1. File: /path/to/project/src/App.js
   Import: import React from 'react'
   At: Line 1, Character 1
   Import Style: ES6Import
   Imported Symbols: React
   Symbol Usages:
     - React - 5 usage(s):
       1. Line 5, Character 3
          Context: return React.createElement('div', null, 'Hello World');
       2. Line 10, Character 7
          Context: const element = React.useState(null);
----------------------------------------------------------------------
```

## Advanced Import Styles

The tool detects advanced module patterns including:

### AMD Define

```js
define(['jquery', 'lodash', 'react'], function($, _, React) {
  var element = React.createElement('div', null, 'Hello');
  // Rest of the code
});
```

### UMD Factory Pattern

```js
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    define(['react'], factory);
  } else if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('react'));
  } else {
    root.MyModule = factory(root.React);
  }
}(this, function(React) {
  // Module code
}));
```

### ESM Import Maps

```js
// Modern browsers
async function loadComponent() {
  const reactUrl = await import.meta.resolve('react');
  const module = await import(reactUrl);
  return module.default;
}
```

## Requirements

- Go 1.16 or higher 