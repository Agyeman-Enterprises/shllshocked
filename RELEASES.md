# SHLLSHOCKD Releases

## [v1.0.0] - 2026-06-02

**Initial Release**

The complete SHLLSHOCKD application: a Windows command assistant that makes PowerShell accessible to everyone.

### Features

**Core App:**
- 173 pre-built PowerShell commands across 19 categories
- Plain-English command discovery with fuzzy search
- Three execution modes: Standard, Guided, Expert
- Admin privilege routing with UAC prompts
- Offline-capable (no internet required)
- Dark theme, minimal UI

**Community (Pro):**
- Vote on community-submitted commands
- Submit your own "pet peeves" commands
- Automatic approval at 10 votes
- Public command queue with voting visibility

**Monetization:**
- One-time $49 Pro license (no subscriptions)
- HMAC-based license key validation
- Perpetual offline license activation
- Community features locked behind Pro

**Content:**
- 13-chapter book: "Plain English PowerShell"
- Each command includes before/after context
- Risk levels: low, medium, high, destructive
- Admin-required badges for dangerous commands

### Downloads

- **SHLLSHOCKD Setup 1.0.0.exe** (74 MB) - Windows installer with Start menu shortcuts
- **SHLLSHOCKD-portable.exe** (74 MB) - Standalone executable, no installation needed

### System Requirements

- Windows 10 or later (64-bit)
- 100 MB disk space
- PowerShell 5.0+ (included with Windows 10+)

### What's New

- ✨ 173 commands covering Windows system administration
- 👥 Community submission and voting system
- 💳 License-based Pro features
- 📖 Comprehensive PowerShell guide book
- 🎨 Dark, modern UI with keyboard shortcuts
- ⚡ Persistent PowerShell session (~50ms command execution)
- 🔐 Elevation routing with UAC prompts

### Known Limitations

- Windows only (Electron/NSIS installer)
- Requires PowerShell 5.0+
- Community features require Pro license
- No auto-update mechanism (manual version checks)

### Architecture

- **Frontend**: React 18 + Vite, Tailwind CSS 4
- **Desktop**: Electron 28
- **Backend**: PowerShell 7, 161 custom functions
- **License**: HMAC-SHA256 validation
- **Data**: Local JSON registry (no cloud)

---

**Checksums:**
- SHLLSHOCKD Setup 1.0.0.exe: `[SHA256 hash will be generated]`
- SHLLSHOCKD-portable.exe: `[SHA256 hash will be generated]`

**Installation Instructions:**

1. Download `SHLLSHOCKD Setup 1.0.0.exe`
2. Run the installer
3. Accept UAC prompt (may appear during first launch for admin commands)
4. Launch from Start menu or desktop shortcut

**For Portable Version:**
- Download `SHLLSHOCKD-portable.exe`
- Run directly (no installation)
- Works from any location

---

## Upgrade to Pro

Unlock community voting, command submissions, and priority support.

**$49 one-time payment** - No subscriptions, no recurring charges.

After purchase, receive your license key via email. Paste it in **License Settings** within the app to activate.

---

**Repository:** https://github.com/Agyeman-Enterprises/shllshocked
**Author:** Agyeman Enterprises
**License:** MIT
