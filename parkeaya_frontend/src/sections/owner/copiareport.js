import React, { useState, useEffect } from 'react';
import './OwnerReports.css';

const OwnerReports = ({ userRole }) => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('monthly');
  const [reportType, setReportType] = useState('overview');

  const API_BASE = 'http://localhost:8000/api/analytics';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  useEffect(() => {
    loadReportData();
  }, [timeRange, reportType]);

  const loadReportData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let endpoint;
      let params = `?period=${timeRange}`;

      switch (reportType) {
        case 'overview':
          endpoint = '/owner/dashboard/';
          break;
        case 'revenue':
          endpoint = '/owner/revenue/';
          break;
        case 'reservations':
          endpoint = '/owner/reservations/';
          break;
        case 'performance':
          endpoint = '/owner/performance/';
          break;
        default:
          endpoint = '/owner/dashboard/';
      }
      
      const response = await fetch(`${API_BASE}${endpoint}${params}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Reportes cargados:', data);
        setReportData(data);
      } else {
        const errorText = await response.text();
        console.error('❌ Error en respuesta:', errorText);
        setError(`Error ${response.status} al cargar reportes`);
      }
    } catch (error) {
      console.error('💥 Error cargando reportes:', error);
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatNumber = (number) => {
    return new Intl.NumberFormat('es-CO').format(number);
  };

  // RENDERIZADO DE REPORTE RESUMEN
  const renderOverviewReport = () => {
    const stats = reportData?.owner_stats;
    const performance = reportData?.parking_performance || [];
    const chartData = reportData?.chart_data || [];

    return (
      <div className="overview-report">
        <div className="metrics-grid">
          <div className="metric-card large">
            <div className="metric-icon">💰</div>
            <div className="metric-content">
              <h3>{formatCurrency(stats?.total_earnings || 0)}</h3>
              <p>Ganancias Totales</p>
              <span className="metric-trend positive">
                {stats?.reservation_growth > 0 ? '+' : ''}{stats?.reservation_growth || 0}% crecimiento
              </span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">📅</div>
            <div className="metric-content">
              <h3>{formatNumber(stats?.total_reservations || 0)}</h3>
              <p>Total Reservas</p>
              <span className="metric-info">
                {stats?.active_reservations || 0} activas
              </span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">🏢</div>
            <div className="metric-content">
              <h3>{formatNumber(stats?.total_parkings || 0)}</h3>
              <p>Estacionamientos</p>
              <span className="metric-info">
                {stats?.active_parkings || 0} activos
              </span>
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-icon">📊</div>
            <div className="metric-content">
              <h3>{stats?.completed_today || 0}</h3>
              <p>Completadas Hoy</p>
              <span className="metric-info">
                {formatCurrency(stats?.today_revenue || 0)} ingresos
              </span>
            </div>
          </div>
        </div>

        {/* RENDIMIENTO POR ESTACIONAMIENTO */}
        <div className="performance-section">
          <h4>Rendimiento por Estacionamiento</h4>
          <div className="performance-grid">
            {performance.map((parking, index) => (
              <div key={parking.id} className="performance-card">
                <div className="parking-header">
                  <h5>{parking.name}</h5>
                  <span className="earnings-badge">
                    {formatCurrency(parking.earnings)}
                  </span>
                </div>
                <div className="parking-stats">
                  <div className="stat">
                    <span className="label">Reservas:</span>
                    <span className="value">{parking.reservations}</span>
                  </div>
                  <div className="stat">
                    <span className="label">Ocupación:</span>
                    <span className="value">{parking.occupancy_rate || 0}%</span>
                  </div>
                </div>
                <div className="performance-bar">
                  <div 
                    className="performance-fill"
                    style={{ width: `${(parking.earnings / (stats?.total_earnings || 1)) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* GRÁFICO DE TENDENCIAS */}
        <div className="trend-section">
          <h4>Tendencia de los Últimos 30 Días</h4>
          <div className="trend-chart">
            {chartData.map((dayData, index) => (
              <div key={index} className="trend-bar-container">
                <div className="trend-bar">
                  <div 
                    className="earnings-bar"
                    style={{ height: `${(dayData.earnings / (Math.max(...chartData.map(d => d.earnings)) || 1)) * 100}%` }}
                    title={`${formatCurrency(dayData.earnings)}`}
                  ></div>
                  <div 
                    className="reservations-bar"
                    style={{ height: `${(dayData.reservations / (Math.max(...chartData.map(d => d.reservations)) || 1)) * 100}%` }}
                    title={`${dayData.reservations} reservas`}
                  ></div>
                </div>
                <span className="date-label">
                  {new Date(dayData.date).getDate()}
                </span>
              </div>
            ))}
          </div>
          <div className="chart-legend">
            <div className="legend-item">
              <span className="legend-color earnings"></span>
              <span>Ganancias</span>
            </div>
            <div className="legend-item">
              <span className="legend-color reservations"></span>
              <span>Reservas</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // RENDERIZADO DE REPORTE DE INGRESOS
  const renderRevenueReport = () => {
    const revenueData = reportData?.revenue_data || [];

    return (
      <div className="revenue-report">
        <div className="revenue-summary">
          <div className="revenue-card">
            <h4>Ingresos Totales</h4>
            <div className="revenue-amount">
              {formatCurrency(revenueData.reduce((sum, item) => sum + (item.revenue || 0), 0))}
            </div>
          </div>

          <div className="revenue-card">
            <h4>Ganancias Netas</h4>
            <div className="revenue-amount net">
              {formatCurrency(revenueData.reduce((sum, item) => sum + (item.earnings || 0), 0))}
            </div>
          </div>

          <div className="revenue-card">
            <h4>Período</h4>
            <div className="revenue-period">
              {timeRange === 'daily' ? 'Últimos 30 días' : 
               timeRange === 'weekly' ? 'Últimas 12 semanas' : 
               'Últimos 12 meses'}
            </div>
          </div>
        </div>

        <div className="revenue-details">
          <div className="detail-section">
            <h4>Desglose por {timeRange === 'daily' ? 'Día' : timeRange === 'weekly' ? 'Semana' : 'Mes'}</h4>
            <div className="revenue-breakdown">
              {revenueData.map((item, index) => (
                <div key={index} className="revenue-item">
                  <div className="period-info">
                    <span className="period-label">
                      {timeRange === 'daily' ? new Date(item.date).toLocaleDateString('es', { weekday: 'short', day: 'numeric' }) :
                       timeRange === 'weekly' ? item.week :
                       item.month_name}
                    </span>
                    <span className="period-dates">
                      {item.start_date && item.end_date ? 
                        `${new Date(item.start_date).getDate()}-${new Date(item.end_date).getDate()}` : ''}
                    </span>
                  </div>
                  <div className="revenue-stats">
                    <span className="revenue-amount">{formatCurrency(item.revenue || 0)}</span>
                    <span className="earnings-amount">{formatCurrency(item.earnings || 0)}</span>
                  </div>
                  <div className="revenue-bar">
                    <div 
                      className="bar-fill"
                      style={{ 
                        width: `${((item.revenue || 0) / (Math.max(...revenueData.map(r => r.revenue || 0)) || 1)) * 100}%` 
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // RENDERIZADO DE REPORTE DE RESERVAS
  const renderReservationsReport = () => {
    const statusData = reportData?.status_distribution || [];
    const popularHours = reportData?.popular_hours || [];
    const avgRating = reportData?.average_rating || 0;

    return (
      <div className="reservations-report">
        <div className="reservations-summary">
          <div className="stat-card">
            <h4>Total Reservas</h4>
            <div className="stat-value">{formatNumber(reportData?.total_reservations || 0)}</div>
          </div>

          <div className="stat-card">
            <h4>Rating Promedio</h4>
            <div className="stat-value rating">{avgRating.toFixed(1)}</div>
          </div>

          <div className="stat-card">
            <h4>Horarios Populares</h4>
            <div className="stat-value active">{popularHours.length}</div>
          </div>
        </div>

        <div className="reservations-details">
          <div className="detail-section">
            <h4>Distribución por Estado</h4>
            <div className="status-grid">
              {statusData.map((status, index) => (
                <div key={index} className="status-item">
                  <div className="status-info">
                    <span className="status-name">{status.status}</span>
                    <span className="status-count">{status.count} reservas</span>
                  </div>
                  <div className="status-bar">
                    <div 
                      className="status-fill"
                      style={{ 
                        width: `${(status.count / (reportData?.total_reservations || 1)) * 100}%` 
                      }}
                    ></div>
                  </div>
                  <span className="status-percentage">
                    {((status.count / (reportData?.total_reservations || 1)) * 100).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="detail-section">
            <h4>Horarios Más Populares</h4>
            <div className="popular-hours">
              {popularHours.map((hour, index) => (
                <div key={index} className="hour-item">
                  <span className="hour-range">{hour.start_time__hour}:00 - {hour.start_time__hour + 1}:00</span>
                  <div className="hour-stats">
                    <div className="hour-bar">
                      <div 
                        className="hour-fill"
                        style={{ 
                          width: `${(hour.count / (Math.max(...popularHours.map(h => h.count)) || 1)) * 100}%` 
                        }}
                      ></div>
                    </div>
                    <span className="hour-count">{hour.count} reservas</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // RENDERIZADO DE REPORTE DE RENDIMIENTO
  const renderPerformanceReport = () => {
    const performanceData = Array.isArray(reportData) ? reportData : [reportData].filter(Boolean);

    return (
      <div className="performance-report">
        <h4>Rendimiento Detallado de Estacionamientos</h4>
        <div className="performance-list">
          {performanceData.map((parking, index) => (
            <div key={parking?.parking_info?.id || index} className="performance-detail-card">
              <div className="parking-main-info">
                <h5>{parking?.parking_info?.name || 'Estacionamiento'}</h5>
                <span className="parking-status">{parking?.parking_info?.status || 'active'}</span>
              </div>
              
              <div className="performance-metrics">
                <div className="metric-row">
                  <div className="metric">
                    <span className="metric-label">Ganancias Totales:</span>
                    <span className="metric-value">
                      {formatCurrency(parking?.performance?.total_earnings || 0)}
                    </span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Total Reservas:</span>
                    <span className="metric-value">{parking?.performance?.total_reservations || 0}</span>
                  </div>
                </div>
                
                <div className="metric-row">
                  <div className="metric">
                    <span className="metric-label">Reservas Completadas:</span>
                    <span className="metric-value">{parking?.performance?.completed_reservations || 0}</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Tasa de Completación:</span>
                    <span className="metric-value">{parking?.performance?.completion_rate || 0}%</span>
                  </div>
                </div>
                
                <div className="metric-row">
                  <div className="metric">
                    <span className="metric-label">Rating Promedio:</span>
                    <span className="metric-value rating">{parking?.performance?.average_rating?.toFixed(1) || '0.0'}</span>
                  </div>
                </div>
              </div>
              
              <div className="performance-bars">
                <div className="bar-container">
                  <span className="bar-label">Ocupación</span>
                  <div className="bar">
                    <div 
                      className="bar-fill occupancy"
                      style={{ width: `${parking?.performance?.completion_rate || 0}%` }}
                    ></div>
                  </div>
                </div>
                
                <div className="bar-container">
                  <span className="bar-label">Satisfacción</span>
                  <div className="bar">
                    <div 
                      className="bar-fill rating"
                      style={{ width: `${((parking?.performance?.average_rating || 0) / 5) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderReportContent = () => {
    switch (reportType) {
      case 'overview':
        return renderOverviewReport();
      case 'revenue':
        return renderRevenueReport();
      case 'reservations':
        return renderReservationsReport();
      case 'performance':
        return renderPerformanceReport();
      default:
        return renderOverviewReport();
    }
  };

  if (loading) {
    return (
      <div className="owner-reports-loading">
        <div className="loading-spinner"></div>
        <p>Generando reportes...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="owner-reports-error">
        <div className="error-icon">⚠️</div>
        <h3>Error al cargar reportes</h3>
        <p>{error}</p>
        <button onClick={loadReportData} className="retry-btn">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="owner-reports">
      {/* HEADER */}
      <div className="owner-reports-header">
        <div className="header-content">
          <h1>Reportes y Analytics</h1>
          <p>Métricas detalladas de tu negocio de estacionamiento</p>
        </div>
        <div className="header-actions">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value)}
            className="time-filter"
          >
            <option value="daily">Últimos 30 días</option>
            <option value="weekly">Últimas 12 semanas</option>
            <option value="monthly">Últimos 12 meses</option>
          </select>
          <button onClick={loadReportData} className="refresh-btn">
            <div className="icon-wrapper">🔄</div>
            Actualizar
          </button>
        </div>
      </div>

      {/* TIPOS DE REPORTE */}
      <div className="report-types">
        <button 
          className={`type-btn ${reportType === 'overview' ? 'active' : ''}`}
          onClick={() => setReportType('overview')}
        >
          <div className="icon-wrapper">📊</div>
          Resumen General
        </button>
        <button 
          className={`type-btn ${reportType === 'revenue' ? 'active' : ''}`}
          onClick={() => setReportType('revenue')}
        >
          <div className="icon-wrapper">💰</div>
          Ingresos
        </button>
        <button 
          className={`type-btn ${reportType === 'reservations' ? 'active' : ''}`}
          onClick={() => setReportType('reservations')}
        >
          <div className="icon-wrapper">📅</div>
          Reservas
        </button>
        <button 
          className={`type-btn ${reportType === 'performance' ? 'active' : ''}`}
          onClick={() => setReportType('performance')}
        >
          <div className="icon-wrapper">🏢</div>
          Rendimiento
        </button>
      </div>

      {/* PERIODO ACTUAL */}
      <div className="period-info">
        <h3>
          {timeRange === 'daily' && 'Últimos 30 Días'}
          {timeRange === 'weekly' && 'Últimas 12 Semanas'}
          {timeRange === 'monthly' && 'Últimos 12 Meses'}
        </h3>
        <span className="last-update">
          Actualizado: {new Date().toLocaleDateString('es')}
        </span>
      </div>

      {/* CONTENIDO DEL REPORTE */}
      <div className="report-content">
        {renderReportContent()}
      </div>
    </div>
  );
};

export default OwnerReports;