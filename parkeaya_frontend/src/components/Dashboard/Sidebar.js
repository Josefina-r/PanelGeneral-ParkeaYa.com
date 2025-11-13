import React from 'react';
import './Sidebar.css';

//  CONFIGURACIÓN DE MENÚS POR ROL
const getMenuItems = (userRole) => {
  const baseItems = {
    admin: [
      { 
        path: '/dashboard/home', 
        icon: 'fas fa-chart-line', 
        label: 'Dashboard General', 
        color: '#667eea',
        badge: 'stats'
      },
      { 
        path: '/dashboard/users', 
        icon: 'fas fa-users-cog', 
        label: 'Gestión de Usuarios', 
        color: '#ed8936',
        description: 'Clientes, Dueños, Admins'
      },
      { 
        path: '/dashboard/parking', 
        icon: 'fas fa-map-marked-alt', 
        label: 'Estacionamientos Global', 
        color: '#9f7aea',
        description: 'Aprobar/Editar/Suspender'
      },
      { 
        path: '/dashboard/reports', 
        icon: 'fas fa-chart-pie', 
        label: 'Analytics & Reportes', 
        color: '#48bb78',
        description: 'Métricas de Plataforma'
      },
      { 
        path: '/dashboard/finance', 
        icon: 'fas fa-money-bill-wave', 
        label: 'Gestión Financiera', 
        color: '#38b2ac',
        description: 'Comisiones & Pagos'
      },
      { 
        path: '/dashboard/system', 
        icon: 'fas fa-cogs', 
        label: 'Configuración Sistema', 
        color: '#f56565',
        description: 'Parámetros Globales'
      }
    ],
    owner: [
      { 
        path: '/dashboard/home', 
        icon: 'fas fa-tachometer-alt', 
        label: 'Mi Dashboard', 
        color: '#667eea',
        badge: 'stats'
      },
      { 
        path: '/dashboard/parking', 
        icon: 'fas fa-parking', 
        label: 'Mi Estacionamiento', 
        color: '#9f7aea',
        description: 'Configurar & Editar'
      },
      { 
        path: '/dashboard/reservations', 
        icon: 'fas fa-calendar-check', 
        label: 'Gestión Reservas', 
        color: '#48bb78',
        description: 'Activas & Futuras'
      },
      { 
        path: '/dashboard/reports', 
        icon: 'fas fa-chart-bar', 
        label: 'Reportes Locales', 
        color: '#ed8936',
        description: 'Ingresos & Ocupación'
      },
      { 
        path: '/dashboard/profile', 
        icon: 'fas fa-store', 
        label: 'Perfil de Negocio', 
        color: '#38b2ac',
        description: 'Configuración'
      }
    ]
  };
  
  return baseItems[userRole] || baseItems.owner;
};

//  ESTADÍSTICAS RÁPIDAS PARA BADGES
const getQuickStats = (stats, userRole) => {
  if (userRole === 'admin') {
    return {
      users: stats?.pendingApprovals || 0,
      parking: stats?.pendingParkings || 0,
      reservations: stats?.activeReservations || 0,
      violations: stats?.activeViolations || 0
    };
  } else {
    return {
      reservations: stats?.todayReservations || 0,
      occupancy: stats?.occupancyRate ? `${Math.round(stats.occupancyRate)}%` : '0%',
      revenue: stats?.todayRevenue || 0,
      available: stats?.availableSpots || 0
    };
  }
};

// Función para mapear paths a keys de permisos
const getSectionKey = (path) => {
  const pathMap = {
    '/dashboard/home': 'home',
    '/dashboard/users': 'users', 
    '/dashboard/parking': 'parking',
    '/dashboard/reports': 'reports',
    '/dashboard/finance': 'finance',
    '/dashboard/system': 'system',
    '/dashboard/reservations': 'reservations',
    '/dashboard/profile': 'ownerProfile'  // ← CLAVE CORREGIDA
  };
  return pathMap[path] || path.split('/').pop();
};

