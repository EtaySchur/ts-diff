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

		importedSymbols := []string{"(require)"}

		// Check for variable assignment
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

		results = append(results, PackageUsage{
			FileName:        filePath,
			ImportStatement: importStatement,
			Line:            lineNum,
			Character:       charPos,
			ImportedSymbols: []string{"(dynamic import)"},
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

		results = append(results, PackageUsage{
			FileName:        filePath,
			ImportStatement: importStatement,
			Line:            lineNum,
			Character:       charPos,
			ImportedSymbols: []string{"(SystemJS import)"},
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

		results = append(results, PackageUsage{
			FileName:        filePath,
			ImportStatement: statement,
			Line:            lineNum,
			Character:       charPos,
			ImportedSymbols: []string{packageName},
			ImportStyle:     GlobalVariable,
			IsDynamicImport: false,
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
