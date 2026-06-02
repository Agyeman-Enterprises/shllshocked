# SHLLSHOCKD

**Windows commands for people who have work to do.**

SHLLSHOCKD is a desktop app that makes PowerShell accessible. 173 pre-built commands. Plain English. No scripting required.

![SHLLSHOCKD](assets/icon.png)

---

## What You Get

### 173 Commands
Across 19 categories: Privacy, Speed, Storage, Network, Power, Security, Apps, Display, Audio, Files, Recovery, Printers, Productivity, Gaming, Time, Boot, Startup, Nuclear Options, and more.

### Plain English Discovery
- Type what you want to do, not PowerShell syntax
- Fuzzy search matches aliases and descriptions
- Three execution modes: Standard (just run it), Guided (explain first), Expert (show the function name)

### Offline-Capable
- Everything runs locally
- No cloud sync, no tracking
- Works without internet

### 13-Chapter Guide
"Plain English PowerShell" — explains the 173 commands in context, with before/after examples.

### Modern UI
- Dark theme, minimal
- Keyboard shortcuts (Ctrl+F to search, Escape to close modals)
- Accessibility: ARIA labels, semantic HTML, keyboard navigation

---

## Download

**[v1.0.0 Release](https://github.com/Agyeman-Enterprises/shllshocked/releases/tag/v1.0.0)**

- **SHLLSHOCKD Setup 1.0.0.exe** — Windows installer (74 MB)
- **SHLLSHOCKD-portable.exe** — Standalone executable (74 MB)

### System Requirements
- Windows 10/11 (64-bit)
- 100 MB disk space
- PowerShell 5.0+ (included with Windows 10+)

---

## Pro Features ($49 one-time)

### Community
- **Vote on commands** — See which ones other users find most useful
- **Submit your own** — Share the PowerShell commands you wish existed
- **Public queue** — Watch community submissions reach 10 votes → automatic approval

### Monetization & Philosophy

SHLLSHOCKD is open source on GitHub. The Pro license validates **locally on your machine** and doesn't require the internet.

You can:
- Build from source (`npm install && npm run dev`)
- Modify the code freely
- Skip the license check if you want

**If you find value in SHLLSHOCKD, buying a Pro license funds development, hosting, and updates.** It's a voluntary support mechanism for indie software.

Most users pay. Some don't. That's okay. We built this for people who care about their tools working well — and most of those people support the work that goes into it.

---

## Architecture

**Frontend:**
- React 18 + Vite
- Tailwind CSS 4
- Zustand for state

**Desktop:**
- Electron 28
- Frameless, custom titlebar
- Cross-platform ready (currently Windows only)

**Backend:**
- PowerShell 7 module (SHLLSHOCKD.psm1)
- 161 user-facing functions
- Registry-driven architecture (173 commands in registry.json)
- Persistent session pattern: ~50ms per command execution

**Licensing:**
- HMAC-SHA256 key validation
- No server calls required
- Offline activation
- One-time $49 purchase

**Data:**
- All local (no cloud)
- JSON registry
- Submissions stored in userData/submissions.json
- License stored in userData/license.json

---

## Getting Started

### Installation
1. Download the installer from the [v1.0.0 release](https://github.com/Agyeman-Enterprises/shllshocked/releases/tag/v1.0.0)
2. Run `SHLLSHOCKD Setup 1.0.0.exe`
3. Accept UAC prompts (needed for admin commands)
4. Launch from Start menu or desktop shortcut

### Development

```bash
# Install dependencies
npm install

# Run dev server
npm run dev

# Build for production
npm run build

# Create installer
npm run dist
```

The dev server runs on http://localhost:5173 and Electron loads it automatically.

---

## Commands

All 173 commands live in `registry.json`. Each command includes:
- Plain English purpose
- Aliases (how users discover it)
- Risk level (low/medium/high/destructive)
- Admin requirement flag
- Before/after context
- PowerShell function name

**Example:**
```json
{
  "id": "privacy.what_windows_knows",
  "publicCommand": "Show what Windows knows about me",
  "aliases": ["what data does windows store", "show my telemetry"],
  "category": "Privacy & Tracking",
  "riskLevel": "low",
  "requiresAdmin": false,
  "beforeRunMessage": "Reading your privacy data. Nothing will be changed.",
  "afterRunMessage": "Here is what Windows has been storing about you.",
  "psFunction": "what-windows-knows"
}
```

---

## Book

`C:\dev\shllshocked-ps\book\chapters\` contains 13 markdown chapters:
1. Windows Is Watching
2. Why Is This Thing So Slow
3. Where Did My Space Go
4. Your WiFi Has Secrets
5. Stop Waking Up My Computer
6. Your Passwords Are In Here
7. 50 Apps You Never Installed
8. Make It Look Like Yours
9. The File Cabinet
10. When Things Break
11. The Hidden Gems
12. The Nuclear Options
13. The Digital Moving Van

Each chapter is an 8-field entry format with emoji, risk badge, and [ADMIN] tags.

---

## Contributing

Community is built into SHLLSHOCKD. Submit your own commands via the **Community → Submit** tab. Votes from other users help prioritize what gets added to future releases.

For code contributions, please open a PR. The codebase follows these patterns:
- React components in `src/components/`
- PowerShell functions in `SHLLSHOCKD.psm1`
- Commands in `registry.json`

---

## License

MIT License. You can use, modify, and distribute SHLLSHOCKD freely. See [LICENSE](LICENSE) file.

---

## Support

- **GitHub Issues:** Report bugs or suggest commands
- **Discussions:** Ideas and feedback
- **Pro License:** Email support (coming soon)

---

## Changelog

See [RELEASES.md](RELEASES.md) for version history.

---

## Credits

**Built by:** Agyeman Enterprises

**Tech Stack:**
- Electron 28
- React 18
- Vite 5
- Tailwind CSS 4
- PowerShell 7

**Icon:** Neon lightning bolt (designed for speed and power)

---

**Windows commands for people who have work to do.**

[Download v1.0.0](https://github.com/Agyeman-Enterprises/shllshocked/releases/tag/v1.0.0) | [GitHub](https://github.com/Agyeman-Enterprises/shllshocked) | [Upgrade to Pro ($49)](https://shllshockd.com)
