/**
 * Semantic equivalence check for TypeScript type display strings.
 * Handles union/intersection member reordering and object property reordering.
 */

export function areTypesEquivalent(a: string, b: string): boolean {
  return normalizeType(a) === normalizeType(b);
}

export function normalizeType(input: string): string {
  const s = input.replace(/\s+/g, " ").trim();
  if (!s) return "";

  // Union: A | B | C → sorted
  const unionParts = splitTopLevel(s, "|");
  if (unionParts.length > 1) {
    return unionParts.map(normalizeType).sort().join(" | ");
  }

  // Intersection: A & B & C → sorted
  const interParts = splitTopLevel(s, "&");
  if (interParts.length > 1) {
    return interParts.map(normalizeType).sort().join(" & ");
  }

  // Parenthesized: (T)
  if (s[0] === "(" && findMatchingClose(s, 0) === s.length - 1) {
    return "(" + normalizeType(s.slice(1, -1)) + ")";
  }

  // Object literal: { ... }
  if (s[0] === "{" && findMatchingClose(s, 0) === s.length - 1) {
    return normalizeObject(s);
  }

  // Tuple: [T, U] — order preserved
  if (s[0] === "[" && findMatchingClose(s, 0) === s.length - 1) {
    const inner = s.slice(1, -1).trim();
    if (!inner) return "[]";
    const elems = splitTopLevel(inner, ",");
    return "[" + elems.map(normalizeType).join(", ") + "]";
  }

  // Array: T[]
  if (s.endsWith("[]")) {
    const elem = s.slice(0, -2);
    if (elem.length > 0) {
      return normalizeType(elem) + "[]";
    }
  }

  // Generic: Name<T, U>
  const ltIdx = findGenericOpen(s);
  if (ltIdx > 0 && s.endsWith(">")) {
    const closeIdx = findMatchingClose(s, ltIdx);
    if (closeIdx === s.length - 1) {
      const name = s.slice(0, ltIdx);
      const inner = s.slice(ltIdx + 1, -1);
      const args = splitTopLevel(inner, ",");
      return name + "<" + args.map(normalizeType).join(", ") + ">";
    }
  }

  return s;
}

/** Find the first `<` that starts a generic parameter list (preceded by a word character) */
function findGenericOpen(s: string): number {
  for (let i = 1; i < s.length; i++) {
    if (s[i] === "<" && /\w/.test(s[i - 1])) {
      return i;
    }
  }
  return -1;
}

/** Find the matching close bracket for an open bracket at `openIdx` */
function findMatchingClose(s: string, openIdx: number): number {
  const open = s[openIdx];
  const close = open === "{" ? "}" : open === "(" ? ")" : open === "[" ? "]" : ">";
  let depth = 1;
  for (let i = openIdx + 1; i < s.length; i++) {
    const ch = s[i];
    if (ch === open) {
      if (open !== "<" || (i > 0 && /\w/.test(s[i - 1]))) {
        depth++;
      }
    } else if (ch === close) {
      if (close !== ">" || s[i - 1] !== "=") {
        depth--;
        if (depth === 0) return i;
      }
    }
  }
  return -1;
}

/** Split a string at top-level occurrences of a separator, respecting bracket nesting */
function splitTopLevel(s: string, sep: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = "";

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "{" || ch === "(" || ch === "[") {
      depth++;
      current += ch;
    } else if (ch === "}" || ch === ")" || ch === "]") {
      depth--;
      current += ch;
    } else if (ch === "<" && i > 0 && /\w/.test(s[i - 1])) {
      depth++;
      current += ch;
    } else if (ch === ">" && depth > 0 && s[i - 1] !== "=") {
      depth--;
      current += ch;
    } else if (depth === 0 && s.substring(i, i + sep.length) === sep) {
      parts.push(current.trim());
      current = "";
      i += sep.length - 1;
    } else {
      current += ch;
    }
  }
  const last = current.trim();
  if (last) parts.push(last);
  return parts;
}

/** Normalize an object literal by sorting its properties */
function normalizeObject(s: string): string {
  const inner = s.slice(1, -1).trim();
  if (!inner) return "{}";

  const rawProps = splitTopLevel(inner, ";")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const normalized = rawProps
    .map((prop) => {
      // Parse: [readonly] name[?]: type
      const match = prop.match(/^(readonly\s+)?([\w$]+)(\??)\s*:\s*([\s\S]+)$/);
      if (match) {
        const [, ro = "", name, opt, type] = match;
        return `${ro}${name}${opt}: ${normalizeType(type)}`;
      }
      // Index signature: [key: string]: type
      const idxMatch = prop.match(/^(\[[\s\S]+?\])\s*:\s*([\s\S]+)$/);
      if (idxMatch) {
        return `${idxMatch[1]}: ${normalizeType(idxMatch[2])}`;
      }
      return prop;
    })
    .sort();

  return "{ " + normalized.join("; ") + " }";
}
