package finder

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// Regular expressions for detecting different import styles
var (
	// ES6 import patterns - updated for better matching
	es6ImportRegex    = regexp.MustCompile(`import\s+(?:.*\s+from\s+)?['"]([^'"]+)['"]`)
	es6ImportAllRegex = regexp.MustCompile(`import\s+\*\s+as\s+(\w+)\s+from\s+['"]([^'"]+)['"]`)

	// CommonJS require patterns
	requireRegex = regexp.MustCompile(`(?:(?:const|let|var)\s+(?:{([^}]*)}\s*=\s*)?(\w+)\s*=\s*)?require\s*\(\s*['"]([^'"]+)['"]\s*\)`)

	// Dynamic import patterns
	dynamicImportRegex = regexp.MustCompile(`import\s*\(\s*['"]([^'"]+)['"]\s*\)`)

	// SystemJS patterns
	systemJSRegex = regexp.MustCompile(`System\.import\s*\(\s*['"]([^'"]+)['"]\s*\)`)

	// Global variable patterns
	globalVarRegex = regexp.MustCompile(`(?:window|global)\.(\w+)`)

	// AMD define patterns - new
	amdDefineRegex = regexp.MustCompile(`define\s*\(\s*\[([^\]]*)\]`)

	// UMD factory pattern - new
	umdFactoryRegex = regexp.MustCompile(`\(\s*function\s*\(\s*(?:root|global|window)(?:\s*,\s*factory)?\s*\)`)

	// ESM import maps - new
	esmImportMapRegex = regexp.MustCompile(`import\.meta\.resolve\s*\(\s*['"]([^'"]+)['"]\s*\)`)

	// Additional patterns can be added as needed
)

// FindPackageUsage finds all usages of the specified package in the project
func FindPackageUsage(projectRoot, packageName string) ([]PackageUsage, error) {
	results := []PackageUsage{}

	// Map to track imported symbols for usage analysis
	importedSymbolsByFile := make(map[string]map[string]bool)

	// Walk through all files in the project
	err := filepath.Walk(projectRoot, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		// Skip directories, node_modules, and non-JS/TS files
		if info.IsDir() {
			// Skip node_modules directory
			if info.Name() == "node_modules" || info.Name() == ".git" {
				return filepath.SkipDir
			}
			return nil
		}

		// Only process JS, JSX, TS, TSX files
		ext := filepath.Ext(path)
		if !isJavaScriptFile(ext) {
			return nil
		}

		// Read file content
		content, err := ioutil.ReadFile(path)
		if err != nil {
			fmt.Printf("Warning: Could not read file %s: %v\n", path, err)
			return nil
		}

		// Search for package usage in the file
		fileResults, err := findPackageInFile(path, string(content), packageName)
		if err != nil {
			fmt.Printf("Warning: Error processing file %s: %v\n", path, err)
			return nil
		}

		// Track imported symbols for later usage analysis
		if len(fileResults) > 0 {
			symbolsMap := make(map[string]bool)
			for _, result := range fileResults {
				for _, symbol := range result.ImportedSymbols {
					if symbol != "(side-effect only)" &&
						symbol != "(dynamic import)" &&
						symbol != "(require)" &&
						symbol != "(SystemJS import)" &&
						symbol != "(UMD factory)" &&
						symbol != "(AMD require)" &&
						symbol != "(ImportMaps)" &&
						symbol != "(SystemJS config)" &&
						symbol != "(SystemJS register)" {
						symbolsMap[symbol] = true
					}
				}
			}
			if len(symbolsMap) > 0 {
				importedSymbolsByFile[path] = symbolsMap
			}

			results = append(results, fileResults...)
		}

		return nil
	})

	if err != nil {
		return nil, fmt.Errorf("error walking directory: %v", err)
	}

	// Second pass to find symbol usages
	if len(results) > 0 {
		for i := range results {
			filePath := results[i].FileName
			if symbolsMap, ok := importedSymbolsByFile[filePath]; ok && len(symbolsMap) > 0 {
				// Find usages of imported symbols
				symbolUsages, err := findSymbolUsages(filePath, symbolsMap)
				if err == nil && len(symbolUsages) > 0 {
					results[i].SymbolUsages = symbolUsages
				}
			}
		}
	}

	return results, nil
}

// isJavaScriptFile checks if the file extension is for a JavaScript/TypeScript file
func isJavaScriptFile(ext string) bool {
	return ext == ".js" || ext == ".jsx" || ext == ".ts" || ext == ".tsx"
}

