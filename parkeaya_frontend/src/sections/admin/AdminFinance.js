import React, { useState, useEffect } from 'react';
import './AdminFinance.css';

const AdminFinance = ({ userRole }) => {
  const [financeData, setFinanceData] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('month');
  const [selectedPeriod, setSelectedPeriod] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  const API_BASE = 'http://localhost:8000/api';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  useEffect(() => {
    loadFinanceData();
    loadTransactions();
  }, [timeRange, selectedPeriod]);

  const loadFinanceData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log(' Cargando datos financieros...');
      
      const params = new URLSearchParams({
        start_date: selectedPeriod.startDate,
        end_date: selectedPeriod.endDate,
        time_range: timeRange
      });
      
      // Endpoint para datos financieros del admin
      const response = await fetch(`${API_BASE}/payments/transactions/stats/?${params}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status} al cargar datos financieros`);
      }

      const data = await response.json();
      console.log('✅ Datos financieros:', data);
      setFinanceData(data);
      setError(null);
    } catch (error) {
      console.error('💥 Error cargando datos financieros:', error);
      setError(error.message || 'Error de conexión con el servidor');
      setFinanceData(null);
    } finally {
      setLoading(false);
    }
  };

  const loadTransactions = async () => {
    try {
      console.log('🔄 Cargando transacciones...');
      
      const params = new URLSearchParams({
        start_date: selectedPeriod.startDate,
        end_date: selectedPeriod.endDate,
        time_range: timeRange
      });

      const response = await fetch(`${API_BASE}/payments/transactions/?${params}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status} al cargar transacciones`);
      }

      const data = await response.json();
      console.log('✅ Transacciones cargadas:', data);
      setTransactions(data.results || []);
    } catch (error) {
      console.error('💥 Error cargando transacciones:', error);
      setError(error.message || 'Error cargando transacciones');
      setTransactions([]);
    }
  };

  // Funciones de utilidad para formatear datos
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP'
    }).format(amount);
  };

  const handlePayout = async (ownerId, amount) => {
    try {
      // Endpoint para realizar pagos a owners
      const response = await fetch(`${API_BASE}/payments/payout/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          owner_id: ownerId,
          amount: amount
        })
      });

      if (response.ok) {
        alert('Pago realizado exitosamente');
        loadFinanceData();
      } else {
        alert('Error al realizar el pago');
      }
    } catch (error) {
      console.error('Error en pago:', error);
      alert('Error al procesar el pago');
    }
  };

  const handleExport = (type) => {
    // Simular exportación de datos
    alert(`Exportando ${type}...`);
  };

  const calculateGrowth = (current, previous) => {
    if (previous === 0) return 100;
    return ((current - previous) / previous) * 100;
  };

  if (loading) {
    return (
      <div className="admin-finance-loading">
        <div className="loading-spinner"></div>
        <p>Cargando gestión financiera...</p>
      </div>
    );
  }

  return (
    <div className="admin-finance">
      {/* 🔥 HEADER */}
      <div className="admin-finance-header">
        <div className="header-content">
          <h1>Gestión Financiera</h1>
          <p>Control de ingresos, comisiones y pagos de la plataforma</p>
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
          <button onClick={loadFinanceData} className="refresh-btn">
            <i className="fas fa-sync"></i>
            Actualizar
          </button>
        </div>
      </div>

      {/*  MÉTRICAS PRINCIPALES */}
      <div className="finance-metrics">
        <div className="metric-card earnings">
          <div className="metric-icon">
            <i className="fas fa-money-bill-wave"></i>
          </div>
          <div className="metric-content">
            <h3>{formatCurrency(financeData?.platform_earnings || 0)}</h3>
            <p>Ingresos Plataforma</p>
            <span className="metric-trend positive">
              +{financeData?.revenue_growth || 0}%
            </span>
          </div>
        </div>

        <div className="metric-card profit">
          <div className="metric-icon">
            <i className="fas fa-chart-line"></i>
          </div>
          <div className="metric-content">
            <h3>{formatCurrency(financeData?.net_profit || 0)}</h3>
            <p>Beneficio Neto</p>
            <span className="metric-trend positive">
              +{(financeData?.net_profit / financeData?.platform_earnings * 100).toFixed(1)}%
            </span>
          </div>
        </div>

        <div className="metric-card payouts">
          <div className="metric-icon">
            <i className="fas fa-hand-holding-usd"></i>
          </div>
          <div className="metric-content">
            <h3>{formatCurrency(financeData?.owner_payouts || 0)}</h3>
            <p>Pagos a Propietarios</p>
            <span className="metric-info">
              {financeData?.commission_rate * 100}% comisión
            </span>
          </div>
        </div>

        <div className="metric-card transactions">
          <div className="metric-icon">
            <i className="fas fa-exchange-alt"></i>
          </div>
          <div className="metric-content">
            <h3>{financeData?.total_transactions || 0}</h3>
            <p>Total Transacciones</p>
            <div className="transaction-stats">
              <span className="successful">{financeData?.successful_transactions || 0} exitosas</span>
              <span className="failed">{financeData?.failed_transactions || 0} fallidas</span>
            </div>
          </div>
        </div>
      </div>

      <div className="finance-content">
        {/*  INGRESOS Y COMISIONES */}
        <div className="revenue-section">
          <div className="section-header">
            <h2>Ingresos y Comisiones</h2>
            <div className="section-actions">
              <button 
                className="btn-export"
                onClick={() => handleExport('revenue')}
              >
                <i className="fas fa-download"></i>
                Exportar Reporte
              </button>
            </div>
          </div>

          <div className="revenue-breakdown">
            <div className="breakdown-card">
              <h4>Distribución de Ingresos</h4>
              <div className="breakdown-content">
                <div className="breakdown-item">
                  <span className="label">Comisiones Plataforma</span>
                  <span className="value">{formatCurrency(financeData?.platform_earnings || 0)}</span>
                  <div className="percentage-bar">
                    <div 
                      className="bar-fill platform" 
                      style={{ width: '70%' }}
                    ></div>
                  </div>
                  <span className="percentage">70%</span>
                </div>
                <div className="breakdown-item">
                  <span className="label">Pagos a Propietarios</span>
                  <span className="value">{formatCurrency(financeData?.owner_payouts || 0)}</span>
                  <div className="percentage-bar">
                    <div 
                      className="bar-fill owner" 
                      style={{ width: '30%' }}
                    ></div>
                  </div>
                  <span className="percentage">30%</span>
                </div>
              </div>
            </div>

            <div className="commission-settings">
              <h4>Configuración de Comisiones</h4>
              <div className="commission-form">
                <div className="form-group">
                  <label>Comisión de la Plataforma (%)</label>
                  <div className="commission-input">
                    <input 
                      type="number" 
                      value={(financeData?.commission_rate * 100) || 30}
                      min="10"
                      max="50"
                      step="1"
                    />
                    <span>%</span>
                  </div>
                </div>
                <button className="btn-save">
                  <i className="fas fa-save"></i>
                  Guardar Cambios
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* 🏆 TOP EARNERS */}
        <div className="top-earners-section">
          <h2>Estacionamientos Más Rentables</h2>
          <div className="top-earners-list">
            {financeData?.top_earning_parkings?.map((parking, index) => (
              <div key={parking.id} className="earner-card">
                <div className="earner-rank">
                  <span className={`rank-badge rank-${index + 1}`}>
                    #{index + 1}
                  </span>
                </div>
                <div className="earner-info">
                  <h4>{parking.name}</h4>
                  <p>{parking.reservations} reservas</p>
                </div>
                <div className="earner-earnings">
                  <strong>{formatCurrency(parking.earnings)}</strong>
                  <span className="earnings-label">Ingresos</span>
                </div>
                <button 
                  className="btn-payout"
                  onClick={() => handlePayout(parking.id, parking.earnings * 0.7)}
                >
                  <i className="fas fa-money-check"></i>
                  Pagar
                </button>
              </div>
            ))}
          </div>
        </div>

        {/*  ÚLTIMAS TRANSACCIONES */}
        <div className="transactions-section">
          <div className="section-header">
            <h2>Últimas Transacciones</h2>
            <button 
              className="btn-export"
              onClick={() => handleExport('transactions')}
            >
              <i className="fas fa-download"></i>
              Exportar
            </button>
          </div>

          <div className="transactions-table-container">
            <table className="transactions-table">
              <thead>
                <tr>
                  <th>ID Transacción</th>
                  <th>Usuario</th>
                  <th>Estacionamiento</th>
                  <th>Monto Total</th>
                  <th>Comisión</th>
                  <th>Propietario</th>
                  <th>Estado</th>
                  <th>Método</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(transaction => (
                  <tr key={transaction.id} className={`transaction-${transaction.status}`}>
                    <td>
                      <code>{transaction.transaction_id}</code>
                    </td>
                    <td>
                      <div className="user-info">
                        <strong>{transaction.user.first_name} {transaction.user.last_name}</strong>
                        <small>@{transaction.user.username}</small>
                      </div>
                    </td>
                    <td>{transaction.parking.name}</td>
                    <td>
                      <strong>{formatCurrency(transaction.amount)}</strong>
                    </td>
                    <td>
                      <span className="fee-amount">
                        {formatCurrency(transaction.platform_fee)}
                      </span>
                    </td>
                    <td>
                      <span className="owner-amount">
                        {formatCurrency(transaction.owner_earnings)}
                      </span>
                    </td>
                    <td>
                      <span className={`status-badge status-${transaction.status}`}>
                        {transaction.status === 'completed' ? 'Completada' : 
                         transaction.status === 'failed' ? 'Fallida' : 'Pendiente'}
                      </span>
                    </td>
                    <td>
                      <span className="payment-method">
                        <i className={`fas fa-${transaction.payment_method === 'credit_card' ? 'credit-card' : 
                                      transaction.payment_method === 'paypal' ? 'paypal' : 'university'}`}></i>
                        {transaction.payment_method}
                      </span>
                    </td>
                    <td>
                      {new Date(transaction.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/*  RESUMEN FINANCIERO */}
        <div className="financial-summary">
          <div className="summary-card">
            <h3>Resumen del Período</h3>
            <div className="summary-grid">
              <div className="summary-item">
                <span className="label">Ingresos Brutos</span>
                <span className="value">{formatCurrency(financeData?.platform_earnings || 0)}</span>
              </div>
              <div className="summary-item">
                <span className="label">Comisiones</span>
                <span className="value">{formatCurrency(financeData?.platform_earnings || 0)}</span>
              </div>
              <div className="summary-item">
                <span className="label">Pagos a Propietarios</span>
                <span className="value">{formatCurrency(financeData?.owner_payouts || 0)}</span>
              </div>
              <div className="summary-item total">
                <span className="label">Beneficio Neto</span>
                <span className="value">{formatCurrency(financeData?.net_profit || 0)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 🔍 DEBUG INFO */}
      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i>
          {error}
        </div>
      )}
    </div>
  );
};

export default AdminFinance;