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
      
      // Endpoint completo específico para dueños (más detalles: parkings, stats, charts)
      const response = await fetch(`${API_BASE}/parking/dashboard/owner/complete/`, {
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
   
    if (data && data.stats && data.parkings) {
      // owner info
      const userInfo = data.user || {};
      const stats = data.stats || {};

      const mappedOwner = {
        business_name: userInfo.name || userInfo.username || userInfo.email || 'Mi Estacionamiento',
        email: userInfo.email,
        average_rating: stats.average_rating || 0,
        total_reviews: stats.total_reviews || 0,
        today_earnings: stats.today_revenue || stats.today_revenue || 0,
        monthly_earnings: stats.monthly_revenue || stats.monthly_revenue || 0,
        occupancy_rate: stats.total_spaces ? Math.round(((stats.total_spaces - (stats.available_spaces || 0)) / (stats.total_spaces || 1)) * 100) : 0,
        active_reservations: stats.active_reservations || 0,
        completed_today: stats.completed_today || 0
      };

      setOwnerData(mappedOwner);

      const parkings = data.parkings || [];
      const available = parkings.filter(p => (p.aprobado || p.approved) && (p.activo === undefined ? true : p.activo) && (p.plazas_disponibles !== undefined ? (p.plazas_disponibles > 0) : true));
      const chosen = available.length > 0 ? available[0] : (parkings.length > 0 ? parkings[0] : null);

      const normalizedParking = chosen ? {
        id: chosen.id,
        name: chosen.nombre || chosen.name || '',
        address: chosen.direccion || chosen.address || '',
        total_spots: chosen.total_plazas || chosen.total_spots || 0,
        available_spots: chosen.plazas_disponibles || chosen.available_spots || 0,
        hourly_rate: chosen.tarifa_hora || chosen.hourly_rate || null,
        porcentaje_ocupacion: chosen.porcentaje_ocupacion || 0,
        aprobado: chosen.aprobado,
        activo: chosen.activo
      } : null;

      setParkingData(normalizedParking);

      // recientes
      const recent = (data.recent_activity && data.recent_activity.today_reservations) || [];
      setRecentReservations(recent);

      return;
    }

    if (data.parking) {
      setParkingData(data.parking);
    } else if (data.parking_lots && data.parking_lots.length > 0) {
      setParkingData(data.parking_lots[0]);
    }

    if (data.recent_reservations) {
      setRecentReservations(data.recent_reservations);
    } else if (data.reservations) {
      setRecentReservations(data.reservations);
    }

    if (data.business_name || data.total_earnings !== undefined) {
      setOwnerData(data);
    }
  };

  const formatCurrency = (amount) => {
    // Mostrar en Soles (PEN) con símbolo S/
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
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
              {(parkingData?.activo === undefined ? true : parkingData?.activo) ? 'Activo' : 'Inactivo'}
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
              {parkingData?.hourly_rate ? `${formatCurrency(parkingData.hourly_rate)}/h` : 'Tarifa no configurada'}
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

              <div className="parking-info-table-wrapper">
                <table className="parking-info-table">
                  <tbody>
                    <tr>
                      <th>Dirección</th>
                      <td>{parkingData?.address || 'No configurada'}</td>
                    </tr>
                    <tr>
                      <th>Espacios Totales</th>
                      <td>{parkingData?.total_spots || 0} espacios</td>
                    </tr>
                    <tr>
                      <th>Plazas Disponibles</th>
                      <td>{parkingData?.available_spots || 0}</td>
                    </tr>
                    <tr>
                      <th>Tarifa por Hora</th>
                      <td>{parkingData?.hourly_rate ? formatCurrency(parkingData.hourly_rate) : 'No configurada'}</td>
                    </tr>
                    <tr>
                      <th>% Ocupación</th>
                      <td>{parkingData?.porcentaje_ocupacion ? `${parkingData.porcentaje_ocupacion}%` : '0%'}</td>
                    </tr>
                    <tr>
                      <th>Características</th>
                      <td>
                        {parkingData?.features && parkingData.features.length > 0 ? (
                          <div className="features-inline">
                            {parkingData.features.map(f => (
                              <span key={f} className="feature-inline-tag">{f}</span>
                            ))}
                          </div>
                        ) : (
                          'No hay características'
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default OwnerHome;