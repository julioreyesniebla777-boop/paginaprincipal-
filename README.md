# Agenda de citas

Aplicación web de gestión de clientes y citas: los clientes reservan desde una página pública y la empresa administra disponibilidad, servicios y clientes desde un panel privado.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Prisma 6 + MySQL/MariaDB · Auth.js v5 · Nodemailer · Zod · Luxon · Vitest.

## Requisitos

- Node.js 20 o 22
- MySQL 8 o MariaDB 10.6+

## Instalación local

```bash
npm install
cp .env.example .env          # edita DATABASE_URL, AUTH_SECRET, CRON_SECRET y SMTP
npx prisma migrate dev        # crea las tablas
npm run db:seed               # datos de ejemplo
npm run dev                   # http://localhost:3000
```

Con `MAIL_DRY_RUN=true` los correos se imprimen en la consola en lugar de enviarse.

### Accesos de prueba (seed)

| Rol | Email | Contraseña |
|---|---|---|
| Administrador | admin@demo.com | Admin12345 |
| Profesional | ana@demo.com · carlos@demo.com · sofia@demo.com | Empleado123 |
| Cliente | cliente@demo.com | Cliente123 |

## Scripts

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | `prisma generate` + build de producción |
| `npm start` | Arranca el build de producción |
| `npm test` | Pruebas unitarias (Vitest) |
| `RUN_DB_TESTS=1 npm test` | Además, pruebas de integración contra MySQL (reservas concurrentes) |
| `npm run lint` / `npm run typecheck` | ESLint / TypeScript |
| `npm run db:deploy` | Aplica migraciones en producción |
| `npm run db:seed` | Carga los datos de ejemplo (**borra los datos existentes**) |

## Roles

- **Administrador:** acceso total y configuración del negocio.
- **Profesional:** solo su agenda y sus citas.
- **Cliente:** cuenta opcional para ver, reprogramar y cancelar sus citas. Al registrarse con el mismo email que usó como invitado, sus citas anteriores se vinculan automáticamente.

## Reserva pública

- `/reservar`: asistente de 6 pasos (servicio, profesional o "cualquiera disponible", fecha, hora, datos y confirmación).
- `/embed/reservar`: la misma página sin cabecera, para incrustarla con un iframe (el código está en Panel → Configuración).
- `/cita/<token>`: el cliente ve, cancela o reprograma su cita sin iniciar sesión, siempre dentro del plazo configurado. El token se deriva con HMAC de `AUTH_SECRET`, así que **cambiar `AUTH_SECRET` invalida los enlaces ya enviados**.
- Protección anti-spam: honeypot, tiempo mínimo de llenado y límite de peticiones por IP y por email.
- Reservas dobles: la reserva se confirma dentro de una transacción que bloquea la fila del profesional (`SELECT … FOR UPDATE`) y vuelve a calcular la disponibilidad con el mismo motor antes de insertar.

## Seguridad

- Contraseñas con bcrypt (12 rondas). Sesión JWT de Auth.js, con el rol y el estado activo comprobados en la base de datos en cada petición.
- CSRF: las server actions de Next.js validan Origin/Host y Auth.js usa su propio token CSRF.
- Límite de peticiones guardado en MySQL (tabla `RateLimit`, sin Redis) para login, registro, recuperación de contraseña y reservas.
- Los tokens de recuperación y de gestión de citas solo se guardan como hash SHA-256.
- Control de acceso por rol en el middleware, en cada página y en cada server action.

## Despliegue en Hostinger

_Se completa en las siguientes fases._