// findPackageInFile searches for package usage in a single file
func findPackageInFile(filePath, content, packageName string) ([]PackageUsage, error) {
	results := []PackageUsage{}

	// Create regex with the package name to search for exact matches
	packageNameEscaped := regexp.QuoteMeta(packageName)

	// Try direct regex search for quick check
	quickCheck := regexp.MustCompile(fmt.Sprintf(`['"]%s['"]`, packageNameEscaped))
	if !quickCheck.MatchString(content) {
		return results, nil
	}

	// ES6 imports
	es6ImportMatches := es6ImportRegex.FindAllStringSubmatchIndex(content, -1)
	for _, match := range es6ImportMatches {
		if match == nil || len(match) < 2 {
			continue
		}

		// Extract the matched module name - in our updated regex it's in capture group 1
		moduleStart := match[2]
		moduleEnd := match[3]
		if moduleStart < 0 || moduleEnd > len(content) {
			continue
		}

		moduleName := content[moduleStart:moduleEnd]
		if moduleName != packageName {
			continue
		}

		// Calculate line number (1-based) and character position (1-based)
		lineNum, charPos := getLineAndCharacter(content, match[0])

		// Get the full import statement
		lineStart := strings.LastIndex(content[:match[0]], "\n") + 1
		if lineStart < 0 {
			lineStart = 0
		}
		lineEnd := match[1]
		nextNewline := strings.Index(content[lineEnd:], "\n")
		if nextNewline >= 0 {
			lineEnd += nextNewline
		} else {
			lineEnd = len(content)
		}
		importStatement := strings.TrimSpace(content[lineStart:lineEnd])

		// Extract imported symbols - parse from the importStatement
		importedSymbols := extractSymbolsFromES6Import(importStatement, packageName)

		results = append(results, PackageUsage{
			FileName:        filePath,
			ImportStatement: importStatement,
			Line:            lineNum,
			Character:       charPos,
			ImportedSymbols: importedSymbols,
			ImportStyle:     ES6Import,
			IsDynamicImport: false,
		})
	}

	// ES6 import * as NAME from 'package'
	es6ImportAllMatches := es6ImportAllRegex.FindAllStringSubmatchIndex(content, -1)
	for _, match := range es6ImportAllMatches {
		if match == nil || len(match) < 6 {
			continue
		}

		// Extract module name
		moduleName := content[match[4]:match[5]]
		if moduleName != packageName {
			continue
		}

		lineNum, charPos := getLineAndCharacter(content, match[0])

		// Get namespace name
		namespaceName := content[match[2]:match[3]]

		// Get full import statement
		lineStart := strings.LastIndex(content[:match[0]], "\n") + 1
		if lineStart < 0 {
			lineStart = 0
		}
		lineEnd := match[1]
		nextNewline := strings.Index(content[lineEnd:], "\n")
		if nextNewline >= 0 {
			lineEnd += nextNewline
		} else {
			lineEnd = len(content)
		}
		importStatement := strings.TrimSpace(content[lineStart:lineEnd])

		results = append(results, PackageUsage{
			FileName:        filePath,
			ImportStatement: importStatement,
			Line:            lineNum,
			Character:       charPos,
			ImportedSymbols: []string{"* as " + namespaceName},
			ImportStyle:     ES6Import,
			IsDynamicImport: false,
		})
	}

	// CommonJS require
	requireMatches := requireRegex.FindAllStringSubmatchIndex(content, -1)
	for _, match := range requireMatches {
		if match == nil || match[6] < 0 || match[7] <= match[6] {
			continue
		}

		// Extract module name
		moduleName := content[match[6]:match[7]]
		if moduleName != packageName {
			continue
		}

		lineNum, charPos := getLineAndCharacter(content, match[0])

		// Get full require statement
		lineStart := strings.LastIndex(content[:match[0]], "\n") + 1
		if lineStart < 0 {
			lineStart = 0
		}
		lineEnd := match[1]
		nextNewline := strings.Index(content[lineEnd:], "\n")
		if nextNewline >= 0 {
			lineEnd += nextNewline
		} else {
			lineEnd = len(content)
		}
		importStatement := strings.TrimSpace(content[lineStart:lineEnd])

		// Extract imported symbols
		importedSymbols := []string{}

		// Add the variable name (module reference)
		if match[4] > 0 && match[5] > match[4] {
			varName := content[match[4]:match[5]]
			importedSymbols = append(importedSymbols, strings.TrimSpace(varName))
		}

		// Check for destructuring
		if match[2] > 0 && match[3] > match[2] {
			destructuring := content[match[2]:match[3]]
			for _, symbol := range strings.Split(destructuring, ",") {
				symbol = strings.TrimSpace(symbol)

				// Handle aliased requires like { originalName: aliasName }
				if strings.Contains(symbol, ":") {
					parts := strings.Split(symbol, ":")
					if len(parts) == 2 {
						symbol = strings.TrimSpace(parts[1])
					}
				}

				if symbol != "" {
					importedSymbols = append(importedSymbols, symbol)
				}
			}
		}

		// If no symbols were extracted, use module name as a fallback
		if len(importedSymbols) == 0 {
			// Try to extract variable name from context
			varNamePattern := regexp.MustCompile(`(?:const|let|var)\s+(\w+)\s*=\s*require\s*\(`)
			varNameMatch := varNamePattern.FindStringSubmatch(importStatement)
			if varNameMatch != nil && len(varNameMatch) > 1 {
				importedSymbols = append(importedSymbols, varNameMatch[1])
			} else {
				importedSymbols = append(importedSymbols, packageName)
			}
		}

		// Check if this is a require for a React or React-like package and also add PascalCase version if needed
		if strings.ToLower(packageName) == "react" || strings.HasPrefix(strings.ToLower(packageName), "react-") {
			// Add both lowercase and uppercase versions for React packages
			hasLowerCase := false
			hasUpperCase := false

			for _, symbol := range importedSymbols {
				if symbol == "react" || symbol == packageName {
					hasLowerCase = true
				}
				if symbol == "React" {
					hasUpperCase = true
				}
			}

			// Add both casing variations if they don't already exist
			if hasLowerCase && !hasUpperCase {
				importedSymbols = append(importedSymbols, "React")
			} else if hasUpperCase && !hasLowerCase && packageName == "react" {
				importedSymbols = append(importedSymbols, "react")
			}
		}

		results = append(results, PackageUsage{
			FileName:        filePath,
			ImportStatement: importStatement,
			Line:            lineNum,
			Character:       charPos,
			ImportedSymbols: importedSymbols,
			ImportStyle:     CommonJS,
			IsDynamicImport: false,
		})
	}

	// Dynamic imports: import('package-name')
	dynamicImportMatches := dynamicImportRegex.FindAllStringSubmatchIndex(content, -1)
	for _, match := range dynamicImportMatches {
		if match == nil || match[2] < 0 || match[3] <= match[2] {
			continue
		}

		moduleName := content[match[2]:match[3]]
		if moduleName != packageName {
			continue
		}

		lineNum, charPos := getLineAndCharacter(content, match[0])

		// Get full import statement
		lineStart := strings.LastIndex(content[:match[0]], "\n") + 1
		if lineStart < 0 {
			lineStart = 0
		}
		lineEnd := match[1]
		nextNewline := strings.Index(content[lineEnd:], "\n")
		if nextNewline >= 0 {
			lineEnd += nextNewline
		} else {
			lineEnd = len(content)
		}
		importStatement := strings.TrimSpace(content[lineStart:lineEnd])

		// Try to find variable name from surrounding context
		varName := extractImportedNameFromContext(importStatement, content, lineStart)
		importedSymbols := []string{}
		if varName != "" {
			importedSymbols = append(importedSymbols, varName)
		} else {
			importedSymbols = append(importedSymbols, packageName)
		}

		results = append(results, PackageUsage{
			FileName:        filePath,
			ImportStatement: importStatement,
			Line:            lineNum,
			Character:       charPos,
			ImportedSymbols: importedSymbols,
			ImportStyle:     DynamicImport,
			IsDynamicImport: true,
		})
	}

	// System.js imports
	systemMatches := systemJSRegex.FindAllStringSubmatchIndex(content, -1)
	for _, match := range systemMatches {
		if match == nil || match[2] < 0 || match[3] <= match[2] {
			continue
		}

		moduleName := content[match[2]:match[3]]
		if moduleName != packageName {
			continue
		}

		lineNum, charPos := getLineAndCharacter(content, match[0])

		// Get full import statement
		lineStart := strings.LastIndex(content[:match[0]], "\n") + 1
		if lineStart < 0 {
			lineStart = 0
		}
		lineEnd := match[1]
		nextNewline := strings.Index(content[lineEnd:], "\n")
		if nextNewline >= 0 {
			lineEnd += nextNewline
		} else {
			lineEnd = len(content)
		}
		importStatement := strings.TrimSpace(content[lineStart:lineEnd])

		// Try to extract variable name from context
		varName := extractImportedNameFromContext(importStatement, content, lineStart)
		importedSymbols := []string{}
		if varName != "" {
			importedSymbols = append(importedSymbols, varName)
		} else {
			importedSymbols = append(importedSymbols, packageName)
		}

		results = append(results, PackageUsage{
			FileName:        filePath,
			ImportStatement: importStatement,
			Line:            lineNum,
			Character:       charPos,
			ImportedSymbols: importedSymbols,
			ImportStyle:     SystemJS,
			IsDynamicImport: true,
		})
	}

	// Global variable access (window.packageName or global.packageName)
	packageNameRegex := regexp.MustCompile(fmt.Sprintf(`(?:window|global)\.%s`, packageNameEscaped))
	globalMatches := packageNameRegex.FindAllStringIndex(content, -1)
	for _, match := range globalMatches {
		if match == nil {
			continue
		}

		lineNum, charPos := getLineAndCharacter(content, match[0])

		// Get the statement
		lineStart := strings.LastIndex(content[:match[0]], "\n") + 1
		if lineStart < 0 {
			lineStart = 0
		}
		lineEnd := match[1]
		nextNewline := strings.Index(content[lineEnd:], "\n")
		if nextNewline >= 0 {
			lineEnd += nextNewline
		} else {
			lineEnd = len(content)
		}
		statement := strings.TrimSpace(content[lineStart:lineEnd])

		// Extract variable name from context if available
		varName := extractImportedNameFromContext(statement, content, lineStart)
		importedSymbols := []string{}

		// Add the package name itself as a symbol
		importedSymbols = append(importedSymbols, packageName)

		// If we found a variable name in context, add it too
		if varName != "" && varName != packageName {
			importedSymbols = append(importedSymbols, varName)
		}

		results = append(results, PackageUsage{
			FileName:        filePath,
			ImportStatement: statement,
			Line:            lineNum,
			Character:       charPos,
			ImportedSymbols: importedSymbols,
			ImportStyle:     GlobalVariable,
			IsDynamicImport: false,
		})
	}

	// AMD define - new
	amdMatches := amdDefineRegex.FindAllStringSubmatchIndex(content, -1)
	for _, match := range amdMatches {
		if match == nil || match[2] < 0 || match[3] <= match[2] {
			continue
		}

		// Get the dependencies array as string
		dependenciesStr := content[match[2]:match[3]]

		// Check if our package is in the dependencies
		packageMatch := regexp.MustCompile(fmt.Sprintf(`['"]%s['"]`, packageNameEscaped)).FindStringIndex(dependenciesStr)
		if packageMatch == nil {
			continue
		}

		lineNum, charPos := getLineAndCharacter(content, match[0])

		// Get full import statement - get the whole line from the beginning
		lineStart := strings.LastIndex(content[:match[0]], "\n") + 1
		if lineStart < 0 {
			lineStart = 0
		}

		// Find the end of the define call
		startOfDefine := match[0]
		endOfDefine := len(content) // default to end of file
		openParens := 1
		closingBrace := -1

		// Find closing parenthesis of define call
		for i := startOfDefine + 6; i < len(content) && i < startOfDefine+1000; i++ {
			if content[i] == '(' {
				openParens++
			} else if content[i] == ')' {
				openParens--
				if openParens == 0 {
					closingBrace = i
					break
				}
			}
		}

		if closingBrace > startOfDefine {
			endOfDefine = closingBrace + 1

			// Check if there's a semicolon to include
			if endOfDefine < len(content) && content[endOfDefine] == ';' {
				endOfDefine++
			}
		}

		// Get the complete define statement
		importStatement := strings.TrimSpace(content[lineStart:endOfDefine])

		// Truncate lengthy statements for readability
		if len(importStatement) > 100 {
			// Prioritize showing the function parameters
			funcParamIdx := strings.Index(importStatement, "function(")
			if funcParamIdx > 0 && funcParamIdx < 80 {
				// Find the closing parenthesis
				closeParen := strings.Index(importStatement[funcParamIdx:], ")")
				if closeParen > 0 {
					closeParenIdx := funcParamIdx + closeParen + 1
					if closeParenIdx < len(importStatement) {
						importStatement = importStatement[:closeParenIdx] + " {...}"
					}
				}
			} else {
				// Show the dependencies part
				depsStart := strings.Index(importStatement, "[")
				depsEnd := strings.Index(importStatement, "]")
				if depsStart > 0 && depsEnd > depsStart && depsEnd < 100 {
					importStatement = importStatement[:depsEnd+1] + ", function(...) {...}"
				} else {
					// Simple truncation
					importStatement = importStatement[:97] + "..."
				}
			}
		}

		// Find the parameter name corresponding to our package
		// Let's extract the dependencies and parameters directly from the import statement first
		importedSymbols := []string{}

		// Parse the AMD define arguments more precisely
		depsRegex := regexp.MustCompile(`\[\s*([^\]]*)\s*\]`)
		depsMatch := depsRegex.FindStringSubmatch(importStatement)

		if depsMatch != nil && len(depsMatch) > 1 {
			// Extract dependencies
			deps := []string{}
			depNamesRegex := regexp.MustCompile(`['"]([^'"]+)['"]`)
			depMatches := depNamesRegex.FindAllStringSubmatch(depsMatch[1], -1)

			for _, depMatch := range depMatches {
				if len(depMatch) > 1 {
					deps = append(deps, depMatch[1])
				}
			}

			// Find our package's index
			packageIndex := -1
			for i, dep := range deps {
				if dep == packageName {
					packageIndex = i
					break
				}
			}

			// Extract parameters if we found our package
			if packageIndex >= 0 {
				// Look for function parameters
				paramsRegex := regexp.MustCompile(`function\s*\(\s*([^)]*)\s*\)`)
				paramsMatch := paramsRegex.FindStringSubmatch(importStatement)

				if paramsMatch != nil && len(paramsMatch) > 1 {
					// Split parameters
					params := []string{}
					for _, param := range strings.Split(paramsMatch[1], ",") {
						trimmedParam := strings.TrimSpace(param)
						if trimmedParam != "" {
							params = append(params, trimmedParam)
						}
					}

					// Find the parameter corresponding to our package index
					if packageIndex < len(params) {
						// We found the parameter name!
						importedSymbols = append(importedSymbols, params[packageIndex])
					}
				}
			}
		}

		// Fallback if we couldn't extract the parameter
		if len(importedSymbols) == 0 {
			importedSymbols = append(importedSymbols, packageName)
		}

		// Check if this is React or React-like package, add both casing variants
		if strings.ToLower(packageName) == "react" || strings.HasPrefix(strings.ToLower(packageName), "react-") {
			hasLowerCase := false
			hasUpperCase := false

			for _, symbol := range importedSymbols {
				if symbol == "react" || symbol == packageName {
					hasLowerCase = true
				}
				if symbol == "React" {
					hasUpperCase = true
				}
			}

			// Add both casing variations if they don't already exist
			if hasLowerCase && !hasUpperCase {
				importedSymbols = append(importedSymbols, "React")
			} else if hasUpperCase && !hasLowerCase && packageName == "react" {
				importedSymbols = append(importedSymbols, "react")
			}
		}

		results = append(results, PackageUsage{
			FileName:        filePath,
			ImportStatement: importStatement,
			Line:            lineNum,
			Character:       charPos,
			ImportedSymbols: importedSymbols,
			ImportStyle:     RequireJS,
			IsDynamicImport: false,
		})
	}

	// UMD Factory Pattern - new
	umdMatches := umdFactoryRegex.FindAllStringIndex(content, -1)
	for _, match := range umdMatches {
		if match == nil {
			continue
		}

		// The UMD pattern detection is more complex - we need to check the entire factory wrapper
		// For now, do a simple check: look for the package name inside the UMD factory
		factoryStart := match[0]
		factoryEnd := len(content)

		// Try to find the end of the UMD pattern (simplified)
		closingEnd := strings.Index(content[factoryStart:], ")(")
		if closingEnd > 0 {
			factoryEnd = factoryStart + closingEnd + 2
		}

		factoryContent := content[factoryStart:factoryEnd]

		// Check if our package is referenced within the factory
		packageInFactory := regexp.MustCompile(fmt.Sprintf(`['"]%s['"]`, packageNameEscaped)).FindStringIndex(factoryContent)
		if packageInFactory == nil {
			continue
		}

		lineNum, charPos := getLineAndCharacter(content, match[0])

		// Get a concise representation of the UMD pattern
		importStatement := "UMD factory pattern with reference to " + packageName

		// Extract parameter name from the factory function
		importedSymbols := []string{}

		// Try to find the factory function parameters
		factoryParamsPattern := regexp.MustCompile(`function\s*\(([^)]*)\)`)
		factoryParamsMatch := factoryParamsPattern.FindStringSubmatch(factoryContent)
		if factoryParamsMatch != nil && len(factoryParamsMatch) > 1 {
			params := strings.Split(factoryParamsMatch[1], ",")
			for _, param := range params {
				paramName := strings.TrimSpace(param)
				if paramName != "" {
					importedSymbols = append(importedSymbols, paramName)
				}
			}
		} else {
			// If we couldn't extract parameters, use the package name as a fallback
			importedSymbols = append(importedSymbols, packageName)
		}

		// Check if React or React-like package is being used in UMD
		if strings.ToLower(packageName) == "react" || strings.HasPrefix(strings.ToLower(packageName), "react-") {
			// Check for explicit React usage in the factory content
			reactUsage := regexp.MustCompile(`(?:root\.React|React\.|React\s*,|,\s*React)`).FindString(factoryContent)
			if reactUsage != "" && !contains(importedSymbols, "React") {
				importedSymbols = append(importedSymbols, "React")
			}

			// Make sure we have both casing variants if appropriate
			hasLowerCase := false
			hasUpperCase := false

			for _, symbol := range importedSymbols {
				if symbol == "react" || symbol == packageName {
					hasLowerCase = true
				}
				if symbol == "React" {
					hasUpperCase = true
				}
			}

			// Add both casing variations if appropriate
			if hasLowerCase && !hasUpperCase {
				importedSymbols = append(importedSymbols, "React")
			} else if hasUpperCase && !hasLowerCase && packageName == "react" {
				importedSymbols = append(importedSymbols, "react")
			}
		}

		results = append(results, PackageUsage{
			FileName:        filePath,
			ImportStatement: importStatement,
			Line:            lineNum,
			Character:       charPos,
			ImportedSymbols: importedSymbols,
			ImportStyle:     UMD,
			IsDynamicImport: false,
		})
	}

	// ESM Import Maps - new
	esmImportMapMatches := esmImportMapRegex.FindAllStringSubmatchIndex(content, -1)
	for _, match := range esmImportMapMatches {
		if match == nil || match[2] < 0 || match[3] <= match[2] {
			continue
		}

		moduleName := content[match[2]:match[3]]
		if moduleName != packageName {
			continue
		}

		lineNum, charPos := getLineAndCharacter(content, match[0])

		// Get full import statement
		lineStart := strings.LastIndex(content[:match[0]], "\n") + 1
		if lineStart < 0 {
			lineStart = 0
		}
		lineEnd := match[1]
		nextNewline := strings.Index(content[lineEnd:], "\n")
		if nextNewline >= 0 {
			lineEnd += nextNewline
		} else {
			lineEnd = len(content)
		}
		importStatement := strings.TrimSpace(content[lineStart:lineEnd])

		// Try to extract variable name from context
		varName := extractImportedNameFromContext(importStatement, content, lineStart)
		importedSymbols := []string{}
		if varName != "" {
			importedSymbols = append(importedSymbols, varName)
		} else {
			// Look for variable assignment in the statement
			varNamePattern := regexp.MustCompile(`(?:const|let|var)\s+(\w+)\s*=`)
			varNameMatch := varNamePattern.FindStringSubmatch(importStatement)
			if varNameMatch != nil && len(varNameMatch) > 1 {
				importedSymbols = append(importedSymbols, varNameMatch[1])
			} else {
				importedSymbols = append(importedSymbols, packageName)
			}
		}

		// Special handling for React and React-related packages
		if strings.ToLower(packageName) == "react" || strings.HasPrefix(strings.ToLower(packageName), "react-") {
			// Check for React usage in surrounding context
			contextStart := lineStart - 200
			if contextStart < 0 {
				contextStart = 0
			}
			contextEnd := lineEnd + 200
			if contextEnd > len(content) {
				contextEnd = len(content)
			}

			surroundingContext := content[contextStart:contextEnd]
			reactUsage := regexp.MustCompile(`React\.`).FindString(surroundingContext)

			// Add React symbol if used in context but not already in symbols
			if reactUsage != "" && !contains(importedSymbols, "React") {
				importedSymbols = append(importedSymbols, "React")
			}

			// Make sure we have both casing variants if appropriate
			hasLowerCase := false
			hasUpperCase := false

			for _, symbol := range importedSymbols {
				if symbol == "react" || symbol == packageName {
					hasLowerCase = true
				}
				if symbol == "React" {
					hasUpperCase = true
				}
			}

			// Add both casing variations
			if hasLowerCase && !hasUpperCase {
				importedSymbols = append(importedSymbols, "React")
			} else if hasUpperCase && !hasLowerCase && packageName == "react" {
				importedSymbols = append(importedSymbols, "react")
			}
		}

		results = append(results, PackageUsage{
			FileName:        filePath,
			ImportStatement: importStatement,
			Line:            lineNum,
			Character:       charPos,
			ImportedSymbols: importedSymbols,
			ImportStyle:     ImportMaps,
			IsDynamicImport: true,
		})
	}

	return results, nil
}

