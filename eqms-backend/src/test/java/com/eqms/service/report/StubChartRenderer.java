package com.eqms.service.report;

import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.List;

/**
 * A chart renderer for the tests that are about something other than the drawing (the pages of a PDF, the sheets of a workbook): it answers with a real PNG of the size of
 * the real one and remembers what it was asked to draw. The drawing itself is Chart.js, run by the chart renderer service (see ChartJsRendererTest).
 */
public final class StubChartRenderer implements ChartImageRenderer {
    public final List<ReportCharts.Result> drawn = new ArrayList<>();
    public final List<String> fonts = new ArrayList<>();

    /** Makes this the renderer of the application's charts for the rest of the test run; returns it. */
    public static StubChartRenderer install() {
        var stub = new StubChartRenderer();
        ReportCharts.use(stub);
        return stub;
    }

    @Override
    public byte[] png(ReportCharts.Result chart, String fontKey) throws Exception {
        drawn.add(chart);
        fonts.add(fontKey);
        var image = new BufferedImage(ChartJsRenderer.WIDTH, ChartJsRenderer.HEIGHT, BufferedImage.TYPE_INT_RGB);
        var g = image.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, image.getWidth(), image.getHeight());
        g.setColor(new Color(5, 150, 105));
        g.fillRect(100, 200, 300, 500);
        g.dispose();
        var out = new ByteArrayOutputStream();
        javax.imageio.ImageIO.write(image, "png", out);
        return out.toByteArray();
    }
}
