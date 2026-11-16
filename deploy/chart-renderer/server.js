'use strict';

/**
 * Draws the charts of the eQMS reports with Chart.js and returns them as PNG pictures (REPORT-CHARTJS-2026-11-15).
 *
 *   GET  /health   -> 200 {"status":"UP"}
 *   POST /render   -> 200 image/png, for a JSON request (see chartConfig.js); 400 {"error":"..."} for a request that is not valid
 *
 * It is reached only from the eQMS backend, on the internal network of the compose project; it is not published on the host. When CHART_RENDERER_TOKEN is set,
 * a request must carry it in the header X-Chart-Token. The fonts of the reports (Noto Sans, Noto Serif, Roboto Mono, Oswald, Tinos) are the files the backend bundles,
 * mounted in /app/fonts, so that Vietnamese is drawn in the font of the report.
 */

const http = require('node:http');
const path = require('node:path');
const fs = require('node:fs');
const crypto = require('node:crypto');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');
const { InvalidRequest, normalize, buildConfiguration } = require('./chartConfig');

const PORT = Number(process.env.PORT || 3100);
const TOKEN = process.env.CHART_RENDERER_TOKEN || '';
const FONT_DIR = process.env.FONT_DIR || path.join(__dirname, 'fonts');
const MAX_BODY = 512 * 1024;

const FAMILIES = {
  NOTO_SANS: { regular: 'NotoSans-Regular.ttf', bold: 'NotoSans-Bold.ttf' },
  NOTO_SERIF: { regular: 'NotoSerif-Regular.ttf', bold: 'NotoSerif-Bold.ttf' },
  ROBOTO_MONO: { regular: 'RobotoMono-Regular.ttf', bold: 'RobotoMono-Bold.ttf' },
  OSWALD: { regular: 'Oswald-Regular.ttf', bold: 'Oswald-Bold.ttf' },
  TIMES_NEW_ROMAN: { regular: 'Tinos-Regular.ttf', bold: 'Tinos-Bold.ttf' },
};

/** Values drawn on the chart: above a bar or a point, on a slice. Chart.js has no such plugin of its own; this is the whole of it. */
const valueLabels = {
  id: 'valueLabels',
  afterDatasetsDraw(chart, _args, options) {
    const dataset = chart.data.datasets[0];
    const meta = chart.getDatasetMeta(0);
    if (!dataset || !meta || meta.data.length > 24) return; // a crowded chart is read by its axis and its legend
    const { ctx } = chart;
    const horizontal = chart.options.indexAxis === 'y';
    ctx.save();
    ctx.font = `bold 15px ${options.family}`;
    ctx.fillStyle = '#0f172a';
    meta.data.forEach((element, i) => {
      const value = dataset.data[i];
      const label = `${Number.isInteger(value) ? value : Math.round(value * 100) / 100}${options.unit || ''}`;
      if (options.type === 'PIE' || options.type === 'DOUGHNUT') {
        const { x, y } = element.tooltipPosition();
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, x, y);
      } else if (options.type === 'BAR' || options.type === 'LINE' || options.type === 'AREA' || options.type === 'HORIZONTAL_BAR') {
        const { x, y } = element.tooltipPosition();
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = horizontal ? 'left' : 'center';
        ctx.textBaseline = horizontal ? 'middle' : 'bottom';
        ctx.fillText(label, horizontal ? x + 8 : x, horizontal ? y : y - 8);
      }
    });
    ctx.restore();
  },
};

/** "No matching data", as a report with no row says it. */
const emptyNote = {
  id: 'emptyNote',
  afterDraw(chart, _args, options) {
    if (!options.show) return;
    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.font = `20px ${options.family}`;
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'center';
    ctx.fillText('No matching data', (chartArea.left + chartArea.right) / 2, (chartArea.top + chartArea.bottom) / 2);
    ctx.restore();
  },
};

const white = {
  id: 'whiteBackground',
  beforeDraw(chart) {
    const { ctx } = chart;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  },
};

/** One drawing surface for each size; creating it is the costly part. */
const surfaces = new Map();
function surfaceFor(width, height) {
  const key = `${width}x${height}`;
  let surface = surfaces.get(key);
  if (!surface) {
    surface = new ChartJSNodeCanvas({ width, height, backgroundColour: 'white', plugins: { modern: [], requireLegacy: [] }, chartCallback: (ChartJS) => { ChartJS.register(valueLabels, emptyNote, white); } });
    for (const [family, files] of Object.entries(FAMILIES)) {
      for (const [weight, file] of Object.entries(files)) {
        const location = path.join(FONT_DIR, file);
        if (fs.existsSync(location)) surface.registerFont(location, { family, weight });
      }
    }
    surfaces.set(key, surface);
    if (surfaces.size > 8) surfaces.delete(surfaces.keys().next().value);
  }
  return surface;
}

async function render(body) {
  const request = normalize(body);
  const configuration = buildConfiguration(request);
  return surfaceFor(request.width, request.height).renderToBuffer(configuration, 'image/png');
}

const authorized = (header) => {
  if (!TOKEN) return true;
  const given = Buffer.from(String(header || ''));
  const wanted = Buffer.from(TOKEN);
  return given.length === wanted.length && crypto.timingSafeEqual(given, wanted);
};

const send = (response, status, type, payload) => {
  response.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(payload), 'Cache-Control': 'no-store' });
  response.end(payload);
};

const server = http.createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') return send(response, 200, 'application/json', '{"status":"UP"}');
  if (request.method !== 'POST' || request.url !== '/render') return send(response, 404, 'application/json', '{"error":"not found"}');
  if (!authorized(request.headers['x-chart-token'])) return send(response, 401, 'application/json', '{"error":"not authorized"}');
  const chunks = [];
  let size = 0;
  request.on('data', (chunk) => {
    size += chunk.length;
    if (size > MAX_BODY) {
      send(response, 413, 'application/json', '{"error":"request too large"}');
      request.destroy();
    } else chunks.push(chunk);
  });
  request.on('end', async () => {
    if (response.writableEnded) return;
    try {
      const png = await render(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      send(response, 200, 'image/png', png);
    } catch (error) {
      if (error instanceof InvalidRequest || error instanceof SyntaxError) return send(response, 400, 'application/json', JSON.stringify({ error: error.message }));
      console.error('render failed', error);
      send(response, 500, 'application/json', '{"error":"render failed"}');
    }
  });
});

if (require.main === module) {
  server.listen(PORT, () => console.log(`chart-renderer listening on ${PORT}`));
}

module.exports = { server, render };
