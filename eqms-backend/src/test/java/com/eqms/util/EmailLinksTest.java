package com.eqms.util;

import static org.assertj.core.api.Assertions.assertThat;

import com.eqms.service.EmailTemplateService;
import java.util.Map;
import org.junit.jupiter.api.Test;

class EmailLinksTest {
    private static final String ID = "e57c64f3-5620-47e2-923c-57803567e949";
    private static final String BASE = "https://eqms.example.com/";

    private static String mail(String template, Map<String, String> variables) {
        Map<String, String> complete = EmailLinks.absolute(variables, BASE);
        String body = template;
        for (var e : complete.entrySet()) body = body.replace("{{" + e.getKey() + "}}", e.getValue());
        return EmailLinks.friendly(EmailTemplateService.sanitizeRenderedHtml(body), complete);
    }

    @Test
    void aPathBecomesACompleteAddressThatCanBePressedAndIsNotShown() {
        String out = mail("<p>Detail: <a href=\"{{controlledCopyUrl}}\">{{controlledCopyUrl}}</a></p>", Map.of("controlledCopyUrl", "/documents/controlled-copies/" + ID));
        assertThat(out).contains("href=\"https://eqms.example.com/documents/controlled-copies/" + ID + "\"").contains(">Open in EQMS</a>");
        assertThat(out.replaceAll("<[^>]*>", "")).doesNotContain(ID);
    }

    @Test
    void anAddressWrittenAsPlainTextBecomesALink() {
        String out = mail("<p>Link: {{actionUrl}}</p>", Map.of("actionUrl", "/documents/" + ID));
        assertThat(out).contains("Link: <a href=\"https://eqms.example.com/documents/" + ID + "\">Open in EQMS</a>");
    }

    @Test
    void wordsTheTemplateWroteItselfStayAndOtherValuesAreNotTouched() {
        Map<String, String> complete = EmailLinks.absolute(Map.of("documentUrl", "/documents/" + ID, "documentTitle", "/not an address", "publicAppUrl", "/x"), BASE);
        assertThat(complete.get("documentTitle")).isEqualTo("/not an address");
        assertThat(complete.get("publicAppUrl")).isEqualTo("/x");
        String out = mail("<p><a href=\"{{documentUrl}}\">Read the document</a></p>", Map.of("documentUrl", "/documents/" + ID));
        assertThat(out).contains(">Read the document</a>");
    }

    @Test
    void anAddressThatIsAlreadyCompleteKeepsIt() {
        String out = mail("<p>{{officeEditUrl}}</p>", Map.of("officeEditUrl", "https://office.example.com/edit/abc"));
        assertThat(out).contains("<a href=\"https://office.example.com/edit/abc\">Edit online</a>");
    }
}
