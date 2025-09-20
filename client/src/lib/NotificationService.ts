// NotificationService for instant notifications
export class NotificationService {
  private static permission: NotificationPermission = 'default';

  static async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      this.permission = 'granted';
      return true;
    }

    if (Notification.permission === 'denied') {
      this.permission = 'denied';
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      this.permission = permission;
      return permission === 'granted';
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }

  static async showNotification(
    title: string,
    options: {
      body?: string;
      icon?: string;
      badge?: string;
      tag?: string;
      silent?: boolean;
      timestamp?: number;
    } = {}
  ): Promise<void> {
    if (!('Notification' in window)) {
      return;
    }

    if (this.permission !== 'granted') {
      const granted = await this.requestPermission();
      if (!granted) return;
    }

    // Don't show notification if page is visible and focused
    if (document.visibilityState === 'visible' && document.hasFocus()) {
      return;
    }

    const defaultOptions = {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      silent: false,
      timestamp: Date.now(),
      ...options,
    };

    try {
      const notification = new Notification(title, defaultOptions);

      // Auto close after 5 seconds
      setTimeout(() => {
        notification.close();
      }, 5000);

      // Handle click - focus window
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        notification.close();
      };
    } catch (error) {
      console.error('Error showing notification:', error);
    }
  }

  static showMessageNotification(senderName: string, message: string, isFile: boolean = false) {
    const title = `New message from ${senderName} - SwiftTalk`;
    const body = isFile ? 'Sent you a file' : message.length > 100 ? message.substring(0, 97) + '...' : message;
    
    this.showNotification(title, {
      body,
      tag: `message-${senderName}`, // Replace existing notifications from same sender
      icon: '/favicon.ico',
    });
  }

  static showFriendRequestNotification(senderName: string) {
    this.showNotification(`New friend request - SwiftTalk`, {
      body: `${senderName} wants to be your friend`,
      tag: 'friend-request',
      icon: '/favicon.ico',
    });
  }

  static showFriendOnlineNotification(friendName: string) {
    this.showNotification(`${friendName} is now online - SwiftTalk`, {
      body: `${friendName} just came online`,
      tag: `friend-online-${friendName}`,
      icon: '/favicon.ico',
      silent: true, // Less intrusive for status changes
    });
  }

  static getPermissionStatus(): NotificationPermission {
    return this.permission;
  }

  static isSupported(): boolean {
    return 'Notification' in window;
  }
}