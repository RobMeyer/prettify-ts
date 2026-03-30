import { describe, expect, it } from "vitest";
import { areTypesEquivalent, normalizeType } from "../type-equality";

describe("areTypesEquivalent", () => {
  describe("identical types", () => {
    it.each([
      ["string", "string"],
      ["number", "number"],
      ["boolean", "boolean"],
      ["undefined", "undefined"],
      ["null", "null"],
      ["never", "never"],
      ["unknown", "unknown"],
      ["any", "any"],
      ["void", "void"],
      ["string[]", "string[]"],
      ["[string, number]", "[string, number]"],
      ["Map<string, number>", "Map<string, number>"],
      ["{ a: string; b: number }", "{ a: string; b: number }"],
    ])("%s === %s", (a, b) => {
      expect(areTypesEquivalent(a, b)).toBe(true);
    });
  });

  describe("union reordering", () => {
    it.each([
      ["string | undefined", "undefined | string"],
      ["string | number | undefined", "undefined | string | number"],
      ["string | number | boolean", "boolean | number | string"],
      ["A | B", "B | A"],
      ["null | undefined | string", "string | null | undefined"],
      ['"a" | "b" | "c"', '"c" | "a" | "b"'],
    ])("%s === %s", (a, b) => {
      expect(areTypesEquivalent(a, b)).toBe(true);
    });
  });

  describe("intersection reordering", () => {
    it.each([
      ["Foo & Bar", "Bar & Foo"],
      ["A & B & C", "C & A & B"],
      ["{ a: string } & { b: number }", "{ b: number } & { a: string }"],
    ])("%s === %s", (a, b) => {
      expect(areTypesEquivalent(a, b)).toBe(true);
    });
  });

  describe("nested type reordering", () => {
    it.each([
      ["{ a: string | undefined }", "{ a: undefined | string }"],
      [
        "{ a: string | undefined; b: number | null }",
        "{ a: undefined | string; b: null | number }",
      ],
      ["(string | number)[]", "(number | string)[]"],
      ["Map<string | undefined, number>", "Map<undefined | string, number>"],
      ["Set<A | B>", "Set<B | A>"],
      ["Promise<string | null>", "Promise<null | string>"],
      ["{ nested: { deep: string | undefined } }", "{ nested: { deep: undefined | string } }"],
    ])("%s === %s", (a, b) => {
      expect(areTypesEquivalent(a, b)).toBe(true);
    });
  });

  describe("object property reordering", () => {
    it.each([
      ["{ b: number; a: string }", "{ a: string; b: number }"],
      ["{ c: boolean; a: string; b: number }", "{ a: string; b: number; c: boolean }"],
      ["{ z: string; a: number; m: boolean }", "{ a: number; m: boolean; z: string }"],
    ])("%s === %s", (a, b) => {
      expect(areTypesEquivalent(a, b)).toBe(true);
    });
  });

  describe("whitespace normalization", () => {
    it.each([
      ["  string  |  undefined  ", "undefined | string"],
      ["string|undefined", "undefined|string"],
      ["{ a: string;  b: number }", "{ a: string; b: number }"],
      ["{\n  a: string;\n  b: number;\n}", "{ a: string; b: number }"],
      ["{\n  level1: {\n    a: string;\n  };\n}", "{ level1: { a: string } }"],
    ])("normalizes whitespace: %s === %s", (a, b) => {
      expect(areTypesEquivalent(a, b)).toBe(true);
    });
  });

  describe("trailing semicolons", () => {
    it.each([
      ["{ a: string; b: number; }", "{ a: string; b: number }"],
      ["{ a: string; }", "{ a: string }"],
    ])("%s === %s", (a, b) => {
      expect(areTypesEquivalent(a, b)).toBe(true);
    });
  });

  describe("modifier preservation", () => {
    it.each([
      ["{ readonly a: string; b: number }", "{ b: number; readonly a: string }"],
      ["{ a?: string; b: number }", "{ b: number; a?: string }"],
      ["{ readonly a?: string; b: number }", "{ b: number; readonly a?: string }"],
    ])("%s === %s", (a, b) => {
      expect(areTypesEquivalent(a, b)).toBe(true);
    });
  });

  describe("combined reordering", () => {
    it.each([
      [
        "{ b: number | null; a: string | undefined }",
        "{ a: undefined | string; b: null | number }",
      ],
      ["{ b: Foo & Bar; a: string }", "{ a: string; b: Bar & Foo }"],
    ])("%s === %s", (a, b) => {
      expect(areTypesEquivalent(a, b)).toBe(true);
    });
  });

  describe("function types", () => {
    it.each([
      ["(a: number) => string", "(a: number) => string"],
      ["() => void", "() => void"],
      ["{ fn: (a: number) => string; b: number }", "{ b: number; fn: (a: number) => string }"],
    ])("%s === %s", (a, b) => {
      expect(areTypesEquivalent(a, b)).toBe(true);
    });
  });

  describe("non-equivalent types", () => {
    it.each([
      ["string", "number"],
      ["string | undefined", "string | null"],
      ["string | undefined", "string"],
      ["{ a: string }", "{ b: string }"],
      ["{ a: string; b: number }", "{ a: number; b: string }"],
      ["string[]", "number[]"],
      ["[string, number]", "[number, string]"],
      ["Map<string, number>", "Map<number, string>"],
      ["{ a: string }", "{ a: string; b: number }"],
      ["Foo & Bar", "Foo | Bar"],
      ["readonly string[]", "string[]"],
    ])("%s !== %s", (a, b) => {
      expect(areTypesEquivalent(a, b)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles empty strings", () => {
      expect(areTypesEquivalent("", "")).toBe(true);
    });

    it("handles empty objects", () => {
      expect(areTypesEquivalent("{}", "{}")).toBe(true);
    });

    it("handles empty arrays", () => {
      expect(areTypesEquivalent("[]", "[]")).toBe(true);
    });

    it("handles nested generics", () => {
      expect(
        areTypesEquivalent(
          "Map<string, Set<number | boolean>>",
          "Map<string, Set<boolean | number>>",
        ),
      ).toBe(true);
    });

    it("handles deeply nested objects", () => {
      expect(
        areTypesEquivalent(
          "{ a: { b: { c: string | undefined } } }",
          "{ a: { b: { c: undefined | string } } }",
        ),
      ).toBe(true);
    });

    it("handles union of objects", () => {
      expect(
        areTypesEquivalent("{ a: string } | { b: number }", "{ b: number } | { a: string }"),
      ).toBe(true);
    });

    it("handles array of unions", () => {
      expect(areTypesEquivalent("(string | number)[]", "(number | string)[]")).toBe(true);
    });

    it("handles tuple with union elements", () => {
      expect(areTypesEquivalent("[string | number, boolean]", "[number | string, boolean]")).toBe(
        true,
      );
    });

    it("does not reorder tuple elements", () => {
      expect(areTypesEquivalent("[string, number]", "[number, string]")).toBe(false);
    });

    it("handles arrow functions with generics", () => {
      expect(
        areTypesEquivalent("Array<(x: number) => string>", "Array<(x: number) => string>"),
      ).toBe(true);
    });
  });
});

describe("normalizeType", () => {
  it("sorts union members alphabetically", () => {
    expect(normalizeType("z | a | m")).toBe("a | m | z");
  });

  it("sorts intersection members alphabetically", () => {
    expect(normalizeType("Z & A & M")).toBe("A & M & Z");
  });

  it("sorts object properties alphabetically", () => {
    expect(normalizeType("{ z: string; a: number }")).toBe("{ a: number; z: string }");
  });

  it("collapses whitespace", () => {
    expect(normalizeType("  string  |  number  ")).toBe("number | string");
  });

  it("handles multiline input", () => {
    expect(normalizeType("{\n  a: string;\n  b: number;\n}")).toBe("{ a: string; b: number }");
  });

  it("preserves array notation", () => {
    expect(normalizeType("string[]")).toBe("string[]");
  });

  it("preserves tuple order", () => {
    expect(normalizeType("[string, number, boolean]")).toBe("[string, number, boolean]");
  });

  it("normalizes nested types recursively", () => {
    expect(normalizeType("{ a: z | a; b: { d: number; c: string } }")).toBe(
      "{ a: a | z; b: { c: string; d: number } }",
    );
  });
});
