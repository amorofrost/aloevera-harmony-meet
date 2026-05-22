import { describe, it, expect, beforeEach } from 'vitest';
import { frontendMetrics } from '@/services/api/metricsCollector';

describe('frontendMetrics', () => {
  beforeEach(() => frontendMetrics._reset());

  it('drops samples when disabled', () => {
    frontendMetrics.record({ endpoint: '/x', method: 'GET', status: 200, durationMs: 10, timestamp: 0 });
    expect(frontendMetrics._samples).toHaveLength(0);
  });

  it('stores samples when enabled', () => {
    frontendMetrics._setEnabled(true);
    frontendMetrics.record({ endpoint: '/x', method: 'GET', status: 200, durationMs: 10, timestamp: 0 });
    expect(frontendMetrics._samples).toHaveLength(1);
  });

  it('caps at 200 samples (drop-oldest)', () => {
    frontendMetrics._setEnabled(true);
    for (let i = 0; i < 250; i++) {
      frontendMetrics.record({ endpoint: `/x${i}`, method: 'GET', status: 200, durationMs: 1, timestamp: i });
    }
    expect(frontendMetrics._samples).toHaveLength(200);
    expect(frontendMetrics._samples[0].endpoint).toBe('/x50');
  });

  it('flushes via postBatch and clears', async () => {
    const posted: any[] = [];
    frontendMetrics.init(async () => true, async (s) => { posted.push(...s); });
    // Wait a tick for init's initial refreshConfig to settle
    await new Promise(r => setTimeout(r, 0));
    frontendMetrics._setEnabled(true);
    frontendMetrics.record({ endpoint: '/x', method: 'GET', status: 200, durationMs: 10, timestamp: 0 });
    await frontendMetrics.flush();
    expect(posted).toHaveLength(1);
    expect(frontendMetrics._samples).toHaveLength(0);
  });
});
