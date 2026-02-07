export type SimpleResponse = {
  status: number;
  message?: string;
};

export type ErrorResponse = {
  response?: { status?: number; data?: { message?: string } };
};

export type Profile = {
  username: string;
  nickname?: string;
  email: string;
  avatarUrl?: string;
};

export type AppRole = {
  appId: string;
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
  created_at?: string;
}

export interface AppMember {
  user_id: number;
  username: string;
  role: string; // 'admin' | 'root' | ...
  joined_at: string;
}

export interface APIKey {
  id: number;
  key_value: string;
  name?: string;
  created_at: string;
}
