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

  // Redirect / Nav
  fromPath: string | null;
  setFromPath: (path: string | null) => void;

  // SSO Context
  ssoSessionId: string | null;
  setSsoSessionId: (id: string | null) => void;
  ssoDetails: {
    appName: string;
    logoUrl?: string;
    sessionId: string;
    status: string;
  } | null;
  setSsoDetails: (details: AppState["ssoDetails"]) => void;
    fetchSsoDetails: () => Promise<void>;
    ssoConfirm: () => Promise<void>;
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

  fromPath: null,
  setFromPath: (path) => set({ fromPath: path }),

  ssoSessionId: null,
  setSsoSessionId: (id) => set({ ssoSessionId: id }),
  ssoDetails: null,
  setSsoDetails: (details) => set({ ssoDetails: details }),

  fetchSsoDetails: async () => {
    const sid = get().ssoSessionId;
    const { data } = await api.get(`/sso/details?session_id=${sid}`);
    set({ ssoDetails: data.data });
  },
    ssoConfirm: async () => {
        const sid = get().ssoSessionId;
        await api.post("/sso/confirm", { sessionId: sid });
        const currentDetails = get().ssoDetails;
        if (currentDetails) {
            set({ ssoDetails: { ...currentDetails, status: "confirmed" } });
        }
    },
}));
