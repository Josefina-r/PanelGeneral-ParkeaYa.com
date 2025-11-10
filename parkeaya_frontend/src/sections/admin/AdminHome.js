import React, { useState, useEffect } from 'react';
import './AdminHome.css';

const AdminHome = ({ stats, userRole }) => {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('today');
  const [error, setError] = useState(null);

  const API_BASE = 'http://localhost:8000/api';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  useEffect(() => {
    loadAdminDashboard();
  }, [timeRange]);

  const loadAdminDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Cargando dashboard admin desde API real...');
      
      const response = await fetch(`${API_BASE}/users/admin/dashboard/stats/`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      console.log('📊 Response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Datos reales recibidos:', data);
        setDashboardData(data);
      } else if (response.status === 401) {
        setError('Error de autenticación. Por favor, vuelve a iniciar sesión.');
      } else if (response.status === 403) {
        setError('No tienes permisos para acceder al dashboard administrativo.');
      } else {
        setError(`Error ${response.status} al cargar el dashboard`);
      }
    } catch (error) {
      console.error('💥 Error cargando dashboard:', error);
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (action) => {
    // Estas acciones navegacion
    switch(action) {
      case 'approve_owners':
        alert('Navegando a aprobación de owners...');
    
        break;
      case 'view_reports':
        alert('Navegando a reportes...');
        
        break;
      case 'manage_parkings':
        alert('Navegando a gestión de estacionamientos...');
        
        break;
      default:
        break;
    }
  };

  const handleRetry = () => {
    loadAdminDashboard();
  };

  if (loading) {
    return (
      <div className="admin-home-loading">
        <div className="loading-spinner"></div>
        <p>Cargando Dashboard Administrativo...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-home-error">
        <div className="error-content">
          <i className="fas fa-exclamation-triangle"></i>
          <h3>Error al cargar el dashboard</h3>
          <p>{error}</p>
          <button onClick={handleRetry} className="retry-btn">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-home">
      {/*  HEADER CON TÍTULO Y FILTROS */}
      <div className="admin-header">
        <div className="header-content">
          <h1>Panel de Control Administrativo</h1>
          <p>Gestión global de la plataforma Parkeaya</p>
          <div className="last-update">
            <i className="fas fa-sync-alt"></i>
            Actualizado hace 5 min
          </div>
        </div>
        <div className="header-actions">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className="time-filter"
          >
            <option value="today">Hoy</option>
            <option value="week">Esta Semana</option>
            <option value="month">Este Mes</option>
            <option value="year">Este Año</option>
          </select>
          <button onClick={loadAdminDashboard} className="refresh-btn">
            <i className="fas fa-sync"></i>
            Actualizar
          </button>
        </div>
      </div>

      {/*  ESTADÍSTICAS PRINCIPALES */}
      <div className="stats-grid">
        <div className="stat-card primary">
          <div className="stat-icon">
            <i className="fas fa-users"></i>
          </div>
          <div className="stat-content">
            <h3>{dashboardData?.total_users || 0}</h3>
            <p>Usuarios Totales</p>
            <span className="stat-trend">
              {dashboardData?.active_users || 0} activos
            </span>
          </div>
        </div>

        <div className="stat-card success">
          <div className="stat-icon">
            <i className="fas fa-user-tie"></i>
          </div>
          <div className="stat-content">
            <h3>{dashboardData?.total_owners || 0}</h3>
            <p>Dueños de Estacionamientos</p>
            <span className="stat-trend">
              {((dashboardData?.total_owners / dashboardData?.total_users) * 100).toFixed(1)}% del total
            </span>
          </div>
        </div>

        <div className="stat-card warning">
          <div className="stat-icon">
            <i className="fas fa-users-cog"></i>
          </div>
          <div className="stat-content">
            <h3>{dashboardData?.users_by_role?.admin || 0}</h3>
            <p>Administradores</p>
            <span className="stat-trend">
              Gestión del Sistema
            </span>
          </div>
        </div>

        <div className="stat-card info">
          <div className="stat-icon">
            <i className="fas fa-user-friends"></i>
          </div>
          <div className="stat-content">
            <h3>{dashboardData?.total_clients || 0}</h3>
            <p>Clientes Registrados</p>
            <span className="stat-trend">
              {((dashboardData?.total_clients / dashboardData?.total_users) * 100).toFixed(1)}% del total
            </span>
          </div>
        </div>
      </div>

      {/*  DISTRIBUCIÓN DE USUARIOS */}
      <div className="users-distribution">
        <h2>Distribución de Usuarios por Rol</h2>
        <div className="distribution-cards">
          <div className="distribution-card admin">
            <div className="card-header">
              <i className="fas fa-user-shield"></i>
              <h3>Administradores</h3>
            </div>
            <div className="card-body">
              <div className="percentage">
                {((dashboardData?.users_by_role?.admin / dashboardData?.total_users) * 100).toFixed(1)}%
              </div>
              <div className="count">{dashboardData?.users_by_role?.admin} usuarios</div>
            </div>
          </div>
          <div className="distribution-card owner">
            <div className="card-header">
              <i className="fas fa-user-tie"></i>
              <h3>Dueños</h3>
            </div>
            <div className="card-body">
              <div className="percentage">
                {((dashboardData?.users_by_role?.owner / dashboardData?.total_users) * 100).toFixed(1)}%
              </div>
              <div className="count">{dashboardData?.users_by_role?.owner} usuarios</div>
            </div>
          </div>
          <div className="distribution-card client">
            <div className="card-header">
              <i className="fas fa-user"></i>
              <h3>Clientes</h3>
            </div>
            <div className="card-body">
              <div className="percentage">
                {((dashboardData?.users_by_role?.client / dashboardData?.total_users) * 100).toFixed(1)}%
              </div>
              <div className="count">{dashboardData?.users_by_role?.client} usuarios</div>
            </div>
          </div>
        </div>
      </div>

      <div className="quick-actions-section">
        <h2>Acciones Rápidas</h2>
        <div className="quick-actions-grid">
          <button 
            className="quick-action-btn approve"
            onClick={() => handleQuickAction('approve_owners')}
            disabled={!(dashboardData?.users_by_role?.owner > 0)}
          >
            <i className="fas fa-user-check"></i>
            <span>Aprobar Owners</span>
            <small>{dashboardData?.pending_approvals || 0} pendientes</small>
          </button>

          <button 
            className="quick-action-btn reports"
            onClick={() => handleQuickAction('view_reports')}
          >
            <i className="fas fa-chart-bar"></i>
            <span>Ver Reportes</span>
            <small>Análisis detallado</small>
          </button>

          <button 
            className="quick-action-btn manage"
            onClick={() => handleQuickAction('manage_parkings')}
          >
            <i className="fas fa-map-marked-alt"></i>
            <span>Gestionar Parkings</span>
            <small>{dashboardData?.total_parkings || 0} activos</small>
          </button>

          <button className="quick-action-btn support">
            <i className="fas fa-headset"></i>
            <span>Soporte</span>
            <small>Tickets activos</small>
          </button>
        </div>
      </div>

      {/*  INFORMACIÓN ADICIONAL */}
      <div className="additional-info">
        <div className="info-card">
          <h3>Reservas Activas</h3>
          <div className="info-value">{dashboardData?.active_reservations || 0}</div>
          <div className="info-label">En este momento</div>
        </div>
        
        <div className="info-card">
          <h3>Ingresos Plataforma</h3>
          <div className="info-value">${(dashboardData?.platform_earnings || 0).toLocaleString()}</div>
          <div className="info-label">Comisiones hoy</div>
        </div>
        
        <div className="info-card">
          <h3>Incidencias</h3>
          <div className="info-value">{dashboardData?.active_violations || 0}</div>
          <div className="info-label">Reportes abiertos</div>
        </div>
      </div>

      {/*  DEBUG INFO (solo desarrollo) */}
      <div className="debug-info">
        <details>
          <summary>Debug Data</summary>
          <pre>{JSON.stringify(dashboardData, null, 2)}</pre>
        </details>
      </div>
    </div>
  );
};

export default AdminHome;