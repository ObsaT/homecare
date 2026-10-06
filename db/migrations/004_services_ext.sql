-- 004: allow dynamic service codes for admin catalogue extensions
alter table catalog.services alter column code type text;
