package com.eqms.controller;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.*;
import static org.assertj.core.api.Assertions.*;

class TableExportRedirectTest {
    @Test void legacyRoutePreservesContextPathAndEncodedFiltersAndResolvesToExcel() {
        var request=new MockHttpServletRequest("GET","/api/documents/export");
        request.setContextPath("/api");
        request.setQueryString("search=SOP%20test&status=EFFECTIVE&sortDirection=asc");
        RequestContextHolder.setRequestAttributes(new ServletRequestAttributes(request));
        try {
            var response=TableExportRedirect.to("documents");
            assertThat(response.getStatusCode().value()).isEqualTo(307);
            assertThat(response.getHeaders().getLocation().isAbsolute()).isFalse();
            assertThat(response.getHeaders().getLocation().getRawPath()).isEqualTo("/api/table-exports/documents");
            assertThat(response.getHeaders().getLocation().getRawQuery()).isEqualTo(request.getQueryString());
            assertThat(response.getHeaders().getCacheControl()).isEqualTo("no-store");
        } finally { RequestContextHolder.resetRequestAttributes(); }
    }
}
