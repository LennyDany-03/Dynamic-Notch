import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import TrayMenu from "./components/tray/TrayMenu";
import SettingsWindow from "./components/settings/SettingsWindow";
import "./index.css";

// Every window loads this same bundle; the label decides which surface mounts.
// The default arm also covers the browser fallback, where there is no label.
function Surface() {
  switch (getCurrentWindow().label) {
    case "tray-menu":
      return <TrayMenu />;
    case "settings":
      return <SettingsWindow />;
    default:
      return <App />;
  }
}

// WebView2 serves the Chromium menu (Back, Print, Inspect) on right-click, which
// can navigate the overlay somewhere it has no way back from. Suppressed at the
// document so no surface can miss it; the notch draws its own menu instead.
document.addEventListener("contextmenu", (event) => event.preventDefault());

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Surface />
  </React.StrictMode>,
);
