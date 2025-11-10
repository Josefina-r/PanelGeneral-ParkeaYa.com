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
  const [selectedParkings, setSelectedParkings] = useState([]);
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

  const loadParkings = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🔄 Cargando estacionamientos desde API...');
      
      // Endpoint para obtener todos los estacionamientos (admin)
      const response = await fetch(`${API_BASE}/parking/`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      console.log('📊 Response status estacionamientos:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Estacionamientos cargados:', data);
        
        // Asegurar que siempre guardamos un array
        let parkingArray = [];
        
        if (Array.isArray(data)) {
          parkingArray = data;
        } else if (data.results && Array.isArray(data.results)) {
          parkingArray = data.results;
        } else if (data.parkings && Array.isArray(data.parkings)) {
          parkingArray = data.parkings;
        } else if (data.data && Array.isArray(data.data)) {
          parkingArray = data.data;
        }
        
        console.log('📊 Array de estacionamientos a guardar:', parkingArray);
        setParkings(parkingArray);
      } else {
        setError(`Error ${response.status} al cargar estacionamientos`);
        // Eliminados los datos mock
        setParkings([]);
      }
    } catch (error) {
      console.error('💥 Error cargando estacionamientos:', error);
      setError('Error de conexión con el servidor');
      setParkings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleParkingAction = async (parkingId, action) => {
    try {
      setActionLoading(parkingId);
      
      let endpoint = '';
      let method = 'POST';
      
      switch(action) {
        case 'approve':
          endpoint = `${API_BASE}/parking/${parkingId}/approve/`;
          break;
        case 'reject':
          endpoint = `${API_BASE}/parking/${parkingId}/reject/`;
          break;
        case 'suspend':
          endpoint = `${API_BASE}/parking/${parkingId}/suspend/`;
          break;
        case 'activate':
          endpoint = `${API_BASE}/parking/${parkingId}/activate/`;
          break;
        default:
          return;
      }
      
      const response = await fetch(endpoint, {
        method: method,
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        await loadParkings();
        setSelectedParkings([]);
      } else {
        alert(`Error al ${action} estacionamiento`);
      }
    } catch (error) {
      console.error(`Error en acción ${action}:`, error);
      alert('Error al procesar la acción');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedParkings.length === 0) {
      alert('Selecciona al menos un estacionamiento');
      return;
    }
    
    try {
      setActionLoading('bulk');
      
      // Simular acción masiva
      console.log(`Acción ${action} para estacionamientos:`, selectedParkings);
      
      setTimeout(() => {
        alert(`${action} aplicado a ${selectedParkings.length} estacionamientos`);
        setSelectedParkings([]);
        setActionLoading(null);
      }, 1000);
      
    } catch (error) {
      console.error('Error en acción masiva:', error);
      setActionLoading(null);
    }
  };

  const toggleParkingSelection = (parkingId) => {
    setSelectedParkings(prev => 
      prev.includes(parkingId) 
        ? prev.filter(id => id !== parkingId)
        : [...prev, parkingId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedParkings.length === filteredParkings.length) {
      setSelectedParkings([]);
    } else {
      setSelectedParkings(filteredParkings.map(parking => parking.id));
    }
  };

  // Filtrar estacionamientos
  const filteredParkings = parkings.filter(parking => {
    const matchesStatus = filters.status === 'all' || parking.status === filters.status;
    const matchesType = filters.type === 'all' || parking.type === filters.type;
    
    const matchesSearch = filters.search === '' || 
      parking.name.toLowerCase().includes(filters.search.toLowerCase()) ||
      parking.address.toLowerCase().includes(filters.search.toLowerCase()) ||
      parking.owner.username.toLowerCase().includes(filters.search.toLowerCase());
    
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
    
    return types[type] || { label: type, class: 'type-default' };
  };

  const getOccupancyRate = (parking) => {
    return Math.round(((parking.total_spots - parking.available_spots) / parking.total_spots) * 100);
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
      {/* 🔥 HEADER */}
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

      {/* 📊 RESUMEN ESTADÍSTICAS */}
      <div className="parking-stats">
        <div className="stat-card">
          <div className="stat-value">{parkings.length}</div>
          <div className="stat-label">Total Estacionamientos</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {parkings.filter(p => p.status === 'active').length}
          </div>
          <div className="stat-label">Activos</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {parkings.filter(p => p.status === 'pending').length}
          </div>
          <div className="stat-label">Pendientes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {parkings.filter(p => p.status === 'suspended').length}
          </div>
          <div className="stat-label">Suspendidos</div>
        </div>
      </div>

      {/* 🎛️ FILTROS Y ACCIONES */}
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
            <label>Filtrar por Tipo:</label>
            <select 
              value={filters.type} 
              onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
            >
              <option value="all">Todos los tipos</option>
              <option value="premium">Premium</option>
              <option value="standard">Estándar</option>
              <option value="economy">Económico</option>
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

        {/* 🚀 ACCIONES MASIVAS */}
        {selectedParkings.length > 0 && (
          <div className="bulk-actions">
            <span>{selectedParkings.length} estacionamientos seleccionados</span>
            <div className="bulk-buttons">
              <button 
                className="btn-approve"
                onClick={() => handleBulkAction('approve')}
                disabled={actionLoading === 'bulk'}
              >
                {actionLoading === 'bulk' ? 'Procesando...' : 'Aprobar Seleccionados'}
              </button>
              <button 
                className="btn-suspend"
                onClick={() => handleBulkAction('suspend')}
                disabled={actionLoading === 'bulk'}
              >
                {actionLoading === 'bulk' ? 'Procesando...' : 'Suspender Seleccionados'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 📋 TABLA DE ESTACIONAMIENTOS */}
      <div className="parking-table-container">
        <table className="parking-table">
          <thead>
            <tr>
              <th>
                <input 
                  type="checkbox" 
                  checked={selectedParkings.length === filteredParkings.length && filteredParkings.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>Estacionamiento</th>
              <th>Propietario</th>
              <th>Ubicación</th>
              <th>Espacios</th>
              <th>Ocupación</th>
              <th>Tarifa</th>
              <th>Estado</th>
              <th>Tipo</th>
              <th>Rating</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredParkings.map(parking => {
              const statusBadge = getStatusBadge(parking.status);
              const typeBadge = getTypeBadge(parking.type);
              const occupancyRate = getOccupancyRate(parking);
              
              return (
                <tr key={parking.id} className={`parking-${parking.status}`}>
                  <td>
                    <input 
                      type="checkbox" 
                      checked={selectedParkings.includes(parking.id)}
                      onChange={() => toggleParkingSelection(parking.id)}
                    />
                  </td>
                  <td>
                    <div className="parking-name">
                      <strong>{parking.name}</strong>
                      <div className="parking-features">
                        {parking.features?.map(feature => (
                          <span key={feature} className="feature-tag">{feature}</span>
                        ))}
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="owner-info">
                      <strong>{parking.owner.first_name} {parking.owner.last_name}</strong>
                      <small>@{parking.owner.username}</small>
                    </div>
                  </td>
                  <td className="address-cell">
                    {parking.address}
                  </td>
                  <td>
                    <div className="spots-info">
                      <span className="available">{parking.available_spots} disp.</span>
                      <span className="total">/ {parking.total_spots} total</span>
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
                    <strong>${parking.hourly_rate}/h</strong>
                  </td>
                  <td>
                    <span className={`status-badge ${statusBadge.class}`}>
                      {statusBadge.label}
                    </span>
                  </td>
                  <td>
                    <span className={`type-badge ${typeBadge.class}`}>
                      {typeBadge.label}
                    </span>
                  </td>
                  <td>
                    <div className="rating">
                      <i className="fas fa-star"></i>
                      <span>{parking.rating}</span>
                      <small>({parking.total_reviews})</small>
                    </div>
                  </td>
                  <td>
                    <div className="parking-actions">
                      {/* Acciones para pendientes */}
                      {parking.status === 'pending' && (
                        <>
                          <button 
                            className="btn-approve"
                            onClick={() => handleParkingAction(parking.id, 'approve')}
                            disabled={actionLoading === parking.id}
                          >
                            {actionLoading === parking.id ? '...' : 'Aprobar'}
                          </button>
                          <button 
                            className="btn-reject"
                            onClick={() => handleParkingAction(parking.id, 'reject')}
                            disabled={actionLoading === parking.id}
                          >
                            {actionLoading === parking.id ? '...' : 'Rechazar'}
                          </button>
                        </>
                      )}
                      
                      {/* Acciones para activos */}
                      {parking.status === 'active' && (
                        <button 
                          className="btn-suspend"
                          onClick={() => handleParkingAction(parking.id, 'suspend')}
                          disabled={actionLoading === parking.id}
                        >
                          {actionLoading === parking.id ? '...' : 'Suspender'}
                        </button>
                      )}
                      
                      {/* Acciones para suspendidos */}
                      {parking.status === 'suspended' && (
                        <button 
                          className="btn-activate"
                          onClick={() => handleParkingAction(parking.id, 'activate')}
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
                      
                      <button className="btn-edit">
                        <i className="fas fa-edit"></i>
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

      {/* 🔍 DEBUG INFO */}
      {error && (
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i>
          {error}
        </div>
      )}

      <div className="debug-info">
        <details>
          <summary>Debug Info</summary>
          <p>Total estacionamientos: {parkings.length}</p>
          <p>Filtrados: {filteredParkings.length}</p>
          <p>Seleccionados: {selectedParkings.length}</p>
        </details>
      </div>

      {/* 🪟 MODAL DE DETALLES */}
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
              <h3>{viewModal.name}</h3>
              <p><strong>Dirección:</strong> {viewModal.address}</p>
              <p><strong>Propietario:</strong> {viewModal.owner.first_name} {viewModal.owner.last_name}</p>
              <p><strong>Email:</strong> {viewModal.owner.email}</p>
              <p><strong>Espacios:</strong> {viewModal.available_spots} disponibles de {viewModal.total_spots}</p>
              <p><strong>Tarifa:</strong> ${viewModal.hourly_rate} por hora</p>
              <p><strong>Rating:</strong> {viewModal.rating} ⭐ ({viewModal.total_reviews} reseñas)</p>
              <p><strong>Características:</strong></p>
              <div className="features-list">
                {viewModal.features?.map(feature => (
                  <span key={feature} className="feature-tag">{feature}</span>
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