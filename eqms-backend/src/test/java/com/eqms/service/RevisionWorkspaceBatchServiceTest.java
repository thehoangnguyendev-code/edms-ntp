package com.eqms.service;

import com.eqms.dto.document.RevisionWorkspaceBatchRequest;
import com.eqms.dto.document.RevisionWorkspaceItemRequest;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

class RevisionWorkspaceBatchServiceTest {

    @Test
    void mapFilesByItemIndex_bindsSparseMultipartFileToItsDeclaredWorkspaceItem() {
        UUID sourceRevisionId = UUID.randomUUID();
        RevisionWorkspaceBatchRequest request = new RevisionWorkspaceBatchRequest(
                null,
                sourceRevisionId,
                null,
                null,
                "multi",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                List.of(
                        new RevisionWorkspaceItemRequest(UUID.randomUUID(), null, null, sourceRevisionId, null, null, 0, null),
                        new RevisionWorkspaceItemRequest(UUID.randomUUID(), null, null, sourceRevisionId, null, null, 1, null)
                ),
                List.of(1)
        );
        MockMultipartFile secondItemFile = new MockMultipartFile(
                "files", "second.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", new byte[]{1}
        );

        Map<Integer, org.springframework.web.multipart.MultipartFile> filesByItem =
                RevisionWorkspaceBatchService.mapFilesByItemIndex(request, List.of(secondItemFile));

        assertThat(filesByItem).containsOnlyKeys(1);
        assertThat(filesByItem.get(1)).isSameAs(secondItemFile);
    }
}
