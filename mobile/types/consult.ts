export type ConsultMedicine = {
  name: string;
  dose: string;
  howToApply: string;
};

export type ConsultStatus =
  | "requested"
  | "accepted"
  | "ringing"
  | "in_call"
  | "ended"
  | "completed"
  | "cancelled";

export type SpecialistCard = {
  id: string;
  displayName: string;
  profession: string;
  district: string | null;
  avatarUrl: string | null;
  online: boolean;
};

export type ConsultItem = {
  id: string;
  status: ConsultStatus;
  problemText: string;
  diagnosisId: string | null;
  farmer: { id: string; displayName: string };
  specialist: { id: string; displayName: string } | null;
  advice: {
    summaryBn: string;
    steps: string;
    medicines: ConsultMedicine[];
  } | null;
  videoReady: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ConsultList = {
  viewer: "farmer" | "specialist";
  items: ConsultItem[];
};

export const CONSULT_STATUS_BN: Record<ConsultStatus, string> = {
  requested: "অনুরোধ পাঠানো",
  accepted: "গৃহীত",
  ringing: "কল আসছে",
  in_call: "কলে",
  ended: "কল শেষ",
  completed: "পরামর্শ প্রস্তুত",
  cancelled: "বাতিল",
};
