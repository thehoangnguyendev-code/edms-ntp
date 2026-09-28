package com.eqms.config;

import jakarta.annotation.PostConstruct;
import org.apache.poi.openxml4j.util.ZipSecureFile;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * #7: Apache POI's {@link ZipSecureFile} already guards every {@code XWPFDocument}/OOXML zip
 * parse in this application (Publishing Template rendering/inspection, Revision e-signature PDF
 * preview) against the classic zip-bomb inflate-ratio attack via a JVM-wide static default. The
 * one gap is its default max single-entry size (4 GiB) -- far larger than any legitimate
 * component of a Publishing Template or Revision source .docx will ever be, so a crafted archive
 * with one enormous entry would otherwise be allowed to decompress far past what this application
 * needs before POI's ratio check has a chance to reject it. Lower that ceiling once, JVM-wide, at
 * startup; leave the inflate-ratio default alone since it is already a reasonable protection this
 * codebase has not needed to touch.
 */
@Component
public class OoxmlSecurityConfig {

    private static final Logger log = LoggerFactory.getLogger(OoxmlSecurityConfig.class);
    private static final long MAX_OOXML_ZIP_ENTRY_BYTES = 200L * 1024 * 1024; // 200 MiB

    @PostConstruct
    public void hardenOoxmlZipParsing() {
        ZipSecureFile.setMaxEntrySize(MAX_OOXML_ZIP_ENTRY_BYTES);
        log.info("OOXML zip parsing hardened: max single entry size capped at {} bytes", MAX_OOXML_ZIP_ENTRY_BYTES);
    }
}
