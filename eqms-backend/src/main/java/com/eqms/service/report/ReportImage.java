package com.eqms.service.report;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.Base64;

/** No URL fetch/SVG execution; inspect dimensions before decompression. */
public final class ReportImage {
    private ReportImage() {}
    public static BufferedImage decode(String data) {
        try {
            if(data==null||data.length()>1_400_000||!data.matches("(?s)^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$")) throw new IOException();
            byte[] bytes=Base64.getDecoder().decode(data.substring(data.indexOf(',')+1));
            if(bytes.length>1_048_576)throw new IOException();
            try(var input=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
                var readers=ImageIO.getImageReaders(input);if(!readers.hasNext())throw new IOException();
                var reader=readers.next();try {
                    if(!java.util.Set.of("png","jpeg","jpg").contains(reader.getFormatName().toLowerCase()))throw new IOException();
                    reader.setInput(input);long width=reader.getWidth(0),height=reader.getHeight(0);
                    if(width<1||height<1||width>4096||height>4096||width*height>4_000_000)throw new IOException();
                    return reader.read(0);
                } finally {reader.dispose();}
            }
        } catch(Exception invalid){throw new IllegalArgumentException("REPORT_IMAGE_INVALID");}
    }
}
