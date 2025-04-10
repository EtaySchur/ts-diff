import { QueryClient } from 'react-query';

/**
 * Safely manages a fetch request that might need to be cancelled
 * Alternative to using the deprecated CancelledError and CancelOptions
 */
export const createSafeFetcher = <T>(fetchFn: () => Promise<T>) => {
  let isCancelled = false;
  
  const execute = async (): Promise<T> => {
    try {
      const result = await fetchFn();
      
      // If the request was cancelled while in flight, 
      // we throw a generic error instead of CancelledError
      if (isCancelled) {
        throw new Error('Request was cancelled');
      }
      
      return result;
    } catch (error) {
      // For non-cancelled errors, we just rethrow
      if (!isCancelled) {
        throw error;
      }
      
      // This will only happen if the request was cancelled AND threw an error
      throw new Error('Request was cancelled');
    }
  };
  
  const cancel = () => {
    isCancelled = true;
  };
  
  return { execute, cancel };
};

/**
 * Safe type for query keys that ensures string keys are wrapped in an array
 * Alternative to EnsuredQueryKey type
 */
export type SafeQueryKey<T> = T extends string ? readonly [T, ...unknown[]] : readonly unknown[];

/**
 * Utility function to invalidate multiple queries by their keys
 * Alternative to direct usage of queryClient.invalidateQueries with complex logic
 */
export const invalidateQueries = (
  queryClient: QueryClient, 
  queryKeys: string[]
): Promise<void> => {
  return Promise.all(
    queryKeys.map(key => queryClient.invalidateQueries(key))
  ).then(() => {
    return;
  });
};

/**
 * Safely update data in the query cache
 * Alternative to using deprecated DataUpdateFunction
 */
export const updateQueryData = <T>(
  queryClient: QueryClient,
  queryKey: string | readonly unknown[],
  updater: (oldData: T | undefined) => T
): void => {
  queryClient.setQueryData(queryKey, (oldData: T | undefined) => {
    return updater(oldData);
  });
};

/**
 * Error boundary for query errors
 * Alternative to relying on specific error types that might be deprecated
 */
export const isNetworkError = (error: unknown): boolean => {
  return error instanceof Error && 
    (error.message.includes('Network') || 
     error.message.includes('network') ||
     error.message.includes('Failed to fetch'));
}; 