// extractSymbolsFromES6Import extracts imported symbols from an ES6 import statement
func extractSymbolsFromES6Import(importStatement, packageName string) []string {
	importedSymbols := []string{}

	// Match default import: import React from 'react'
	defaultImportRegex := regexp.MustCompile(`import\s+(\w+)(?:\s*,\s*|\s+from\s+)`)
	defaultMatch := defaultImportRegex.FindStringSubmatch(importStatement)
	if defaultMatch != nil && len(defaultMatch) > 1 {
		importedSymbols = append(importedSymbols, defaultMatch[1])
	}

	// Match named imports: import { useState, useEffect } from 'react'
	namedImportRegex := regexp.MustCompile(`import\s+{([^}]*)}`)
	namedMatch := namedImportRegex.FindStringSubmatch(importStatement)
	if namedMatch != nil && len(namedMatch) > 1 {
		namedImports := namedMatch[1]
		for _, symbol := range strings.Split(namedImports, ",") {
			symbol = strings.TrimSpace(symbol)

			// Handle aliased imports like { originalName as aliasName }
			if strings.Contains(symbol, " as ") {
				parts := strings.Split(symbol, " as ")
				if len(parts) == 2 {
					symbol = strings.TrimSpace(parts[1])
				}
			}

			if symbol != "" {
				importedSymbols = append(importedSymbols, symbol)
			}
		}
	}

	// If no named or default imports were found, this is a side-effect-only import
	if len(importedSymbols) == 0 {
		importedSymbols = append(importedSymbols, "(side-effect only)")
	}

	return importedSymbols
}

