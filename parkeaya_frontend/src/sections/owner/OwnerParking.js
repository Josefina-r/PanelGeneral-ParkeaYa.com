import React, { useState, useEffect } from 'react';
import './OwnerParking.css';

const OwnerParking = ({ userRole }) => {
  const [parkingData, setParkingData] = useState(null);
  const [spots, setSpots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [activeTab, setActiveTab] = useState('info');

  const API_BASE = 'http://localhost:8000/api';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  useEffect(() => {
    loadParkingData();
    loadSpots();
  }, []);

  const loadParkingData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('🏢 Cargando datos del estacionamiento...');
      
      // Endpoint para obtener los estacionamientos del owner
      const response = await fetch(`${API_BASE}/parking/my-parkings/`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      console.log('📊 Response status parking:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Datos del estacionamiento:', data);
        
        // Si la API devuelve un array, tomar el primer estacionamiento
        if (Array.isArray(data) && data.length > 0) {
          setParkingData(data[0]);
          setFormData(data[0]);
        } else if (data.results && data.results.length > 0) {
          // Si usa paginación
          setParkingData(data.results[0]);
          setFormData(data.results[0]);
        } else {
          setError('No tienes estacionamientos registrados');
        }
      } else {
        const errorText = await response.text();
        console.error('❌ Error en respuesta:', errorText);
        setError(`Error ${response.status} al cargar datos del estacionamiento`);
      }
    } catch (error) {
      console.error('💥 Error cargando datos:', error);
      setError('Error de conexión con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const loadSpots = async () => {
    try {
      // Asumiendo que tienes un endpoint para los espacios del parking del owner
      const response = await fetch(`${API_BASE}/parking/spots/`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Espacios cargados:', data);
        
        // Adaptar según la estructura de tu API
        if (Array.isArray(data)) {
          setSpots(data);
        } else if (data.spots) {
          setSpots(data.spots);
        } else if (data.results) {
          setSpots(data.results);
        } else {
          setSpots([]);
        }
      } else {
        console.warn('No se pudieron cargar los espacios');
        setSpots([]);
      }
    } catch (error) {
      console.error('Error cargando espacios:', error);
      setSpots([]);
    }
  };

  const handleSave = async () => {
    try {
      if (!parkingData?.id) {
        alert('No hay estacionamiento para actualizar');
        return;
      }

      const response = await fetch(`${API_BASE}/parking/parkings/${parkingData.id}/`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const updatedData = await response.json();
        setParkingData(updatedData);
        setEditing(false);
        alert('Cambios guardados exitosamente');
      } else {
        const errorData = await response.json();
        console.error('Error al guardar:', errorData);
        alert('Error al guardar los cambios: ' + (errorData.detail || 'Error desconocido'));
      }
    } catch (error) {
      console.error('Error guardando datos:', error);
      alert('Error de conexión al guardar los cambios');
    }
  };

  const handleCancel = () => {
    setFormData(parkingData || {});
    setEditing(false);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleOperatingHoursChange = (day, field, value) => {
    setFormData(prev => ({
      ...prev,
      operating_hours: {
        ...prev.operating_hours,
        [day]: {
          ...prev.operating_hours?.[day],
          [field]: value
        }
      }
    }));
  };

  const toggleFeature = (feature) => {
    setFormData(prev => ({
      ...prev,
      features: Array.isArray(prev.features) 
        ? prev.features.includes(feature)
          ? prev.features.filter(f => f !== feature)
          : [...prev.features, feature]
        : [feature]
    }));
  };

  const getSpotStatusBadge = (status) => {
    const statuses = {
      available: { label: 'Disponible', class: 'status-available', icon: 'fas fa-check-circle' },
      occupied: { label: 'Ocupado', class: 'status-occupied', icon: 'fas fa-times-circle' },
      reserved: { label: 'Reservado', class: 'status-reserved', icon: 'fas fa-clock' },
      maintenance: { label: 'Mantenimiento', class: 'status-maintenance', icon: 'fas fa-tools' },
      inactive: { label: 'Inactivo', class: 'status-inactive', icon: 'fas fa-pause-circle' }
    };
    return statuses[status] || { label: status, class: 'status-unknown', icon: 'fas fa-question-circle' };
  };

  const getSpotTypeBadge = (type) => {
    const types = {
      regular: { label: 'Regular', class: 'type-regular', color: '#3b82f6' },
      premium: { label: 'Premium', class: 'type-premium', color: '#f59e0b' },
      large: { label: 'Grande', class: 'type-large', color: '#10b981' },
      ev: { label: 'EV', class: 'type-ev', color: '#8b5cf6' },
      disabled: { label: 'Discapacitados', class: 'type-disabled', color: '#ef4444' },
      compact: { label: 'Compacto', class: 'type-compact', color: '#6b7280' },
      motorcycle: { label: 'Moto', class: 'type-motorcycle', color: '#8b5cf6' }
    };
    return types[type] || { label: type, class: 'type-unknown', color: '#6b7280' };
  };

  const handleSpotAction = async (spotId, action) => {
    try {
      switch(action) {
        case 'toggle_maintenance':
          // Encontrar el spot actual
          const spot = spots.find(s => s.id === spotId);
          if (!spot) return;

          const newStatus = spot.status === 'maintenance' ? 'available' : 'maintenance';
          
          const response = await fetch(`${API_BASE}/parking/spots/${spotId}/`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status: newStatus })
          });

          if (response.ok) {
            // Actualizar el estado local
            setSpots(prev => prev.map(s => 
              s.id === spotId ? { ...s, status: newStatus } : s
            ));
            alert(`Espacio ${newStatus === 'maintenance' ? 'en mantenimiento' : 'disponible'}`);
          } else {
            alert('Error al actualizar el espacio');
          }
          break;

        case 'edit':
          alert(`Editar espacio ${spotId} - Funcionalidad en desarrollo`);
          break;

        default:
          break;
      }
    } catch (error) {
      console.error('Error en acción del espacio:', error);
      alert('Error al realizar la acción');
    }
  };

  const handleAddSpot = async () => {
    if (!parkingData?.id) {
      alert('Primero debes tener un estacionamiento registrado');
      return;
    }

    try {
      const newSpot = {
        parking_lot: parkingData.id,
        number: `NUEVO-${spots.length + 1}`,
        type: 'regular',
        status: 'available',
        vehicle_type: 'car'
      };

      const response = await fetch(`${API_BASE}/parking/spots/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(newSpot)
      });

      if (response.ok) {
        const createdSpot = await response.json();
        setSpots(prev => [...prev, createdSpot]);
        alert('Espacio agregado exitosamente');
      } else {
        alert('Error al agregar el espacio');
      }
    } catch (error) {
      console.error('Error agregando espacio:', error);
      alert('Error de conexión al agregar espacio');
    }
  };

  if (loading) {
    return (
      <div className="owner-parking-loading">
        <div className="loading-spinner"></div>
        <p>Cargando información del estacionamiento...</p>
      </div>
    );
  }

  if (error && !parkingData) {
    return (
      <div className="owner-parking-error">
        <div className="error-content">
          <i className="fas fa-exclamation-triangle"></i>
          <h3>No se pudo cargar la información</h3>
          <p>{error}</p>
          <button onClick={loadParkingData} className="btn-retry">
            <i className="fas fa-redo"></i>
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="owner-parking">
      {/* 🔥 HEADER */}
      <div className="owner-parking-header">
        <div className="header-content">
          <h1>{parkingData?.name || 'Mi Estacionamiento'}</h1>
          <p>Gestiona la información y configuración de tu estacionamiento</p>
          {parkingData?.status && (
            <span className={`parking-status ${parkingData.status}`}>
              <i className={`fas fa-${parkingData.status === 'active' ? 'check-circle' : 'pause-circle'}`}></i>
              {parkingData.status === 'active' ? 'Activo' : 'Inactivo'}
            </span>
          )}
        </div>
        <div className="header-actions">
          {!editing ? (
            <button 
              className="btn-edit"
              onClick={() => setEditing(true)}
            >
              <i className="fas fa-edit"></i>
              Editar Información
            </button>
          ) : (
            <div className="edit-actions">
              <button className="btn-cancel" onClick={handleCancel}>
                <i className="fas fa-times"></i>
                Cancelar
              </button>
              <button className="btn-save" onClick={handleSave}>
                <i className="fas fa-save"></i>
                Guardar Cambios
              </button>
            </div>
          )}
        </div>
      </div>

      {/* PESTAÑAS */}
      <div className="parking-tabs">
        <button 
          className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          <i className="fas fa-info-circle"></i>
          Información General
        </button>
        <button 
          className={`tab-btn ${activeTab === 'spots' ? 'active' : ''}`}
          onClick={() => setActiveTab('spots')}
        >
          <i className="fas fa-parking"></i>
          Espacios ({spots.length})
        </button>
        <button 
          className={`tab-btn ${activeTab === 'rates' ? 'active' : ''}`}
          onClick={() => setActiveTab('rates')}
        >
          <i className="fas fa-money-bill-wave"></i>
          Tarifas
        </button>
        <button 
          className={`tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          <i className="fas fa-cogs"></i>
          Configuración
        </button>
      </div>

      {/* CONTENIDO POR PESTAÑA */}
      <div className="parking-content">
        {activeTab === 'info' && (
          <div className="info-tab">
            <div className="info-grid">
              {/* INFORMACIÓN BÁSICA */}
              <div className="info-section">
                <h3>Información Básica</h3>
                <div className="form-group">
                  <label>Nombre del Estacionamiento</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.name || ''}
                      onChange={(e) => handleInputChange('name', e.target.value)}
                      placeholder="Nombre de tu estacionamiento"
                    />
                  ) : (
                    <p className="info-value">{parkingData?.name || 'No configurado'}</p>
                  )}
                </div>

                <div className="form-group">
                  <label>Dirección</label>
                  {editing ? (
                    <textarea
                      value={formData.address || ''}
                      onChange={(e) => handleInputChange('address', e.target.value)}
                      placeholder="Dirección completa"
                      rows="3"
                    />
                  ) : (
                    <p className="info-value">{parkingData?.address || 'No configurada'}</p>
                  )}
                </div>

                <div className="form-group">
                  <label>Descripción</label>
                  {editing ? (
                    <textarea
                      value={formData.description || ''}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Describe tu estacionamiento"
                      rows="4"
                    />
                  ) : (
                    <p className="info-value">{parkingData?.description || 'Sin descripción'}</p>
                  )}
                </div>
              </div>

              {/* CARACTERÍSTICAS */}
              <div className="info-section">
                <h3>Características y Servicios</h3>
                <div className="features-grid">
                  {[
                    { id: '24/7', label: '24/7', icon: 'fas fa-clock' },
                    { id: 'security', label: 'Seguridad', icon: 'fas fa-shield-alt' },
                    { id: 'covered', label: 'Cubierto', icon: 'fas fa-umbrella' },
                    { id: 'valet', label: 'Valet Parking', icon: 'fas fa-user-tie' },
                    { id: 'cameras', label: 'Cámaras', icon: 'fas fa-video' },
                    { id: 'ev_charging', label: 'Carga EV', icon: 'fas fa-bolt' },
                    { id: 'wifi', label: 'WiFi', icon: 'fas fa-wifi' },
                    { id: 'restroom', label: 'Baños', icon: 'fas fa-restroom' }
                  ].map(feature => (
                    <div key={feature.id} className="feature-checkbox">
                      {editing ? (
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={Array.isArray(formData.features) && formData.features.includes(feature.id)}
                            onChange={() => toggleFeature(feature.id)}
                          />
                          <span className="checkmark"></span>
                          <i className={feature.icon}></i>
                          {feature.label}
                        </label>
                      ) : (
                        <div className={`feature-item ${Array.isArray(parkingData?.features) && parkingData.features.includes(feature.id) ? 'active' : 'inactive'}`}>
                          <i className={feature.icon}></i>
                          {feature.label}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* HORARIOS DE OPERACIÓN */}
              <div className="info-section">
                <h3>Horarios de Operación</h3>
                <div className="operating-hours-grid">
                  {Object.entries(formData.operating_hours || {}).map(([day, hours]) => (
                    <div key={day} className="day-schedule">
                      <span className="day-name">
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                      </span>
                      {editing ? (
                        <div className="time-inputs">
                          <input
                            type="time"
                            value={hours?.open || ''}
                            onChange={(e) => handleOperatingHoursChange(day, 'open', e.target.value)}
                            disabled={hours?.closed}
                          />
                          <span>a</span>
                          <input
                            type="time"
                            value={hours?.close || ''}
                            onChange={(e) => handleOperatingHoursChange(day, 'close', e.target.value)}
                            disabled={hours?.closed}
                          />
                          <label className="closed-checkbox">
                            <input
                              type="checkbox"
                              checked={hours?.closed || false}
                              onChange={(e) => handleOperatingHoursChange(day, 'closed', e.target.checked)}
                            />
                            Cerrado
                          </label>
                        </div>
                      ) : (
                        <span className="hours-display">
                          {hours?.closed ? 'Cerrado' : `${hours?.open || '--:--'} - ${hours?.close || '--:--'}`}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* INFORMACIÓN DE CONTACTO */}
              <div className="info-section">
                <h3>Información de Contacto</h3>
                <div className="contact-grid">
                  <div className="form-group">
                    <label>Teléfono Principal</label>
                    {editing ? (
                      <input
                        type="tel"
                        value={formData.contact_info?.phone || ''}
                        onChange={(e) => handleInputChange('contact_info', {
                          ...formData.contact_info,
                          phone: e.target.value
                        })}
                      />
                    ) : (
                      <p className="info-value">{parkingData?.contact_info?.phone || 'No configurado'}</p>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Email</label>
                    {editing ? (
                      <input
                        type="email"
                        value={formData.contact_info?.email || ''}
                        onChange={(e) => handleInputChange('contact_info', {
                          ...formData.contact_info,
                          email: e.target.value
                        })}
                      />
                    ) : (
                      <p className="info-value">{parkingData?.contact_info?.email || 'No configurado'}</p>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Contacto de Emergencia</label>
                    {editing ? (
                      <input
                        type="tel"
                        value={formData.contact_info?.emergency_contact || ''}
                        onChange={(e) => handleInputChange('contact_info', {
                          ...formData.contact_info,
                          emergency_contact: e.target.value
                        })}
                      />
                    ) : (
                      <p className="info-value">{parkingData?.contact_info?.emergency_contact || 'No configurado'}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'spots' && (
          <div className="spots-tab">
            <div className="spots-header">
              <h3>Gestión de Espacios</h3>
              <div className="spots-summary">
                <span className="total">Total: {spots.length} espacios</span>
                <span className="available">Disponibles: {spots.filter(s => s.status === 'available').length}</span>
                <span className="occupied">Ocupados: {spots.filter(s => s.status === 'occupied').length}</span>
                <span className="maintenance">Mantenimiento: {spots.filter(s => s.status === 'maintenance').length}</span>
              </div>
              <button className="btn-add-spot" onClick={handleAddSpot}>
                <i className="fas fa-plus"></i>
                Agregar Espacio
              </button>
            </div>

            {spots.length === 0 ? (
              <div className="no-spots">
                <i className="fas fa-parking"></i>
                <h4>No hay espacios registrados</h4>
                <p>Agrega tu primer espacio para comenzar</p>
                <button className="btn-add-spot" onClick={handleAddSpot}>
                  <i className="fas fa-plus"></i>
                  Agregar Primer Espacio
                </button>
              </div>
            ) : (
              <div className="spots-grid">
                {spots.map(spot => {
                  const statusInfo = getSpotStatusBadge(spot.status);
                  const typeInfo = getSpotTypeBadge(spot.type);
                  
                  return (
                    <div key={spot.id} className={`spot-card ${spot.status}`}>
                      <div className="spot-header">
                        <div className="spot-number">
                          <h4>{spot.number}</h4>
                          <span className="vehicle-type">
                            <i className={`fas fa-${spot.vehicle_type === 'ev' ? 'bolt' : spot.vehicle_type === 'motorcycle' ? 'motorcycle' : 'car'}`}></i>
                            {spot.vehicle_type?.toUpperCase() || 'CAR'}
                          </span>
                        </div>
                        <div className="spot-badges">
                          <span className={`type-badge ${typeInfo.class}`}>
                            {typeInfo.label}
                          </span>
                          <span className={`status-badge ${statusInfo.class}`}>
                            <i className={statusInfo.icon}></i>
                            {statusInfo.label}
                          </span>
                        </div>
                      </div>

                      <div className="spot-actions">
                        <button 
                          className={`btn-action maintenance ${spot.status === 'maintenance' ? 'active' : ''}`}
                          onClick={() => handleSpotAction(spot.id, 'toggle_maintenance')}
                          title={spot.status === 'maintenance' ? 'Quitar mantenimiento' : 'Poner en mantenimiento'}
                        >
                          <i className="fas fa-tools"></i>
                        </button>
                        <button 
                          className="btn-action edit"
                          onClick={() => handleSpotAction(spot.id, 'edit')}
                          title="Editar"
                        >
                          <i className="fas fa-edit"></i>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'rates' && (
          <div className="rates-tab">
            <div className="rates-section">
              <h3>Configuración de Tarifas</h3>
              <div className="rates-grid">
                <div className="rate-card">
                  <h4>Tarifa por Hora</h4>
                  {editing ? (
                    <div className="rate-input">
                      <span className="currency">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.hourly_rate || 0}
                        onChange={(e) => handleInputChange('hourly_rate', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  ) : (
                    <div className="rate-value">
                      <span className="amount">${parkingData?.hourly_rate || 0}</span>
                      <span className="period">/ hora</span>
                    </div>
                  )}
                </div>

                <div className="rate-card">
                  <h4>Tarifa Diaria</h4>
                  {editing ? (
                    <div className="rate-input">
                      <span className="currency">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.daily_rate || 0}
                        onChange={(e) => handleInputChange('daily_rate', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  ) : (
                    <div className="rate-value">
                      <span className="amount">${parkingData?.daily_rate || 0}</span>
                      <span className="period">/ día</span>
                    </div>
                  )}
                </div>

                <div className="rate-card">
                  <h4>Tarifa Mensual</h4>
                  {editing ? (
                    <div className="rate-input">
                      <span className="currency">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.monthly_rate || 0}
                        onChange={(e) => handleInputChange('monthly_rate', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  ) : (
                    <div className="rate-value">
                      <span className="amount">${parkingData?.monthly_rate || 0}</span>
                      <span className="period">/ mes</span>
                    </div>
                  )}
                </div>
              </div>

              {editing && (
                <div className="rate-notice">
                  <i className="fas fa-info-circle"></i>
                  <p>Las tarifas se actualizarán para todas las nuevas reservas</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="settings-tab">
            <div className="settings-section">
              <h3>Configuración Avanzada</h3>
              <div className="settings-grid">
                <div className="setting-card">
                  <h4>Estado del Estacionamiento</h4>
                  <div className="status-toggle">
                    <span className="status-label">
                      {parkingData?.status === 'active' ? 'Activo' : 'Inactivo'}
                    </span>
                    <label className="toggle-switch">
                      <input 
                        type="checkbox" 
                        checked={parkingData?.status === 'active'}
                        readOnly
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                  <p className="setting-description">
                    Cuando está inactivo, no aparecerá en las búsquedas
                  </p>
                </div>

                <div className="setting-card">
                  <h4>Reservas Automáticas</h4>
                  <div className="setting-option">
                    <label>
                      <input type="checkbox" defaultChecked readOnly />
                      Aceptar reservas automáticamente
                    </label>
                  </div>
                  <p className="setting-description">
                    Las reservas se confirmarán sin necesidad de aprobación manual
                  </p>
                </div>

                <div className="setting-card">
                  <h4>Notificaciones</h4>
                  <div className="notification-settings">
                    <label>
                      <input type="checkbox" defaultChecked readOnly />
                      Nuevas reservas
                    </label>
                    <label>
                      <input type="checkbox" defaultChecked readOnly />
                      Check-in/out
                    </label>
                    <label>
                      <input type="checkbox" defaultChecked readOnly />
                      Pagos recibidos
                    </label>
                    <label>
                      <input type="checkbox" readOnly />
                      Reportes diarios
                    </label>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* DEBUG INFO */}
      {error && parkingData && (
        <div className="error-message">
          <i className="fas fa-exclamation-triangle"></i>
          {error}
        </div>
      )}
    </div>
  );
};

export default OwnerParking;