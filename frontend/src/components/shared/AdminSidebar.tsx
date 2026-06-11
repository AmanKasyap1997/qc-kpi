import { User } from "@/services";
import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { adminSidebarMenu } from "./adminSidebarMenu";
import { LogOut } from "lucide-react";
import { AdminSubMenu } from "./AdminSubMenu";

export default function Sidebar() {
  const [user, setUser] = useState<{ user?: User }>({});
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const logout = () => {
    console.log("test logout - not working");
  };

  useEffect(() => {
    const raw = localStorage.getItem("userData");
    if (raw) {
      setUser(JSON.parse(raw));
    }
  }, []);

  const handleLogout = async () => {
    try {
      await logout?.();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  return (
    <aside className="w-full sm:w-64 md:w-40  flex flex-col bg-black">


      {/* Menu */}
      <nav className="flex-1 p-3 sm">
        {/* <ul className="space-y-1">
          {adminSidebarMenu.map((item) => {
            const Icon = item.icon;
            const isOpen = openMenu === item.label;

            // Normal menu
            if (item.to) {
              return (
                <li key={item.label}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                        isActive
                          ? "bg-blue-50 text-blue-700"
                          : "text-gray-700 hover:bg-gray-50"
                      }`
                    }
                  >
                    <Icon className="w-5 h-5" />
                    <span
                      className=" text-xs sm:text-sm font-medium truncate"
                    >
                      {item.label}
                    </span>
                  </NavLink>
                </li>
              );
            }

            // Accordion menu
            if (item.children) {
              return (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={() => setOpenMenu(isOpen ? null : item.label)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors ${
                      isOpen
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      <span className="text-xs sm:text-sm font-medium truncate">{item.label}</span>
                    </div>

                    <svg
                      className={`w-4 h-4 transition-transform ${
                        isOpen ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isOpen && <AdminSubMenu items={item.children} />}
                </li>
              );
            }

            return null;
          })}
        </ul> */}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg mb-2">
          {/* <User className="w-5 h-5 text-gray-600" /> */}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.user?.role.name}
            </p>
            <p className="text-xs text-gray-600 truncate">
              {user.user?.role.name}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
