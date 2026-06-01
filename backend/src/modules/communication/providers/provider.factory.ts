import type { CommunicationProvider } from './provider.interface.js';
import type { Channel } from '../communication.types.js';
import { NodemailerProvider } from './email/nodemailer.provider.js';
import { LocalEmailProvider } from './email/local-email.provider.js';
import { TwilioSMSProvider } from './sms/twilio-sms.provider.js';
import { LocalSMSProvider } from './sms/local-sms.provider.js';
import { TwilioWhatsAppProvider } from './whatsapp/twilio-whatsapp.provider.js';
import { LocalWhatsAppProvider } from './whatsapp/local-whatsapp.provider.js';

type EmailType = 'nodemailer' | 'local-email-tool';
type SMSType = 'twilio' | 'local-sms-tool';
type WAType = 'twilio' | 'local-whatsapp-tool';

class ProviderFactory {
  private cache = new Map<Channel, CommunicationProvider>();

  getProvider(channel: Channel): CommunicationProvider {
    if (!this.cache.has(channel)) {
      this.cache.set(channel, this.build(channel));
    }
    return this.cache.get(channel)!;
  }

  private build(channel: Channel): CommunicationProvider {
    if (channel === 'email') {
      const type = (process.env.EMAIL_PROVIDER ?? 'nodemailer') as EmailType;
      if (type === 'nodemailer')       return new NodemailerProvider();
      if (type === 'local-email-tool') return new LocalEmailProvider();
      throw new Error(`Unknown email provider: ${type}`);
    }
    if (channel === 'sms') {
      const type = (process.env.SMS_PROVIDER ?? 'twilio') as SMSType;
      if (type === 'twilio')          return new TwilioSMSProvider();
      if (type === 'local-sms-tool')  return new LocalSMSProvider();
      throw new Error(`Unknown SMS provider: ${type}`);
    }
    if (channel === 'whatsapp') {
      const type = (process.env.WHATSAPP_PROVIDER ?? 'twilio') as WAType;
      if (type === 'twilio')              return new TwilioWhatsAppProvider();
      if (type === 'local-whatsapp-tool') return new LocalWhatsAppProvider();
      throw new Error(`Unknown WhatsApp provider: ${type}`);
    }
    throw new Error(`Unknown channel: ${channel}`);
  }

  clearCache(): void { this.cache.clear(); }
}

export const providerFactory = new ProviderFactory();
