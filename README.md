# Foody

Pedidos desde la mesa para un restaurante: el comensal ordena y paga desde el QR de su mesa, cocina recibe la orden al instante y el administrador ve ventas, ganancias y gestiona menú y mesas.

- Spec: `docs/superpowers/specs/2026-10-21-foody-design-v1.md`
- Planes: `docs/superpowers/plans/`

Stack: React + Tailwind (MVVM) · FastAPI (Clean Architecture) · Supabase · Mercado Pago.

## Levantar todo en local

```bash
npx supabase@latest start && npx supabase@latest db reset     # base, Auth, Realtime y Storage con datos demo
npx supabase@latest status -o env                              # copia ANON_KEY y SERVICE_ROLE_KEY
cd backend && cp .env.example .env && uv sync && uv run uvicorn app.main:create_app --factory --reload   # SUPABASE_SERVICE_ROLE_KEY en .env
cd frontend && cp .env.example .env && npm install && npm run dev                                       # VITE_SUPABASE_ANON_KEY en .env
```

- Personal: http://127.0.0.1:5173/login → cocina en `/cocina`, mesero en `/mesero`, administrador en `/admin`.
- Comensal: http://127.0.0.1:5173/mesa/dev-qr-m1-000000000000000000000000 (la mesa la abre un mesero).
- API y documentación: http://127.0.0.1:8000/docs.
- Usuarios demo: `admin@foody.local`, `cocina@foody.local`, `mesero@foody.local`, contraseña `foody1234`.

Prueba de punta a punta (mesero, cocina, comensal y admin en cuatro navegadores): `cd frontend && npm run e2e`, ver `frontend/e2e/README.md`.

Detalles en `backend/README.md` y `frontend/README.md`.
