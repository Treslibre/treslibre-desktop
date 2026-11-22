<div align="center">
  <!-- Centered README header hack -->
  <!-- Note: Do not replace the obsolete align attribute with inline style, as GitHub may strip it. -->
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="logo_dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="logo_light.svg">
    <img width="500" src="logo_light.svg" alt="Treslibre Logo">
  </picture>
  <br><br>
</div>

---

> **Notice (AGPL-3.0 Section 5a):** Modified by Treslibre Project (2026) as part of Treslibre, an
> independent fork of Threema. Not affiliated with or endorsed by Threema AG.

# Treslibre for Desktop

A standalone **Treslibre** client for the desktop (Windows/macOS/Linux), forked from Threema for
Desktop under GNU AGPL-3.0.

Treslibre for Desktop targets self-hosted / custom server deployments with Trust-On-First-Use (TOFU)
server provisioning, the Lavender (`#D0CFEC` / `#58559A`) brand palette, and the integrated
`apps/conferencing` web app.

## Table of Contents

- [Policies](#policies)
  - [Bug Reports / Feature Requests / Security Issues](#issues)
  - [Contributions](#contributions)
- [Building](#building)
  - [Requirements](#requirements)
  - [Install Dependencies](#install-dependencies)
  - [Build libthreema](#build-libthreema)
  - [Build and Package](#build-and-package)
  - [Testing & Audits](#testing-and-audits)
- [Development](#development)
  - [Dev Container](#dev-container)
  - [Development Outside Dev Container](#no-dev-container)
  - [Starting a Dev Build](#dev-build)
- [License](#license)

## <a name="policies"></a>Policies

### <a name="issues"></a>Bug Reports / Feature Requests / Security Issues

To report bugs, request features, or report security issues in Treslibre, please open an issue at
<https://github.com/Treslibre/treslibre-desktop/issues>. For coordinated vulnerability disclosure,
see [SECURITY.md](SECURITY.md).

### <a name="contributions"></a>Contributions

Contributing to Treslibre for Desktop can be done via pull requests on GitHub. See
[CONTRIBUTING.md](CONTRIBUTING.md) for details.

## <a name="building"></a>Building

### <a name="requirements"></a>Requirements

- Node.js `22.17.0` (see `.nvmrc`) and `pnpm@11.15.1` (via Corepack)
- Python 3 with `distutils` / `setuptools` (for [`node-gyp`])
- C/C++ compiler toolchain (e.g., `build-essential` on Debian/Ubuntu, Xcode Command Line Tools on
  macOS, or Visual Studio Build Tools on Windows)
- Rust toolchain `1.94` (`rustup`) with target `wasm32-unknown-unknown`
- `wasm-bindgen-cli` (`0.2.114`), `wasm-opt` (`binaryen`), and `protoc` (Protocol Buffers compiler)

[`node-gyp`]: https://github.com/nodejs/node-gyp

#### macOS

Install Xcode Command Line Tools with `xcode-select --install` (or install [Xcode] and select
Command Line Tools in Preferences > Locations). See the [`node-gyp` macOS
notes][node-gyp_macos_catalina] if needed.

[xcode]: https://apps.apple.com/us/app/xcode/id497799835?mt=12
[node-gyp_macos_catalina]:
  https://github.com/nodejs/node-gyp/blob/master/macOS_Catalina.md#installing-node-gyp-using-the-xcode-command-line-tools-via-xcode-select---install

#### Windows

When building on Windows, clone the repository with [symlink support][win-symlinks] enabled:

1. [Enable Developer Mode][win-devmode].
2. Enable git symlink support globally (or pass `-c core.symlinks=true` to `git clone`):

```powershell
git config --global core.symlinks true
```

[win-symlinks]: https://blogs.windows.com/windowsdeveloper/2016/12/02/symlinks-windows-10/
[win-devmode]:
  https://learn.microsoft.com/en-us/windows/apps/get-started/enable-your-device-for-development

### <a name="install-dependencies"></a>Install Dependencies

Make sure you are using Node.js `22.17.0` (e.g., `nvm use`) and enable Corepack:

```bash
corepack enable
pnpm install
```

### <a name="build-libthreema"></a>Build libthreema

When building the project or starting it in dev mode, `@threema/libthreema-wasm` is built
automatically. To build it separately, run:

```bash
pnpm run build:packages:libthreema-wasm
```

### <a name="build-and-package"></a>Build and Package

Treslibre's primary self-hosted flavor is `work-onprem`:

```bash
pnpm run build:packages
pnpm run build:conferencing
pnpm run build:desktop:work-onprem
pnpm run dist:desktop:work-onprem
```

Unpacked application binaries are output to `build/apps/desktop/packaged/`. To create an
installer/package bundle in `build/out/`, run:

```bash
pnpm run package:desktop:work-onprem
```

On Windows PowerShell (which does not support inline `KEY=VAL` prefixes in `package.json` scripts),
set the Turbo build environment variables explicitly:

```powershell
$env:TURBO_BUILD_ENVIRONMENT = "onprem"
$env:TURBO_BUILD_VARIANT = "work"
pnpm --filter threema-desktop run build
pnpm --filter threema-desktop run dist
```

### <a name="testing-and-audits"></a>Testing & Audits

```bash
pnpm run lint
pnpm run test:desktop:mocha:work-onprem
bash scripts/audit-debrand.sh
```

## <a name="development"></a>Development

More developer documentation can be found under [docs/](./docs/).

### <a name="dev-container"></a>Dev Container

You can open the repository in a
[VS Code Dev Container](https://code.visualstudio.com/docs/devcontainers/create-dev-container) via
**Dev Containers: Reopen in Container** (or using `@devcontainers/cli`).

Limitations:

- `pnpm run package:*` commands that invoke Flatpak are not supported inside the container's
  security configuration.
- `pnpm run generate:desktop:icons:*` requires macOS tooling for `.icns` generation.

### <a name="no-dev-container"></a>Development Outside Dev Container

Use `.nvmrc` (`nvm use`) to match the required Node.js `22.17.0` runtime.

### <a name="dev-build"></a>Starting a Dev Build

To start a dev build with hot reloading, run:

```bash
pnpm run dev:desktop:work-onprem
```

## <a name="license"></a>License

Treslibre for Desktop (forked from Threema for Desktop) is licensed under the GNU Affero General
Public License v3.

    Modified 2026 by Treslibre Project (Treslibre), an independent fork of Threema.
    Original work: Copyright (c) Threema AG

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License, version 3,
    as published by the Free Software Foundation.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program. If not, see <https://www.gnu.org/licenses/>.

The full license text can be found in [`LICENSE.txt`](LICENSE.txt). Source code is available at
<https://github.com/Treslibre/treslibre-desktop>.
