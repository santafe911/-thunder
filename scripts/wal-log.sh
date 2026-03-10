#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   scripts/wal-log.sh "主题" "变化点" "影响范围"
# Example:
#   scripts/wal-log.sh "dashboard" "端口改为3456" "截图脚本与健康检查"

TOPIC="${1:-}"
CHANGE="${2:-}"
IMPACT="${3:-}"

if [[ -z "$TOPIC" || -z "$CHANGE" || -z "$IMPACT" ]]; then
  echo "用法: $0 <主题> <变化点> <影响范围>"
  exit 1
fi

STATE_FILE="/root/.openclaw/workspace/SESSION-STATE.md"
TS="$(date -u +"%Y-%m-%d %H:%M UTC")"
LINE="- ${TS} | ${TOPIC} | ${CHANGE} | 影响：${IMPACT}"

if [[ ! -f "$STATE_FILE" ]]; then
  cat > "$STATE_FILE" <<'EOF'
# SESSION-STATE.md

> 主会话工作内存（短期）

## Current Focus
- 

## Recent Decisions (WAL)

## Active Constraints
- 

## Next Actions
- [ ] 
EOF
fi

# Append under WAL section; fallback append to end.
if grep -q "^## Recent Decisions (WAL)" "$STATE_FILE"; then
  awk -v newLine="$LINE" '
    BEGIN{added=0}
    /^## Recent Decisions \(WAL\)/{print; print newLine; added=1; next}
    {print}
    END{if(!added) print newLine}
  ' "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
else
  printf "\n## Recent Decisions (WAL)\n%s\n" "$LINE" >> "$STATE_FILE"
fi

echo "已写入 WAL: $LINE"
