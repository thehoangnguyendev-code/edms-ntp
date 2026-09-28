# Database Setup

## What is connected to what

- Front-end calls back-end through `VITE_API_BASE_URL`
- Back-end connects to PostgreSQL through `SPRING_DATASOURCE_URL`
- Flyway creates and updates the schema inside PostgreSQL

## Local start

1. Copy `/.env.example` to `/.env`
2. Start PostgreSQL:

```powershell
docker compose up -d postgres adminer
```

3. Verify the port is open:

```powershell
Test-NetConnection localhost -Port 5432
```

4. Start the backend with these env vars:

```powershell
$env:SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/eqms-database"
$env:SPRING_DATASOURCE_USERNAME="eqms"
$env:SPRING_DATASOURCE_PASSWORD="eqms"
$env:SERVER_PORT="5000"
```

5. Run the backend:

```powershell
cd D:\edms-project\eqms-monorepo\eqms-backend
.\mvnw spring-boot:run
```

6. Open Adminer:

- http://localhost:8081
- System: PostgreSQL
- Server: `postgres` if you run inside compose, or `host.docker.internal` if needed
- Username: `eqms`
- Password: `eqms`
- Database: `eqms-database`

## Notes

- On first backend start, Flyway will create the prompt registry tables automatically.
- If you want backend and PostgreSQL both in Docker later, we can add a backend service and a backend Dockerfile.
