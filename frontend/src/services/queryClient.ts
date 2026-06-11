// src/lib/react-query/queryClient.ts
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            staleTime: 60_000, // 1 minute
        },
        mutations: {
            retry: 0,
        },
    },
});
