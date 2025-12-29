# shard

A minimal, clean, CLI-first Minecraft launcher focused on stability, reproducibility, and low duplication.

## Philosophy

- **Single source of truth**: profiles are declarative manifests; instances are derived artifacts.
- **Deduplication first**: mods and packs live in a content-addressed store (SHA-256); profiles only reference hashes.
- **Stable + boring**: plain JSON on disk, predictable layout, no magic state.
- **Replaceable parts**: authentication, Minecraft data, and profile management are isolated modules.
- **CLI-first**: everything is designed to be scripted and composed.

## Architecture (high level)

- **Profiles** (`profiles/<id>/profile.json`)
  - The manifest for a version + mod/pack selection + runtime flags.
- **Stores** (`store/*/sha256/`)
  - Content-addressed blobs for mods, resourcepacks, shaderpacks.
- **Instances** (`instances/<id>/`)
  - Launchable game directories (symlinked mods/packs + overrides).
- **Minecraft data** (`minecraft/`)
  - Downloaded versions, libraries, assets, and natives.
- **Accounts** (`accounts.json`)
  - Multiple Microsoft accounts, with refresh + Minecraft access tokens.

### Launch flow

1. Read profile manifest.
2. Resolve Minecraft version (vanilla or Fabric loader).
3. Download version JSON + client jar (cached).
4. Download libraries + extract natives.
5. Download asset index + assets.
6. Materialize instance (mods/packs + overrides).
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

## Microsoft account setup

Shard uses Microsoft device-code flow and requires a **Microsoft OAuth client id**.
Some Azure app registrations also require a **client secret** (confidential client); shard will use it if provided.

Set it via env or config (supports `.env` via dotenv):

```
MICROSOFT_CLIENT_ID="your-client-id"
MICROSOFT_CLIENT_SECRET="your-client-secret"

export SHARD_MS_CLIENT_ID="your-client-id"
export SHARD_MS_CLIENT_SECRET="your-client-secret"

# or
shard config set-client-id <your-client-id>
shard config set-client-secret <your-client-secret>
```

Then add an account:

```
shard account add
```

## Commands (MVP)

```
shard list
shard profile create <id> --mc <version> [--loader fabric@<loader-version>]
shard profile clone <src> <dst>
shard profile show <id>
shard profile diff <a> <b>

shard mod add <profile> <file|url>
shard mod remove <profile> <name|hash>
shard mod list <profile>

shard resourcepack add <profile> <file|url>
shard resourcepack remove <profile> <name|hash>
shard resourcepack list <profile>

shard shaderpack add <profile> <file|url>
shard shaderpack remove <profile> <name|hash>
shard shaderpack list <profile>

shard account add
shard account list
shard account use <uuid|username>
shard account remove <uuid|username>

shard launch <profile> [--account <uuid|username>] [--prepare-only]
```

## Notes

- **Fabric loader**: specify `--loader fabric@<version>` on profile creation. The Fabric profile JSON is fetched from Fabric meta.
- **Overrides**: `profiles/<id>/overrides/` is merged into the instance (without overwriting existing files). Delete instance files to re-apply overrides.
- **Tokens**: account tokens are stored locally in `accounts.json` for convenience. Protect your `~/.shard` directory.

## Next ideas (not yet)

- Forge/Quilt loader support
- Garbage collection for unreferenced store blobs
- Lockfiles for strict dependency pinning
- GUI layer over the same profile/store model
