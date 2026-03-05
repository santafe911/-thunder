const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3456;
const BIND_HOST = process.env.DASHBOARD_BIND_HOST || '127.0.0.1';
const SESSIONS_DIR = process.env.OPENCLAW_SESSIONS_DIR || '/root/.openclaw/agents/main/sessions';
const HOURS_WINDOW = 24;

// ── Helpers ─────────────────────────────────────────────────────────

function getSessionFiles() {
  try {
    const files = fs.readdirSync(SESSIONS_DIR);
    return files
      .filter(f => f.endsWith('.jsonl') && !f.includes('.deleted') && !f.includes('.lock'))
      .map(f => path.join(SESSIONS_DIR, f))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  } catch (e) {
    console.error('Error reading sessions dir:', e.message);
    return [];
  }
}

function parseJSONL(filePath, since) {
  const records = [];
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    const lines = data.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const obj = JSON.parse(trimmed);
        const ts = obj.timestamp ? new Date(obj.timestamp).getTime() : 0;
        if (ts >= since) {
          records.push(obj);
        }
      } catch (_) { /* skip malformed lines */ }
    }
  } catch (e) {
    console.error('Error reading file:', filePath, e.message);
  }
  return records;
}

function loadRecords() {
  const since = Date.now() - HOURS_WINDOW * 60 * 60 * 1000;
  const files = getSessionFiles();
  let allRecords = [];
  for (const f of files) {
    allRecords = allRecords.concat(parseJSONL(f, since));
  }
  // Sort by timestamp ascending
  allRecords.sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    return ta - tb;
  });
  return allRecords;
}

// ── Build Activities ────────────────────────────────────────────────

// Patterns to classify internal/ops activities
const INTERNAL_PATTERNS = [
  /dashboard\/server\.js/i,
  /dashboard\/screenshot\.js/i,
  /localhost:3456/i,
  /127\.0\.0\.1:3456/i,
  /systemctl.*dashboard/i,
  /lsof.*:3456/i,
  /pkill.*dashboard/i,
  /nohup.*server\.js/i,
  /curl.*\/api\/(stats|activities|system)/i,
  /dashboard\.log/i,
  /Screenshot saved/i,
  /小果子监控看板 running/i,
];

function isInternalActivity(text) {
  if (!text) return false;
  return INTERNAL_PATTERNS.some(p => p.test(text));
}

function buildActivities(records) {
  const activities = [];

  for (const rec of records) {
    const ts = rec.timestamp;
    const recType = rec.type;

    if (recType === 'message') {
      const msg = rec.message || {};
      const role = msg.role;
      const content = msg.content;

      if (role === 'user') {
        let text = '';
        if (Array.isArray(content)) {
          for (const c of content) {
            if (c.type === 'text') { text += c.text; break; }
          }
        } else if (typeof content === 'string') {
          text = content;
        }
        activities.push({
          type: 'user_message',
          timestamp: ts,
          summary: truncate(text, 200),
          model: null,
          usage: null
        });
      } else if (role === 'assistant') {
        // Could contain text, toolCall, thinking
        let text = '';
        const toolCalls = [];
        let hasText = false;

        if (Array.isArray(content)) {
          for (const c of content) {
            if (c.type === 'text') {
              text += c.text;
              hasText = true;
            } else if (c.type === 'toolCall') {
              toolCalls.push({
                name: c.name,
                id: c.id,
                args: summarizeArgs(c.arguments)
              });
            }
          }
        }

        const usage = msg.usage || null;
        const model = msg.model || null;
        const provider = msg.provider || null;

        if (hasText) {
          activities.push({
            type: 'assistant_message',
            timestamp: ts,
            summary: truncate(text, 200),
            model: model,
            provider: provider,
            usage: usage
          });
        }

        for (const tc of toolCalls) {
          const tcSummary = tc.args;
          activities.push({
            type: 'tool_call',
            timestamp: ts,
            toolName: tc.name,
            toolId: tc.id,
            summary: tcSummary,
            model: model,
            provider: provider,
            usage: toolCalls.indexOf(tc) === 0 && !hasText ? usage : null,
            internal: isInternalActivity(tcSummary) || isInternalActivity(tc.name === 'process' ? tcSummary : '')
          });
        }

        // If only tool calls and no text, and usage exists, attach usage to first
        if (!hasText && toolCalls.length > 0 && usage) {
          // Already handled above
        }

        // If no text and no tool calls but usage exists (edge case)
        if (!hasText && toolCalls.length === 0 && usage) {
          activities.push({
            type: 'assistant_message',
            timestamp: ts,
            summary: '(empty response)',
            model: model,
            provider: provider,
            usage: usage
          });
        }

      } else if (role === 'toolResult') {
        const isError = msg.isError || false;
        const toolName = msg.toolName || 'unknown';
        let resultText = '';
        if (Array.isArray(msg.content)) {
          for (const c of msg.content) {
            if (c.type === 'text') { resultText += c.text; break; }
          }
        } else if (typeof msg.content === 'string') {
          resultText = msg.content;
        }
        activities.push({
          type: isError ? 'error' : 'tool_result',
          timestamp: ts,
          toolName: toolName,
          summary: truncate(resultText, 200),
          isError: isError
        });
      }

    } else if (recType === 'model_change') {
      activities.push({
        type: 'system',
        timestamp: ts,
        summary: `模型切换: ${rec.provider || ''}/${rec.modelId || ''}`
      });

    } else if (recType === 'thinking_level_change') {
      activities.push({
        type: 'system',
        timestamp: ts,
        summary: `思考级别切换: ${rec.thinkingLevel || 'unknown'}`
      });

    } else if (recType === 'session') {
      activities.push({
        type: 'system',
        timestamp: ts,
        summary: `会话开始 (${rec.id ? rec.id.substring(0, 8) : 'N/A'})`
      });

    } else if (recType === 'custom') {
      const customType = rec.customType || 'custom';
      if (customType === 'model-snapshot') {
        // Skip model snapshots - they duplicate model_change
        continue;
      }
      activities.push({
        type: 'system',
        timestamp: ts,
        summary: `${customType}: ${JSON.stringify(rec.data || {}).substring(0, 100)}`
      });

    } else if (recType === 'compaction') {
      activities.push({
        type: 'system',
        timestamp: ts,
        summary: '上下文压缩'
      });
    }
  }

  return activities;
}