function Sidebar({ 
  isOpen, 
  currentPath, 
  onNavigate, 
  stats, 
  userRole, 
  userData,
  canAccessSection 
}) {
  const menuItems = getMenuItems(userRole);
  const quickStats = getQuickStats(stats, userRole);
  
  const getRoleDisplay = (role) => {
    const roles = {
      admin: { text: 'Administrador General', class: 'role-admin' },
      owner: { text: 'Propietario', class: 'role-owner' }
    };
    return roles[role] || { text: 'Usuario', class: 'role-user' };
  };

  const roleInfo = getRoleDisplay(userRole);

  return (
    <div className={`sidebar ${isOpen ? 'open' : 'closed'} ${userRole}`}>
      {/*  HEADER CON LOGO Y ROL */}
      <div className="sidebar-header">
        <div className="logo">
          <div className="logo-icon">
            <i className={`fas ${userRole === 'admin' ? 'fa-shield-alt' : 'fa-store'}`}></i>
          </div>
          {isOpen && (
            <div className="logo-content">
              <span className="logo-text">Parkeaya</span>
              <span className={`role-badge ${roleInfo.class}`}>
                {roleInfo.text}
              </span>
            </div>
          )}
        </div>
        
        {/*  ESTADÍSTICAS RÁPIDAS SOLO CUANDO ESTÁ ABIERTO */}
        {isOpen && stats && (
          <div className="quick-stats">
            {userRole === 'admin' ? (
              <>
                <div className="stat-item">
                  <span className="stat-value">{quickStats.users}</span>
                  <span className="stat-label">Aprobaciones Pendientes</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{quickStats.parking}</span>
                  <span className="stat-label">Est. por Revisar</span>
                </div>
              </>
            ) : (
              <>
                <div className="stat-item">
                  <span className="stat-value">{quickStats.reservations}</span>
                  <span className="stat-label">Reservas Hoy</span>
                </div>
                <div className="stat-item">
                  <span className="stat-value">{quickStats.occupancy}</span>
                  <span className="stat-label">Ocupación</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      
      {/*  MENÚ DE NAVEGACIÓN */}
      <nav className="sidebar-nav">
        {menuItems.map((item) => {
          const sectionKey = getSectionKey(item.path);
          const hasAccess = canAccessSection(sectionKey);
          
          return (
            <button
              key={item.path}
              className={`nav-item ${currentPath === item.path ? 'active' : ''} ${
                !hasAccess ? 'disabled' : ''
              }`}
              onClick={() => hasAccess && onNavigate(item.path)}
              style={{ 
                '--accent-color': item.color,
                borderLeftColor: currentPath === item.path ? item.color : 'transparent'
              }}
              disabled={!hasAccess}
            >
              <span className="nav-icon">
                <i className={item.icon}></i>
                {/*  BADGE PARA ESTADÍSTICAS EN HOME */}
                {item.badge === 'stats' && quickStats[item.badge] !== undefined && (
                  <span className="nav-badge">
                    {userRole === 'admin' ? '📊' : '🚀'}
                  </span>
                )}
              </span>
              
              {isOpen && (
                <div className="nav-content">
                  <span className="nav-label">{item.label}</span>
                  {item.description && (
                    <span className="nav-description">{item.description}</span>
                  )}
                </div>
              )}
              
              {/* INDICADOR DE ACTIVO */}
              {currentPath === item.path && (
                <div className="active-indicator"></div>
              )}
            </button>
          );
        })}
      </nav>
      
      {/*  FOOTER CON INFORMACIÓN DEL USUARIO */}
      <div className="sidebar-footer">
        <div className="user-info">
          <div className={`user-avatar ${userRole}`}>
            <i className={`fas ${
              userRole === 'admin' ? 'fa-crown' : 'fa-user-tie'
            }`}></i>
          </div>
          
          {isOpen && (
            <div className="user-details">
              <div className="user-name">
                {userData?.username || 'Usuario'}
                {userRole === 'admin' && (
                  <i className="fas fa-check-circle verified-badge"></i>
                )}
              </div>
              <div className={`user-role ${roleInfo.class}`}>
                {roleInfo.text}
              </div>
              <div className="user-status">
                <span className="status-dot online"></span>
                Conectado
              </div>
            </div>
          )}
        </div>
        
        {/*  ACCIONES RÁPIDAS */}
        {isOpen && (
          <div className="quick-actions">
            {userRole === 'admin' && (
              <button className="action-btn emergency">
                <i className="fas fa-exclamation-triangle"></i>
                <span>Panel Crítico</span>
              </button>
            )}
            {userRole === 'owner' && (
              <button className="action-btn support">
                <i className="fas fa-headset"></i>
                <span>Soporte</span>
              </button>
            )}
          </div>
        )}
      </div>
      
      {/*  INDICADOR VISUAL DEL ROL */}
      <div className={`role-indicator ${userRole}`}></div>
    </div>
  );
}

export default Sidebar;