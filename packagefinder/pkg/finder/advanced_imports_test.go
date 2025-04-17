package finder

import (
	"os"
	"path/filepath"
	"testing"
)

func TestAdvancedImports(t *testing.T) {
	// Create a temporary directory for test files
	tempDir, err := os.MkdirTemp("", "packagefinder-advanced-test")
	if err != nil {
		t.Fatalf("Failed to create temp directory: %v", err)
	}
	defer os.RemoveAll(tempDir)

	// Create a test file with advanced import patterns
	testFilePath := filepath.Join(tempDir, "advanced.js")
	testFileContent := `// AMD Define pattern
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
}`

	err = os.WriteFile(testFilePath, []byte(testFileContent), 0644)
	if err != nil {
		t.Fatalf("Failed to write test file: %v", err)
	}

	// Test finding React usages in various formats
	reactResults, err := findPackageInFile(testFilePath, testFileContent, "react")
	if err != nil {
		t.Fatalf("findPackageInFile failed: %v", err)
	}

	// We expect to find at least 4 React usages in different formats
	if len(reactResults) < 4 {
		t.Errorf("Expected at least 4 React imports (AMD, UMD, CommonJS, ESM), got %d", len(reactResults))
	}

	// Check if we found the AMD define pattern
	foundAMD := false
	for _, result := range reactResults {
		if result.ImportStyle == RequireJS {
			foundAMD = true
			break
		}
	}

	if !foundAMD {
		t.Errorf("AMD define pattern not detected")
	}

	// Check if we found the UMD factory pattern
	foundUMD := false
	for _, result := range reactResults {
		if result.ImportStyle == UMD {
			foundUMD = true
			break
		}
	}

	if !foundUMD {
		t.Errorf("UMD factory pattern not detected")
	}

	// Check if we found the ESM import map pattern
	foundESM := false
	for _, result := range reactResults {
		if result.ImportStyle == ImportMaps {
			foundESM = true
			break
		}
	}

	if !foundESM {
		t.Errorf("ESM import map pattern not detected")
	}

	// Test finding Lodash usage
	lodashResults, err := findPackageInFile(testFilePath, testFileContent, "lodash")
	if err != nil {
		t.Fatalf("findPackageInFile failed: %v", err)
	}

	if len(lodashResults) < 1 {
		t.Errorf("Expected at least 1 Lodash import, got %d", len(lodashResults))
	}
}
