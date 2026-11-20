import type { TemplateType } from "@prisma/client";

export const TEMPLATE_LABELS: Record<TemplateType, string> = {
  BOOKING_CONFIRMATION: "Confirmación de cita",
  BOOKING_PENDING: "Cita pendiente de aprobación",
  REMINDER: "Recordatorio",
  RESCHEDULED: "Cita reprogramada",
  CANCELLED: "Cita cancelada",
  BUSINESS_NEW_BOOKING: "Aviso al negocio: nueva reserva",
  PASSWORD_RESET: "Recuperación de contraseña",
};

const manageBlock = `<p>Si necesitas cancelar o reprogramar, usa este enlace:<br><a href="{enlace_gestion}">Gestionar mi cita</a></p>`;

const details = `<table cellpadding="4" style="border-collapse:collapse">
<tr><td><strong>Servicio:</strong></td><td>{servicio}</td></tr>
<tr><td><strong>Fecha:</strong></td><td>{fecha}</td></tr>
<tr><td><strong>Hora:</strong></td><td>{hora}</td></tr>
<tr><td><strong>Profesional:</strong></td><td>{profesional}</td></tr>
</table>`;

export const DEFAULT_TEMPLATES: Record<TemplateType, { subject: string; bodyHtml: string }> = {
  BOOKING_CONFIRMATION: {
    subject: "Tu cita está confirmada – {servicio} el {fecha}",
    bodyHtml: `<p>Hola {cliente},</p><p>Tu cita en <strong>{negocio}</strong> está confirmada.</p>${details}<p>Dirección: {direccion}</p>${manageBlock}<p>¡Te esperamos!</p>`,
  },
  BOOKING_PENDING: {
    subject: "Recibimos tu solicitud de cita – {servicio}",
    bodyHtml: `<p>Hola {cliente},</p><p>Recibimos tu solicitud en <strong>{negocio}</strong>. Te avisaremos cuando sea confirmada.</p>${details}${manageBlock}`,
  },
  REMINDER: {
    subject: "Recordatorio: tu cita de {servicio} es el {fecha} a las {hora}",
    bodyHtml: `<p>Hola {cliente},</p><p>Te recordamos tu próxima cita en <strong>{negocio}</strong>.</p>${details}<p>Dirección: {direccion}</p>${manageBlock}`,
  },
  RESCHEDULED: {
    subject: "Tu cita fue reprogramada – {fecha} a las {hora}",
    bodyHtml: `<p>Hola {cliente},</p><p>Tu cita en <strong>{negocio}</strong> fue reprogramada. Estos son los nuevos datos:</p>${details}${manageBlock}`,
  },
  CANCELLED: {
    subject: "Tu cita de {servicio} fue cancelada",
    bodyHtml: `<p>Hola {cliente},</p><p>Tu cita del <strong>{fecha}</strong> a las <strong>{hora}</strong> ({servicio}) fue cancelada.</p><p>Puedes reservar una nueva cuando quieras en <a href="{enlace}">{enlace}</a>.</p>`,
  },
  BUSINESS_NEW_BOOKING: {
    subject: "Nueva reserva: {cliente} – {servicio} el {fecha} {hora}",
    bodyHtml: `<p>Se registró una nueva reserva (estado: {estado}).</p><table cellpadding="4"><tr><td><strong>Cliente:</strong></td><td>{cliente}</td></tr><tr><td><strong>Servicio:</strong></td><td>{servicio}</td></tr><tr><td><strong>Fecha:</strong></td><td>{fecha} {hora}</td></tr><tr><td><strong>Profesional:</strong></td><td>{profesional}</td></tr><tr><td><strong>Notas:</strong></td><td>{notas}</td></tr></table><p><a href="{enlace}">Ver en el panel</a></p>`,
  },
  PASSWORD_RESET: {
    subject: "Restablece tu contraseña – {negocio}",
    bodyHtml: `<p>Hola {cliente},</p><p>Recibimos una solicitud para restablecer tu contraseña. El enlace es válido durante 1 hora:</p><p><a href="{enlace}">Restablecer contraseña</a></p><p>Si no lo solicitaste, ignora este correo.</p>`,
  },
};
