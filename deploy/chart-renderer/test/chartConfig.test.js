'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { normalize, buildConfiguration, InvalidRequest, TYPES } = require('../chartConfig');

const request = (over = {}) => ({ type: 'BAR', title: 'Documents by status', labels: ['Effective', 'Draft', 'Obsolete'], values: [48, 31, 22], ...over });

test('every type of the report charts builds a configuration of Chart.js', () => {
  const expected = { BAR: 'bar', HORIZONTAL_BAR: 'bar', LINE: 'line', AREA: 'line', PIE: 'pie', DOUGHNUT: 'doughnut', POLAR_AREA: 'polarArea', RADAR: 'radar' };
  assert.deepEqual([...TYPES].sort(), Object.keys(expected).sort());
  for (const type of TYPES) {
    const configuration = buildConfiguration(normalize(request({ type })));
    assert.equal(configuration.type, expected[type], type);
    assert.deepEqual(configuration.data.labels, ['Effective', 'Draft', 'Obsolete']);
    assert.deepEqual(configuration.data.datasets[0].data, [48, 31, 22]);
  }
});

test('a horizontal bar chart puts the groups on the vertical axis, an area chart fills under its line', () => {
  assert.equal(buildConfiguration(normalize(request({ type: 'HORIZONTAL_BAR' }))).options.indexAxis, 'y');
  assert.equal(buildConfiguration(normalize(request({ type: 'BAR' }))).options.indexAxis, undefined);
  assert.equal(buildConfiguration(normalize(request({ type: 'AREA' }))).data.datasets[0].fill, true);
  assert.equal(buildConfiguration(normalize(request({ type: 'LINE' }))).data.datasets[0].fill, false);
});

test('the round charts have a legend and the others do not', () => {
  for (const type of ['PIE', 'DOUGHNUT', 'POLAR_AREA']) assert.equal(buildConfiguration(normalize(request({ type }))).options.plugins.legend.display, true, type);
  for (const type of ['BAR', 'HORIZONTAL_BAR', 'LINE', 'AREA', 'RADAR']) assert.equal(buildConfiguration(normalize(request({ type }))).options.plugins.legend.display, false, type);
});

test('a percentage is drawn with its unit', () => {
  const configuration = buildConfiguration(normalize(request({ unit: '%' })));
  assert.equal(configuration.options.scales.y.ticks.callback(40), '40%');
  assert.equal(normalize(request({ unit: 'x' })).unit, '');
});

test('the font of the report is the font of the chart', () => {
  const configuration = buildConfiguration(normalize(request({ font: 'TIMES_NEW_ROMAN' })));
  assert.equal(configuration.options.plugins.title.font.family, 'TIMES_NEW_ROMAN');
});

test('a request that is not valid is refused with the reason', () => {
  const refused = (body, pattern) => assert.throws(() => normalize(body), (error) => error instanceof InvalidRequest && pattern.test(error.message));
  refused(null, /JSON object/);
  refused(request({ type: 'SCATTER' }), /type must be one of/);
  refused(request({ font: 'COMIC' }), /font must be one of/);
  refused(request({ values: [1] }), /same length/);
  refused(request({ values: [1, 'x', 3] }), /every value must be a number/);
  refused(request({ labels: Array(61).fill('a'), values: Array(61).fill(1) }), /at most 60/);
  refused(request({ labels: ['a'.repeat(121), 'b', 'c'] }), /a label/);
  refused(request({ width: 10 }), /width/);
  refused(request({ title: 'x'.repeat(201) }), /title/);
});

test('a chart with no group is drawn with a note and not refused', () => {
  const configuration = buildConfiguration(normalize(request({ labels: [], values: [] })));
  assert.equal(configuration.options.plugins.emptyNote.show, true);
});
