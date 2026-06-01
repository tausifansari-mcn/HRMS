// backend/src/modules/communication/providers/sms/twilio-sms.provider.ts
import twilio from 'twilio';
import { CommunicationProvider, Attachment } from '../provider.interface';
import { ProviderResponse, DeliveryStatus } from '../../communication.types';

export class TwilioSMSProvider implements CommunicationProvider {
  private client: twilio.Twilio;
  private messagingServiceSid: string;

  constructor() {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    this.messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID || '';

    if (!accountSid || !authToken) {
      throw new Error('TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN required');
    }

    this.client = twilio(accountSid, authToken);
  }

  async send(
    recipient: string,
    subject: string,
    body: string,
    attachments?: Attachment[]
  ): Promise<ProviderResponse> {
    try {
      // SMS is text-only, truncate to 160 chars
      const truncatedBody = body.length > 160 ? body.substring(0, 157) + '...' : body;

      const message = await this.client.messages.create({
        messagingServiceSid: this.messagingServiceSid,
        to: recipient,
        body: truncatedBody
      });

      return {
        success: true,
        message_id: message.sid
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async getDeliveryStatus(messageId: string): Promise<DeliveryStatus> {
    try {
      const message = await this.client.messages(messageId).fetch();

      const statusMap: Record<string, any> = {
        'queued': 'queued',
        'sent': 'sent',
        'delivered': 'delivered',
        'failed': 'failed',
        'undelivered': 'failed'
      };

      return {
        status: statusMap[message.status] || 'failed',
        delivered_at: message.dateUpdated?.toISOString(),
        error: message.errorMessage || undefined
      };
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  validateRecipient(contact: string): boolean {
    // Basic phone regex (international format)
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(contact);
  }

  getName(): string {
    return 'twilio-sms';
  }
}
