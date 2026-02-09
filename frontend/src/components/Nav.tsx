import { Avatar, Button } from "antd";
import { InfoIcon, HomeIcon, LogOutIcon, LogInIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";

function Nav() {
  const navigate = useNavigate();
  const { logout, profile, token } = useAppStore();
  return (
    <div className="flex justify-between align-center p-4">
      <div className="flex flex-1 gap-2">
        <Button
            type="text"
            style={{ height: "30px", width: "30px", padding: "0" }}
            title="Home"
            onClick={() => navigate("/dashboard")}
          >
            <HomeIcon size={20} className="text-gray-600 dark:text-gray-300" />
          </Button>
      </div>
      <span className="text-2xl font-bold text-gray-600 dark:text-gray-300 mb-0">
        mirpass
      </span>
      <div className="flex flex-1 gap-2 justify-end">
        {profile?.username ? (
          <Button
            type="text"
            style={{ height: "30px", padding: "0", borderRadius: "50%" }}
            onClick={() => navigate("/dashboard")}
            title={profile.username}
          >
          
            <Avatar src={profile?.avatarUrl} size={30}>
              {profile?.username?.charAt(0).toUpperCase()}
            </Avatar>
        </Button>):(
        <Button
          type="text"
          style={{ height: "30px", width: "30px", padding: "0" }}
          onClick={() => navigate("/about")}
          title="About"
        >
          <InfoIcon size={20} className="text-gray-600 dark:text-gray-300" />
        </Button>)}
        {token ? (
          <Button
            type="text"
            style={{ height: "30px", width: "30px", padding: "0" }}
            title="logout"
            onClick={logout}
          >
            <LogOutIcon
              size={20}
              className="text-gray-600 dark:text-gray-300"
            />
          </Button>
        ) : (
          <Button
            type="text"
            style={{ height: "30px", width: "30px", padding: "0" }}
            title="login"
            onClick={() => navigate("/login")}
          >
            <LogInIcon size={20} className="text-gray-600 dark:text-gray-300" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default Nav;
