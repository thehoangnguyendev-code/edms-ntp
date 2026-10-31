package com.eqms.controller;

import com.eqms.service.VerifiedDownloadService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.*;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.context.request.async.CallableProcessingInterceptor;
import org.springframework.web.context.request.async.WebAsyncUtils;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Callable;

/** MVC cleanup also runs when the async task times out before it starts writing. */
final class VerifiedDownloadResponses {
    private VerifiedDownloadResponses() { }
    static ResponseEntity<StreamingResponseBody> attachment(HttpServletRequest request,
            VerifiedDownloadService.Prepared file,String filename,String mime) throws IOException {
        try {
            var type=MediaType.parseMediaType(mime);
            var disposition=ContentDisposition.attachment().filename(filename.replace("\r","").replace("\n",""),StandardCharsets.UTF_8).build();
            WebAsyncUtils.getAsyncManager(request).registerCallableInterceptor(file,new CallableProcessingInterceptor(){
                @Override public <T> void afterCompletion(NativeWebRequest webRequest,Callable<T> task) throws Exception {file.close();}
            });
            StreamingResponseBody body=output->{try(file){file.transferTo(output);}};
            return ResponseEntity.ok().contentType(type).contentLength(file.size()).header(HttpHeaders.CONTENT_DISPOSITION,disposition.toString())
                    .header(HttpHeaders.CACHE_CONTROL,"no-store").header("X-Content-Type-Options","nosniff").body(body);
        } catch(RuntimeException invalidResponse) {file.close();throw invalidResponse;}
    }
}
