import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import TrayMenu from "./components/tray/TrayMenu";
import "./index.css";

// Both windows load this same bundle; the label decides which surface mounts.
const isTrayMenu = getCurrentWindow().label === "tray-menu";

// WebView2 serves the Chromium menu (Back, Print, Inspect) on right-click, which
// can navigate the overlay somewhere it has no way back from. Suppressed at the
// document so no surface can miss it; the notch draws its own menu instead.
document.addEventListener("contextmenu", (event) => event.preventDefault());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{isTrayMenu ? <TrayMenu /> : <App />}</React.StrictMode>,
);
