import { expectTypeOf, describe, it } from "vitest";
import type { Prettify } from "../prettify";

// ─── Test helpers ───────────────────────────────────────────────

interface Foo {
  a: string;
  b: number;
}

interface Bar {
  c: boolean;
  d: string[];
}

interface WithOptional {
  required: string;
  optional?: number;
}

interface WithReadonly {
  readonly id: number;
  name: string;
}

interface Nested {
  inner: Foo & Bar;
}

// ─── Primitives ─────────────────────────────────────────────────

describe("Prettify — primitives", () => {
  it("passes through string", () => {
    expectTypeOf<Prettify<string>>().toEqualTypeOf<string>();
  });

  it("passes through number", () => {
    expectTypeOf<Prettify<number>>().toEqualTypeOf<number>();
  });

  it("passes through boolean", () => {
    expectTypeOf<Prettify<boolean>>().toEqualTypeOf<boolean>();
  });

  it("passes through bigint", () => {
    expectTypeOf<Prettify<bigint>>().toEqualTypeOf<bigint>();
  });

  it("passes through symbol", () => {
    expectTypeOf<Prettify<symbol>>().toEqualTypeOf<symbol>();
  });

  it("passes through undefined", () => {
    expectTypeOf<Prettify<undefined>>().toEqualTypeOf<undefined>();
  });

  it("passes through null", () => {
    expectTypeOf<Prettify<null>>().toEqualTypeOf<null>();
  });

  it("passes through string literal", () => {
    expectTypeOf<Prettify<"hello">>().toEqualTypeOf<"hello">();
  });

  it("passes through numeric literal", () => {
    expectTypeOf<Prettify<42>>().toEqualTypeOf<42>();
  });
});

// ─── Basic intersection flattening ─────────────────────────────

describe("Prettify — intersection flattening", () => {
  it("flattens a simple two-interface intersection", () => {
    expectTypeOf<Prettify<Foo & Bar>>().toEqualTypeOf<{
      a: string;
      b: number;
      c: boolean;
      d: string[];
    }>();
  });

  it("flattens a three-way intersection", () => {
    type Third = { e: Date };
    expectTypeOf<Prettify<Foo & Bar & Third>>().toEqualTypeOf<{
      a: string;
      b: number;
      c: boolean;
      d: string[];
      e: Date;
    }>();
  });

  it("handles single interface (no-op)", () => {
    expectTypeOf<Prettify<Foo>>().toEqualTypeOf<{
      a: string;
      b: number;
    }>();
  });

  it("handles empty object", () => {
    expectTypeOf<Prettify<{}>>().toEqualTypeOf<{}>();
  });

  it("handles inline object type", () => {
    expectTypeOf<Prettify<{ x: 1 } & { y: 2 }>>().toEqualTypeOf<{
      x: 1;
      y: 2;
    }>();
  });
});

// ─── Modifiers: optional and readonly ──────────────────────────

describe("Prettify — modifiers", () => {
  it("preserves optional properties", () => {
    expectTypeOf<Prettify<WithOptional>>().toEqualTypeOf<{
      required: string;
      optional?: number;
    }>();
  });

  it("preserves readonly properties", () => {
    expectTypeOf<Prettify<WithReadonly>>().toEqualTypeOf<{
      readonly id: number;
      name: string;
    }>();
  });

  it("preserves modifiers through intersection", () => {
    type Combined = WithOptional & WithReadonly;
    expectTypeOf<Prettify<Combined>>().toEqualTypeOf<{
      required: string;
      optional?: number;
      readonly id: number;
      name: string;
    }>();
  });
});

// ─── Nested objects ─────────────────────────────────────────────

describe("Prettify — nested objects", () => {
  it("recursively flattens nested intersections", () => {
    expectTypeOf<Prettify<Nested>>().toEqualTypeOf<{
      inner: {
        a: string;
        b: number;
        c: boolean;
        d: string[];
      };
    }>();
  });

  it("flattens deeply nested intersections", () => {
    type Deep = { level1: { level2: Foo & Bar } };
    expectTypeOf<Prettify<Deep>>().toEqualTypeOf<{
      level1: {
        level2: {
          a: string;
          b: number;
          c: boolean;
          d: string[];
        };
      };
    }>();
  });

  it("flattens intersection of objects with nested objects", () => {
    type A = { nested: { x: string } };
    type B = { nested: { y: number } };
    // Note: A & B means nested is { x: string } & { y: number }
    expectTypeOf<Prettify<A & B>>().toEqualTypeOf<{
      nested: { x: string; y: number };
    }>();
  });
});

