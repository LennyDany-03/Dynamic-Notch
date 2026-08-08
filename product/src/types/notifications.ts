/** Mirrors `WinNotification` in `src-tauri/src/notifications.rs`. */
export interface WinNotification {
  /** The notification centre's own id. Stable for as long as it is in the centre. */
  id: string
  /** Display name of the app that raised it, e.g. "Slack". */
  app: string
  /** AUMID of that app. Empty when Windows will not say. */
  appId: string
  /** Title and body joined as "title: body", or whichever of the two exists. */
  message: string
  time: string
  unread: boolean
}
