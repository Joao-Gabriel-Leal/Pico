insert into sport (id, slug, name)
values
  (1, 'skate', 'Skate'),
  (2, 'basquete', 'Basquete'),
  (3, 'futebol', 'Futebol'),
  (4, 'tenis', 'Tenis'),
  (5, 'patins', 'Patins'),
  (6, 'bmx', 'BMX'),
  (7, 'corrida', 'Corrida'),
  (8, 'bike', 'Bike'),
  (9, 'caminhada', 'Caminhada'),
  (10, 'natacao', 'Natacao')
on conflict (id) do update
set
  slug = excluded.slug,
  name = excluded.name;

insert into role (slug, name, description)
values
  ('admin', 'Administrador', 'Controle global do sistema'),
  ('moderador', 'Moderador', 'Modera picos, eventos e conteudo'),
  ('colaborador', 'Colaborador', 'Pode colaborar na gestao de picos'),
  ('usuario', 'Usuario comum', 'Participa da rede social e gerencia picos sob sua responsabilidade')
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description;

insert into permission (key, description)
values
  ('pico.create', 'Criar novos picos'),
  ('pico.manage.assigned', 'Editar picos onde o usuario e administrador'),
  ('pico.manage.any', 'Editar qualquer pico'),
  ('pico.delete.assigned', 'Remover picos onde o usuario e administrador'),
  ('pico.delete.any', 'Remover qualquer pico'),
  ('pico.admin.manage.assigned', 'Gerenciar administradores do proprio pico'),
  ('pico.admin.manage.any', 'Gerenciar administradores de qualquer pico'),
  ('pico.approve', 'Aprovar ou rejeitar novos picos'),
  ('event.submit', 'Enviar sugestoes de evento para aprovacao'),
  ('event.manage.assigned', 'Criar e editar eventos do proprio pico'),
  ('event.manage.any', 'Criar e editar eventos em qualquer pico'),
  ('event.approve', 'Aprovar ou rejeitar eventos enviados pela comunidade'),
  ('media.moderate.assigned', 'Moderar publicacoes do proprio pico'),
  ('media.moderate.any', 'Moderar publicacoes em qualquer pico'),
  ('feed.post', 'Publicar no feed dos picos'),
  ('media.react', 'Curtir publicacoes'),
  ('media.comment', 'Comentar publicacoes'),
  ('dm.use', 'Usar mensagens diretas'),
  ('role.assign', 'Associar e remover roles de usuarios')
on conflict (key) do update
set
  description = excluded.description;

delete from role_permission;

insert into role_permission (role_id, permission_id)
select role.id, permission.id
from role
join permission on permission.key = any (
  case role.slug
    when 'admin' then array[
      'pico.create',
      'pico.manage.assigned',
      'pico.manage.any',
      'pico.delete.assigned',
      'pico.delete.any',
      'pico.admin.manage.assigned',
      'pico.admin.manage.any',
      'pico.approve',
      'event.submit',
      'event.manage.assigned',
      'event.manage.any',
      'event.approve',
      'media.moderate.assigned',
      'media.moderate.any',
      'feed.post',
      'media.react',
      'media.comment',
      'dm.use',
      'role.assign'
    ]::text[]
    when 'moderador' then array[
      'pico.create',
      'pico.manage.assigned',
      'pico.manage.any',
      'pico.delete.assigned',
      'pico.delete.any',
      'pico.approve',
      'event.submit',
      'event.manage.assigned',
      'event.manage.any',
      'event.approve',
      'media.moderate.assigned',
      'media.moderate.any',
      'feed.post',
      'media.react',
      'media.comment',
      'dm.use'
    ]::text[]
    when 'colaborador' then array[
      'pico.create',
      'pico.manage.assigned',
      'pico.delete.assigned',
      'pico.admin.manage.assigned',
      'event.submit',
      'event.manage.assigned',
      'media.moderate.assigned',
      'feed.post',
      'media.react',
      'media.comment',
      'dm.use'
    ]::text[]
    else array[
      'pico.create',
      'pico.manage.assigned',
      'pico.delete.assigned',
      'event.submit',
      'event.manage.assigned',
      'media.moderate.assigned',
      'feed.post',
      'media.react',
      'media.comment',
      'dm.use'
    ]::text[]
  end
)
on conflict do nothing;

select setval(
  pg_get_serial_sequence('sport', 'id'),
  coalesce((select max(id) from sport), 1),
  true
);

select setval(
  pg_get_serial_sequence('role', 'id'),
  coalesce((select max(id) from role), 1),
  true
);

select setval(
  pg_get_serial_sequence('permission', 'id'),
  coalesce((select max(id) from permission), 1),
  true
);
