// import Sidebar from "@/components/shared/AdminSidebar";
import { Outlet } from "react-router-dom";

const ProtectedLayout: React.FC = () => {
    return (
        <div className="min-h-screen flex">
            {/* <Sidebar /> */}
            <Outlet />
        </div>
    );
};

export default ProtectedLayout;