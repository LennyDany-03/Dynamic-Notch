use serde::Serialize;
use windows::UI::Notifications::Management::{
    UserNotificationListener, UserNotificationListenerAccessStatus,
};
use windows::UI::Notifications::NotificationKinds;

#[derive(Serialize)]
pub struct WinNotification {
    pub id: String,
    pub app: String,
    pub message: String,
    pub time: String,
    pub unread: bool,
}

#[tauri::command]
pub async fn get_windows_notifications() -> Result<Vec<WinNotification>, String> {
    let listener = UserNotificationListener::Current()
        .map_err(|e| format!("Failed to get listener: {}", e))?;

    let access_status = listener.GetAccessStatus()
        .map_err(|e| format!("Failed to get access status: {}", e))?;

    if access_status != UserNotificationListenerAccessStatus::Allowed {
        let _ = listener
            .RequestAccessAsync()
            .map_err(|e| format!("Failed to request access: {}", e))?
            .get()
            .map_err(|e| format!("Failed to await access request: {}", e))?;
    }

    // Refresh access status
    let access_status = listener.GetAccessStatus()
        .map_err(|e| format!("Failed to get access status: {}", e))?;

    if access_status != UserNotificationListenerAccessStatus::Allowed {
        return Err("Permission denied for Windows notifications".to_string());
    }

    let notifications = listener
        .GetNotificationsAsync(NotificationKinds::Toast)
        .map_err(|e| format!("Failed to get notifications: {}", e))?
        .get()
        .map_err(|e| format!("Failed to await notifications: {}", e))?;

    let mut result = Vec::new();
    for notification in notifications {
        let id = notification.Id().map(|id| id.to_string()).unwrap_or_default();
        
        let app = notification
            .AppInfo()
            .and_then(|info| info.DisplayInfo())
            .and_then(|display| display.DisplayName())
            .map(|name| name.to_string())
            .unwrap_or_else(|_| "Unknown".to_string());

        let mut message = String::new();
        if let Ok(toast_binding) = notification.Notification().and_then(|n| n.Visual()).and_then(|v| {
            v.GetBinding(&windows::UI::Notifications::KnownNotificationBindings::ToastGeneric()?)
        }) {
            if let Ok(text_elements) = toast_binding.GetTextElements() {
                let mut texts = Vec::new();
                for text in text_elements {
                    if let Ok(t) = text.Text() {
                        texts.push(t.to_string());
                    }
                }
                if texts.len() > 1 {
                    message = format!("{}: {}", texts[0], texts[1..].join(" "));
                } else if !texts.is_empty() {
                    message = texts[0].clone();
                }
            }
        }

        if message.is_empty() {
            continue;
        }

        result.push(WinNotification {
            id,
            app,
            message,
            time: "now".to_string(),
            unread: true,
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn dismiss_notification(id: u32) -> Result<(), String> {
    let listener = UserNotificationListener::Current()
        .map_err(|e| format!("Failed to get listener: {}", e))?;
        
    listener.RemoveNotification(id)
        .map_err(|e| format!("Failed to remove notification {}: {}", id, e))?;
        
    Ok(())
}

#[tauri::command]
pub async fn clear_all_notifications() -> Result<(), String> {
    let listener = UserNotificationListener::Current()
        .map_err(|e| format!("Failed to get listener: {}", e))?;
        
    let notifications = listener
        .GetNotificationsAsync(NotificationKinds::Toast)
        .map_err(|e| format!("Failed to get notifications: {}", e))?
        .get()
        .map_err(|e| format!("Failed to await notifications: {}", e))?;
        
    for notification in notifications {
        if let Ok(id) = notification.Id() {
            let _ = listener.RemoveNotification(id);
        }
    }
    
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_get_notifications() {
        match get_windows_notifications().await {
            Ok(notifs) => {
                println!("SUCCESS: found {} notifications", notifs.len());
            }
            Err(e) => {
                println!("ERROR: {}", e);
            }
        }
    }
}

