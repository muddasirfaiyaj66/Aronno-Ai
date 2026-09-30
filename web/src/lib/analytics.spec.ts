import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDashboardStats } from "./analytics.ts";
import { isStaff, type AuthUser } from "./types.ts";

function user(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: "1",
    email: "a@aronno.test",
    displayName: "আমিনা",
    phone: null,
    avatarUrl: null,
    isActive: true,
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    createdAt: new Date().toISOString(),
    role: { slug: "USER", nameBn: "কৃষক", nameEn: "Farmer" },
    profession: { slug: "farmer", nameBn: "কৃষক", nameEn: "Farmer" },
    district: { slug: "dhaka", nameBn: "ঢাকা" },
    ...overrides,
  };
}

describe("isStaff", () => {
  it("accepts admin roles only", () => {
    assert.equal(isStaff("ADMIN"), true);
    assert.equal(isStaff("SUPERADMIN"), true);
    assert.equal(isStaff("USER"), false);
    assert.equal(isStaff(undefined), false);
  });
});

describe("buildDashboardStats", () => {
  it("counts farmers, admins, and inactive accounts", () => {
    const stats = buildDashboardStats([
      user(),
      user({
        id: "2",
        isActive: false,
        emailVerifiedAt: null,
        district: null,
        role: { slug: "ADMIN", nameBn: "অ্যাডমিন", nameEn: "Admin" },
      }),
    ]);
    assert.equal(stats.total, 2);
    assert.equal(stats.farmers, 1);
    assert.equal(stats.admins, 1);
    assert.equal(stats.active, 1);
    assert.equal(stats.inactive, 1);
    assert.equal(stats.verified, 1);
    assert.equal(stats.unverified, 1);
    assert.equal(stats.withDistrict, 1);
    assert.equal(stats.weeklySignups.length, 8);
    assert.equal(stats.statusBreakdown[0].name, "সক্রিয়");
  });
});
