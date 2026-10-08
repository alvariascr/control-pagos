-- Endurece lo que acepta la base, aunque alguien le hable directo a la API sin pasar por la app:
-- - Textos sin caracteres de control, invisibles ni < >.
-- - Montos y precios en colones enteros (sin decimales).
-- - Teléfonos, códigos y números de nota con formato válido.
-- - Fechas entre 2020 y 2100.
-- Correr una sola vez en Supabase: SQL Editor -> New query -> pegar y ejecutar (Run), DESPUÉS de
-- la migración 001. Falla si ya hay datos que no cumplen; el mensaje dice cuál constraint.
-- Los límites de tamaño y de monto máximo ya están en schema.sql y en la migración 001.
-- Estas reglas son las mismas de src/lib/sanitizar.ts y src/lib/limites.ts.

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
