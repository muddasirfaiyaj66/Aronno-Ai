import type { PrismaService } from '../prisma/prisma.service';
import { nearestDistrict } from '../lookups/bangladesh-districts';

export type Geo = { lat?: number; lon?: number };

/**
 * Where a diagnosis happened: GPS fix → nearest district HQ, otherwise the
 * farmer's profile district. Stored on every diagnosis so the market heat map
 * can aggregate by area with no extra input from the farmer.
 */
export async function resolveDiagnosisLocation(
  prisma: PrismaService,
  userId: string,
  geo: Geo = {},
): Promise<{ districtId?: string; lat?: number; lon?: number }> {
  const { lat, lon } = geo;
  if (typeof lat === 'number' && typeof lon === 'number') {
    const near = nearestDistrict(lat, lon);
    if (near) {
      const district = await prisma.district.findUnique({
        where: { slug: near.slug },
      });
      if (district) return { districtId: district.id, lat, lon };
    }
  }
  const me = await prisma.user.findUnique({
    where: { id: userId },
    select: { districtId: true },
  });
  return { districtId: me?.districtId ?? undefined };
}
