# Formik Test Application

A simple Node.js application with a contact form built using Formik version 1.5.8.

## Features

- React-based form handling with Formik 1.5.8
- Form validation
- Responsive design with Bootstrap
- Display of submitted data

## Prerequisites

- Node.js (>= 12.x)
- npm (>= 6.x)

## Installation

1. Clone this repository or download the source code.
2. Navigate to the project directory.
3. Install dependencies:

```bash
npm install
```

## Development

To run the application in development mode:

```bash
npm start
```

This will start the webpack development server and open the application in your default browser.

## Production Build

To build the application for production:

```bash
npm run build
```

This will create a `dist` directory with the compiled application.

## Running in Production

After building the application, you can serve it using the included Express server:

```bash
node server.js
```

The application will be available at http://localhost:3000.

## Form Validation

The form validates the following fields:
- First Name (required)
- Last Name (required)
- Email (required, must be a valid email format)
- Phone (required, must contain 10 digits)
- Message (optional)

## Technologies Used

- React
- Formik 1.5.8
- Express
- Webpack
- Babel
- Bootstrap (CSS only) 

## Utility Tools

### Package Usage Finder

The project includes a utility tool to find and analyze how npm packages are being used in the codebase.

#### Usage

To find package usage:

```bash
npm run find-package-usage -- <package-name> [output-file] [path-to-search]
```

##### Examples:

Find React usage in the current project:
```bash
npm run find-package-usage -- react
```

Find Formik usage in a specific directory and save results to a file:
```bash
npm run find-package-usage -- formik output.json ./src
```

The tool will:
- Scan all JavaScript/TypeScript files in the specified directory
- Find all imports of the specified package
- Detect various import styles including:
  - ES6 imports (`import React from 'react'`)
  - CommonJS requires (`const React = require('react')`)
  - Dynamic imports (`import('react')`)
  - AMD module format (`define(['react'], function(React) { ... })`)
  - RequireJS (`require(['react'], function(React) { ... })`)
  - UMD patterns
  - Global variables (`window.React`)
- Analyze how the imported components/functions are used
- Output the results to the console or to a specified JSON file 