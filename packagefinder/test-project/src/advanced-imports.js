// AMD Define pattern
define(['jquery', 'lodash', 'react'], function($, _, React) {
  // Use the dependencies
  var element = React.createElement('div', null, 'Hello');
  return {
    init: function() {
      $('#app').html(element);
      _.forEach([1, 2, 3], function(n) {
        console.log(n);
      });
    }
  };
});

// UMD Factory pattern
(function(root, factory) {
  if (typeof define === 'function' && define.amd) {
    // AMD
    define(['react', 'react-dom'], factory);
  } else if (typeof module === 'object' && module.exports) {
    // CommonJS
    module.exports = factory(require('react'), require('react-dom'));
  } else {
    // Browser globals
    root.MyModule = factory(root.React, root.ReactDOM);
  }
}(this, function(React, ReactDOM) {
  'use strict';
  
  // Module code
  return {
    render: function(elementId) {
      ReactDOM.render(
        React.createElement('div', null, 'UMD Module'),
        document.getElementById(elementId)
      );
    }
  };
}));

// ESM Import Maps (modern browsers)
async function loadComponent() {
  const reactUrl = await import.meta.resolve('react');
  const module = await import(reactUrl);
  return module.default;
} 