import { Avatar } from "antd";
import api from "../api/client";
import { useEffect, useState } from "react";
import type { AppPublicDetails, ProfilePublic } from "../types";
import { useAppStore } from "../store/useAppStore";

interface AnyAvatarProps {
  username?: string;
  appId?: string;
  url?: {url: string | undefined, text: string};
  size?: number | "small" | "default" | "large";
  className?: string;
}

export function AnyAvatar({
  username,
  appId,
  size,
  className,
  url,
}: AnyAvatarProps) {
  const [alt, setAlt] = useState("?");
  const [src, setSrc] = useState<string | undefined>(undefined);

  useEffect(() => {
    const load = async () => {
      if (url) {
        setSrc(url.url);
        setAlt(url.text.charAt(0).toUpperCase());
      } else if (appId) {
        try {
          const { data } = await api.get<{
            status: number;
            data: AppPublicDetails;
          }>(`/apps/info?id=${appId}`);
          setSrc(data.data.logoUrl);
          setAlt(data.data.name.charAt(0).toUpperCase());
        } catch (error) {
          console.error("Failed to fetch app info", error);
        }
      } else if (username) {
        setAlt(username.charAt(0).toUpperCase());
        try {
          const { data } = await api.get<{
            status: number;
            data: ProfilePublic;
          }>(`/user/info?username=${username}`);
          setSrc(data.data.avatarUrl);
        } catch (error) {
          console.error("Failed to fetch user info", error);
        }
      }
    };
    load();
  }, [username, appId, url]);

  return (
    <div className={className}>
      <Avatar size={size} src={src}>
        {alt}
      </Avatar>
    </div>
  );
}

interface MyAvatarProps {
  size?: number | "small" | "default" | "large";
  className?: string;
}

export function MyAvatar({ size, className }: MyAvatarProps) {
  const { profile } = useAppStore();

  return (
    <div className={className}>
      <Avatar size={size} src={profile?.avatarUrl}>
        {profile?.username.charAt(0).toUpperCase() || "?"}
      </Avatar>
    </div>
  );
}
