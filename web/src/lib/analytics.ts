import type { AuthUser } from "./types";

export type NamedCount = { name: string; value: number };

export type DashboardStats = {
  total: number;
  farmers: number;
  admins: number;
  active: number;
  inactive: number;
  verified: number;
  unverified: number;
  withDistrict: number;
  roleBreakdown: NamedCount[];
  statusBreakdown: NamedCount[];
  verifyBreakdown: NamedCount[];
  topDistricts: NamedCount[];
  professions: NamedCount[];
  weeklySignups: { week: string; count: number; label: string }[];
};

function weekKey(d: Date) {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  const day = copy.getDay();
  copy.setDate(copy.getDate() - day);
  return copy.toISOString().slice(0, 10);
}

function weekLabel(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("bn-BD", { month: "short", day: "numeric" });
}

export function buildDashboardStats(users: AuthUser[]): DashboardStats {
  const total = users.length;
  const farmers = users.filter((u) => u.role.slug === "USER").length;
  const admins = users.filter(
    (u) => u.role.slug === "ADMIN" || u.role.slug === "SUPERADMIN",
  ).length;
  const active = users.filter((u) => u.isActive).length;
  const inactive = total - active;
  const verified = users.filter((u) => !!u.emailVerifiedAt).length;
  const unverified = total - verified;
  const withDistrict = users.filter((u) => !!u.district).length;

  const roleMap = new Map<string, number>();
  const districtMap = new Map<string, number>();
  const professionMap = new Map<string, number>();
  const weekMap = new Map<string, number>();

  for (const u of users) {
    const roleName =
      u.role.slug === "USER"
        ? "কৃষক"
        : u.role.slug === "ADMIN"
          ? "অ্যাডমিন"
          : "সুপারঅ্যাডমিন";
    roleMap.set(roleName, (roleMap.get(roleName) ?? 0) + 1);

    const dist = u.district?.nameBn ?? "অজানা";
    districtMap.set(dist, (districtMap.get(dist) ?? 0) + 1);

    const prof = u.profession?.nameBn ?? "অনির্ধারিত";
    professionMap.set(prof, (professionMap.get(prof) ?? 0) + 1);

    if (u.createdAt) {
      const key = weekKey(new Date(u.createdAt));
      weekMap.set(key, (weekMap.get(key) ?? 0) + 1);
    }
  }

  const now = new Date();
  const weeklySignups: DashboardStats["weeklySignups"] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    const key = weekKey(d);
    weeklySignups.push({
      week: key,
      label: weekLabel(key),
      count: weekMap.get(key) ?? 0,
    });
  }

  const toSorted = (map: Map<string, number>, limit?: number): NamedCount[] => {
    const rows = [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
    return limit ? rows.slice(0, limit) : rows;
  };

  return {
    total,
    farmers,
    admins,
    active,
    inactive,
    verified,
    unverified,
    withDistrict,
    roleBreakdown: toSorted(roleMap),
    statusBreakdown: [
      { name: "সক্রিয়", value: active },
      { name: "বন্ধ", value: inactive },
    ],
    verifyBreakdown: [
      { name: "যাচাইকৃত", value: verified },
      { name: "অযাচাই", value: unverified },
    ],
    topDistricts: toSorted(districtMap, 8),
    professions: toSorted(professionMap, 6),
    weeklySignups,
  };
}
