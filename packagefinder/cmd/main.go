package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"

	"github.com/user/packagefinder/pkg/finder"
)

func main() {
	// Define command line arguments
	flag.Usage = func() {
		fmt.Fprintf(os.Stderr, "Usage: %s [options] package-name\n\n", os.Args[0])
		fmt.Fprintf(os.Stderr, "Options:\n")
		flag.PrintDefaults()
	}

	outputFile := flag.String("output", "", "Output file path for JSON results (default: print to console)")
	projectDir := flag.String("project", ".", "Project root directory to analyze")
	flag.Parse()

	// Check if package name is provided
	if flag.NArg() < 1 {
		fmt.Println("Error: Please provide a package name to search for")
		flag.Usage()
		os.Exit(1)
	}

	packageName := flag.Arg(0)

	// Resolve absolute path of project directory
	absProjectDir, err := filepath.Abs(*projectDir)
	if err != nil {
		fmt.Printf("Error resolving project path: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Analyzing usage of package '%s' in project at %s...\n", packageName, absProjectDir)

	// Run the analysis
	results, err := finder.FindPackageUsage(absProjectDir, packageName)
	if err != nil {
		fmt.Printf("Error analyzing package usage: %v\n", err)
		os.Exit(1)
	}

	// Output the results
	if *outputFile != "" {
		err = finder.SaveResultsToFile(results, *outputFile)
		if err != nil {
			fmt.Printf("Error saving results to file: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("Results saved to %s\n", *outputFile)
	} else {
		finder.PrintResults(results)
	}
}
