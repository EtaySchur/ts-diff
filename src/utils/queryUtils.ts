import { QueryStatus } from 'react-query';
import { QueryClient, QueryKey } from 'react-query';

// Action type definitions
export type ContinueAction = {
  type: 'continue';
};

export type ErrorAction<TError> = {
  type: 'error';
  error: TError;
};

export type FailedAction = {
  type: 'failed';
};

export type FetchAction = {
  type: 'fetch';
};

export type InvalidateAction = {
  type: 'invalidate';
};

export type PauseAction = {
  type: 'pause';
};

export type SetStateAction<TData, TError> = {
  type: 'setState';
  state: {
    data?: TData;
    error?: TError;
    status?: QueryStatus;
  };
};

export type SuccessAction<TData> = {
  type: 'success';
  data: TData;
};

// Action type
export type Action<TData, TError> = 
  | ContinueAction 
  | ErrorAction<TError> 
  | FailedAction 
  | FetchAction 
  | InvalidateAction 
  | PauseAction 
  | SetStateAction<TData, TError> 
  | SuccessAction<TData>;

// Cancel options interface
export interface CancelOptions {
  revert?: boolean;
  silent?: boolean;
}

// Query key helper
export type EnsuredQueryKey<T> = T extends string ? [T] : Exclude<T, string>;

// Alternative to EnsuredQueryKey that's more explicit
export type SafeQueryKey<T> = [string, T?] | readonly [string, T?];

// Data transformation helper
export type DataUpdateFunction<TInput, TOutput> = (input: TInput) => TOutput;

// Network error detector
export function isNetworkError(error: Error): boolean {
  return (
    error.message.includes('Network') ||
    error.message.includes('network') ||
    error.message.includes('fetch') ||
    error.message.includes('Failed to fetch')
  );
}

// Safe fetcher that can be cancelled
export function createSafeFetcher<T>(
  fetchFn: () => Promise<T>
): { execute: () => Promise<T>; cancel: () => void } {
  let isCancelled = false;
  const controller = new AbortController();

  const execute = async (): Promise<T> => {
    try {
      const result = await fetchFn();
      if (isCancelled) {
        throw new Error('Operation was cancelled');
      }
      return result;
    } catch (error) {
      if (isCancelled) {
        throw new Error('Operation was cancelled');
      }
      throw error;
    }
  };

  const cancel = () => {
    isCancelled = true;
    controller.abort();
  };

  return { execute, cancel };
}

// Safely update query data
export function updateQueryData<T>(
  queryClient: QueryClient,
  queryKey: QueryKey,
  updater: (oldData: T | undefined) => T
): void {
  queryClient.setQueryData(queryKey, (oldData: T | undefined) => {
    return updater(oldData);
  });
}

// State interfaces
export interface DehydratedState {
  queries: DehydratedQuery[];
  mutations: DehydratedMutation[];
}

export interface DehydratedQuery {
  queryHash: string;
  queryKey: unknown;
  state: {
    data: unknown;
    error: null | Error;
    status: QueryStatus;
    updatedAt: number;
  };
}

export interface DehydratedMutation {
  mutationKey: unknown;
  state: {
    data: unknown;
    error: null | Error;
    status: string;
  };
}

// Helper interfaces
interface QueryObject {
  queryHash: string;
  queryKey: unknown;
  state: {
    data: unknown;
    error: null | Error;
    status: QueryStatus;
    updatedAt: number;
  };
}

interface MutationObject {
  options: {
    mutationKey: unknown;
  };
  state: {
    data: unknown;
    error: null | Error;
    status: string;
  };
}

// Dehydrate options
export interface DehydrateOptions {
  shouldDehydrateQuery?: (query: { queryHash: string }) => boolean;
  shouldDehydrateMutation?: (mutation: { options?: { mutationKey: unknown } }) => boolean;
}

// Array utility
export function difference<T>(array1: T[], array2: T[]): T[] {
  return array1.filter(x => !array2.includes(x));
} 