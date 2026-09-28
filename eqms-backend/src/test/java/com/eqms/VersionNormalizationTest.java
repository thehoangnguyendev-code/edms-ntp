package com.eqms;

import com.eqms.service.ControlledCopyService;
import com.eqms.service.RevisionService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class VersionNormalizationTest {

    @Test
    public void testRevisionServiceNormalizeVersionFormat() throws Exception {
        RevisionService service = Mockito.mock(RevisionService.class, Mockito.CALLS_REAL_METHODS);
        Method method = RevisionService.class.getDeclaredMethod("normalizeVersionFormat", String.class);
        method.setAccessible(true);

        // Blank -> configured seed; falls back to "0.0.1" when config is unavailable (mock).
        assertEquals("0.0.1", method.invoke(service, (String) null));
        assertEquals("0.0.1", method.invoke(service, ""));
        assertEquals("0.0.1", method.invoke(service, "   "));

        // Three-part family is preserved and canonicalised (middle always 0).
        assertEquals("0.0.1", method.invoke(service, "0.0.1"));
        assertEquals("1.0.0", method.invoke(service, "1.0.0"));
        assertEquals("0.0.1", method.invoke(service, "0.1.0"));
        assertEquals("2.0.3", method.invoke(service, "2.0.3"));

        // Two-part family is now PRESERVED (previously collapsed to three-part).
        assertEquals("1.0", method.invoke(service, "1.0"));
        assertEquals("0.1", method.invoke(service, "0.1"));
        assertEquals("1.1", method.invoke(service, "1.1"));
        assertEquals("2.3", method.invoke(service, "2.3"));
    }

    @Test
    public void testRevisionServiceIncrementPatchVersion() throws Exception {
        RevisionService service = Mockito.mock(RevisionService.class, Mockito.CALLS_REAL_METHODS);
        Method method = RevisionService.class.getDeclaredMethod("incrementPatchVersion", String.class);
        method.setAccessible(true);

        // Three-part family
        assertEquals("0.0.2", method.invoke(service, "0.0.1"));
        assertEquals("1.0.1", method.invoke(service, "1.0.0"));
        assertEquals("1.0.2", method.invoke(service, "1.0.1"));
        assertEquals("2.0.4", method.invoke(service, "2.0.3"));

        // Two-part family
        assertEquals("0.2", method.invoke(service, "0.1"));
        assertEquals("0.4", method.invoke(service, "0.3"));
        assertEquals("1.1", method.invoke(service, "1.0"));
        assertEquals("1.3", method.invoke(service, "1.2"));
    }

    @Test
    public void testRevisionServicePromoteToNextMajorVersion() throws Exception {
        RevisionService service = Mockito.mock(RevisionService.class, Mockito.CALLS_REAL_METHODS);
        Method method = RevisionService.class.getDeclaredMethod("promoteToNextMajorVersion", String.class);
        method.setAccessible(true);

        assertEquals("1.0.0", method.invoke(service, "0.0.3"));
        assertEquals("2.0.0", method.invoke(service, "1.0.2"));
        assertEquals("1.0", method.invoke(service, "0.3"));
        assertEquals("2.0", method.invoke(service, "1.2"));
    }

    @Test
    public void testRevisionServiceNextDraftFromEffective() throws Exception {
        RevisionService service = Mockito.mock(RevisionService.class, Mockito.CALLS_REAL_METHODS);
        Method method = RevisionService.class.getDeclaredMethod("resolveNextDraftRevisionNumberFromEffective", String.class);
        method.setAccessible(true);

        assertEquals("1.0.1", method.invoke(service, "1.0.0"));
        assertEquals("2.0.1", method.invoke(service, "2.0.0"));
        assertEquals("1.1", method.invoke(service, "1.0"));
        assertEquals("2.1", method.invoke(service, "2.0"));
    }

    @Test
    public void testRevisionServiceCompareRevisionNumbers() throws Exception {
        RevisionService service = Mockito.mock(RevisionService.class, Mockito.CALLS_REAL_METHODS);
        Method method = RevisionService.class.getDeclaredMethod("compareRevisionNumbers", String.class, String.class);
        method.setAccessible(true);

        assertEquals(true, ((int) method.invoke(service, "0.0.1", "0.0.2")) < 0);
        assertEquals(true, ((int) method.invoke(service, "1.0.0", "0.0.9")) > 0);
        assertEquals(0, ((int) method.invoke(service, "1.0.2", "1.0.2")));
        // Two-part family
        assertEquals(true, ((int) method.invoke(service, "0.1", "0.2")) < 0);
        assertEquals(true, ((int) method.invoke(service, "1.0", "0.5")) > 0);
        assertEquals(0, ((int) method.invoke(service, "0.3", "0.3")));
    }

    @Test
    public void testControlledCopyServiceNormalizeVersionFormat() throws Exception {
        ControlledCopyService service = Mockito.mock(ControlledCopyService.class, Mockito.CALLS_REAL_METHODS);
        Method method = ControlledCopyService.class.getDeclaredMethod("normalizeVersionFormat", String.class);
        method.setAccessible(true);

        assertEquals("0.0.1", method.invoke(service, (String) null));
        assertEquals("0.0.1", method.invoke(service, ""));
        assertEquals("0.0.1", method.invoke(service, "   "));
        assertEquals("0.0.1", method.invoke(service, "0.0.1"));
        assertEquals("1.0.0", method.invoke(service, "1.0.0"));
        assertEquals("0.0.1", method.invoke(service, "0.1.0"));
        assertEquals("2.0.3", method.invoke(service, "2.0.3"));
        // Two-part family preserved (mirrors RevisionService).
        assertEquals("1.0", method.invoke(service, "1.0"));
        assertEquals("0.1", method.invoke(service, "0.1"));
        assertEquals("1.1", method.invoke(service, "1.1"));
    }
}
