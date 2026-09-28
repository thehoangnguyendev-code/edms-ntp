# EQMS rate-limit load test

Install [k6](https://grafana.com/docs/k6/latest/set-up/install-k6/) on a non-production machine, then run:

```powershell
$env:BASE_URL = 'http://localhost:5000'
k6 run .\loadtest\rate-limit-500vus.js
```

The default scenario creates 500 concurrent users against `GET /api/health`. Record p95 latency, HTTP failures, Redis command rate, and the Micrometer counters `eqms.rate_limit.requests` / `eqms.rate_limit.rejected` by `bucket`.

To confirm NAT isolation, use a disposable environment and enable the test proxy/header configuration only there:

```powershell
$env:RUN_AUTH_ISOLATION = 'true'
k6 run .\loadtest\rate-limit-500vus.js
```

All virtual users share `X-Forwarded-For: 198.51.100.77` but use different fake login identifiers. Each request should receive the normal authentication rejection (not 429). Separately send six requests for the same fake identifier: the sixth must be 429 even if its forwarded IP changes. Do not enable trusted forwarded headers on a backend directly exposed to the Internet; only a controlled reverse proxy may set them.

The `RUN_PROTECTED_FLOWS` scenario is opt-in and requires a disposable test account/token. It verifies the signature and password-change routes are recognized by the limiter without modifying a valid password.

For the fixed-window boundary test, run two short 500-VU executions immediately before and immediately after a minute boundary, then compare accepted counts and p95 latency. This produces the evidence needed before choosing a sliding-window or token-bucket migration; it does not change the current fixed-window algorithm.
