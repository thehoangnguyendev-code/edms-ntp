package com.eqms.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.io.IOException;
import java.util.Map;
import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class StorageUsageSnapshotServiceTest {
    private final MinioObjectStorageService storage = mock(MinioObjectStorageService.class);
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final StorageUsageSnapshotService service = new StorageUsageSnapshotService(storage, jdbc, new ObjectMapper());
    private final DataSource dataSource = mock(DataSource.class);
    private final Connection connection = mock(Connection.class);
    private final PreparedStatement lock = mock(PreparedStatement.class);
    private final PreparedStatement unlock = mock(PreparedStatement.class);
    private final PreparedStatement insert = mock(PreparedStatement.class);
    private final PreparedStatement status = mock(PreparedStatement.class);
    private final ResultSet lockResult = mock(ResultSet.class);

    private void setup(boolean acquired) throws Exception {
        when(jdbc.getDataSource()).thenReturn(dataSource);
        when(dataSource.getConnection()).thenReturn(connection);
        when(connection.prepareStatement("SELECT pg_try_advisory_lock(?)")).thenReturn(lock);
        when(connection.prepareStatement("SELECT pg_advisory_unlock(?)")).thenReturn(unlock);
        when(connection.prepareStatement(startsWith("INSERT INTO storage_usage_snapshot"))).thenReturn(insert);
        when(connection.prepareStatement(startsWith("UPDATE storage_usage_scan_state"))).thenReturn(status);
        when(lock.executeQuery()).thenReturn(lockResult);
        when(lockResult.next()).thenReturn(true);
        when(lockResult.getBoolean(1)).thenReturn(acquired);
        when(connection.getAutoCommit()).thenReturn(true);
    }

    @AfterEach void close() { service.shutdown(); }

    @Test void recordsOnlyACompleteMeasurement() throws Exception {
        setup(true);
        when(storage.measureObjectUsage()).thenReturn(new StorageUsageAccumulator.Usage(12, 2, Map.of("documents", 12L), Map.of("pdf", 12L)));
        service.sample();
        verify(insert).executeUpdate();
        verify(status).executeUpdate();
        verify(connection).commit();
        verify(unlock).execute();
    }

    @Test void doesNotSaveAResultWhenStorageFails() throws Exception {
        setup(true);
        when(storage.measureObjectUsage()).thenThrow(new IOException("offline"));
        assertThrows(IOException.class, service::sample);
        verify(insert, never()).executeUpdate();
        verify(status).executeUpdate();
        verify(unlock).execute();
    }

    @Test void anotherInstanceHoldingLockSkipsScan() throws Exception {
        setup(false);
        service.sample();
        verifyNoInteractions(storage);
        verify(insert, never()).executeUpdate();
    }
}