// ── Build Stats ─────────────────────────────────────────────────────

function buildStats(records) {
  let totalInput = 0, totalOutput = 0, totalCacheRead = 0, totalCacheWrite = 0, totalTokens = 0;
  let totalCost = 0;
  let userMessages = 0, assistantMessages = 0;
  let toolCalls = 0;
  const toolUsage = {};
  const hourlyTokens = {};
  let earliestTs = null, latestTs = null;
  const models = {};

  for (const rec of records) {
    if (rec.type !== 'message') continue;
    const msg = rec.message || {};
    const role = msg.role;
    const ts = rec.timestamp;

    if (role === 'user') {
      userMessages++;
    } else if (role === 'assistant') {
      assistantMessages++;

      // Count tool calls
      const content = msg.content || [];
      if (Array.isArray(content)) {
        for (const c of content) {
          if (c.type === 'toolCall') {
            toolCalls++;
            const name = c.name || 'unknown';
            toolUsage[name] = (toolUsage[name] || 0) + 1;
          }
        }
      }

      // Accumulate usage
      const usage = msg.usage;
      if (usage) {
        totalInput += usage.input || 0;
        totalOutput += usage.output || 0;
        totalCacheRead += usage.cacheRead || 0;
        totalCacheWrite += usage.cacheWrite || 0;
        totalTokens += usage.totalTokens || 0;
        if (usage.cost) {
          totalCost += usage.cost.total || 0;
        }

        // Hourly buckets (GMT+8)
        const d = new Date(ts);
        const gmt8 = new Date(d.getTime() + 8 * 60 * 60 * 1000);
        const hourKey = gmt8.toISOString().substring(0, 13); // YYYY-MM-DDTHH
        hourlyTokens[hourKey] = (hourlyTokens[hourKey] || 0) + (usage.totalTokens || 0);
      }

      // Model tracking
      const model = msg.model || 'unknown';
      models[model] = (models[model] || 0) + 1;
    }

    // Track time range
    const tsMs = new Date(ts).getTime();
    if (!earliestTs || tsMs < earliestTs) earliestTs = tsMs;
    if (!latestTs || tsMs > latestTs) latestTs = tsMs;
  }

  // Sort tool usage
  const toolUsageSorted = Object.entries(toolUsage)
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count }));

  // Sort hourly tokens
  const hourlyTokensSorted = Object.entries(hourlyTokens)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([hour, tokens]) => ({ hour, tokens }));

  return {
    tokens: {
      input: totalInput,
      output: totalOutput,
      cacheRead: totalCacheRead,
      cacheWrite: totalCacheWrite,
      total: totalTokens,
      cost: totalCost
    },
    messages: {
      user: userMessages,
      assistant: assistantMessages,
      total: userMessages + assistantMessages
    },
    toolCalls: {
      total: toolCalls,
      byTool: toolUsageSorted
    },
    timeRange: {
      earliest: earliestTs ? new Date(earliestTs).toISOString() : null,
      latest: latestTs ? new Date(latestTs).toISOString() : null
    },
    hourlyTokens: hourlyTokensSorted,
    models: models
  };
}

// ── Utility ─────────────────────────────────────────────────────────

function truncate(str, maxLen) {
  if (!str) return '';
  str = str.replace(/\n/g, ' ').trim();
  if (str.length > maxLen) return str.substring(0, maxLen) + '…';
  return str;
}

function summarizeArgs(args) {
  if (!args) return '';
  if (typeof args === 'string') return truncate(args, 120);
  // Show key fields
  const keys = Object.keys(args);
  const parts = [];
  for (const k of keys.slice(0, 3)) {
    let v = args[k];
    if (typeof v === 'string') v = truncate(v, 60);
    else if (typeof v === 'object') v = '{…}';
    parts.push(`${k}: ${v}`);
  }
  if (keys.length > 3) parts.push('…');
  return parts.join(', ');
}

