package com.eqms;

import com.eqms.service.EformFieldScanService;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Verifies role scanning against a synthesized zip shaped like a real .docxf's oform/userMasters/
 *  parts (confirmed this session by downloading and inspecting an actual OnlyOffice-saved file). */
class EformFieldScanServiceTest {

    private final EformFieldScanService service = new EformFieldScanService();

    @Test
    void scanRoleNames_returnsDistinctSortedRoles_excludingAnyone() throws IOException {
        byte[] docxf = buildFakeDocxf(
                "<user><role>Quality_Manager</role></user>",
                "<user><role>Nguoi_lap</role></user>",
                "<user><role>Anyone</role></user>",
                "<user><role>Nguoi_lap</role></user>" // duplicate role used on a second field
        );

        List<String> roles = service.scanRoleNames(docxf);

        assertEquals(List.of("Nguoi_lap", "Quality_Manager"), roles);
    }

    @Test
    void scanRoleNames_returnsEmpty_whenNoUserMasterParts() throws IOException {
        byte[] docxf = buildFakeDocxf();

        List<String> roles = service.scanRoleNames(docxf);

        assertEquals(List.of(), roles);
    }

    private byte[] buildFakeDocxf(String... userMasterXmlBodies) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(out)) {
            zip.putNextEntry(new ZipEntry("word/document.xml"));
            zip.write("<document/>".getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
            for (int i = 0; i < userMasterXmlBodies.length; i++) {
                zip.putNextEntry(new ZipEntry("oform/userMasters/user" + i + ".xml"));
                zip.write(("<?xml version=\"1.0\"?>" + userMasterXmlBodies[i]).getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
        }
        return out.toByteArray();
    }
}
