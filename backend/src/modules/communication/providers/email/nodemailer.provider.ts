import nodemailer from 'nodemailer';
import type { CommunicationProvider, Attachment } from '../provider.interface.js';
import type { ProviderResponse, DeliveryStatus } from '../../communication.types.js';

export class NodemailerProvider implements CommunicationProvider {
  private transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT ?? '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });

  async send(recipient: string, subject: string, body: string, attachments?: Attachment[]): Promise<ProviderResponse> {
    try {
      const result = await this.transporter.sendMail({
        from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
        to: recipient, subject, html: body,
        attachments: attachments?.map(a => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
      });
      return { success: true, message_id: result.messageId };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }

  async getDeliveryStatus(_messageId: string): Promise<DeliveryStatus> {
    // Nodemailer has no delivery tracking API; status is assumed sent
    return { status: 'sent' };
  }

  validateRecipient(contact: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact);
  }

  getName(): string { return 'nodemailer'; }
}
