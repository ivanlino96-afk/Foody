# E2E de punta a punta

`npm run e2e` recorre un servicio completo en el stack local real, con cuatro navegadores a la vez:

1. El mesero inicia sesión y abre la mesa (M2 por defecto).
2. El comensal (390×844) escanea el QR, agrega un platillo y lo envía a cocina.
3. La orden aparece en la pantalla de cocina sin recargar, en menos de 3 s (Realtime).
4. Cocina: Empezar → Marcar lista. Mesero: Marcar servida.
5. El comensal pide la cuenta; el mesero registra el cobro total con 10 % de propina.
6. El comensal ve "¡Gracias por tu visita!" y el dashboard del admin muestra la venta.

Las capturas quedan en `smoke-shots/e2e/` (ignorado por git).

## Requisitos

- Supabase local con Auth, Realtime, Storage y el gateway (`npx supabase start`; si excluyes servicios, no excluyas `kong`, `gotrue`, `realtime`, `storage-api` ni `postgrest`).
- Backend en `127.0.0.1:8000` con `SUPABASE_SERVICE_ROLE_KEY` de `npx supabase status -o env`.
- Vite en `127.0.0.1:5173` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en `frontend/.env`.
- La mesa debe estar libre o cerrada (una cerrada se libera sola). Si quedó a medias, `npx supabase db reset`.

Variables opcionales: `APP_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `CHROMIUM`, `E2E_TABLE`, `E2E_QR`.
