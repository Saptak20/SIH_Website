import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SimulationEvent, simulationService } from '../core/simulationService';

interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  timestamp: Date;
  isRead: boolean;
  autoRemove?: boolean;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => void;
  removeNotification: (id: string) => void;
  markAsRead: (id: string) => void;
  clearAll: () => void;
  unreadCount: number;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'isRead'>) => {
    const newNotification: Notification = {
      ...notification,
      id: `notification_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      isRead: false
    };

    setNotifications(prev => [newNotification, ...prev]);

    // Auto-remove after 5 seconds if specified
    if (notification.autoRemove !== false) {
      setTimeout(() => {
        removeNotification(newNotification.id);
      }, 5000);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, isRead: true } : n)
    );
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  // Listen to simulation events
  useEffect(() => {
    const unsubscribe = simulationService.onEvent((event: SimulationEvent) => {
      const notificationType = getNotificationTypeFromEvent(event.type);
      
      addNotification({
        type: notificationType,
        title: getNotificationTitle(event.type),
        message: event.message,
        autoRemove: event.type !== 'emergency' // Keep emergency notifications visible
      });
    });

    return unsubscribe;
  }, []);

  const value: NotificationContextType = {
    notifications,
    addNotification,
    removeNotification,
    markAsRead,
    clearAll,
    unreadCount
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

// Helper functions
const getNotificationTypeFromEvent = (eventType: SimulationEvent['type']): Notification['type'] => {
  switch (eventType) {
    case 'emergency':
      return 'error';
    case 'delay':
      return 'warning';
    case 'completed':
      return 'success';
    case 'started':
    case 'milestone':
    case 'stopped':
      return 'info';
    default:
      return 'info';
  }
};

const getNotificationTitle = (eventType: SimulationEvent['type']): string => {
  switch (eventType) {
    case 'started':
      return 'Journey Started';
    case 'stopped':
      return 'Journey Stopped';
    case 'emergency':
      return 'Emergency Alert';
    case 'delay':
      return 'Delay Notification';
    case 'completed':
      return 'Journey Completed';
    case 'milestone':
      return 'Milestone Reached';
    default:
      return 'Bus Update';
  }
};
