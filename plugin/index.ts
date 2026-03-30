import type ts from "typescript";
import { areTypesEquivalent } from "./type-equality";

/**
 * TypeScript Language Service Plugin
 *
 * Intercepts hover tooltips (getQuickInfoAtPosition) and appends
 * a "prettified" version of the hovered type below the default display.
 *
 * Usage in tsconfig.json:
 * {
 *   "compilerOptions": {
 *     "plugins": [{ "name": "ts-prettify" }]
 *   }
 * }
 */

const PRETTIFIED_HEADER = "💅 Prettified";

function init(modules: { typescript: typeof ts }) {
  const tsModule = modules.typescript;

  function create(info: ts.server.PluginCreateInfo): ts.LanguageService {
    const { languageService, project } = info;
    const log = (msg: string) => project.projectService.logger.info(`[ts-prettify] ${msg}`);

    log("create called");

    // Proxy every method through to the original
    const proxy = Object.create(null) as ts.LanguageService;
    for (const k of Object.keys(languageService) as Array<keyof ts.LanguageService>) {
      const original = languageService[k];
      if (typeof original === "function") {
        (proxy as any)[k] = (...args: any[]) => (original as Function).apply(languageService, args);
      }
    }

    proxy.getQuickInfoAtPosition = (
      fileName: string,
      position: number,
    ): ts.QuickInfo | undefined => {
      const original = languageService.getQuickInfoAtPosition(fileName, position);
      if (!original) return original;

      try {
        log(`quickinfo at ${fileName}:${position}`);
        const program = languageService.getProgram();
        if (!program) {
          log("no program");
          return original;
        }

        const checker = program.getTypeChecker();
        const sourceFile = program.getSourceFile(fileName);
        if (!sourceFile) return original;

        const node = findNodeAtPosition(tsModule, sourceFile, position);
        if (!node) return original;

        const type = getTypeForNode(tsModule, checker, node);
        if (!type) return original;

        const prettified = resolveType(tsModule, checker, type, new Set(), 0);
        if (!prettified) return original;

        // Don't append if the prettified version is equivalent to the original display
        const originalDisplay = tsModule.displayPartsToString(original.displayParts ?? []);
        if (isTypeAlreadyShown(originalDisplay, prettified)) return original;

        // Append prettified type with syntax highlighting
        const separator: ts.SymbolDisplayPart = {
          text: `\n\n### ${PRETTIFIED_HEADER}\n\n\`\`\`ts\n${prettified}\n\`\`\``,
          kind: "text",
        };

        return {
          ...original,
          documentation: [...(original.documentation ?? []), separator],
        };
      } catch {
        // Never break the editor — swallow and return original
        return original;
      }
    };

    return proxy;
  }

  /** Walk the AST to find the most specific node at a position */
  function findNodeAtPosition(
    ts: typeof import("typescript"),
    sourceFile: ts.SourceFile,
    position: number,
  ): ts.Node | undefined {
    function walk(node: ts.Node): ts.Node | undefined {
      if (position < node.getStart(sourceFile) || position >= node.getEnd()) {
        return undefined;
      }
      return ts.forEachChild(node, walk) ?? node;
    }
    return walk(sourceFile);
  }

  /** Get the type of a node, handling identifiers, expressions, and type nodes */
  function getTypeForNode(
    ts: typeof import("typescript"),
    checker: ts.TypeChecker,
    node: ts.Node,
  ): ts.Type | undefined {
    // For type references and type aliases, get the type directly
    if (ts.isTypeReferenceNode(node) || ts.isTypeAliasDeclaration(node)) {
      return checker.getTypeAtLocation(node);
    }
    // For identifiers, try the symbol first
    if (ts.isIdentifier(node)) {
      const symbol = checker.getSymbolAtLocation(node);
      if (symbol) {
        const declaredType = checker.getDeclaredTypeOfSymbol(symbol);
        if (declaredType.flags !== ts.TypeFlags.Any) {
          return declaredType;
        }
        return checker.getTypeOfSymbolAtLocation(symbol, node);
      }
    }
    return checker.getTypeAtLocation(node);
  }

  /**
   * Recursively resolve a type into a flat, readable string.
   * This is the runtime equivalent of the Prettify<T> type.
   */
  function resolveType(
    ts: typeof import("typescript"),
    checker: ts.TypeChecker,
    type: ts.Type,
    seen: Set<ts.Type>,
    depth: number,
  ): string | undefined {
    const MAX_DEPTH = 5;
    if (depth > MAX_DEPTH) return "...";
    if (seen.has(type)) return "...";

    // Primitives and literals — let TS handle them
    if (
      type.flags & ts.TypeFlags.StringLike ||
      type.flags & ts.TypeFlags.NumberLike ||
      type.flags & ts.TypeFlags.BooleanLike ||
      type.flags & ts.TypeFlags.BigIntLike ||
      type.flags & ts.TypeFlags.ESSymbolLike ||
      type.flags & ts.TypeFlags.Undefined ||
      type.flags & ts.TypeFlags.Null ||
      type.flags & ts.TypeFlags.Void ||
      type.flags & ts.TypeFlags.Never
    ) {
      return checker.typeToString(type);
    }

    // Built-in objects — return name without expanding
    const typeName = checker.typeToString(type, undefined, ts.TypeFormatFlags.None);
    if (isBuiltinName(typeName)) {
      return typeName;
    }

    // Union types — resolve each member
    if (type.isUnion()) {
      const parts = type.types.map((t) => resolveType(ts, checker, t, seen, depth));
      return parts.join(" | ");
    }

    // Intersection types — merge properties
    if (type.isIntersection()) {
      seen.add(type);
      return resolveObjectType(ts, checker, type, seen, depth);
    }

    // Object types with properties — expand
    if (type.flags & ts.TypeFlags.Object) {
      const objectType = type as ts.ObjectType;

      // Array types
      if (checker.isArrayType(objectType)) {
        const typeArgs = checker.getTypeArguments(objectType as ts.TypeReference);
        if (typeArgs.length === 1) {
          const elem = resolveType(ts, checker, typeArgs[0], seen, depth + 1);
          return `${elem}[]`;
        }
      }

      // Tuple types
      if (checker.isTupleType(objectType)) {
        const typeArgs = checker.getTypeArguments(objectType as ts.TypeReference);
        const elems = typeArgs.map((t) => resolveType(ts, checker, t, seen, depth + 1));
        return `[${elems.join(", ")}]`;
      }

      // Plain object types
      const props = checker.getPropertiesOfType(type);
      if (props.length > 0) {
        seen.add(type);
        return resolveObjectType(ts, checker, type, seen, depth);
      }
    }

    // Fallback
    return checker.typeToString(
      type,
      undefined,
      ts.TypeFormatFlags.NoTruncation | ts.TypeFormatFlags.MultilineObjectLiterals,
    );
  }

  /** Expand an object type's properties into { key: value; ... } notation */
  function resolveObjectType(
    ts: typeof import("typescript"),
    checker: ts.TypeChecker,
    type: ts.Type,
    seen: Set<ts.Type>,
    depth: number,
  ): string {
    const props = checker.getPropertiesOfType(type);
    const indent = "  ".repeat(depth + 1);
    const closingIndent = "  ".repeat(depth);

    const members = props.map((prop) => {
      const propType = checker.getTypeOfSymbolAtLocation(
        prop,
        prop.valueDeclaration ?? prop.declarations?.[0] ?? ({} as ts.Node),
      );
      const optional = prop.flags & ts.SymbolFlags.Optional ? "?" : "";
      const readonly_ = prop.declarations?.some(
        (d) =>
          ts.isPropertySignature(d) &&
          d.modifiers?.some((m) => m.kind === ts.SyntaxKind.ReadonlyKeyword),
      )
        ? "readonly "
        : "";

      const resolved = resolveType(ts, checker, propType, seen, depth + 1);
      return `${indent}${readonly_}${prop.name}${optional}: ${resolved}`;
    });

    if (members.length === 0) return "{}";
    return `{\n${members.join(";\n")};\n${closingIndent}}`;
  }

  /** Check if a type name is a known built-in that should not be expanded */
  function isBuiltinName(name: string): boolean {
    // Strip generic params: "Map<string, number>" → "Map"
    const baseName = name.replace(/<.*>$/, "");
    return BUILTIN_NAMES.has(baseName);
  }

  /** Check if the prettified type is already shown in the original display */
  function isTypeAlreadyShown(display: string, prettified: string): boolean {
    // Fast path: exact substring match
    if (display.includes(prettified)) return true;

    // Extract the type portion and compare semantically
    const typeStr = extractTypeFromDisplay(display);
    if (typeStr && areTypesEquivalent(typeStr, prettified)) return true;

    return false;
  }

  /** Extract the type part from a hover display string */
  function extractTypeFromDisplay(display: string): string | null {
    // "type X = T" or "(alias) type X = T"
    const typeAlias = display.match(/type\s+\w+(?:<[^>]*>)?\s*=\s*([\s\S]+)$/);
    if (typeAlias) return typeAlias[1].trim();

    // "const x: T", "(property) x: T", etc.
    const colonMatch = display.match(/:\s*([\s\S]+)$/);
    if (colonMatch) return colonMatch[1].trim();

    return null;
  }

  return { create };
}

