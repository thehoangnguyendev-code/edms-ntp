package com.eqms.service;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.w3c.dom.Document;
import org.w3c.dom.NodeList;
import org.xml.sax.SAXException;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Discovers the OnlyOffice Form Roles placed on a Form's committed fillable template (.docxf) --
 * the equivalent, for live eForm fields, of what {@code PublishingTemplateInspectionService} does
 * for a Publishing Template's {@code {{token}}} text placeholders: scan the file, return the
 * distinct names found, let the DCO map each one to a person when configuring an electronic
 * Controlled Copy's signer chain (see EformSignerAssignment).
 *
 * <p>Verified against a real committed .docxf (this session, by downloading and unzipping one):
 * each Role used by the template gets its own {@code oform/userMasters/<id>.xml} part, a small
 * plain-XML file shaped {@code <user><role>RoleName</role>...</user>}. The default,
 * unassigned-field placeholder role is literally named {@code "Anyone"} and is excluded here --
 * it is not a real signer role.
 */
@Service
public class EformFieldScanService {

    private static final String ANYONE_ROLE = "Anyone";
    private static final String USER_MASTER_PREFIX = "oform/userMasters/";
    private static final int MAX_ZIP_ENTRIES = 2000;
    private static final long MAX_ENTRY_BYTES = 2L * 1024 * 1024; // 2 MiB -- a userMaster part is a few hundred bytes

    public List<String> scanRoleNames(byte[] docxfBytes) {
        LinkedHashSet<String> roles = new LinkedHashSet<>();
        try (ZipInputStream zipInputStream = new ZipInputStream(new ByteArrayInputStream(docxfBytes))) {
            ZipEntry entry;
            int entryCount = 0;
            while ((entry = zipInputStream.getNextEntry()) != null) {
                entryCount++;
                if (entryCount > MAX_ZIP_ENTRIES) {
                    throw new IllegalStateException("This Form's fillable template is too complex to scan.");
                }
                String name = entry.getName();
                if (name != null && name.startsWith(USER_MASTER_PREFIX) && name.endsWith(".xml")) {
                    byte[] content = readEntryBounded(zipInputStream);
                    String role = extractRole(content);
                    if (StringUtils.hasText(role) && !ANYONE_ROLE.equalsIgnoreCase(role)) {
                        roles.add(role);
                    }
                }
                zipInputStream.closeEntry();
            }
        } catch (IOException ex) {
            throw new IllegalStateException("Unable to read this Form's fillable template to scan for signer roles.", ex);
        }
        return roles.stream().sorted(String.CASE_INSENSITIVE_ORDER).toList();
    }

    private byte[] readEntryBounded(ZipInputStream zipInputStream) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        byte[] chunk = new byte[8192];
        long total = 0;
        int read;
        while ((read = zipInputStream.read(chunk)) != -1) {
            total += read;
            if (total > MAX_ENTRY_BYTES) {
                throw new IllegalStateException("This Form's fillable template contains an unexpectedly large part.");
            }
            buffer.write(chunk, 0, read);
        }
        return buffer.toByteArray();
    }

    private String extractRole(byte[] xmlContent) {
        try {
            Document document = secureDocumentBuilderFactory().newDocumentBuilder()
                    .parse(new ByteArrayInputStream(xmlContent));
            NodeList roleNodes = document.getElementsByTagName("role");
            if (roleNodes.getLength() == 0) {
                return null;
            }
            String text = roleNodes.item(0).getTextContent();
            return StringUtils.hasText(text) ? text.trim() : null;
        } catch (IOException | ParserConfigurationException | SAXException ex) {
            // A userMaster part that doesn't parse as expected is skipped, not fatal to the scan.
            return null;
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
}
