/**
 * Types that should never be flattened by Prettify.
 * These are "opaque" — their internal structure is an implementation detail.
 */
type BuiltinObject =
  | Function
  | Date
  | RegExp
  | Error
  | Promise<any>
  | Map<any, any>
  | Set<any>
  | WeakMap<any, any>
  | WeakSet<any>
  | ReadonlyMap<any, any>
  | ReadonlySet<any>
  | ArrayBuffer
  | SharedArrayBuffer
  | DataView
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array;

/**
 * Structural checks for DOM base types.
 * Uses structural typing so this works even without DOM lib references.
 */
type IsNode<T> = T extends { nodeType: number; nodeName: string } ? true : false;
type IsEventTarget<T> = T extends {
  addEventListener(type: string, listener: any, options?: any): void;
  removeEventListener(type: string, listener: any, options?: any): void;
}
  ? true
  : false;

/**
 * Prettify<T> — recursively flatten intersection types to a single object
 * with explicit key-value pairs, while preserving:
 *   - Primitives (string, number, boolean, bigint, symbol, undefined, null)
 *   - Built-in objects (Map, Set, Date, RegExp, Promise, TypedArrays, etc.)
 *   - DOM types (Node, EventTarget and their subtypes)
 *   - Arrays and tuples (recursing into element types)
 *   - Optional and readonly modifiers
 *   - Union distribution (Prettify<A | B> = Prettify<A> | Prettify<B>)
 */
export type Prettify<T> =
  // Primitives pass through
  T extends string | number | boolean | bigint | symbol | undefined | null
    ? T
    : // Built-in objects pass through
      T extends BuiltinObject
      ? T
      : // DOM types pass through (structural check)
        IsNode<T> extends true
        ? T
        : IsEventTarget<T> extends true
          ? T
          : // Arrays → recurse into element type, preserve mutability
            T extends readonly (infer _U)[]
            ? // Check if it's a tuple (fixed length) vs regular array
              number extends T["length"]
              ? T extends (infer U)[]
                ? Prettify<U>[]
                : T extends readonly (infer U)[]
                  ? readonly Prettify<U>[]
                  : T
              : // Tuple — mapped type on tuples preserves tuple structure
                { [K in keyof T]: Prettify<T[K]> }
            : // Everything else: flatten intersection, recurse into values
              { [K in keyof T]: Prettify<T[K]> } & {};
