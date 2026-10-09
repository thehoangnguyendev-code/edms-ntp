# Dev-only migrations

Scripts in this folder are loaded only when `SPRING_FLYWAY_LOCATIONS` includes `classpath:db/migration-dev`.
That is set in the dev `docker-compose.yml`. The GMP overlay (`docker-compose.gmp.yml`) overrides it with
`classpath:db/migration` only, so production never loads these files.

Do not edit a script after it has been applied: Flyway compares checksums. The header comment inside
V558 is part of the checksum, which is why this note lives here instead.
