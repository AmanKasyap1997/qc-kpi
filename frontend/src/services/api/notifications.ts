import { apiClient } from "./client";
import { API_ENDPOINTS } from "./endpoints";

export type NotificationStatus = "completed" | "failed";

export interface Notification{
    id: number,
    title: string,
    status: NotificationStatus;
    message: string,
    progress: number,
    createdAt: string
}

export interface NotificationResponse {
  success: boolean;
  data: {
    unreadCount: number;
    notifications: Notification[];
  };
}

export const getNotifications = async (): Promise<NotificationResponse> =>{
    const {data} = await apiClient.get(API_ENDPOINTS.NOTIFICATIONS.LIST);
    console.log("NOTIFICAL LISY DAYA", data)
    return data;
}

export const markNotificationsAsSeen = async () =>{
    const {data} = await apiClient.post(API_ENDPOINTS.NOTIFICATIONS.SEEN)
     console.log("SEEN SEEEN DAYA", data)
    return data;
}