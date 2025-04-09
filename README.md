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