import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;
  const port = Number(process.env.SMTP_PORT ?? 465);
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: (process.env.SMTP_SECURE ?? (port === 465 ? "true" : "false")) === "true",
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } : undefined,
    pool: true,
    maxConnections: 2,
  });
  return transporter;
}

export type MailInput = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: string; contentType: string }>;
};

export function defaultFrom(): string {
  return process.env.MAIL_FROM || "info@livingriverllc.com";
}

/** Envía un correo. Con MAIL_DRY_RUN=true solo lo registra en consola. */
export async function sendMail(input: MailInput): Promise<void> {
  if (process.env.MAIL_DRY_RUN === "true") {
    console.info(`[mail:dry-run] Para: ${input.to} | Asunto: ${input.subject}${input.attachments?.length ? ` | Adjuntos: ${input.attachments.map((a) => a.filename).join(", ")}` : ""}\n${input.text}\n`);
    return;
  }
  await getTransporter().sendMail({ from: defaultFrom(), ...input });
}
