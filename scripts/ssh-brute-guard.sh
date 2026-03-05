#!/usr/bin/env bash
# ============================================================
# SSH 防爆破守卫（增强版）
# 1) 实时速率限制（iptables recent）
# 2) 日志回溯封禁（失败次数阈值）
# 兼容 OpenCloudOS / 无 fail2ban 场景
# ============================================================
set -euo pipefail

MAX_FAILURES=8                 # 24h 内失败次数阈值（回溯封禁）
BAN_CHAIN="SSH_BANNED"         # 封禁链
GUARD_CHAIN="SSH_GUARD"        # 速率限制链
WHITELIST="127.0.0.1"          # 白名单 IP（空格分隔）
LOG_FILE="/tmp/openclaw/ssh-brute-guard.log"

mkdir -p /tmp/openclaw
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"; }

ipt() { /sbin/iptables "$@"; }
rule_exists() { ipt -C "$@" >/dev/null 2>&1; }

# 1) 确保链存在
ipt -L "$BAN_CHAIN" -n >/dev/null 2>&1 || { ipt -N "$BAN_CHAIN"; log "创建链: $BAN_CHAIN"; }
ipt -L "$GUARD_CHAIN" -n >/dev/null 2>&1 || { ipt -N "$GUARD_CHAIN"; log "创建链: $GUARD_CHAIN"; }

# 2) 确保 INPUT 挂链顺序（先速率限制，再黑名单）
rule_exists INPUT -p tcp --dport 22 -j "$GUARD_CHAIN" || ipt -I INPUT 1 -p tcp --dport 22 -j "$GUARD_CHAIN"
rule_exists INPUT -p tcp --dport 22 -j "$BAN_CHAIN"   || ipt -I INPUT 2 -p tcp --dport 22 -j "$BAN_CHAIN"

# 3) 重建 GUARD_CHAIN 规则（保证幂等）
ipt -F "$GUARD_CHAIN"

# 白名单放行
for ip in $WHITELIST; do
  ipt -A "$GUARD_CHAIN" -s "$ip" -j RETURN
done

# 已建立连接放行
ipt -A "$GUARD_CHAIN" -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN

# 60 秒内新连接超过 12 次则丢弃（抑制爆破洪水）
ipt -A "$GUARD_CHAIN" -m conntrack --ctstate NEW -m recent --name SSH --update --seconds 60 --hitcount 12 -j DROP
# 记录新连接来源
ipt -A "$GUARD_CHAIN" -m conntrack --ctstate NEW -m recent --name SSH --set -j RETURN
# 兜底
ipt -A "$GUARD_CHAIN" -j RETURN

# 4) 日志回溯封禁（24h）
log "扫描 SSH 失败日志（24h）..."
declare -A FAIL_IPS
while IFS= read -r line; do
  ip=$(echo "$line" | awk '{print $1}')
  count=$(echo "$line" | awk '{print $2}')
  [ -n "$ip" ] && FAIL_IPS["$ip"]="$count"
done < <(
  journalctl -u sshd --since "24 hours ago" 2>/dev/null | \
  grep -E "Failed password|Invalid user" | \
  awk '{for(i=1;i<=NF;i++) if($i=="from") print $(i+1)}' | \
  sort | uniq -c | sort -rn | awk '{print $2, $1}'
)

BANNED_IPS=$(ipt -L "$BAN_CHAIN" -n 2>/dev/null | awk '/DROP/{print $4}' || true)
NEW_BANS=0
for ip in "${!FAIL_IPS[@]}"; do
  count="${FAIL_IPS[$ip]}"
  echo "$WHITELIST" | grep -qw "$ip" && continue
  if [ "$count" -ge "$MAX_FAILURES" ]; then
    if ! echo "$BANNED_IPS" | grep -qw "$ip"; then
      ipt -A "$BAN_CHAIN" -s "$ip" -j DROP
      log "🚫 封禁: $ip (24h失败 ${count} 次)"
      ((NEW_BANS++)) || true
    fi
  fi
done

CURRENT_BANNED=$(ipt -L "$BAN_CHAIN" -n 2>/dev/null | awk '/DROP/{c++} END{print c+0}')
log "完成: 新封禁 ${NEW_BANS} 个IP, 累计封禁 ${CURRENT_BANNED} 个IP"

echo "SSH防爆破(增强): 新封禁 ${NEW_BANS}, 累计封禁 ${CURRENT_BANNED}"