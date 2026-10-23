# Foody v1 — Roadmap de planes

**Spec:** [Foody — Spec de diseño v1](https://claude.ai/artifact/XF2pj8rMVHXiPMSSeUWYmy) (aprobada 2026-10-22)
**Diseño visual:** [Foody — Propuestas de diseño](https://claude.ai/artifact/EG1Vhx3aFt7yuU8iZ2Acd1), propuesta B "Fresco", paleta Bosque, artboards `B-*` y splash `B-Splash` (sándwich) y `B-SplashBowl` (bowl).

La spec cubre cinco subsistemas. Cada plan entrega software que funciona y se prueba solo; se ejecutan en este orden porque cada uno consume las interfaces del anterior.

| # | Plan | Entrega | Depende de |
|---|------|---------|------------|
| 1 | [Backend núcleo](2026-10-22-foody-01-backend-core.md) | Esquema completo en Supabase, dominio (precio, disponibilidad, estados), abrir mesa, ordenar, cocina y mesero vía API | — |
| 2 | Cuenta y administración (backend) | Pedir cuenta, llamar mesero, cobro manual por el mesero y cierre de mesa; CRUD de menú/ingredientes/extras, fotos en Storage, mesas y QR, personal, disponibilidad con log, dashboard y configuración | 1 |
| 3 | Frontend base + comensal | Vite/React/Tailwind con tokens Fresco/Bosque, splash, menú, detalle, carrito, estado de orden, pedir cuenta | 1, 2 |
| 4 | Frontend del personal + E2E | Login, cocina, mesero, admin, disponibilidad de hoy, Realtime, Playwright de punta a punta | 2, 3 |
| 5 | Pago en línea (pendiente) | Mercado Pago Checkout Pro + webhook y propina en la app | 2, 3 |

**2026-10-23:** Ivan pidió dejar Mercado Pago pendiente porque por ahora es un demo. El pago queda solo con el mesero (efectivo o tarjeta), y el plan de pago en línea pasa al final.

Los planes 2 a 4 se escriben cuando termine el anterior, contra el código real.
