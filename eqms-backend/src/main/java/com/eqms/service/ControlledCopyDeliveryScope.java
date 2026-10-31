package com.eqms.service;

/** Internal delivery mode for a fenced copy transaction, never an authorization grant. */
final class ControlledCopyDeliveryScope implements AutoCloseable {
    private static final ThreadLocal<Boolean> CURRENT=new ThreadLocal<>();
    private final Boolean previous;
    private ControlledCopyDeliveryScope(){previous=CURRENT.get();CURRENT.set(Boolean.TRUE);}
    static ControlledCopyDeliveryScope enter(){return new ControlledCopyDeliveryScope();}
    static boolean active(){return Boolean.TRUE.equals(CURRENT.get())&&org.springframework.transaction.support.TransactionSynchronizationManager.isActualTransactionActive();}
    @Override public void close(){if(previous==null)CURRENT.remove();else CURRENT.set(previous);}
}
