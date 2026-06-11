import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./app";
import { AppProviders } from "./components/shared/Providers";
import "./index.css";
import { setupInterceptors } from "./services";
import 'primereact/resources/themes/lara-light-blue/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';

// Setup API interceptors
setupInterceptors();

// Get the root element
const rootElement = document.getElementById("root");

// Check if the element exists (optional but good practice)
if (!rootElement) {
  throw new Error("Failed to find the root element");
}

// Create root and render app
const root = createRoot(rootElement);

root.render(
  <StrictMode>
    <AppProviders>
      <App />
    </AppProviders>
  </StrictMode>
);
