-- Extensions required by the application. Flyway cannot reliably create
-- extensions without superuser, so we do it here at container init time.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
