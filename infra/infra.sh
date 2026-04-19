#!/bin/sh
set -eu

OUT="/usr/share/nginx/html/__infra.json"
STATE="/tmp/infra_cpu_state"
APP_STATE="/tmp/infra_app_started_at_utc"

now_ms() {
  # Busybox date supports %s. Millis best-effort.
  echo "$(date +%s)000"
}

read_first_token() {
  # $1 = file path
  awk 'NR==1{print $1; exit}' "$1"
}

read_key_value() {
  # $1 file, $2 key
  awk -v k="$2" '$1==k{print $2; exit}' "$1"
}

uptime_seconds() {
  if [ -r /proc/uptime ]; then
    awk '{print $1}' /proc/uptime
  else
    echo "0"
  fi
}

cgroup_v2_cpu_usage_us() {
  # cpu.stat usage_usec
  if [ -r /sys/fs/cgroup/cpu.stat ]; then
    read_key_value /sys/fs/cgroup/cpu.stat "usage_usec"
  else
    echo ""
  fi
}

cgroup_v2_cpu_max() {
  # cpu.max: "<quota> <period>" or "max <period>"
  if [ -r /sys/fs/cgroup/cpu.max ]; then
    cat /sys/fs/cgroup/cpu.max
  else
    echo ""
  fi
}

cpu_percent() {
  usage_us="$(cgroup_v2_cpu_usage_us || true)"
  if [ -z "${usage_us}" ]; then
    echo "0"
    return
  fi

ts_ms="$(now_ms)"

prev_usage_us=""
prev_ts_ms=""
if [ -r "$STATE" ]; then
  prev_usage_us="$(awk 'NR==1{print $1}' "$STATE" || true)"
  prev_ts_ms="$(awk 'NR==1{print $2}' "$STATE" || true)"
fi

echo "${usage_us} ${ts_ms}" > "$STATE"

if [ -z "${prev_usage_us}" ] || [ -z "${prev_ts_ms}" ]; then
  echo "0"
  return
fi

delta_usage_us=$((usage_us - prev_usage_us))
delta_ms=$((ts_ms - prev_ts_ms))
if [ "$delta_usage_us" -le 0 ] || [ "$delta_ms" -le 0 ]; then
  echo "0"
  return
fi

cpu_max="$(cgroup_v2_cpu_max || true)"
quota="$(echo "$cpu_max" | awk '{print $1}')"
period="$(echo "$cpu_max" | awk '{print $2}')"

allowed_cores="1"
if [ "$quota" != "max" ] && [ -n "$quota" ] && [ -n "$period" ] && [ "$period" -gt 0 ] 2>/dev/null; then
  allowed_cores="$(awk -v q="$quota" -v p="$period" 'BEGIN{printf "%.6f", q/p}')"
fi

wall_us=$((delta_ms * 1000))
awk -v du="$delta_usage_us" -v wu="$wall_us" -v cores="$allowed_cores" 'BEGIN{
  if (wu<=0 || cores<=0) { print "0"; exit }
  pct = (du / wu) / cores * 100.0
  if (pct < 0) pct = 0
  print pct
}'
}

memory_current() {
  if [ -r /sys/fs/cgroup/memory.current ]; then
    cat /sys/fs/cgroup/memory.current
  elif [ -r /sys/fs/cgroup/memory/memory.usage_in_bytes ]; then
    cat /sys/fs/cgroup/memory/memory.usage_in_bytes
  else
    echo "0"
  fi
}

memory_max() {
  if [ -r /sys/fs/cgroup/memory.max ]; then
    v="$(cat /sys/fs/cgroup/memory.max)"
    if [ "$v" = "max" ]; then echo "0"; else echo "$v"; fi
  elif [ -r /sys/fs/cgroup/memory/memory.limit_in_bytes ]; then
    cat /sys/fs/cgroup/memory/memory.limit_in_bytes
  else
    echo "0"
  fi
}

started_at_utc() {
  # Approximate: now - uptime (container uptime), returned as ISO8601.
  up="$(uptime_seconds)"
  now_s="$(date -u +%s)"
  start_s="$(awk -v n="$now_s" -v u="$up" 'BEGIN{printf "%.0f", (n - u)}')"
  date -u -d "@$start_s" +"%Y-%m-%dT%H:%M:%SZ" 2>/dev/null || date -u +"%Y-%m-%dT%H:%M:%SZ"
}

app_started_at_utc() {
  if [ -r "$APP_STATE" ]; then
    cat "$APP_STATE"
    return
  fi
  v="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "$v" > "$APP_STATE"
  echo "$v"
}

app_uptime_seconds() {
  if [ ! -r "$APP_STATE" ]; then
    app_started_at_utc >/dev/null
  fi
  # Best-effort: compare epoch seconds (no milliseconds).
  now_s="$(date -u +%s)"
  # Busybox date -d may not exist everywhere; try parse via awk fallback.
  started_iso="$(cat "$APP_STATE")"
  started_s="$(date -u -d "$started_iso" +%s 2>/dev/null || echo "")"
  if [ -z "$started_s" ]; then
    echo "0"
    return
  fi
  awk -v n="$now_s" -v s="$started_s" 'BEGIN{d=n-s; if(d<0)d=0; print d}'
}

gen_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
up="$(uptime_seconds)"
cpu="$(cpu_percent)"
mem_u="$(memory_current)"
mem_l="$(memory_max)"
start="$(started_at_utc)"
app_start="$(app_started_at_utc)"
app_up="$(app_uptime_seconds)"

cat > "$OUT" <<EOF
{
  "generatedAtUtc": "$gen_at",
  "name": "aloevera-frontend",
  "startedAtUtc": "$start",
  "uptimeSeconds": $up,
  "appStartedAtUtc": "$app_start",
  "appUptimeSeconds": $app_up,
  "cpuPercent": $cpu,
  "memoryUsageBytes": $mem_u,
  "memoryLimitBytes": $mem_l
}
EOF

