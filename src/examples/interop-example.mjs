// ES Module (.mjs) that demonstrates interop with CommonJS modules

// Import from a CommonJS module (.cjs)
// The "createQueryClient" is from our CommonJS example
import { createQueryClient, fetchTodos } from './commonjs-example.cjs';

// Import directly from react-query as ESM
import { useQuery } from 'react-query';

// Demonstrate ESM usage
export function createQueryExample() {
  // Use the imported function from CommonJS
  const queryClient = createQueryClient();
  
  // Use the direct ESM import
  const { data, isLoading } = useQuery('example', () => {
    return { message: "This is ESM importing CJS!" };
  });
  
  return {
    queryClient,
    data,
    isLoading
  };
}

// This is an example of ESM-to-CJS interop
// In Node.js this requires the --experimental-modules flag 
// or package.json with "type": "module"

// When analyzing, this should be detected as:
// - ESM file (.mjs)
// - Using both ES6Import and ESModuleInterop styles
export default createQueryExample; 