# Foody — Spec de diseño v1

Oct 21, 2026 · @Ivan

## Objetivo

Foody permite que el comensal ordene y pague desde su celular escaneando el QR de su mesa, y que la orden llegue directo a cocina sin esperar al mesero. Es para **un solo restaurante**, con un panel de administración para gestionar menú, mesas, personal y ver ventas y ganancias.

**Criterios de éxito**

- Una orden enviada por el comensal aparece en la pantalla de cocina en menos de 2 segundos.
- El total que se cobra siempre lo calcula el servidor; el navegador nunca define precios.
- Nadie puede ordenar desde una mesa que el mesero no abrió.
- El dashboard muestra ventas, ganancia, órdenes del día y órdenes activas sin recargar la página.
- Un ingrediente o platillo marcado como no disponible deja de poder pedirse al instante en todos los celulares.

## Alcance v1

**Entra en la v1**

- Menú por categorías con fotos, descripción y precio.
- Personalización por platillo: quitar ingredientes, agregar extras con costo, nota libre (alergias, "sin picante") y cálculo del total.
- Disponibilidad a nivel platillo, ingrediente y extra, con la leyenda "No disponible".
- Orden directo a cocina, con varias rondas por mesa y cuenta acumulada.
- Estado de la orden visible para el comensal (recibida, preparando, lista, servida).
- Botones "Llamar al mesero" y "Pedir la cuenta".
- Pago en la app con Mercado Pago (Checkout Pro), con propina; o pago con el mesero en efectivo o tarjeta.
- Ciclo de estados de mesa con liberación automática.
- Pantalla de cocina en tiempo real con sonido y tiempo transcurrido.
- Vista de mesero: abrir mesas, ver avisos, marcar servido y registrar cobros.
- Dashboard: órdenes activas, órdenes del día, ventas, propinas y ganancia (con costos).
- Gestión de mesas (número, identificador, QR imprimible), menú, ingredientes, extras y personal.

**Fuera de la v1**

- Reportes avanzados (horas pico, más vendidos, tendencias).
- Varios idiomas.
- Impresión de comandas.
- Separar estaciones de cocina y barra.
- Varios restaurantes en la misma plataforma.

## Roles, vistas y dispositivos

Una sola app React con cuatro áreas; el comensal no inicia sesión y el personal entra con Supabase Auth.

| Vista | Ruta | Quién | Dispositivo | Qué hace |
| --- | --- | --- | --- | --- |
| Comensal | `/mesa/:token` | Cualquiera con el QR | Celular (mobile-first) | Ver menú, personalizar, ordenar, ver estado, llamar mesero, pagar |
| Cocina | `/cocina` | Rol Cocina (y Admin) | Tablet o PC | Tablero de órdenes activas, cambiar a Preparando y Lista, marcar ingredientes y platillos no disponibles |
| Mesero | `/mesero` | Rol Mesero (y Admin) | Tablet o PC | Mapa de mesas, abrir mesa, avisos de orden lista y llamadas, marcar servido, registrar cobro |
| Admin | `/admin` | Rol Admin | PC o tablet | Dashboard, CRUD de menú con fotos, ingredientes y extras, disponibilidad, mesas y QR, personal, todas las órdenes, configuración |

El Admin puede entrar a todas las vistas del personal, incluida la de cocina. Las fotos se suben a Supabase Storage desde el admin. Cocina también puede marcar algo como no disponible, porque suele ser quien se da cuenta primero.

## Arquitectura y carpetas

FastAPI es el cerebro: toda escritura con reglas de negocio pasa por él. Supabase aporta Postgres, Auth, Realtime y Storage. El backend sigue Clean Architecture y el frontend MVVM, en carpetas separadas.

**Stack:** React + TypeScript + Vite + Tailwind · FastAPI (Python 3.12) + Pydantic + SQLAlchemy · Supabase (Postgres, Auth, Realtime, Storage) · Mercado Pago Checkout Pro.

