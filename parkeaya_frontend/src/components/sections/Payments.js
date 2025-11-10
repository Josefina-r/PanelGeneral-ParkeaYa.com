/**import React, { useState, useEffect } from 'react';
import './Payments.css';

function Payments() {
  const API_BASE = 'http://localhost:8000/api';
  
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Estados para filtros
  const [filters, setFilters] = useState({
    status: '',
    dateFrom: '',
    dateTo: ''
  });

  // Fetch payments desde la API de Django
  const fetchPayments = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Construir query parameters para filtros
      const queryParams = new URLSearchParams();
      if (filters.status) queryParams.append('status', filters.status);
      if (filters.dateFrom) queryParams.append('date_from', filters.dateFrom);
      if (filters.dateTo) queryParams.append('date_to', filters.dateTo);

      const token = localStorage.getItem('access_token');
      
      const response = await fetch(`${API_BASE}/payments/?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      setPayments(data.results || data); // Maneja tanto paginación como lista simple
    } catch (err) {
      setError(err.message);
      console.error('Error fetching payments:', err);
    } finally {
      setLoading(false);
    }
  };

  // Cargar pagos al montar el componente
  useEffect(() => {
    fetchPayments();
  }, []);

  // Manejar reembolso
  const handleRefund = async (paymentId) => {
    if (!window.confirm('¿Estás seguro de que deseas realizar el reembolso?')) {
      return;
    }

    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_BASE}/payments/${paymentId}/refund/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al procesar el reembolso');
      }

      const result = await response.json();
      alert('Reembolso procesado exitosamente');
      fetchPayments(); // Recargar la lista
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // Ver detalles del pago
  const viewPaymentDetails = (payment) => {
    setSelectedPayment(payment);
    setShowModal(true);
  };

  // Aplicar filtros
  const applyFilters = () => {
    fetchPayments();
  };

  // Limpiar filtros
  const clearFilters = () => {
    setFilters({
      status: '',
      dateFrom: '',
      dateTo: ''
    });
    setTimeout(() => fetchPayments(), 100);
  };

  // Formatear fecha
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Formatear moneda
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  // Obtener clase CSS para el estado
  const getStatusClass = (status) => {
    const statusMap = {
      'completed': 'status-completed',
      'pending': 'status-pending',
      'failed': 'status-failed',
      'refunded': 'status-refunded',
      'approved': 'status-completed',
      'cancelled': 'status-failed',
      'processing': 'status-pending'
    };
    return statusMap[status] || 'status-pending';
  };

  // Traducir estado al español
  const translateStatus = (status) => {
    const statusTranslations = {
      'completed': 'Completado',
      'pending': 'Pendiente',
      'failed': 'Fallido',
      'refunded': 'Reembolsado',
      'approved': 'Aprobado',
      'cancelled': 'Cancelado',
      'processing': 'Procesando'
    };
    return statusTranslations[status] || status;
  };

  // Traducir método de pago
  const translatePaymentMethod = (method) => {
    const methodTranslations = {
      'credit_card': 'Tarjeta Crédito',
      'debit_card': 'Tarjeta Débito',
      'paypal': 'PayPal',
      'transfer': 'Transferencia',
      'cash': 'Efectivo'
    };
    return methodTranslations[method] || method;
  };

  if (loading) {
    return (
      <div className="section-container">
        <div className="loading">
          <div className="loading-spinner"></div>
          Cargando pagos...
        </div>
      </div>
    );
  }

  return (
    <div className="section-container">
      <div className="section-header">
        <h2>Gestión de Pagos</h2>
        <p>Administra los pagos del sistema Parkeaya</p>
      </div>
      /**
      <div className="filters-section">
        <h3>Filtros</h3>
        <div className="filters-row">
          <div className="filter-group">
            <label>Estado:</label>
            <select 
              value={filters.status}
              onChange={(e) => setFilters({...filters, status: e.target.value})}
              className="filter-select"
            >
              <option value="">Todos los estados</option>
              <option value="completed">Completados</option>
              <option value="pending">Pendientes</option>
              <option value="failed">Fallidos</option>
              <option value="refunded">Reembolsados</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Desde:</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({...filters, dateFrom: e.target.value})}
              className="filter-input"
            />
          </div>

          <div className="filter-group">
            <label>Hasta:</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({...filters, dateTo: e.target.value})}
              className="filter-input"
            />
          </div>

          <div className="filter-actions">
            <button onClick={applyFilters} className="btn-primary">
              Aplicar Filtros
            </button>
            <button onClick={clearFilters} className="btn-secondary">
              Limpiar
            </button>
          </div>
        </div>
      </div>
/**
     
      <div className="stats-section">
        <div className="stat-card">
          <h3>Total Recaudado</h3>
          <p className="stat-amount">
            {formatCurrency(payments.reduce((sum, payment) => 
              payment.status === 'completed' ? sum + (payment.amount || 0) : sum, 0
            ))}
          </p>
        </div>
        <div className="stat-card">
          <h3>Pagos Exitosos</h3>
          <p className="stat-count">
            {payments.filter(p => p.status === 'completed' || p.status === 'approved').length}
          </p>
        </div>
        <div className="stat-card">
          <h3>Pagos Pendientes</h3>
          <p className="stat-count">
            {payments.filter(p => p.status === 'pending' || p.status === 'processing').length}
          </p>
        </div>
        <div className="stat-card">
          <h3>Total Pagos</h3>
          <p className="stat-count">
            {payments.length}
          </p>
        </div>
      </div>

      
      <div className="payments-section">
        <div className="section-header">
          <h3>Historial de Pagos</h3>
          <div className="header-actions">
            <span className="total-payments">{payments.length} pagos encontrados</span>
            <button onClick={fetchPayments} className="btn-refresh">
              🔄 Actualizar
            </button>
          </div>
        </div>

        {error && (
          <div className="error-message">
            ❌ Error: {error}
            <button onClick={fetchPayments} className="btn-retry">
              Reintentar
            </button>
          </div>
        )}

        {payments.length === 0 ? (
          <div className="no-payments">
            <div className="no-payments-icon">💳</div>
            <h3>No se encontraron pagos</h3>
            <p>No hay pagos que coincidan con los criterios de búsqueda</p>
          </div>
        ) : (
          <div className="payments-table-container">
            <table className="payments-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Usuario</th>
                  <th>Monto</th>
                  <th>Estado</th>
                  <th>Fecha</th>
                  <th>Método</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="payment-id">#{payment.id}</td>
                    <td>
                      <div className="user-info">
                        <div className="user-name">{payment.user?.name || payment.user?.username || 'N/A'}</div>
                        <div className="user-email">{payment.user?.email || ''}</div>
                      </div>
                    </td>
                    <td className="payment-amount">{formatCurrency(payment.amount || 0)}</td>
                    <td>
                      <span className={`status-badge ${getStatusClass(payment.status)}`}>
                        {translateStatus(payment.status)}
                      </span>
                    </td>
                    <td className="payment-date">{formatDate(payment.created_at || payment.date)}</td>
                    <td>
                      <span className="payment-method">
                        {translatePaymentMethod(payment.payment_method)}
                      </span>
                    </td>
                    <td className="actions-cell">
                      <button 
                        onClick={() => viewPaymentDetails(payment)}
                        className="btn-info"
                        title="Ver detalles"
                      >
                        👁️ Ver
                      </button>
                      {(payment.status === 'completed' || payment.status === 'approved') && (
                        <button 
                          onClick={() => handleRefund(payment.id)}
                          className="btn-warning"
                          title="Realizar reembolso"
                        >
                          💰 Reembolsar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      
      {showModal && selectedPayment && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Detalles del Pago #{selectedPayment.id}</h3>
              <button 
                onClick={() => setShowModal(false)}
                className="btn-close"
              >
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="detail-row">
                <label>Usuario:</label>
                <span>{selectedPayment.user?.name || selectedPayment.user?.username || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <label>Email:</label>
                <span>{selectedPayment.user?.email || 'N/A'}</span>
              </div>
              <div className="detail-row">
                <label>Monto:</label>
                <span className="detail-amount">
                  {formatCurrency(selectedPayment.amount || 0)}
                </span>
              </div>
              <div className="detail-row">
                <label>Estado:</label>
                <span className={`status-badge ${getStatusClass(selectedPayment.status)}`}>
                  {translateStatus(selectedPayment.status)}
                </span>
              </div>
              <div className="detail-row">
                <label>Método de Pago:</label>
                <span>{translatePaymentMethod(selectedPayment.payment_method)}</span>
              </div>
              <div className="detail-row">
                <label>Fecha:</label>
                <span>{formatDate(selectedPayment.created_at || selectedPayment.date)}</span>
              </div>
              {selectedPayment.reservation && (
                <div className="detail-row">
                  <label>Reserva:</label>
                  <span>#{selectedPayment.reservation.id || selectedPayment.reservation}</span>
                </div>
              )}
              {selectedPayment.description && (
                <div className="detail-row">
                  <label>Descripción:</label>
                  <span>{selectedPayment.description}</span>
                </div>
              )}
              {selectedPayment.transaction_id && (
                <div className="detail-row">
                  <label>ID Transacción:</label>
                  <span className="transaction-id">{selectedPayment.transaction_id}</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => setShowModal(false)}
                className="btn-primary"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Payments; */