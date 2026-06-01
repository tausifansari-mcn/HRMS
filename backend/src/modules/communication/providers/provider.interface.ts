// backend/src/modules/communication/providers/provider.interface.ts
import { ProviderResponse, DeliveryStatus } from '../communication.types';

export interface CommunicationProvider {
  /**
   * Send message to recipient
   */
  send(
    recipient: string,
    subject: string,
    body: string,
    attachments?: Attachment[]
  ): Promise<ProviderResponse>;

  /**
   * Get delivery status for sent message
   */
  getDeliveryStatus(messageId: string): Promise<DeliveryStatus>;

  /**
   * Validate recipient contact (email/phone format)
   */
  validateRecipient(contact: string): boolean;

  /**
   * Provider name for logging
   */
  getName(): string;
}

export interface Attachment {
  filename: string;
  content: Buffer | string;
  contentType: string;
}
