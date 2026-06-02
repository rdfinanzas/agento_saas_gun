import axios from 'axios';

export interface SendMessageOptions {
  phoneNumberId: string;
  to: string;
  message: string;
  accessToken: string;
}

export interface SendTemplateOptions {
  phoneNumberId: string;
  to: string;
  templateName: string;
  components: any[];
  accessToken: string;
  languageCode?: string;
}

export class WhatsAppCloudApiService {
  private apiVersion = 'v21.0';
  private baseUrl = 'https://graph.facebook.com';
  private axiosInstance: ReturnType<typeof axios.create>;

  constructor() {
    this.axiosInstance = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
    });
  }

  /**
   * Send a text message through WhatsApp Cloud API
   */
  async sendTextMessage(options: SendMessageOptions): Promise<any> {
    const { phoneNumberId, to, message, accessToken } = options;

    try {
      const response = await this.axiosInstance.post(
        `/${this.apiVersion}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: this.formatPhone(to),
          type: 'text',
          text: { body: message }
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      // Check if it's an axios error
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { error?: { message?: string } } }; message?: string };
        throw new Error(`WhatsApp API error: ${axiosError.response?.data?.error?.message || axiosError.message || 'Unknown error'}`);
      }
      throw error;
    }
  }

  /**
   * Send a template message through WhatsApp Cloud API
   */
  async sendTemplateMessage(options: SendTemplateOptions): Promise<any> {
    const { phoneNumberId, to, templateName, components, accessToken, languageCode = 'es' } = options;

    try {
      const response = await this.axiosInstance.post(
        `/${this.apiVersion}/${phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: this.formatPhone(to),
          type: 'template',
          template: {
            name: templateName,
            language: { code: languageCode },
            components
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error) {
      // Check if it's an axios error
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { data?: { error?: { message?: string } } }; message?: string };
        throw new Error(`WhatsApp API error: ${axiosError.response?.data?.error?.message || axiosError.message || 'Unknown error'}`);
      }
      throw error;
    }
  }

  /**
   * Format phone number to WhatsApp format
   */
  private formatPhone(phone: string): string {
    // Remove non-numeric characters
    phone = phone.replace(/\D/g, '');

    // Add country code if necessary (default: Argentina +54)
    if (phone.length === 10) {
      phone = '54' + phone;
    }

    return phone;
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string, appSecret: string): boolean {
    const hmac = require('crypto')
      .createHmac('sha256', appSecret)
      .update(payload)
      .digest('base64');

    return hmac === signature;
  }
}
