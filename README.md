# Foody

Pedidos desde la mesa para un restaurante: el comensal ordena y paga desde el QR de su mesa, cocina recibe la orden al instante y el administrador ve ventas, ganancias y gestiona menú y mesas.

- Spec: `docs/superpowers/specs/2026-10-21-foody-design-v1.md`
- Planes: `docs/superpowers/plans/`

Stack: React + Tailwind (MVVM) · FastAPI (Clean Architecture) · Supabase · Mercado Pago.

## Levantar todo en local

```bash
npx supabase@latest start && npx supabase@latest db reset     # base, Auth y Storage con datos demo
cd backend && cp .env.example .env && uv sync && uv run uvicorn app.main:create_app --factory --reload
cd frontend && cp .env.example .env && npm install && npm run dev
```

- Comensal: http://127.0.0.1:5173/mesa/dev-qr-m1-000000000000000000000000 (la mesa la abre un mesero).
- API y documentación: http://127.0.0.1:8000/docs.
- Usuarios demo: `admin@foody.local`, `cocina@foody.local`, `mesero@foody.local`, contraseña `foody1234`.

Detalles en `backend/README.md` y `frontend/README.md`.
