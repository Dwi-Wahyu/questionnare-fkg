# TanStack Start Scratch Project

A high-performance Server-Side Rendered (SSR) web application built from scratch using **TanStack Start**, **Rsbuild**, and **Bun**.

## Project Context & Chosen Stack

- **Framework**: TanStack Start (powered by React and TanStack Router)
- **Bundler / Build Tool**: Rsbuild (powered by Rspack for fast compilation)
- **Package Manager / Runtime**: Bun (v1.3.10)
- **Styling**: Vanilla CSS (custom styled with modern visual aesthetics)

---

## Architectural Decisions & Files Created

### 1. TypeScript Configuration (`tsconfig.json`)
We initialized a custom `tsconfig.json` conforming to TanStack Start's guidelines:
- Set `"moduleResolution": "Bundler"`, `"module": "ESNext"`, and `"target": "ES2022"`.
- Set `"verbatimModuleSyntax": false` (disabled as recommended in the TanStack guides to prevent server-only modules from leaking into client-side bundles).

### 2. Rsbuild Configuration (`rsbuild.config.ts`)
Conforms to TanStack Start's integration with Rsbuild:
```ts
import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'
import { tanstackStart } from '@tanstack/react-start/plugin/rsbuild'

export default defineConfig({
  server: {
    port: 3000,
  },
  plugins: [pluginReact(), tanstackStart()],
})
```

### 3. Router Setup (`src/router.tsx`)
Initializes the TanStack Router with standard scroll restoration and registers the router types:
```tsx
import { createRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

export function getRouter() {
  const router = createRouter({
    routeTree,
    scrollRestoration: true,
  })
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
```

### 4. Root Page Component (`src/routes/__root.tsx`)
Serves as the main HTML shell wrapper. Implements `<HeadContent />` and `<Scripts />` required by TanStack Start, and imports the global stylesheet `src/styles.css`.

### 5. Index Page Component (`src/routes/index.tsx`)
Implements an interactive demonstration using TanStack Start's Server Functions:
- Reads and updates a local server-side text file (`count.txt`) using `createServerFn`.
- Automatically refetches/invalidates route loader state on the client after clicking the button.

### 6. Stylesheet (`src/styles.css`)
Custom Vanilla CSS implementation featuring:
- Premium typography using the Google Font 'Outfit'.
- Vibrant glassmorphic card layout, dark theme, and dual glowing backdrop blobs.
- Smooth CSS transition states, hover scales, and float animations on the counter text.

---

## Command Reference

- **Development Server** (runs on port `3000`):
  ```shell
  bun run dev
  ```
- **Production Build** (compiles client & SSR bundles to `dist/`):
  ```shell
  bun run build
  ```
- **Production Server Start** (runs the built app locally with static assets served via Rsbuild preview):
  ```shell
  bun run start
  ```
- **Database Schema Push** (syncs Drizzle schema directly with SQLite db):
  ```shell
  bun run db:push
  ```
- **Database Seeder** (wipes tables and seeds initial store, products, and users data):
  ```shell
  bun run db:seed
  ```

---

## Gotchas & Troubleshooting

- **Server Bundles Leaking**: Ensure `"verbatimModuleSyntax": false` stays configured in `tsconfig.json`.
- **Router Tree Generation**: The file `src/routeTree.gen.ts` is automatically generated and updated by TanStack Start on running `dev` or `build` commands. Do not edit it manually.
