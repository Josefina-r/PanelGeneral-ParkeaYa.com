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
  }, []);

  const loadParkingData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🏢 Cargando datos del estacionamiento...');


      const response = await fetch(`${API_BASE}/parking/my-parkings/`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      console.log(' Response status parking:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log(' Datos del estacionamiento recibidos:', data);

        // Procesar la respuesta según la estructura real
        let parking = null;

        if (Array.isArray(data) && data.length > 0) {
          parking = data[0];
        } else if (data.results && data.results.length > 0) {
          parking = data.results[0];
        } else if (data.id) {
          parking = data; // Si es un objeto directo
        }

        if (parking) {
          console.log('✅ Estacionamiento encontrado:', parking);
          setParkingData(parking);
          setFormData({
            // Mapeo de campos según tu modelo Django
            nombre: parking.nombre || '',
            direccion: parking.direccion || '',
            descripcion: parking.descripcion || '',
            horario_apertura: parking.horario_apertura || '',
            horario_cierre: parking.horario_cierre || '',
            nivel_seguridad: parking.nivel_seguridad || 'Estándar',
            tarifa_hora: parking.tarifa_hora || 0,
            telefono: parking.telefono || '',
            total_plazas: parking.total_plazas || 0,
            plazas_disponibles: parking.plazas_disponibles || 0,
          });
        } else {
          console.log(' No se encontraron estacionamientos');
          setError('No tienes estacionamientos registrados');
        }
      } else {
        const errorText = await response.text();
        console.error(' Error en respuesta:', response.status, errorText);
        if (response.status === 404) {
          setError('No tienes estacionamientos registrados');
        } else if (response.status === 401) {
          setError('No autorizado - Token inválido');
        } else {
          setError(`Error ${response.status} al cargar datos del estacionamiento`);
        }
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
      //  Este endpoint probablemente no existe - usamos datos simulados por ahora
      console.log(' Endpoint de spots no implementado, usando datos de ejemplo');


      if (parkingData) {
        const exampleSpots = [];
        const totalSpots = parkingData.total_plazas || 10;
        const availableSpots = parkingData.plazas_disponibles || 5;

        for (let i = 1; i <= totalSpots; i++) {
          exampleSpots.push({
            id: i,
            number: `A-${i}`,
            type: i <= 2 ? 'premium' : 'regular',
            status: i <= availableSpots ? 'available' : 'occupied',
            vehicle_type: 'car'
          });
        }
        setSpots(exampleSpots);
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

      console.log(' Guardando cambios...', formData);


      const response = await fetch(`${API_BASE}/parking/parkings/${parkingData.id}/`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({
          // Campos que espera tu API Django
          nombre: formData.nombre,
          direccion: formData.direccion,
          descripcion: formData.descripcion,
          horario_apertura: formData.horario_apertura || null,
          horario_cierre: formData.horario_cierre || null,
          nivel_seguridad: formData.nivel_seguridad,
          tarifa_hora: formData.tarifa_hora,
          telefono: formData.telefono,
          total_plazas: formData.total_plazas,
          plazas_disponibles: formData.plazas_disponibles,
        })
      });

      if (response.ok) {
        const updatedData = await response.json();
        console.log('✅ Cambios guardados:', updatedData);
        setParkingData(updatedData);
        setEditing(false);
        alert('Cambios guardados exitosamente');

        // Recargar datos para asegurar consistencia
        loadParkingData();
      } else {
        const errorData = await response.json();
        console.error('❌ Error al guardar:', errorData);
        alert('Error al guardar los cambios: ' + (errorData.detail || JSON.stringify(errorData)));
      }
    } catch (error) {
      console.error('💥 Error guardando datos:', error);
      alert('Error de conexión al guardar los cambios');
    }
  };

  const handleCancel = () => {
    setFormData({
      nombre: parkingData?.nombre || '',
      direccion: parkingData?.direccion || '',
      descripcion: parkingData?.descripcion || '',
      horario_apertura: parkingData?.horario_apertura || '',
      horario_cierre: parkingData?.horario_cierre || '',
      nivel_seguridad: parkingData?.nivel_seguridad || 'Estándar',
      tarifa_hora: parkingData?.tarifa_hora || 0,
      telefono: parkingData?.telefono || '',
      total_plazas: parkingData?.total_plazas || 0,
      plazas_disponibles: parkingData?.plazas_disponibles || 0,
    });
    setEditing(false);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const formatTimeForInput = (timeString) => {
    if (!timeString) return '';
    // Si ya está en formato HH:MM, devolverlo
    if (typeof timeString === 'string' && timeString.includes(':')) {
      return timeString.substring(0, 5); // Tomar solo HH:MM
    }
    return '';
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN'
    }).format(amount);
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
      switch (action) {
        case 'toggle_maintenance':
          // Simular cambio de estado
          setSpots(prev => prev.map(spot =>
            spot.id === spotId
              ? {
                ...spot,
                status: spot.status === 'maintenance' ? 'available' : 'maintenance'
              }
              : spot
          ));
          alert(`Espacio ${spotId} ${action === 'maintenance' ? 'en mantenimiento' : 'disponible'}`);
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
      // Simular agregar espacio
      const newSpot = {
        id: spots.length + 1,
        number: `A-${spots.length + 1}`,
        type: 'regular',
        status: 'available',
        vehicle_type: 'car'
      };

      setSpots(prev => [...prev, newSpot]);
      alert('Espacio agregado exitosamente (simulación)');
    } catch (error) {
      console.error('Error agregando espacio:', error);
      alert('Error al agregar espacio');
    }
  };

  useEffect(() => {
    if (parkingData) {
      loadSpots();
    }
  }, [parkingData]);

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
          <div className="error-actions">
            <button onClick={loadParkingData} className="btn-retry">
              <i className="fas fa-redo"></i>
              Reintentar
            </button>
            <button onClick={() => window.location.href = '/add-parking'} className="btn-primary">
              <i className="fas fa-plus"></i>
              Registrar Estacionamiento
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="owner-parking">
      {/*  HEADER */}
      <div className="owner-parking-header">
        <div className="header-content">
          <h1>{parkingData?.nombre || 'Mi Estacionamiento'}</h1>
          <p>{parkingData?.direccion || 'Dirección no configurada'}</p>
          <div className="header-status">
            {parkingData?.aprobado !== undefined && (
              <span className={`status-badge ${parkingData.aprobado ? 'approved' : 'pending'}`}>
                <i className={`fas fa-${parkingData.aprobado ? 'check-circle' : 'clock'}`}></i>
                {parkingData.aprobado ? 'Aprobado' : 'Pendiente'}
              </span>
            )}
            {parkingData?.activo !== undefined && (
              <span className={`status-badge ${parkingData.activo ? 'active' : 'inactive'}`}>
                <i className={`fas fa-${parkingData.activo ? 'play-circle' : 'pause-circle'}`}></i>
                {parkingData.activo ? 'Activo' : 'Inactivo'}
              </span>
            )}
            {parkingData?.rating_promedio > 0 && (
              <span className="rating-badge">
                <i className="fas fa-star"></i>
                {parkingData.rating_promedio} ⭐
              </span>
            )}
          </div>
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
                  <label>Nombre del Estacionamiento *</label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.nombre || ''}
                      onChange={(e) => handleInputChange('nombre', e.target.value)}
                      placeholder="Nombre de tu estacionamiento"
                      required
                    />
                  ) : (
                    <p className="info-value">{parkingData?.nombre || 'No configurado'}</p>
                  )}
                </div>

                <div className="form-group">
                  <label>Dirección *</label>
                  {editing ? (
                    <textarea
                      value={formData.direccion || ''}
                      onChange={(e) => handleInputChange('direccion', e.target.value)}
                      placeholder="Dirección completa"
                      rows="3"
                      required
                    />
                  ) : (
                    <p className="info-value">{parkingData?.direccion || 'No configurada'}</p>
                  )}
                </div>

                <div className="form-group">
                  <label>Descripción</label>
                  {editing ? (
                    <textarea
                      value={formData.descripcion || ''}
                      onChange={(e) => handleInputChange('descripcion', e.target.value)}
                      placeholder="Describe tu estacionamiento, servicios, características..."
                      rows="4"
                    />
                  ) : (
                    <p className="info-value">{parkingData?.descripcion || 'Sin descripción'}</p>
                  )}
                </div>

                <div className="form-group">
                  <label>Teléfono *</label>
                  {editing ? (
                    <input
                      type="tel"
                      value={formData.telefono || ''}
                      onChange={(e) => handleInputChange('telefono', e.target.value)}
                      placeholder="+52 123 456 7890"
                      required
                    />
                  ) : (
                    <p className="info-value">{parkingData?.telefono || 'No configurado'}</p>
                  )}
                </div>
              </div>

              {/* HORARIOS */}
              <div className="info-section">
                <h3>Horarios de Operación</h3>
                <div className="time-grid">
                  <div className="form-group">
                    <label>Horario de Apertura</label>
                    {editing ? (
                      <input
                        type="time"
                        value={formatTimeForInput(formData.horario_apertura)}
                        onChange={(e) => handleInputChange('horario_apertura', e.target.value)}
                      />
                    ) : (
                      <p className="info-value">
                        {parkingData?.horario_apertura ?
                          `Abre: ${parkingData.horario_apertura}` :
                          '24 horas'}
                      </p>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Horario de Cierre</label>
                    {editing ? (
                      <input
                        type="time"
                        value={formatTimeForInput(formData.horario_cierre)}
                        onChange={(e) => handleInputChange('horario_cierre', e.target.value)}
                      />
                    ) : (
                      <p className="info-value">
                        {parkingData?.horario_cierre ?
                          `Cierra: ${parkingData.horario_cierre}` :
                          '24 horas'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="form-group">
                  <label>Nivel de Seguridad</label>
                  {editing ? (
                    <select
                      value={formData.nivel_seguridad || 'Estándar'}
                      onChange={(e) => handleInputChange('nivel_seguridad', e.target.value)}
                    >
                      <option value="Básico">Básico</option>
                      <option value="Estándar">Estándar</option>
                      <option value="Premium">Premium</option>
                      <option value="Alto">Alto</option>
                    </select>
                  ) : (
                    <p className="info-value">{parkingData?.nivel_seguridad || 'Estándar'}</p>
                  )}
                </div>
              </div>

              {/* CAPACIDAD */}
              <div className="info-section">
                <h3>Capacidad</h3>
                <div className="capacity-grid">
                  <div className="form-group">
                    <label>Total de Plazas</label>
                    {editing ? (
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={formData.total_plazas || 0}
                        onChange={(e) => handleInputChange('total_plazas', parseInt(e.target.value) || 0)}
                      />
                    ) : (
                      <p className="info-value">{parkingData?.total_plazas || 0} plazas</p>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Plazas Disponibles</label>
                    {editing ? (
                      <input
                        type="number"
                        min="0"
                        max={formData.total_plazas || 0}
                        value={formData.plazas_disponibles || 0}
                        onChange={(e) => handleInputChange('plazas_disponibles', parseInt(e.target.value) || 0)}
                      />
                    ) : (
                      <p className="info-value">{parkingData?.plazas_disponibles || 0} disponibles</p>
                    )}
                  </div>
                </div>

                {parkingData?.total_plazas > 0 && (
                  <div className="capacity-bar">
                    <div
                      className="capacity-fill"
                      style={{
                        width: `${((parkingData.total_plazas - parkingData.plazas_disponibles) / parkingData.total_plazas) * 100}%`
                      }}
                    ></div>
                    <span className="capacity-text">
                      Ocupación: {parkingData.total_plazas - parkingData.plazas_disponibles} / {parkingData.total_plazas}
                    </span>
                  </div>
                )}
              </div>

              {/* ESTADO ACTUAL */}
              <div className="info-section">
                <h3>Estado Actual</h3>
                <div className="status-grid">
                  <div className="status-item">
                    <span className="status-label">Estado:</span>
                    <span className={`status-value ${parkingData?.activo ? 'active' : 'inactive'}`}>
                      {parkingData?.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Aprobación:</span>
                    <span className={`status-value ${parkingData?.aprobado ? 'approved' : 'pending'}`}>
                      {parkingData?.aprobado ? 'Aprobado' : 'Pendiente'}
                    </span>
                  </div>
                  <div className="status-item">
                    <span className="status-label">Calificación:</span>
                    <span className="status-value rating">
                      ⭐ {parkingData?.rating_promedio || '0.00'}
                      {parkingData?.total_reseñas > 0 && ` (${parkingData.total_reseñas} reseñas)`}
                    </span>
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
                        value={formData.tarifa_hora || 0}
                        onChange={(e) => handleInputChange('tarifa_hora', parseFloat(e.target.value) || 0)}
                      />
                      <span className="period">/ hora</span>
                    </div>
                  ) : (
                    <div className="rate-value">
                      <span className="amount">{formatCurrency(parkingData?.tarifa_hora || 0)}</span>
                      <span className="period">/ hora</span>
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

              {/* Información de ingresos simulada */}
              <div className="revenue-section">
                <h4>Resumen de Ingresos</h4>
                <div className="revenue-grid">
                  <div className="revenue-item">
                    <span className="revenue-label">Hoy</span>
                    <span className="revenue-amount">{formatCurrency(0)}</span>
                  </div>
                  <div className="revenue-item">
                    <span className="revenue-label">Esta Semana</span>
                    <span className="revenue-amount">{formatCurrency(0)}</span>
                  </div>
                  <div className="revenue-item">
                    <span className="revenue-label">Este Mes</span>
                    <span className="revenue-amount">{formatCurrency(0)}</span>
                  </div>
                </div>
              </div>
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
                      {parkingData?.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    <span className="toggle-note">
                      {parkingData?.activo ?
                        'Aparece en las búsquedas' :
                        'No aparece en las búsquedas'}
                    </span>
                  </div>
                  <p className="setting-description">
                    Cuando está inactivo, no aparecerá en las búsquedas de los usuarios
                  </p>
                </div>

                <div className="setting-card">
                  <h4>Información del Sistema</h4>
                  <div className="system-info">
                    <div className="info-item">
                      <span className="info-label">ID del Estacionamiento:</span>
                      <span className="info-value">{parkingData?.id || 'N/A'}</span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Fecha de Registro:</span>
                      <span className="info-value">
                        {parkingData?.fecha_creacion ?
                          new Date(parkingData.fecha_creacion).toLocaleDateString() :
                          'No disponible'}
                      </span>
                    </div>
                    <div className="info-item">
                      <span className="info-label">Última Actualización:</span>
                      <span className="info-value">
                        {parkingData?.fecha_actualizacion ?
                          new Date(parkingData.fecha_actualizacion).toLocaleDateString() :
                          'No disponible'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="setting-card">
                  <h4>Acciones Rápidas</h4>
                  <div className="quick-actions">
                    <button className="btn-action-secondary">
                      <i className="fas fa-sync"></i>
                      Actualizar Disponibilidad
                    </button>
                    <button className="btn-action-secondary">
                      <i className="fas fa-chart-bar"></i>
                      Ver Reportes
                    </button>
                    <button className="btn-action-secondary">
                      <i className="fas fa-qrcode"></i>
                      Generar Códigos QR
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  );
};

export default OwnerParking;