// findSymbolUsages finds where imported symbols are used in a file
func findSymbolUsages(filePath string, symbolsMap map[string]bool) ([]SymbolUsage, error) {
	// Read file content
	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	lines := strings.Split(string(content), "\n")
	usages := make(map[string]SymbolUsage)

	// Create a regular expression to find usages of all imported symbols
	symbols := make([]string, 0, len(symbolsMap))
	for symbol := range symbolsMap {
		// Handle namespace imports separately
		if strings.HasPrefix(symbol, "* as ") {
			// For imports like: import * as React from 'react'
			namespaceName := strings.TrimPrefix(symbol, "* as ")
			symbols = append(symbols, namespaceName)
		} else {
			symbols = append(symbols, symbol)
		}
	}

	if len(symbols) == 0 {
		return nil, nil
	}

	// Create regex to match symbol usages: either standalone or in dot notation (e.g., React.Component)
	symbolPattern := fmt.Sprintf(`\b(%s)(?:\b|\.)`, strings.Join(symbols, "|"))
	symbolRegex := regexp.MustCompile(symbolPattern)

	// Scan file for symbol usages
	matches := symbolRegex.FindAllStringSubmatchIndex(string(content), -1)
	for _, match := range matches {
		if match == nil || match[2] < 0 || match[3] <= match[2] {
			continue
		}

		symbol := string(content[match[2]:match[3]])

		// Skip if this is inside an import statement or require call
		lineStart := strings.LastIndex(string(content[:match[0]]), "\n") + 1
		if lineStart < 0 {
			lineStart = 0
		}
		lineEnd := match[1]
		nextNewline := strings.Index(string(content[lineEnd:]), "\n")
		if nextNewline >= 0 {
			lineEnd += nextNewline
		} else {
			lineEnd = len(content)
		}

		line := string(content[lineStart:lineEnd])

		// Skip if this is part of an import statement or require call
		if strings.Contains(line, "import") && strings.Contains(line, "from") {
			continue
		}
		if strings.Contains(line, "require(") {
			continue
		}

		// Get line and character position
		lineNum, charPos := getLineAndCharacter(string(content), match[0])

		// Get context (the line containing the usage)
		lineText := ""
		if lineNum-1 < len(lines) {
			lineText = lines[lineNum-1]
		}

		// Initialize symbol usage entry if it doesn't exist
		if _, exists := usages[symbol]; !exists {
			usages[symbol] = SymbolUsage{
				SymbolName: symbol,
				Locations:  []Location{},
			}
		}

		usage := usages[symbol]
		usage.Locations = append(usage.Locations, Location{
			Line:      lineNum,
			Character: charPos,
			Context:   strings.TrimSpace(lineText),
		})
		usages[symbol] = usage
	}

	// Convert map to slice
	result := make([]SymbolUsage, 0, len(usages))
	for _, usage := range usages {
		result = append(result, usage)
	}

	return result, nil
}

