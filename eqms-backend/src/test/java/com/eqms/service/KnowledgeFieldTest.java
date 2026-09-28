package com.eqms.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.eqms.entity.BusinessUnit;
import com.eqms.entity.DocumentRecord;
import com.eqms.enums.KnowledgeField;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class KnowledgeFieldTest {

    @Test
    void parsesCodesCaseInsensitivelyAndRejectsUnknownOnes() {
        assertEquals(KnowledgeField.BUSINESS_UNIT, KnowledgeField.parse(" business_unit ").orElseThrow());
        assertTrue(KnowledgeField.parse("password_hash").isEmpty());
        assertTrue(KnowledgeField.parse(null).isEmpty());
    }

    @Test
    void extractsTheDocumentValueOrNullWhenTheDocumentHasNone() {
        DocumentRecord document = new DocumentRecord();
        assertNull(KnowledgeField.BUSINESS_UNIT.valueOf(document));
        assertNull(KnowledgeField.SUB_TYPE.valueOf(document));

        BusinessUnit unit = new BusinessUnit();
        UUID id = UUID.randomUUID();
        ReflectionTestUtils.setField(unit, "id", id);
        unit.setName("Quality Unit");
        document.setBusinessUnit(unit);
        document.setSubType("  Protocol ");

        KnowledgeField.Value value = KnowledgeField.BUSINESS_UNIT.valueOf(document);
        assertEquals(id.toString(), value.key());
        assertEquals("Quality Unit", value.label());
        assertEquals("Protocol", KnowledgeField.SUB_TYPE.valueOf(document).label());
    }
}
