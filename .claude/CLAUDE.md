# Shard Launcher

## Overview

Shard is a Minecraft launcher built with Rust (core library) and Tauri (desktop UI).

| Directory | Tech Stack | Purpose |
|-----------|------------|---------|
| `/` (root) | Rust | Core library - profile management, downloads, launching |
| `ui/` | Tauri 2, React, TypeScript, Tailwind | Desktop application UI |
| `chorus/` | Tauri 2 | Alternative/experimental UI (WIP) |

## Commands

### Core Library (CLI)
```bash
# Development (fast, debug symbols)
cargo build
cargo run -- <args>

# Testing with optimization
cargo build --profile dev-release

# Production (full optimization)
cargo build --release
```

### UI Application
```bash
cd ui

# Install frontend dependencies
bun install

# Development mode (fast iteration)
cargo tauri dev

# Build for testing (faster compile)
cargo tauri build --profile dev-release

# Production build (full optimization)
cargo tauri build --release
```

## Build Profiles

| Profile | Command | Build Time | Use Case |
|---------|---------|------------|----------|
| `dev` | `cargo build` / `cargo tauri dev` | ~10s | Development, hot reload, debugging |
| `dev-release` | `cargo build --profile dev-release` | ~30s | Testing, iteration, quick validation |
| `release` | `cargo build --release` | ~3-5min | Production, final builds |

**When to use each:**
- **dev**: Use for all development with `cargo tauri dev`. Fast incremental builds, debug symbols, no optimization.
- **dev-release**: Use when you need a build to test but don't need full optimization. Good for sharing test builds.
- **release**: Use only for final production builds or performance-critical testing.

## Architecture

```
shard (root)
├── src/lib.rs          # Core library entry point
├── src/ops.rs          # Operations (download, install, launch)
├── src/profile.rs      # Profile management
├── src/config.rs       # Configuration handling
├── src/auth.rs         # Microsoft authentication
└── ui/
    ├── src/            # React frontend
    │   ├── App.tsx     # Main application component
    │   └── styles.css  # Tailwind + custom CSS
    └── src-tauri/
        ├── src/lib.rs      # Tauri app setup
        └── src/commands.rs # Tauri commands (bridge to core)
```

## Environment

- **Config location**: `~/.shard/` (profiles, store, caches)
- **UI dev server**: `http://localhost:1420`

## UI Design

The UI uses a macOS-inspired design with:
- Transparent/vibrancy sidebar (frosted glass effect)
- Warm color palette (charcoal backgrounds, cyan/amber accents)
- Glassmorphism effects via `backdrop-filter`
- Settings-style row layouts

Key CSS variables are defined in `ui/src/styles.css` under `:root`.

## AI Agent Guidelines

1. **Build commands**: Always use `cargo tauri dev` for development, not `cargo build` for the UI
2. **Profile usage**: Default to `dev` profile for iteration; only use `release` for final builds
3. **Avoid generated dirs**: `**/target/`, `**/node_modules/`, `**/dist/`
4. **Frontend changes**: Edit `ui/src/` files; Tauri backend in `ui/src-tauri/`
5. **Core library**: Edit root `src/` files; shared between CLI and UI

## Testing

```bash
# Core library
cargo check
cargo test

# UI (check Rust compilation)
cd ui && cargo tauri dev

# Frontend only
cd ui && bun run dev
```
