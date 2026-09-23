import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from "@reduxjs/toolkit/query/react";
import { Platform } from "react-native";
import {
  clearCookies,
  getCookie,
  getCookieHeader,
  ingestCookies,
} from "@/services/cookieJar";
import { clearUser, setUser, type AuthUser } from "@/store/authSlice";
import type { DiagnosisResult } from "@/types/diagnosis";
import type { CostEstimateResult, TreatmentPlan } from "@/types/treatment";
import type { HistoryEntry, HistoryEntryKind } from "@/types/history";
import type { ToolResult } from "@/types/tools";
import type { ReceiptReviewItem, ReceiptSummary } from "@/types/receipt";
import type { FertilizerAdvice } from "@/types/fertilizer";
import type { CropPlan } from "@/types/planning";
import type { HeatmapResponse, MarketListing, MarketPriceEntry, ShopData } from "@/types/market";
import type { CurrentWeather } from "@/types/weather";

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000/api";

type Envelope<T> = { success: true; data: T } | { success: false; error: { code: string; message: string } };

function unwrap<T>(raw: unknown): T {
  if (raw && typeof raw === "object" && "success" in raw) {
    const env = raw as Envelope<T>;
    if (env.success) return env.data;
    throw new Error(env.error.message);
  }
  return raw as T;
}

export function getApiError(error: unknown): { code?: string; message?: string } {
  if (!error || typeof error !== "object") return {};

  // RTK Query FetchBaseQueryError with envelope body
  if ("data" in error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object") {
      const env = data as {
        error?: { code?: string; message?: string };
        message?: string;
      };
      if (env.error?.message || env.error?.code) {
        return {
          code: env.error.code,
          message: env.error.message,
        };
      }
      if (typeof env.message === "string") return { message: env.message };
    }
  }

  // RTK CUSTOM_ERROR / SerializedError / FETCH_ERROR string
  if ("error" in error && typeof (error as { error: unknown }).error === "string") {
    const status = (error as { status?: unknown }).status;
    if (status === "FETCH_ERROR" || status === "TIMEOUT_ERROR") {
      return { code: "NETWORK", message: (error as { error: string }).error };
    }
    return { message: (error as { error: string }).error };
  }

  if ("message" in error && typeof (error as { message: unknown }).message === "string") {
    return { message: (error as { message: string }).message };
  }

  return {};
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  credentials: "include",
  // Emulator / slow networks otherwise leave isLoading=true forever → white screen.
  timeout: 8_000,
  prepareHeaders: async (headers, { type }) => {
    if (Platform.OS !== "web") {
      const cookie = await getCookieHeader();
      if (cookie) headers.set("Cookie", cookie);
    }
    const csrf = await getCookie("aronno_csrf");
    if (csrf && type === "mutation") {
      headers.set("X-CSRF-Token", csrf);
    }
    return headers;
  },
  fetchFn: async (input, init) => {
    const res = await fetch(input, init);
    await ingestCookies(res);
    return res;
  },
});

let refreshPromise: Promise<boolean> | null = null;

const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extra) => {
  let result = await rawBaseQuery(args, api, extra);
  const url = typeof args === "string" ? args : args.url;
  const skipReauth = [
    "/auth/login",
    "/auth/register",
    "/auth/google",
    "/auth/refresh",
    "/auth/logout",
    "/auth/verify-email",
    "/auth/resend-verification",
    "/auth/forgot-password",
    "/auth/reset-password",
  ].some((path) => url.includes(path));
  if (result.error?.status === 401 && !skipReauth) {
    if (!refreshPromise) {
      refreshPromise = (async () => {
        const refresh = await rawBaseQuery(
          { url: "/auth/refresh", method: "POST" },
          api,
          extra,
        );
        return !refresh.error;
      })().finally(() => {
        refreshPromise = null;
      });
    }
    const ok = await refreshPromise;
    if (ok) {
      result = await rawBaseQuery(args, api, extra);
    } else {
      await clearCookies();
      api.dispatch(clearUser());
    }
  }
  return result;
};

