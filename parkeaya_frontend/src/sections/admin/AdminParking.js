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

  // Cargar todos los estacionamientos CORREGIDO
  const loadParkings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Cargando estacionamientos desde nuevos endpoints...');
      
      let pendingParkings = [];
      let approvedParkings = [];

      // CARGAR PENDIENTES desde nuevo endpoint
      try {
        const pendingResponse = await fetch(`${API_BASE}/parking/admin/pending-parkings/`, {
          headers: getAuthHeaders()
        });
        
        if (pendingResponse.ok) {
          const pendingData = await pendingResponse.json();
          pendingParkings = Array.isArray(pendingData) ? pendingData : [];
          console.log('✅ Pendientes cargados (ParkingLot):', pendingParkings.length);
        } else {
          console.warn('❌ Error cargando pendientes (ParkingLot):', pendingResponse.status);
        }
      } catch (error) {
        console.error('💥 Error cargando pendientes:', error);
      }

      // CARGAR SOLICITUDES DE APROBACIÓN (creadas por owners)
      try {
        const approvalResp = await fetch(`${API_BASE}/parking/approval/requests/pendientes/`, {
          headers: getAuthHeaders()
        });

        if (approvalResp.ok) {
          const approvalData = await approvalResp.json();
          // approvalData es un array de ParkingApprovalDashboardSerializer
          const mappedApprovals = Array.isArray(approvalData) ? approvalData.map(req => ({
            id: req.id,
            nombre: req.nombre,
            direccion: req.direccion,
            telefono: req.telefono || null,
            descripcion: req.descripcion || '',
            tarifa_hora: req.tarifa_hora,
            total_plazas: req.total_plazas,
            plazas_disponibles: req.plazas_disponibles || 0,
            horario_apertura: req.horario_apertura || null,
            horario_cierre: req.horario_cierre || null,
            nivel_seguridad: req.nivel_seguridad || null,
            propietario: {
              username: req.solicitado_por_nombre || 'owner',
              first_name: null,
              last_name: null,
              email: null
            },
            status: req.status ? req.status.toLowerCase() : 'pending',
            is_approval_request: true,
            panel_local_id: req.panel_local_id || null,
            fecha_solicitud: req.fecha_solicitud || null,
            dias_pendiente: req.dias_pendiente || 0
          })) : [];

          // Añadir las solicitudes mapeadas a pendingParkings
          pendingParkings = [...pendingParkings, ...mappedApprovals];
          console.log('✅ Solicitudes de aprobación cargadas:', mappedApprovals.length);
        } else {
          console.warn('❌ Error cargando solicitudes de aprobación:', approvalResp.status);
        }
      } catch (error) {
        console.error('💥 Error cargando solicitudes de aprobación:', error);
      }

      // CARGAR APROBADOS desde nuevo endpoint
      try {
        const approvedResponse = await fetch(`${API_BASE}/parking/admin/approved-parkings/`, {
          headers: getAuthHeaders()
        });
        
        if (approvedResponse.ok) {
          const approvedData = await approvedResponse.json();
          approvedParkings = Array.isArray(approvedData) ? approvedData : [];
          console.log('✅ Aprobados cargados:', approvedParkings.length);
        } else {
          console.warn('❌ Error cargando aprobados:', approvedResponse.status);
        }
      } catch (error) {
        console.error('💥 Error cargando aprobados:', error);
      }

      // Combinar ambos arrays
      const allParkings = [...pendingParkings, ...approvedParkings];
      console.log('📊 Total parkings combinados:', allParkings.length);
      
      setParkings(allParkings);

    } catch (error) {
      console.error('💥 Error general cargando parkings:', error);
      setError('Error de conexión con el servidor');
      setParkings([]);
    } finally {
      setLoading(false);
    }
  };

  // Aprobar estacionamiento CORREGIDO
  const handleApproveParking = async (parkingId, parking) => {
    try {
      setActionLoading(parkingId);
      
      console.log(`🔄 Aprobando parking ${parkingId}...`);
      console.log('Objeto parking:', parking);
      
      // DETECTAR: ¿Es una solicitud de aprobación o un ParkingLot?
      let endpoint;
      if (parking?.is_approval_request) {
        // Es una solicitud de ParkingApprovalRequest → usar el endpoint de aprobación
        endpoint = `${API_BASE}/parking/approval/requests/${parkingId}/aprobar/`;
        console.log('✅ Detectado: Es una solicitud de aprobación → uso endpoint:', endpoint);
      } else {
        // Es un ParkingLot normal → usar el endpoint de approve
        endpoint = `${API_BASE}/parking/parkings/${parkingId}/approve/`;
        console.log('✅ Detectado: Es un ParkingLot → uso endpoint:', endpoint);
      }
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      console.log('📊 Response status approve:', response.status);

      if (response.ok) {
        console.log('✅ Estacionamiento aprobado exitosamente');
        await loadParkings(); // Recargar la lista
      } else {
        const errorData = await response.json();
        console.error('❌ Error aprobando estacionamiento:', errorData);
        alert(`Error al aprobar estacionamiento: ${errorData.detail || errorData.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('💥 Error en aprobación:', error);
      alert('Error de conexión al aprobar estacionamiento');
    } finally {
      setActionLoading(null);
    }
  };

  // Rechazar estacionamiento CORREGIDO
  const handleRejectParking = async (parkingId, parking) => {
    try {
      setActionLoading(parkingId);
      
      console.log(`🔄 Rechazando parking ${parkingId}...`);
      console.log('Objeto parking:', parking);
      
      // DETECTAR: ¿Es una solicitud de aprobación o un ParkingLot?
      let endpoint;
      if (parking?.is_approval_request) {
        // Es una solicitud de ParkingApprovalRequest → usar el endpoint de rechazo
        endpoint = `${API_BASE}/parking/approval/requests/${parkingId}/rechazar/`;
        console.log('✅ Detectado: Es una solicitud de aprobación → uso endpoint:', endpoint);
      } else {
        // Es un ParkingLot normal → usar el endpoint de reject (si existe)
        endpoint = `${API_BASE}/parking/parkings/${parkingId}/reject/`;
        console.log('✅ Detectado: Es un ParkingLot → uso endpoint:', endpoint);
      }
      
      // Para rechazo, probablemente necesitemos un motivo
      const requestBody = parking?.is_approval_request 
        ? { motivo: 'Rechazado por el administrador' }
        : {};
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: Object.keys(requestBody).length > 0 ? JSON.stringify(requestBody) : undefined
      });

      console.log('📊 Response status reject:', response.status);

      if (response.ok) {
        console.log('✅ Estacionamiento rechazado exitosamente');
        await loadParkings();
      } else {
        const errorData = await response.json();
        console.error('❌ Error rechazando estacionamiento:', errorData);
        alert(`Error al rechazar estacionamiento: ${errorData.detail || errorData.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('💥 Error en rechazo:', error);
      alert('Error de conexión al rechazar estacionamiento');
    } finally {
      setActionLoading(null);
    }
  };

  // Suspender/Activar estacionamiento CORREGIDO
  const handleToggleParkingStatus = async (parkingId, currentStatus) => {
    try {
      setActionLoading(parkingId);
      
      console.log(`🔄 Cambiando estado de parking ${parkingId}...`);
      
      // Usar el endpoint toggle_activation
      const response = await fetch(`${API_BASE}/parking/parkings/${parkingId}/toggle_activation/`, {
        method: 'POST',
        headers: getAuthHeaders()
      });

      console.log('📊 Response status toggle:', response.status);

      if (response.ok) {
        console.log(`✅ Estado cambiado exitosamente`);
        await loadParkings();
      } else {
        const errorData = await response.json();
        console.error('❌ Error cambiando estado:', errorData);
        alert(`Error al cambiar estado: ${errorData.detail || errorData.error || 'Error desconocido'}`);
      }
    } catch (error) {
      console.error('💥 Error cambiando estado:', error);
      alert('Error de conexión al cambiar estado');
    } finally {
      setActionLoading(null);
    }
  };

  // Función mejorada para obtener datos del propietario CORREGIDA
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
      return parking.servicios;
    }
    if (parking.features && Array.isArray(parking.features)) {
      return parking.features;
    }
    if (parking.nivel_seguridad) {
      return [`Seguridad: ${parking.nivel_seguridad}`];
    }
    return ['Sin características especificadas'];
  };

  // Función mejorada para obtener estado CORREGIDA
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
    const matchesType = filters.type === 'all' || (parking.type || 'standard') === filters.type;
    
    const searchTerm = filters.search.toLowerCase();
    const matchesSearch = filters.search === '' || 
      (parking.nombre || parking.name || '').toLowerCase().includes(searchTerm) ||
      (parking.direccion || parking.address || '').toLowerCase().includes(searchTerm) ||
      ownerInfo.name.toLowerCase().includes(searchTerm) ||
      ownerInfo.email.toLowerCase().includes(searchTerm);
    
    return matchesStatus && matchesType && matchesSearch;
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

  const getTypeBadge = (type) => {
    const types = {
      premium: { label: 'Premium', class: 'type-premium' },
      standard: { label: 'Estándar', class: 'type-standard' },
      economy: { label: 'Económico', class: 'type-economy' }
    };
    
    return types[type] || { label: type || 'Estándar', class: 'type-standard' };
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

  return (
    <div className="admin-parking">
      {/* HEADER */}
      <div className="admin-parking-header">
        <div className="header-content">
          <h1>Gestión de Estacionamientos</h1>
          <p>Administra todos los estacionamientos de la plataforma</p>
        </div>
        <button onClick={loadParkings} className="refresh-btn">
          <i className="fas fa-sync"></i>
          Actualizar
        </button>
      </div>

      {/* RESUMEN ESTADÍSTICAS */}
      <div className="parking-stats">
        <div className="stat-card">
          <div className="stat-value">{parkings.length}</div>
          <div className="stat-label">Total Estacionamientos</div>
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

      {/* FILTROS Y ACCIONES */}
      <div className="parking-controls">
        <div className="filters-section">
          <div className="filter-group">
            <label>Filtrar por Estado:</label>
            <select 
              value={filters.status} 
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="pending">Pendientes</option>
              <option value="suspended">Suspendidos</option>
              <option value="rejected">Rechazados</option>
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
                <tr key={parking.id} className={`parking-${parkingStatus}`}>
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
                    <strong>${parking.tarifa_hora || parking.hourly_rate || 0}/h</strong>
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
                          >
                            {actionLoading === parking.id ? '...' : 'Aprobar'}
                          </button>
                          <button 
                            className="btn-reject"
                            onClick={() => handleRejectParking(parking.id, parking)}
                            disabled={actionLoading === parking.id}
                          >
                            {actionLoading === parking.id ? '...' : 'Rechazar'}
                          </button>
                        </>
                      )}
                      
                      {/* Acciones para activos */}
                      {parkingStatus === 'active' && (
                        <button 
                          className="btn-suspend"
                          onClick={() => handleToggleParkingStatus(parking.id, 'active')}
                          disabled={actionLoading === parking.id}
                        >
                          {actionLoading === parking.id ? '...' : 'Suspender'}
                        </button>
                      )}
                      
                      {/* Acciones para suspendidos */}
                      {parkingStatus === 'suspended' && (
                        <button 
                          className="btn-activate"
                          onClick={() => handleToggleParkingStatus(parking.id, 'suspended')}
                          disabled={actionLoading === parking.id}
                        >
                          {actionLoading === parking.id ? '...' : 'Activar'}
                        </button>
                      )}
                      
                      <button 
                        className="btn-view"
                        onClick={() => setViewModal(parking)}
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

        {filteredParkings.length === 0 && (
          <div className="no-parkings">
            <i className="fas fa-parking"></i>
            <p>No se encontraron estacionamientos con los filtros aplicados</p>
          </div>
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
              <p><strong>Dirección:</strong> {viewModal.direccion || viewModal.address}</p>
              <p><strong>Descripción:</strong> {viewModal.descripcion || 'Sin descripción'}</p>
              <p><strong>Teléfono:</strong> {viewModal.telefono || 'No disponible'}</p>
              <p><strong>Horario:</strong> {viewModal.horario_apertura || 'N/A'} - {viewModal.horario_cierre || 'N/A'}</p>
              <p><strong>Espacios:</strong> {viewModal.plazas_disponibles || viewModal.available_spots || 0} disponibles de {viewModal.total_plazas || viewModal.total_spots || 0}</p>
              <p><strong>Tarifa:</strong> ${viewModal.tarifa_hora || viewModal.hourly_rate || 0} por hora</p>
              <p><strong>Seguridad:</strong> {viewModal.nivel_seguridad || 'Estándar'}</p>
              <p><strong>Estado:</strong> {getStatusBadge(getParkingStatus(viewModal)).label}</p>
              <p><strong>Propietario:</strong> {getOwnerInfo(viewModal).name} ({getOwnerInfo(viewModal).email})</p>
              <p><strong>Características:</strong></p>
              <div className="features-list">
                {getFeatures(viewModal).map((feature, index) => (
                  <span key={index} className="feature-tag">{feature}</span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminParking;