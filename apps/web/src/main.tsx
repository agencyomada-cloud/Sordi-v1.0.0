import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/inter/800.css";
import "./index.css";
import { App } from "./App";
import { AdminApp } from "./AdminApp";

// No client router in this app (it's a single-page marketing site) — /admin
// is the one exception, a separate internal tool mounted by pathname rather
// than pulling in react-router for a single extra route.
const RootComponent = window.location.pathname.startsWith("/admin") ? AdminApp : App;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootComponent />
  </StrictMode>
);
