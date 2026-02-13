export type SimpleResponse = {
  status: number;
  message?: string;
};

export type ErrorResponse = {
  response?: {data?: { status?: number; error?: string }};
};

export type Profile = {
  username: string;
  nickname?: string;
  email: string;
  avatarUrl?: string;
};

export type ProfilePublic = {
  username: string;
  nickname?: string;
  avatarUrl?: string;
};

export type AppRole = {
  appId: string;
  logoUrl?: string;
  name: string;
  role: string;
};

export interface AppDetails {
  id: string;
  name: string;
  description: string;
  role: string; // Current user's role in this app
  logoUrl?: string;
  suspendUntil?: string | null;
  createdAt?: string;
}

export interface AppPublicDetails {
  id: string;
  name: string;
  description: string;
  logoUrl?: string;
}

export interface AppMember {
  userId: number;
  username: string;
  role: string; // 'admin' | 'root' | ...
  joinedAt: string;
}

export interface APIKey {
  id: number;
  keyValue: string; 
  name?: string;
  createdAt: string;
}

export interface TrustedUri {
  id: number;
  name?: string;
  uri: string;
  createdAt: string;
}

export interface DailyStats {
  date: string;
  logins: number;
  activeUsers: number;
  newUsers: number;
}

export interface AppStatsSummary {
  totalUsers: number;
  totalLogins: number;
  activeUsers24h: number;
  newUsers24h: number;
  daily: DailyStats[];
}

export type LoginHistoryItem = {
    user?: string;
    app: string;
    logoUrl?: string;
    time: string;
}

export type AppStats = {
    totalUsers: number;
    history: LoginHistoryItem[];
}