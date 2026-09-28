/*
 * Rate-limit validation for a non-production EQMS environment.
 *
 * Examples (PowerShell):
 *   $env:BASE_URL='http://localhost:5000'; k6 run .\loadtest\rate-limit-500vus.js
 *   $env:RUN_AUTH_ISOLATION='true'; $env:APP_RATE_LIMIT_TRUST_FORWARDED_HEADERS='true'; k6 run .\loadtest\rate-limit-500vus.js
 *
 * Never point this at production. The optional auth scenario deliberately sends invalid
 * credentials and depends on a trusted test reverse proxy / test-only forwarded headers.
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Trend } from 'k6/metrics';

const baseUrl = __ENV.BASE_URL || 'http://localhost:5000';
const runAuthIsolation = __ENV.RUN_AUTH_ISOLATION === 'true';
const runProtectedFlows = __ENV.RUN_PROTECTED_FLOWS === 'true';
const readLatency = new Trend('rate_limit_read_latency', true);
const unexpectedResponses = new Counter('rate_limit_unexpected_responses');

export const options = {
  scenarios: {
    read_500_users: {
      executor: 'constant-vus',
      vus: 500,
      duration: '30s',
      exec: 'readTraffic',
      gracefulStop: '10s',
    },
    auth_identity_isolation: {
      executor: 'per-vu-iterations',
      vus: runAuthIsolation ? 500 : 0,
      iterations: runAuthIsolation ? 500 : 0,
      maxDuration: '1m',
      exec: 'authIsolation',
    },
    protected_credential_flows: {
      executor: 'per-vu-iterations',
      vus: runProtectedFlows ? 10 : 0,
      iterations: runProtectedFlows ? 10 : 0,
      maxDuration: '1m',
      exec: 'protectedFlows',
    },
  },
  thresholds: {
    rate_limit_read_latency: ['p(95)<1000'],
    http_req_failed: ['rate<0.02'],
  },
};

export function readTraffic() {
  // /api/health is intentionally cheap and public; each VU has its own source identity only
  // when a test proxy injects it. This scenario measures the fixed-window read limiter's Redis
  // round trips and server latency without mutating business data.
  const response = http.get(`${baseUrl}/api/health`);
  readLatency.add(response.timings.duration);
  if (!check(response, { 'health is available': r => r.status === 200 })) {
    unexpectedResponses.add(1);
  }
  sleep(0.5);
}

export function authIsolation() {
  // All virtual users emulate one office NAT; identifiers are intentionally distinct. With the
  // new account-scoped guard, five failures for one identifier cannot cause a 429 for another.
  const account = `loadtest-user-${__VU}@example.invalid`;
  const response = http.post(`${baseUrl}/api/auth/login`, JSON.stringify({
    identifier: account,
    password: 'intentionally-invalid',
  }), {
    headers: {
      'Content-Type': 'application/json',
      // The application must trust this header only behind a controlled test proxy.
      'X-Forwarded-For': '198.51.100.77',
    },
  });
  if (!check(response, { 'invalid login is rejected by authentication, not rate limit': r => r.status !== 429 })) {
    unexpectedResponses.add(1);
  }
}

export function protectedFlows() {
  // Opt-in smoke checks. Supply TEST_ACCESS_TOKEN and TEST_CURRENT_PASSWORD only for an
  // expendable test account. The new password is deliberately identical/invalid so no account
  // state is changed; adjust the payload only inside a disposable environment.
  const token = __ENV.TEST_ACCESS_TOKEN;
  if (!token) return;
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  const signature = http.post(`${baseUrl}/api/auth/verify-signature`, JSON.stringify({
    username: __ENV.TEST_USERNAME || 'loadtest', password: __ENV.TEST_CURRENT_PASSWORD || 'invalid',
  }), { headers });
  const change = http.post(`${baseUrl}/api/auth/me/change-password`, JSON.stringify({
    currentPassword: __ENV.TEST_CURRENT_PASSWORD || 'invalid', newPassword: 'invalid', confirmPassword: 'invalid',
  }), { headers });
  check(signature, { 'signature route is rate limited': r => r.status !== 404 && r.status !== 405 });
  check(change, { 'change-password route is rate limited': r => r.status !== 404 && r.status !== 405 });
}
