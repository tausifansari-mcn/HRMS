// backend/src/modules/communication/communication.types.ts

// ========== Database Table Interfaces ==========

export interface CommunicationTemplate {
  id: string;
  name: string;
  subject: string | null;
  body_html: string;
  body_text: string | null;
  category: TemplateCategory;
  channel: Channel;
  variables_schema: VariablesSchema | null;
  is_active: number;
  is_critical: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationPreferences {
  id: string;
  employee_id: string;
  category: NotificationCategory;
  preferred_channel: Channel;
  enabled: number;
  updated_at: string;
}

export interface DispatchLog {
  id: string;
  template_id: string | null;
  template_name: string;
  recipient_employee_id: string | null;
  recipient_contact: string;
  channel: Channel;
  status: DispatchStatus;
  subject: string | null;
  body_preview: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  error_message: string | null;
  is_critical: number;
  retention_category: RetentionCategory;
  retry_count: number;
  created_at: string;
}

// ========== Enums ==========

export type TemplateCategory =
  | 'onboarding'
  | 'payroll'
  | 'attendance'
  | 'leave'
  | 'performance'
  | 'alerts'
  | 'announcements'
  | 'custom';

export type NotificationCategory = Exclude<TemplateCategory, 'custom'>;

export type Channel = 'email' | 'sms' | 'whatsapp';

export type MultiChannel = Channel | 'multi';

export type DispatchStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'failed';

export type RetentionCategory = 'critical' | 'standard' | 'routine';

// ========== JSON Field Types ==========

export interface VariablesSchema {
  [category: string]: {
    [entity: string]: string[];
  };
}

// ========== DTO Types ==========

export interface CreateTemplateDTO {
  name: string;
  subject?: string;
  body_html: string;
  body_text?: string;
  category: TemplateCategory;
  channel: MultiChannel;
  variables_schema?: VariablesSchema;
  is_critical?: boolean;
  created_by: string;
}

export interface UpdateTemplateDTO {
  name?: string;
  subject?: string;
  body_html?: string;
  body_text?: string;
  is_active?: boolean;
}

export interface TemplateFilters {
  category?: TemplateCategory;
  channel?: MultiChannel;
  is_active?: boolean;
  search?: string;
}

export interface SendMessageDTO {
  template_id?: string;
  template_name?: string;
  recipient_employee_ids: string[];
  data: Record<string, any>;
  channel?: Channel;
  is_critical?: boolean;
}

export interface BulkSendDTO {
  template_id?: string;
  template_name?: string;
  recipient_filter: RecipientFilter;
  data: Record<string, any>;
  channel?: Channel;
}

export interface RecipientFilter {
  department?: string;
  process_id?: string;
  designation?: string;
  status?: string;
}

export interface ScheduleSendDTO extends SendMessageDTO {
  scheduled_at: string;
}

export interface DispatchLogFilters {
  employee_id?: string;
  channel?: Channel;
  status?: DispatchStatus;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

export interface UpdatePreferencesDTO {
  category: NotificationCategory;
  preferred_channel: Channel;
  enabled: boolean;
}

export interface RenderTemplateDTO {
  template_id?: string;
  template_name?: string;
  data: Record<string, any>;
}

export interface ProviderResponse {
  success: boolean;
  message_id?: string;
  error?: string;
}

export interface DeliveryStatus {
  status: DispatchStatus;
  delivered_at?: string;
  error?: string;
}

// ========== Response Types ==========

export interface DispatchResult {
  queued: number;
  failed: number;
  dispatch_ids: string[];
}

export interface DispatchStats {
  total_sent_today: number;
  delivery_rate: number;
  open_rate: number;
  failed_count: number;
  by_channel: {
    email: number;
    sms: number;
    whatsapp: number;
  };
}

export interface PaginatedDispatchLogs {
  logs: DispatchLog[];
  total: number;
  page: number;
  limit: number;
}
