import React, { useState, useEffect } from 'react';
import './OwnerReports.css';

const OwnerReports = ({ userRole }) => {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('month');
  const [reportType, setReportType] = useState('overview');
  const [exportLoading, setExportLoading] = useState(false);

  const API_BASE = 'http://localhost:8000/api';

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
      
      console.log('📊 Cargando reportes del propietario...');
      
      let endpoint;
      switch (reportType) {
        case 'overview':
          endpoint = '/analytics/owner/dashboard/';
          break;
        case 'revenue':
          endpoint = '/analytics/owner/revenue/';
          break;
        case 'reservations':
          endpoint = '/analytics/owner/reservations/';
          break;
        case 'performance':
          endpoint = '/analytics/owner/performance/';
          break;
        default:
          endpoint = '/analytics/owner/dashboard/';
      }
      
      const response = await fetch(`${API_BASE}${endpoint}?period=${timeRange}`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include'
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
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatNumber = (number) => {
    return new Intl.NumberFormat('es-PE').format(number);
  };

  const handleExport = async (format) => {
    try {
      setExportLoading(true);
      
      const response = await fetch(`${API_BASE}/analytics/owner/dashboard/?period=${timeRange}&format=${format}`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include'
      });

      if (response.ok) {
        // Descargar el archivo
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reporte_${reportType}_${timeRange}.${format}`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        throw new Error(`Error ${response.status} al exportar reporte`);
      }
    } catch (error) {
      console.error('Error exportando reporte:', error);
      alert('Error al exportar el reporte');
      setExportLoading(false);
    }
  };

  const renderOverviewReport = () => (
    <div className="overview-report">
      <div className="metrics-grid">
        <div className="metric-card large">
          <div className="metric-icon">
            <div className="icon-wrapper">💰</div>
          </div>
          <div className="metric-content">
            <h3>{formatCurrency(reportData?.total_earnings || 0)}</h3>
            <p>Ingresos Totales</p>
            <span className="metric-trend positive">+12.5% vs mes anterior</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <div className="icon-wrapper">📅</div>
          </div>
          <div className="metric-content">
            <h3>{formatNumber(reportData?.total_reservations || 0)}</h3>
            <p>Total Reservas</p>
            <span className="metric-info">
              {reportData?.completed || 0} completadas
            </span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <div className="icon-wrapper">⭐</div>
          </div>
          <div className="metric-content">
            <h3>{reportData?.average_rating || 0}</h3>
            <p>Rating Promedio</p>
            <span className="metric-info">de 5.0</span>
          </div>
        </div>

        <div className="metric-card">
          <div className="metric-icon">
            <div className="icon-wrapper">📊</div>
          </div>
          <div className="metric-content">
            <h3>{reportData?.occupancy_rate || 0}%</h3>
            <p>Tasa de Ocupación</p>
            <div className="occupancy-bar">
              <div 
                className="occupancy-fill"
                style={{ width: `${reportData?.occupancy_rate || 0}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      <div className="insights-grid">
        <div className="insight-card">
          <h4>Horarios Pico</h4>
          <div className="insight-list">
            {reportData?.peak_hours?.map((hour, index) => (
              <div key={index} className="insight-item">
                <span className="time">{hour}</span>
                <span className="popularity">Alta demanda</span>
              </div>
            ))}
          </div>
        </div>

        <div className="insight-card">
          <h4>Días Más Populares</h4>
          <div className="insight-list">
            {reportData?.popular_days?.map((day, index) => (
              <div key={index} className="insight-item">
                <span className="day">{day}</span>
                <span className="rank">#{index + 1}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="trend-section">
        <h4>Tendencia Mensual</h4>
        <div className="trend-chart">
          {reportData?.monthly_trend?.map((monthData, index) => (
            <div key={index} className="trend-bar-container">
              <div className="trend-bar">
                <div 
                  className="earnings-bar"
                  style={{ height: `${(monthData.earnings / 15000) * 100}%` }}
                  title={`${formatCurrency(monthData.earnings)}`}
                ></div>
                <div 
                  className="reservations-bar"
                  style={{ height: `${(monthData.reservations / 200) * 100}%` }}
                  title={`${monthData.reservations} reservas`}
                ></div>
              </div>
              <span className="month-label">{monthData.month}</span>
            </div>
          ))}
        </div>
        <div className="chart-legend">
          <div className="legend-item">
            <span className="legend-color earnings"></span>
            <span>Ingresos</span>
          </div>
          <div className="legend-item">
            <span className="legend-color reservations"></span>
            <span>Reservas</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderRevenueReport = () => (
    <div className="revenue-report">
      <div className="revenue-summary">
        <div className="revenue-card">
          <h4>Ingresos Totales</h4>
          <div className="revenue-amount">
            {formatCurrency(reportData?.total_revenue || 0)}
          </div>
        </div>

        <div className="revenue-card">
          <h4>Comisión Plataforma</h4>
          <div className="revenue-amount commission">
            {formatCurrency(reportData?.platform_commission || 0)}
          </div>
        </div>

        <div className="revenue-card">
          <h4>Ganancias Netas</h4>
          <div className="revenue-amount net">
            {formatCurrency(reportData?.net_earnings || 0)}
          </div>
        </div>
      </div>

      <div className="revenue-details">
        <div className="detail-section">
          <h4>Desglose Diario</h4>
          <div className="daily-breakdown">
            {reportData?.daily_breakdown?.map((day, index) => (
              <div key={index} className="daily-item">
                <span className="date">
                  {new Date(day.date).toLocaleDateString('es', { weekday: 'short' })}
                </span>
                <div className="day-stats">
                  <span className="earnings">{formatCurrency(day.earnings)}</span>
                  <span className="reservations">{day.reservations} reservas</span>
                </div>
                <div className="day-bar">
                  <div 
                    className="bar-fill"
                    style={{ width: `${(day.earnings / 700) * 100}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="detail-section">
          <h4>Métodos de Pago</h4>
          <div className="payment-methods">
            {reportData?.payment_methods?.map((method, index) => (
              <div key={index} className="payment-method">
                <div className="method-header">
                  <span className="method-name">{method.method}</span>
                  <span className="method-percentage">{method.percentage}%</span>
                </div>
                <div className="method-bar">
                  <div 
                    className="method-fill"
                    style={{ width: `${method.percentage}%` }}
                  ></div>
                </div>
                <span className="method-amount">{formatCurrency(method.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderReservationsReport = () => (
    <div className="reservations-report">
      <div className="reservations-summary">
        <div className="stat-card">
          <h4>Total Reservas</h4>
          <div className="stat-value">{formatNumber(reportData?.total_reservations || 0)}</div>
        </div>

        <div className="stat-card">
          <h4>Completadas</h4>
          <div className="stat-value completed">{formatNumber(reportData?.completed || 0)}</div>
        </div>

        <div className="stat-card">
          <h4>Canceladas</h4>
          <div className="stat-value cancelled">{formatNumber(reportData?.cancelled || 0)}</div>
        </div>

        <div className="stat-card">
          <h4>No Show</h4>
          <div className="stat-value no-show">{formatNumber(reportData?.no_show || 0)}</div>
        </div>
      </div>

      <div className="reservations-details">
        <div className="detail-section">
          <h4>Fuentes de Reserva</h4>
          <div className="sources-grid">
            {reportData?.reservation_sources?.map((source, index) => (
              <div key={index} className="source-item">
                <div className="source-info">
                  <span className="source-name">{source.source}</span>
                  <span className="source-count">{source.count} reservas</span>
                </div>
                <div className="source-bar">
                  <div 
                    className="source-fill"
                    style={{ width: `${source.percentage}%` }}
                  ></div>
                </div>
                <span className="source-percentage">{source.percentage}%</span>
              </div>
            ))}
          </div>
        </div>

        <div className="detail-section">
          <h4>Análisis de Duración</h4>
          <div className="duration-analysis">
            {reportData?.duration_analysis?.map((duration, index) => (
              <div key={index} className="duration-item">
                <span className="duration-range">{duration.duration}</span>
                <div className="duration-stats">
                  <div className="duration-bar">
                    <div 
                      className="duration-fill"
                      style={{ width: `${duration.percentage}%` }}
                    ></div>
                  </div>
                  <span className="duration-percentage">{duration.percentage}%</span>
                </div>
                <span className="duration-count">({duration.count})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderCustomersReport = () => (
    <div className="customers-report">
      <div className="customers-summary">
        <div className="stat-card">
          <h4>Total Clientes</h4>
          <div className="stat-value">{formatNumber(reportData?.total_customers || 0)}</div>
        </div>

        <div className="stat-card">
          <h4>Clientes Recurrentes</h4>
          <div className="stat-value repeat">{formatNumber(reportData?.repeat_customers || 0)}</div>
        </div>

        <div className="stat-card">
          <h4>Nuevos Clientes</h4>
          <div className="stat-value new">{formatNumber(reportData?.new_customers || 0)}</div>
        </div>

        <div className="stat-card">
          <h4>Retención</h4>
          <div className="stat-value retention">{reportData?.customer_retention || 0}%</div>
        </div>
      </div>

      <div className="customers-details">
        <div className="detail-section">
          <h4>Mejores Clientes</h4>
          <div className="top-customers">
            {reportData?.top_customers?.map((customer, index) => (
              <div key={index} className="customer-item">
                <div className="customer-rank">
                  <span className="rank-badge">#{index + 1}</span>
                </div>
                <div className="customer-info">
                  <span className="customer-name">{customer.name}</span>
                  <span className="customer-visits">{customer.visits} visitas</span>
                </div>
                <div className="customer-spending">
                  <span className="spending-amount">{formatCurrency(customer.total_spent)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="detail-section">
          <h4>Tipos de Vehículos</h4>
          <div className="vehicle-types">
            {reportData?.vehicle_types?.map((vehicle, index) => (
              <div key={index} className="vehicle-item">
                <div className="vehicle-info">
                  <span className="vehicle-type">{vehicle.type}</span>
                  <span className="vehicle-count">{vehicle.count} vehículos</span>
                </div>
                <div className="vehicle-bar">
                  <div 
                    className="vehicle-fill"
                    style={{ width: `${vehicle.percentage}%` }}
                  ></div>
                </div>
                <span className="vehicle-percentage">{vehicle.percentage}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderReportContent = () => {
    switch (reportType) {
      case 'overview':
        return renderOverviewReport();
      case 'revenue':
        return renderRevenueReport();
      case 'reservations':
        return renderReservationsReport();
      case 'customers':
        return renderCustomersReport();
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
            <option value="week">Esta Semana</option>
            <option value="month">Este Mes</option>
            <option value="quarter">Este Trimestre</option>
            <option value="year">Este Año</option>
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
          className={`type-btn ${reportType === 'customers' ? 'active' : ''}`}
          onClick={() => setReportType('customers')}
        >
          <div className="icon-wrapper">👥</div>
          Clientes
        </button>
      </div>

      {/* PERIODO ACTUAL */}
      <div className="period-info">
        <h3>
          {timeRange === 'week' && 'Esta Semana'}
          {timeRange === 'month' && 'Este Mes'}
          {timeRange === 'quarter' && 'Este Trimestre'}
          {timeRange === 'year' && 'Este Año'}
        </h3>
        <span className="last-update">
          Actualizado: {new Date().toLocaleDateString('es')}
        </span>
      </div>

      {/* CONTENIDO DEL REPORTE */}
      <div className="report-content">
        {renderReportContent()}
      </div>

      {/* ACCIONES DE EXPORTACIÓN */}
      <div className="export-actions">
        <h4>Exportar Reporte</h4>
        <div className="export-buttons">
          <button 
            className="btn-export pdf"
            onClick={() => handleExport('pdf')}
            disabled={exportLoading}
          >
            {exportLoading ? 'Exportando...' : 'PDF'}
          </button>
          <button 
            className="btn-export excel"
            onClick={() => handleExport('excel')}
            disabled={exportLoading}
          >
            {exportLoading ? 'Exportando...' : 'Excel'}
          </button>
          <button 
            className="btn-export csv"
            onClick={() => handleExport('csv')}
            disabled={exportLoading}
          >
            {exportLoading ? 'Exportando...' : 'CSV'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default OwnerReports;