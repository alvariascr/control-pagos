-- Esquema completo de Control de Pagos (para correr una sola vez).
-- Correr completo en Supabase: Dashboard -> SQL Editor -> New query -> pegar y ejecutar (Run).
-- Si ya se corrió, no correr esto otra vez: usar los scripts de supabase/migraciones/ que falten.
--
-- Este proyecto de Supabase lo comparte Control Ganado (tablas animales, compras, v_resumen...),
-- así que todo lo de pagos lleva el prefijo "pagos_" para no chocar con nada de ganado.
-- Este script NO modifica ni lee ninguna tabla de ganado.
--
-- - pagos_clientes: cada persona a la que se le vende a crédito.
-- - pagos_compras: lo que el cliente se llevó (una olla, un sartén...) y cuánto cuesta.
-- - pagos_abonos: cada pago que el cliente hace.
-- El saldo de un cliente es la suma de sus compras menos la suma de sus abonos.
-- Al final: productos, pedidos al proveedor e inventario (existencia = entradas + ajustes - ventas).

create extension if not exists "pgcrypto";

-- ============ TABLAS ============

create table if not exists pagos_clientes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (btrim(nombre) <> ''),
  -- Opcional. Se usa para el botón de recordatorio por WhatsApp.
  telefono text,
  usuario_id uuid references auth.users(id) default auth.uid(),
  creado_en timestamptz not null default now(),
  -- Máximos (los mismos que en src/lib/limites.ts).
  constraint pagos_clientes_nombre_maximo check (char_length(nombre) <= 80),
  constraint pagos_clientes_telefono_maximo check (char_length(telefono) <= 30)
);

create table if not exists pagos_compras (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references pagos_clientes(id) on delete cascade,
  -- Vacía en las anotaciones viejas del cuaderno que no tenían fecha.
  fecha date default current_date,
  descripcion text not null check (btrim(descripcion) <> ''),
  monto numeric not null check (monto > 0),
  usuario_id uuid references auth.users(id) default auth.uid(),
  creado_en timestamptz not null default now(),
  -- Máximos (los mismos que en src/lib/limites.ts).
  constraint pagos_compras_monto_maximo check (monto <= 2000000),
  constraint pagos_compras_descripcion_maximo check (char_length(descripcion) <= 120)
);

create table if not exists pagos_abonos (
  id uuid primary key default gen_random_uuid(),
  cliente_id uuid not null references pagos_clientes(id) on delete cascade,
  fecha date default current_date,
  monto numeric not null check (monto > 0),
  -- Opcional: "transferencia", "efectivo", etc.
  nota text,
  usuario_id uuid references auth.users(id) default auth.uid(),
  creado_en timestamptz not null default now(),
  -- Máximos (los mismos que en src/lib/limites.ts).
  constraint pagos_abonos_monto_maximo check (monto <= 2000000),
  constraint pagos_abonos_nota_maximo check (char_length(nota) <= 120)
);

create index if not exists idx_pagos_compras_cliente on pagos_compras(cliente_id);
create index if not exists idx_pagos_abonos_cliente on pagos_abonos(cliente_id);

-- ============ VISTAS ============

-- Una fila por cliente con lo que ha comprado, lo que ha abonado y lo que debe.
-- saldo negativo = el cliente pagó de más (queda a favor).
create or replace view pagos_v_saldo_cliente as
select
  c.id as cliente_id,
  c.nombre,
  c.telefono,
  c.creado_en,
  coalesce(co.total, 0) as total_compras,
  coalesce(ab.total, 0) as total_abonos,
  coalesce(co.total, 0) - coalesce(ab.total, 0) as saldo,
  ab.ultimo_abono
from pagos_clientes c
left join (select cliente_id, sum(monto) as total from pagos_compras group by cliente_id) co
  on co.cliente_id = c.id
left join (
  select cliente_id, sum(monto) as total, max(fecha) as ultimo_abono
  from pagos_abonos group by cliente_id
) ab on ab.cliente_id = c.id;

-- Totales de todo el negocio.
create or replace view pagos_v_resumen as
select
  (select coalesce(sum(saldo), 0) from pagos_v_saldo_cliente where saldo > 0) as por_cobrar,
  (select count(*) from pagos_v_saldo_cliente where saldo > 0) as clientes_con_saldo,
  (select count(*) from pagos_v_saldo_cliente) as clientes_total;

-- Postgres 15+: hace que las vistas respeten el RLS del usuario que consulta.
alter view pagos_v_saldo_cliente set (security_invoker = on);
alter view pagos_v_resumen set (security_invoker = on);

-- ============ SEGURIDAD ============
-- Solo los usuarios con sesión (creados a mano en Authentication -> Add user) pueden leer y
-- escribir. Nadie sin sesión puede.
-- OJO: como el proyecto se comparte con Control Ganado, cualquier usuario con sesión de esa
-- app también puede leer estas tablas, y al revés. Solo hay que crear usuarios de confianza.

alter table pagos_clientes enable row level security;
alter table pagos_compras enable row level security;
alter table pagos_abonos enable row level security;

create policy "autenticados_todo_pagos_clientes" on pagos_clientes
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "autenticados_todo_pagos_compras" on pagos_compras
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

create policy "autenticados_todo_pagos_abonos" on pagos_abonos
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

grant select, insert, update, delete on pagos_clientes, pagos_compras, pagos_abonos
  to authenticated;
grant select on pagos_v_saldo_cliente, pagos_v_resumen to authenticated;

-- ============ INVENTARIO Y PEDIDOS ============
-- Lo mismo que supabase/migraciones/001_agregar_inventario.sql (ya incluido aqui: si se corre este
-- script completo, no hace falta correr esa migracion).

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

