import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { frontendMetrics } from '@/services/api/metricsCollector';
import { apiClient } from '@/services/api/apiClient';

createRoot(document.getElementById("root")!).render(<App />);

frontendMetrics.init(
  async () => {
    // /metrics/config is [Authorize] — skip the probe for anonymous visitors so
    // the welcome page doesn't burn a 401 (and historically: a reload loop).
    // The 5-minute polling interval will pick the config up once the user signs in.
    if (!apiClient.getAccessToken()) return false;
    try {
      const resp = await apiClient.get<{ frontendPerf: boolean }>('/api/v1/metrics/config');
      return resp.success === true && resp.data?.frontendPerf === true;
    } catch {
      return false;
    }
  },
  async (samples) => {
    await apiClient.post('/api/v1/metrics/frontend', { samples });
  }
);
