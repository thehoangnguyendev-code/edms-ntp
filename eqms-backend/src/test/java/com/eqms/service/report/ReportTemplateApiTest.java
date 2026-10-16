package com.eqms.service.report;

import com.eqms.auth.CurrentUserService;
import com.eqms.controller.ReportTemplateController;
import com.eqms.controller.ReportAccessExceptionHandler;
import com.eqms.entity.UserAccount;
import com.eqms.exception.GlobalExceptionHandler;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ReportTemplateApiTest {
    @Test void catalogFiltersAreBoundAndSoftDeleteUsesVersionAndReason() throws Exception {
        var templates=mock(ReportTemplateService.class);var users=mock(CurrentUserService.class);var actor=new UserAccount();when(users.requireCurrentUser()).thenReturn(actor);
        var mvc=MockMvcBuilders.standaloneSetup(new ReportTemplateController(templates,users)).setControllerAdvice(new ReportAccessExceptionHandler(),new GlobalExceptionHandler()).build();
        mvc.perform(get("/reports/templates/configuration").param("status","ACTIVE").param("sourceCode","DOCUMENT_STATUS").param("format","PDF").param("orientation","PORTRAIT")).andExpect(status().isOk());
        verify(templates).adminCatalog(actor,"",1,"displayName","asc",java.util.Map.of("status","ACTIVE","sourceCode","DOCUMENT_STATUS","format","PDF","orientation","PORTRAIT","limit","10"));
        mvc.perform(delete("/reports/templates/QA_REGISTER").contentType("application/json").content("{\"version\":3,\"reason\":\"Retire TEST template\"}")).andExpect(status().isNoContent());
        verify(templates).delete(actor,"QA_REGISTER",3,"Retire TEST template");
        doThrow(new SecurityException("private scope")).when(templates).delete(actor,"QA_REGISTER",3,"Denied");
        mvc.perform(delete("/reports/templates/QA_REGISTER").contentType("application/json").content("{\"version\":3,\"reason\":\"Denied\"}")).andExpect(status().isForbidden());
    }
    @Test void livePdfIsNotCacheableAndDeniedPreviewIsForbidden() throws Exception {
        var templates=mock(ReportTemplateService.class);var users=mock(CurrentUserService.class);var actor=new UserAccount();when(users.requireCurrentUser()).thenReturn(actor);
        when(templates.previewPdf(eq(actor),eq("QA_REGISTER"),any(),eq("TEST report"))).thenReturn("%PDF-1.7".getBytes()).thenThrow(new SecurityException("private details"));
        var mvc=MockMvcBuilders.standaloneSetup(new ReportTemplateController(templates,users)).setControllerAdvice(new ReportAccessExceptionHandler(),new GlobalExceptionHandler()).build();
        String body="{\"title\":\"TEST report\",\"criteria\":{\"version\":1,\"filters\":{},\"fields\":[\"documentNumber\"],\"sortBy\":\"documentNumber\",\"direction\":\"asc\"}}";
        mvc.perform(post("/reports/templates/QA_REGISTER/preview-pdf").contentType("application/json").content(body)).andExpect(status().isOk()).andExpect(content().contentType("application/pdf")).andExpect(header().string("Cache-Control","no-store"));
        mvc.perform(post("/reports/templates/QA_REGISTER/preview-pdf").contentType("application/json").content(body)).andExpect(status().isForbidden()).andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private details"))));
    }
    @Test void scopeDenialIsForbiddenAndDoesNotLeakInternalDetails() throws Exception {
        var templates=mock(ReportTemplateService.class);var users=mock(CurrentUserService.class);var actor=new UserAccount();
        when(users.requireCurrentUser()).thenReturn(actor);
        when(templates.catalog(eq(actor),eq(""),eq(1),eq("displayName"),eq("asc"),anyMap())).thenThrow(new SecurityException("private role details"));
        var mvc=MockMvcBuilders.standaloneSetup(new ReportTemplateController(templates,users)).setControllerAdvice(new ReportAccessExceptionHandler(),new GlobalExceptionHandler()).build();
        mvc.perform(get("/reports/templates")).andExpect(status().isForbidden()).andExpect(jsonPath("$.error.code").value("REPORT_SCOPE_DENIED"))
                .andExpect(content().string(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("private"))));
    }
    @Test void staleTemplateIsConflictAndInvalidCriteriaAreBadRequest() throws Exception {
        var templates=mock(ReportTemplateService.class);var users=mock(CurrentUserService.class);var actor=new UserAccount();when(users.requireCurrentUser()).thenReturn(actor);
        when(templates.preview(eq(actor),eq("QA_REGISTER"),any(),eq(1))).thenThrow(new ResponseStatusException(HttpStatus.CONFLICT,"REPORT_TEMPLATE_VERSION_CHANGED"))
                .thenThrow(new IllegalArgumentException("REPORT_FILTER_NOT_ALLOWED"));
        var mvc=MockMvcBuilders.standaloneSetup(new ReportTemplateController(templates,users)).setControllerAdvice(new ReportAccessExceptionHandler(),new GlobalExceptionHandler()).build();
        String body="{\"version\":1,\"filters\":{},\"fields\":[\"documentNumber\"],\"sortBy\":\"documentNumber\",\"direction\":\"asc\"}";
        mvc.perform(post("/reports/templates/QA_REGISTER/preview").contentType("application/json").content(body)).andExpect(status().isConflict());
        mvc.perform(post("/reports/templates/QA_REGISTER/preview").contentType("application/json").content(body)).andExpect(status().isBadRequest());
    }
}
