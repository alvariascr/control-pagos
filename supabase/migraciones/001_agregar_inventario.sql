-- Inventario y pedidos al proveedor.
-- Correr una sola vez en Supabase: SQL Editor -> New query -> pegar y ejecutar (Run).
-- Solo agrega cosas nuevas (prefijo "pagos_") y dos columnas a pagos_compras. No toca ganado.
--
-- - pagos_productos: lo que se vende (código, nombre, precio de venta).
-- - pagos_pedidos: cada nota de venta del proveedor, con sus artículos y sus pagos.
-- - pagos_ajustes: correcciones de inventario (conteo, rotos, regalos).
-- - pagos_compras.producto_id y cantidad: una venta a una clienta puede apuntar a un producto
--   y así baja el inventario.
-- Existencia = lo que entró en pedidos + ajustes - lo que se vendió.

-- ============ TABLAS ============

create table if not exists pagos_productos (
  id uuid primary key default gen_random_uuid(),
  -- Puede quedar vacío si el proveedor no lo puso en la nota.
  codigo text,
  nombre text not null check (btrim(nombre) <> ''),
  precio_venta numeric check (precio_venta is null or precio_venta >= 0),
  usuario_id uuid references auth.users(id) default auth.uid(),
  creado_en timestamptz not null default now(),
  constraint pagos_productos_codigo_unico unique (codigo),
  -- Máximos (los mismos que en src/lib/limites.ts).
  constraint pagos_productos_codigo_maximo check (char_length(codigo) <= 40),
  constraint pagos_productos_nombre_maximo check (char_length(nombre) <= 80),
  constraint pagos_productos_precio_maximo check (precio_venta <= 2000000)
);

create table if not exists pagos_pedidos (
  id uuid primary key default gen_random_uuid(),
  numero text not null check (btrim(numero) <> ''),
  proveedor text not null default 'Kata Wok Stone' check (btrim(proveedor) <> ''),
  fecha date not null default current_date,
  vencimiento date,
  usuario_id uuid references auth.users(id) default auth.uid(),
  creado_en timestamptz not null default now(),
  constraint pagos_pedidos_numero_unico unique (proveedor, numero),
  constraint pagos_pedidos_vencimiento_valido check (vencimiento is null or vencimiento >= fecha),
  -- Máximos (los mismos que en src/lib/limites.ts).
  constraint pagos_pedidos_numero_maximo check (char_length(numero) <= 40),
  constraint pagos_pedidos_proveedor_maximo check (char_length(proveedor) <= 80)
);

create table if not exists pagos_pedido_items (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pagos_pedidos(id) on delete cascade,
  producto_id uuid not null references pagos_productos(id) on delete restrict,
  cantidad integer not null check (cantidad > 0),
  -- Lo que costó cada unidad en ese pedido (puede cambiar de un pedido a otro).
  costo_unitario numeric not null check (costo_unitario >= 0),
  creado_en timestamptz not null default now(),
  -- Máximos (los mismos que en src/lib/limites.ts).
  constraint pagos_pedido_items_cantidad_maxima check (cantidad <= 1000),
  constraint pagos_pedido_items_costo_maximo check (costo_unitario <= 2000000)
);

create table if not exists pagos_pedido_pagos (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references pagos_pedidos(id) on delete cascade,
  fecha date not null default current_date,
  monto numeric not null check (monto > 0),
  nota text,
  creado_en timestamptz not null default now(),
  -- Máximos (los mismos que en src/lib/limites.ts).
  constraint pagos_pedido_pagos_monto_maximo check (monto <= 20000000),
  constraint pagos_pedido_pagos_nota_maximo check (char_length(nota) <= 120)
);

-- cantidad positiva = sobran unidades, negativa = faltan.
create table if not exists pagos_ajustes (
  id uuid primary key default gen_random_uuid(),
  producto_id uuid not null references pagos_productos(id) on delete cascade,
  cantidad integer not null check (cantidad <> 0),
  fecha date not null default current_date,
  motivo text not null default 'Conteo',
  creado_en timestamptz not null default now(),
  -- Máximos (los mismos que en src/lib/limites.ts).
  constraint pagos_ajustes_cantidad_maxima check (cantidad between -1000 and 1000),
  constraint pagos_ajustes_motivo_maximo check (char_length(motivo) <= 120)
);

