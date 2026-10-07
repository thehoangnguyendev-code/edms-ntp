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
        doThrow(new SecurityException("denied")).when(templates).require(actor,"reports.definition.manage","settings.configuration.manage");
        mvc.perform(multipart("/reports/templates/layout/components/header").file(new org.springframework.mock.web.MockMultipartFile("file","test.docx","application/octet-stream",new byte[]{1}))).andExpect(status().isForbidden());
        verifyNoInteractions(words);
        reset(templates);
        mvc.perform(multipart("/reports/templates/layout/components/header").file(new org.springframework.mock.web.MockMultipartFile("file","test.docx","application/octet-stream",new byte[2097153]))).andExpect(status().isBadRequest());
        verifyNoInteractions(words);
        var ref=new ReportLayout.WordComponent(UUID.randomUUID(),"a".repeat(64),"test.docx",List.of("report.title"));
        when(words.upload(eq(actor),eq("header"),eq("test.docx"),any(byte[].class))).thenReturn(ref);
        mvc.perform(multipart("/reports/templates/layout/components/header").file(new org.springframework.mock.web.MockMultipartFile("file","test.docx","application/octet-stream",new byte[]{1}))).andExpect(status().isOk()).andExpect(jsonPath("$.placeholders[0]").value("report.title"));
    }
    @Test void rasterPreviewUsesSameAuthorizationAndRejectsNonexistentPages() throws Exception {
        var templates=mock(ReportTemplateService.class);var users=mock(CurrentUserService.class);var actor=new UserAccount();
        actor.setId(UUID.randomUUID());actor.setFullName("Administrator");when(users.requireCurrentUser()).thenReturn(actor);
        var mvc=MockMvcBuilders.standaloneSetup(new ReportLayoutController(templates,users)).setControllerAdvice(new ReportAccessExceptionHandler(),new GlobalExceptionHandler()).build();
        var mapper=new ObjectMapper();
        var request=Map.of("title","TEST","layout",ReportLayout.defaults(),"page",1);
        byte[] image=mvc.perform(post("/reports/templates/layout/preview-page").contentType("application/json").content(mapper.writeValueAsString(request)))
            .andExpect(status().isOk()).andExpect(content().contentType("image/png")).andExpect(header().string("Cache-Control","no-store")).andReturn().getResponse().getContentAsByteArray();
        org.junit.jupiter.api.Assertions.assertNotNull(javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(image)));
        mvc.perform(post("/reports/templates/layout/preview-page").contentType("application/json").content(mapper.writeValueAsString(Map.of("title","TEST","layout",ReportLayout.defaults(),"page",8))))
            .andExpect(status().isBadRequest());
        doThrow(new SecurityException("denied")).when(templates).require(actor,"reports.definition.manage","settings.configuration.manage");
        mvc.perform(post("/reports/templates/layout/preview-page").contentType("application/json").content(mapper.writeValueAsString(request))).andExpect(status().isForbidden());
        verify(templates,times(3)).require(actor,"reports.definition.manage","settings.configuration.manage");verifyNoMoreInteractions(templates);
    }
    @Test void layoutPreviewCannotBypassConfigurationPermission() throws Exception {
        var templates=mock(ReportTemplateService.class);var users=mock(CurrentUserService.class);var actor=new UserAccount();
        when(users.requireCurrentUser()).thenReturn(actor);doThrow(new SecurityException("private roles")).when(templates).require(actor,"reports.definition.manage","settings.configuration.manage");
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
        verify(templates,times(2)).require(actor,"reports.definition.manage","settings.configuration.manage");verifyNoMoreInteractions(templates);
    }
}