```
foody/
├── backend/
│   ├── app/
│   │   ├── domain/
│   │   │   ├── entities/        Table, TableSession, MenuItem, Ingredient, Extra, Order, OrderItem, Payment
│   │   │   ├── value_objects/   Money, TableStatus, OrderStatus
│   │   │   ├── services/        pricing.py, table_state_machine.py, order_state_machine.py, availability.py
│   │   │   └── errors.py
│   │   ├── application/
│   │   │   ├── ports/           repositorios y PaymentGateway (interfaces)
│   │   │   └── use_cases/       place_order, open_table, advance_order, request_bill, start_checkout,
│   │   │                        confirm_payment, register_manual_payment, release_tables, set_availability,
│   │   │                        manage_menu, manage_tables, get_dashboard
│   │   ├── infrastructure/
│   │   │   ├── db/              modelos SQLAlchemy, repositorios Supabase/Postgres, migraciones
│   │   │   ├── payments/        mercado_pago_gateway.py
│   │   │   ├── storage/         subida de fotos a Supabase Storage
│   │   │   ├── scheduler/       tarea que libera mesas
│   │   │   └── config.py
│   │   └── presentation/
│   │       ├── api/routers/     diner, kitchen, waiter, admin, webhooks
│   │       ├── schemas/         Pydantic de entrada y salida
│   │       └── auth/            verificación del JWT de Supabase y roles
│   └── tests/                unit/, use_cases/, integration/
└── frontend/
    └── src/
        ├── domain/              modelos y tipos (Order, MenuItem, TableStatus…)
        ├── data/
        │   ├── api/             cliente HTTP hacia FastAPI
        │   ├── realtime/        suscripciones de Supabase Realtime
        │   └── repositories/    implementaciones que usan los ViewModels
        ├── features/
        │   ├── diner/           views/ + viewmodels/ (useMenuViewModel, useCartViewModel, useOrderStatusViewModel, useCheckoutViewModel)
        │   ├── kitchen/         views/ + viewmodels/ (useKitchenBoardViewModel)
        │   ├── waiter/          views/ + viewmodels/ (useTablesMapViewModel, useServiceCallsViewModel)
        │   └── admin/           views/ + viewmodels/ (useDashboardViewModel, useMenuAdminViewModel, useTablesAdminViewModel, useStaffViewModel)
        ├── shared/              componentes UI, hooks genéricos, utilidades de formato
        └── app/                 rutas, guardias por rol, proveedores
```

**Reglas**

- Las dependencias apuntan hacia adentro: `domain` no importa FastAPI, SQLAlchemy ni Supabase; `application` solo conoce puertos.
- Las Views no tienen lógica: reciben estado y acciones de su ViewModel (`use*.ts`).
- El precio se calcula en `domain/services/pricing.py`; el frontend replica el cálculo solo como vista previa.
- Todos los montos se guardan en centavos (enteros, MXN) para evitar errores de redondeo.

## Modelo de datos

Todo es relacional en Postgres (Supabase), con llaves foráneas, 20 tablas y un historial completo de órdenes, mesas, disponibilidad y pagos.

**Columnas comunes en todas las tablas** (no se repiten abajo): `id uuid PK`, `created_at timestamptz`, `updated_at timestamptz`, `created_by uuid FK staff` (null si lo creó el comensal o el sistema), `updated_by uuid FK staff`. Las tablas de catálogo agregan `deleted_at` (borrado lógico). Los montos van en centavos MXN (`int`).

### Personal y configuración

**staff**

| Columna | Tipo | Notas |
| --- | --- | --- |
| id | uuid PK, FK auth.users | El mismo id del usuario de Supabase Auth |
| full\_name | text |  |
| role | enum staff\_role | admin, kitchen, waiter |
| is\_active | bool | Desactivar sin borrar |

**restaurant\_settings** (una sola fila)

| Columna | Tipo | Notas |
| --- | --- | --- |
| name | text | Nombre del restaurante |
| logo\_path | text | Ruta en Supabase Storage |
| currency | text | MXN |
| timezone | text | America/Mexico\_City |
| auto\_release\_minutes | int | Minutos en Cerrada antes de volver a Libre (default 5) |
| tip\_options | int\[\] | Porcentajes sugeridos, p. ej. 10, 15, 20 |

### Mesas

**dining\_tables**

