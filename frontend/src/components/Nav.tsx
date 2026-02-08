import { Button } from "antd";
import { InfoIcon, HomeIcon, LogOutIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAppStore } from "../store/useAppStore";

function Nav() {
    const navigate=useNavigate();
    const { logout } = useAppStore();
  return (
    <div className="flex justify-between align-center p-4">
      <div className="flex-1">
        <Button
          type="text"
          style={{ height: "30px", width: "30px", padding: "0" }}
          onClick={() => navigate("/dashboard")}
        >
          <HomeIcon size={20} className="text-gray-600 dark:text-gray-300" />
        </Button>
      </div>
      <span className="text-2xl font-bold text-gray-600 dark:text-gray-300 mb-0">mirpass</span>
      <div className="flex flex-1 gap-2 justify-end">
        <Button
          type="text"
          style={{ height: "30px", width: "30px", padding: "0" }}
          onClick={()=>navigate("/about")}
        >
          <InfoIcon size={20} className="text-gray-600 dark:text-gray-300" />
        </Button>
        <Button
          type="text"
          style={{ height: "30px", width: "30px", padding: "0" }}
          title="logout"
          onClick={logout}
        >
          <LogOutIcon size={20} className="text-gray-600 dark:text-gray-300" />
        </Button>
      </div>
    </div>
  );
}

export default Nav;
