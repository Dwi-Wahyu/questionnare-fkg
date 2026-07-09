# TanStack Start Scratch App 🚀

A premium, modern web application built from scratch utilizing **TanStack Start**, **Rsbuild**, and **Bun**.

## Features

- **Blazing Fast Bundling**: Powered by `Rsbuild` (on top of `Rspack`).
- **Server-Side Rendering (SSR)**: Full out-of-the-box hydration.
- **Server Functions**: Implements server-side state functions (`createServerFn`) to persist and read data directly on the server file system.
- **Out-of-the-box Route Tree Autogeneration**: Routes under `src/routes/` are tracked and typed automatically.
- **Premium Aesthetics**: Sleek dark-mode container using Outfit typography, modern gradient overlays, glowing background blobs, and smooth interactive animations.

## Getting Started

### 1. Install Dependencies
```bash
bun install
```

### 2. Run the Development Server
```bash
bun run dev
```
Navigate to [http://localhost:3000](http://localhost:3000) to see your app!

### 3. Build for Production
```bash
bun run build
```

### 4. Run the Production Server
```bash
bun run start
```

## Structure
- `src/routes/__root.tsx`: Core layout shell wrapper.
- `src/routes/index.tsx`: The home route featuring our interactive server-rendered counter.
- `src/router.tsx`: TanStack Router configuration.
- `src/styles.css`: Custom premium styles.
- `AGENTS.md`: Technical configuration and decisions log.