// getLineAndCharacter calculates the line number and character position for an offset
func getLineAndCharacter(content string, offset int) (int, int) {
	lines := strings.Split(content[:offset], "\n")
	lineNum := len(lines)

	// Character position is the length of the last line + 1 (1-based indexing)
	var charPos int
	if lineNum > 0 {
		charPos = len(lines[lineNum-1]) + 1
	} else {
		charPos = offset + 1
	}

	return lineNum, charPos
}

// SaveResultsToFile saves the results to a JSON file
func SaveResultsToFile(results []PackageUsage, filePath string) error {
	data, err := json.MarshalIndent(results, "", "  ")
	if err != nil {
		return err
	}

	return ioutil.WriteFile(filePath, data, 0644)
}

// PrintResults prints the results in a human-readable format
func PrintResults(results []PackageUsage) {
	if len(results) == 0 {
		fmt.Println("No usage found.")
		return
	}

	fmt.Printf("Found %d usage(s):\n\n", len(results))

	for i, result := range results {
		fmt.Printf("%d. File: %s\n", i+1, result.FileName)
		fmt.Printf("   Import: %s\n", result.ImportStatement)
		fmt.Printf("   At: Line %d, Character %d\n", result.Line, result.Character)
		fmt.Printf("   Import Style: %s\n", result.ImportStyle)
		fmt.Printf("   Imported Symbols: %s\n", strings.Join(result.ImportedSymbols, ", "))

		if len(result.SymbolUsages) > 0 {
			fmt.Println("   Symbol Usages:")
			for _, usage := range result.SymbolUsages {
				fmt.Printf("     - %s - %d usage(s):\n", usage.SymbolName, len(usage.Locations))
				for j, loc := range usage.Locations {
					fmt.Printf("       %d. Line %d, Character %d\n", j+1, loc.Line, loc.Character)
					fmt.Printf("          Context: %s\n", loc.Context)
				}
			}
		}

		fmt.Println(strings.Repeat("-", 70))
	}
}

