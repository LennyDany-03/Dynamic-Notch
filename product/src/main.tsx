import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import TrayMenu from "./components/tray/TrayMenu";
import "./index.css";

// Both windows load this same bundle; the label decides which surface mounts.
const isTrayMenu = getCurrentWindow().label === "tray-menu";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>{isTrayMenu ? <TrayMenu /> : <App />}</React.StrictMode>,
);
