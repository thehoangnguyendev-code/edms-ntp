package com.eqms.service.report;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Draws the charts of the reports by asking the chart renderer, a small service that runs Chart.js (deploy/chart-renderer) and answers with a PNG picture
 * (REPORT-CHARTJS-2026-11-15). The browser draws no chart of a report: a PDF, an XLSX and the preview in the editor of a template all get the same picture from the server.
 * <p>
 * A renderer that cannot be reached, or that fails, is {@code REPORT_CHART_RENDERER_UNAVAILABLE}: the run is tried again and then fails with a clear reason. A chart is never
 * drawn some other way, so a report never shows a chart that looks different from the one the author chose.
 */
@Component
public class ChartJsRenderer implements ChartImageRenderer {
    private static final Logger LOG = LoggerFactory.getLogger(ChartJsRenderer.class);
    static final int WIDTH = 1400;
    static final int HEIGHT = 850;

    private final ObjectMapper mapper = new ObjectMapper();
    private final HttpClient client;
    private final URI endpoint;
    private final String token;
    private final Duration timeout;

    public ChartJsRenderer(@Value("${app.report.chart-renderer.url:http://chart-renderer:3100}") String url,
                           @Value("${app.report.chart-renderer.token:}") String token,
                           @Value("${app.report.chart-renderer.timeout-seconds:30}") long timeoutSeconds) {
        this.endpoint = URI.create(url.replaceAll("/+$", "") + "/render");
        this.token = token == null ? "" : token;
        this.timeout = Duration.ofSeconds(Math.max(1, timeoutSeconds));
        this.client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).version(HttpClient.Version.HTTP_1_1).build();
    }

    /** The application draws every chart through this renderer. */
    @PostConstruct
    void register() { ReportCharts.use(this); }

    /** What the renderer is asked: the groups the server counted, never the records. */
    Map<String, Object> requestOf(ReportCharts.Result chart, String fontKey) {
        var labels = chart.points().stream().map(ReportCharts.Point::label).toList();
        var values = chart.points().stream().map(ReportCharts.Point::value).toList();
        boolean percent = "PERCENT".equals(chart.metric());
        var request = new LinkedHashMap<String, Object>();
        request.put("type", chart.type());
        request.put("title", chart.title());
        request.put("subtitle", "Records: " + chart.total() + " · " + chart.metric());
        request.put("seriesName", percent ? "Share (%)" : "Records");
        request.put("unit", percent ? "%" : "");
        request.put("labels", labels);
        request.put("values", values);
        request.put("font", fontKey == null ? "NOTO_SANS" : fontKey);
        request.put("width", WIDTH);
        request.put("height", HEIGHT);
        return request;
    }

    @Override
    public byte[] png(ReportCharts.Result chart, String fontKey) {
        try {
            var builder = HttpRequest.newBuilder(endpoint).timeout(timeout).header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(requestOf(chart, fontKey))));
            if (!token.isBlank()) builder.header("X-Chart-Token", token);
            HttpResponse<byte[]> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() == 200 && isPng(response.body())) return response.body();
            if (response.statusCode() == 400) {
                LOG.warn("The chart renderer refused a chart ({}): {}", chart.type(), new String(response.body(), java.nio.charset.StandardCharsets.UTF_8));
                throw new IllegalArgumentException("REPORT_CHART_INVALID");
            }
            LOG.warn("The chart renderer answered {} for a {} chart", response.statusCode(), chart.type());
            throw new IllegalStateException("REPORT_CHART_RENDERER_UNAVAILABLE");
        } catch (IOException failure) {
            LOG.warn("The chart renderer could not be reached at {}: {}", endpoint, failure.toString());
            throw new IllegalStateException("REPORT_CHART_RENDERER_UNAVAILABLE", failure);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("REPORT_CHART_RENDERER_UNAVAILABLE", interrupted);
        }
    }

    private static boolean isPng(byte[] body) {
        return body != null && body.length > 8 && (body[0] & 0xff) == 0x89 && body[1] == 'P' && body[2] == 'N' && body[3] == 'G';
    }
}