| Columna | Tipo | Notas |
| --- | --- | --- |
| code | text unique | Identificador visible: "M5", "T2" |
| label | text | Nombre opcional: "Terraza 2" |
| zone | text | Salón, terraza, barra |
| capacity | int | Personas |
| qr\_token | text unique | Token aleatorio de 32 caracteres; se puede regenerar |
| status | enum table\_status | free, occupied, awaiting\_order, served, bill\_requested, closed |
| current\_session\_id | uuid FK table\_sessions | Null cuando está libre |
| status\_changed\_at | timestamptz | Para liberar y medir rotación |
| sort\_order | int | Orden en el mapa |
| deleted\_at | timestamptz |  |

**table\_sessions** (desde que se abre la mesa hasta que se libera)

| Columna | Tipo | Notas |
| --- | --- | --- |
| table\_id | uuid FK dining\_tables |  |
| opened\_by | uuid FK staff | Mesero que la abrió |
| guests\_count | int | Opcional |
| opened\_at | timestamptz |  |
| bill\_requested\_at | timestamptz |  |
| paid\_at | timestamptz | Saldo llegó a cero |
| closed\_at | timestamptz | Liberada |
| subtotal\_cents | int | Suma de órdenes no canceladas |
| tip\_cents | int | Suma de propinas |
| cost\_cents | int | Suma de costos, para la ganancia |
| paid\_cents | int | Suma de pagos aprobados |

**table\_status\_history**

| Columna | Tipo | Notas |
| --- | --- | --- |
| table\_id | uuid FK dining\_tables |  |
| session\_id | uuid FK table\_sessions | Null al pasar a Libre |
| from\_status / to\_status | enum table\_status |  |
| source | enum change\_source | staff, diner, system, payment |
| changed\_by | uuid FK staff | Null si no fue el personal |
| changed\_at | timestamptz |  |

### Menú

**categories**

| Columna | Tipo | Notas |
| --- | --- | --- |
| name | text |  |
| description | text |  |
| sort\_order | int |  |
| is\_active | bool | Ocultar del menú |
| deleted\_at | timestamptz |  |

**menu\_items**

| Columna | Tipo | Notas |
| --- | --- | --- |
| category\_id | uuid FK categories |  |
| name | text |  |
| description | text |  |
| price\_cents | int | Precio de venta |
| cost\_cents | int | Costo, para la ganancia |
| photo\_path | text | Ruta en Supabase Storage |
| is\_available | bool | Interruptor manual "No disponible" |
| prep\_minutes | int | Tiempo estimado, se muestra al comensal |
| tags | text\[\] | vegano, sin gluten, picante |
| sort\_order | int |  |
| is\_active | bool | Oculto del menú (distinto de agotado) |
| deleted\_at | timestamptz |  |

**ingredients** (catálogo global, compartido entre platillos)

| Columna | Tipo | Notas |
| --- | --- | --- |
| name | text unique | "Aguacate", "Cebolla" |
| is\_available | bool | Afecta a todos los platillos y extras que lo usan |
| deleted\_at | timestamptz |  |

**menu\_item\_ingredients**

| Columna | Tipo | Notas |
| --- | --- | --- |
| menu\_item\_id | uuid FK menu\_items |  |
| ingredient\_id | uuid FK ingredients | Unique junto con menu\_item\_id |
| is\_removable | bool | true: el comensal puede quitarlo; false: es esencial |
| sort\_order | int |  |

**extras** (catálogo global)

| Columna | Tipo | Notas |
| --- | --- | --- |
| name | text | "Queso extra" |
| price\_cents | int |  |
| cost\_cents | int |  |
| ingredient\_id | uuid FK ingredients | Opcional: si ese ingrediente se agota, el extra también |
| is\_available | bool |  |
| deleted\_at | timestamptz |  |

**menu\_item\_extras**

| Columna | Tipo | Notas |
| --- | --- | --- |
| menu\_item\_id | uuid FK menu\_items |  |
| extra\_id | uuid FK extras | Unique junto con menu\_item\_id |
| max\_quantity | int | Default 1 |
| sort\_order | int |  |

**availability\_log**

| Columna | Tipo | Notas |
| --- | --- | --- |
| entity\_type | enum | menu\_item, ingredient, extra |
| entity\_id | uuid |  |
| is\_available | bool | Valor nuevo |
| changed\_by | uuid FK staff |  |
| changed\_at | timestamptz |  |

### Órdenes

**orders** (una por ronda)

