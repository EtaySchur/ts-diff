package finder

// Location represents a code location with line and character position
type Location struct {
	Line      int    `json:"line"`
	Character int    `json:"character"`
	Context   string `json:"context,omitempty"` // Surrounding code for context
}

// SymbolUsage tracks where a specific imported symbol is used in the code
type SymbolUsage struct {
	SymbolName string     `json:"symbolName"`
	Locations  []Location `json:"locations"`
}

// ImportStyle represents the different ways a package can be imported
type ImportStyle string

const (
	ES6Import       ImportStyle = "ES6Import"
	CommonJS        ImportStyle = "CommonJS"
	RequireJS       ImportStyle = "RequireJS"
	DynamicImport   ImportStyle = "DynamicImport"
	ESModuleInterop ImportStyle = "ESModuleInterop"
	SystemJS        ImportStyle = "SystemJS"
	GlobalVariable  ImportStyle = "GlobalVariable"
	ImportMaps      ImportStyle = "ImportMaps"
	UMD             ImportStyle = "UMD"
	Unknown         ImportStyle = "Unknown"
)

// SymbolResolution tracks where a symbol is actually defined
type SymbolResolution struct {
	SymbolName           string    `json:"symbolName"`
	ResolvedFrom         string    `json:"resolvedFrom"`
	ActualDefinitionPath string    `json:"actualDefinitionPath"`
	IsFromTypeDefinition bool      `json:"isFromTypeDefinition"`
	ImportPosition       *Location `json:"importPosition,omitempty"`
}

// PackageUsage represents a single instance of a package being imported
type PackageUsage struct {
	FileName          string             `json:"fileName"`
	ImportStatement   string             `json:"importStatement"`
	Line              int                `json:"line"`
	Character         int                `json:"character"`
	ImportedSymbols   []string           `json:"importedSymbols"`
	ImportStyle       ImportStyle        `json:"importStyle,omitempty"`
	IsDynamicImport   bool               `json:"isDynamicImport,omitempty"`
	SymbolResolutions []SymbolResolution `json:"symbolResolutions,omitempty"`
	SymbolUsages      []SymbolUsage      `json:"symbolUsages,omitempty"`
}
