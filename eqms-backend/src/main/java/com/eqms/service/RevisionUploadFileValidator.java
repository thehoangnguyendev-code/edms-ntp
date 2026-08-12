package com.eqms.service;

import com.eqms.exception.RevisionUploadValidationException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.xml.sax.SAXException;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

/**
 * Server-side trust boundary for revision source files. Browser-provided MIME
 * types are deliberately ignored; a source file must be a structurally valid
 * DOCX (OOXML ZIP) before it may be malware-scanned or stored.
 */
@Service
public class RevisionUploadFileValidator {

    public static final String DOCX_MIME_TYPE =
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    private static final int MAX_ZIP_ENTRIES = 10_000;
    private static final long MAX_UNCOMPRESSED_DOCX_BYTES = 200L * 1024L * 1024L;
    private static final long MAX_REQUIRED_XML_ENTRY_BYTES = 20L * 1024L * 1024L;
    private static final Set<String> REQUIRED_OOXML_ENTRIES = Set.of(
            "[Content_Types].xml",
            "word/document.xml"
    );
    private static final String CONTENT_TYPES_NAMESPACE =
            "http://schemas.openxmlformats.org/package/2006/content-types";
    private static final String WORDPROCESSINGML_NAMESPACE =
            "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
    private static final String WORD_DOCUMENT_CONTENT_TYPE =
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";

    private final SystemConfigurationService systemConfigurationService;
    private final ClamAvScanService clamAvScanService;

    public RevisionUploadFileValidator(
            SystemConfigurationService systemConfigurationService,
            ClamAvScanService clamAvScanService
    ) {
        this.systemConfigurationService = systemConfigurationService;
        this.clamAvScanService = clamAvScanService;
    }