// extractAMDParameterName tries to extract the parameter name for an AMD module
func extractAMDParameterName(content string, defineStart int, packageName string) string {
	// Get the full define(...) call with its callback function
	openParens := 1
	closeDefinePos := defineStart

	for i := defineStart + 1; i < len(content); i++ {
		if content[i] == '(' {
			openParens++
		} else if content[i] == ')' {
			openParens--
			if openParens == 0 {
				closeDefinePos = i + 1
				break
			}
		}
	}

	// Get the full define call
	defineCall := content[defineStart:closeDefinePos]

	// Find the module name in the dependencies array
	packageNameEscaped := regexp.QuoteMeta(packageName)
	// Updated regex to match more precisely
	moduleRegex := regexp.MustCompile(fmt.Sprintf(`\[([^\]]*?)['"]%s['"]([^\]]*?)\]`, packageNameEscaped))
	moduleMatch := moduleRegex.FindStringSubmatch(defineCall)
	if moduleMatch == nil || len(moduleMatch) < 3 {
		return ""
	}

	// Count the position of our module in the dependencies array
	beforeModule := moduleMatch[1]
	afterModule := moduleMatch[2]

	// Improved position calculation
	deps := []string{}

	// Extract all dependencies
	depsRegex := regexp.MustCompile(`['"]([^'"]+)['"]`)
	depsMatches := depsRegex.FindAllStringSubmatch(fmt.Sprintf("%s'%s'%s", beforeModule, packageName, afterModule), -1)

	for _, match := range depsMatches {
		if len(match) > 1 {
			deps = append(deps, match[1])
		}
	}

	// Find the index of our package
	moduleIndex := -1
	for i, dep := range deps {
		if dep == packageName {
			moduleIndex = i
			break
		}
	}

	if moduleIndex == -1 {
		return ""
	}

	// Look for the callback function with parameters
	callbackRegex := regexp.MustCompile(`function\s*\(([^)]*)\)`)
	callbackMatch := callbackRegex.FindStringSubmatch(defineCall)
	if callbackMatch == nil || len(callbackMatch) < 2 {
		return ""
	}

	// Get the parameters of the callback function
	params := []string{}
	for _, param := range strings.Split(callbackMatch[1], ",") {
		paramTrimmed := strings.TrimSpace(param)
		if paramTrimmed != "" {
			params = append(params, paramTrimmed)
		}
	}

	if moduleIndex < len(params) {
		return params[moduleIndex]
	}

	return ""
}