// ─── Union distribution ─────────────────────────────────────────

describe("Prettify — unions", () => {
  it("distributes over unions", () => {
    type Input = (Foo & Bar) | string;
    type Expected = { a: string; b: number; c: boolean; d: string[] } | string;
    expectTypeOf<Prettify<Input>>().toEqualTypeOf<Expected>();
  });

  it("handles union of objects", () => {
    type Input = { a: string } | { b: number };
    expectTypeOf<Prettify<Input>>().toEqualTypeOf<{ a: string } | { b: number }>();
  });

  it("handles discriminated unions", () => {
    type Input = ({ type: "a" } & Foo) | ({ type: "b" } & Bar);
    type Expected = { type: "a"; a: string; b: number } | { type: "b"; c: boolean; d: string[] };
    expectTypeOf<Prettify<Input>>().toEqualTypeOf<Expected>();
  });
});

// ─── Arrays and tuples ──────────────────────────────────────────

describe("Prettify — arrays", () => {
  it("recurses into array element types", () => {
    type Input = (Foo & Bar)[];
    expectTypeOf<Prettify<Input>>().toEqualTypeOf<
      { a: string; b: number; c: boolean; d: string[] }[]
    >();
  });

  it("preserves readonly arrays", () => {
    type Input = readonly (Foo & Bar)[];
    expectTypeOf<Prettify<Input>>().toEqualTypeOf<
      readonly { a: string; b: number; c: boolean; d: string[] }[]
    >();
  });

  it("passes through primitive arrays", () => {
    expectTypeOf<Prettify<string[]>>().toEqualTypeOf<string[]>();
  });

  it("handles nested arrays", () => {
    type Input = (Foo & Bar)[][];
    expectTypeOf<Prettify<Input>>().toEqualTypeOf<
      { a: string; b: number; c: boolean; d: string[] }[][]
    >();
  });
});

describe("Prettify — tuples", () => {
  it("recurses into tuple element types", () => {
    type Input = [Foo & Bar, string];
    expectTypeOf<Prettify<Input>>().toEqualTypeOf<
      [{ a: string; b: number; c: boolean; d: string[] }, string]
    >();
  });

  it("preserves tuple length", () => {
    type Input = [string, number, boolean];
    expectTypeOf<Prettify<Input>>().toEqualTypeOf<[string, number, boolean]>();
  });
});

// ─── Built-in objects (must NOT be flattened) ───────────────────

describe("Prettify — built-in objects preserved", () => {
  it("preserves Date", () => {
    expectTypeOf<Prettify<Date>>().toEqualTypeOf<Date>();
  });

  it("preserves RegExp", () => {
    expectTypeOf<Prettify<RegExp>>().toEqualTypeOf<RegExp>();
  });

  it("preserves Map", () => {
    expectTypeOf<Prettify<Map<string, number>>>().toEqualTypeOf<Map<string, number>>();
  });

  it("preserves Set", () => {
    expectTypeOf<Prettify<Set<string>>>().toEqualTypeOf<Set<string>>();
  });

  it("preserves WeakMap", () => {
    expectTypeOf<Prettify<WeakMap<object, string>>>().toEqualTypeOf<WeakMap<object, string>>();
  });

  it("preserves WeakSet", () => {
    expectTypeOf<Prettify<WeakSet<object>>>().toEqualTypeOf<WeakSet<object>>();
  });

  it("preserves Promise", () => {
    expectTypeOf<Prettify<Promise<string>>>().toEqualTypeOf<Promise<string>>();
  });

  it("preserves ReadonlyMap", () => {
    expectTypeOf<Prettify<ReadonlyMap<string, number>>>().toEqualTypeOf<
      ReadonlyMap<string, number>
    >();
  });

  it("preserves ReadonlySet", () => {
    expectTypeOf<Prettify<ReadonlySet<string>>>().toEqualTypeOf<ReadonlySet<string>>();
  });

  it("preserves Error", () => {
    type E = Error;
    expectTypeOf<Prettify<E>>().toEqualTypeOf<E>();
  });

  it("preserves ArrayBuffer", () => {
    expectTypeOf<Prettify<ArrayBuffer>>().toEqualTypeOf<ArrayBuffer>();
  });

  it("preserves Uint8Array", () => {
    expectTypeOf<Prettify<Uint8Array>>().toEqualTypeOf<Uint8Array>();
  });

  it("preserves Float64Array", () => {
    expectTypeOf<Prettify<Float64Array>>().toEqualTypeOf<Float64Array>();
  });
});

