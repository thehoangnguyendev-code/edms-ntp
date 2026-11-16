package com.eqms.controller;

import org.springframework.http.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import org.springframework.web.util.UriComponentsBuilder;

/** Backward-compatible route aliases; table exports now always resolve to XLSX. */
final class TableExportRedirect {
    private TableExportRedirect() {}
    static ResponseEntity<StreamingResponseBody> to(String dataset) {
        var attributes=(org.springframework.web.context.request.ServletRequestAttributes)
                org.springframework.web.context.request.RequestContextHolder.currentRequestAttributes();
        var request=attributes.getRequest();
        // Relative to the public origin: never redirect the browser to an internal Docker hostname.
        var location=UriComponentsBuilder.fromPath(request.getContextPath()+"/table-exports/"+dataset)
                .query(request.getQueryString()).build(true).toUri();
        return ResponseEntity.status(HttpStatus.TEMPORARY_REDIRECT).location(location).cacheControl(CacheControl.noStore()).build();
    }
}
