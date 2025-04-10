import { QueryStatus } from 'react-query';

// Reimplement removed Action type
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

// Implement the removed Action type
export type Action<TData, TError> = 
  | ContinueAction 
  | ErrorAction<TError> 
  | FailedAction 
  | FetchAction 
  | InvalidateAction 
  | PauseAction 
  | SetStateAction<TData, TError> 
  | SuccessAction<TData>;

// Reimplement CancelledError
export class CancelledError extends Error {
  constructor(message = 'The query was cancelled') {
    super(message);
    this.name = 'CancelledError';
    Object.setPrototypeOf(this, CancelledError.prototype);
  }

  public isCancelledError = true;
}

// Reimplement CancelOptions
export interface CancelOptions {
  revert?: boolean;
  silent?: boolean;
}

// Reimplement EnsuredQueryKey
export type EnsuredQueryKey<T> = T extends string ? [T] : Exclude<T, string>;

// Reimplement DataUpdateFunction
export type DataUpdateFunction<TInput, TOutput> = (input: TInput) => TOutput;

// Implement DehydratedState interface
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

// Type for query object in dehydrate function
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

// Type for mutation object in dehydrate function
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

// DehydrateOptions
export interface DehydrateOptions {
  shouldDehydrateQuery?: (query: { queryHash: string }) => boolean;
  shouldDehydrateMutation?: (mutation: { options?: { mutationKey: unknown } }) => boolean;
}

// Reimplement the dehydrate function
export function dehydrate(
  queryClient: any, 
  options: DehydrateOptions = {}
): DehydratedState {
  const { 
    shouldDehydrateQuery = () => true,
    shouldDehydrateMutation = () => true 
  } = options;

  const queries = queryClient.getQueryCache().findAll();
  const mutations = queryClient.getMutationCache().getAll();

  return {
    queries: queries
      .filter((query: QueryObject) => shouldDehydrateQuery(query))
      .map((query: QueryObject) => ({
        queryHash: query.queryHash,
        queryKey: query.queryKey,
        state: query.state
      })),
    mutations: mutations
      .filter((mutation: MutationObject) => shouldDehydrateMutation({ options: mutation.options }))
      .map((mutation: MutationObject) => ({
        mutationKey: mutation.options.mutationKey,
        state: mutation.state
      }))
  };
}

// Implement difference utility
export function difference<T>(array1: T[], array2: T[]): T[] {
  return array1.filter(x => !array2.includes(x));
} 