// ── System Metrics ──────────────────────────────────────────────────

const { execSync } = require('child_process');
const os = require('os');

function getSystemMetrics() {
  // CPU
  const cpus = os.cpus();
  const cpuCount = cpus.length;
  const cpuModel = cpus[0]?.model || 'Unknown';

  // CPU usage via /proc/stat snapshot
  let cpuUsage = 0;
  try {
    const out = execSync("top -bn1 | head -3 | grep '%Cpu'", { encoding: 'utf-8', timeout: 3000 });
    // %Cpu(s):  2.0 us,  1.0 sy,  0.0 ni, 96.5 id, ...
    const match = out.match(/([\d.]+)\s*id/);
    if (match) cpuUsage = Math.round((100 - parseFloat(match[1])) * 10) / 10;
  } catch (_) {
    // fallback: os.loadavg
    const load1 = os.loadavg()[0];
    cpuUsage = Math.round((load1 / cpuCount) * 100 * 10) / 10;
  }
  const loadAvg = os.loadavg();

  // Memory
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  let memDetail = { total: totalMem, free: freeMem, used: usedMem, available: freeMem, buffers: 0, cached: 0 };
  try {
    const meminfo = fs.readFileSync('/proc/meminfo', 'utf-8');
    const get = (key) => {
      const m = meminfo.match(new RegExp(`${key}:\\s+(\\d+)`));
      return m ? parseInt(m[1]) * 1024 : 0;
    };
    memDetail = {
      total: get('MemTotal'),
      free: get('MemFree'),
      available: get('MemAvailable'),
      buffers: get('Buffers'),
      cached: get('Cached'),
      used: get('MemTotal') - get('MemAvailable')
    };
  } catch (_) {}

  // Disk
  let disks = [];
  try {
    const dfOut = execSync("df -B1 / /root 2>/dev/null | tail -n +2", { encoding: 'utf-8', timeout: 3000 });
    const seen = new Set();
    for (const line of dfOut.trim().split('\n')) {
      const parts = line.split(/\s+/);
      if (parts.length >= 6 && !seen.has(parts[0])) {
        seen.add(parts[0]);
        disks.push({
          filesystem: parts[0],
          total: parseInt(parts[1]),
          used: parseInt(parts[2]),
          available: parseInt(parts[3]),
          usagePercent: parseInt(parts[4]),
          mountPoint: parts[5]
        });
      }
    }
  } catch (_) {}

  // Uptime
  const uptimeSec = os.uptime();

  // Processes (top 5 by CPU)
  let topProcesses = [];
  try {
    const psOut = execSync("ps aux --sort=-%cpu | head -6 | tail -5", { encoding: 'utf-8', timeout: 3000 });
    for (const line of psOut.trim().split('\n')) {
      const parts = line.split(/\s+/);
      if (parts.length >= 11) {
        topProcesses.push({
          user: parts[0],
          cpu: parseFloat(parts[2]),
          mem: parseFloat(parts[3]),
          command: parts.slice(10).join(' ').substring(0, 60)
        });
      }
    }
  } catch (_) {}

  return {
    cpu: {
      model: cpuModel,
      cores: cpuCount,
      usage: cpuUsage,
      loadAvg: { '1m': loadAvg[0], '5m': loadAvg[1], '15m': loadAvg[2] }
    },
    memory: {
      total: memDetail.total,
      used: memDetail.used,
      free: memDetail.free || memDetail.total - memDetail.used,
      available: memDetail.available,
      buffers: memDetail.buffers,
      cached: memDetail.cached,
      usagePercent: Math.round((memDetail.used / memDetail.total) * 1000) / 10
    },
    disk: disks,
    uptime: uptimeSec,
    hostname: os.hostname(),
    platform: `${os.type()} ${os.release()}`,
    topProcesses: topProcesses
  };
}

// ── HTTP Server ─────────────────────────────────────────────────────

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  if (pathname === '/api/activities') {
    const records = loadRecords();
    const activities = buildActivities(records);
    const showInternal = url.searchParams.get('internal') === '1';
    const filtered = showInternal ? activities : activities.filter(a => !a.internal);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(filtered));
  }

  if (pathname === '/api/stats') {
    const records = loadRecords();
    const stats = buildStats(records);
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(stats));
  }

  if (pathname === '/api/system') {
    const metrics = getSystemMetrics();
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    return res.end(JSON.stringify(metrics));
  }

  if (pathname === '/mario') {
    const gamePath = path.join(__dirname, '../games/super-mario/index.html');
    try {
      const html = fs.readFileSync(gamePath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('Error loading mario game: ' + e.message);
    }
  }

  if (pathname === '/' || pathname === '/index.html') {
    const htmlPath = path.join(__dirname, 'index.html');
    try {
      const html = fs.readFileSync(htmlPath, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('Error loading index.html');
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, BIND_HOST, () => {
  console.log(`🍏 小果子监控看板 running at http://${BIND_HOST}:${PORT}`);
  console.log(`   Sessions dir: ${SESSIONS_DIR}`);
  console.log(`   Time window: ${HOURS_WINDOW}h`);
});
