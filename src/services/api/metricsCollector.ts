// src/services/api/metricsCollector.ts

export type Sample = {
  endpoint: string;
  method: string;
  status: number;
  durationMs: number;
  timestamp: number;
};

const MAX_SAMPLES = 200;
const FLUSH_INTERVAL_MS = 30_000;
const CONFIG_REFRESH_MS = 5 * 60_000;

class FrontendMetricsCollector {
  private samples: Sample[] = [];
  private enabled = false;
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private configTimer: ReturnType<typeof setInterval> | null = null;
  private fetchConfig: () => Promise<boolean> = async () => false;
  private postBatch: (samples: Sample[]) => Promise<void> = async () => {};

  init(
    fetchConfig: () => Promise<boolean>,
    postBatch: (samples: Sample[]) => Promise<void>
  ) {
    this.fetchConfig = fetchConfig;
    this.postBatch = postBatch;
    void this.refreshConfig();
    this.configTimer = setInterval(() => void this.refreshConfig(), CONFIG_REFRESH_MS);
  }

  record(s: Sample) {
    if (!this.enabled) return;
    this.samples.push(s);
    if (this.samples.length > MAX_SAMPLES) {
      this.samples.splice(0, this.samples.length - MAX_SAMPLES);
    }
  }

  private async refreshConfig() {
    try {
      const newEnabled = await this.fetchConfig();
      if (newEnabled && !this.enabled) this.startFlushTimer();
      if (!newEnabled && this.enabled) this.stopFlushTimer();
      this.enabled = newEnabled;
    } catch {
      /* keep previous state */
    }
  }

  private startFlushTimer() {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
  }

  private stopFlushTimer() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.samples = [];
  }

  async flush() {
    if (this.samples.length === 0) return;
    const batch = this.samples.splice(0, this.samples.length);
    try {
      await this.postBatch(batch);
    } catch {
      /* drop on failure */
    }
  }

  // ── Test helpers (prefixed with _ to signal internal use) ──────────────────
  get _samples() { return this.samples; }
  get _enabled() { return this.enabled; }
  _setEnabled(v: boolean) {
    this.enabled = v;
    if (v) this.startFlushTimer();
    else this.stopFlushTimer();
  }
  _reset() {
    this.stopFlushTimer();
    if (this.configTimer) {
      clearInterval(this.configTimer);
      this.configTimer = null;
    }
    this.samples = [];
    this.enabled = false;
    this.fetchConfig = async () => false;
    this.postBatch = async () => {};
  }
}

export const frontendMetrics = new FrontendMetricsCollector();
