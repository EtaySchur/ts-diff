// ============================================================
// Example 1: CommonJS Import Style
// ============================================================

// Basic require - imports the entire Lodash library
const _ = require('lodash');

// Destructured require - imports specific functions
const { map, filter, reduce } = require('lodash');

// Example usage with CommonJS import
function commonJSExample() {
  const numbers = [1, 2, 3, 4, 5];
  
  // Using the full Lodash library
  const evens = _.filter(numbers, n => n % 2 === 0);
  console.log('CommonJS - Even numbers:', evens);
  
  // Using destructured imports
  const doubled = map(numbers, n => n * 2);
  console.log('CommonJS - Doubled numbers:', doubled);
  
  // Using reduce with destructured import
  const sum = reduce(numbers, (total, n) => total + n, 0);
  console.log('CommonJS - Sum:', sum);
}

// ============================================================
// Example 2: AMD (RequireJS) Import Style
// ============================================================

// Define a module with Lodash as a dependency
define(['lodash'], function(_) {
  'use strict';
  
  // Return module definition
  return {
    processData: function(items) {
      return _.chain(items)
        .filter(item => item.active)
        .map(item => item.name.toUpperCase())
        .value();
    },
    
    calculateStats: function(numbers) {
      return {
        sum: _.sum(numbers),
        average: _.mean(numbers),
        min: _.min(numbers),
        max: _.max(numbers)
      };
    }
  };
});

// Alternative AMD require syntax
require(['lodash'], function(_) {
  // Direct usage in a require callback
  const numbers = [10, 5, 20, 15];
  console.log('AMD - Stats:', {
    sum: _.sum(numbers),
    average: _.mean(numbers)
  });
});

// ============================================================
// Example 3: SystemJS Import Style
// ============================================================

// SystemJS dynamic import (in a browser environment)
if (typeof SystemJS !== 'undefined') {
  SystemJS.import('lodash').then(function(lodash) {
    const _ = lodash;
    
    // Use the imported module
    const numbers = [1, 2, 3, 4, 5];
    const result = _.chain(numbers)
      .map(n => n * 2)
      .filter(n => n > 5)
      .value();
    
    console.log('SystemJS - Filtered doubled numbers:', result);
  }).catch(function(error) {
    console.error('Error loading Lodash with SystemJS:', error);
  });
}

// ============================================================
// Example 4: UMD (Universal Module Definition)
// ============================================================

// UMD modules work in both CommonJS and AMD environments
// This is how you would create a UMD module that depends on Lodash

(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['lodash'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // CommonJS
    module.exports = factory(require('lodash'));
  } else {
    // Browser globals (root is window)
    root.LodashUtils = factory(root._);
  }
}(typeof self !== 'undefined' ? self : this, function(_) {
  // Module functionality
  return {
    sortByProperty: function(array, prop) {
      return _.sortBy(array, prop);
    },
    
    groupByProperty: function(array, prop) {
      return _.groupBy(array, prop);
    },
    
    findByProperty: function(array, prop, value) {
      return _.find(array, item => item[prop] === value);
    }
  };
}));

// ============================================================
// Example 5: ES6 Dynamic Import
// ============================================================

// Modern dynamic import (works in modern browsers and Node.js with ESM support)
async function useLodashDynamically() {
  try {
    // Dynamic import returns a promise
    const lodashModule = await import('lodash');
    const _ = lodashModule.default;
    
    // Use the dynamically imported module
    const data = [
      { name: 'John', age: 30 },
      { name: 'Jane', age: 25 },
      { name: 'Bob', age: 40 }
    ];
    
    const sorted = _.sortBy(data, 'age');
    console.log('Dynamic import - Sorted by age:', sorted);
    
    return sorted;
  } catch (error) {
    console.error('Error dynamically importing Lodash:', error);
    return null;
  }
}

// Only run the CommonJS example in a Node.js environment
if (typeof window === 'undefined') {
  commonJSExample();
}

// Export functions for Node.js (CommonJS)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    commonJSExample,
    useLodashDynamically
  };
} 