-- Una venta a una clienta puede apuntar a un producto. Sin producto sigue valiendo (texto libre).
-- monto sigue siendo el total de la línea (precio por cantidad).
alter table pagos_compras
  add column if not exists producto_id uuid references pagos_productos(id) on delete restrict,
  add column if not exists cantidad integer not null default 1;

alter table pagos_compras
  drop constraint if exists pagos_compras_cantidad_valida;
alter table pagos_compras
  add constraint pagos_compras_cantidad_valida check (cantidad > 0 and cantidad <= 1000);

create index if not exists idx_pagos_pedido_items_pedido on pagos_pedido_items(pedido_id);
create index if not exists idx_pagos_pedido_items_producto on pagos_pedido_items(producto_id);
create index if not exists idx_pagos_pedido_pagos_pedido on pagos_pedido_pagos(pedido_id);
create index if not exists idx_pagos_ajustes_producto on pagos_ajustes(producto_id);
create index if not exists idx_pagos_compras_producto on pagos_compras(producto_id);

-- ============ VISTAS ============

-- Una fila por producto: lo que entró, lo que se vendió y lo que queda.
-- costo_promedio: costo medio por unidad de todo lo que ha entrado (vacío si nunca entró).
create or replace view pagos_v_inventario as
select
  p.id as producto_id,
  p.codigo,
  p.nombre,
  p.precio_venta,
  coalesce(e.unidades, 0) as recibido,
  coalesce(v.unidades, 0) as vendido,
  coalesce(a.unidades, 0) as ajustes,
  coalesce(e.unidades, 0) + coalesce(a.unidades, 0) - coalesce(v.unidades, 0) as existencia,
  case when coalesce(e.unidades, 0) > 0 then e.costo_total / e.unidades end as costo_promedio
from pagos_productos p
left join (
  select producto_id, sum(cantidad) as unidades, sum(cantidad * costo_unitario) as costo_total
  from pagos_pedido_items group by producto_id
) e on e.producto_id = p.id
left join (
  select producto_id, sum(cantidad) as unidades
  from pagos_compras where producto_id is not null group by producto_id
) v on v.producto_id = p.id
left join (
  select producto_id, sum(cantidad) as unidades from pagos_ajustes group by producto_id
) a on a.producto_id = p.id;

-- Una fila por pedido al proveedor con lo que suma, lo pagado y lo que se debe.
create or replace view pagos_v_pedido_saldo as
select
  d.id as pedido_id,
  d.numero,
  d.proveedor,
  d.fecha,
  d.vencimiento,
  d.creado_en,
  coalesce(i.unidades, 0) as unidades,
  coalesce(i.total, 0) as total,
  coalesce(g.pagado, 0) as pagado,
  coalesce(i.total, 0) - coalesce(g.pagado, 0) as saldo
from pagos_pedidos d
left join (
  select pedido_id, sum(cantidad) as unidades, sum(cantidad * costo_unitario) as total
  from pagos_pedido_items group by pedido_id
) i on i.pedido_id = d.id
left join (
  select pedido_id, sum(monto) as pagado from pagos_pedido_pagos group by pedido_id
) g on g.pedido_id = d.id;

-- Postgres 15+: hace que las vistas respeten el RLS del usuario que consulta.
alter view pagos_v_inventario set (security_invoker = on);
alter view pagos_v_pedido_saldo set (security_invoker = on);

-- ============ SEGURIDAD ============
-- Igual que el resto: solo usuarios con sesión.

alter table pagos_productos enable row level security;
alter table pagos_pedidos enable row level security;
alter table pagos_pedido_items enable row level security;
alter table pagos_pedido_pagos enable row level security;
alter table pagos_ajustes enable row level security;

create policy "autenticados_todo_pagos_productos" on pagos_productos
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "autenticados_todo_pagos_pedidos" on pagos_pedidos
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "autenticados_todo_pagos_pedido_items" on pagos_pedido_items
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "autenticados_todo_pagos_pedido_pagos" on pagos_pedido_pagos
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "autenticados_todo_pagos_ajustes" on pagos_ajustes
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

grant select, insert, update, delete
  on pagos_productos, pagos_pedidos, pagos_pedido_items, pagos_pedido_pagos, pagos_ajustes
  to authenticated;
grant select on pagos_v_inventario, pagos_v_pedido_saldo to authenticated;
