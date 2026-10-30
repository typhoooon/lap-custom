# Lap Custom (personal fork)

This branch is a personal, local-only fork of [julyx10/lap](https://github.com/julyx10/lap).
It keeps the upstream layouts and behavior intact and adds three independent
areas:

1. **Two extra grid layouts** (originals 0-3 are untouched)
   - Style 4 — *Balanced view*: an orientation-aware justified layout. Rows with
     mostly portrait photos get a taller target height, so portraits end up
     closer in visual area to landscapes.
   - Style 5 — *Enhanced masonry*: the original masonry column model plus
     optional landscape column spanning, packed with a skyline algorithm.
   - Parameters live in **Settings → Grid**. The grid-size slider still controls
     the base size.
2. **Thumbnail video previews**
   - Visible video thumbnails autoplay muted; off-screen previews pause.
   - Simultaneous previews is a number setting (default 8, `0` = no explicit
     cap). Autoplay still only starts thumbnails inside the viewport.
   - A toolbar button left of the filter toggles thumbnail autoplay globally;
     the Settings switch does the same.
   - Each hovered video gets a volume button aligned with the file menu. It
     hides with the menu while the pointer is away, but stays visible while
     that video is the audible one. A "single preview with sound" switch keeps
     only one audible by default; turn it off to let every unmuted visible
     preview play its own sound.
   - Per-file volume: the Settings value is the default, and moving a
     thumbnail's slider remembers that file's volume (keyed by library + file
     id, under the localStorage key `lap_custom_video_preview_volumes`), so a
     loud clip stays quiet next time.
   - The toolbar play/pause button pauses or resumes all thumbnail previews.
     While paused, individual thumbnails can still be started (and while
     playing, individual ones can be paused).
   - With autoplay on, the bottom-left duration badge becomes a play/pause
     button. It shows a live count-up or count-down timer (setting, default
     count-up) and expands on hover to reveal the total duration.
   - Preview looping is a setting.
   - Previews stop and release their decoders/audio when the album or view
     changes, when the image viewer window is open, and while an inline preview
     is fullscreen.
3. **Library password lock (frontend only)**
   - Set/change/remove a password from **Manage libraries** (new-library flow or
     the row context menu).
   - The password is checked when switching libraries and on app startup.
   - It is a deterrent for casual access, **not encryption**. It does not encrypt
     photos, and it can be bypassed by clearing the app's local storage. Lock
     records live under the localStorage key `lap_custom_library_locks`; delete
     that key to recover from a forgotten password.

---

## Build identity

| Setting | Value |
| :-- | :-- |
| `productName` | `Lap Custom` |
| `version` | `0.3.3-custom.4` |
| `identifier` | `dev.typhoon.lapcustom` |
| updater endpoints | none (auto-update check defaults off) |
| update artifacts | disabled |

Changing the identifier gives this build its own app-data/cache directory, so it
does not collide with an official Lap installation or update from it. Libraries
have to be added again in this build (the catalog is rebuilt).

## Frontend development

```bash
pnpm --dir src-vite install --frozen-lockfile
pnpm --dir src-vite dev          # or: cargo tauri dev (from the repo root)
pnpm --dir src-vite build
```

Fork tests:

```bash
cd src-vite
pnpm test:custom                 # layout + lock + preview + settings normalization
```

## Linux build

```bash
git submodule update --init --recursive
bash scripts/download_models.sh
bash scripts/download_ffmpeg_sidecar.sh linux x86_64
cargo tauri build
```

## Windows packaging (GitHub Actions, MSVC + MSI)

当前 Windows 安装包使用 GitHub Actions 的 Windows runner 构建 **MSI**，
和官方项目一致；`tauri.windows.conf.json` 会带上 `windows/vc-runtime.wxs` 的
VC++ 运行库最低版本检查。MSI 会包含 models、ffmpeg 和 ONNX Runtime DLL。

WiX 的 MSI ProductVersion 只接受数字版本，因此 `tauri.windows.conf.json` 里的
`bundle.windows.wix.version` 设为 `0.3.3.4`；应用版本仍是 `0.3.3-custom.4`，
安装包靠 productName `Lap Custom` 和 Release tag 与官方区分。

下面的本地交叉编译流程仅为历史记录，已不再作为主要构建方式。

Only the NSIS `-setup.exe` is cross-compilable; WiX `.msi` requires Windows.
This fork now builds MSI on the GitHub Actions Windows runner instead.

### One-time setup

```bash
# rustup with the MSVC target
rustup default stable
rustup target add x86_64-pc-windows-msvc

# cargo-xwin (installs to ~/.cargo/bin, which is not always on PATH)
cargo install --locked cargo-xwin
export PATH="$HOME/.cargo/bin:$PATH"

# NSIS (AUR): provides the Linux makensis binary
paru -S nsis
# verify
makensis -VERSION
```

`clang`, `lld-link`, `llvm-rc`, `cmake` and `ninja` are also required. On Arch:
`pacman -S clang lld llvm cmake ninja`.

### Project resources

```bash
git submodule update --init --recursive
bash scripts/download_models.sh
bash scripts/download_ffmpeg_sidecar.sh windows x86_64
pnpm --dir src-vite install --frozen-lockfile
```

### Build

From the repository root:

```bash
export PATH="$HOME/.cargo/bin:$PATH"
XWIN_ACCEPT_LICENSE=1 cargo tauri build \
  --runner cargo-xwin \
  --target x86_64-pc-windows-msvc \
  --bundles nsis
```

Artifact:

```text
src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/*-setup.exe
```

### Cross-build notes

- `build.rs` compiles LibRaw/libjpeg-turbo/libheif/libde265 with CMake and
  `cc`; cargo-xwin supplies the clang-cl toolchain and CMake toolchain file.
  The fork also passes the cargo-xwin toolchain file (`-DCMAKE_TOOLCHAIN_FILE`),
  a Unix install prefix, and `-G Ninja` for cross-Windows builds (native builds
  keep their existing generators), and disables libjpeg-turbo SIMD during cross
  builds so NASM is not required. If CMake still ignores the toolchain, force
  `CMAKE_GENERATOR=Ninja` and/or pass `-DCMAKE_TOOLCHAIN_FILE` explicitly for
  cross builds only.
- `ort` downloads the MSVC ONNX Runtime during the build. Verify that
  `onnxruntime.dll` ends up next to the executable and inside the NSIS bundle;
  if not, add it through `bundle.resources` and `ORT_DYLIB_PATH`.
- The NSIS payload needs the Microsoft VC++ runtime. Windows 10/11 usually has
  it, but a clean machine may need the VC++ 2015-2022 redistributable.
- Wine can unpack/inspect the installer, but the app itself needs WebView2 and
  a real Windows environment for a meaningful runtime test.
- The installer is unsigned, so SmartScreen will warn.

## Repository hygiene

- `main` mirrors upstream; this work lives on `feature/tuned-layouts-video-lock`.
- `upstream` push is disabled locally.
- Do not report fork-specific problems upstream or publish fork builds in the
  official release channels.
- License: GPL-3.0-or-later. Personal use is unrestricted; redistributing a
  binary requires providing the corresponding source under the same license.
