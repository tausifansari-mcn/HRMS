// backend/src/modules/communication/providers/sms/local-sms.provider.ts
import axios from 'axios';
import { CommunicationProvider, Attachment } from '../provider.interface';
import { ProviderResponse, DeliveryStatus } from '../../communication.types';

export class LocalSMSProvider implements CommunicationProvider {
  private apiEndpoint: string;
  private apiKey: string;
  private senderId: string;

  constructor() {
    this.apiEndpoint = process.env.LOCAL_SMS_API_URL || '';
    this.apiKey = process.env.LOCAL_SMS_API_KEY || '';
    this.senderId = process.env.LOCAL_SMS_SENDER_ID || '';

    if (!this.apiEndpoint || !this.apiKey) {
      throw new Error('LOCAL_SMS_API_URL and LOCAL_SMS_API_KEY required');
    }
  }

  async send(
    recipient: string,
    subject: string,
    body: string,
    attachments?: Attachment[]
  ): Promise<ProviderResponse> {
    try {
      // Truncate to 160 chars
      const truncatedBody = body.length > 160 ? body.substring(0, 157) + '...' : body;

      const response = await axios.post(
        `${this.apiEndpoint}/send`,
        {
          to: recipient,
          message: truncatedBody,
          sender_id: this.senderId
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        success: true,
        message_id: response.data.message_id
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
      const response = await axios.get(
        `${this.apiEndpoint}/status/${messageId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return {
        status: response.data.status,
        delivered_at: response.data.delivered_at,
        error: response.data.error
      };
    } catch (error) {
      return {
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  validateRecipient(contact: string): boolean {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(contact);
  }

  getName(): string {
    return 'local-sms-tool';
  }
}
