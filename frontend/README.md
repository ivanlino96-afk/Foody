# Foody · frontend

React 19 + TypeScript + Tailwind 4 con Vite, en MVVM: cada pantalla (`features/*/views`) pinta lo que le da su ViewModel (`features/*/viewmodels/use*ViewModel.ts`), que usa los repositorios de `data/` y las reglas puras de `domain/`.

## Arranque

Con el backend corriendo en `http://127.0.0.1:8000` (ver `backend/README.md`):

```bash
cp .env.example .env
npm install
npm run dev          # http://127.0.0.1:5173, con proxy de /api al backend
```

El comensal entra por `/mesa/<qr_token>`. Con el seed local: http://127.0.0.1:5173/mesa/dev-qr-m1-000000000000000000000000. La mesa tiene que estar abierta por un mesero para poder enviar órdenes.

## Comandos

```bash
npm test             # Vitest (modo watch); npm test -- --run para una sola pasada
npm run lint         # ESLint
npm run build        # tsc + build de producción en dist/
node e2e-smoke.mjs   # prueba de humo del comensal contra el stack local; capturas en smoke-shots/
```

## Estructura

```
src/
├── domain/        tipos del API, dinero y carrito (precio de vista previa)
├── data/          cliente HTTP, API del comensal, carrito en sessionStorage, URLs de fotos
├── features/diner contexto de la mesa (consulta cada 5 s la mesa/cuenta y cada 30 s el menú), ViewModels y vistas
├── shared/        polling y componentes de UI
└── app/           rutas
```
