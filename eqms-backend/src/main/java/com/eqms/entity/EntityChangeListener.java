package com.eqms.entity;

import com.eqms.service.EntityChangeBroadcaster;
import jakarta.persistence.PostPersist;
import jakarta.persistence.PostRemove;
import jakarta.persistence.PostUpdate;

/**
 * JPA listener that announces (ids only, after commit) every change to the entities whose state users watch on
 * screen. See {@link EntityChangeBroadcaster}. Bulk JPQL updates bypass JPA listeners and are not announced.
 */
public class EntityChangeListener {

    @PostPersist
    @PostUpdate
    @PostRemove
    public void onChange(Object entity) {
        if (entity instanceof DocumentRevisionRecord revision) {
            EntityChangeBroadcaster.changed("REVISION", revision.getId(),
                    revision.getDocument() == null ? null : revision.getDocument().getId());
        } else if (entity instanceof DocumentRecord document) {
            EntityChangeBroadcaster.changed("DOCUMENT", document.getId(), document.getId());
        } else if (entity instanceof ControlledCopyRecord copy) {
            EntityChangeBroadcaster.changed("CONTROLLED_COPY", copy.getId(),
                    copy.getDocument() == null ? null : copy.getDocument().getId());
        } else if (entity instanceof ControlledCopyDistributionBatch batch) {
            EntityChangeBroadcaster.changed("CONTROLLED_COPY_BATCH", batch.getId(),
                    batch.getDocument() == null ? null : batch.getDocument().getId());
        } else if (entity instanceof UncontrolledCopyRecord copy) {
            EntityChangeBroadcaster.changed("UNCONTROLLED_COPY", copy.getId(),
                    copy.getDocument() == null ? null : copy.getDocument().getId());
        }
    }
}
