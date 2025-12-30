# Shard Launcher

## Sync note
If you update this file, also update `.codex/CODEX.md` and `.cursor/rules/context.mdx` to keep contexts aligned.

## Overview
Shard is a minimal, clean, CLI-first Minecraft launcher focused on stability, reproducibility, and low duplication. The core library and CLI are in Rust; the optional desktop UI is built with Tauri + React.

| Directory | Tech Stack | Purpose |
|-----------|------------|---------|
| `/` (root) | Rust | Core library + CLI (profiles, store, downloads, launching) |
| `ui/` | Tauri 2, React, TypeScript, Vite | Desktop application UI |
| `ui/src-tauri/` | Rust | Tauri backend (bridge to core library) |

## Philosophy
- **Single source of truth**: profiles are declarative manifests; instances are derived artifacts.
- **Deduplication first**: mods and packs live in a content-addressed store (SHA-256); profiles only reference hashes.
- **Stable + boring**: plain JSON on disk, predictable layout, no magic state.
- **Replaceable parts**: authentication, Minecraft data, and profile management are isolated modules.
- **CLI-first**: everything is designed to be scripted and composed.

## Architecture (core concepts)
- **Profiles** (`profiles/<id>/profile.json`): manifest for version + mod/pack selection + runtime flags.
- **Templates** (`templates/<id>/template.json`): reusable profile configurations (Fabric, Forge, etc.).
- **Stores** (`store/*/sha256/`): content-addressed blobs for mods, resourcepacks, shaderpacks.
- **Library** (global content cache): deduplicated content across all profiles.
- **Instances** (`instances/<id>/`): launchable game dirs (symlinked mods/packs + overrides).
- **Minecraft data** (`minecraft/`): versions, libraries, assets, natives.
- **Accounts** (`accounts.json`): multiple Microsoft accounts with refresh + access tokens.

## Code map (Rust)
- `src/lib.rs`: core library entry point, re-exports all modules.
- `src/main.rs`: CLI entry point with subcommands.
- `src/profile.rs`: profile management and serialization.
- `src/template.rs`: profile templates for quick setup.
- `src/store.rs`: content-addressed store operations.
- `src/content_store.rs`: unified content store abstraction.
- `src/library.rs`: global library/content management.
- `src/instance.rs`: instance materialization from profiles.
- `src/minecraft.rs`: version/library/asset downloads.
- `src/modrinth.rs`: Modrinth API client for mod search/install.
- `src/curseforge.rs`: CurseForge API client for mod search/install.
- `src/ops.rs`: higher-level operations (download, install, launch).
- `src/auth.rs`: Microsoft OAuth device code flow.
- `src/accounts.rs`: account storage + selection.
- `src/skin.rs`: Minecraft skin fetching and upload.
- `src/java.rs`: Java runtime detection and management.
- `src/config.rs`: global configuration handling.
- `src/paths.rs`: data path helpers.
- `src/logs.rs`: logging infrastructure.
- `src/updates.rs`: update checking functionality.
- `src/util.rs`: shared helpers.

## Code map (UI)
- `ui/src/App.tsx`: main application component, routing, modal management.
- `ui/src/store.ts`: Zustand state management.
- `ui/src/styles.css`: design tokens, theme variables, component styles.
- `ui/src/components/Sidebar.tsx`: navigation sidebar with profile selector, drag-and-drop folders.
- `ui/src/components/ProfileView.tsx`: profile details, content management, launch controls.
- `ui/src/components/StoreView.tsx`: Modrinth/CurseForge mod browser with search and install.
- `ui/src/components/LibraryView.tsx`: global content library browser.
- `ui/src/components/AccountView.tsx`: account details and skin management.
- `ui/src/components/AccountsView.tsx`: account list and switching.
- `ui/src/components/LogsView.tsx`: live game log viewer.
- `ui/src/components/SettingsView.tsx`: application settings.
- `ui/src/components/SkinViewer.tsx`: 3D Minecraft skin renderer.
- `ui/src/components/PlatformIcon.tsx`: Modrinth/CurseForge/Local platform icons.
- `ui/src/components/modals/`: modal dialogs for various actions.

## Launch flow
1. Read profile manifest.
2. Resolve Minecraft version (vanilla or loader like Fabric/Forge).
3. Download version JSON + client jar (cached).
4. Download libraries + extract natives.
5. Download asset index + assets.
6. Materialize instance (mods/packs + overrides from store).
7. Build JVM + game args from version JSON.
8. Launch Java process.

## Data layout
```
~/.shard/
  store/
    mods/sha256/<hash>
    resourcepacks/sha256/<hash>
    shaderpacks/sha256/<hash>
  profiles/
    <profile-id>/profile.json
    <profile-id>/overrides/
  templates/
    <template-id>/template.json
  instances/
    <profile-id>/
  minecraft/
    versions/<version>/<version>.json
    versions/<version>/<version>.jar
    libraries/
    assets/objects/<hash>
    assets/indexes/<index>.json
  caches/
    downloads/
    manifests/
  accounts.json
  config.json
  logs/
```

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

## Environment

- **Config location**: `~/.shard/` (profiles, store, caches)
- **UI dev server**: `http://localhost:1420`

## UI Design

- Design tokens and theme variables live in `ui/src/styles.css` (warm dark palette, Geist fonts).
- Uses custom CSS with CSS variables, not Tailwind.
- Glassmorphism with `backdrop-filter: blur()` on elevated surfaces.
- Accent colors: `--accent-primary` (cyan blue), `--accent-secondary` (warm amber).
- Border-radius scale: 4px (tiny), 6px (small), 8px (medium), 10px (standard), 12px (large containers).

## AI Agent Guidelines

1. **Build commands**: Always use `cargo tauri dev` for UI development, not `cargo build`.
2. **Profile usage**: Default to `dev` profile for iteration; use `dev-release` for quick test builds; `release` for production.
3. **Avoid generated dirs**: `**/target/`, `**/node_modules/`, `**/dist/`.
4. **Frontend changes**: Edit `ui/src/` files; Tauri backend in `ui/src-tauri/`.
5. **Core library**: Edit root `src/` files; shared between CLI and UI.
6. **CSS**: Use CSS variables from `styles.css`, maintain consistent border-radius and spacing.
7. **Keep contexts aligned**: Update `.codex/CODEX.md` and `.cursor/rules/context.mdx` when this file changes.

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
