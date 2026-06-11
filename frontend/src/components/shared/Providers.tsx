import { queryClient } from "@/services/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AuthProvider } from "@/store/auth";
import AppToast from "@/components/shared/Toast";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppToast />
        {children}
      </AuthProvider>
    </QueryClientProvider>
  );
}
