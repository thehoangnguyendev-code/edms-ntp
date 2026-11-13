package com.eqms.service.report;

import com.eqms.service.DocumentAuthorizationService;
import com.eqms.service.PermissionEvaluationService;
import com.eqms.service.SystemConfigurationService;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Builds the Document Control visibility of the report providers for tests. */
final class ReportTestVisibility {
    private ReportTestVisibility() {}

    /** A person who sees everything in Document Control: the visibility adds no condition. */
    static DocumentReportVisibility everything() {
        DocumentAuthorizationService authorization = mock(DocumentAuthorizationService.class);
        when(authorization.canListAllDocuments(any())).thenReturn(true);
        when(authorization.canViewAllControlledCopies(any())).thenReturn(true);
        when(authorization.canViewAllUncontrolledCopies(any())).thenReturn(true);
        PermissionEvaluationService permissions = mock(PermissionEvaluationService.class);
        when(permissions.hasPermission(any(), any())).thenReturn(true);
        return new DocumentReportVisibility(authorization, permissions, mock(SystemConfigurationService.class));
    }
}
