package com.eqms.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import java.util.Optional;
import java.util.UUID;

@Service
public class AuthBackgroundVideoStore {
    private final JdbcTemplate jdbc;
    public AuthBackgroundVideoStore(JdbcTemplate jdbc) { this.jdbc = jdbc; }
    public UUID save(UUID userId, byte[] bytes) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO auth_background_videos (id, uploaded_by, content) VALUES (?, ?, ?)", id, userId, bytes);
        return id;
    }
    public boolean exists(UUID id) {
        Integer count = jdbc.queryForObject("SELECT count(*) FROM auth_background_videos WHERE id = ?", Integer.class, id);
        return count != null && count == 1;
    }
    public Optional<byte[]> read(UUID id) {
        return jdbc.query("SELECT content FROM auth_background_videos WHERE id = ?", (rs, row) -> rs.getBytes(1), id).stream().findFirst();
    }
}
