package com.eqms.bootstrap;

import com.eqms.service.PublishingTemplateService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

/**
 * Publishing Template components stored before placeholder detection existed have no detected-placeholder list, so the
 * template screen showed none for them. This computes it from the stored file once; it is idempotent and never blocks start-up.
 */
@Component
@Order(7)
public class PublishingTemplatePlaceholderBackfillBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(PublishingTemplatePlaceholderBackfillBootstrap.class);

    private final PublishingTemplateService publishingTemplateService;

    public PublishingTemplatePlaceholderBackfillBootstrap(PublishingTemplateService publishingTemplateService) {
        this.publishingTemplateService = publishingTemplateService;
    }

    @Override
    public void run(ApplicationArguments args) {
        try {
            int updated = publishingTemplateService.backfillMissingDetectedPlaceholders();
            if (updated > 0) {
                log.info("Detected placeholders were computed for {} Publishing Template component(s)", updated);
            }
        } catch (RuntimeException ex) {
            log.warn("Publishing Template placeholder backfill skipped: {}", ex.toString());
        }
    }
}