// extractImportedNameFromContext tries to extract the variable name from the surrounding context
func extractImportedNameFromContext(importStatement, content string, lineStart int) string {
	// Extract the variable name from the import statement
	// Check for 'const/let/var x = '
	varNamePattern := regexp.MustCompile(`(?:const|let|var)\s+(\w+)\s*=`)
	varNameMatch := varNamePattern.FindStringSubmatch(importStatement)
	if varNameMatch != nil && len(varNameMatch) > 1 {
		return varNameMatch[1]
	}

	// Look for variable assignment in the previous few lines
	if lineStart > 0 {
		contextStart := lineStart - 200 // Check 200 chars back
		if contextStart < 0 {
			contextStart = 0
		}
		contextBefore := content[contextStart:lineStart]
		lines := strings.Split(contextBefore, "\n")

		// Check the last 3 lines for variable assignments
		start := len(lines) - 3
		if start < 0 {
			start = 0
		}

		for i := start; i < len(lines); i++ {
			varNameMatch := varNamePattern.FindStringSubmatch(lines[i])
			if varNameMatch != nil && len(varNameMatch) > 1 {
				return varNameMatch[1]
			}
		}
	}

	// Look for variable assignment in the next few lines
	lineEnd := lineStart + len(importStatement)
	if lineEnd < len(content) {
		contextEnd := lineEnd + 200 // Check 200 chars ahead
		if contextEnd > len(content) {
			contextEnd = len(content)
		}
		contextAfter := content[lineEnd:contextEnd]
		lines := strings.Split(contextAfter, "\n")

		// Check the first 3 lines for variable usage
		end := 3
		if end > len(lines) {
			end = len(lines)
		}

		for i := 0; i < end; i++ {
			// Look for '.then(x => ' pattern
			thenPattern := regexp.MustCompile(`\.then\(\s*(?:function\s*\(\s*(\w+)|(\w+)\s*=>)`)
			thenMatch := thenPattern.FindStringSubmatch(lines[i])
			if thenMatch != nil {
				if thenMatch[1] != "" {
					return thenMatch[1]
				}
				if thenMatch[2] != "" {
					return thenMatch[2]
				}
			}

			// Look for variable assignments
			varNameMatch := varNamePattern.FindStringSubmatch(lines[i])
			if varNameMatch != nil && len(varNameMatch) > 1 {
				return varNameMatch[1]
			}
		}
	}

	return ""
}

// contains checks if a string slice contains a specific string
func contains(slice []string, str string) bool {
	for _, item := range slice {
		if item == str {
			return true
		}
	}
	return false
}
