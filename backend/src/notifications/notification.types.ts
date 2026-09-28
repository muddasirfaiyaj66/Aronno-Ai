export const NOTIFICATION_KINDS = ['heat', 'weather', 'scan', 'order', 'admin'] as const;

export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const NOTIFICATION_PRIORITIES = ['normal', 'important', 'emergency'] as const;

export type NotificationPriority = (typeof NOTIFICATION_PRIORITIES)[number];

export type NotificationDto = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  pathname?: string;
  params?: Record<string, string>;
  priority: NotificationPriority;
  popup: boolean;
  dismissed: boolean;
};

export type NotificationDraft = {
  userId: string;
  dedupeKey: string;
  kind: NotificationKind;
  title: string;
  body: string;
  pathname?: string;
  params?: Record<string, string>;
  priority?: NotificationPriority;
  popup?: boolean;
  email?:
    | boolean
    | {
        details?: { label: string; value: string }[];
        note?: string;
      };
};
