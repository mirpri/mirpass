import { create } from "zustand";
import api from "../api/client";
import type { AppRole, Profile } from "../types";

interface AppState {
  // User Profile
  token: string | null;
  setToken: (token: string | null) => void;

  profile: Profile | null;
  isLoadingProfile: boolean;
  fetchProfile: () => Promise<void>;
  updateProfile: (partial: Partial<Profile>) => void;

  logout: () => void;

  // Apps
  myApps: AppRole[];
  isLoadingApps: boolean;
  fetchMyApps: () => Promise<void>;

  // SSO Context
  ssoType: "device_code" | "auth_code" | null;
  setSsoType: (type: "device_code" | "auth_code" | null) => void;
  ssoUserCode: string | null;
  setSsoUserCode: (code: string | null) => void;

  ssoSessionId: string | null;
  setSsoSessionId: (id: string | null) => void;

  ssoDetails: {
    appId: string;
    appName?: string;
    logoUrl?: string;
    sessionId: string;
    status: string;
    expiresAt: string;
  } | null;
  setSsoDetails: (details: AppState["ssoDetails"]) => void;
  fetchSsoDetails: () => Promise<void>;
  ssoConfirm: (approve: boolean) => Promise<any>;
}

export const useAppStore = create<AppState>((set, get) => ({
  token: localStorage.getItem("token"),
  setToken: (token) => {
    if (token) {
      localStorage.setItem("token", token);
    } else {
      localStorage.removeItem("token");
    }
    set({ token });
  },

  profile: null,
  isLoadingProfile: false,
  fetchProfile: async () => {
    set({ isLoadingProfile: true });
    try {
      const { data } = await api.get<{ status: number; data: Profile }>(
        "/myprofile",
      );
      set({ profile: data.data, isLoadingProfile: false });
    } catch (error) {
      console.error("Failed to fetch profile", error);
      set({ isLoadingProfile: false, profile: null });
      throw error;
    }
  },
  updateProfile: (partial) => {
    set((state) => ({
      profile: state.profile ? { ...state.profile, ...partial } : null,
    }));
  },

  logout: () => {
    localStorage.removeItem("token");
    set({ token: null, profile: null, myApps: [] });
  },

  myApps: [],
  isLoadingApps: false,
  fetchMyApps: async () => {
    set({ isLoadingApps: true });
    try {
      const { data } = await api.get<{ data: AppRole[] }>("/myapps");
      set({ myApps: data.data || [], isLoadingApps: false });
    } catch (error) {
      set({ isLoadingApps: false });
    }
  },

  ssoType: null,
  setSsoType: (type) => set({ ssoType: type }),

  ssoUserCode: null,
  setSsoUserCode: (code) => set({ ssoUserCode: code }),

  ssoSessionId: null,
  setSsoSessionId: (id) => set({ ssoSessionId: id }),

  ssoDetails: null,
  setSsoDetails: (details) => set({ ssoDetails: details }),

  fetchSsoDetails: async () => {
    if (!get().ssoUserCode && !get().ssoSessionId) {
      return;
    }
    const currentSid = get().ssoSessionId || get().ssoDetails?.sessionId;

    if (
      !currentSid &&
      get().ssoType === "device_code" &&
      get().ssoUserCode
    ) {
      const {data} = await api.get(
        `/authorize/request/by-user-code?userCode=${get().ssoUserCode}`,
      );
      set({ ssoDetails: data.data, ssoSessionId: data.data.sessionId });
    } else if (currentSid) {
      const {data} = await api.get(`/authorize/request?sessionId=${currentSid}`);
      set({ ssoDetails: data.data, ssoSessionId: data.data.sessionId });
    } else {
       return;
    }

    const { data } = await api.get(`/apps/info?id=${get().ssoDetails?.appId}`);
    set((state) => ({
      ssoDetails: state.ssoDetails
        ? { ...state.ssoDetails, appName: data.data.name, logoUrl: data.data.logoUrl }
        : null,
    }));
  },

  ssoConfirm: async (approve: boolean) => {
    const sid = get().ssoDetails?.sessionId;
    let responseData; 

    if (get().ssoType === "device_code") {
      const { data } = await api.post("/authorize/request/consent", {
        sessionId: sid,
        approve: true,
      });
      responseData = data;
    } else {
      // Standard SSO Confirm
      const { data } = await api.post("/sso/confirm", {
        sessionId: sid,
        requestCode: approve,
      });
      responseData = data;
    }

    get()
      .fetchSsoDetails()
      .catch(() => {
        set({ ssoDetails: null });
      });
    
    return responseData?.data;
  },
}));
