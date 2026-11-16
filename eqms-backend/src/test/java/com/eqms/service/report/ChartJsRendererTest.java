package com.eqms.service.report;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * REPORT-CHARTJS-2026-11-15: the charts of the reports are drawn by the chart renderer (Chart.js). The server asks it for a PNG, sends only the groups it counted, sends the font of
 * the report, and treats a renderer that cannot answer as a failure to be tried again, never as a chart drawn some other way.
 */
class ChartJsRendererTest {
    private HttpServer server;

    @AfterEach
    void stop() { if (server != null) server.stop(0); }

    private static byte[] png() throws IOException {
        var image = new BufferedImage(40, 30, BufferedImage.TYPE_INT_RGB);
        var g = image.createGraphics();
        g.setColor(Color.GREEN);
        g.fillRect(0, 0, 40, 30);
        g.dispose();
        var out = new ByteArrayOutputStream();
        javax.imageio.ImageIO.write(image, "png", out);
        return out.toByteArray();
    }

    private String serve(int status, byte[] answer, AtomicReference<String> body, AtomicReference<String> token) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/render", exchange -> {
            body.set(new String(exchange.getRequestBody().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
            token.set(exchange.getRequestHeaders().getFirst("X-Chart-Token"));
            exchange.sendResponseHeaders(status, answer.length);
            exchange.getResponseBody().write(answer);
            exchange.close();
        });
        server.start();
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    private static ReportCharts.Result chart(String type, String metric) {
        return new ReportCharts.Result("Documents by status", type, metric, 10,
                List.of(new ReportCharts.Point("Effective", 6, "PERCENT".equals(metric) ? 60 : 6), new ReportCharts.Point("Draft", 4, "PERCENT".equals(metric) ? 40 : 4)));
    }

    @Test
    void sendsTheGroupsTheServerCountedAndTheFontOfTheReport_andReturnsThePicture() throws Exception {
        var body = new AtomicReference<String>();
        var token = new AtomicReference<String>();
        byte[] picture = png();
        var renderer = new ChartJsRenderer(serve(200, picture, body, token), "secret", 5);
        assertThat(renderer.png(chart("DOUGHNUT", "PERCENT"), "TIMES_NEW_ROMAN")).isEqualTo(picture);
        JsonNode sent = new ObjectMapper().readTree(body.get());
        assertThat(sent.path("type").asText()).isEqualTo("DOUGHNUT");
        assertThat(sent.path("title").asText()).isEqualTo("Documents by status");
        assertThat(sent.path("subtitle").asText()).isEqualTo("Records: 10 · PERCENT");
        assertThat(sent.path("unit").asText()).isEqualTo("%");
        assertThat(sent.path("font").asText()).isEqualTo("TIMES_NEW_ROMAN");
        assertThat(sent.path("labels")).extracting(JsonNode::asText).containsExactly("Effective", "Draft");
        assertThat(sent.path("values")).extracting(JsonNode::asDouble).containsExactly(60.0, 40.0);
        assertThat(sent.path("width").asInt()).isEqualTo(1400);
        assertThat(sent.path("height").asInt()).isEqualTo(850);
        assertThat(sent.has("rows")).as("no record of the report is sent, only the groups").isFalse();
        assertThat(token.get()).isEqualTo("secret");
    }

    @Test
    void aCountHasNoUnitAndTheDefaultFontIsNotoSans() throws Exception {
        var body = new AtomicReference<String>();
        var renderer = new ChartJsRenderer(serve(200, png(), body, new AtomicReference<>()), "", 5);
        renderer.png(chart("BAR", "COUNT"), null);
        JsonNode sent = new ObjectMapper().readTree(body.get());
        assertThat(sent.path("unit").asText()).isEmpty();
        assertThat(sent.path("font").asText()).isEqualTo("NOTO_SANS");
        assertThat(sent.path("seriesName").asText()).isEqualTo("Records");
    }

