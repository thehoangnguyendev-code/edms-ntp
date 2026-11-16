# Chart renderer

Draws the charts of the eQMS reports with **Chart.js** and returns them as PNG pictures (REPORT-CHARTJS-2026-11-15). The browser draws no chart of a report:
the PDF, the `Analysis` sheets of an XLSX and the preview in the template editor all get the same picture from here.

- `POST /render` - JSON `{type, title, subtitle, seriesName, unit, labels, values, font, width, height}` -> `image/png`
  - `type`: `BAR`, `HORIZONTAL_BAR`, `PIE`, `DOUGHNUT`, `POLAR_AREA`, `RADAR`, `LINE`, `AREA`
  - `font`: `NOTO_SANS`, `NOTO_SERIF`, `ROBOTO_MONO`, `OSWALD`, `TIMES_NEW_ROMAN` (the report fonts the backend bundles, so Vietnamese is drawn in the font of the report)
  - only the groups the server counted are sent, never the records of the report; at most 60 groups; a request that is not valid answers `400`
- `GET /health` - `{"status":"UP"}`

Reached only by the backend on the internal network of the compose project (no published port). When `CHART_RENDERER_TOKEN` is set a request must carry it in `X-Chart-Token`.
The backend treats a renderer that cannot answer as a failure to be tried again (`REPORT_CHART_RENDERER_UNAVAILABLE`); it never draws a chart another way.

## Run and test

```
npm install
node --test                         # the configuration of every chart type
FONT_DIR=../../eqms-backend/src/main/resources/fonts node server.js
```

Against a running renderer, the backend test `ChartJsRendererTest.theRealRendererDrawsEveryKindOfChart` draws every type in every font:
`EQMS_CHART_RENDERER_TEST_URL=http://127.0.0.1:3100 ./mvnw test -Dtest=ChartJsRendererTest`.
