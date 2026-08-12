package com.eqms.repository;

import com.eqms.entity.PublishingTemplatePlaceholderStyle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface PublishingTemplatePlaceholderStyleRepository extends JpaRepository<PublishingTemplatePlaceholderStyle, UUID> {
    List<PublishingTemplatePlaceholderStyle> findByTemplate_IdAndTemplateVersionNumberOrderByComponentTypeAscLayoutAscPlaceholderKeyAsc(UUID templateId, int templateVersionNumber);
    List<PublishingTemplatePlaceholderStyle> findByTemplate_IdAndTemplateVersionNumberAndComponentTypeIgnoreCaseAndLayoutIgnoreCaseOrderByPlaceholderKeyAsc(UUID templateId, int templateVersionNumber, String componentType, String layout);
    Optional<PublishingTemplatePlaceholderStyle> findByTemplate_IdAndTemplateVersionNumberAndComponentTypeIgnoreCaseAndLayoutIgnoreCaseAndPlaceholderKeyIgnoreCase(UUID templateId, int templateVersionNumber, String componentType, String layout, String placeholderKey);
    List<PublishingTemplatePlaceholderStyle> findByTemplate_IdAndTemplateVersionNumberAndComponentTypeIgnoreCaseAndLayoutIgnoreCase(UUID templateId, int templateVersionNumber, String componentType, String layout);
    void deleteByTemplate_IdAndTemplateVersionNumberAndComponentTypeIgnoreCaseAndLayoutIgnoreCaseAndPlaceholderKeyIgnoreCase(UUID templateId, int templateVersionNumber, String componentType, String layout, String placeholderKey);
    List<PublishingTemplatePlaceholderStyle> findByTemplate_IdOrderByTemplateVersionNumberDescComponentTypeAscLayoutAscPlaceholderKeyAsc(UUID templateId);
    Optional<PublishingTemplatePlaceholderStyle> findTopByTemplate_IdOrderByTemplateVersionNumberDesc(UUID templateId);
}