    @Test
    void aRendererThatRefusesTheChartIsAnInvalidChart_notARetry() throws Exception {
        var renderer = new ChartJsRenderer(serve(400, "{\"error\":\"type must be one of\"}".getBytes(), new AtomicReference<>(), new AtomicReference<>()), "", 5);
        assertThatThrownBy(() -> renderer.png(chart("BAR", "COUNT"), null)).isInstanceOf(IllegalArgumentException.class).hasMessage("REPORT_CHART_INVALID");
    }

    @Test
    void aRendererThatFailsOrIsNotThereIsUnavailable_soTheRunIsTriedAgain() throws Exception {
        var failing = new ChartJsRenderer(serve(500, "{}".getBytes(), new AtomicReference<>(), new AtomicReference<>()), "", 5);
        assertThatThrownBy(() -> failing.png(chart("BAR", "COUNT"), null)).isInstanceOf(IllegalStateException.class).hasMessage("REPORT_CHART_RENDERER_UNAVAILABLE");
        stop();
        var gone = new ChartJsRenderer("http://127.0.0.1:1", "", 2);
        assertThatThrownBy(() -> gone.png(chart("BAR", "COUNT"), null)).isInstanceOf(IllegalStateException.class).hasMessage("REPORT_CHART_RENDERER_UNAVAILABLE");
    }

    @Test
    void anAnswerThatIsNotAPictureIsNotUsed() throws Exception {
        var renderer = new ChartJsRenderer(serve(200, "<html>proxy error</html>".getBytes(), new AtomicReference<>(), new AtomicReference<>()), "", 5);
        assertThatThrownBy(() -> renderer.png(chart("BAR", "COUNT"), null)).isInstanceOf(IllegalStateException.class).hasMessage("REPORT_CHART_RENDERER_UNAVAILABLE");
    }

    @Test
    void withNoRendererChosenAChartCannotBeDrawn() {
        ReportCharts.use(null);
        assertThatThrownBy(() -> ReportCharts.png(chart("BAR", "COUNT"), null)).isInstanceOf(IllegalStateException.class).hasMessage("REPORT_CHART_RENDERER_UNAVAILABLE");
    }

    /** Against the real renderer (the chart-renderer service, or deploy/chart-renderer run with node): every kind of chart comes back as a picture of the size the report uses. */
    @Test
    @EnabledIfEnvironmentVariable(named = "EQMS_CHART_RENDERER_TEST_URL", matches = ".+")
    void theRealRendererDrawsEveryKindOfChart() throws Exception {
        var renderer = new ChartJsRenderer(System.getenv("EQMS_CHART_RENDERER_TEST_URL"), System.getenv().getOrDefault("EQMS_CHART_RENDERER_TEST_TOKEN", ""), 30);
        var groups = List.of(new ReportCharts.Point("Hiệu lực", 48, 48), new ReportCharts.Point("Bản nháp", 31, 31), new ReportCharts.Point("Hết hiệu lực", 22, 22),
                new ReportCharts.Point("Chờ phê duyệt", 15, 15));
        for (String type : ReportLayout.Chart.TYPES) {
            for (String font : ReportFonts.KEYS) {
                byte[] bytes = renderer.png(new ReportCharts.Result("Documents by status", type, "COUNT", 116, groups), font);
                BufferedImage image = javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(bytes));
                assertThat(image).as(type + " " + font).isNotNull();
                assertThat(image.getWidth()).isEqualTo(1400);
                assertThat(image.getHeight()).isEqualTo(850);
                boolean drawn = false;
                for (int x = 0; x < image.getWidth() && !drawn; x += 7) for (int y = 0; y < image.getHeight() && !drawn; y += 7) drawn = image.getRGB(x, y) != 0xFFFFFFFF;
                assertThat(drawn).as(type + " " + font + " is not blank").isTrue();
            }
        }
        // No group at all is drawn with a note, not refused.
        assertThat(renderer.png(new ReportCharts.Result("Empty", "PIE", "COUNT", 0, List.of()), null)).isNotEmpty();
    }
}
