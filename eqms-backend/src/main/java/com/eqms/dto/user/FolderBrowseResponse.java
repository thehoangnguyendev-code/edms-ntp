package com.eqms.dto.user;

public record FolderBrowseResponse(
        String id,
        String name,
        String path,
        String webUrl
) {}
