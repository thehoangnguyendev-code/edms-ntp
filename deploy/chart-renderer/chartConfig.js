'use strict';

/**
 * Turns a chart request into a Chart.js configuration. Pure: no canvas, no I/O, so that it can be tested without drawing.
 * The request is what the eQMS server calculated (REPORT-CHARTJS-2026-11-15): a title, the kind of chart, the labels and the values of its groups.
 */

const TYPES = ['BAR', 'HORIZONTAL_BAR', 'LINE', 'AREA', 'PIE', 'DOUGHNUT', 'POLAR_AREA', 'RADAR'];
const FONTS = ['NOTO_SANS', 'NOTO_SERIF', 'ROBOTO_MONO', 'OSWALD', 'TIMES_NEW_ROMAN'];
const PALETTE = ['#059669', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b', '#14b8a6', '#ec4899', '#84cc16', '#0369a1', '#b45309', '#6d28d9', '#be123c', '#0f766e', '#a16207', '#4338ca', '#9d174d', '#3f6212', '#334155', '#7c2d12'];
const LIMITS = { points: 60, label: 120, title: 200, width: [320, 2400], height: [240, 2400] };

class InvalidRequest extends Error {}

const text = (value, max, name) => {
  if (typeof value !== 'string' || value.length > max) throw new InvalidRequest(`${name} must be a text of at most ${max} characters`);
  return value;
};

const size = (value, [min, max], fallback, name) => {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) throw new InvalidRequest(`${name} must be a whole number from ${min} to ${max}`);
  return value;
};

/** Checks the request and returns it in a clean form; anything the drawing does not need is dropped. */
function normalize(body) {
  if (!body || typeof body !== 'object') throw new InvalidRequest('The request must be a JSON object');
  if (!TYPES.includes(body.type)) throw new InvalidRequest(`type must be one of ${TYPES.join(', ')}`);
  const font = body.font === undefined ? 'NOTO_SANS' : body.font;
  if (!FONTS.includes(font)) throw new InvalidRequest(`font must be one of ${FONTS.join(', ')}`);
  if (!Array.isArray(body.labels) || !Array.isArray(body.values)) throw new InvalidRequest('labels and values must be lists');
  if (body.labels.length !== body.values.length) throw new InvalidRequest('labels and values must have the same length');
  if (body.labels.length > LIMITS.points) throw new InvalidRequest(`a chart holds at most ${LIMITS.points} groups`);
  const labels = body.labels.map((label) => text(String(label), LIMITS.label, 'a label'));
  const values = body.values.map((value) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new InvalidRequest('every value must be a number');
    return value;
  });
  return {
    type: body.type,
    font,
    title: text(body.title ?? '', LIMITS.title, 'title'),
    subtitle: text(body.subtitle ?? '', LIMITS.title, 'subtitle'),
    seriesName: text(body.seriesName ?? 'Records', 60, 'seriesName'),
    unit: body.unit === '%' ? '%' : '',
    labels,
    values,
    width: size(body.width, LIMITS.width, 1400, 'width'),
    height: size(body.height, LIMITS.height, 850, 'height'),
  };
}

const shorten = (label, max) => (label.length > max ? `${label.slice(0, max - 1)}…` : label);
const colours = (count) => Array.from({ length: count }, (_, i) => PALETTE[i % PALETTE.length]);
const withAlpha = (hex, alpha) => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

const isRound = (type) => type === 'PIE' || type === 'DOUGHNUT' || type === 'POLAR_AREA';

/** The Chart.js configuration of a normalized request. */
function buildConfiguration(request) {
  const { type, labels, values, unit, font, title, subtitle } = request;
  const base = colours(Math.max(labels.length, 1));
  const family = font;
  const empty = labels.length === 0;
  const dataset = { label: request.seriesName, data: values };
  let chartType;
  const options = {
    responsive: false,
    animation: false,
    layout: { padding: { top: 8, right: 24, bottom: 8, left: 16 } },
    plugins: {
      title: { display: !!title, text: title, align: 'start', color: '#0f172a', font: { family, size: 30, weight: 'bold' }, padding: { top: 6, bottom: subtitle ? 2 : 14 } },
      subtitle: { display: !!subtitle, text: subtitle, align: 'start', color: '#475569', font: { family, size: 18 }, padding: { bottom: 16 } },
      legend: { display: false },
      valueLabels: { unit, type, family },
      emptyNote: { show: empty, family },
    },
  };
  if (isRound(type)) {
    chartType = type === 'PIE' ? 'pie' : type === 'DOUGHNUT' ? 'doughnut' : 'polarArea';
    dataset.backgroundColor = type === 'POLAR_AREA' ? base.map((c) => withAlpha(c, 0.7)) : base;
    dataset.borderColor = '#ffffff';
    dataset.borderWidth = 2;
    options.plugins.legend = {
      display: true,
      position: 'right',
      labels: { color: '#334155', font: { family, size: 17 }, boxWidth: 16, boxHeight: 16, padding: 12 },
    };
    if (type === 'DOUGHNUT') options.cutout = '56%';
    if (type === 'POLAR_AREA') options.scales = { r: { ticks: { display: false }, grid: { color: '#e2e8f0' }, angleLines: { color: '#e2e8f0' } } };
  } else if (type === 'RADAR') {
    chartType = 'radar';
    dataset.backgroundColor = withAlpha(PALETTE[0], 0.25);
    dataset.borderColor = PALETTE[0];
    dataset.borderWidth = 3;
    dataset.pointBackgroundColor = PALETTE[0];
    dataset.pointRadius = 4;
    options.scales = {
      r: {
        beginAtZero: true,
        ticks: { color: '#64748b', font: { family, size: 14 }, backdropColor: 'transparent', callback: (v) => `${v}${unit}` },
        grid: { color: '#e2e8f0' },
        angleLines: { color: '#e2e8f0' },
        pointLabels: { color: '#334155', font: { family, size: 16 } },
      },
    };
  } else {
    const horizontal = type === 'HORIZONTAL_BAR';
    const line = type === 'LINE' || type === 'AREA';
    chartType = line ? 'line' : 'bar';
    if (line) {
      dataset.borderColor = PALETTE[0];
      dataset.backgroundColor = withAlpha(PALETTE[0], type === 'AREA' ? 0.22 : 0.1);
      dataset.fill = type === 'AREA';
      dataset.tension = 0.3;
      dataset.borderWidth = 4;
      dataset.pointRadius = 5;
      dataset.pointBackgroundColor = PALETTE[0];
    } else {
      dataset.backgroundColor = base;
      dataset.borderRadius = 6;
      dataset.maxBarThickness = 64;
    }
    if (horizontal) options.indexAxis = 'y';
    const category = {
      grid: { display: false },
      ticks: {
        color: '#334155',
        font: { family, size: 15 },
        autoSkip: true,
        maxRotation: horizontal ? 0 : 35,
        callback(value) {
          return shorten(String(this.getLabelForValue(value)), horizontal ? 34 : 18);
        },
      },
    };
    const amount = { beginAtZero: true, grid: { color: '#e2e8f0' }, border: { display: false }, ticks: { color: '#64748b', font: { family, size: 15 }, callback: (v) => `${v}${unit}` } };
    options.scales = horizontal ? { x: amount, y: category } : { x: category, y: amount };
  }
  return { type: chartType, data: { labels, datasets: [dataset] }, options };
}

module.exports = { TYPES, FONTS, PALETTE, LIMITS, InvalidRequest, normalize, buildConfiguration, shorten };
