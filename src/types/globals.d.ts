// This file declares the global variables from script tags
declare const _: {
  map: <T, U>(array: T[], iteratee: (value: T, index: number, array: T[]) => U) => U[];
  filter: <T>(array: T[], predicate: (value: T, index: number, array: T[]) => boolean) => T[];
  find: <T>(array: T[], predicate: (value: T, index: number, array: T[]) => boolean) => T | undefined;
  debounce: <T extends (...args: any[]) => any>(
    func: T,
    wait?: number,
    options?: { leading?: boolean; trailing?: boolean; maxWait?: number }
  ) => T;
  // Add other Lodash functions you need here
}; 