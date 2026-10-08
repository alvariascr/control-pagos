# 🍲 Control de Pagos

App web sencilla para llevar el control de lo que los clientes compran a crédito (ollas,
sartenes y otros artículos de cocina), cuánto han abonado y cuánto deben. Reemplaza el
cuaderno. Está pensada para usarse desde el celular y se puede instalar como una app.

## 1. Base de datos (Supabase)

Lo ideal es un proyecto de Supabase aparte, porque quien inicie sesión puede ver todo lo que
haya en ese proyecto. Si se comparte con otra app (ahora se comparte con Control Ganado), las
tablas y vistas de esta app llevan el prefijo `pagos_` para no chocar, y solo hay que crear
usuarios de confianza.

1. En el proyecto de Supabase, ir a **SQL Editor → New query**, pegar todo
   [`supabase/schema.sql`](supabase/schema.sql) y darle **Run**.
2. En **Authentication → Users → Add user → Create new user**, crear un usuario (correo y
   contraseña) para cada persona que va a usar la app, marcando **Auto Confirm User**. No hay
   registro público.

## 2. Correr la app en la computadora

```bash
npm install
cp .env.example .env
```

Editar `.env` con los datos de **Project Settings → API Keys** del proyecto de Supabase:

- `VITE_SUPABASE_URL`: la Project URL (`https://xxxx.supabase.co`)
- `VITE_SUPABASE_ANON_KEY`: la **publishable key** (`sb_publishable_...`)

Nunca pegar aquí la **secret key** (`sb_secret_...`).

```bash
npm run dev
```

## 3. Publicar en GitHub Pages

1. Crear un repo en GitHub y subir este proyecto a la rama `main`.
2. En el repo: **Settings → Pages → Source: GitHub Actions**.
3. En **Settings → Secrets and variables → Actions**, crear los secretos
   `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` con los mismos valores del `.env`.
4. Cada push a `main` publica la app en `https://<usuario>.github.io/<repo>/`.

## 4. Instalarla en el celular

- **Android (Chrome)**: abrir el enlace, menú ⋮ → **Instalar app** (o **Agregar a pantalla
  de inicio**).
- **iPhone (Safari)**: abrir el enlace, botón de compartir → **Agregar a pantalla de inicio**.

## Cómo está organizada

Tres pestañas abajo:

- **Clientes**: lista con lo que debe cada uno (los que más deben primero), el total por
  cobrar, búsqueda y el filtro "Con saldo / Todos". Al tocar un cliente se abre su detalle.
  Ahí se registra un abono o un artículo, se ve el historial (tocar un movimiento lo edita o
  lo elimina) y, si tiene teléfono, se manda un recordatorio por WhatsApp. El saldo se calcula
  en la base: compras menos abonos. Si un cliente paga de más, aparece "a favor".
- **Inventario**: cada producto con lo que queda. Existencia = lo que entró en los pedidos,
  más los ajustes de conteo, menos lo vendido. Al agregar un artículo a un cliente se puede
  elegir el producto, y así baja el inventario ("Ya pagó todo" anota también el abono).
  "Contar inventario" guarda la diferencia entre lo que dice la app y lo que hay de verdad.
- **Pedidos**: las notas de venta del proveedor, con sus artículos, lo pagado y lo que se
  debe, y aviso de vencimiento (45 días de crédito por defecto).

## Qué se acepta en los campos

La app y la base aplican las mismas reglas (`src/lib/sanitizar.ts`, `src/lib/limites.ts` y
`supabase/migraciones/002_endurecer_entradas.sql`):

- Montos y cantidades: solo dígitos, en colones enteros y con un máximo (₡2.000.000 por venta o
  abono, ₡20.000.000 por pago a proveedor, 1.000 unidades). No deja escribir letras, signos,
  decimales ni notación como 1e30.
- Textos: sin caracteres de control, invisibles ni `<` `>`, con espacios normalizados y un largo
  máximo.
- Teléfonos: dígitos, espacios, `+`, `-` y paréntesis (8 a 15 dígitos).
- Códigos y números de nota: letras, números y `. _ / -`.
- Fechas: entre 2020 y 2100.

## Datos reales

Los nombres, deudas y notas reales no se suben al repo. Los scripts con datos reales van en
`supabase/datos_reales*.sql`, que está en `.gitignore`. Por ejemplo,
`supabase/datos_reales_pedidos.sql` carga los productos y pedidos de las notas del proveedor
(se corre después de la migración de inventario).

## Cambios a la base

Si la base ya existe, correr en orden los scripts de [`supabase/migraciones/`](supabase/migraciones)
que todavía no se hayan corrido. [`supabase/schema.sql`](supabase/schema.sql) es el esquema
completo, solo para una base nueva.
