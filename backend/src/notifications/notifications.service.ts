import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { HeatmapService } from '../market/heatmap.service';
import { WEATHER } from '../ai/ai.tokens';
import type { WeatherPort } from '../weather/weather.types';
import { nearestDistrict } from '../lookups/bangladesh-districts';
import type { GeoPoint } from '../weather/coords';
import { Errors } from '../common/errors';
import { NotificationHub } from './notification-hub';
import type {
  NotificationDraft,
  NotificationDto,
  NotificationKind,
  NotificationPriority,
} from './notification.types';
import { insideHeatZone, toBn } from './geo';

const ORDER_LABEL: Record<string, string> = {
  pending: 'অর্ডার করা হয়েছে',
  confirmed: 'নিশ্চিত করা হয়েছে',
  processing: 'প্রস্তুত করা হচ্ছে',
  shipped: 'পাঠানো হয়েছে',
  delivered: 'ডেলিভারি সম্পন্ন',
  cancelled: 'বাতিল করা হয়েছে',
};

const HEAT_TTL_MS = 60_000;

type Stored = {
  id: string;
  kind: string;
  title: string;
  body: string;
  pathname: string | null;
  params: Prisma.JsonValue;
  priority: string | null;
  popup: boolean | null;
  readAt: Date | null;
  dismissedAt: Date | null;
  createdAt: Date;
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private heatCache: { at: number; areas: Awaited<ReturnType<HeatmapService['aggregate']>>['areas'] } | null =
    null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly hub: NotificationHub,
    private readonly heatmap: HeatmapService,
    @Inject(WEATHER) private readonly weather: WeatherPort,
  ) {}

  async list(userId: string): Promise<NotificationDto[]> {
    const rows = await this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return rows.map((row) => this.toDto(row));
  }

  async markRead(userId: string, id: string) {
    if (!/^[a-f0-9]{24}$/i.test(id)) throw Errors.notFound();
    const row = await this.prisma.notification.findUnique({ where: { id } });
    if (!row || row.userId !== userId) throw Errors.notFound();
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { readAt: row.readAt ?? new Date() },
    });
    return this.toDto(updated);
  }

  async dismiss(userId: string, id: string) {
    if (!/^[a-f0-9]{24}$/i.test(id)) throw Errors.notFound();
    const row = await this.prisma.notification.findUnique({ where: { id } });
    if (!row || row.userId !== userId) throw Errors.notFound();
    const updated = await this.prisma.notification.update({
      where: { id },
      data: { dismissedAt: row.dismissedAt ?? new Date() },
    });
    return this.toDto(updated);
  }

  async markAllRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true as const };
  }

  /**
   * Heat and weather depend on where the phone is. Orders and scans are
   * emitted by those services as they happen.
   */
  async syncLocation(userId: string, lat: number, lon: number) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      throw Errors.validation({ lat: 'invalid', lon: 'invalid' });
    }
    await Promise.all([
      this.syncHeat(userId, lat, lon),
      this.syncWeather(userId, lat, lon),
    ]);
    return { ok: true as const };
  }

  async broadcast(input: {
    actorId: string;
    title: string;
    body: string;
    priority: NotificationPriority;
    audience: 'all' | 'user' | 'district';
    userId?: string;
    districtSlug?: string;
  }) {
    const title = input.title.trim();
    const body = input.body.trim();
    if (title.length < 2 || body.length < 2) {
      throw Errors.validation({ title: 'short', body: 'short' });
    }
    const district =
      input.audience === 'district' ? await this.districtRecipients(input.districtSlug) : null;
    const recipients =
      input.audience === 'user'
        ? await this.oneRecipient(input.userId)
        : district
          ? district.users
          : await this.prisma.user.findMany({
              where: { isActive: true },
              select: { id: true },
            });
    if (recipients.length === 0) {
      throw Errors.notFound(
        input.audience === 'district'
          ? 'এই জেলায় কোনো সক্রিয় ব্যবহারকারী নেই।'
          : 'তথ্য পাওয়া যায়নি।',
      );
    }

    const broadcast = await this.prisma.adminBroadcast.create({
      data: {
        title,
        body,
        priority: input.priority,
        audience: input.audience,
        targetUserId: input.audience === 'user' ? recipients[0]?.id : undefined,
        districtSlug: district?.slug,
        createdById: input.actorId,
        recipientCount: recipients.length,
      },
    });
    const dedupeKey = `admin:${broadcast.id}`;
    const chunk = 200;
    for (let i = 0; i < recipients.length; i += chunk) {
      const slice = recipients.slice(i, i + chunk);
      await this.prisma.notification.createMany({
        data: slice.map((user) => ({
          userId: user.id,
          dedupeKey,
          kind: 'admin',
          title,
          body,
          priority: input.priority,
          popup: true,
          pathname: district ? '/(root)/(tabs)/market' : undefined,
          params: district ? { tab: 'heatmap' } : undefined,
        })),
      });
    }
    const rows = await this.prisma.notification.findMany({ where: { dedupeKey } });
    for (const row of rows) {
      this.hub.push(row.userId, this.toDto(row));
    }
    return {
      id: broadcast.id,
      title,
      body,
      priority: input.priority,
      audience: input.audience,
      recipientCount: recipients.length,
      districtSlug: district?.slug ?? null,
      createdAt: broadcast.createdAt.toISOString(),
    };
  }

  /** Heat-map districts with a ready-to-send Bangla warning. */
  async placeSuggestions() {
    const heat = await this.heatmap.aggregate();
    return heat.areas.slice(0, 24).map((area) => {
      const lines = area.diseases
        .slice(0, 3)
        .map((row) => `• ${row.diseaseType.nameBn} — ${toBn(row.caseCount)}টি রিপোর্ট`);
      const priority: NotificationPriority =
        area.level === 'high' ? 'emergency' : area.level === 'medium' ? 'important' : 'normal';
      return {
        slug: area.location.slug,
        nameBn: area.location.nameBn,
        level: area.level,
        caseCount: area.caseCount,
        priority,
        title: `${area.location.nameBn}: ফসলের সতর্কতা`,
        body: [
          `${area.location.nameBn} জেলায় গত ${toBn(heat.windowDays)} দিনে ${toBn(area.caseCount)}টি রোগের রিপোর্ট এসেছে।`,
          lines.length ? `এই মুহূর্তে বেশি দেখা যাচ্ছে:\n${lines.join('\n')}` : '',
          'আক্রান্ত পাতা তুলে ফেলুন, সুস্থ গাছ থেকে আলাদা রাখুন, এবং স্প্রে করার আগে অ্যাপে স্ক্যান করে নিন।',
        ]
          .filter(Boolean)
          .join('\n\n'),
      };
    });
  }

  async listBroadcasts() {
    const rows = await this.prisma.adminBroadcast.findMany({
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      body: row.body,
      priority: row.priority,
      audience: row.audience,
      targetUserId: row.targetUserId,
      districtSlug: row.districtSlug,
      recipientCount: row.recipientCount,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  private async districtRecipients(slug?: string) {
    const key = slug?.trim().toLowerCase();
    if (!key) throw Errors.validation({ districtSlug: 'required' });
    const district = await this.prisma.district.findUnique({ where: { slug: key } });
    if (!district) throw Errors.notFound('জেলা পাওয়া যায়নি।');
    const users = await this.prisma.user.findMany({
      where: { isActive: true, districtId: district.id },
      select: { id: true },
    });
    return { slug: district.slug, users };
  }

  private async oneRecipient(userId?: string) {
    if (!userId || !/^[a-f0-9]{24}$/i.test(userId)) throw Errors.validation({ userId: 'required' });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, isActive: true },
    });
    if (!user?.isActive) throw Errors.notFound();
    return [user];
  }

  async notifyScan(
    userId: string,
    diagnosis: { id: string; diseaseNameBn: string; cropId?: string | null },
  ) {
    let cropName = 'ফসল';
    if (diagnosis.cropId) {
      const crop = await this.prisma.crop.findUnique({
        where: { id: diagnosis.cropId },
        select: { nameBn: true },
      });
      if (crop?.nameBn) cropName = crop.nameBn;
    }
    await this.emit({
      userId,
      dedupeKey: `scan:${diagnosis.id}`,
      kind: 'scan',
      title: `${cropName} স্ক্যান`,
      body: diagnosis.diseaseNameBn,
      pathname: '/(root)/(tabs)/history',
    });
  }

  async notifyOrder(input: {
    buyerUserId: string;
    sellerUserId: string;
    orderId: string;
    status: string;
  }) {
    const label = ORDER_LABEL[input.status] ?? input.status;
    await this.emit({
      userId: input.buyerUserId,
      dedupeKey: `order:${input.orderId}:${input.status}:buyer`,
      kind: 'order',
      title: 'আপনার অর্ডার',
      body: label,
      pathname: '/(root)/orders',
    });
    if (input.sellerUserId === input.buyerUserId) return;
    await this.emit({
      userId: input.sellerUserId,
      dedupeKey: `order:${input.orderId}:${input.status}:seller`,
      kind: 'order',
      title: 'দোকানের অর্ডার',
      body: label,
      pathname: '/(root)/seller-orders',
    });
  }

  private async syncHeat(userId: string, lat: number, lon: number) {
    const areas = await this.areas();
    const near = nearestDistrict(lat, lon);
    const me = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { district: { select: { slug: true } } },
    });
    const slugs = new Set(
      [near?.slug, me?.district?.slug].filter((slug): slug is string => !!slug),
    );
    for (const area of areas) {
      const byDistrict = slugs.has(area.location.slug);
      const byRadius = insideHeatZone(
        { lat, lon },
        { lat: area.location.lat, lon: area.location.lon },
        area.caseCount,
      );
      if (!byDistrict && !byRadius) continue;
      const top = area.diseases[0]?.diseaseType.nameBn;
      await this.emit({
        userId,
        dedupeKey: `heat:${area.location.slug}`,
        kind: 'heat',
        title: `${area.location.nameBn} এ রোগের খবর`,
        body: top
          ? `আপনার এলাকায় ${toBn(area.caseCount)}টি রিপোর্ট। বেশি দেখা যাচ্ছে ${top}।`
          : `আপনার এলাকায় ${toBn(area.caseCount)}টি রোগের রিপোর্ট।`,
        pathname: '/(root)/(tabs)/market',
        params: { tab: 'heatmap' },
      });
    }
  }

  private async syncWeather(userId: string, lat: number, lon: number) {
    try {
      const near = nearestDistrict(lat, lon);
      const point: GeoPoint = {
        lat,
        lon,
        locationBn: near?.nameBn ?? 'আপনার অবস্থান',
      };
      const weather = await this.weather.current(point);
      if (
        weather.kind !== 'rainy' &&
        weather.kind !== 'storm' &&
        weather.precipProb < 40
      ) {
        return;
      }
      const day = new Date().toISOString().slice(0, 10);
      await this.emit({
        userId,
        dedupeKey: `weather:${day}:${weather.kind}`,
        kind: 'weather',
        title: weather.kind === 'storm' ? 'ঝড়ের সতর্কতা' : 'আবহাওয়ার খবর',
        body: `${weather.conditionBn}। বৃষ্টির সম্ভাবনা ${toBn(weather.precipProb)} শতাংশ। স্প্রে করার আগে আকাশ দেখুন।`,
        pathname: '/(root)/(tabs)/scan/planning',
      });
    } catch (error) {
      this.logger.warn(`Weather alert skipped: ${error instanceof Error ? error.message : 'unknown'}`);
    }
  }

  private async areas() {
    if (this.heatCache && Date.now() - this.heatCache.at < HEAT_TTL_MS) {
      return this.heatCache.areas;
    }
    const heat = await this.heatmap.aggregate();
    this.heatCache = { at: Date.now(), areas: heat.areas };
    return heat.areas;
  }

  private async emit(draft: NotificationDraft) {
    try {
      const existing = await this.prisma.notification.findUnique({
        where: {
          userId_dedupeKey: { userId: draft.userId, dedupeKey: draft.dedupeKey },
        },
      });
      if (existing && existing.title === draft.title && existing.body === draft.body) {
        return;
      }
      const data = {
        title: draft.title,
        body: draft.body,
        pathname: draft.pathname,
        params: draft.params ?? undefined,
        priority: draft.priority ?? 'normal',
        popup: draft.popup ?? false,
        readAt: null,
        dismissedAt: null,
        createdAt: new Date(),
      };
      const row = existing
        ? await this.prisma.notification.update({
            where: { id: existing.id },
            data,
          })
        : await this.prisma.notification.create({
            data: {
              userId: draft.userId,
              dedupeKey: draft.dedupeKey,
              kind: draft.kind,
              ...data,
            },
          });
      this.hub.push(draft.userId, this.toDto(row));
    } catch (error) {
      this.logger.warn(
        `Notification ${draft.dedupeKey} was not saved: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  private toDto(row: Stored): NotificationDto {
    return {
      id: row.id,
      kind: row.kind as NotificationKind,
      title: row.title,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
      read: row.readAt != null,
      pathname: row.pathname ?? undefined,
      params: stringParams(row.params),
      priority: asPriority(row.priority),
      popup: row.popup === true,
      dismissed: row.dismissedAt != null,
    };
  }
}

function asPriority(value: string | null): NotificationPriority {
  if (value === 'important' || value === 'emergency') return value;
  return 'normal';
}

function stringParams(value: Prisma.JsonValue): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const params: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string') params[key] = entry;
  }
  return Object.keys(params).length ? params : undefined;
}
