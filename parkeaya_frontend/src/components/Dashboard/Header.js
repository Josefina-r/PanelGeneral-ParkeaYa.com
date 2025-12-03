import React, { useState, useEffect } from 'react';
import './Header.css';
import API_BASE from '../../config';

function Header({ user, onToggleSidebar, onLogout, stats }) {
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const getAuthHeaders = (includeJson = true) => {
    const token = localStorage.getItem('access_token');
    const headers = {};
    if (includeJson) headers['Content-Type'] = 'application/json';
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE}/notifications/`, {
        method: 'GET',
        headers: getAuthHeaders(false)
      });

      if (response.status === 401 || response.status === 403) {
        // Token inválido o sin permisos: forzar logout si se pasó la función
        if (typeof onLogout === 'function') onLogout();
        setLoading(false);
        return;
      }

      if (response.ok) {
        const data = await response.json();
        
        const formattedNotifications = data.results?.map(notification => ({
          id: notification.id,
          type: notification.type || 'info',
          title: notification.title,
          message: notification.message,
          time: formatTime(notification.created_at),
          read: notification.read,
          icon: notification.icon || getNotificationIcon(notification.type),
          source: notification.source,
          action_url: notification.action_url
        })) || [];

        setNotifications(formattedNotifications);
        setUnreadCount(formattedNotifications.filter(n => !n.read).length);
      } else {
        console.error('Error cargando notificaciones:', response.status);
      }
    } catch (error) {
      console.error('Error cargando notificaciones:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Reciente';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours} h`;
    if (diffDays < 7) return `Hace ${diffDays} d`;
    
    return date.toLocaleDateString('es-ES');
  };

  const getNotificationIcon = (type) => {
    const icons = {
      info: 'fas fa-info-circle',
      success: 'fas fa-check-circle',
      warning: 'fas fa-exclamation-triangle',
      error: 'fas fa-times-circle',
      reservation: 'fas fa-calendar-check',
      payment: 'fas fa-dollar-sign',
      user: 'fas fa-user',
      system: 'fas fa-cog',
      parking: 'fas fa-parking'
    };
    return icons[type] || 'fas fa-bell';
  };

  const toggleNotifications = () => {
    setShowNotifications(!showNotifications);
  };

  const markAsRead = async (notificationId) => {
    try {
      const response = await fetch(`${API_BASE}/notifications/${notificationId}/mark_read/`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const updatedNotifications = notifications.map(notification =>
          notification.id === notificationId ? { ...notification, read: true } : notification
        );
        setNotifications(updatedNotifications);
        setUnreadCount(updatedNotifications.filter(n => !n.read).length);
      }
    } catch (error) {
      console.error('Error marcando notificación como leída:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const response = await fetch(`${API_BASE}/notifications/mark_all_read/`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const updatedNotifications = notifications.map(notification => ({
          ...notification,
          read: true
        }));
        setNotifications(updatedNotifications);
        setUnreadCount(0);
      }
    } catch (error) {
      console.error('Error marcando todas como leídas:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    if (notification.action_url) {
      window.location.href = notification.action_url;
    } else {
      switch(notification.type) {
        case 'reservation':
          window.location.href = '/sections/reservations';
          break;
        case 'payment':
          window.location.href = '/sections/payments';
          break;
        case 'user':
          window.location.href = '/sections/users';
          break;
        case 'parking':
          window.location.href = '/sections/parking';
          break;
        default:
          break;
      }
    }
    
    setShowNotifications(false);
  };

  const deleteNotification = async (notificationId, event) => {
    event.stopPropagation();
    
    try {
      const response = await fetch(`${API_BASE}/notifications/${notificationId}/`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        setNotifications(notifications.filter(n => n.id !== notificationId));
        setUnreadCount(prev => notifications.find(n => n.id === notificationId && !n.read) ? prev - 1 : prev);
      }
    } catch (error) {
      console.error('Error eliminando notificación:', error);
    }
  };

  return (
    <header className="dashboard-header">
      <div className="header-left">
        <button className="sidebar-toggle" onClick={onToggleSidebar}>
          <i className="fas fa-bars"></i>
        </button>
        <h1 className="page-title">Panel de Administración</h1>
      </div>
      
      <div className="header-right">
        <div className="notifications-container">
          <button 
            className="notification-btn" 
            onClick={toggleNotifications}
            disabled={loading}
          >
            <i className="fas fa-bell"></i>
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount}</span>
            )}
            {loading && <div className="notification-loading"></div>}
          </button>

          {showNotifications && (
            <div className="notifications-dropdown">
              <div className="notifications-header">
                <h3>Notificaciones</h3>
                <div className="notifications-actions">
                  {unreadCount > 0 && (
                    <button 
                      className="mark-all-read"
                      onClick={markAllAsRead}
                    >
                      Marcar todas como leídas
                    </button>
                  )}
                  <button 
                    className="refresh-notifications"
                    onClick={loadNotifications}
                    disabled={loading}
                  >
                    <i className="fas fa-sync"></i>
                  </button>
                </div>
              </div>
              
              <div className="notifications-list">
                {notifications.length > 0 ? (
                  notifications.map(notification => (
                    <div 
                      key={notification.id}
                      className={`notification-item ${!notification.read ? 'unread' : ''}`}
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="notification-icon">
                        <i className={notification.icon}></i>
                      </div>
                      <div className="notification-content">
                        <div className="notification-title">
                          {notification.title}
                        </div>
                        <div className="notification-message">
                          {notification.message}
                        </div>
                        <div className="notification-meta">
                          <span className="notification-time">
                            {notification.time}
                          </span>
                          {notification.source && (
                            <span className="notification-source">
                              • {notification.source}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="notification-actions">
                        {!notification.read && (
                          <div className="unread-dot" title="No leída"></div>
                        )}
                        <button 
                          className="delete-notification"
                          onClick={(e) => deleteNotification(notification.id, e)}
                          title="Eliminar"
                        >
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="no-notifications">
                    <i className="fas fa-bell-slash"></i>
                    <p>No hay notificaciones</p>
                  </div>
                )}
              </div>
              
              <div className="notifications-footer">
                <button 
                  className="view-all-btn"
                  onClick={() => window.location.href = '/dashboard/notifications'}
                >
                  Ver todas las notificaciones
                </button>
              </div>
            </div>
          )}
        </div>
        
        <div className="user-menu">
          <div className="user-info">
            <div className="user-avatar">
              <i className="fas fa-user"></i>
            </div>
            <div className="user-details">
              <div className="user-name">{user?.username || 'Usuario'}</div>
              <div className="user-role">
                {user?.is_staff ? 'Administrador' : 
                 user?.owner_profile?.is_owner ? 'Dueño' : 'Cliente'}
              </div>
            </div>
          </div>
          <button className="logout-btn" onClick={onLogout}>
            <i className="fas fa-sign-out-alt"></i>
            Cerrar Sesión
          </button>
        </div>
      </div>
    </header>
  );
}

export default Header;
