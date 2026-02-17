import { Button, Dropdown, type MenuProps } from "antd";
import { HomeIcon, LogOutIcon, LogInIcon, UserPlus2, LanguagesIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAppStore } from "../store/useAppStore";
import {
  getStoredLanguagePreference,
  setAppLanguage,
  SUPPORTED_LANGUAGES,
  type LanguagePreference,
  languageDisplayNames
} from "../i18n";
import { MyAvatar } from "./Avatars";

function Nav() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { logout, profile, token } = useAppStore();
  const selectedPreference = getStoredLanguagePreference();

  const languageMenuItems: MenuProps["items"] = [
    {
      key: "auto",
      label: t("nav.language-auto"),
      disabled: selectedPreference === "auto",
    },
    ...SUPPORTED_LANGUAGES.map((language) => ({
      key: language,
      label: languageDisplayNames[language] || language,
      disabled: selectedPreference === language,
    }))
  ];

  const onLanguageMenuClick: MenuProps["onClick"] = ({ key }) => {
    if (key === "current") {
      return;
    }

    setAppLanguage(key as LanguagePreference);
  };

  return (
    <div className="flex justify-between align-center p-4">
      <div className="flex flex-1 gap-2">
        <Button
            type="text"
            style={{ height: "30px", width: "30px", padding: "0" }}
            title={t("nav.home")}
            onClick={() => navigate("/dashboard")}
          >
            <HomeIcon size={20} className="text-gray-600 dark:text-gray-300" />
          </Button>
          <Dropdown
            trigger={["hover"]}
            menu={{ items: languageMenuItems, onClick: onLanguageMenuClick }}
            placement="bottomLeft"
          >
          <Button
            type="text"
            style={{ height: "30px", width: "30px", padding: "0" }}
            title={t("nav.change-language")}
          >
            <LanguagesIcon size={20} className="text-gray-600 dark:text-gray-300" />
          </Button>
          </Dropdown>
      </div>
      <span className="text-2xl font-bold text-gray-600 dark:text-gray-300 mb-0 cursor-pointer" onClick={() => navigate("/about")}>
        mirpass
      </span>
      <div className="flex flex-1 gap-2 justify-end">
        {token ? (
          <Button
            type="text"
            style={{ height: "30px", padding: "0", borderRadius: "50%" }}
            onClick={() => navigate("/dashboard")}
            title={profile?.username}
          >          
            <MyAvatar size={30} />
        </Button>):(
        <Button
          type="text"
          style={{ height: "30px", width: "30px", padding: "0" }}
          onClick={() => navigate("/register")}
          title={t("sign-up")}
        >
          <UserPlus2 size={20} className="text-gray-600 dark:text-gray-300" />
        </Button>)}
        {token ? (
          <Button
            type="text"
            style={{ height: "30px", width: "30px", padding: "0" }}
            title={t("nav.log-out")}
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
            title={t("sign-in")}
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
