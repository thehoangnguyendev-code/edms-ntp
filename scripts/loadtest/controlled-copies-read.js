import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const BASE_URL = __ENV.BASE_URL || 'http://backend:5000/api';
const USERNAME = __ENV.LOAD_TEST_USERNAME || 'admin';
const PASSWORD = __ENV.LOAD_TEST_PASSWORD;

const loginErrorRate = new Rate('login_errors');
const listErrorRate = new Rate('list_errors');
const listDuration = new Trend('list_duration', true);

export const options = {
  scenarios: {
    read_ramp: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '1m', target: 20 },
        { duration: '30s', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<800', 'p(99)<1500'],
    login_errors: ['rate<0.01'],
    list_errors: ['rate<0.01'],
  },
};

export function setup() {
  if (!PASSWORD) {
    throw new Error('LOAD_TEST_PASSWORD env var is required (do not hardcode credentials in the script).');
  }
  const loginRes = http.post(
    `${BASE_URL}/auth/login`,
    JSON.stringify({ username: USERNAME, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } }
  );
  const ok = check(loginRes, { 'login succeeded': (r) => r.status === 200 });
  loginErrorRate.add(!ok);
  if (!ok) {
    throw new Error(`Setup login failed: ${loginRes.status} ${loginRes.body}`);
  }
  const body = loginRes.json();
  return { token: body.accessToken || body.token };
}

export default function (data) {
  const headers = { Authorization: `Bearer ${data.token}` };

  const listRes = http.get(`${BASE_URL}/controlled-copies?page=1&limit=20`, { headers });
  listDuration.add(listRes.timings.duration);
  const listOk = check(listRes, { 'list status 200': (r) => r.status === 200 });
  listErrorRate.add(!listOk);

  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, { 'health status 200': (r) => r.status === 200 });

  sleep(1);
}
