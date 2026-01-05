---
description: How to build the Windows installer for Bofo
---

# Build Windows Installer

This workflow creates an NSIS installer (.exe) for Windows distribution.

## Prerequisites

- Node.js installed
- All dependencies installed (`npm install`)

## Build Steps

// turbo-all

1. Clean previous build artifacts:
```powershell
Remove-Item -Recurse -Force "H:\Bofo\dist" -ErrorAction SilentlyContinue
```

2. Run the Windows build command:
```powershell
npm run dist:win
```

3. Wait for the build to complete. The output will be in `dist/`:
   - `Bofo Setup X.X.X.exe` - The NSIS installer
   - `win-unpacked/` - Unpacked application folder

## Output Location

After successful build, the installer will be at:
```
H:\Bofo\dist\Bofo Setup X.X.X.exe
```

## Version Updates

Before building a new release, update the version in `package.json`:
```json
{
  "version": "X.X.X"
}
```

## Troubleshooting

### If build fails with 7z extraction errors:
Clear the electron-builder cache:
```powershell
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\electron-builder\Cache" -ErrorAction SilentlyContinue
```

### Code Signing
Code signing is disabled. The config uses `signAndEditExecutable: false` to skip the winCodeSign download entirely.

## Notes

- The build creates an NSIS installer that allows users to choose installation directory
- Desktop and Start Menu shortcuts are created by default
- No code signing is performed (Windows SmartScreen may show a warning on first run)
