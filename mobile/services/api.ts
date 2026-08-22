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
import type { ReceiptSummary } from "@/types/receipt";
import type { FertilizerAdvice } from "@/types/fertilizer";
import type { YieldEstimate } from "@/types/yield";
import type { CropPlan } from "@/types/planning";
import type { HeatMapRegion, MarketListing, MarketPriceEntry } from "@/types/market";
import type { LoanApplication } from "@/types/loan";

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
  if ("data" in error) {
    const data = (error as { data?: { error?: { code?: string; message?: string } } })
      .data;
    if (data?.error) return data.error;
  }
  if ("message" in error && typeof (error as { message: unknown }).message === "string") {
    return { message: (error as { message: string }).message };
  }
  return {};
}

const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_URL,
  credentials: "include",
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
    "Yield",
    "CropPlan",
    "Market",
    "Loan",
    "Report",
    "AdminUsers",
  ],
  endpoints: (builder) => ({
    getProfessions: builder.query<{ slug: string; nameBn: string; nameEn: string }[], void>({
      query: () => "/lookups/professions",
      transformResponse: (r) => unwrap(r),
    }),
    getDistricts: builder.query<{ slug: string; nameBn: string }[], void>({
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
        const { data } = await queryFulfilled;
        dispatch(setUser(data));
      },
      invalidatesTags: ["Auth", "User"],
    }),
    googleLogin: builder.mutation<AuthUser, { idToken: string }>({
      query: (body) => ({ url: "/auth/google", method: "POST", body }),
      transformResponse: (r) => unwrap<AuthUser>(r),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(setUser(data));
      },
      invalidatesTags: ["Auth", "User"],
    }),
    verifyEmail: builder.mutation<AuthUser, { email: string; code: string }>({
      query: (body) => ({ url: "/auth/verify-email", method: "POST", body }),
      transformResponse: (r) => unwrap<AuthUser>(r),
      async onQueryStarted(_arg, { dispatch, queryFulfilled }) {
        const { data } = await queryFulfilled;
        dispatch(setUser(data));
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
      { displayName?: string; phone?: string; professionSlug?: string; districtSlug?: string }
    >({
      query: (body) => ({ url: "/users/me", method: "PATCH", body }),
      transformResponse: (r) => unwrap<AuthUser>(r),
      invalidatesTags: ["User"],
    }),
    createPhotoDiagnosis: builder.mutation<DiagnosisResult & { id: string }, { imageUrl: string }>({
      query: (body) => ({ url: "/diagnoses/photo", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Diagnosis", "History"],
    }),
    createVoiceDiagnosis: builder.mutation<
      DiagnosisResult & { id: string },
      { transcriptBn: string; cropSlug?: string }
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
    getHistory: builder.query<HistoryEntry[], { kind?: HistoryEntryKind | "all" } | void>({
      query: (arg) => {
        const kind = arg && "kind" in arg ? arg.kind : undefined;
        const q = kind && kind !== "all" ? `?kind=${kind}` : "";
        return `/history${q}`;
      },
      transformResponse: (r) => unwrap(r),
      providesTags: ["History"],
    }),
    getHistoryEntry: builder.query<HistoryEntry & { sourceId?: string }, string>({
      query: (id) => `/history/${id}`,
      transformResponse: (r) => unwrap(r),
      providesTags: (_r, _e, id) => [{ type: "History", id }],
    }),
    createReport: builder.mutation<
      { id: string; diagnosis: DiagnosisResult; treatment: TreatmentPlan },
      { diagnosisId: string }
    >({
      query: (body) => ({ url: "/reports", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Report"],
    }),
    downloadReportPdf: builder.mutation<{ downloadUrl: string | null }, string>({
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
    }),
    recommendFertilizer: builder.mutation<
      FertilizerAdvice & { id: string },
      {
        cropSlug: string;
        growthStage: string;
        soilColor: string;
        soilMoisture: string;
      }
    >({
      query: (body) => ({ url: "/fertilizer/recommend", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Fertilizer"],
    }),
    predictYield: builder.mutation<YieldEstimate & { id: string }, void>({
      query: () => ({ url: "/yield/predict", method: "POST" }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Yield", "History"],
    }),
    getLatestYield: builder.query<(YieldEstimate & { id: string }) | null, void>({
      query: () => "/yield/latest",
      transformResponse: (r) => unwrap(r),
      providesTags: ["Yield"],
    }),
    generateCropPlan: builder.mutation<CropPlan & { id: string }, void>({
      query: () => ({ url: "/crop-plans/generate", method: "POST" }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["CropPlan"],
    }),
    getLatestCropPlan: builder.query<(CropPlan & { id: string }) | null, void>({
      query: () => "/crop-plans/latest",
      transformResponse: (r) => unwrap(r),
      providesTags: ["CropPlan"],
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
    getHeatmap: builder.query<{ regions: HeatMapRegion[] }, void>({
      query: () => "/market/heatmap",
      transformResponse: (r) => unwrap(r),
    }),
    getCurrentLoan: builder.query<LoanApplication | null, void>({
      query: () => "/loans/current",
      transformResponse: (r) => unwrap(r),
      providesTags: ["Loan"],
    }),
    applyLoan: builder.mutation<
      LoanApplication,
      { amountBdt: number; purposeSlug: string; repaymentPeriod: string }
    >({
      query: (body) => ({ url: "/loans", method: "POST", body }),
      transformResponse: (r) => unwrap(r),
      invalidatesTags: ["Loan", "History"],
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
  useCreateVoiceDiagnosisMutation,
  useGetDiagnosisQuery,
  useGetTreatmentPlanQuery,
  useCreateCostEstimateMutation,
  useGetHistoryQuery,
  useGetHistoryEntryQuery,
  useCreateReportMutation,
  useDownloadReportPdfMutation,
  useSpeakMutation,
  useIdentifyToolPhotoMutation,
  useIdentifyToolVoiceMutation,
  useGetToolQuery,
  useScanReceiptMutation,
  useGetReceiptQuery,
  useRecommendFertilizerMutation,
  usePredictYieldMutation,
  useGetLatestYieldQuery,
  useGenerateCropPlanMutation,
  useGetLatestCropPlanQuery,
  useGetMarketPricesQuery,
  useGetMarketListingsQuery,
  useCreateMarketListingMutation,
  useShareListingMutation,
  useGetHeatmapQuery,
  useGetCurrentLoanQuery,
  useApplyLoanMutation,
  useGetAdminUsersQuery,
  useCreateAdminMutation,
  usePatchAdminRoleMutation,
} = api;
