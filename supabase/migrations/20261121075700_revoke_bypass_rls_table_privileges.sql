-- RLS does not protect TRUNCATE. Remove structural table privileges from
-- application roles while preserving the existing SELECT/INSERT/UPDATE/DELETE
-- grants and all row-level policies.
REVOKE TRUNCATE, REFERENCES, TRIGGER
ON ALL TABLES IN SCHEMA public
FROM PUBLIC, anon, authenticated;

-- Keep future public tables from inheriting these bypass/DDL privileges.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
REVOKE TRUNCATE, REFERENCES, TRIGGER
ON TABLES
FROM PUBLIC, anon, authenticated;