    public ValidatedRevisionFile validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new RevisionUploadValidationException("REVISION_FILE_REQUIRED", "A DOCX source file is required.");
        }

        validateSize(file.getSize());
        String originalFileName = file.getOriginalFilename();
        validateDocxExtension(originalFileName);

        final byte[] content;
        try {
            content = file.getBytes();
        } catch (IOException ex) {
            throw new RevisionUploadValidationException("REVISION_FILE_READ_FAILED", "The selected DOCX file could not be read.");
        }

        return validateContent(originalFileName, content);
    }

    /** Validates a stored template before it is copied into a new revision. */
    public ValidatedRevisionFile validateStoredDocx(String originalFileName, byte[] content) {
        if (content == null || content.length == 0) {
            throw new RevisionUploadValidationException("REVISION_FILE_REQUIRED", "A DOCX source file is required.");
        }
        validateSize(content.length);
        validateDocxExtension(originalFileName);
        return validateContent(originalFileName, content);
    }

    private ValidatedRevisionFile validateContent(String originalFileName, byte[] content) {
        validateZipSignature(content);
        validateOoxmlStructure(content);

        boolean malwareScanPerformed = clamAvScanService.isEnabled();
        ClamAvScanService.ScanResult scanResult = clamAvScanService.scan(content);
        if (!scanResult.clean()) {
            throw new RevisionUploadValidationException("MALWARE_DETECTED", "The DOCX file was rejected by the malware scanner.");
        }

        return new ValidatedRevisionFile(
                normalizeFileName(originalFileName),
                DOCX_MIME_TYPE,
                sha256(content),
                malwareScanPerformed
        );
    }

    private void validateSize(long fileSize) {
        int maxFileSizeMb = systemConfigurationService.getDocumentMaxFileSizeMb();
        long maxBytes = (long) Math.max(maxFileSizeMb, 1) * 1024L * 1024L;
        if (fileSize > maxBytes) {
            throw new RevisionUploadValidationException(
                    "REVISION_FILE_TOO_LARGE",
                    "Selected DOCX file exceeds the maximum allowed size of " + Math.max(maxFileSizeMb, 1) + " MB."
            );
        }
    }

    private void validateDocxExtension(String fileName) {
        String normalizedName = normalizeFileName(fileName).toLowerCase(Locale.ROOT);
        if (!normalizedName.endsWith(".docx")) {
            throw new RevisionUploadValidationException(
                    "UNSUPPORTED_REVISION_FILE_TYPE",
                    "Only Microsoft Word DOCX (.docx) files are accepted for revision source files."
            );
        }
    }

    private void validateZipSignature(byte[] content) {
        if (content.length < 4
                || content[0] != 0x50
                || content[1] != 0x4B
                || content[2] != 0x03
                || content[3] != 0x04) {
            throw new RevisionUploadValidationException(
                    "INVALID_DOCX_SIGNATURE",
                    "The selected file is not a valid DOCX document."
            );
        }
    }

    private void validateOoxmlStructure(byte[] content) {
        Set<String> entries = new HashSet<>();
        long extractedBytes = 0;
        int entryCount = 0;

        try (ZipInputStream zipInputStream = new ZipInputStream(new ByteArrayInputStream(content))) {
            ZipEntry entry;
            byte[] buffer = new byte[8192];
            while ((entry = zipInputStream.getNextEntry()) != null) {
                entryCount++;
                if (entryCount > MAX_ZIP_ENTRIES) {
                    throw new RevisionUploadValidationException("DOCX_ARCHIVE_TOO_COMPLEX", "The DOCX archive contains too many entries.");
                }
                String entryName = entry.getName();
                if (entryName == null || entryName.startsWith("/") || entryName.contains("..\\") || entryName.contains("../")) {
                    throw new RevisionUploadValidationException("INVALID_DOCX_ARCHIVE", "The DOCX archive contains an unsafe entry path.");
                }
                if (!entries.add(entryName)) {
                    throw new RevisionUploadValidationException("INVALID_DOCX_ARCHIVE", "The DOCX archive contains duplicate entries.");
                }
                validateSafeOoxmlEntryName(entryName);

                int read;
                while ((read = zipInputStream.read(buffer)) != -1) {
                    extractedBytes += read;
                    if (extractedBytes > MAX_UNCOMPRESSED_DOCX_BYTES) {
                        throw new RevisionUploadValidationException("DOCX_ARCHIVE_TOO_LARGE", "The DOCX archive expands beyond the allowed safety limit.");
                    }
                }
                zipInputStream.closeEntry();
            }
        } catch (RevisionUploadValidationException ex) {
            throw ex;
        } catch (IOException ex) {
            throw new RevisionUploadValidationException("INVALID_DOCX_ARCHIVE", "The selected DOCX archive is invalid or corrupted.");
        }

        if (!entries.containsAll(REQUIRED_OOXML_ENTRIES)) {
            throw new RevisionUploadValidationException(
                    "INVALID_DOCX_OOXML",
                    "The selected file is not a valid Word DOCX document."
            );
        }

        validateRequiredOoxmlXml(content);
    }

    private void validateRequiredOoxmlXml(byte[] content) {
        Map<String, Document> requiredDocuments = new java.util.HashMap<>();
        try (ZipInputStream zipInputStream = new ZipInputStream(new ByteArrayInputStream(content))) {
            ZipEntry entry;
            while ((entry = zipInputStream.getNextEntry()) != null) {
                if (REQUIRED_OOXML_ENTRIES.contains(entry.getName())) {
                    requiredDocuments.put(
                            entry.getName(),
                            secureDocumentBuilderFactory().newDocumentBuilder()
                                    .parse(new ByteArrayInputStream(readRequiredXmlEntry(zipInputStream)))
                    );
                }
                zipInputStream.closeEntry();
            }
        } catch (RevisionUploadValidationException ex) {
            throw ex;
        } catch (IOException | ParserConfigurationException | SAXException ex) {
            throw new RevisionUploadValidationException(
                    "INVALID_DOCX_OOXML",
                    "The selected file is not a valid Word DOCX document."
            );
        }

        validateContentTypes(requiredDocuments.get("[Content_Types].xml"));
        validateWordDocument(requiredDocuments.get("word/document.xml"));
    }

    private void validateSafeOoxmlEntryName(String entryName) {
        String normalized = entryName.toLowerCase(Locale.ROOT);
        if (normalized.equals("word/vbaproject.bin")
                || normalized.startsWith("word/activex/")
                || normalized.startsWith("word/embeddings/")
                || normalized.startsWith("customui/")) {
            throw new RevisionUploadValidationException(
                    "UNSAFE_DOCX_CONTENT",
                    "Macro-enabled, ActiveX, embedded-object, and custom UI content is not allowed in revision DOCX files."
            );
        }
    }

    private void validateContentTypes(Document contentTypes) {
        if (contentTypes == null
                || !CONTENT_TYPES_NAMESPACE.equals(contentTypes.getDocumentElement().getNamespaceURI())
                || !"Types".equals(contentTypes.getDocumentElement().getLocalName())) {
            throw new RevisionUploadValidationException("INVALID_DOCX_OOXML", "The DOCX content-types manifest is invalid.");
        }

        boolean hasMainDocumentType = false;
        NodeList overrides = contentTypes.getElementsByTagNameNS(CONTENT_TYPES_NAMESPACE, "Override");
        for (int index = 0; index < overrides.getLength(); index++) {
            Element override = (Element) overrides.item(index);
            String contentType = override.getAttribute("ContentType").toLowerCase(Locale.ROOT);
            if (contentType.contains("macroenabled") || contentType.contains("vbaproject")) {
                throw new RevisionUploadValidationException("UNSAFE_DOCX_CONTENT", "Macro-enabled DOCX content is not allowed.");
            }
            if ("/word/document.xml".equals(override.getAttribute("PartName"))
                    && WORD_DOCUMENT_CONTENT_TYPE.equalsIgnoreCase(override.getAttribute("ContentType"))) {
                hasMainDocumentType = true;
            }
        }
        if (!hasMainDocumentType) {
            throw new RevisionUploadValidationException("INVALID_DOCX_OOXML", "The DOCX main document content type is invalid.");
        }
    }

    private void validateWordDocument(Document wordDocument) {
        if (wordDocument == null
                || !WORDPROCESSINGML_NAMESPACE.equals(wordDocument.getDocumentElement().getNamespaceURI())
                || !"document".equals(wordDocument.getDocumentElement().getLocalName())) {
            throw new RevisionUploadValidationException("INVALID_DOCX_OOXML", "The DOCX main document XML is invalid.");
        }
    }

    private byte[] readRequiredXmlEntry(ZipInputStream zipInputStream) throws IOException {
        try (ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            long total = 0;
            int read;
            while ((read = zipInputStream.read(buffer)) != -1) {
                total += read;
                if (total > MAX_REQUIRED_XML_ENTRY_BYTES) {
                    throw new RevisionUploadValidationException(
                            "DOCX_XML_ENTRY_TOO_LARGE",
                            "The DOCX document contains an XML entry beyond the allowed safety limit."
                    );
                }
                output.write(buffer, 0, read);
            }
            return output.toByteArray();
        }
    }

    private DocumentBuilderFactory secureDocumentBuilderFactory() throws ParserConfigurationException {
        DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
        factory.setNamespaceAware(true);
        factory.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
        factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
        factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
        factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
        factory.setXIncludeAware(false);
        factory.setExpandEntityReferences(false);
        return factory;
    }

    private String normalizeFileName(String fileName) {
        return StringUtils.hasText(fileName) ? fileName.trim() : "document.docx";
    }

    private String sha256(byte[] content) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(content));
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 is not available", ex);
        }
    }

    public record ValidatedRevisionFile(
            String originalFileName,
            String detectedContentType,
            String sha256,
            boolean malwareScanPerformed
    ) {
    }
}
