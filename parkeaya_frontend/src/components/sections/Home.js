/*import React, { useState, useEffect } from 'react';
import './Home.css';

function Home({ stats, dashboardData }) {
  const [localDashboardData, setLocalDashboardData] = useState({
    totalUsers: 0,
    activeParkings: 0,
    todayReservations: 0,
    totalRevenue: 0,
    pendingViolations: 0,
    availableSpots: 0
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_BASE = 'http://localhost:8000/api';

  // CORRECCIÓN: Cambiar Bearer por Token
  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Token ${token}` // CAMBIADO: Bearer → Token
    };
  };

  useEffect(() => {
    // Usar datos del dashboard principal si están disponibles
    if (dashboardData && dashboardData.stats) {
      console.log('✅ Usando datos del dashboard principal:', dashboardData);
      setLocalDashboardData({
        totalUsers: dashboardData.stats.total_users || 0,
        activeParkings: dashboardData.stats.active_parkings || 0,
        todayReservations: dashboardData.stats.active_reservations || 0,
        totalRevenue: dashboardData.stats.today_revenue || 0,
        pendingViolations: 0,
        availableSpots: dashboardData.stats.available_spaces || 0
      });
      setLoading(false);
    } else if (stats) {
      // Usar stats globales como fallback
      console.log('🔄 Usando stats globales como fallback:', stats);
      setLocalDashboardData({
        totalUsers: stats.totalUsers || 0,
        activeParkings: stats.availableParkings || 0,
        todayReservations: stats.activeReservations || 0,
        totalRevenue: stats.totalRevenue || 0,
        pendingViolations: 0,
        availableSpots: 0
      });
      setLoading(false);
    } else {
      // Cargar datos manualmente
      loadRealData();
    }
  }, [stats, dashboardData]);

  const loadRealData = async () => {
    try {
      setLoading(true);
      console.log('🔄 Cargando datos reales...');

      // CORRECCIÓN: Cambiar la URL de parking
      const [
        usersResponse,
        parkingsResponse,
        reservationsResponse,
        paymentsResponse,
        recentReservationsResponse
      ] = await Promise.all([
        fetch(`${API_BASE}/users/users/`, { headers: getAuthHeaders() }),
        // CAMBIADO: parking/parking/ → parking/parkinglots/
        fetch(`${API_BASE}/parking/parkinglots/?available=true`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/reservations/?fecha_reserva=${new Date().toISOString().split('T')[0]}`, { 
          headers: getAuthHeaders() 
        }),
        fetch(`${API_BASE}/payments/`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/parking/admin/recent-reservations/`, { headers: getAuthHeaders() })
      ]);

      console.log('📊 Responses:', {
        users: usersResponse.status,
        parkings: parkingsResponse.status,
        reservations: reservationsResponse.status,
        payments: paymentsResponse.status,
        recent: recentReservationsResponse.status
      });

      const usersData = usersResponse.ok ? await usersResponse.json() : [];
      const parkingsData = parkingsResponse.ok ? await parkingsResponse.json() : [];
      const reservationsData = reservationsResponse.ok ? await reservationsResponse.json() : [];
      const paymentsData = paymentsResponse.ok ? await paymentsResponse.json() : [];
      const recentReservations = recentReservationsResponse.ok ? await recentReservationsResponse.json() : [];

      console.log('📦 Datos recibidos:', {
        users: usersData.length || usersData.count,
        parkings: parkingsData.length || parkingsData.count,
        reservations: reservationsData.length || reservationsData.count,
        payments: paymentsData.length || paymentsData.count,
        recentReservations: recentReservations.length
      });

      const totalRevenue = paymentsData.reduce((sum, payment) => sum + (parseFloat(payment.monto) || 0), 0);
      
      setLocalDashboardData({
        totalUsers: usersData.count || usersData.length || 0,
        activeParkings: parkingsData.count || parkingsData.length || 0,
        todayReservations: reservationsData.count || reservationsData.length || 0,
        totalRevenue: totalRevenue,
        pendingViolations: 0,
        availableSpots: Array.isArray(parkingsData) ? 
          parkingsData.reduce((sum, parking) => sum + (parseInt(parking.plazas_disponibles) || 0), 0) : 0
      });

      // Procesar actividad reciente
      const activity = Array.isArray(recentReservations) ? 
        recentReservations.slice(0, 5).map(reservation => ({
          type: 'reservation',
          user: reservation.usuario?.username || 'Usuario',
          time: formatTime(new Date(reservation.fecha_creacion || reservation.fecha_reserva || reservation.hora_entrada)),
          details: `Reserva ${reservation.estado || 'confirmada'}`,
          reservation
        })) : [];

      setRecentActivity(activity);

    } catch (error) {
      console.error('💥 Error loading real data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (date) => {
    if (!date || isNaN(date.getTime())) return 'Reciente';
    
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    
    if (diffMins < 60) {
      return `Hace ${diffMins} min`;
    } else if (diffHours < 24) {
      return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    } else {
      return date.toLocaleDateString();
    }
  };

  const handleQuickAction = (action) => {
    switch(action) {
      case 'users':
        window.location.href = '/dashboard/users';
        break;
      case 'reservations':
        window.location.href = '/dashboard/reservations';
        break;
      case 'violations':
        window.location.href = '/dashboard/violations';
        break;
      case 'reports':
        generateReport();
        break;
      default:
        break;
    }
  };

  const generateReport = async () => {
    try {
      const response = await fetch(`${API_BASE}/parking/admin/dashboard-stats/`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        alert(`📊 Reporte generado:\nUsuarios: ${data.totalUsers}\nIngresos: $${data.totalRevenue}`);
      }
    } catch (error) {
      console.error('Error generating report:', error);
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Cargando datos en tiempo real...</p>
      </div>
    );
  }

  return (
    <div className="home-section">
      <div className="section-header">
        <h2>Dashboard Principal</h2>
        <p>Datos en tiempo real del sistema Parkeaya</p>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon users">
            <i className="fas fa-users"></i>
          </div>
          <div className="stat-content">
            <h3>Usuarios Totales</h3>
            <div className="stat-number">{localDashboardData.totalUsers}</div>
            <div className="stat-change positive">
              {Math.round(localDashboardData.totalUsers * 0.1)} este mes
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon parking">
            <i className="fas fa-parking"></i>
          </div>
          <div className="stat-content">
            <h3>Estacionamientos Activos</h3>
            <div className="stat-number">{localDashboardData.activeParkings}</div>
            <div className="stat-change positive">
              {Math.round(localDashboardData.activeParkings * 0.05)} disponibles
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon reservations">
            <i className="fas fa-calendar-check"></i>
          </div>
          <div className="stat-content">
            <h3>Reservas Hoy</h3>
            <div className="stat-number">{localDashboardData.todayReservations}</div>
            <div className="stat-change positive">
              +{Math.round(localDashboardData.todayReservations * 0.2)}% vs ayer
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon revenue">
            <i className="fas fa-dollar-sign"></i>
          </div>
          <div className="stat-content">
            <h3>Ingresos Totales</h3>
            <div className="stat-number">${localDashboardData.totalRevenue.toLocaleString()}</div>
            <div className="stat-change positive">
              +{Math.round((localDashboardData.totalRevenue / 1000) * 15)}% este mes
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon violations">
            <i className="fas fa-exclamation-triangle"></i>
          </div>
          <div className="stat-content">
            <h3>Infracciones</h3>
            <div className="stat-number">{localDashboardData.pendingViolations}</div>
            <div className="stat-change negative">
              {localDashboardData.pendingViolations > 0 ? 'Por revisar' : 'Todo en orden'}
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon spots">
            <i className="fas fa-car"></i>
          </div>
          <div className="stat-content">
            <h3>Espacios Libres</h3>
            <div className="stat-number">{localDashboardData.availableSpots}</div>
            <div className="stat-change">
              {localDashboardData.availableSpots > 10 ? 'Disponibles' : 'Pocos espacios'}
            </div>
          </div>
        </div>
      </div>

      <div className="content-grid">
        <div className="recent-activity">
          <div className="activity-header">
            <h3>Actividad Reciente</h3>
            <button onClick={loadRealData} className="refresh-btn">
              <i className="fas fa-sync-alt"></i>
              Actualizar
            </button>
          </div>
          <div className="activity-list">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <div key={index} className="activity-item">
                  <div className="activity-icon">
                    {activity.type === 'reservation' && <i className="fas fa-calendar-alt"></i>}
                    {activity.type === 'payment' && <i className="fas fa-credit-card"></i>}
                    {activity.type === 'violation' && <i className="fas fa-exclamation-circle"></i>}
                  </div>
                  <div className="activity-details">
                    <div className="activity-user">{activity.user}</div>
                    <div className="activity-description">{activity.details}</div>
                    {activity.reservation?.estacionamiento && (
                      <div className="activity-location">
                        {activity.reservation.estacionamiento.nombre}
                      </div>
                    )}
                  </div>
                  <div className="activity-time">{activity.time}</div>
                </div>
              ))
            ) : (
              <div className="no-activity">
                <div className="no-activity-icon">
                  <i className="fas fa-chart-bar"></i>
                </div>
                <p>No hay actividad reciente</p>
                <small>Las nuevas reservas aparecerán aquí</small>
              </div>
            )}
          </div>
        </div>

        <div className="quick-actions">
          <h3>Acciones Rápidas</h3>
          <div className="actions-grid">
            <button 
              className="action-btn primary"
              onClick={() => handleQuickAction('reservations')}
            >
              <span className="action-icon">
                <i className="fas fa-calendar-check"></i>
              </span>
              Gestionar Reservas
            </button>
            <button 
              className="action-btn secondary"
              onClick={() => handleQuickAction('users')}
            >
              <span className="action-icon">
                <i className="fas fa-users"></i>
              </span>
              Ver Usuarios
            </button>
            <button 
              className="action-btn warning"
              onClick={() => handleQuickAction('violations')}
            >
              <span className="action-icon">
                <i className="fas fa-exclamation-triangle"></i>
              </span>
              Infracciones
            </button>
            <button 
              className="action-btn success"
              onClick={() => handleQuickAction('reports')}
            >
              <span className="action-icon">
                <i className="fas fa-chart-line"></i>
              </span>
              Generar Reporte
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;*/