package com.eqms.service;

import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import java.util.concurrent.atomic.AtomicBoolean;

@Service
public class NotificationEmailOutboxWorker {
    private final NotificationEmailOutbox outbox;
    private final TaskExecutor executor;
    private final AtomicBoolean running=new AtomicBoolean();

    public NotificationEmailOutboxWorker(NotificationEmailOutbox outbox,
            @Qualifier("notificationDeliveryExecutor") TaskExecutor executor) {this.outbox=outbox;this.executor=executor;}

    @Scheduled(fixedDelayString="${app.notifications.email-outbox-delay-ms:1000}")
    public void dispatch() {
        if(!running.compareAndSet(false,true))return;
        try {
            executor.execute(()->{
                try {
                    outbox.flagInterruptedDeliveries();
                    for(int i=0;i<10&&outbox.deliverOne();i++) { }
                } finally {running.set(false);}
            });
        } catch(TaskRejectedException busy) {running.set(false);}
    }
}
