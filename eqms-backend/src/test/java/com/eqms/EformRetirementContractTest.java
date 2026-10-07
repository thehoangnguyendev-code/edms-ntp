package com.eqms;

import com.eqms.controller.ExecutedRecordController;
import com.eqms.service.ControlledCopyService;
import com.eqms.service.OnlyOfficeDocumentEditService;
import com.eqms.service.editprovider.EditMode;
import com.eqms.entity.ControlledCopyRecord;
import com.eqms.repository.ControlledCopyRepository;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Arrays;
import java.util.Optional;
import java.util.UUID;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class EformRetirementContractTest {
    @Test
    void retiredSubmissionEndpointsAreNotMapped() throws Exception {
        var mvc = MockMvcBuilders.standaloneSetup(new ExecutedRecordController(
                mock(com.eqms.service.ExecutedRecordService.class), new ObjectMapper())).build();
        String base = "/forms/" + UUID.randomUUID() + "/executed-records/";
        mvc.perform(post(base + "submit-eform")).andExpect(status().isNotFound());
        mvc.perform(post(base + "submit-eform-session")).andExpect(status().isNotFound());
    }

    @Test
    void ordinaryOnlyOfficeModesRemainButFillAndSessionApiAreGone() {
        assertArrayEquals(new EditMode[]{EditMode.EDIT, EditMode.REVIEW, EditMode.COMMENT_ONLY, EditMode.VIEW}, EditMode.values());
        assertFalse(Arrays.stream(OnlyOfficeDocumentEditService.class.getDeclaredMethods())
                .anyMatch(m -> m.getName().contains("FormSession") || m.getName().equals("convertLocalFileToDocxf")));
    }
}
