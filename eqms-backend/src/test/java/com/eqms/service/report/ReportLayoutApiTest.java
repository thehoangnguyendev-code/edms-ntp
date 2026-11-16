package com.eqms.service.report;

import com.eqms.auth.CurrentUserService;
import com.eqms.controller.*;
import com.eqms.entity.UserAccount;
import com.eqms.exception.GlobalExceptionHandler;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

class ReportLayoutApiTest {
    @Test void wordUploadPermissionIsCheckedBeforeStorageAndLargeFilesAreRejected() throws Exception {
        var templates=mock(ReportTemplateService.class);var users=mock(CurrentUserService.class);var words=mock(ReportWordService.class);var actor=new UserAccount();when(users.requireCurrentUser()).thenReturn(actor);
        var controller=new ReportLayoutController(templates,users);controller.configureWords(words);
        var mvc=MockMvcBuilders.standaloneSetup(controller).setControllerAdvice(new ReportAccessExceptionHandler(),new GlobalExceptionHandler()).build();
        doThrow(new SecurityException("denied")).when(templates).require(actor,"reports.definition.manage","reports.appearance.manage","settings.configuration.manage");
        mvc.perform(multipart("/reports/templates/layout/components/header").file(new org.springframework.mock.web.MockMultipartFile("file","test.docx","application/octet-stream",new byte[]{1}))).andExpect(status().isForbidden());
        verifyNoInteractions(words);
        reset(templates);
        mvc.perform(multipart("/reports/templates/layout/components/header").file(new org.springframework.mock.web.MockMultipartFile("file","test.docx","application/octet-stream",new byte[2097153]))).andExpect(status().isBadRequest());
        verifyNoInteractions(words);
        var ref=new ReportLayout.WordComponent(UUID.randomUUID(),"a".repeat(64),"test.docx",List.of("report.title"));
        when(words.upload(eq(actor),eq("header"),eq("test.docx"),any(byte[].class))).thenReturn(ref);
        mvc.perform(multipart("/reports/templates/layout/components/header").file(new org.springframework.mock.web.MockMultipartFile("file","test.docx","application/octet-stream",new byte[]{1}))).andExpect(status().isOk()).andExpect(jsonPath("$.placeholders[0]").value("report.title"));
    }
    @Test void layoutPreviewCannotBypassConfigurationPermission() throws Exception {
        var templates=mock(ReportTemplateService.class);var users=mock(CurrentUserService.class);var actor=new UserAccount();
        when(users.requireCurrentUser()).thenReturn(actor);doThrow(new SecurityException("private roles")).when(templates).require(actor,"reports.definition.manage","reports.appearance.manage","settings.configuration.manage");
        var mvc=MockMvcBuilders.standaloneSetup(new ReportLayoutController(templates,users)).setControllerAdvice(new ReportAccessExceptionHandler(),new GlobalExceptionHandler()).build();
        mvc.perform(post("/reports/templates/layout/preview").contentType("application/json").content(new ObjectMapper().writeValueAsString(Map.of("title","TEST","layout",ReportLayout.defaults()))))
                .andExpect(status().isForbidden()).andExpect(jsonPath("$.error.code").value("REPORT_SCOPE_DENIED"));
    }
    @Test void serverPreviewIsPdfNotStoredReportAndInvalidTokenIsRejected() throws Exception {
        var templates=mock(ReportTemplateService.class);var users=mock(CurrentUserService.class);var actor=new UserAccount();actor.setId(UUID.randomUUID());actor.setFullName("Administrator");when(users.requireCurrentUser()).thenReturn(actor);
        var mvc=MockMvcBuilders.standaloneSetup(new ReportLayoutController(templates,users)).setControllerAdvice(new ReportAccessExceptionHandler(),new GlobalExceptionHandler()).build();
        var json=new ObjectMapper();
        mvc.perform(post("/reports/templates/layout/preview").contentType("application/json").content(json.writeValueAsString(Map.of("title","TEST","layout",ReportLayout.defaults()))))
                .andExpect(status().isOk()).andExpect(content().contentType("application/pdf")).andExpect(header().string("Cache-Control","no-store"));
        var bad=new ReportLayout(true,"{{password}}","",true,true,"","",true,false,"",false,"");
        mvc.perform(post("/reports/templates/layout/preview").contentType("application/json").content(json.writeValueAsString(Map.of("title","TEST","layout",bad))))
                .andExpect(status().isBadRequest());
        verify(templates,times(2)).require(actor,"reports.definition.manage","reports.appearance.manage","settings.configuration.manage");verifyNoMoreInteractions(templates);
    }
    /** The appearances have their own controller: a person without the permission gets "forbidden", not a server error (REPORT-APPEARANCE-PERMISSION-2026-11-14). */
    @Test void theAppearanceScreenAnswersForbiddenWithoutItsPermission() throws Exception {
        var appearances=mock(ReportAppearanceService.class);var users=mock(CurrentUserService.class);var actor=new UserAccount();when(users.requireCurrentUser()).thenReturn(actor);
        var mvc=MockMvcBuilders.standaloneSetup(new ReportAppearanceController(mock(ReportPropertiesService.class),appearances,users)).setControllerAdvice(new ReportAccessExceptionHandler(),new GlobalExceptionHandler()).build();
        when(appearances.list(eq(actor),any(),any(),any(),anyInt(),anyInt())).thenThrow(new SecurityException("REPORT_SCOPE_DENIED"));
        mvc.perform(get("/reports/appearance")).andExpect(status().isForbidden());
        doThrow(new SecurityException("REPORT_SCOPE_DENIED")).when(appearances).activate(eq(actor),any());
        mvc.perform(post("/reports/appearance/"+java.util.UUID.randomUUID()+"/activate")).andExpect(status().isForbidden());
        doReturn(java.util.Map.of("data",java.util.List.of())).when(appearances).list(eq(actor),any(),any(),any(),anyInt(),anyInt());
        mvc.perform(get("/reports/appearance")).andExpect(status().isOk()).andExpect(jsonPath("$.data").isArray());
    }
}
