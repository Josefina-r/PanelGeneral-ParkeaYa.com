import React, { useState, useEffect } from 'react';
import './OwnerHome.css';

const OwnerHome = ({ userRole }) => {
  const [ownerData, setOwnerData] = useState(null);
  const [parkingData, setParkingData] = useState(null);
  const [recentReservations, setRecentReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timeRange, setTimeRange] = useState('today');

  const API_BASE = 'http://localhost:8000/api';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  useEffect(() => {
    loadOwnerDashboard();
  }, [timeRange]);

  const loadOwnerDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🏢 Cargando dashboard del propietario...');
      
      // Endpoint específico para dueños
      const response = await fetch(`${API_BASE}/parking/dashboard/owner/`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      console.log('📊 Response status owner:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Datos del owner:', data);
        setOwnerData(data);
        processOwnerData(data);
      } else {
        const errorText = await response.text();
        console.error('❌ Error en respuesta:', errorText);
        setError(`Error ${response.status} al cargar dashboard`);
      }
    } catch (error) {
      console.error('💥 Error cargando dashboard owner:', error);
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const processOwnerData = (data) => {
    // Procesar datos específicos del owner según la estructura de tu API
    if (data.parking) {
      setParkingData(data.parking);
    } else if (data.parking_lots && data.parking_lots.length > 0) {
      // Si la API devuelve un array de parking_lots, tomar el primero
      setParkingData(data.parking_lots[0]);
    }
    
    if (data.recent_reservations) {
      setRecentReservations(data.recent_reservations);
    } else if (data.reservations) {
      setRecentReservations(data.reservations);
    }
    
    // Si los datos vienen en el formato directo del dashboard
    if (data.business_name || data.total_earnings !== undefined) {
      setOwnerData(data);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-CO', {
      style: 'currency',
      currency: 'COP'
    }).format(amount || 0);
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
      confirmed: { label: 'Confirmada', class: 'status-active', icon: 'fas fa-check-circle' },
      in_progress: { label: 'En Progreso', class: 'status-active', icon: 'fas fa-play-circle' },
      finished: { label: 'Finalizada', class: 'status-completed', icon: 'fas fa-check-circle' }
    };
    return statuses[status] || { label: status, class: 'status-default', icon: 'fas fa-circle' };
  };

  const handleQuickAction = (action) => {
    switch(action) {
      case 'add_spot':
        alert('Agregar nuevo espacio...');
        break;
      case 'update_hours':
        alert('Actualizar horarios...');
        break;
      case 'view_reports':
        alert('Ver reportes...');
        break;
      case 'support':
        alert('Contactar soporte...');
        break;
      default:
        break;
    }
  };

  const handleReservationAction = (reservationId, action) => {
    switch(action) {
      case 'check_in':
        alert(`Check-in reserva ${reservationId}`);
        break;
      case 'check_out':
        alert(`Check-out reserva ${reservationId}`);
        break;
      case 'cancel':
        alert(`Cancelar reserva ${reservationId}`);
        break;
      default:
        break;
    }
  };

  if (loading) {
    return (
      <div className="owner-home-loading">
        <div className="loading-spinner"></div>
        <p>Cargando tu panel de control...</p>
      </div>
    );
  }

  return (
    <div className="owner-home">
      {/* HEADER CON INFORMACIÓN DEL NEGOCIO */}
      <div className="owner-header">
        <div className="business-info">
          <h1>{ownerData?.business_name || parkingData?.name || 'Mi Estacionamiento'}</h1>
          <p>Panel de control del propietario</p>
          <div className="business-stats">
            <span className="rating">
              <i className="fas fa-star"></i>
              {ownerData?.average_rating || 0} ⭐ ({ownerData?.total_reviews || 0} reseñas)
            </span>
            <span className="status active">
              <i className="fas fa-circle"></i>
              {parkingData?.status === 'active' ? 'Activo' : 'Inactivo'}
            </span>
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
          </select>
          <button onClick={loadOwnerDashboard} className="refresh-btn">
            <i className="fas fa-sync"></i>
            Actualizar
          </button>
        </div>
      </div>

      {/* MÉTRICAS PRINCIPALES DEL NEGOCIO */}
      <div className="business-metrics">
        <div className="metric-card earnings">
          <div className="metric-icon">
            <i className="fas fa-money-bill-wave"></i>
          </div>
          <div className="metric-content">
            <h3>{formatCurrency(ownerData?.today_earnings)}</h3>
            <p>Ingresos Hoy</p>
            <span className="metric-trend">
              {ownerData?.monthly_earnings ? 
                `${((ownerData.today_earnings / ownerData.monthly_earnings) * 100).toFixed(1)}% del mes` : 
                'Sin datos del mes'}
            </span>
          </div>
        </div>

        <div className="metric-card occupancy">
          <div className="metric-icon">
            <i className="fas fa-chart-pie"></i>
          </div>
          <div className="metric-content">
            <h3>{ownerData?.occupancy_rate || 0}%</h3>
            <p>Tasa de Ocupación</p>
            <div className="occupancy-bar">
              <div 
                className="occupancy-fill"
                style={{ width: `${ownerData?.occupancy_rate || 0}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="metric-card reservations">
          <div className="metric-icon">
            <i className="fas fa-calendar-check"></i>
          </div>
          <div className="metric-content">
            <h3>{ownerData?.active_reservations || 0}</h3>
            <p>Reservas Activas</p>
            <span className="metric-info">
              {ownerData?.completed_today || 0} completadas hoy
            </span>
          </div>
        </div>

        <div className="metric-card spots">
          <div className="metric-icon">
            <i className="fas fa-parking"></i>
          </div>
          <div className="metric-content">
            <h3>{parkingData?.available_spots || 0}/{parkingData?.total_spots || 0}</h3>
            <p>Espacios Disponibles</p>
            <span className="metric-info">
              {parkingData?.hourly_rate ? `$${parkingData.hourly_rate}/h` : 'Tarifa no configurada'}
            </span>
          </div>
        </div>
      </div>

      <div className="owner-content">
        {/* ACCIONES RÁPIDAS */}
        <div className="quick-actions-section">
          <h2>Acciones Rápidas</h2>
          <div className="quick-actions-grid">
            <button 
              className="quick-action-btn manage-spots"
              onClick={() => handleQuickAction('add_spot')}
            >
              <i className="fas fa-plus-circle"></i>
              <span>Gestionar Espacios</span>
              <small>Agregar/editar espacios</small>
            </button>

            <button 
              className="quick-action-btn update-hours"
              onClick={() => handleQuickAction('update_hours')}
            >
              <i className="fas fa-clock"></i>
              <span>Horarios</span>
              <small>Configurar horario</small>
            </button>

            <button 
              className="quick-action-btn reports"
              onClick={() => handleQuickAction('view_reports')}
            >
              <i className="fas fa-chart-bar"></i>
              <span>Reportes</span>
              <small>Ver métricas</small>
            </button>

            <button 
              className="quick-action-btn support"
              onClick={() => handleQuickAction('support')}
            >
              <i className="fas fa-headset"></i>
              <span>Soporte</span>
              <small>Ayuda y soporte</small>
            </button>
          </div>
        </div>

        <div className="content-grid">
          {/* RESERVAS RECIENTES */}
          <div className="reservations-section">
            <div className="section-header">
              <h2>Reservas Recientes</h2>
              <button className="view-all-btn">
                Ver Todas
              </button>
            </div>
            
            <div className="reservations-list">
              {recentReservations.length > 0 ? (
                recentReservations.map(reservation => {
                  const statusInfo = getStatusBadge(reservation.status);
                  
                  return (
                    <div key={reservation.id} className={`reservation-card ${reservation.status}`}>
                      <div className="reservation-header">
                        <div className="user-info">
                          <strong>
                            {reservation.user?.first_name || 'Usuario'} {reservation.user?.last_name || ''}
                          </strong>
                          <small>Placa: {reservation.user?.vehicle_plate || reservation.vehicle_plate || 'N/A'}</small>
                        </div>
                        <span className={`status-badge ${statusInfo.class}`}>
                          <i className={statusInfo.icon}></i>
                          {statusInfo.label}
                        </span>
                      </div>
                      
                      <div className="reservation-details">
                        <div className="detail-item">
                          <i className="fas fa-map-marker-alt"></i>
                          <span>Espacio {reservation.spot_number || reservation.parking_spot || 'N/A'}</span>
                        </div>
                        <div className="detail-item">
                          <i className="fas fa-clock"></i>
                          <span>{formatTime(reservation.start_time)} - {formatTime(reservation.end_time)}</span>
                        </div>
                        <div className="detail-item">
                          <i className="fas fa-money-bill"></i>
                          <strong>{formatCurrency(reservation.amount)}</strong>
                        </div>
                      </div>
                      
                      <div className="reservation-actions">
                        {(reservation.status === 'upcoming' || reservation.status === 'confirmed') && (
                          <button 
                            className="btn-check-in"
                            onClick={() => handleReservationAction(reservation.id, 'check_in')}
                          >
                            <i className="fas fa-sign-in-alt"></i>
                            Check-in
                          </button>
                        )}
                        
                        {(reservation.status === 'active' || reservation.status === 'in_progress') && (
                          <button 
                            className="btn-check-out"
                            onClick={() => handleReservationAction(reservation.id, 'check_out')}
                          >
                            <i className="fas fa-sign-out-alt"></i>
                            Check-out
                          </button>
                        )}
                        
                        {(reservation.status === 'upcoming' || reservation.status === 'confirmed' || reservation.status === 'active') && (
                          <button 
                            className="btn-cancel"
                            onClick={() => handleReservationAction(reservation.id, 'cancel')}
                          >
                            <i className="fas fa-times"></i>
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="no-reservations">
                  <i className="fas fa-calendar-times"></i>
                  <p>No hay reservas recientes</p>
                </div>
              )}
            </div>
          </div>

          {/* INFORMACIÓN DEL ESTACIONAMIENTO */}
          <div className="parking-info-section">
            <div className="info-card">
              <h3>Información del Estacionamiento</h3>
              
              <div className="info-item">
                <strong>Dirección:</strong>
                <p>{parkingData?.address || 'No configurada'}</p>
              </div>
              
              <div className="info-item">
                <strong>Espacios Totales:</strong>
                <span>{parkingData?.total_spots || 0} espacios</span>
              </div>
              
              <div className="info-item">
                <strong>Tarifa por Hora:</strong>
                <span>{parkingData?.hourly_rate ? `$${parkingData.hourly_rate}` : 'No configurada'}</span>
              </div>
              
              <div className="info-item">
                <strong>Características:</strong>
                <div className="features-list">
                  {parkingData?.features && parkingData.features.length > 0 ? (
                    parkingData.features.map(feature => (
                      <span key={feature} className="feature-tag">
                        <i className="fas fa-check"></i>
                        {feature}
                      </span>
                    ))
                  ) : (
                    <span>No hay características configuradas</span>
                  )}
                </div>
              </div>
              
              <div className="info-item">
                <strong>Horario de Operación:</strong>
                <div className="operating-hours">
                  {parkingData?.operating_hours ? (
                    Object.entries(parkingData.operating_hours).map(([day, hours]) => (
                      <div key={day} className="hour-item">
                        <span className="day">{day.charAt(0).toUpperCase() + day.slice(1)}:</span>
                        <span className="hours">{hours.open} - {hours.close}</span>
                      </div>
                    ))
                  ) : (
                    <span>No configurado</span>
                  )}
                </div>
              </div>
            </div>

            {/* CONTACTOS DE EMERGENCIA */}
            <div className="emergency-card">
              <h3>Contactos de Emergencia</h3>
              <div className="emergency-contacts">
                <div className="contact-item">
                  <i className="fas fa-phone"></i>
                  <div>
                    <strong>Soporte Parkeaya</strong>
                    <span>+57 1 800 123 4567</span>
                  </div>
                </div>
                <div className="contact-item">
                  <i className="fas fa-shield-alt"></i>
                  <div>
                    <strong>Seguridad</strong>
                    <span>+57 123 456 7890</span>
                  </div>
                </div>
                <div className="contact-item">
                  <i className="fas fa-tools"></i>
                  <div>
                    <strong>Mantenimiento</strong>
                    <span>+57 987 654 3210</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* DEBUG INFO */}
      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i>
          {error}
        </div>
      )}
    </div>
  );
};

export default OwnerHome;