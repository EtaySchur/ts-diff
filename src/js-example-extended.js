// -------------------------------------------
// CommonJS / Node.js style imports
// -------------------------------------------
const ReactRouter = require('react-router-dom');

// ES6 destructuring with CommonJS
const { Route, Switch } = require('react-router-dom');

// Use imported symbols
function createRoute(path, component) {
  return ReactRouter.Route({
    path,
    component
  });
}

// -------------------------------------------
// ES6 Module imports
// -------------------------------------------
import React from 'react';
import { useState, useEffect } from 'react';
import * as ReactDOM from 'react-dom';

// -------------------------------------------
// Dynamic imports
// -------------------------------------------
async function loadRouter() {
  const router = await import('react-router-dom');
  return router.BrowserRouter;
}

// -------------------------------------------
// AMD style (RequireJS)
// -------------------------------------------
require(['react-router-dom'], function(reactRouter) {
  const router = reactRouter.BrowserRouter;
  console.log('Router loaded!', router);
});

// -------------------------------------------
// UMD pattern usage
// -------------------------------------------
// Using global variable exposed by UMD module
function createFormikForm() {
  return window.Formik.useFormik({
    initialValues: { name: '' },
    onSubmit: values => console.log(values)
  });
}

// UMD module consumption through global
const FormikField = window.Formik.Field;

// UMD module definition that consumes another package
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['react-router-dom'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // CommonJS
    module.exports = factory(require('react-router-dom'));
  } else {
    // Browser globals
    root.RouterWrapper = factory(root.ReactRouter);
  }
}(typeof self !== 'undefined' ? self : this, function(reactRouter) {
  return {
    createRouter: function() {
      return new reactRouter.BrowserRouter();
    }
  };
}));

// -------------------------------------------
// SystemJS patterns
// -------------------------------------------
// SystemJS dynamic import
SystemJS.import('react-router-dom').then(function(routerModule) {
  const RouterComponent = routerModule.BrowserRouter;
  // Use the imported module
  console.log(RouterComponent);
});

// SystemJS configuration
SystemJS.config({
  map: {
    'react-router-dom': '/path/to/react-router-dom.js',
    'formik': '/path/to/formik.js'
  },
  meta: {
    'react-router-dom': {
      format: 'cjs'
    }
  }
});

// SystemJS.register module definition
SystemJS.register(['react-router-dom'], function(exports, context) {
  var RouterModule;
  return {
    setters: [
      function(m) { RouterModule = m; }
    ],
    execute: function() {
      exports('default', function() {
        return new RouterModule.BrowserRouter();
      });
    }
  };
});

// -------------------------------------------
// ES Module interop pattern
// -------------------------------------------
const formik = require('formik');
// Access the default export on a CommonJS module
const Formik = formik.default;

// -------------------------------------------
// Global variable usage
// -------------------------------------------
function initializeForm() {
  return global.Formik.useFormik({
    initialValues: {}
  });
}

// -------------------------------------------
// Import maps (modern browsers)
// -------------------------------------------
// This would typically be in HTML, shown here for reference
// <script type="importmap">
// {
//   "imports": {
//     "formik": "/path/to/formik.js"
//   }
// }
// </script>

// Then in JS you'd use:
// import { useFormik } from 'formik';

// Using import.meta for module resolution
if (typeof import.meta !== 'undefined') {
  import.meta.resolve('formik').then(url => {
    console.log('Formik resolved to:', url);
  });
}

// Module exports
module.exports = {
  createRoute,
  loadRouter,
  createFormikForm,
  initializeForm
}; 