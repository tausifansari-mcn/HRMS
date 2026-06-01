// backend/src/modules/communication/providers/provider.factory.ts
import { CommunicationProvider } from './provider.interface';
import { Channel } from '../communication.types';

type ProviderType = 'nodemailer' | 'local-email-tool' | 'twilio' | 'local-sms-tool' | 'local-whatsapp-tool';

interface ProviderConfig {
  email: ProviderType;
  sms: ProviderType;
  whatsapp: ProviderType;
}

class ProviderFactory {
  private config: ProviderConfig;
  private providers: Map<string, CommunicationProvider> = new Map();

  constructor() {
    this.config = {
      email: (process.env.EMAIL_PROVIDER as ProviderType) || 'nodemailer',
      sms: (process.env.SMS_PROVIDER as ProviderType) || 'twilio',
      whatsapp: (process.env.WHATSAPP_PROVIDER as ProviderType) || 'twilio'
    };
  }

  /**
   * Get provider for channel
   */
  getProvider(channel: Channel): CommunicationProvider {
    const cacheKey = `${channel}-${this.config[channel]}`;

    if (this.providers.has(cacheKey)) {
      return this.providers.get(cacheKey)!;
    }

    const provider = this.createProvider(channel);
    this.providers.set(cacheKey, provider);
    return provider;
  }

  private createProvider(channel: Channel): CommunicationProvider {
    const providerType = this.config[channel];

    switch (channel) {
      case 'email':
        return this.createEmailProvider(providerType);
      case 'sms':
        return this.createSMSProvider(providerType);
      case 'whatsapp':
        return this.createWhatsAppProvider(providerType);
      default:
        throw new Error(`Unsupported channel: ${channel}`);
    }
  }

  private createEmailProvider(type: ProviderType): CommunicationProvider {
    // Lazy imports to avoid loading unused providers
    if (type === 'nodemailer') {
      const { NodemailerProvider } = require('./email/nodemailer.provider');
      return new NodemailerProvider();
    } else if (type === 'local-email-tool') {
      const { LocalEmailProvider } = require('./email/local-email.provider');
      return new LocalEmailProvider();
    }
    throw new Error(`Unsupported email provider: ${type}`);
  }

  private createSMSProvider(type: ProviderType): CommunicationProvider {
    if (type === 'twilio') {
      const { TwilioSMSProvider } = require('./sms/twilio-sms.provider');
      return new TwilioSMSProvider();
    } else if (type === 'local-sms-tool') {
      const { LocalSMSProvider } = require('./sms/local-sms.provider');
      return new LocalSMSProvider();
    }
    throw new Error(`Unsupported SMS provider: ${type}`);
  }

  private createWhatsAppProvider(type: ProviderType): CommunicationProvider {
    if (type === 'twilio') {
      const { TwilioWhatsAppProvider } = require('./whatsapp/twilio-whatsapp.provider');
      return new TwilioWhatsAppProvider();
    } else if (type === 'local-whatsapp-tool') {
      const { LocalWhatsAppProvider } = require('./whatsapp/local-whatsapp.provider');
      return new LocalWhatsAppProvider();
    }
    throw new Error(`Unsupported WhatsApp provider: ${type}`);
  }

  /**
   * Clear provider cache (for testing)
   */
  clearCache(): void {
    this.providers.clear();
  }
}

export const providerFactory = new ProviderFactory();
