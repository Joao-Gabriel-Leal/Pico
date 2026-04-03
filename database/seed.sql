insert into sport (id, slug, name)
values
  (1, 'skate', 'Skate'),
  (2, 'basquete', 'Basquete'),
  (3, 'futebol', 'Futebol'),
  (4, 'tenis', 'Tenis'),
  (5, 'patins', 'Patins'),
  (6, 'bmx', 'BMX')
on conflict (id) do update
set
  slug = excluded.slug,
  name = excluded.name;

select setval(
  pg_get_serial_sequence('sport', 'id'),
  coalesce((select max(id) from sport), 1),
  true
);
