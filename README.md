# Agenda de citas

Aplicación web de gestión de clientes y citas. Los clientes reservan solos desde una página pública y la empresa gestiona su disponibilidad, servicios, clientes y reportes desde un panel privado. Todo está en español y diseñado primero para móvil.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Prisma 6 + MySQL/MariaDB · Auth.js v5 · Nodemailer · Zod · Luxon · FullCalendar · Vitest.

No necesita Docker ni Redis: el rate limiting se guarda en MySQL y los recordatorios se disparan con un cron job que llama a un endpoint protegido.

---

## Índice

1. [Requisitos](#requisitos)
2. [Instalación local](#instalación-local)
3. [Variables de entorno](#variables-de-entorno)
4. [Despliegue en Hostinger](#despliegue-en-hostinger)
5. [Recordatorios (cron job)](#recordatorios-cron-job)
6. [Módulos y cómo probarlos](#módulos-y-cómo-probarlos)
7. [Pruebas](#pruebas)
8. [Arquitectura](#arquitectura)
9. [Seguridad](#seguridad)

---

## Requisitos

- Node.js **20 o 22**
- MySQL 8 o MariaDB 10.6 o superior (base de datos en `utf8mb4`)

## Instalación local

```bash
npm install
cp .env.example .env          # edita DATABASE_URL, AUTH_SECRET, CRON_SECRET y SMTP
npx prisma migrate dev        # crea las tablas
npm run db:seed               # datos de ejemplo (BORRA lo que haya)
npm run dev                   # http://localhost:3000
```

Con `MAIL_DRY_RUN=true` los correos se imprimen en la consola en lugar de enviarse.

### Accesos de prueba (seed)

| Rol | Email | Contraseña |
|---|---|---|
| Administrador | admin@demo.com | Admin12345 |
| Profesional | ana@demo.com · carlos@demo.com · sofia@demo.com | Empleado123 |
| Cliente | cliente@demo.com | Cliente123 |

El seed crea 1 negocio (zona America/New_York), 3 profesionales con horarios partidos, 5 servicios (uno de ellos una clase grupal de 8 plazas), 20 clientes (más un duplicado intencional para probar la fusión), un día libre, un feriado y citas desde 2 semanas atrás hasta 2 semanas adelante.

### Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | `prisma generate` + build de producción |
| `npm run build:deploy` | `prisma generate` + **migraciones** + build (para Hostinger) |
| `npm start` | Arranca el build de producción (respeta la variable `PORT`) |
| `npm test` | Pruebas unitarias (Vitest) |
| `RUN_DB_TESTS=1 npm test` | Además, pruebas de integración contra MySQL (reservas concurrentes) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:deploy` | Aplica las migraciones pendientes |
| `npm run setup:prod` | Configuración inicial segura: negocio, plantillas y administrador (**no borra nada**) |
| `npm run db:seed` | Datos de ejemplo (**borra todos los datos**; solo para desarrollo) |

## Variables de entorno

Ver `.env.example`. Las imprescindibles:

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | `mysql://usuario:contraseña@host:3306/base`. Si la contraseña tiene símbolos, codifícalos en la URL (`@` → `%40`, `#` → `%23`). |
| `AUTH_SECRET` | Secreto de sesiones y enlaces de gestión de citas. Genéralo con `openssl rand -base64 32`. **Si lo cambias, los enlaces "Gestionar mi cita" ya enviados dejan de funcionar.** |
| `APP_URL` / `AUTH_URL` | URL pública, sin barra final (ej. `https://citas.tudominio.com`). Se usa en los correos. |
| `AUTH_TRUST_HOST` | `true` (Hostinger sirve la app detrás de un proxy). |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD` | Servidor de correo. En Hostinger: `smtp.hostinger.com`, puerto `465`, `SMTP_SECURE=true`. |
| `MAIL_FROM` | Remitente. Por defecto `info@livingriverllc.com`. Debe ser un buzón que el SMTP permita usar. |
| `CRON_SECRET` | Token del endpoint de recordatorios (mínimo 16 caracteres). |
| `UPLOAD_DIR` | Carpeta de los logos subidos (por defecto `./uploads`, fuera de `public/`). |

---

## Despliegue en Hostinger

Pensado para un plan de Hostinger con **aplicaciones Node.js** (hPanel → *Websites* → *Node.js Web App*, o un VPS) con 3 GB de RAM, 2 núcleos y MySQL.

### 1. Crear la base de datos

hPanel → **Bases de datos → Bases de datos MySQL**: crea la base y el usuario, y apunta el host. En hosting compartido suele ser `localhost`; si no, usa el que muestra hPanel. Con eso arma la `DATABASE_URL`.

### 2. Crear el buzón de correo

hPanel → **Correos**: crea `info@livingriverllc.com` (o el remitente que vayas a usar) y su contraseña. Esos datos van en `SMTP_USER` y `SMTP_PASSWORD`.

### 3. Crear la aplicación Node.js

hPanel → **Node.js Web App → Crear**. Conecta el repositorio de GitHub o sube el proyecto en un ZIP (sin `node_modules` ni `.next`).

| Opción | Valor |
|---|---|
| Versión de Node.js | 20.x o 22.x |
| Framework | Next.js |
| Comando de instalación | `npm ci` (o `npm install`) |
| Comando de build | `npm run build:deploy` |
| Comando de inicio | `npm start` |
| Directorio | raíz del proyecto |

En **Variables de entorno** añade todas las del apartado anterior, con `APP_URL` y `AUTH_URL` apuntando al dominio final.

> `build:deploy` aplica las migraciones de Prisma antes del build, así que no hace falta entrar por SSH para crear las tablas.
>
> Si el build se queda sin memoria, añade la variable `NODE_OPTIONS=--max-old-space-size=2048`.

### 4. Crear el administrador (una sola vez)

Por SSH, desde la carpeta de la app, o con un comando de despliegue de un solo uso en hPanel:

```bash
ADMIN_EMAIL=tu@correo.com ADMIN_PASSWORD='UnaClaveLarga2026' ADMIN_NAME='Tu Nombre' \
BUSINESS_NAME='Living River' npm run setup:prod
```

Este script no borra nada y se puede repetir para restablecer la contraseña del administrador. **No ejecutes `npm run db:seed` en producción.**

### 5. Primeros pasos en el panel

1. **Configuración:** nombre, logo, colores, zona horaria (por defecto America/New_York), políticas y el email que recibirá los avisos de reservas.
2. **Profesionales:** crea cada profesional y, si debe entrar al panel, dale acceso con su email.
3. **Servicios:** duración, precio, preparación, capacidad y qué profesionales lo hacen.
4. **Horarios:** Profesionales → Horario.
5. **Notificaciones:** "Enviarme una prueba" para comprobar el SMTP.
6. Comparte `https://tu-dominio/reservar` o copia el código del iframe desde Configuración.

### 6. Actualizaciones

Con GitHub conectado, cada push redespliega (instalación, migraciones y build). Si subes un ZIP, vuelve a subirlo y pulsa **Rebuild**.

### Si compilas en tu ordenador y subes el resultado

Prisma descarga el motor para el sistema donde se ejecuta `prisma generate`. Si compilas en Windows o macOS y lo subes a Linux, añade en `prisma/schema.prisma` → `generator client`:

```prisma
binaryTargets = ["native", "debian-openssl-3.0.x", "rhel-openssl-3.0.x"]
```

---

## Recordatorios (cron job)

El endpoint `GET /api/cron/reminders` envía los recordatorios pendientes (por defecto 24 h antes; se configura en el panel) y limpia datos temporales. Está protegido con `CRON_SECRET`.

hPanel → **Avanzado → Cron Jobs → Personalizado**, **cada 15 minutos** (`*/15 * * * *`):

```bash
curl -fsS -H "Authorization: Bearer TU_CRON_SECRET" https://tu-dominio.com/api/cron/reminders > /dev/null
```

Si el panel de cron solo admite una URL, el endpoint también acepta `https://tu-dominio.com/api/cron/reminders?key=TU_CRON_SECRET`.

- **Idempotente:** cada cita se "reclama" con un `UPDATE … WHERE reminderSentAt IS NULL`, así que dos ejecuciones simultáneas nunca envían dos recordatorios.
- Si alguien reserva dentro de la ventana del recordatorio (por ejemplo, 3 horas antes), no se envía un recordatorio aparte, porque acaba de recibir la confirmación.
- La respuesta JSON indica cuántas citas revisó y cuántos correos envió.

---

## Módulos y cómo probarlos

| Módulo | Dónde | Prueba rápida |
|---|---|---|
| **1. Configuración** | `/panel/configuracion` | Cambia el color principal y verás la página de reservas con ese color. Copia el iframe. |
| **2. Servicios** | `/panel/servicios` | Crea un servicio con preparación de 15 min y capacidad 1. |
| **3. Disponibilidad** | `/panel/empleados/<id>/horario`, `/panel/disponibilidad` | Añade un feriado y desaparecerá del calendario de reservas. |
| **4. Reserva pública** | `/reservar`, `/embed/reservar`, `/cita/<token>` | Reserva desde el móvil, abre el enlace del correo (en consola con `MAIL_DRY_RUN=true`) y reprograma. |
| **5. Panel** | `/panel`, `/panel/calendario`, `/panel/citas` | Arrastra una cita en el calendario; cambia su estado y mira el historial. |
| **6. CRM** | `/panel/clientes` | Ve a "Duplicados" y fusiona el duplicado del seed; importa un CSV. |
| **7. Notificaciones** | `/panel/notificaciones` | Edita el recordatorio y pulsa "Enviarme una prueba". |
| **8. Reportes** | `/panel/reportes` | Cambia a "Últimos 30 días" y exporta el CSV por servicio. |

### Roles

- **Administrador:** acceso total.
- **Profesional:** inicio, calendario, citas y su horario, siempre limitados a su propia agenda.
- **Cliente:** cuenta opcional (`/mi-cuenta`) con sus citas. Si se registra con el email que usó como invitado, sus citas anteriores se vinculan automáticamente.

---

## Pruebas

```bash
npm test                    # unitarias
RUN_DB_TESTS=1 npm test     # + integración contra MySQL (usa la base de DATABASE_URL; crea y borra sus propios datos)
```

- `src/server/availability/engine.test.ts` cubre el motor de disponibilidad: bloques múltiples, citas que cruzan bloques, buffers, excepciones, bloqueos, capacidad de grupos, **cambios de horario de verano** (marzo y noviembre), anticipación mínima, días máximos y "hoy" en la zona del negocio.
- `tests/booking.integration.test.ts` lanza 8 reservas simultáneas para la misma franja y comprueba que solo una tiene éxito; también que una clase de capacidad 3 admite exactamente 3.
- También hay pruebas de CSV, sanitización de plantillas, importación (fechas), reportes y utilidades de auth.

---

## Arquitectura

```
prisma/                 esquema, migraciones y seed
scripts/                setup-production.ts
src/app/
  (public)/reservar     asistente de reserva
  (public)/cita/[token] gestión de la cita sin sesión
  embed/reservar        versión para iframe
  (auth)/…              login, registro, recuperar y restablecer contraseña
  mi-cuenta/            área del cliente
  panel/…               panel de la empresa
  api/public/…          franjas y .ics (públicos, con rate limit)
  api/panel/…           eventos del calendario, franjas y búsqueda de clientes (personal)
  api/export/…          CSV
  api/cron/reminders    recordatorios
src/server/
  availability/engine.ts   motor de franjas (función pura)
  availability/load.ts     carga los datos de MySQL para el motor
  services/                reservas (transacciones), CRM, dashboard y recordatorios
  reports/                 agregación de reportes (pura) y su carga
  notifications/           SMTP, plantillas, envíos y canales SMS/WhatsApp (interfaz)
  actions/                 server actions validadas con Zod y control de rol
  auth/                    Auth.js y guards por rol
src/lib/                   validación Zod compartida, CSV, .ics, formato y tokens
```

**Fechas:** todo se guarda en UTC (`DateTime` de MySQL) y se muestra con Luxon en la zona horaria del negocio. Los horarios semanales y las excepciones se guardan como minutos y fechas locales, y el motor los convierte a instantes reales, así que el cambio de horario de verano se respeta.

**SMS/WhatsApp:** `src/server/notifications/channels.ts` define la interfaz `NotificationProvider`, plantillas cortas y el registro de envíos. Para activarlos solo hay que implementar un proveedor y añadirlo a `PROVIDERS`.

---

## Seguridad

- Contraseñas con bcrypt (12 rondas). Sesión JWT de Auth.js; el rol y el estado activo se vuelven a leer de la base de datos en cada petición, así que desactivar a un usuario tiene efecto inmediato.
- Control de acceso por rol en el middleware, en cada página, en cada server action y en cada ruta API. Un profesional solo puede actuar sobre su propia agenda.
- CSRF: las server actions de Next.js validan Origin/Host y Auth.js usa su token CSRF. Detrás de un proxy que cambie el Host, usa `SERVER_ACTIONS_ALLOWED_ORIGINS`.
- Rate limiting en MySQL (sin Redis) para login (por IP y por email), registro, recuperación de contraseña, reservas (por IP y por email), gestión por enlace y consulta de franjas.
- Anti-spam en la reserva: honeypot y tiempo mínimo de llenado.
- Reservas dobles imposibles: transacción con `SELECT … FOR UPDATE` sobre el profesional y nueva verificación con el motor antes de insertar (cubierto por prueba de integración).
- Los tokens de recuperación y de gestión de citas solo se guardan como hash SHA-256. El de gestión se deriva con HMAC, así cada correo lleva un enlace válido.
- HTML de plantillas saneado con lista blanca; la vista previa se muestra en un iframe sin scripts.
- Subida de logos limitada a PNG, JPG o WebP de máximo 1 MB, con verificación de la firma del archivo y servida con `nosniff`.
- CSV exportados protegidos contra inyección de fórmulas.
- Cabeceras: `X-Frame-Options: SAMEORIGIN` en todo excepto `/embed/*`, `nosniff`, `Referrer-Policy` y `Permissions-Policy`.

### Dependencias y auditoría

- `nodemailer` 10 y `zod` 4 están en versiones con los avisos de seguridad corregidos. `package.json` incluye `overrides` para que `next-auth` use ese nodemailer y para que Next.js use un `postcss` corregido.
- `npm audit --omit=dev` aún marca dependencias internas del **CLI de Prisma 6** (`effect`, `deepmerge-ts`). Solo se usan al ejecutar comandos de Prisma (generate y migrate), no en la aplicación en marcha. Se corrigen al migrar a Prisma 7, que es una versión mayor con cambios de configuración.
