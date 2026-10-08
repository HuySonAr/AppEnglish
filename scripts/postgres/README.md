# Local PostgreSQL databases

PostgreSQL must run natively on Windows. Do not add PostgreSQL to Docker Compose.

## psql

1. Start the local PostgreSQL Windows service.
2. Copy `.env.example` to `.env` and set local values without committing it.
3. Run from the repository root:

```powershell
psql -h localhost -U postgres -f scripts/postgres/create-databases.sql
```

The script creates `app_identity`, `app_content`, `app_learning`, and
`app_progress` only when they do not already exist. It does not drop or reset data.

## pgAdmin or DBeaver

Connect to the local PostgreSQL server (`localhost`, port `5432`) and run
`scripts/postgres/create-databases.sql` in the query tool. Use the database names
from `docs/02-architecture/database-allocation.md`; never put a real password in
the repository.
