import React, { useState, useEffect } from 'react';
import './AdminParking.css';

const AdminParking = ({ userRole }) => {
  const [parkings, setParkings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    search: ''
  });
  const [actionLoading, setActionLoading] = useState(null);
  const [viewModal, setViewModal] = useState(null);

  const API_BASE = 'http://localhost:8000/api';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  useEffect(() => {
    loadParkings();
  }, [filters.status]);

  // Cargar todos los estacionamientos - ENDPOINTS CORREGIDOS
  const loadParkings = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Cargando estacionamientos...');

      let allParkings = [];

      // INTENTAR ENDPOINT PRINCIPAL DE PARKINGS
      try {
        const response = await fetch(`${API_BASE}/parking/parkings/`, {
          headers: getAuthHeaders()
        });

        if (response.ok) {
          const data = await response.json();
          // Manejar tanto array como objeto con results
          allParkings = Array.isArray(data) ? data : (data.results || []);
          console.log('✅ Parkings cargados:', allParkings.length);
          // Cargar siempre las approval requests y mezclarlas con la lista principal
          try {
            const approvalRequests = await loadApprovalRequests();
            if (approvalRequests.length > 0) {
              // Evitar duplicados por id (si estacionamiento_creado coincide con ParkingLot id)
              const map = {};
              // primero las approval requests (pendientes) para mostrarlas arriba
              approvalRequests.forEach(p => { map[String(p.id)] = p; });
              allParkings.forEach(p => { map[String(p.id)] = p; });
              allParkings = Object.values(map);
              console.log('ℹ️ Parkings combinado con approval requests:', allParkings.length);
            }
          } catch (e) {
            console.warn('No se pudieron fusionar approval requests:', e);
          }
        } else {
          console.warn('❌ Error cargando parkings principales:', response.status);
        }
      } catch (error) {
        console.error('💥 Error cargando parkings principales:', error);
      }

      // Si no hay datos, intentar endpoints específicos
      if (allParkings.length === 0) {
        console.log('🔄 Intentando endpoints específicos...');
        allParkings = await loadFromSpecificEndpoints();
      }

      console.log('📊 Total parkings cargados:', allParkings.length);
      setParkings(allParkings);

    } catch (error) {
      console.error('💥 Error general cargando parkings:', error);
      setError('Error de conexión con el servidor');
      setParkings([]);
    } finally {
      setLoading(false);
    }
  };

  // Cargar desde endpoints específicos
  const loadFromSpecificEndpoints = async () => {
    let combinedParkings = [];

    try {
      // CARGAR PARKINGS PENDIENTES (endpoint corregido)
      const pendingResponse = await fetch(`${API_BASE}/parking/admin/pending-parkings/`, {
        headers: getAuthHeaders()
      });

      if (pendingResponse.ok) {
        const pendingData = await pendingResponse.json();
        const pendingWithStatus = Array.isArray(pendingData)
          ? pendingData.map(p => ({ ...p, status: 'pending', isApprovalRequest: false }))
          : [];
        combinedParkings = [...combinedParkings, ...pendingWithStatus];
        console.log('✅ Pendientes cargados:', pendingWithStatus.length);
      }
    } catch (error) {
      console.error('Error cargando pendientes:', error);
    }

    try {
      // CARGAR PARKINGS APROBADOS (endpoint corregido)
      const approvedResponse = await fetch(`${API_BASE}/parking/admin/approved-parkings/`, {
        headers: getAuthHeaders()
      });

      if (approvedResponse.ok) {
        const approvedData = await approvedResponse.json();
        const approvedWithStatus = Array.isArray(approvedData)
          ? approvedData.map(p => ({ ...p, status: 'active', isApprovalRequest: false }))
          : [];
        combinedParkings = [...combinedParkings, ...approvedWithStatus];
        console.log('✅ Aprobados cargados:', approvedWithStatus.length);
      }

    // También cargar approval requests (si el owner envía requests en vez de crear ParkingLot)
    try {
      const approvalRequests = await loadApprovalRequests();
      if (approvalRequests.length > 0) {
        combinedParkings = [...approvalRequests, ...combinedParkings];
        console.log('✅ Approval requests cargadas:', approvalRequests.length);
      }
    } catch (e) {
      console.warn('No se pudieron cargar approval requests en loadFromSpecificEndpoints:', e);
    }
    } catch (error) {
      console.error('Error cargando aprobados:', error);
    }

    return combinedParkings;
  };

  // Intentar también cargar solicitudes de aprobación (por si la app local usa ApprovalRequest)
  const loadApprovalRequests = async () => {
    try {
      const resp = await fetch(`${API_BASE}/parking/approval/requests/pendientes/`, {
        headers: getAuthHeaders()
      });
      if (resp.ok) {
          const data = await resp.json();
          const mapped = Array.isArray(data) ? data.map(r => ({
            // Use estacionamiento_creado id when available, otherwise unique req id
            id: r.estacionamiento_creado ? r.estacionamiento_creado : `req-${r.id}`,
            approvalRequestId: r.id,
            estacionamiento_creado_id: r.estacionamiento_creado,
            nombre: r.nombre,
            direccion: r.direccion,
            tarifa_hora: r.tarifa_hora,
            total_plazas: r.total_plazas,
            plazas_disponibles: r.plazas_disponibles,
            propietario: r.solicitado_por ? { id: r.solicitado_por, username: r.solicitado_por_nombre } : null,
            status: 'pending',
            isApprovalRequest: true,
            panel_local_id: r.panel_local_id
          })) : [];
          return mapped;
        }
    } catch (e) {
      console.warn('No se pudo cargar approval requests:', e);
    }
    return [];
  };

  // Aprobar estacionamiento - ENDPOINTS CORREGIDOS
  const handleApproveParking = async (parkingId, parking) => {
    try {
      setActionLoading(parkingId);

      console.log(`🔄 Aprobando parking ${parkingId}...`);
      console.log('Objeto parking:', parking);

      let endpoint;

      // DETERMINAR ENDPOINT CORRECTO
      if (parking.isApprovalRequest) {
        // Es una solicitud de aprobación enviada por el owner
        endpoint = `${API_BASE}/parking/approval/requests/${parking.approvalRequestId}/aprobar/`;
      } else if (parking.status === 'pending' || !parking.aprobado) {
        // Parking pendiente - usar endpoint de aprobación
        endpoint = `${API_BASE}/parking/parkings/${parkingId}/approve/`;
      } else {
        // Ya está aprobado pero puede necesitar activación
        endpoint = `${API_BASE}/parking/parkings/${parkingId}/toggle_activation/`;
      }

      console.log('🎯 Endpoint:', endpoint);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      console.log('📊 Response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Acción completada:', result);
        showNotification('Operación completada exitosamente', 'success');
        await loadParkings();
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Error en la operación:', errorData);

        // INTENTAR MÉTODO ALTERNATIVO
        if (await tryAlternativeApprove(parkingId, parking)) {
          return;
        }

        showNotification(`Error: ${errorData.detail || errorData.error || 'Error desconocido'}`, 'error');
      }
    } catch (error) {
      console.error('💥 Error en la operación:', error);
      showNotification('Error de conexión', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Método alternativo de aprobación
  const tryAlternativeApprove = async (parkingId, parking) => {
    try {
      console.log('🔄 Intentando método alternativo...');

      // Método 1: PATCH directo para aprobar
      const patchData = {
        aprobado: true,
        activo: true
      };

      if (parking.isApprovalRequest) {
        // Si es una solicitud, intentar endpoint de aprobar solicitud
        const resp = await fetch(`${API_BASE}/parking/approval/requests/${parking.approvalRequestId}/aprobar/`, {
          method: 'POST',
          headers: getAuthHeaders()
        });
        if (resp.ok) {
          console.log('✅ Aprobada solicitud mediante endpoint de aprobar');
          showNotification('Solicitud aprobada correctamente', 'success');
          await loadParkings();
          return true;
        }
        return false;
      }

      const patchResponse = await fetch(`${API_BASE}/parking/parkings/${parkingId}/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(patchData)
      });

      if (patchResponse.ok) {
        console.log('✅ Aprobado mediante PATCH directo');
        showNotification('Parking aprobado correctamente', 'success');
        await loadParkings();
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Error en método alternativo:', error);
      return false;
    }
  };

  // Rechazar estacionamiento - ENDPOINT CORREGIDO
  const handleRejectParking = async (parkingId, parking) => {
    if (!window.confirm(`¿Estás seguro de que quieres rechazar el parking "${parking.nombre}"?`)) {
      return;
    }

    try {
      setActionLoading(parkingId);

      console.log(`🔄 Rechazando parking ${parkingId}...`);

      // Usar endpoint de rechazo
      let endpoint;
      if (parking.isApprovalRequest) {
        endpoint = `${API_BASE}/parking/approval/requests/${parking.approvalRequestId}/rechazar/`;
      } else {
        endpoint = `${API_BASE}/parking/parkings/${parkingId}/reject/`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      console.log('📊 Response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Parking rechazado:', result);
        showNotification('Parking rechazado correctamente', 'success');
        await loadParkings();
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Error rechazando parking:', errorData);

        // Si el rechazo falla, intentar eliminar
        if (await tryAlternativeReject(parkingId)) {
          return;
        }

        showNotification(`Error: ${errorData.detail || 'No se pudo rechazar'}`, 'error');
      }
    } catch (error) {
      console.error('💥 Error rechazando parking:', error);
      showNotification('Error al rechazar parking', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Método alternativo de rechazo (eliminar)
  const tryAlternativeReject = async (parkingId) => {
    try {
      console.log('🔄 Intentando eliminar parking...');

      // Si es una approval request, intentar rechazarla vía API
      // parkingId may be like 'req-<id>' when mapped; try to detect
      if (typeof parkingId === 'string' && parkingId.startsWith('req-')) {
        const reqId = parkingId.replace('req-', '');
        const resp = await fetch(`${API_BASE}/parking/approval/requests/${reqId}/rechazar/`, {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ motivo: 'Rechazo desde panel admin' })
        });
        if (resp.ok) {
          console.log('✅ Solicitud de approval rechazada');
          showNotification('Solicitud rechazada correctamente', 'success');
          await loadParkings();
          return true;
        }
        return false;
      }

      const deleteResponse = await fetch(`${API_BASE}/parking/parkings/${parkingId}/`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      if (deleteResponse.ok) {
        console.log('✅ Parking eliminado');
        showNotification('Parking eliminado correctamente', 'success');
        await loadParkings();
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Error eliminando parking:', error);
      return false;
    }
  };

  // Suspender/Activar estacionamiento - ENDPOINT CORREGIDO
  const handleToggleParkingStatus = async (parkingId, currentStatus) => {
    try {
      setActionLoading(parkingId);

      console.log(`🔄 Cambiando estado de parking ${parkingId}...`);

      // Usar el endpoint toggle_activation
      const response = await fetch(`${API_BASE}/parking/parkings/${parkingId}/toggle_activation/`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      console.log('📊 Response status:', response.status);

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Estado cambiado:', result);
        showNotification(`Parking ${currentStatus === 'active' ? 'suspendido' : 'activado'}`, 'success');
        await loadParkings();
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Error cambiando estado:', errorData);
        showNotification(`Error: ${errorData.detail || 'No se pudo cambiar el estado'}`, 'error');
      }
    } catch (error) {
      console.error('💥 Error cambiando estado:', error);
      showNotification('Error de conexión al cambiar estado', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  // Función para mostrar notificaciones
  const showNotification = (message, type) => {
    // Usar el sistema de notificaciones de tu aplicación
    if (window.showDashboardNotification) {
      window.showDashboardNotification(message, type);
    } else {
      // Fallback simple
      const notification = document.createElement('div');
      notification.className = `dashboard-notification ${type}`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        color: white;
        background: ${type === 'success' ? '#10b981' : '#ef4444'};
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      `;
      notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check' : 'exclamation'}-circle"></i>
        <span style="margin-left: 8px;">${message}</span>
      `;
      document.body.appendChild(notification);

      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 5000);
    }
  };

  // Función mejorada para obtener datos del propietario
  const getOwnerInfo = (parking) => {
    // Manejar diferentes estructuras de datos
    if (parking.propietario) {
      if (typeof parking.propietario === 'object') {
        return {
          name: parking.propietario.first_name && parking.propietario.last_name
            ? `${parking.propietario.first_name} ${parking.propietario.last_name}`
            : parking.propietario.username || parking.propietario.email || 'Propietario',
          email: parking.propietario.email || 'No disponible',
          username: parking.propietario.username || 'N/A'
        };
      }
    }

    if (parking.dueno) {
      if (typeof parking.dueno === 'object') {
        return {
          name: parking.dueno.first_name && parking.dueno.last_name
            ? `${parking.dueno.first_name} ${parking.dueno.last_name}`
            : parking.dueno.username || parking.dueno.email || 'Propietario',
          email: parking.dueno.email || 'No disponible',
          username: parking.dueno.username || 'N/A'
        };
      }
    }

    // Si no hay propietario en los datos
    return {
      name: 'Propietario no disponible',
      email: 'No disponible',
      username: 'N/A'
    };
  };

  // Función mejorada para obtener características
  const getFeatures = (parking) => {
    if (parking.servicios && Array.isArray(parking.servicios)) {
      return parking.servicios.slice(0, 3); // Mostrar solo 3 características
    }
    if (parking.features && Array.isArray(parking.features)) {
      return parking.features.slice(0, 3);
    }
    if (parking.nivel_seguridad) {
      return [`Seguridad: ${parking.nivel_seguridad}`];
    }
    return ['Sin características'];
  };

  // Función mejorada para obtener estado
  const getParkingStatus = (parking) => {
    // Usar el status que viene del backend
    if (parking.status) return parking.status;

    // Si no viene status, determinar basado en aprobado y activo
    if (parking.aprobado !== undefined) {
      if (!parking.aprobado) return 'pending';
      return parking.activo ? 'active' : 'suspended';
    }

    return 'pending';
  };

  // Filtrar estacionamientos
  const filteredParkings = parkings.filter(parking => {
    const parkingStatus = getParkingStatus(parking);
    const ownerInfo = getOwnerInfo(parking);

    const matchesStatus = filters.status === 'all' || parkingStatus === filters.status;
    const matchesSearch = filters.search === '' ||
      (parking.nombre || parking.name || '').toLowerCase().includes(filters.search.toLowerCase()) ||
      (parking.direccion || parking.address || '').toLowerCase().includes(filters.search.toLowerCase()) ||
      ownerInfo.name.toLowerCase().includes(filters.search.toLowerCase());

    return matchesStatus && matchesSearch;
  });

  const getStatusBadge = (status) => {
    const statuses = {
      active: { label: 'Activo', class: 'status-active' },
      pending: { label: 'Pendiente', class: 'status-pending' },
      suspended: { label: 'Suspendido', class: 'status-suspended' },
      rejected: { label: 'Rechazado', class: 'status-rejected' }
    };

    return statuses[status] || { label: status, class: 'status-default' };
  };

  const getOccupancyRate = (parking) => {
    const total = parking.total_plazas || parking.total_spots || 1;
    const available = parking.plazas_disponibles || parking.available_spots || 0;
    const occupied = total - available;
    return Math.round((occupied / total) * 100);
  };

  if (loading) {
    return (
      <div className="admin-parking-loading">
        <div className="loading-spinner"></div>
        <p>Cargando gestión de estacionamientos...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-parking-error">
        <div className="error-icon">⚠️</div>
        <h3>Error al cargar los datos</h3>
        <p>{error}</p>
        <button onClick={loadParkings} className="btn-retry">
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="admin-parking">
      {/* HEADER */}
      <div className="admin-parking-header">
        <div className="header-content">
          <h1>Gestión de Estacionamientos</h1>
          <p>Administra todos los estacionamientos de la plataforma</p>
        </div>
        <button onClick={loadParkings} className="refresh-btn" disabled={loading}>
          <i className="fas fa-sync"></i>
          {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>

      {/* RESUMEN ESTADÍSTICAS */}
      <div className="parking-stats">
        <div className="stat-card">
          <div className="stat-value">{parkings.length}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {parkings.filter(p => getParkingStatus(p) === 'active').length}
          </div>
          <div className="stat-label">Activos</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {parkings.filter(p => getParkingStatus(p) === 'pending').length}
          </div>
          <div className="stat-label">Pendientes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {parkings.filter(p => getParkingStatus(p) === 'suspended').length}
          </div>
          <div className="stat-label">Suspendidos</div>
        </div>
      </div>

      {/* FILTROS Y BÚSQUEDA */}
      <div className="parking-controls">
        <div className="filters-section">
          <div className="filter-group">
            <label>Estado:</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="all">Todos</option>
              <option value="active">Activos</option>
              <option value="pending">Pendientes</option>
              <option value="suspended">Suspendidos</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Buscar:</label>
            <input
              type="text"
              placeholder="Nombre, dirección o propietario..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>
        </div>
      </div>

      {/* TABLA DE ESTACIONAMIENTOS */}
      <div className="parking-table-container">
        {filteredParkings.length === 0 ? (
          <div className="no-parkings">
            <i className="fas fa-parking"></i>
            <h3>No se encontraron estacionamientos</h3>
            <p>No hay estacionamientos que coincidan con los filtros aplicados</p>
          </div>
        ) : (
          <table className="parking-table">
            <thead>
              <tr>
                <th>Estacionamiento</th>
                <th>Propietario</th>
                <th>Ubicación</th>
                <th>Espacios</th>
                <th>Ocupación</th>
                <th>Tarifa</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredParkings.map(parking => {
                const parkingStatus = getParkingStatus(parking);
                const statusBadge = getStatusBadge(parkingStatus);
                const occupancyRate = getOccupancyRate(parking);
                const ownerInfo = getOwnerInfo(parking);
                const features = getFeatures(parking);

                return (
                  <tr key={parking.id} className={`parking-row parking-${parkingStatus}`}>
                    <td>
                      <div className="parking-name">
                        <strong>{parking.nombre || parking.name || 'Sin nombre'}</strong>
                        <div className="parking-features">
                          {features.map((feature, index) => (
                            <span key={index} className="feature-tag">{feature}</span>
                          ))}
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="owner-info">
                        <strong>{ownerInfo.name}</strong>
                        <small>{ownerInfo.email}</small>
                      </div>
                    </td>
                    <td className="address-cell">
                      {parking.direccion || parking.address || 'Dirección no disponible'}
                    </td>
                    <td>
                      <div className="spots-info">
                        <span className="available">
                          {parking.plazas_disponibles || parking.available_spots || 0} disp.
                        </span>
                        <span className="total">
                          / {parking.total_plazas || parking.total_spots || 0} total
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="occupancy-bar">
                        <div
                          className="occupancy-fill"
                          style={{ width: `${occupancyRate}%` }}
                        ></div>
                        <span>{occupancyRate}%</span>
                      </div>
                    </td>
                    <td>
                      <strong>S/ {parking.tarifa_hora || parking.hourly_rate || 0}/h</strong>
                    </td>
                    <td>
                      <span className={`status-badge ${statusBadge.class}`}>
                        {statusBadge.label}
                      </span>
                    </td>
                    <td>
                      <div className="parking-actions">
                        {/* Acciones para pendientes */}
                        {parkingStatus === 'pending' && (
                          <>
                            <button
                              className="btn-approve"
                              onClick={() => handleApproveParking(parking.id, parking)}
                              disabled={actionLoading === parking.id}
                              title="Aprobar parking"
                            >
                              {actionLoading === parking.id ? '...' : '✓ Aprobar'}
                            </button>
                            <button
                              className="btn-reject"
                              onClick={() => handleRejectParking(parking.id, parking)}
                              disabled={actionLoading === parking.id}
                              title="Rechazar parking"
                            >
                              {actionLoading === parking.id ? '...' : '✗ Rechazar'}
                            </button>
                          </>
                        )}

                        {/* Acciones para activos/suspendidos */}
                        {(parkingStatus === 'active' || parkingStatus === 'suspended') && (
                          <button
                            className={parkingStatus === 'active' ? 'btn-suspend' : 'btn-activate'}
                            onClick={() => handleToggleParkingStatus(parking.id, parkingStatus)}
                            disabled={actionLoading === parking.id}
                            title={parkingStatus === 'active' ? 'Suspender' : 'Activar'}
                          >
                            {actionLoading === parking.id ? '...' :
                              parkingStatus === 'active' ? '⏸ Suspender' : '▶ Activar'}
                          </button>
                        )}

                        <button
                          className="btn-view"
                          onClick={() => setViewModal(parking)}
                          title="Ver detalles"
                        >
                          <i className="fas fa-eye"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* MODAL DE DETALLES */}
      {viewModal && (
        <div className="modal-overlay" onClick={() => setViewModal(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Detalles del Estacionamiento</h2>
              <button className="close-btn" onClick={() => setViewModal(null)}>
                <i className="fas fa-times"></i>
              </button>
            </div>
            <div className="modal-body">
              <h3>{viewModal.nombre || viewModal.name}</h3>

              <div className="detail-grid">
                <div className="detail-item">
                  <label>Dirección:</label>
                  <span>{viewModal.direccion || viewModal.address || 'No disponible'}</span>
                </div>

                <div className="detail-item">
                  <label>Descripción:</label>
                  <span>{viewModal.descripcion || 'Sin descripción'}</span>
                </div>

                <div className="detail-item">
                  <label>Teléfono:</label>
                  <span>{viewModal.telefono || 'No disponible'}</span>
                </div>

                <div className="detail-item">
                  <label>Horario:</label>
                  <span>{viewModal.horario_apertura || 'N/A'} - {viewModal.horario_cierre || 'N/A'}</span>
                </div>

                <div className="detail-item">
                  <label>Espacios:</label>
                  <span>{viewModal.plazas_disponibles || 0} disponibles de {viewModal.total_plazas || 0}</span>
                </div>

                <div className="detail-item">
                  <label>Tarifa:</label>
                  <span>S/ {viewModal.tarifa_hora || 0} por hora</span>
                </div>

                <div className="detail-item">
                  <label>Seguridad:</label>
                  <span>{viewModal.nivel_seguridad || 'Estándar'}</span>
                </div>

                <div className="detail-item">
                  <label>Estado:</label>
                  <span className={`status-badge ${getStatusBadge(getParkingStatus(viewModal)).class}`}>
                    {getStatusBadge(getParkingStatus(viewModal)).label}
                  </span>
                </div>

                <div className="detail-item">
                  <label>Propietario:</label>
                  <span>{getOwnerInfo(viewModal).name} ({getOwnerInfo(viewModal).email})</span>
                </div>
              </div>

              <div className="features-section">
                <h4>Características:</h4>
                <div className="features-list">
                  {getFeatures(viewModal).map((feature, index) => (
                    <span key={index} className="feature-tag">{feature}</span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminParking;