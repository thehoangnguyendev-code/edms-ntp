package com.eqms.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;
import org.springframework.data.redis.core.script.RedisScript;
import java.time.Duration;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class DistributedSchedulerLockServiceTest {
    @Test
    @SuppressWarnings("unchecked")
    void onlyOwnerRenewsAndLostLeaseCannotBeRevivedOrReleaseNewOwner() {
        var redis = mock(StringRedisTemplate.class);
        var values = (ValueOperations<String,String>)mock(ValueOperations.class);
        var provider = (ObjectProvider<StringRedisTemplate>)mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(redis);
        when(redis.opsForValue()).thenReturn(values);
        when(values.setIfAbsent(anyString(), anyString(), any(Duration.class))).thenReturn(true);
        var lease = new DistributedSchedulerLockService(provider,true).tryAcquire("test", Duration.ofMinutes(2));
        when(redis.execute(any(RedisScript.class), anyList(), any(Object[].class))).thenReturn(1L,0L);
        assertTrue(lease.renew(Duration.ofMinutes(2)));
        assertFalse(lease.renew(Duration.ofMinutes(2)));
        assertFalse(lease.acquired());
        assertFalse(lease.renew(Duration.ofMinutes(2)));
        lease.close();
        verify(redis,times(2)).execute(any(RedisScript.class), anyList(), any(Object[].class));
    }

    @Test
    @SuppressWarnings("unchecked")
    void disabledLockIsExplicitNoopAndClosedHandleCannotRenew() {
        var provider = (ObjectProvider<StringRedisTemplate>)mock(ObjectProvider.class);
        var lease = new DistributedSchedulerLockService(provider,false).tryAcquire("local",Duration.ofMinutes(2));
        assertTrue(lease.acquired());
        assertTrue(lease.renew(Duration.ofMinutes(2)));
        lease.close();
        assertFalse(lease.renew(Duration.ofMinutes(2)));
    }
}
