-- Compatibility entrypoint for operators who used the original three-file
-- manual sequence. The authoritative, journalled contract is migration 0003;
-- keeping the SQL there prevents the declared schema and production catalog
-- from drifting apart again.
\set ON_ERROR_STOP on
\ir ../0003_unusual_blue_shield.sql