-- ============ ENDURECER ENTRADAS ============
-- Lo mismo que supabase/migraciones/002_endurecer_entradas.sql (ya incluido aqui: si se corre este
-- script completo, no hace falta correr esa migracion).
-- Textos sin caracteres raros, montos en colones enteros y fechas entre 2020 y 2100.

-- Verdadero si el texto es nulo o no tiene caracteres de control, invisibles (ancho cero y marcas
-- de dirección) ni < >.
create or replace function pagos_texto_seguro(t text)
returns boolean
language sql
immutable
as $$
  select t is null or t !~ '[<>[:cntrl:]​-‏‪-‮⁦-⁩﻿]'
$$;

grant execute on function pagos_texto_seguro(text) to authenticated;

-- ============ TEXTOS ============

alter table pagos_clientes drop constraint if exists pagos_clientes_nombre_seguro;
alter table pagos_clientes add constraint pagos_clientes_nombre_seguro
  check (pagos_texto_seguro(nombre));

alter table pagos_clientes drop constraint if exists pagos_clientes_telefono_formato;
alter table pagos_clientes add constraint pagos_clientes_telefono_formato
  check (telefono is null or telefono ~ '^[0-9+() -]+$');

alter table pagos_compras drop constraint if exists pagos_compras_descripcion_segura;
alter table pagos_compras add constraint pagos_compras_descripcion_segura
  check (pagos_texto_seguro(descripcion));

alter table pagos_abonos drop constraint if exists pagos_abonos_nota_segura;
alter table pagos_abonos add constraint pagos_abonos_nota_segura
  check (pagos_texto_seguro(nota));

alter table pagos_productos drop constraint if exists pagos_productos_nombre_seguro;
alter table pagos_productos add constraint pagos_productos_nombre_seguro
  check (pagos_texto_seguro(nombre));

alter table pagos_productos drop constraint if exists pagos_productos_codigo_formato;
alter table pagos_productos add constraint pagos_productos_codigo_formato
  check (codigo is null or codigo ~ '^[A-Za-z0-9._/ -]+$');

alter table pagos_pedidos drop constraint if exists pagos_pedidos_numero_formato;
alter table pagos_pedidos add constraint pagos_pedidos_numero_formato
  check (numero ~ '^[A-Za-z0-9._/ -]+$');

alter table pagos_pedidos drop constraint if exists pagos_pedidos_proveedor_seguro;
alter table pagos_pedidos add constraint pagos_pedidos_proveedor_seguro
  check (pagos_texto_seguro(proveedor));

alter table pagos_pedido_pagos drop constraint if exists pagos_pedido_pagos_nota_segura;
alter table pagos_pedido_pagos add constraint pagos_pedido_pagos_nota_segura
  check (pagos_texto_seguro(nota));

alter table pagos_ajustes drop constraint if exists pagos_ajustes_motivo_seguro;
alter table pagos_ajustes add constraint pagos_ajustes_motivo_seguro
  check (pagos_texto_seguro(motivo));

-- ============ MONTOS EN COLONES ENTEROS ============

alter table pagos_compras drop constraint if exists pagos_compras_monto_entero;
alter table pagos_compras add constraint pagos_compras_monto_entero
  check (monto = trunc(monto));

alter table pagos_abonos drop constraint if exists pagos_abonos_monto_entero;
alter table pagos_abonos add constraint pagos_abonos_monto_entero
  check (monto = trunc(monto));

alter table pagos_productos drop constraint if exists pagos_productos_precio_entero;
alter table pagos_productos add constraint pagos_productos_precio_entero
  check (precio_venta is null or precio_venta = trunc(precio_venta));

alter table pagos_pedido_items drop constraint if exists pagos_pedido_items_costo_entero;
alter table pagos_pedido_items add constraint pagos_pedido_items_costo_entero
  check (costo_unitario = trunc(costo_unitario));

alter table pagos_pedido_pagos drop constraint if exists pagos_pedido_pagos_monto_entero;
alter table pagos_pedido_pagos add constraint pagos_pedido_pagos_monto_entero
  check (monto = trunc(monto));

-- ============ FECHAS ============
-- Mismas fechas que FECHA_MINIMA y FECHA_MAXIMA en src/lib/limites.ts.

alter table pagos_compras drop constraint if exists pagos_compras_fecha_rango;
alter table pagos_compras add constraint pagos_compras_fecha_rango
  check (fecha is null or fecha between date '2020-01-01' and date '2100-12-31');

alter table pagos_abonos drop constraint if exists pagos_abonos_fecha_rango;
alter table pagos_abonos add constraint pagos_abonos_fecha_rango
  check (fecha is null or fecha between date '2020-01-01' and date '2100-12-31');

alter table pagos_pedidos drop constraint if exists pagos_pedidos_fecha_rango;
alter table pagos_pedidos add constraint pagos_pedidos_fecha_rango
  check (
    fecha between date '2020-01-01' and date '2100-12-31'
    and (vencimiento is null or vencimiento between date '2020-01-01' and date '2100-12-31')
  );

alter table pagos_pedido_pagos drop constraint if exists pagos_pedido_pagos_fecha_rango;
alter table pagos_pedido_pagos add constraint pagos_pedido_pagos_fecha_rango
  check (fecha between date '2020-01-01' and date '2100-12-31');

alter table pagos_ajustes drop constraint if exists pagos_ajustes_fecha_rango;
alter table pagos_ajustes add constraint pagos_ajustes_fecha_rango
  check (fecha between date '2020-01-01' and date '2100-12-31');