// ─── Built-ins inside object values ────────────────────────────

describe("Prettify — built-ins as property values", () => {
  it("preserves Map inside flattened object", () => {
    type Input = { id: string } & { data: Map<string, number> };
    expectTypeOf<Prettify<Input>>().toEqualTypeOf<{
      id: string;
      data: Map<string, number>;
    }>();
  });

  it("preserves Set inside flattened object", () => {
    type Input = { tags: Set<string> } & { name: string };
    expectTypeOf<Prettify<Input>>().toEqualTypeOf<{
      tags: Set<string>;
      name: string;
    }>();
  });

  it("preserves Date inside nested flattened object", () => {
    type Inner = { created: Date } & { updated: Date };
    type Input = { meta: Inner } & { id: number };
    expectTypeOf<Prettify<Input>>().toEqualTypeOf<{
      meta: { created: Date; updated: Date };
      id: number;
    }>();
  });

  it("preserves Promise inside flattened object", () => {
    type Input = { fetch: Promise<string> } & { label: string };
    expectTypeOf<Prettify<Input>>().toEqualTypeOf<{
      fetch: Promise<string>;
      label: string;
    }>();
  });
});

// ─── Functions ──────────────────────────────────────────────────

describe("Prettify — functions", () => {
  it("preserves function types", () => {
    type Fn = (x: number) => string;
    expectTypeOf<Prettify<Fn>>().toEqualTypeOf<Fn>();
  });

  it("preserves function properties inside objects", () => {
    type Input = { onClick: () => void } & { label: string };
    expectTypeOf<Prettify<Input>>().toEqualTypeOf<{
      onClick: () => void;
      label: string;
    }>();
  });
});

// ─── Index signatures ───────────────────────────────────────────

describe("Prettify — index signatures", () => {
  it("handles string index signature", () => {
    type Input = { [key: string]: number } & { specific: number };
    expectTypeOf<Prettify<Input>>().toEqualTypeOf<{
      [key: string]: number;
      specific: number;
    }>();
  });
});

// ─── Edge cases ─────────────────────────────────────────────────

describe("Prettify — edge cases", () => {
  it("handles never", () => {
    expectTypeOf<Prettify<never>>().toEqualTypeOf<never>();
  });

  it("handles unknown", () => {
    // @ts-expect-error
    expectTypeOf<Prettify<unknown>>().toEqualTypeOf<unknown>();
  });

  it("handles any", () => {
    expectTypeOf<Prettify<any>>().toBeAny();
  });

  it("handles Record type", () => {
    type Input = Record<"a" | "b", number> & { c: string };
    expectTypeOf<Prettify<Input>>().toEqualTypeOf<{
      a: number;
      b: number;
      c: string;
    }>();
  });

  it("handles Pick/Omit composition", () => {
    type Input = Pick<Foo, "a"> & Omit<Bar, "d">;
    expectTypeOf<Prettify<Input>>().toEqualTypeOf<{
      a: string;
      c: boolean;
    }>();
  });

  it("handles interface extends (already flat, should be no-op)", () => {
    interface Extended extends Foo {
      extra: boolean;
    }
    expectTypeOf<Prettify<Extended>>().toEqualTypeOf<{
      a: string;
      b: number;
      extra: boolean;
    }>();
  });
});
