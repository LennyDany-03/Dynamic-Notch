import React from "react";
import ReactDOM from "react-dom/client";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import TrayMenu from "./components/tray/TrayMenu";
import SettingsWindow from "./components/settings/SettingsWindow";
import "./index.css";

// Every window loads this same bundle; the label decides which surface mounts.
//
// The default arm is deliberately a catch-all rather than a `notch-widget` case:
// it covers the browser fallback, which has no label, *and* the mirror windows
// `display.rs` builds on the other screens (`notch-widget-2`, `-3`, …), which are
// full instances of the notch and differ from the original only in that `App`
// leaves the auto-updater to the lead window. Naming the label here would mean
// remembering to widen it every time a second screen was involved.
/**
 * This window's label, or `null` where there is no Tauri to ask.
 *
 * `getCurrentWindow()` reads `window.__TAURI_INTERNALS__.metadata`, which does
 * not exist in a plain browser — so the unguarded call threw before `Surface`
 * rendered anything at all, and `npm run dev` mounted an empty root with one
 * console error. That is the browser fallback the architecture notes describe as
 * the way to work on layout and animation without a Rust rebuild, so it is worth
 * a try/catch. `App` already guards the identical call for `isLeadNotch`.
 *
 * Read once at module scope: the label cannot change under a running window.
 */
const windowLabel = (() => {
  try {
    return getCurrentWindow().label
  } catch {
    return null
  }
})()

function Surface() {
  switch (windowLabel) {
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
