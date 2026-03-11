#!/usr/bin/env bash
# Nightly Security Audit (fixed, safe, read-only)
set -euo pipefail

host=$(hostname)
ts=$(date -u '+%Y-%m-%d %H:%M:%S UTC')

echo "=== Nightly Security Audit ==="
echo "Time: $ts"
echo "Host: $host"
echo

echo "[SYSTEM]"
uname -a
echo

echo "[SSH BRUTE-FORCE SCAN]"
auth_sources=()
for f in /var/log/secure /var/log/auth.log; do
  [[ -f "$f" ]] && auth_sources+=("$f")
done
if [[ ${#auth_sources[@]} -eq 0 ]]; then
  echo "No auth log found (/var/log/secure or /var/log/auth.log)."
else
  grep -hEi 'Failed password|Invalid user|authentication failure|Disconnected from invalid user|Connection closed by authenticating user' "${auth_sources[@]}" 2>/dev/null | tail -n 200 || true
fi
echo

echo "[SSHD WARNINGS/ERRORS]"
if command -v journalctl >/dev/null 2>&1; then
  journalctl -u sshd -u ssh --since '24 hours ago' --no-pager 2>/dev/null | tail -n 200 || true
else
  echo "journalctl not available."
fi
echo

echo "[LISTENING PORTS]"
if command -v ss >/dev/null 2>&1; then
  ss -tulpn || true
elif command -v netstat >/dev/null 2>&1; then
  netstat -tulpn 2>/dev/null || true
else
  echo "Neither ss nor netstat available."
fi
echo

echo "[FIREWALL]"
if command -v ufw >/dev/null 2>&1; then
  ufw status verbose || true
elif command -v firewall-cmd >/dev/null 2>&1; then
  firewall-cmd --state 2>/dev/null || true
  firewall-cmd --list-all 2>/dev/null || true
elif command -v iptables >/dev/null 2>&1; then
  iptables -S || true
else
  echo "No supported firewall tool found."
fi
echo

echo "[FAIL2BAN]"
if command -v fail2ban-client >/dev/null 2>&1; then
  fail2ban-client status 2>/dev/null || true
else
  echo "fail2ban-client not installed."
fi
echo

echo "[RECENT SUDO]"
if [[ -f /var/log/secure ]]; then
  grep -i 'sudo' /var/log/secure | tail -n 100 || true
elif [[ -f /var/log/auth.log ]]; then
  grep -i 'sudo' /var/log/auth.log | tail -n 100 || true
else
  echo "No auth log found for sudo scan."
fi
echo

echo "[OPENCLAW PROCESSES]"
ps -ef | grep -Ei 'openclaw|gateway' | grep -v grep || true
echo

echo "[PERMISSIONS]"
for p in "$HOME/.openclaw" "$HOME/.openclaw/workspace"; do
  [[ -e "$p" ]] && ls -ld "$p"
done
echo

echo "[WORLD-WRITABLE UNDER ~/.openclaw]"
find "$HOME/.openclaw" -xdev \( -type f -o -type d \) -perm -0002 -print 2>/dev/null | head -n 200 || true
echo

echo "[PACKAGE UPDATE SUMMARY]"
if command -v dnf >/dev/null 2>&1; then
  dnf check-update 2>/dev/null | tail -n 200 || true
elif command -v apt >/dev/null 2>&1; then
  apt list --upgradable 2>/dev/null | tail -n 200 || true
else
  echo "No supported package manager found."
fi
echo

echo "[DISK USAGE]"
df -h
echo

echo "[PERSISTENCE CHECK]"
echo "-- systemd services (enabled) --"
systemctl list-unit-files --type=service --state=enabled 2>/dev/null | tail -n 200 || true
echo "-- user crontab --"
crontab -l 2>/dev/null || echo "No user crontab."
echo "-- /etc/cron* --"
find /etc/cron* -maxdepth 2 -type f 2>/dev/null | sort | tail -n 200 || true
echo

echo "[LAST LOGINS]"
last -a | head -n 50 || true
echo

echo "[RECENT CONNECTIONS]"
if command -v ss >/dev/null 2>&1; then
  ss -tpn state established '( sport != :ssh and dport != :ssh )' 2>/dev/null || true
fi
echo

echo "=== End of Audit ==="