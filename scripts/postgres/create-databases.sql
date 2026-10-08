-- Run against a local PostgreSQL server as a role allowed to create databases.
-- This script is intentionally non-destructive: existing databases are skipped.
SELECT 'CREATE DATABASE app_identity'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'app_identity')\gexec

SELECT 'CREATE DATABASE app_content'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'app_content')\gexec

SELECT 'CREATE DATABASE app_learning'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'app_learning')\gexec

SELECT 'CREATE DATABASE app_progress'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'app_progress')\gexec
