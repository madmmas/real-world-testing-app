import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./auth";
import { AdminAnalytics, AdminFlags } from "./flags";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AdminFlags>
      <BrowserRouter>
        <AuthProvider>
          <AdminAnalytics />
          <App />
        </AuthProvider>
      </BrowserRouter>
    </AdminFlags>
  </React.StrictMode>
);
