import React, { useState, useEffect } from 'react';
import './OwnerReservations.css';

const OwnerReservations = ({ userRole }) => {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    date: '',
    search: ''
  });
  const [selectedReservations, setSelectedReservations] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);
  const [viewModal, setViewModal] = useState(null);
  const [stats, setStats] = useState(null);

  const API_BASE = 'http://localhost:8000/api';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  useEffect(() => {
    loadReservations();
    loadReservationStats();
  }, [filters.status, filters.date]);

  const loadReservations = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📋 Cargando reservas del propietario...');
      
      // Endpoint para reservas del owner según tu API
      let url = `${API_BASE}/reservations/owner/reservas/`;
      const params = new URLSearchParams();
      
      if (filters.status !== 'all') params.append('status', filters.status);
      if (filters.date) params.append('date', filters.date);
      
      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      console.log('📊 Response status reservations:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Reservas cargadas:', data);
        
        // Adaptar según la estructura de tu API
        if (Array.isArray(data)) {
          setReservations(data);
        } else if (data.results) {
          setReservations(data.results);
        } else if (data.reservations) {
          setReservations(data.reservations);
        } else {
          setReservations(data.data || []);
        }
      } else {
        const errorText = await response.text();
        console.error('❌ Error en respuesta:', errorText);
        setError(`Error ${response.status} al cargar reservas`);
        setReservations([]);
      }
    } catch (error) {
      console.error('💥 Error cargando reservas:', error);
      setError('Error de conexión con el servidor');
      setReservations([]);
    } finally {
      setLoading(false);
    }
  };

  const loadReservationStats = async () => {
    try {
      const response = await fetch(`${API_BASE}/reservations/dashboard/owner/stats/`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📈 Estadísticas cargadas:', data);
        setStats(data);
      } else {
        console.warn('No se pudieron cargar las estadísticas');
        setStats({
          total: 0,
          active: 0,
          upcoming: 0,
          completed: 0,
          cancelled: 0,
          today_earnings: 0,
          monthly_earnings: 0
        });
      }
    } catch (error) {
      console.error('Error cargando estadísticas:', error);
      setStats({
        total: 0,
        active: 0,
        upcoming: 0,
        completed: 0,
        cancelled: 0,
        today_earnings: 0,
        monthly_earnings: 0
      });
    }
  };

  const handleReservationAction = async (reservationId, action) => {
    try {
      setActionLoading(reservationId);
      
      let endpoint = '';
      let method = 'POST';
      
      // Usar codigo_reserva según tu API
      const reservation = reservations.find(r => r.id === reservationId);
      if (!reservation) {
        alert('Reserva no encontrada');
        return;
      }

      const codigoReserva = reservation.codigo_reserva || reservation.reservation_code;
      
      switch(action) {
        case 'check_in':
          endpoint = `${API_BASE}/reservations/${codigoReserva}/checkin/`;
          break;
        case 'check_out':
          endpoint = `${API_BASE}/reservations/${codigoReserva}/checkout/`;
          break;
        case 'cancel':
          endpoint = `${API_BASE}/reservations/${codigoReserva}/cancel/`;
          break;
        case 'confirm':
          // En tu API, la confirmación podría ser parte del check-in o un endpoint separado
          endpoint = `${API_BASE}/reservations/${codigoReserva}/checkin/`;
          break;
        default:
          return;
      }
      
      const response = await fetch(endpoint, {
        method: method,
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const result = await response.json();
        console.log(`✅ Acción ${action} exitosa:`, result);
        await loadReservations();
        await loadReservationStats();
        setSelectedReservations([]);
        alert(`Reserva ${action === 'check_in' ? 'check-in' : action === 'check_out' ? 'check-out' : action} exitosa`);
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Error desconocido' }));
        alert(`Error al ${action} reserva: ${errorData.detail || 'Error del servidor'}`);
      }
    } catch (error) {
      console.error(`Error en acción ${action}:`, error);
      alert('Error de conexión al procesar la acción');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedReservations.length === 0) {
      alert('Selecciona al menos una reserva');
      return;
    }
    
    try {
      setActionLoading('bulk');
      
      // Procesar cada reserva seleccionada
      const promises = selectedReservations.map(reservationId => 
        handleReservationAction(reservationId, action)
      );
      
      await Promise.all(promises);
      
    } catch (error) {
      console.error('Error en acción masiva:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const toggleReservationSelection = (reservationId) => {
    setSelectedReservations(prev => 
      prev.includes(reservationId) 
        ? prev.filter(id => id !== reservationId)
        : [...prev, reservationId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedReservations.length === filteredReservations.length) {
      setSelectedReservations([]);
    } else {
      setSelectedReservations(filteredReservations.map(res => res.id));
    }
  };

  // Filtrar reservas
  const filteredReservations = reservations.filter(reservation => {
    const matchesStatus = filters.status === 'all' || reservation.status === filters.status;
    
    const searchTerm = filters.search.toLowerCase();
    const matchesSearch = searchTerm === '' || 
      (reservation.codigo_reserva && reservation.codigo_reserva.toLowerCase().includes(searchTerm)) ||
      (reservation.reservation_code && reservation.reservation_code.toLowerCase().includes(searchTerm)) ||
      (reservation.user?.first_name && reservation.user.first_name.toLowerCase().includes(searchTerm)) ||
      (reservation.user?.last_name && reservation.user.last_name.toLowerCase().includes(searchTerm)) ||
      (reservation.user?.vehicle_plate && reservation.user.vehicle_plate.toLowerCase().includes(searchTerm)) ||
      (reservation.vehicle_plate && reservation.vehicle_plate.toLowerCase().includes(searchTerm));
    
    return matchesStatus && matchesSearch;
  });

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP'
    }).format(amount || 0);
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return '--/--/---- --:--';
    return new Date(dateString).toLocaleString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return '--:--';
    return new Date(dateString).toLocaleTimeString('es-CO', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    const statuses = {
      active: { label: 'Activa', class: 'status-active', icon: 'fas fa-play-circle' },
      upcoming: { label: 'Próxima', class: 'status-upcoming', icon: 'fas fa-clock' },
      completed: { label: 'Completada', class: 'status-completed', icon: 'fas fa-check-circle' },
      cancelled: { label: 'Cancelada', class: 'status-cancelled', icon: 'fas fa-times-circle' },
      pending: { label: 'Pendiente', class: 'status-pending', icon: 'fas fa-hourglass-half' },
      confirmed: { label: 'Confirmada', class: 'status-confirmed', icon: 'fas fa-check-circle' },
      in_progress: { label: 'En Progreso', class: 'status-active', icon: 'fas fa-play-circle' },
      finished: { label: 'Finalizada', class: 'status-completed', icon: 'fas fa-check-circle' }
    };
    return statuses[status] || { label: status, class: 'status-unknown', icon: 'fas fa-question-circle' };
  };

  const getPaymentStatusBadge = (status) => {
    const statuses = {
      paid: { label: 'Pagado', class: 'payment-paid', icon: 'fas fa-check' },
      pending: { label: 'Pendiente', class: 'payment-pending', icon: 'fas fa-clock' },
      failed: { label: 'Fallido', class: 'payment-failed', icon: 'fas fa-times' },
      refunded: { label: 'Reembolsado', class: 'payment-refunded', icon: 'fas fa-undo' },
      partially_paid: { label: 'Pago Parcial', class: 'payment-partial', icon: 'fas fa-exclamation-circle' }
    };
    return statuses[status] || { label: status, class: 'payment-unknown', icon: 'fas fa-question' };
  };

  const calculateDuration = (start, end) => {
    if (!start || !end) return '--:--';
    const startTime = new Date(start);
    const endTime = new Date(end);
    const durationMs = endTime - startTime;
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}m`;
  };

  const handleExport = (type) => {
    alert(`Exportando ${type}...`);
    // Implementar exportación real según tu API
  };

  if (loading) {
    return (
      <div className="owner-reservations-loading">
        <div className="loading-spinner"></div>
        <p>Cargando reservas...</p>
      </div>
    );
  }

  return (
    <div className="owner-reservations">
      {/* 🔥 HEADER */}
      <div className="owner-reservations-header">
        <div className="header-content">
          <h1>Gestión de Reservas</h1>
          <p>Administra y controla todas las reservas de tu estacionamiento</p>
        </div>
        <button onClick={loadReservations} className="refresh-btn">
          <i className="fas fa-sync"></i>
          Actualizar
        </button>
      </div>

      {/* 📊 ESTADÍSTICAS RÁPIDAS */}
      <div className="reservations-stats">
        <div className="stat-card total">
          <div className="stat-icon">
            <i className="fas fa-calendar-alt"></i>
          </div>
          <div className="stat-content">
            <h3>{stats?.total || reservations.length}</h3>
            <p>Total Reservas</p>
          </div>
        </div>

        <div className="stat-card active">
          <div className="stat-icon">
            <i className="fas fa-play-circle"></i>
          </div>
          <div className="stat-content">
            <h3>{stats?.active || reservations.filter(r => r.status === 'active' || r.status === 'in_progress').length}</h3>
            <p>Activas Ahora</p>
          </div>
        </div>

        <div className="stat-card upcoming">
          <div className="stat-icon">
            <i className="fas fa-clock"></i>
          </div>
          <div className="stat-content">
            <h3>{stats?.upcoming || reservations.filter(r => r.status === 'upcoming' || r.status === 'confirmed').length}</h3>
            <p>Próximas</p>
          </div>
        </div>

        <div className="stat-card earnings">
          <div className="stat-icon">
            <i className="fas fa-money-bill-wave"></i>
          </div>
          <div className="stat-content">
            <h3>{formatCurrency(stats?.today_earnings)}</h3>
            <p>Ingresos Hoy</p>
          </div>
        </div>
      </div>

      {/* 🔍 FILTROS Y CONTROLES */}
      <div className="reservations-controls">
        <div className="filters-section">
          <div className="filter-group">
            <label>Filtrar por Estado:</label>
            <select 
              value={filters.status} 
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activas</option>
              <option value="upcoming">Próximas</option>
              <option value="completed">Completadas</option>
              <option value="cancelled">Canceladas</option>
              <option value="pending">Pendientes</option>
              <option value="confirmed">Confirmadas</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Filtrar por Fecha:</label>
            <input 
              type="date"
              value={filters.date}
              onChange={(e) => setFilters(prev => ({ ...prev, date: e.target.value }))}
            />
          </div>

          <div className="filter-group">
            <label>Buscar:</label>
            <input 
              type="text" 
              placeholder="Código, nombre o placa..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>
        </div>

        {/* 📦 ACCIONES MASIVAS */}
        {selectedReservations.length > 0 && (
          <div className="bulk-actions">
            <span>{selectedReservations.length} reservas seleccionadas</span>
            <div className="bulk-buttons">
              <button 
                className="btn-confirm"
                onClick={() => handleBulkAction('confirm')}
                disabled={actionLoading === 'bulk'}
              >
                {actionLoading === 'bulk' ? 'Procesando...' : 'Confirmar Seleccionadas'}
              </button>
              <button 
                className="btn-cancel"
                onClick={() => handleBulkAction('cancel')}
                disabled={actionLoading === 'bulk'}
              >
                {actionLoading === 'bulk' ? 'Procesando...' : 'Cancelar Seleccionadas'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 📋 LISTA DE RESERVAS */}
      <div className="reservations-list">
        {filteredReservations.length > 0 && (
          <div className="reservations-header">
            <div className="select-all">
              <input 
                type="checkbox"
                checked={selectedReservations.length === filteredReservations.length && filteredReservations.length > 0}
                onChange={toggleSelectAll}
              />
              <span>Seleccionar todas</span>
            </div>
            <div className="reservations-count">
              {filteredReservations.length} reserva{filteredReservations.length !== 1 ? 's' : ''}
            </div>
          </div>
        )}

        {filteredReservations.map(reservation => {
          const statusInfo = getStatusBadge(reservation.status);
          const paymentInfo = getPaymentStatusBadge(reservation.payment_status);
          const duration = calculateDuration(reservation.start_time, reservation.end_time);
          const reservationCode = reservation.codigo_reserva || reservation.reservation_code;
          
          return (
            <div key={reservation.id} className={`reservation-card ${reservation.status}`}>
              <div className="reservation-header">
                <div className="reservation-info">
                  <div className="reservation-code">
                    <h4>{reservationCode}</h4>
                    <span className="created-at">
                      Creada: {formatDateTime(reservation.created_at)}
                    </span>
                  </div>
                  
                  <div className="reservation-badges">
                    <span className={`status-badge ${statusInfo.class}`}>
                      <i className={statusInfo.icon}></i>
                      {statusInfo.label}
                    </span>
                    <span className={`payment-badge ${paymentInfo.class}`}>
                      <i className={paymentInfo.icon}></i>
                      {paymentInfo.label}
                    </span>
                  </div>
                </div>

                <div className="reservation-selection">
                  <input 
                    type="checkbox"
                    checked={selectedReservations.includes(reservation.id)}
                    onChange={() => toggleReservationSelection(reservation.id)}
                  />
                </div>
              </div>

              <div className="reservation-details">
                <div className="user-info">
                  <div className="user-main">
                    <strong>
                      {reservation.user?.first_name || 'Usuario'} {reservation.user?.last_name || ''}
                    </strong>
                    <span className="user-contact">
                      <i className="fas fa-phone"></i>
                      {reservation.user?.phone || reservation.phone || 'No disponible'}
                    </span>
                  </div>
                  <div className="vehicle-info">
                    <span className="vehicle-plate">
                      {reservation.user?.vehicle_plate || reservation.vehicle_plate || 'N/A'}
                    </span>
                    <span className="vehicle-model">
                      {reservation.user?.vehicle_model || reservation.vehicle_model || ''}
                    </span>
                  </div>
                </div>

                <div className="time-info">
                  <div className="time-slot">
                    <div className="time-item">
                      <i className="fas fa-play"></i>
                      <div>
                        <strong>Inicio</strong>
                        <span>{formatDateTime(reservation.start_time)}</span>
                        {reservation.actual_start_time && (
                          <small className="actual-time">
                            Real: {formatTime(reservation.actual_start_time)}
                          </small>
                        )}
                      </div>
                    </div>
                    
                    <div className="time-item">
                      <i className="fas fa-stop"></i>
                      <div>
                        <strong>Fin</strong>
                        <span>{formatDateTime(reservation.end_time)}</span>
                        {reservation.actual_end_time && (
                          <small className="actual-time">
                            Real: {formatTime(reservation.actual_end_time)}
                          </small>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="duration-info">
                    <span className="duration">{duration}</span>
                    <span className="spot">
                      Espacio: {reservation.parking_spot?.number || reservation.spot_number || 'N/A'}
                    </span>
                  </div>
                </div>

                <div className="payment-info">
                  <div className="amount">
                    <strong>{formatCurrency(reservation.amount)}</strong>
                    <span className="payment-method">
                      <i className={`fas fa-${reservation.payment_method === 'credit_card' ? 'credit-card' : reservation.payment_method === 'paypal' ? 'paypal' : 'money-bill'}`}></i>
                      {reservation.payment_method || 'No especificado'}
                    </span>
                  </div>
                </div>
              </div>

              {reservation.notes && (
                <div className="reservation-notes">
                  <i className="fas fa-sticky-note"></i>
                  <span>{reservation.notes}</span>
                </div>
              )}

              <div className="reservation-actions">
                {/* Acciones para reservas próximas/pendientes */}
                {(reservation.status === 'upcoming' || reservation.status === 'pending' || reservation.status === 'confirmed') && (
                  <>
                    <button 
                      className="btn-check-in"
                      onClick={() => handleReservationAction(reservation.id, 'check_in')}
                      disabled={actionLoading === reservation.id}
                    >
                      {actionLoading === reservation.id ? '...' : 'Check-in'}
                    </button>
                    <button 
                      className="btn-cancel"
                      onClick={() => handleReservationAction(reservation.id, 'cancel')}
                      disabled={actionLoading === reservation.id}
                    >
                      {actionLoading === reservation.id ? '...' : 'Cancelar'}
                    </button>
                  </>
                )}

                {/* Acciones para reservas activas */}
                {(reservation.status === 'active' || reservation.status === 'in_progress') && (
                  <button 
                    className="btn-check-out"
                    onClick={() => handleReservationAction(reservation.id, 'check_out')}
                    disabled={actionLoading === reservation.id}
                  >
                    {actionLoading === reservation.id ? '...' : 'Check-out'}
                  </button>
                )}

                {/* Acciones para todas las reservas */}
                <button 
                  className="btn-view"
                  onClick={() => setViewModal(reservation)}
                >
                  <i className="fas fa-eye"></i>
                  Detalles
                </button>
              </div>
            </div>
          );
        })}

        {filteredReservations.length === 0 && (
          <div className="no-reservations">
            <i className="fas fa-calendar-times"></i>
            <h3>No hay reservas</h3>
            <p>{reservations.length === 0 ? 'No hay reservas en tu estacionamiento' : 'No se encontraron reservas con los filtros aplicados'}</p>
            <button onClick={() => setFilters({ status: 'all', date: '', search: '' })} className="btn-clear-filters">
              Limpiar filtros
            </button>
          </div>
        )}
      </div>

      {/* 🌐 ACCIONES GLOBALES */}
      <div className="global-actions">
        <button 
          className="btn-export"
          onClick={() => handleExport('reservations')}
        >
          <i className="fas fa-download"></i>
          Exportar Reporte
        </button>
        
        <button 
          className="btn-print"
          onClick={() => window.print()}
        >
          <i className="fas fa-print"></i>
          Imprimir Lista
        </button>
      </div>

      {/* 🔍 MODAL DE DETALLES */}
      {viewModal && (
        <div className="modal-overlay" onClick={() => setViewModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Detalles de la Reserva</h2>
              <button className="close-btn" onClick={() => setViewModal(null)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="modal-body">
              <div className="detail-section">
                <h3>Información General</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <strong>Código:</strong>
                    <span>{viewModal.codigo_reserva || viewModal.reservation_code}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Estado:</strong>
                    <span className={`status-badge ${getStatusBadge(viewModal.status).class}`}>
                      {getStatusBadge(viewModal.status).label}
                    </span>
                  </div>
                  <div className="detail-item">
                    <strong>Pago:</strong>
                    <span className={`payment-badge ${getPaymentStatusBadge(viewModal.payment_status).class}`}>
                      {getPaymentStatusBadge(viewModal.payment_status).label}
                    </span>
                  </div>
                  <div className="detail-item">
                    <strong>Monto:</strong>
                    <span>{formatCurrency(viewModal.amount)}</span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Información del Cliente</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <strong>Nombre:</strong>
                    <span>{viewModal.user?.first_name || 'Usuario'} {viewModal.user?.last_name || ''}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Email:</strong>
                    <span>{viewModal.user?.email || viewModal.email || 'No disponible'}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Teléfono:</strong>
                    <span>{viewModal.user?.phone || viewModal.phone || 'No disponible'}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Vehículo:</strong>
                    <span>
                      {viewModal.user?.vehicle_model || viewModal.vehicle_model || 'Modelo no especificado'} 
                      ({viewModal.user?.vehicle_plate || viewModal.vehicle_plate || 'N/A'})
                    </span>
                  </div>
                </div>
              </div>

              <div className="detail-section">
                <h3>Detalles de Tiempo</h3>
                <div className="detail-grid">
                  <div className="detail-item">
                    <strong>Inicio Programado:</strong>
                    <span>{formatDateTime(viewModal.start_time)}</span>
                  </div>
                  <div className="detail-item">
                    <strong>Fin Programado:</strong>
                    <span>{formatDateTime(viewModal.end_time)}</span>
                  </div>
                  {viewModal.actual_start_time && (
                    <div className="detail-item">
                      <strong>Check-in Real:</strong>
                      <span>{formatDateTime(viewModal.actual_start_time)}</span>
                    </div>
                  )}
                  {viewModal.actual_end_time && (
                    <div className="detail-item">
                      <strong>Check-out Real:</strong>
                      <span>{formatDateTime(viewModal.actual_end_time)}</span>
                    </div>
                  )}
                </div>
              </div>

              {viewModal.notes && (
                <div className="detail-section">
                  <h3>Notas</h3>
                  <p>{viewModal.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ⚠️ DEBUG INFO */}
      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i>
          {error}
        </div>
      )}
    </div>
  );
};

export default OwnerReservations;