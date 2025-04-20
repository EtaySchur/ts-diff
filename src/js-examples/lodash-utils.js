/**
 * Lodash utility functions demonstrating different import styles.
 * This file contains various helper functions that use Lodash.
 */

// ============================================================
// CommonJS Style Import
// ============================================================
const _ = require('lodash');

/**
 * Groups an array of objects by a specified property and counts items in each group.
 * @param {Array} items - Array of objects to group
 * @param {string} property - Property name to group by
 * @returns {Object} Object with counts by group
 */
function countByProperty(items, property) {
  const groups = _.groupBy(items, property);
  
  // Convert groups to counts
  return _.mapValues(groups, group => group.length);
}

/**
 * Flattens a nested array and removes duplicates.
 * @param {Array} nestedArray - The nested array to flatten and deduplicate
 * @returns {Array} Flattened array with unique values
 */
function flattenAndUnique(nestedArray) {
  return _.uniq(_.flatten(nestedArray));
}

// ============================================================
// UMD / AMD Style Module Definition
// ============================================================

// Create a UMD module that works in both browser and Node.js environments
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD (RequireJS)
    define(['lodash'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // CommonJS (Node.js)
    module.exports = factory(require('lodash'));
  } else {
    // Browser globals
    root.LodashUtils = factory(root._);
  }
}(typeof self !== 'undefined' ? self : this, function(_) {
  
  return {
    /**
     * Deep merges multiple objects together.
     * @param {...Object} objects - Objects to merge
     * @returns {Object} New merged object
     */
    deepMerge: function(...objects) {
      return _.merge({}, ...objects);
    },
    
    /**
     * Creates a debounced function that delays invoking the provided function.
     * @param {Function} func - The function to debounce
     * @param {number} wait - Milliseconds to delay
     * @returns {Function} Debounced function
     */
    createDebounced: function(func, wait = 300) {
      return _.debounce(func, wait);
    },
    
    /**
     * Safely gets a nested property from an object without throwing errors.
     * @param {Object} object - The object to query
     * @param {string|Array} path - Path of the property to get
     * @param {*} defaultValue - Value returned for undefined resolved values
     * @returns {*} The resolved value
     */
    getNestedValue: function(object, path, defaultValue) {
      return _.get(object, path, defaultValue);
    }
  };
}));

// ============================================================
// SystemJS Dynamic Import (for browser environments)
// ============================================================

// Only execute in environments that support SystemJS
if (typeof SystemJS !== 'undefined') {
  // Create a SystemJS module that uses Lodash
  SystemJS.import('lodash').then(function(lodashModule) {
    const _ = lodashModule.default || lodashModule;
    
    // Register a utility module with SystemJS
    SystemJS.register('lodash-date-utils', [], function(exports) {
      return {
        setters: [],
        execute: function() {
          exports({
            /**
             * Formats an array of dates consistently.
             * @param {Array<Date>} dates - Array of dates to format
             * @returns {Array<string>} Formatted date strings
             */
            formatDates: function(dates) {
              return _.map(dates, date => {
                return _.isDate(date) ? date.toISOString() : 'Invalid date';
              });
            },
            
            /**
             * Sorts dates in ascending order.
             * @param {Array<Date>} dates - Array of dates to sort
             * @returns {Array<Date>} Sorted dates
             */
            sortDates: function(dates) {
              return _.sortBy(dates, date => date.getTime());
            }
          });
        }
      };
    });
    
    console.log('Lodash date utilities registered with SystemJS');
  }).catch(function(error) {
    console.error('Error loading Lodash with SystemJS:', error);
  });
}

// Export CommonJS style functions
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    countByProperty,
    flattenAndUnique
  };
} 