const BUILTIN_NAMES = new Set([
  "Date",
  "RegExp",
  "Error",
  "TypeError",
  "RangeError",
  "SyntaxError",
  "ReferenceError",
  "URIError",
  "EvalError",
  "Promise",
  "Map",
  "Set",
  "WeakMap",
  "WeakSet",
  "ReadonlyMap",
  "ReadonlySet",
  "ArrayBuffer",
  "SharedArrayBuffer",
  "DataView",
  "Int8Array",
  "Uint8Array",
  "Uint8ClampedArray",
  "Int16Array",
  "Uint16Array",
  "Int32Array",
  "Uint32Array",
  "Float32Array",
  "Float64Array",
  "BigInt64Array",
  "BigUint64Array",
  // DOM types
  "Node",
  "Element",
  "HTMLElement",
  "SVGElement",
  "Document",
  "Window",
  "EventTarget",
  "Event",
  "MouseEvent",
  "KeyboardEvent",
  "FocusEvent",
  "InputEvent",
  "CustomEvent",
  "MutationObserver",
  "IntersectionObserver",
  "ResizeObserver",
  "AbortController",
  "AbortSignal",
  "Headers",
  "Request",
  "Response",
  "URL",
  "URLSearchParams",
  "FormData",
  "Blob",
  "File",
  "FileReader",
  "ReadableStream",
  "WritableStream",
  "TransformStream",
]);

export = init;
