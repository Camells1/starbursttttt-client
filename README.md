# Starbursttttt Client

A Minecraft launcher with Modrinth + CurseForge mod search, kinetic-type UI, an animated starfield, and a custom in-game home screen. Blue, purple and yellow.

## Play (Windows)

1. Download `StarburstClient-Setup-1.0.0.exe` from the [Releases](../../releases) page and run it. Pick an install folder; it adds a desktop and Start menu shortcut.
   (Prefer no install? `StarburstClient-win.zip` is a portable copy: unzip and run `Starbursttttt Client.exe`.)
2. Open Starbursttttt Client from the shortcut.
3. Pick an instance on **Play** and hit the big button. First launch downloads Minecraft, Fabric and Java if you don't have it, so give it a few minutes. Later launches reuse the downloaded files.

Offline username is under **Settings**. You can also sign in with Microsoft there.

### Updates

The installed app checks GitHub releases on startup, downloads new versions in the background and installs them by itself (it waits if a game is running). Just keep it open for a few seconds after launching.

## Run from source

Needs [Node.js](https://nodejs.org) 20+.

```bash
cd launcher
npm install
npm start
```

## Features

- Versions: 1.8 (vanilla), 1.21.11, 26.1, 26.2 (Fabric), plus any other release from the Library page.
- Modrinth search and one-click install with required dependencies. CurseForge search needs a free API key (Settings).
- Import mods and data from an existing Minecraft, Prism, Modrinth App, CurseForge or ATLauncher folder, or import `.mrpack` / CurseForge modpack zips.
- Fabric instances on 1.21.11 and 26.x come with the Starbursttttt home screen mod and Fabric API preinstalled.
- Picks (or downloads) the right Java for each Minecraft version.
- Servers, options and worlds live per instance.

## Repo layout

| Folder | What |
| --- | --- |
| `launcher/` | Electron app |
| `mod/` | Fabric home-screen mod for 1.21.11 (yarn mappings) |
| `mod26/` | Fabric home-screen mod for 26.x (Mojang names, Java 25) |

Build a mod with `./gradlew build` inside its folder, then copy the jar into `launcher/resources/`.

## Status

The launcher, first-run setup and theme are tested in the packaged app. The in-game home screen under this name, 1.8, 26.1, 26.2, Microsoft login, modpack import, CurseForge and the auto-updater itself (it needs a newer release than the one installed to do anything) are untested.
