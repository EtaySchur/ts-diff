// CommonJS (.cjs) file that demonstrates importing ES Modules

// Traditional CommonJS import
const ReactQuery = require('react-query');
const { QueryClient } = require('react-query');

// Create a client with CommonJS syntax
const queryClient = new QueryClient();

// In CommonJS, you can't use static ESM imports
// Instead, you must use dynamic imports with async/await
async function loadEsmModule() {
  try {
    // Dynamic import of an ESM module (works in Node.js 14+)
    const esmModule = await import('./esm-example.mjs');
    
    // Use the imported ESM functions
    const todosResult = esmModule.fetchTodos();
    
    // Log results
    console.log('Successfully imported from ESM:', todosResult);
    
    return todosResult;
  } catch (error) {
    console.error('Error importing ESM module:', error);
    throw error;
  }
}

// Direct usage of ReactQuery
function createQuery() {
  return ReactQuery.useQuery('example', () => {
    return { message: "This is a CJS file dynamically importing ESM" };
  });
}

// Another way to dynamically import the react-query package itself
// This is useful when you need to conditionally load a package
async function dynamicallyImportReactQuery() {
  const dynamicReactQuery = await import('react-query');
  
  // Use the dynamically imported package
  const result = dynamicReactQuery.useQuery('dynamic', () => {
    return { message: "Dynamically imported react-query from CJS" };
  });
  
  return result;
}

// Export using CommonJS syntax
module.exports = {
  loadEsmModule,
  createQuery,
  dynamicallyImportReactQuery,
  queryClient
}; 