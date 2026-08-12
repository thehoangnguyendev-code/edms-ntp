package com.eqms.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.microsoft-graph")
public class MicrosoftGraphStorageProperties {

    private String baseUrl;
    private String tenantId;
    private String clientId;
    private String clientSecret;
    private String siteId;
    private String driveId;
    private String libraryFolder = "EQMS";
    private String shareLinkScope = "organization";
    private String externalInviteRedirectUrl;

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getTenantId() {
        return tenantId;
    }

    public void setTenantId(String tenantId) {
        this.tenantId = tenantId;
    }

    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    public String getClientSecret() {
        return clientSecret;
    }

    public void setClientSecret(String clientSecret) {
        this.clientSecret = clientSecret;
    }

    public String getSiteId() {
        return siteId;
    }

    public void setSiteId(String siteId) {
        this.siteId = siteId;
    }

    public String getDriveId() {
        return driveId;
    }

    public void setDriveId(String driveId) {
        this.driveId = driveId;
    }

    public String getLibraryFolder() {
        return libraryFolder;
    }

    public void setLibraryFolder(String libraryFolder) {
        this.libraryFolder = libraryFolder;
    }

    /** Backward-compatible binding for the existing application property name. */
    public void setFolderPath(String folderPath) {
        this.libraryFolder = folderPath;
    }

    public String getShareLinkScope() {
        return shareLinkScope;
    }

    public void setShareLinkScope(String shareLinkScope) {
        this.shareLinkScope = shareLinkScope;
    }

    public String getExternalInviteRedirectUrl() {
        return externalInviteRedirectUrl;
    }

    public void setExternalInviteRedirectUrl(String externalInviteRedirectUrl) {
        this.externalInviteRedirectUrl = externalInviteRedirectUrl;
    }
}
