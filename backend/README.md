# Foody — backend

FastAPI con Clean Architecture sobre Supabase (Postgres). Capas:

- `app/domain`: reglas puras (precio, disponibilidad, estados de mesa y orden).
- `app/application`: casos de uso sobre puertos (`ports.py`) y una unidad de trabajo.
- `app/infrastructure`: SQLAlchemy + psycopg, verificación de JWT de Supabase, reloj y tarea de liberación.
- `app/presentation`: rutas FastAPI bajo `/api/v1`, esquemas y mapeo de errores `{"code","message","details"}`.

## Requisitos

- Python 3.12+ y [uv](https://docs.astral.sh/uv/)
- Docker y la CLI de Supabase (`npx supabase@latest ...` funciona sin instalarla)

## Arranque local

Desde la raíz del repo:

```bash
npx supabase@latest start      # levanta Postgres, Auth, Realtime y Storage en Docker
npx supabase@latest db reset   # aplica supabase/migrations y carga supabase/seed.sql
```

Luego en `backend/`:

```bash
cp .env.example .env           # los valores ya apuntan al Supabase local
uv sync
uv run uvicorn app.main:create_app --factory --reload
```

La API queda en http://127.0.0.1:8000/api/v1 y la documentación interactiva en http://127.0.0.1:8000/docs.

`ENABLE_SCHEDULER=true` arranca una tarea cada 60 s que libera las mesas `closed` después de
`restaurant_settings.auto_release_minutes` (5 por defecto).

## Pruebas

```bash
uv run pytest                    # unitarias y de API (sin base de datos)
uv run pytest -m integration     # contra el Supabase local; corre db reset antes si lo necesitas
uv run ruff check .
```

## Datos demo del seed

| Usuario | Contraseña | Rol |
|---|---|---|
| admin@foody.local | foody1234 | admin |
| cocina@foody.local | foody1234 | kitchen |
| mesero@foody.local | foody1234 | waiter |

Mesas M1–M4, T1 y T2. El QR de cada una es `dev-qr-<mesa>-000000000000000000000000`
(por ejemplo `dev-qr-m1-000000000000000000000000`), así que el comensal de M1 usa
`GET /api/v1/diner/tables/dev-qr-m1-000000000000000000000000/menu`.

Para obtener un token de personal:

```bash
curl -s http://127.0.0.1:54321/auth/v1/token?grant_type=password \
  -H "apikey: <anon key de supabase status>" -H "Content-Type: application/json" \
  -d '{"email":"mesero@foody.local","password":"foody1234"}'
```

y mándalo como `Authorization: Bearer <access_token>`.

## Rutas

| Método y ruta | Quién |
|---|---|
| `GET /diner/tables/{qr}` · `/menu` · `/session` | comensal |
| `POST /diner/tables/{qr}/orders` (10 por minuto por mesa e IP) | comensal |
| `GET /kitchen/orders?status=active` · `POST /kitchen/orders/{id}/status` | cocina |
| `GET /waiter/tables` · `POST /waiter/tables/{id}/open` · `/reopen` · `/release` | mesero |
| `POST /waiter/orders/{id}/served` · `/cancel` | mesero |

El rol `admin` pasa todas las restricciones de rol.
