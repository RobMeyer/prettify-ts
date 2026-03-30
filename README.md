# prettify-ts

`Prettify<T>` utility type that flattens TypeScript intersection types into readable single-object types, while preserving built-in types (Map, Set, Date, Promise, DOM types, TypedArrays, etc.).

Includes a **TypeScript Language Service Plugin** that shows the prettified type in VS Code hover tooltips.

## Scripts

| Command                  | Description                                 |
| ------------------------ | ------------------------------------------- |
| `npm run dev`            | Start dev server                            |
| `npm run build`          | Production build (types + plugin + library) |
| `npm run test`           | Run tests (watch mode)                      |
| `npm run test:run`       | Run tests once                              |
| `npm run test:typecheck` | Run type-level tests                        |
| `npm run format`         | Format code                                 |
| `npm run lint`           | Lint code                                   |
| `npm run setup`          | Configure git hooks                         |

## Usage — the type

```ts
import type { Prettify } from "prettify-ts";

interface A {
  x: string;
}
interface B {
  y: number;
}

type FlatVanilla = A & B; // ❌ Hover shows: A & B
type Flat = Prettify<A & B>; // ✅ Hover shows: { x: string; y: number }
```

Built-in types are preserved (not expanded into their internal members):

```ts
type Example = Prettify<{ id: string } & { data: Map<string, number> }>;
// → { id: string; data: Map<string, number> }
```

## Usage — VS Code plugin

Add to your project's `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [{ "name": "prettify-ts" }]
  }
}
```

Then in VS Code, make sure you're using the workspace TypeScript version (Cmd+Shift+P → "TypeScript: Select TypeScript Version" → "Use Workspace Version").

Hovering over any type will show the default tooltip plus a **Prettified** section below it with the fully resolved type.