export const api = createApi({
  reducerPath: "api",
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    "Auth",
    "User",
    "Diagnosis",
    "History",
    "Treatment",
    "CostEstimate",
    "Tool",
    "Receipt",
    "Fertilizer",
    "CropPlan",
    "Market",
    "Report",
    "AdminUsers",
    "Weather",
    "Shop",
    "Product",
    "Cart",
    "Order",
  ],
  endpoints: (builder) => ({
    getProfessions: builder.query<{ slug: string; nameBn: string; nameEn: string }[], void>({
      query: () => "/lookups/professions",
      transformResponse: (r) => unwrap(r),
    }),
    getDistricts: builder.query<{ id?: string; slug: string; nameBn: string }[], void>({
      query: () => "/lookups/districts",
      transformResponse: (r) => unwrap(r),
    }),
    register: builder.mutation<
      { email: string; requiresVerification: true },
      { email: string; password: string; displayName: string; professionSlug?: string }
    >({
      query: (body) => ({ url: "/auth/register", method: "POST", body }),
      transformResponse: (r) => unwrap<{ email: string; requiresVerification: true }>(r),
    }),
    login: builder.mutation<AuthUser, { email: string; password: string }>({
      query: (body) => ({ url: "/auth/login", method: "POST", body }),
      transformResponse: (r) => unwrap<AuthUser>(r),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setUser(data));
        } catch {
          // handled via mutation error state
        }
      },
      invalidatesTags: ["Auth", "User"],
    }),
    googleLogin: builder.mutation<AuthUser, { idToken: string }>({
      query: (body) => ({ url: "/auth/google", method: "POST", body }),
      transformResponse: (r) => unwrap<AuthUser>(r),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setUser(data));
        } catch {
          // handled via mutation error state
        }
      },
      invalidatesTags: ["Auth", "User"],
    }),
    verifyEmail: builder.mutation<AuthUser, { email: string; code: string }>({
      query: (body) => ({ url: "/auth/verify-email", method: "POST", body }),
      transformResponse: (r) => unwrap<AuthUser>(r),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setUser(data));
        } catch {
          // handled via mutation error state
        }
      },
      invalidatesTags: ["Auth", "User"],
    }),
    resendVerification: builder.mutation<{ ok: boolean }, { email: string }>({
      query: (body) => ({ url: "/auth/resend-verification", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
    }),
    forgotPassword: builder.mutation<{ ok: boolean }, { email: string }>({
      query: (body) => ({ url: "/auth/forgot-password", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
    }),
    resetPassword: builder.mutation<
      { ok: boolean },
      { email: string; code: string; password: string }
    >({
      query: (body) => ({ url: "/auth/reset-password", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
    }),
    logout: builder.mutation<{ ok: boolean }, void>({
      query: () => ({ url: "/auth/logout", method: "POST" }),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
        } finally {
          await clearCookies();
          dispatch(clearUser());
          dispatch(api.util.resetApiState());
        }
      },
    }),
    getMe: builder.query<AuthUser, void>({
      query: () => "/auth/me",
      transformResponse: (r) => unwrap<AuthUser>(r),
      providesTags: ["Auth", "User"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setUser(data));
        } catch {
          dispatch(clearUser());
        }
      },
    }),
    patchMe: builder.mutation<
      AuthUser,
      { displayName?: string; phone?: string; professionSlug?: string; districtSlug?: string; avatarUrl?: string }
    >({
      query: (body) => ({ url: "/users/me", method: "PATCH", body }),
      transformResponse: (r) => unwrap<AuthUser>(r),
      invalidatesTags: ["User", "Auth"],
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        try {
          const { data } = await queryFulfilled;
          dispatch(setUser(data));
        } catch {
          // keep previous profile
        }
      },
    }),
    createPhotoDiagnosis: builder.mutation<
      DiagnosisResult & { id: string },
      { imageUrl: string; lat?: number; lon?: number }
    >({
      query: (body) => ({ url: "/diagnoses/photo", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Diagnosis", "History"],
    }),
    transcribe: builder.mutation<{ transcriptBn: string }, { audioBase64: string; mimeType?: string }>({
      query: (body) => ({ url: "/diagnoses/transcribe", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
    }),
    createVoiceDiagnosis: builder.mutation<
      DiagnosisResult & { id: string },
      { transcriptBn: string; cropSlug?: string; lat?: number; lon?: number }
    >({
      query: (body) => ({ url: "/diagnoses/voice", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Diagnosis", "History"],
    }),
    getDiagnosis: builder.query<DiagnosisResult & { id: string }, string>({
      query: (id) => `/diagnoses/${id}`,
      transformResponse: (r) => unwrap(r),
      providesTags: (_r, _e, id) => [{ type: "Diagnosis", id }],
    }),
    getTreatmentPlan: builder.query<TreatmentPlan & { id: string }, string>({
      query: (diagnosisId) => `/treatment-plans?diagnosisId=${diagnosisId}`,
      transformResponse: (r) => unwrap(r),
      providesTags: ["Treatment"],
    }),
    createCostEstimate: builder.mutation<
      CostEstimateResult & { id: string },
      { cropSlug: string; landSize: number; landUnit: "bigha" | "acre" }
    >({
      query: (body) => ({ url: "/cost-estimates", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["CostEstimate"],
    }),
    getHistory: builder.query<
      HistoryEntry[],
      { kind?: HistoryEntryKind | "all"; cursor?: string } | void
    >({
      query: (arg) => {
        const p = new URLSearchParams();
        const kind = arg && "kind" in arg ? arg.kind : undefined;
        const cursor = arg && "cursor" in arg ? arg.cursor : undefined;
        if (kind && kind !== "all") p.set("kind", kind);
        if (cursor) p.set("cursor", cursor);
        const q = p.toString();
        return `/history${q ? `?${q}` : ""}`;
      },
      transformResponse: (r) => unwrap(r),
      providesTags: ["History"],
    }),
    getHistoryEntry: builder.query<HistoryEntry & { sourceId?: string }, string>({
      query: (id) => `/history/${id}`,
      transformResponse: (r) => unwrap(r),
      providesTags: (_r, _e, id) => [{ type: "History", id }],
    }),
    deleteHistoryEntry: builder.mutation<{ ok: boolean; deleted: string[] }, string>({
      query: (id) => ({ url: `/history/${id}`, method: "DELETE" }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["History", "Diagnosis"],
    }),
    syncOffline: builder.mutation<
      {
        diagnoses: { clientLocalId: string; serverId: string }[];
        tools: { clientLocalId: string; serverId: string }[];
        chatTurns: { clientLocalId: string; serverId: string }[];
      },
      {
        diagnoses: {
          clientLocalId: string;
          labelId?: string;
          diseaseNameBn: string;
          diseaseNameEn: string;
          confidence: number;
          severity: string;
          verifiedBn?: string | null;
          source?: string;
          imageObjectKey?: string;
        }[];
        tools: {
          clientLocalId: string;
          labelId?: string;
          toolNameBn: string;
          toolNameEn: string;
          reasonBn?: string;
          verifiedBn?: string | null;
          imageObjectKey?: string;
        }[];
        chatTurns: {
          clientLocalId: string;
          role: "user" | "assistant";
          textBn: string;
          createdAt?: string;
        }[];
      }
    >({
      query: (body) => ({ url: "/sync/offline", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["History"],
    }),
    syncPullChat: builder.query<
      {
        items: {
          id: string;
          role: "user" | "assistant";
          textBn: string;
          createdAt: string;
          clientLocalId?: string | null;
        }[];
        nextCursor?: string;
      },
      { cursor?: string; limit?: number } | void
    >({
      query: (arg) => {
        const p = new URLSearchParams();
        if (arg?.cursor) p.set("cursor", arg.cursor);
        if (arg?.limit) p.set("limit", String(arg.limit));
        const q = p.toString();
        return `/sync/chat${q ? `?${q}` : ""}`;
      },
      transformResponse: (r) => unwrap(r),
    }),
    createReport: builder.mutation<
      { id: string; diagnosis: DiagnosisResult; treatment: TreatmentPlan },
      { diagnosisId: string }
    >({
      query: (body) => ({ url: "/reports", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Report"],
    }),
    downloadReportPdf: builder.mutation<
      { filename: string; pdfBase64: string; downloadUrl: string | null },
      string
    >({
      query: (id) => ({ url: `/reports/${id}/pdf`, method: "POST" }),
      transformResponse: (r) => unwrap(r),
    }),
    speak: builder.mutation<{ id: string; audioUrl: string }, { textBn: string }>({
      query: (body) => ({ url: "/tts", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
    }),
    identifyToolPhoto: builder.mutation<ToolResult, { imageUrl: string }>({
      query: (body) => ({ url: "/tools/identify/photo", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Tool"],
    }),
    identifyToolVoice: builder.mutation<ToolResult, { transcriptBn: string }>({
      query: (body) => ({ url: "/tools/identify/voice", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Tool"],
    }),
    getTool: builder.query<ToolResult, string>({
      query: (id) => `/tools/${id}`,
      transformResponse: (r) => unwrap(r),
    }),
    scanReceipt: builder.mutation<ReceiptSummary, { imageUrl: string }>({
      query: (body) => ({ url: "/receipts/scan", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Receipt"],
    }),
    getReceipt: builder.query<ReceiptSummary, string>({
      query: (id) => `/receipts/${id}`,
      transformResponse: (r) => unwrap(r),
      providesTags: (_r, _e, id) => [{ type: "Receipt", id }],
    }),
    reviewReceipt: builder.mutation<
      ReceiptSummary,
      { id: string; items: ReceiptReviewItem[]; totalBdt?: number }
    >({
      query: ({ id, ...body }) => ({ url: `/receipts/${id}`, method: "PATCH", body }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: (_r, _e, { id }) => [{ type: "Receipt", id }],
    }),
    recommendFertilizer: builder.mutation<
      FertilizerAdvice & { id: string },
      {
        cropSlug: string;
        growthStage: string;
        soilColor: string;
        soilMoisture: string;
        landSizeBigha: number;
        cropAgeDays: number;
        hasDisease: "yes" | "no" | "unsure";
        /** Latest diagnosis from History, when the farmer links it. */
        diagnosisId?: string;
        diseaseNameBn?: string;
        diseaseSeverity?: "low" | "medium" | "high";
      }
    >({
      query: (body) => ({ url: "/fertilizer/recommend", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Fertilizer"],
    }),
    generateCropPlan: builder.mutation<
      CropPlan & { id: string },
      {
        lat?: number;
        lon?: number;
        landSize?: number;
        landUnit?: "bigha" | "acre";
      } | void
    >({
      query: (body) => ({ url: "/crop-plans/generate", method: "POST", body: body ?? {} }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["CropPlan"],
    }),
    getLatestCropPlan: builder.query<(CropPlan & { id: string }) | null, void>({
      query: () => "/crop-plans/latest",
      transformResponse: (r) => unwrap(r),
      providesTags: ["CropPlan"],
    }),
    getWeather: builder.query<CurrentWeather, { lat?: number; lon?: number } | void>({
      query: (arg) => {
        const p = new URLSearchParams();
        if (arg?.lat != null) p.set("lat", String(arg.lat));
        if (arg?.lon != null) p.set("lon", String(arg.lon));
        const q = p.toString();
        return `/weather/current${q ? `?${q}` : ""}`;
      },
      transformResponse: (r) => unwrap(r),
      providesTags: ["Weather"],
    }),
    getMarketPrices: builder.query<
      { markets: (MarketPriceEntry & { bestPrice?: boolean })[]; estimatedRevenueHero: number },
      { cropSlug?: string; districtSlug?: string }
    >({
      query: ({ cropSlug, districtSlug }) => {
        const p = new URLSearchParams();
        if (cropSlug) p.set("cropSlug", cropSlug);
        if (districtSlug) p.set("districtSlug", districtSlug);
        const q = p.toString();
        return `/market/prices${q ? `?${q}` : ""}`;
      },
      transformResponse: (r) => unwrap(r),
      providesTags: ["Market"],
    }),
    getMarketListings: builder.query<
      MarketListing[],
      { cropSlug?: string; districtSlug?: string; sort?: "price_asc" | "price_desc" }
    >({
      query: ({ cropSlug, districtSlug, sort }) => {
        const p = new URLSearchParams();
        if (cropSlug) p.set("cropSlug", cropSlug);
        if (districtSlug) p.set("districtSlug", districtSlug);
        if (sort) p.set("sort", sort);
        const q = p.toString();
        return `/market/listings${q ? `?${q}` : ""}`;
      },
      transformResponse: (r) => unwrap(r),
      providesTags: ["Market"],
    }),
    createMarketListing: builder.mutation<
      MarketListing,
      {
        cropSlug: string;
        quantityBn: string;
        askingPricePerKg: number;
        districtSlug: string;
        imageUrl?: string;
      }
    >({
      query: (body) => ({ url: "/market/listings", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Market"],
    }),
    shareListing: builder.mutation<{ shareUrl: string }, string>({
      query: (id) => ({ url: `/market/listings/${id}/share`, method: "POST" }),
      transformResponse: (r) => unwrap(r),
    }),
    getHeatmap: builder.query<HeatmapResponse, { days?: number } | void>({
      query: (arg) => `/market/heatmap${arg?.days ? `?days=${arg.days}` : ""}`,
      transformResponse: (r) => unwrap(r),
    }),
    getAdminUsers: builder.query<AuthUser[], void>({
      query: () => "/admin/users?limit=50",
      transformResponse: (r) => unwrap(r),
      providesTags: ["AdminUsers"],
    }),
    createAdmin: builder.mutation<
      AuthUser,
      { email: string; password: string; displayName: string }
    >({
      query: (body) => ({ url: "/admin/users", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["AdminUsers"],
    }),
    patchAdminRole: builder.mutation<
      AuthUser,
      { id: string; roleSlug: "ADMIN" | "USER" }
    >({
      query: ({ id, roleSlug }) => ({
        url: `/admin/users/${id}/role`,
        method: "PATCH",
        body: { roleSlug },
      }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["AdminUsers"],
    }),
    uploadStorageImage: builder.mutation<
      { url: string; publicId: string },
      { uri: string; name?: string; type?: string }
    >({
      query: ({ uri, name = "photo.jpg", type = "image/jpeg" }) => {
        const formData = new FormData();
        formData.append("file", {
          uri,
          name,
          type,
        } as unknown as Blob);
        return {
          url: "/storage/upload",
          method: "POST",
          body: formData,
        };
      },
      transformResponse: (r) => unwrap<{ url: string; publicId: string }>(r),
    }),
    deleteStorageImage: builder.mutation<
      { deleted: boolean; publicId: string },
      string
    >({
      query: (publicId) => ({
        url: `/storage/image?publicId=${encodeURIComponent(publicId)}`,
        method: "DELETE",
      }),
      transformResponse: (r) => unwrap(r),
    }),
    getMyShop: builder.query<ShopData | null, void>({
      query: () => "/marketplace/shops/me",
      transformResponse: (r) => unwrap<ShopData | null>(r),
      providesTags: ["Shop"],
    }),
    getPublicShop: builder.query<ShopData, string>({
      query: (id) => `/marketplace/shops/${id}`,
      transformResponse: (r) => unwrap<ShopData>(r),
      providesTags: (_r, _e, id) => [{ type: "Shop", id }],
    }),
    createShop: builder.mutation<
      ShopData,
      {
        name: string;
        description?: string;
        logoUrl?: string;
        bannerUrl?: string;
        phone: string;
        districtId: string;
        upazila?: string;
        address?: string;
      }
    >({
      query: (body) => ({ url: "/marketplace/shops", method: "POST", body }),
      transformResponse: (r) => unwrap<ShopData>(r),
      invalidatesTags: ["Shop"],
    }),
    updateMyShop: builder.mutation<
      ShopData,
      {
        name?: string;
        description?: string;
        logoUrl?: string;
        bannerUrl?: string;
        phone?: string;
        districtId?: string;
        upazila?: string;
        address?: string;
        isActive?: boolean;
      }
    >({
      query: (body) => ({ url: "/marketplace/shops/me", method: "PATCH", body }),
      transformResponse: (r) => unwrap<ShopData>(r),
      invalidatesTags: ["Shop"],
    }),
    getProducts: builder.query<any[], any>({
      query: (params) => {
        const p = new URLSearchParams();
        if (params?.category) p.set("category", params.category);
        if (params?.districtId) p.set("districtId", params.districtId);
        if (params?.search) p.set("search", params.search);
        if (params?.sort) p.set("sort", params.sort);
        const q = p.toString();
        return `/marketplace/products${q ? `?${q}` : ""}`;
      },
      transformResponse: (r) => {
        const data = unwrap<{ items: any[]; total: number } | any[]>(r);
        // Support both paginated { items } response and plain array
        if (data && !Array.isArray(data) && "items" in data) return data.items;
        return data as any[];
      },
      providesTags: ["Product"],
    }),
    getMyProducts: builder.query<any[], void>({
      query: () => "/marketplace/products/my-products",
      transformResponse: (r) => unwrap(r),
      providesTags: ["Product"],
    }),
    getProduct: builder.query<any, string>({
      query: (id) => `/marketplace/products/${id}`,
      transformResponse: (r) => unwrap(r),
      providesTags: (_r, _e, id) => [{ type: "Product", id }],
    }),
    createProduct: builder.mutation<any, any>({
      query: (body) => ({ url: "/marketplace/products", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Product", "Shop"],
    }),
    updateProduct: builder.mutation<any, { id: string; [key: string]: any }>({
      query: ({ id, ...body }) => ({
        url: `/marketplace/products/${id}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Product", "Shop"],
    }),
    deleteProduct: builder.mutation<any, string>({
      query: (id) => ({ url: `/marketplace/products/${id}`, method: "DELETE" }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Product", "Shop"],
    }),
    getCart: builder.query<any, void>({
      query: () => "/marketplace/cart",
      transformResponse: (r) => unwrap(r),
      providesTags: ["Cart"],
    }),
    addItem: builder.mutation<any, { productId: string; quantity: number }>({
      query: (body) => ({ url: "/marketplace/cart/items", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Cart"],
    }),
    updateQuantity: builder.mutation<any, { productId: string; quantity: number }>({
      query: ({ productId, ...body }) => ({
        url: `/marketplace/cart/items/${productId}`,
        method: "PATCH",
        body,
      }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Cart"],
    }),
    removeItem: builder.mutation<any, string>({
      query: (productId) => ({
        url: `/marketplace/cart/items/${productId}`,
        method: "DELETE",
      }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Cart"],
    }),
    clearCart: builder.mutation<any, void>({
      query: () => ({ url: "/marketplace/cart", method: "DELETE" }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Cart"],
    }),
    checkout: builder.mutation<
      any,
      {
        shopId: string;
        shippingAddress: string;
        contactPhone: string;
        districtId: string;
        notes?: string;
      }
    >({
      query: (body) => ({ url: "/marketplace/orders", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Cart", "Order", "Product"],
    }),
    getBuyerOrders: builder.query<any[], void>({
      query: () => "/marketplace/orders/my-orders",
      transformResponse: (r) => unwrap<any[]>(r),
      providesTags: ["Order"],
    }),
    getShopOrders: builder.query<any[], void>({
      query: () => "/marketplace/orders/shop-orders",
      transformResponse: (r) => unwrap<any[]>(r),
      providesTags: ["Order"],
    }),
    updateOrderStatus: builder.mutation<any, { id: string; status: string }>({
      query: ({ id, status }) => ({
        url: `/marketplace/orders/${id}/status`,
        method: "PATCH",
        body: { status },
      }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Order", "Product"],
    }),
    createReview: builder.mutation<
      any,
      { orderId: string; productId: string; rating: number; comment?: string }
    >({
      query: ({ orderId, ...body }) => ({
        url: `/marketplace/orders/${orderId}/reviews`,
        method: "POST",
        body,
      }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Order", "Product"],
    }),
  }),
});

export const {
  useGetProfessionsQuery,
  useGetDistrictsQuery,
  useRegisterMutation,
  useLoginMutation,
  useGoogleLoginMutation,
  useVerifyEmailMutation,
  useResendVerificationMutation,
  useForgotPasswordMutation,
  useResetPasswordMutation,
  useLogoutMutation,
  useGetMeQuery,
  usePatchMeMutation,
  useCreatePhotoDiagnosisMutation,
  useTranscribeMutation,
  useCreateVoiceDiagnosisMutation,
  useGetDiagnosisQuery,
  useGetTreatmentPlanQuery,
  useCreateCostEstimateMutation,
  useGetHistoryQuery,
  useGetHistoryEntryQuery,
  useDeleteHistoryEntryMutation,
  useSyncOfflineMutation,
  useLazySyncPullChatQuery,
  useCreateReportMutation,
  useDownloadReportPdfMutation,
  useSpeakMutation,
  useIdentifyToolPhotoMutation,
  useIdentifyToolVoiceMutation,
  useGetToolQuery,
  useScanReceiptMutation,
  useGetReceiptQuery,
  useReviewReceiptMutation,
  useRecommendFertilizerMutation,
  useGenerateCropPlanMutation,
  useGetLatestCropPlanQuery,
  useGetWeatherQuery,
  useGetMarketPricesQuery,
  useGetMarketListingsQuery,
  useCreateMarketListingMutation,
  useShareListingMutation,
  useGetHeatmapQuery,
  useGetAdminUsersQuery,
  useCreateAdminMutation,
  usePatchAdminRoleMutation,
  useUploadStorageImageMutation,
  useDeleteStorageImageMutation,
  useGetMyShopQuery,
  useGetPublicShopQuery,
  useCreateShopMutation,
  useUpdateMyShopMutation,
  useGetProductsQuery,
  useGetMyProductsQuery,
  useGetProductQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
  useGetCartQuery,
  useAddItemMutation,
  useUpdateQuantityMutation,
  useRemoveItemMutation,
  useClearCartMutation,
  useCheckoutMutation,
  useGetBuyerOrdersQuery,
  useGetShopOrdersQuery,
  useUpdateOrderStatusMutation,
  useCreateReviewMutation,
} = api;