| Columna | Tipo | Notas |
| --- | --- | --- |
| session\_id | uuid FK table\_sessions |  |
| table\_id | uuid FK dining\_tables | Copia para reportes rápidos |
| daily\_number | int | Número corto que ve cocina (#014), reinicia cada día |
| round\_number | int | 1, 2, 3 dentro de la sesión |
| status | enum order\_status | received, preparing, ready, served, cancelled |
| idempotency\_key | uuid unique | Evita duplicados por doble toque |
| subtotal\_cents | int | Calculado por el servidor |
| cost\_cents | int |  |
| created\_at | timestamptz | Hora en que llegó a cocina |
| preparing\_at | timestamptz |  |
| ready\_at | timestamptz |  |
| served\_at | timestamptz |  |
| cancelled\_at | timestamptz |  |
| cancelled\_by | uuid FK staff |  |
| cancel\_reason | text |  |

**order\_items**

| Columna | Tipo | Notas |
| --- | --- | --- |
| order\_id | uuid FK orders |  |
| menu\_item\_id | uuid FK menu\_items |  |
| item\_name | text | Copia al momento de ordenar |
| unit\_price\_cents | int | Copia |
| unit\_cost\_cents | int | Copia |
| quantity | int | ≥ 1 |
| note | text | Alergias, "sin picante" |
| line\_total\_cents | int | (precio + extras) × cantidad |
| line\_cost\_cents | int |  |

**order\_item\_extras**

| Columna | Tipo | Notas |
| --- | --- | --- |
| order\_item\_id | uuid FK order\_items |  |
| extra\_id | uuid FK extras |  |
| extra\_name | text | Copia |
| unit\_price\_cents | int | Copia |
| unit\_cost\_cents | int | Copia |
| quantity | int |  |

**order\_item\_removed\_ingredients**

| Columna | Tipo | Notas |
| --- | --- | --- |
| order\_item\_id | uuid FK order\_items |  |
| ingredient\_id | uuid FK ingredients |  |
| ingredient\_name | text | Copia |

**order\_status\_history**

| Columna | Tipo | Notas |
| --- | --- | --- |
| order\_id | uuid FK orders |  |
| from\_status / to\_status | enum order\_status |  |
| source | enum change\_source |  |
| changed\_by | uuid FK staff |  |
| changed\_at | timestamptz |  |

### Pagos y avisos

**payments**

| Columna | Tipo | Notas |
| --- | --- | --- |
| session\_id | uuid FK table\_sessions |  |
| method | enum | mercado\_pago, cash, card\_terminal |
| status | enum | pending, approved, rejected, cancelled, refunded |
| amount\_cents | int | Sin propina |
| tip\_cents | int |  |
| mp\_preference\_id | text |  |
| mp\_payment\_id | text unique | Garantiza procesar cada pago una vez |
| received\_by | uuid FK staff | En pagos con el mesero |
| paid\_at | timestamptz |  |

**payment\_webhook\_events**

| Columna | Tipo | Notas |
| --- | --- | --- |
| mp\_event\_id | text unique |  |
| payload | jsonb | Registro crudo para auditoría |
| received\_at | timestamptz |  |
| processed\_at | timestamptz |  |
| error | text |  |

**service\_calls**

| Columna | Tipo | Notas |
| --- | --- | --- |
| session\_id | uuid FK table\_sessions |  |
| table\_id | uuid FK dining\_tables |  |
| type | enum | call\_waiter, request\_bill |
| attended\_at | timestamptz |  |
| attended\_by | uuid FK staff |  |

**Índices clave:** `orders(status, created_at)`, `orders(session_id)`, `payments(session_id, status)`, `dining_tables(qr_token)`, `order_status_history(order_id, changed_at)`.

## Disponibilidad

El Admin o Cocina puede marcar un platillo, un ingrediente o un extra como no disponible; el cambio llega a todos los celulares en segundos y el servidor rechaza cualquier orden que lo incluya.

| Qué se desactiva | Qué ve el comensal | ¿Se puede pedir? |
| --- | --- | --- |
| Platillo (`menu_items.is_available = false`) | Tarjeta en gris con la leyenda "No disponible" | No |
| Ingrediente esencial (`is_removable = false`) | El platillo completo aparece como "No disponible" | No |
| Ingrediente removible (`is_removable = true`) | El platillo se puede pedir; el ingrediente aparece tachado con "No disponible" y se excluye solo | Sí, sin ese ingrediente |
| Extra (`extras.is_available = false`, o su ingrediente agotado) | El extra aparece deshabilitado con "No disponible" | El platillo sí; el extra no |

**Cómo se calcula.** `domain/services/availability.py` decide la disponibilidad efectiva de cada platillo a partir de esas reglas. El endpoint del menú devuelve, por platillo, `available`, `unavailable_reason` y la lista de ingredientes y extras con su propio `available`.

**Cómo se cambia.** En Admin, cada platillo, ingrediente y extra tiene un interruptor; además hay una pantalla rápida de "Disponibilidad de hoy" con buscador, pensada para tablet. Cocina tiene la misma pantalla rápida. Cada cambio queda en `availability_log`.

**Cómo se entera el comensal.** El menú del comensal se vuelve a pedir cada 30 segundos y al abrir el carrito. Si algo del carrito se agotó, la línea se marca y el botón de enviar pide quitarla primero.

## Estados de mesa y orden

La mesa tiene 6 estados y la orden 5; ambas máquinas viven en `domain` y rechazan cualquier salto no listado aquí.

&#91;embedded content: estados de la mesa · 6 estados\]

También se puede pedir la cuenta desde Ocupada o En espera de orden. Con la cuenta solicitada ya no se aceptan rondas nuevas. Si la mesa quiere pedir algo más, primero paga la cuenta actual y el mesero abre una cuenta nueva (nueva sesión) en la misma mesa, sin esperar la liberación automática.

| Transición de mesa | Quién la dispara |
| --- | --- |
| Libre → Ocupada | Mesero (`open_table`) |
| Ocupada → En espera de orden | Comensal envía su primera orden |
| En espera de orden → Orden servida | Sistema, cuando todas las órdenes de la sesión están servidas o canceladas |
| Orden servida → En espera de orden | Comensal envía otra ronda |
| Ocupada, En espera u Orden servida → Cuenta solicitada | Comensal (pedir cuenta o iniciar pago) o mesero |
| Cuenta solicitada → Cerrada | Sistema, cuando `paid_cents` cubre subtotal y propina |
| Cerrada → Libre | Sistema tras `auto_release_minutes`, o el mesero a mano. El mesero también puede pasar de Cerrada a Ocupada para abrir una cuenta nueva |

**Orden:** Recibida → Preparando → Lista → Servida. Cocina mueve las dos primeras y el mesero marca Servida. Solo se puede cancelar en Recibida o Preparando, por un Mesero o el Admin y con motivo; una orden cancelada no suma a la cuenta.

## Flujos

La orden va directo a cocina; el pago en la app se confirma solo por el webhook de Mercado Pago.

**Abrir mesa**

1. El mesero toca una mesa Libre en `/mesero` y captura el número de personas (opcional).
2. FastAPI (`open_table`) crea la `table_session`, pone la mesa en Ocupada y registra el historial.
3. El celular del comensal, que ya tenía el menú abierto, habilita el botón de ordenar en su siguiente consulta.

**Ordenar**

1. El comensal escanea el QR y abre `/mesa/<qr_token>`. Con la mesa Libre o Cerrada ve el menú, pero no puede ordenar.
2. Arma su carrito: platillo, cantidad, ingredientes quitados, extras y nota. El frontend muestra el total como vista previa.
3. Al enviar, el frontend manda solo ids y cantidades, más una `idempotency_key`.
4. FastAPI (`place_order`) valida que la sesión esté abierta y que todo esté disponible; calcula precio y costo desde la base, copia nombres y precios, y guarda orden, líneas e historial en una sola transacción.
5. La mesa pasa a En espera de orden. Cocina recibe la orden por Supabase Realtime con sonido, número corto (#014), mesa y tiempo transcurrido.
6. Cocina toca Preparando y después Lista. El mesero recibe el aviso de orden lista.
7. El mesero la entrega y toca Servida. Si no quedan otras rondas pendientes, la mesa pasa a Orden servida.
8. Una nueva ronda repite los pasos 2 a 7 en la misma sesión y suma a la cuenta.

**Pagar en la app**

1. El comensal toca Pagar, ve el desglose de todas las rondas y elige propina (10, 15, 20 % u otra).
2. FastAPI (`start_checkout`) crea un `payment` pendiente y una preferencia de Checkout Pro por el saldo más la propina; la mesa pasa a Cuenta solicitada.
3. El comensal paga en Mercado Pago y regresa a una pantalla de "Confirmando pago".
4. El webhook llega a `/webhooks/mercado-pago`. FastAPI valida la firma, consulta el pago en la API de Mercado Pago y lo marca aprobado o rechazado una sola vez.
5. Con saldo en cero, la sesión queda pagada y la mesa pasa a Cerrada. El comensal ve "Gracias" y el mesero recibe el aviso.

**Pagar con el mesero**

1. El comensal toca Pedir la cuenta; se crea un `service_call` y la mesa pasa a Cuenta solicitada.
2. El mesero cobra y registra método (efectivo o terminal), monto y propina (`register_manual_payment`).
3. Con saldo en cero, la mesa pasa a Cerrada.

**Liberar mesa**

Una tarea programada en FastAPI corre cada minuto y pasa a Libre las mesas que llevan más de `auto_release_minutes` en Cerrada; cierra la sesión y deja `current_session_id` en null. El mesero también puede liberarla a mano.

**Tiempo real**

| Quién | Cómo recibe cambios | Por qué |
| --- | --- | --- |
| Cocina, Mesero, Admin | Supabase Realtime sobre `orders`, `dining_tables`, `service_calls` y `payments`, con RLS por rol | Tienen sesión de Supabase Auth |
| Comensal | Consulta a FastAPI cada 5 s para el estado de su orden y cada 30 s para el menú | Es anónimo; no se le abre la base de datos |

Al reconectar, las pantallas del personal vuelven a cargar todo lo activo y muestran un aviso de que estuvieron sin conexión.

## API del backend

REST bajo `/api/v1`; las rutas del comensal se autorizan con el `qr_token` de la mesa y las del personal con el JWT de Supabase más el rol.

| Método y ruta | Rol | Caso de uso |
| --- | --- | --- |
| GET `/diner/tables/{qr_token}` | Comensal | Mesa, estado y si puede ordenar |
| GET `/diner/tables/{qr_token}/menu` | Comensal | Menú con disponibilidad efectiva |
| POST `/diner/tables/{qr_token}/orders` | Comensal | `place_order` |
| GET `/diner/tables/{qr_token}/session` | Comensal | Rondas, estados y saldo |
| POST `/diner/tables/{qr_token}/service-calls` | Comensal | Llamar mesero o pedir cuenta |
| POST `/diner/tables/{qr_token}/checkout` | Comensal | `start_checkout` (devuelve la URL de Mercado Pago) |
| POST `/webhooks/mercado-pago` | Mercado Pago | `confirm_payment` |
| GET `/kitchen/orders?status=active` | Cocina | Órdenes activas |
| POST `/kitchen/orders/{id}/status` | Cocina | `advance_order` (preparing, ready) |
| PATCH `/availability/{type}/{id}` | Cocina, Admin | `set_availability` |
| GET `/waiter/tables` | Mesero | Mapa de mesas con estado |
| POST `/waiter/tables/{id}/open` | Mesero | `open_table` |
| POST `/waiter/tables/{id}/release` | Mesero | Liberar a mano |
| POST `/waiter/orders/{id}/served` | Mesero | `advance_order` (served) |
| POST `/waiter/orders/{id}/cancel` | Mesero, Admin | Cancelar con motivo |
| POST `/waiter/sessions/{id}/payments` | Mesero | `register_manual_payment` |
| POST `/waiter/service-calls/{id}/attend` | Mesero | Marcar aviso atendido |
| CRUD `/admin/categories`, `/admin/menu-items`, `/admin/ingredients`, `/admin/extras` | Admin | `manage_menu` |
| POST `/admin/menu-items/{id}/photo` | Admin | Subir foto a Storage |
| CRUD `/admin/tables` y POST `/admin/tables/{id}/regenerate-qr` | Admin | `manage_tables` |
| GET `/admin/tables/{id}/qr.png` | Admin | QR imprimible |
| CRUD `/admin/staff` | Admin | Alta de personal y rol |
| GET `/admin/orders?from&to&status&table` | Admin | Historial de órdenes |
| GET `/admin/dashboard?date` | Admin | `get_dashboard` |
| GET/PUT `/admin/settings` | Admin | Configuración |

Errores con forma única: `{"code": "item_unavailable", "message": "…", "details": {…}}`.

## Dashboard e indicadores

El dashboard del Admin muestra el día en curso (con selector de fecha) y se actualiza en tiempo real.

| Indicador | Cómo se calcula |
| --- | --- |
| Ventas del día | Suma de `payments.amount_cents` aprobados con `paid_at` en el día |
| Propinas | Suma de `payments.tip_cents` aprobados |
| Ganancia | Ventas menos la suma de `cost_cents` de las órdenes pagadas |
| Margen | Ganancia entre ventas, en % |
| Órdenes del día | Órdenes no canceladas creadas en el día |
| Órdenes canceladas | Conteo, con motivo |
| Ticket promedio | Ventas entre sesiones pagadas |
| Tiempo promedio de preparación | `ready_at` menos `created_at` |
| Tiempo promedio de entrega | `served_at` menos `ready_at` |
| Mesas ocupadas ahora | Mesas que no están Libres, de un total |

**Paneles debajo de los indicadores:** órdenes activas en columnas por estado (la misma vista que cocina, en solo lectura), mapa de mesas con su estado, ventas por hora del día y la tabla de órdenes del día con filtros por estado y mesa.

Los días se cortan en la zona horaria `America/Mexico_City`.

## Errores y seguridad

Las reglas viven en `domain` y el servidor es la única fuente de verdad para precios, estados y pagos.

| Situación | Respuesta del sistema |
| --- | --- |
| Algo del carrito se agotó | 409 `item_unavailable` con las líneas afectadas; el carrito las marca para quitarlas |
| El precio cambió desde la vista previa | 409 `price_changed` con el total nuevo; el comensal confirma de nuevo |
| Mesa no abierta o QR inválido | 403 `table_not_open` o 404; el menú se sigue viendo |
| Doble toque en Enviar | La misma `idempotency_key` devuelve la orden ya creada |
| Transición de estado inválida | 409 `invalid_transition` desde la máquina de estados |
| Webhook repetido o fuera de orden | Se ignora si el `mp_payment_id` ya fue procesado |
| Webhook que nunca llega | El comensal ve "Confirmando pago"; tras 2 minutos la app consulta el pago a Mercado Pago, y el mesero ve la mesa en Cuenta solicitada |
| Cocina pierde conexión | Aviso en pantalla y recarga completa al volver |

**Seguridad**

- El `qr_token` es aleatorio y se puede regenerar; una mesa sin abrir no acepta órdenes.
- Límite de solicitudes por `qr_token` e IP en las rutas del comensal (p. ej. 10 órdenes por minuto).
- RLS en Supabase: el rol `anon` no lee ni escribe nada; el personal solo lee por Realtime; las escrituras van por FastAPI con la llave de servicio.
- La firma del webhook de Mercado Pago se valida con su secreto, y el estado del pago siempre se confirma con su API.
- Las llaves (Supabase service role, Mercado Pago) viven solo en variables de entorno del backend.

## Pruebas

Se trabaja con TDD; `domain` se prueba sin base de datos y los flujos completos con Playwright.

| Nivel | Herramienta | Qué cubre |
| --- | --- | --- |
| Dominio | pytest | Cálculo de precio y costo, disponibilidad efectiva, máquinas de estado de mesa y orden |
| Casos de uso | pytest con repositorios y gateway falsos | `place_order`, `open_table`, `confirm_payment` con webhooks repetidos, `release_tables` |
| Integración API | pytest + httpx contra Supabase local (CLI) | Rutas, roles, RLS, idempotencia, firma del webhook |
| ViewModels | Vitest + Testing Library | Carrito y total, tablero de cocina, mapa de mesas, dashboard |
| End to end | Playwright | Abrir mesa, ordenar con extras e ingrediente quitado, cocina, servir, pagar con el mesero y en sandbox de Mercado Pago, liberar mesa |

Los pagos se prueban con las credenciales de prueba de Mercado Pago; nunca con cobros reales.
