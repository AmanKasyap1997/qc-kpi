import axios, { AxiosInstance } from 'axios';
import { API_URL } from '../../config';

// Create axios instance with base configuration
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    // 'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 30000,
});