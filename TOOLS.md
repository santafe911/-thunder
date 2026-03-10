# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Quick Ops

### WAL 快捷记录

```bash
/root/.openclaw/workspace/scripts/wal-log.sh "主题" "变化点" "影响范围"
```

示例：

```bash
/root/.openclaw/workspace/scripts/wal-log.sh "dashboard" "截图任务改为09:00" "影响每日简报"
```

会自动把记录写入 `SESSION-STATE.md` 的 `Recent Decisions (WAL)` 区块。

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.
