package com.eqms.controller;

import com.eqms.service.*;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.http.HttpHeaders;
import java.io.ByteArrayOutputStream;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class VerifiedDownloadResponsesTest {
    @Test void streamingResponseHasSafeHeadersAndClosesAfterTransfer()throws Exception {
        var file=mock(VerifiedDownloadService.Prepared.class);when(file.size()).thenReturn(4L);
        var response=VerifiedDownloadResponses.attachment(new MockHttpServletRequest(),file,"report\r\n.pdf","application/pdf");
        assertEquals(4,response.getHeaders().getContentLength());assertEquals("no-store",response.getHeaders().getCacheControl());
        assertEquals("nosniff",response.getHeaders().getFirst("X-Content-Type-Options"));
        assertFalse(response.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION).contains("\r"));
        var output=new ByteArrayOutputStream();response.getBody().writeTo(output);
        verify(file).transferTo(output);verify(file).close();
    }
    @Test void invalidResponseMetadataClosesFileBeforeReturning()throws Exception {
        var file=mock(VerifiedDownloadService.Prepared.class);
        assertThrows(IllegalArgumentException.class,()->VerifiedDownloadResponses.attachment(new MockHttpServletRequest(),file,"report","invalid"));
        verify(file).close();verify(file,never()).transferTo(any());
    }
}
