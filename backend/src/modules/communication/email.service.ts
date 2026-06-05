import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";
import { env } from "../../config/env.js";

export type EmailSendInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function smtpSecure(): boolean {
  const explicit = String(process.env.SMTP_SECURE || "").trim().toLowerCase();
  if (["true", "1", "yes"].includes(explicit)) return true;
  if (["false", "0", "no"].includes(explicit)) return false;
  return Number(env.SMTP_PORT) === 465;
}

function fromAddress(): string {
  const name = String(process.env.SMTP_FROM_NAME || "MAS Callnet HRMS").trim();
  const from = String(env.SMTP_FROM || env.SMTP_USER || "noreply@mascallnet.com").trim();
  return name ? `"${name.replace(/"/g, "")}\" <${from}>`.replace('\\"', '"') : from;
}

function createTransporter() {
  const options: SMTPTransport.Options = {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: smtpSecure(),
  };

  if (env.SMTP_USER && env.SMTP_PASS) {
    options.auth = {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    };
  }

  return nodemailer.createTransport(options);
}

export const emailService = {
  isConfigured(): boolean {
    return Boolean(env.SMTP_HOST && env.SMTP_PORT && env.SMTP_FROM && env.SMTP_USER && env.SMTP_PASS);
  },

  safeConfig() {
    return {
      configured: this.isConfigured(),
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: smtpSecure(),
      userConfigured: Boolean(env.SMTP_USER),
      passConfigured: Boolean(env.SMTP_PASS),
      from: env.SMTP_FROM,
      fromName: process.env.SMTP_FROM_NAME || "MAS Callnet HRMS",
    };
  },

  async send(input: EmailSendInput): Promise<{ messageId?: string }> {
    if (!this.isConfigured()) {
      throw new Error("SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM.");
    }

    const transporter = createTransporter();
    const result = await transporter.sendMail({
      from: fromAddress(),
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text,
    });

    return { messageId: result.messageId };
  },
};
