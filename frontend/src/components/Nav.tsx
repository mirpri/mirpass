import { Button } from "antd";
import { Github, HelpCircleIcon, HomeIcon, LogOutIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Props = {
  onLogout: () => void;
};


function Nav({ onLogout }: Props) {
    const navigate=useNavigate();
  return (
    <div className="flex justify-between align-center p-4">
      <div className="flex-1">
        <Button
          type="text"
          style={{ height: "30px", width: "30px", padding: "0" }}
          onClick={() => navigate("/dashboard")}
        >
          <HomeIcon size={20} className="text-gray-600" />
        </Button>
      </div>
      <span className="text-2xl font-bold text-gray-600 mb-0">mirpass</span>
      <div className="flex flex-1 gap-2 justify-end">
        <Button
          type="text"
          style={{ height: "30px", width: "30px", padding: "0" }}
        >
          <HelpCircleIcon size={20} className="text-gray-600" />
        </Button>
        <Button
          type="text"
          style={{ height: "30px", width: "30px", padding: "0" }}
        >
          <Github size={20} className="text-gray-600" />
        </Button>
        <Button
          type="text"
          style={{ height: "30px", width: "30px", padding: "0" }}
          title="logout"
          onClick={onLogout}
        >
          <LogOutIcon size={20} className="text-gray-600" />
        </Button>
      </div>
    </div>
  );
}

export default Nav;
