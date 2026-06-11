import ProtectedLayout from "@/app/layouts";
import { AuthService } from "@/services";
import { useQuery } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute() {
    const { data, isLoading } = useQuery({ queryKey: ["me"], queryFn: AuthService.getCurrentUser });
    if (isLoading) return null; // or a loader
    return data?.success ? <ProtectedLayout /> : <Navigate to="/" replace />;
}
