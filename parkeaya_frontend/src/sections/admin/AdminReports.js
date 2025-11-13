import React, { useState, useEffect } from 'react';
import './AdminReports.css';

const AdminReports = ({ userRole }) => {
  const [analyticsData, setAnalyticsData] = useState(null);
  const [revenueData, setRevenueData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('month');
  const [activeTab, setActiveTab] = useState('overview');

  const API_BASE = 'http://localhost:8000/api';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  useEffect(() => {
    loadAnalyticsData();
  }, [timeRange, activeTab]);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📊 Cargando datos de analytics...');
      
      // Cargar datos principales del dashboard admin
      const analyticsResponse = await fetch(`${API_BASE}/analytics/admin/dashboard/`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      console.log('📈 Response status analytics:', analyticsResponse.status);

      if (!analyticsResponse.ok) {
        throw new Error(`Error ${analyticsResponse.status} al cargar estadísticas`);
      }

      const data = await analyticsResponse.json();
      console.log('✅ Estadísticas cargadas:', data);
      setAnalyticsData(data);

      // Cargar datos específicos según la pestaña activa
      if (activeTab === 'revenue') {
        await loadRevenueData();
      }

      if (activeTab === 'users') {
        await loadUserData();
      }

    } catch (error) {
      console.error('💥 Error cargando analytics:', error);
      setError(error.message || 'Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const loadRevenueData = async () => {
    try {
      console.log('💰 Cargando datos de revenue...');
      
      const response = await fetch(`${API_BASE}/analytics/admin/revenue/`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      console.log('📊 Response status revenue:', response.status);

      if (!response.ok) {
        throw new Error(`Error ${response.status} al cargar datos de ingresos`);
      }

      const data = await response.json();
      console.log('✅ Datos de revenue:', data);
      setRevenueData(data);
    } catch (error) {
      console.error('Error cargando datos de ingresos:', error);
      setError(error.message);
    }
  };

  const loadUserData = async () => {
    try {
      console.log('👥 Cargando datos de usuarios...');
      
      const response = await fetch(`${API_BASE}/analytics/admin/users/`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      console.log('📊 Response status users:', response.status);

      if (!response.ok) {
        throw new Error(`Error ${response.status} al cargar datos de usuarios`);
      }

      const data = await response.json();
      console.log('✅ Datos de usuarios:', data);
      setUserData(data);
    } catch (error) {
      console.error('Error cargando datos de usuarios:', error);
      setError(error.message);
    }
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0';
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP'
    }).format(amount);
  };

  const formatNumber = (number) => {
    if (!number) return '0';
    return new Intl.NumberFormat('es-CO').format(number);
  };

  const handleExport = async (type) => {
    try {
      let endpoint = '';
      let filename = '';
      
      switch (type) {
        case 'revenue':
          endpoint = `${API_BASE}/analytics/admin/revenue/`;
          filename = 'revenue-report.csv';
          break;
        case 'users':
          endpoint = `${API_BASE}/analytics/admin/users/`;
          filename = 'user-analytics.csv';
          break;
        default:
          endpoint = `${API_BASE}/analytics/admin/dashboard/`;
          filename = 'analytics-report.csv';
      }

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error('Error al exportar datos');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

    } catch (error) {
      console.error('Error en exportación:', error);
      alert('Error al exportar el reporte');
    }
  };

  const renderChart = (chartData, dataKey = 'reservations') => {
    if (!chartData || !chartData.length) {
      return (
        <div className="no-data-placeholder">
          <i className="fas fa-chart-line"></i>
          <p>No hay datos disponibles para el período seleccionado</p>
        </div>
      );
    }

    const maxValue = Math.max(...chartData.map(item => item[dataKey] || 0));
    const displayData = chartData.slice(-7); // Últimos 7 días
    
    return (
      <div className="chart-container">
        <div className="chart-bars">
          {displayData.map((day, index) => (
            <div key={index} className="chart-bar-container">
              <div 
                className="chart-bar"
                style={{ 
                  height: `${((day[dataKey] || 0) / maxValue) * 100}%`,
                  backgroundColor: dataKey === 'revenue' ? '#28a745' : '#007bff'
                }}
                title={`${day[dataKey] || 0} ${dataKey === 'revenue' ? 'ingresos' : 'reservas'} - ${new Date(day.date).toLocaleDateString('es-CO')}`}
              ></div>
              <span className="chart-label">
                {new Date(day.date).toLocaleDateString('es', { weekday: 'short' })}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="admin-reports-loading">
        <div className="loading-spinner"></div>
        <p>Cargando reportes y analytics...</p>
      </div>
    );
  }

  return (
    <div className="admin-reports">
      {/* HEADER */}
      <div className="admin-reports-header">
        <div className="header-content">
          <h1>Reportes & Analytics</h1>
          <p>Métricas y análisis de la plataforma</p>
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
          <button onClick={loadAnalyticsData} className="refresh-btn">
            <i className="fas fa-sync"></i>
            Actualizar
          </button>
        </div>
      </div>

      {/* PESTAÑAS */}
      <div className="reports-tabs">
        <button 
          className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <i className="fas fa-chart-pie"></i>
          Resumen General
        </button>
        <button 
          className={`tab-btn ${activeTab === 'revenue' ? 'active' : ''}`}
          onClick={() => setActiveTab('revenue')}
        >
          <i className="fas fa-money-bill-wave"></i>
          Ingresos
        </button>
        <button 
          className={`tab-btn ${activeTab === 'users' ? 'active' : ''}`}
          onClick={() => setActiveTab('users')}
        >
          <i className="fas fa-users"></i>
          Usuarios
        </button>
        <button 
          className={`tab-btn ${activeTab === 'parkings' ? 'active' : ''}`}
          onClick={() => setActiveTab('parkings')}
        >
          <i className="fas fa-parking"></i>
          Estacionamientos
        </button>
      </div>

      {/* CONTENIDO POR PESTAÑA */}
      <div className="reports-content">
        {activeTab === 'overview' && (
          <div className="overview-tab">
            {/* MÉTRICAS PRINCIPALES */}
            <div className="metrics-grid">
              <div className="metric-card total-users">
                <div className="metric-icon">
                  <i className="fas fa-users"></i>
                </div>
                <div className="metric-content">
                  <h3>{formatNumber(analyticsData?.total_users || 0)}</h3>
                  <p>Total Usuarios</p>
                  <span className="metric-trend positive">
                    +{analyticsData?.user_growth || 0}%
                  </span>
                </div>
              </div>

              <div className="metric-card total-revenue">
                <div className="metric-icon">
                  <i className="fas fa-money-bill-wave"></i>
                </div>
                <div className="metric-content">
                  <h3>{formatCurrency(analyticsData?.total_revenue || 0)}</h3>
                  <p>Ingresos Totales</p>
                  <span className="metric-trend positive">
                    +{analyticsData?.revenue_growth || 0}%
                  </span>
                </div>
              </div>

              <div className="metric-card active-reservations">
                <div className="metric-icon">
                  <i className="fas fa-calendar-check"></i>
                </div>
                <div className="metric-content">
                  <h3>{formatNumber(analyticsData?.active_reservations || 0)}</h3>
                  <p>Reservas Activas</p>
                  <span className="metric-info">
                    Hoy: {analyticsData?.completed_today || 0}
                  </span>
                </div>
              </div>

              <div className="metric-card platform-earnings">
                <div className="metric-icon">
                  <i className="fas fa-chart-line"></i>
                </div>
                <div className="metric-content">
                  <h3>{formatCurrency(analyticsData?.platform_earnings || 0)}</h3>
                  <p>Ganancias Plataforma</p>
                  <span className="metric-info">
                    {analyticsData?.commission_rate || 30}% comisión
                  </span>
                </div>
              </div>
            </div>

            {/* TOP PERFORMERS */}
            <div className="top-performers-section">
              <div className="section-header">
                <h2>Estacionamientos Más Activos</h2>
                <button 
                  className="btn-export"
                  onClick={() => handleExport('overview')}
                >
                  <i className="fas fa-download"></i>
                  Exportar
                </button>
              </div>
              <div className="performers-grid">
                {(analyticsData?.top_parkings || []).map((parking, index) => (
                  <div key={parking.id} className="performer-card">
                    <div className="performer-rank">
                      <span className={`rank-badge rank-${index + 1}`}>
                        #{index + 1}
                      </span>
                    </div>
                    <div className="performer-info">
                      <h4>{parking.name}</h4>
                      <p>Propietario: {parking.owner_name}</p>
                      <div className="performer-stats">
                        <span className="reservations">
                          <i className="fas fa-calendar"></i>
                          {parking.reservations_count} reservas
                        </span>
                        <span className="earnings">
                          <i className="fas fa-money-bill"></i>
                          {formatCurrency(parking.total_earnings)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {(!analyticsData?.top_parkings || analyticsData.top_parkings.length === 0) && (
                  <div className="no-data-placeholder">
                    <i className="fas fa-parking"></i>
                    <p>No hay datos de estacionamientos disponibles</p>
                  </div>
                )}
              </div>
            </div>

            {/* GRÁFICO DE TENDENCIAS */}
            <div className="charts-section">
              <div className="section-header">
                <h2>Tendencia de Reservas</h2>
                <span>Últimos 7 días</span>
              </div>
              <div className="chart-placeholder">
                {renderChart(analyticsData?.reservations_chart || [], 'count')}
                <div className="chart-legend">
                  <div className="legend-item">
                    <span className="legend-color reservations"></span>
                    <span>Reservas por día</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'revenue' && (
          <div className="revenue-tab">
            <div className="section-header">
              <h2>Analytics de Ingresos</h2>
              <button 
                className="btn-export"
                onClick={() => handleExport('revenue')}
              >
                <i className="fas fa-download"></i>
                Exportar Reporte
              </button>
            </div>
            
            <div className="revenue-content">
              <div className="revenue-metrics">
                <div className="metric-card">
                  <div className="metric-icon">
                    <i className="fas fa-money-bill-wave"></i>
                  </div>
                  <div className="metric-content">
                    <h3>{formatCurrency(revenueData?.total_revenue || analyticsData?.total_revenue || 0)}</h3>
                    <p>Ingresos Totales</p>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon">
                    <i className="fas fa-chart-line"></i>
                  </div>
                  <div className="metric-content">
                    <h3>{formatCurrency(revenueData?.platform_earnings || analyticsData?.platform_earnings || 0)}</h3>
                    <p>Ganancias Plataforma</p>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon">
                    <i className="fas fa-hand-holding-usd"></i>
                  </div>
                  <div className="metric-content">
                    <h3>{formatCurrency(revenueData?.owner_payouts || 0)}</h3>
                    <p>Pagos a Propietarios</p>
                  </div>
                </div>
              </div>
              
              <div className="charts-section">
                <h3>Evolución de Ingresos</h3>
                {renderChart(revenueData?.revenue_chart || [], 'amount')}
                <div className="chart-legend">
                  <div className="legend-item">
                    <span className="legend-color revenue"></span>
                    <span>Ingresos por día</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'users' && (
          <div className="users-tab">
            <div className="section-header">
              <h2>Analytics de Usuarios</h2>
              <button 
                className="btn-export"
                onClick={() => handleExport('users')}
              >
                <i className="fas fa-download"></i>
                Exportar Reporte
              </button>
            </div>
            
            <div className="users-content">
              <div className="user-metrics">
                <div className="metric-card">
                  <div className="metric-icon">
                    <i className="fas fa-user-plus"></i>
                  </div>
                  <div className="metric-content">
                    <h3>{formatNumber(userData?.new_users || analyticsData?.new_users || 0)}</h3>
                    <p>Nuevos Usuarios</p>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon">
                    <i className="fas fa-users"></i>
                  </div>
                  <div className="metric-content">
                    <h3>{formatNumber(userData?.active_users || analyticsData?.active_users || 0)}</h3>
                    <p>Usuarios Activos</p>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon">
                    <i className="fas fa-user-check"></i>
                  </div>
                  <div className="metric-content">
                    <h3>{formatNumber(userData?.total_owners || 0)}</h3>
                    <p>Propietarios</p>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon">
                    <i className="fas fa-user"></i>
                  </div>
                  <div className="metric-content">
                    <h3>{formatNumber(userData?.total_clients || 0)}</h3>
                    <p>Clientes</p>
                  </div>
                </div>
              </div>
              
              <div className="charts-section">
                <h3>Crecimiento de Usuarios</h3>
                {renderChart(userData?.users_chart || [], 'count')}
                <div className="chart-legend">
                  <div className="legend-item">
                    <span className="legend-color users"></span>
                    <span>Actividad de usuarios</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'parkings' && (
          <div className="parkings-tab">
            <div className="section-header">
              <h2>Analytics de Estacionamientos</h2>
              <button className="btn-export">
                <i className="fas fa-download"></i>
                Exportar Reporte
              </button>
            </div>
            
            <div className="parkings-content">
              <div className="parking-metrics">
                <div className="metric-card">
                  <div className="metric-icon">
                    <i className="fas fa-parking"></i>
                  </div>
                  <div className="metric-content">
                    <h3>{formatNumber(analyticsData?.total_parkings || 0)}</h3>
                    <p>Total Estacionamientos</p>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon">
                    <i className="fas fa-check-circle"></i>
                  </div>
                  <div className="metric-content">
                    <h3>{formatNumber(analyticsData?.active_parkings || 0)}</h3>
                    <p>Estacionamientos Activos</p>
                  </div>
                </div>
                <div className="metric-card">
                  <div className="metric-icon">
                    <i className="fas fa-chart-pie"></i>
                  </div>
                  <div className="metric-content">
                    <h3>{analyticsData?.occupancy_rate || 0}%</h3>
                    <p>Tasa de Ocupación</p>
                  </div>
                </div>
              </div>

              <div className="coming-soon-placeholder">
                <i className="fas fa-parking"></i>
                <h3>Más Métricas Próximamente</h3>
                <p>Estamos trabajando en analytics detallados para estacionamientos</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MENSAJES DE ERROR */}
      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i>
          {error}
        </div>
      )}
    </div>
  );
};

export default AdminReports;