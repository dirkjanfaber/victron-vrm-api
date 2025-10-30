# Alpha Package Build & Publish

This document describes how to build and publish the `victron-vrm-api-alpha` package for testing the main branch.

## Overview

The alpha package is a separate npm package that allows users to test the latest main branch code without affecting their stable installation. It creates completely separate Node-RED nodes that can coexist with the stable version.

## Key Differences from Stable Package

| Aspect | Stable Package | Alpha Package |
|--------|---------------|---------------|
| Package Name | `victron-vrm-api` | `victron-vrm-api-alpha` |
| Node Types | `vrm-api`, `config-vrm-api` | `vrm-api-alpha`, `config-vrm-api-alpha` |
| Display Names | "VRM API", "VRM API" | "VRM API Alpha", "VRM API Alpha Config" |
| Color | Orange (`#f7ab3e`) | Blue (`#4a90e2`) |
| Category | "Victron Energy" | "Victron Energy Alpha" |
| Version | `0.3.6` | `0.3.6-alpha.1` (auto-incremented) |

## Building the Alpha Package

The build script creates a modified copy of the source code in the `build-alpha/` directory:

```bash
npm run build:alpha
```

This will:
1. Copy all source files to `build-alpha/`
2. Modify `package.json` (name, version, node registrations)
3. Update HTML files (node types, labels, colors, categories)
4. Update JS files (node registrations)
5. Update example flows (node type references)

The alpha version number is automatically incremented:
- First build from `0.3.6` → `0.3.6-alpha.1`
- Second build from `0.3.6` → `0.3.6-alpha.2`
- If you bump to `0.3.7`, it resets → `0.3.7-alpha.1`

## Publishing the Alpha Package

To build and publish in one step:

```bash
npm run publish:alpha
```

This will:
1. Run the build script
2. Publish to npm from the `build-alpha/` directory

**Note:** You need to be logged in to npm with publish permissions for the `victron-vrm-api-alpha` package.

## Installation for Testers

Testers can install the alpha package alongside the stable version:

```bash
npm install victron-vrm-api-alpha
```

Or in Node-RED's palette manager, search for "victron-vrm-api-alpha".

## Using the Alpha Package

1. Install `victron-vrm-api-alpha`
2. In Node-RED palette, you'll see a new category: "Victron Energy Alpha" (blue nodes)
3. Drag in the alpha nodes (separate from stable nodes)
4. Create a new "VRM API Alpha Config" node with your API token
5. Build your test flow using the alpha nodes

**Important:** The alpha nodes are completely separate from the stable nodes. You'll need to:
- Recreate your flows using the alpha nodes
- Configure a separate config node for the alpha version
- Both packages can be installed at the same time

## Uninstalling

When testing is complete, testers can remove the alpha package:

```bash
npm uninstall victron-vrm-api-alpha
```

Or via Node-RED's palette manager.

## Version Strategy

The alpha package uses semantic versioning with an alpha suffix:
- Base version matches the main branch
- Alpha counter increments automatically based on your main `package.json`
- Format: `X.Y.Z-alpha.N`

### How Version Increment Works

The build script reads the version from your **main** `package.json` and increments it:

- If `package.json` has `0.3.6` → builds `0.3.6-alpha.1`
- If `package.json` has `0.3.6-alpha.1` → builds `0.3.6-alpha.2`
- If `package.json` has `0.3.7` → builds `0.3.7-alpha.1`

### Creating Sequential Alpha Releases

To create multiple alpha versions (alpha.1, alpha.2, alpha.3, etc.), update your main `package.json` between builds:

```bash
# First alpha
npm run build:alpha              # Creates 0.3.6-alpha.1
npm run publish:alpha            # Publishes 0.3.6-alpha.1

# Second alpha
npm version 0.3.6-alpha.1 --no-git-tag-version
npm run build:alpha              # Creates 0.3.6-alpha.2
npm run publish:alpha            # Publishes 0.3.6-alpha.2

# Third alpha
npm version 0.3.6-alpha.2 --no-git-tag-version
npm run build:alpha              # Creates 0.3.6-alpha.3
npm run publish:alpha            # Publishes 0.3.6-alpha.3

# When ready for stable release
npm version 0.3.7 --no-git-tag-version
npm publish                      # Publishes stable 0.3.7
```

**Note:** The `--no-git-tag-version` flag prevents npm from creating git tags for alpha versions.

Example progression:
- `0.3.6-alpha.1` (first alpha of 0.3.6)
- `0.3.6-alpha.2` (second alpha of 0.3.6)
- `0.3.7-alpha.1` (first alpha after version bump)

## Build Directory

The `build-alpha/` directory is:
- Created during the build process
- Gitignored (not tracked)
- Cleaned and recreated on each build
- Only used for publishing

Do not manually edit files in `build-alpha/` - changes will be overwritten on the next build.

## Example Flows

The build script automatically updates all example flows in the `examples/` directory to use the alpha node types. This means:
- Example flows will import correctly in Node-RED when using the alpha package
- All node type references (`vrm-api` → `vrm-api-alpha`, `config-vrm-api` → `config-vrm-api-alpha`) are updated
- Users can import and use the examples immediately without manual modification

## Troubleshooting

### "Package already exists"
The version number is automatically incremented, but if you need to manually specify a version, you can modify the script or manually edit the version in `build-alpha/package.json` before publishing.

### "Not logged in to npm"
Run `npm login` and authenticate with your npm account that has publish permissions.

### "Permission denied"
Make sure you have publish permissions for the `victron-vrm-api-alpha` package on npm.

## Script Files

- `scripts/build-alpha.js` - Builds the alpha package
- `scripts/publish-alpha.js` - Builds and publishes the alpha package
