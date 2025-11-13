import React, { useState, useEffect } from 'react';
import './OwnerProfile.css';

const OwnerProfile = () => {
  const [ownerData, setOwnerData] = useState(null);
  const [parkingData, setParkingData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('info');
  const [editing, setEditing] = useState(false);
  const [showParkingForm, setShowParkingForm] = useState(false);
  const [formData, setFormData] = useState({});
  const [parkingForm, setParkingForm] = useState({
    nombre: '',
    direccion: '',
    coordenadas: '',
    telefono: '',
    descripcion: '',
    horario_apertura: '',
    horario_cierre: '',
    nivel_seguridad: 'Estándar',
    tarifa_hora: '',
    total_plazas: '',
    plazas_disponibles: '',
    servicios: []
  });

  const API_BASE = 'http://localhost:8000/api';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // Cargar datos del owner
  const loadOwnerData = async () => {
    try {
      const response = await fetch(`${API_BASE}/users/profile/`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Datos del owner (raw):', data);

        const normalized = {
         
          ...data,
          
          first_name: data.first_name || data.nombre || data.name || (data.full_name ? data.full_name.split(' ')[0] : ''),
          last_name: data.last_name || data.apellido || (data.full_name ? data.full_name.split(' ').slice(1).join(' ') : ''),
          phone_number: data.phone_number || data.telefono || data.phone || '',
          address: data.address || data.direccion || data.address_line || '',
          is_active: (data.is_active !== undefined) ? data.is_active : (data.activo !== undefined ? data.activo : true),
      
          date_joined: data.date_joined || data.created_at || data.fecha_creacion || null
        };

        setOwnerData(normalized);
        setFormData({
          first_name: normalized.first_name || '',
          last_name: normalized.last_name || '',
          email: normalized.email || '',
          phone_number: normalized.phone_number || '',
          address: normalized.address || ''
        });
      } else {
        throw new Error('Error cargando datos del perfil');
      }
    } catch (error) {
      console.error('Error cargando datos del owner:', error);
      showNotification('Error cargando datos del perfil', 'error');
    }
  };

  // Cargar estacionamientos del owner
  const loadParkingData = async () => {
    try {
      const response = await fetch(`${API_BASE}/parking/my-parkings/`, {
        headers: getAuthHeaders()
      });
      
      console.log('🔄 Cargando estacionamientos...');
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Estacionamientos cargados:', data);
        setParkingData(data);

        // Si el perfil ya está cargado pero no tiene dirección, rellenarla desde el primer estacionamiento
        setOwnerData(prev => {
          try {
            if (!prev) return prev;
            if (prev.address && prev.address.trim() !== '') return prev;
            const first = Array.isArray(data) && data.length > 0 ? data[0] : null;
            const addr = first ? (first.direccion || first.address || first.location || '') : '';
            if (addr) {
              return { ...prev, address: addr };
            }
            return prev;
          } catch (err) {
            console.warn('No se pudo normalizar dirección desde estacionamientos:', err);
            return prev;
          }
        });
      } else if (response.status === 404) {
        console.log('ℹNo hay estacionamientos registrados');
        setParkingData([]);
      } else {
        throw new Error(`Error ${response.status} cargando estacionamientos`);
      }
    } catch (error) {
      console.error('Error cargando estacionamientos:', error);
      showNotification('Error cargando estacionamientos', 'error');
      setParkingData([]);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([loadOwnerData(), loadParkingData()]);
      } catch (error) {
        console.error('Error en carga inicial:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  // Actualizar perfil del owner
  const updateOwnerProfile = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_BASE}/users/owner/me/`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(formData)
      });

      if (response.ok) {
        const updatedData = await response.json();
        setOwnerData(updatedData);
        setEditing(false);
        showNotification('Perfil actualizado correctamente', 'success');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Error al actualizar perfil');
      }
    } catch (error) {
      console.error('Error actualizando perfil:', error);
      showNotification(error.message, 'error');
    }
  };

  // Crear nuevo estacionamiento
  const createParking = async (e) => {
    e.preventDefault();
    try {
      // Preparar datos para la API
      const parkingDataToSend = {
        nombre: parkingForm.nombre,
        direccion: parkingForm.direccion,
        coordenadas: parkingForm.coordenadas || '',
        telefono: parkingForm.telefono,
        descripcion: parkingForm.descripcion || '',
        horario_apertura: parkingForm.horario_apertura || null,
        horario_cierre: parkingForm.horario_cierre || null,
        nivel_seguridad: parkingForm.nivel_seguridad,
        tarifa_hora: parseFloat(parkingForm.tarifa_hora),
        total_plazas: parseInt(parkingForm.total_plazas),
        plazas_disponibles: parseInt(parkingForm.plazas_disponibles),
        servicios: parkingForm.servicios,
        panel_local_id: `owner_${ownerData?.id}_${Date.now()}`
      };

      console.log('📤 Enviando datos del estacionamiento:', parkingDataToSend);

      const response = await fetch(`${API_BASE}/parking/approval/requests/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(parkingDataToSend)
      });

      if (response.ok) {
        const newParking = await response.json();
        console.log('✅ Estacionamiento creado:', newParking);
        showNotification('Estacionamiento creado y enviado para aprobación', 'success');
        setShowParkingForm(false);
        resetParkingForm();
        // Recargar la lista de estacionamientos
        await loadParkingData();
      } else {
        const errorData = await response.json();
        console.error('❌ Error del servidor:', errorData);
        throw new Error(errorData.detail || errorData.message || 'Error creando estacionamiento');
      }
    } catch (error) {
      console.error('Error creando estacionamiento:', error);
      showNotification(error.message, 'error');
    }
  };

  // Resetear formulario de estacionamiento
  const resetParkingForm = () => {
    setParkingForm({
      nombre: '',
      direccion: '',
      coordenadas: '',
      telefono: '',
      descripcion: '',
      horario_apertura: '',
      horario_cierre: '',
      nivel_seguridad: 'Estándar',
      tarifa_hora: '',
      total_plazas: '',
      plazas_disponibles: '',
      servicios: []
    });
  };

  // Opciones predefinidas
  const securityLevels = ['Básico', 'Estándar', 'Premium', 'Alto'];
  const servicesOptions = [
    'Vigilancia 24/7',
    'Cámaras de seguridad',
    'Iluminación LED',
    'Cobertura techada',
    'Carga para EVs',
    'Lavado de autos',
    'Aceite y lubricación',
    'Asistencia mecánica',
    'Wi-Fi gratuito',
    'Cafetería'
  ];

  const handleParkingInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setParkingForm(prev => ({
        ...prev,
        servicios: checked 
          ? [...prev.servicios, value]
          : prev.servicios.filter(service => service !== value)
      }));
    } else {
      setParkingForm(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Formatear hora para mostrar
  const formatTimeForDisplay = (timeString) => {
    if (!timeString) return '24 horas';
    try {
      const [hours, minutes] = timeString.split(':');
      return `${hours}:${minutes}`;
    } catch (error) {
      return timeString;
    }
  };

  // Formatear hora para input time
  const formatTimeForInput = (timeString) => {
    if (!timeString) return '';
    try {
     
      if (timeString.match(/^\d{2}:\d{2}$/)) {
        return timeString;
      }
      const time = new Date(`1970-01-01T${timeString}Z`);
      return time.toTimeString().slice(0, 5);
    } catch (error) {
      return '';
    }
  };

  const showNotification = (message, type) => {
    // Usar el sistema de notificaciones existente del dashboard
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  if (loading) {
    return (
      <div className="profile-loading">
        <div className="loading-spinner"></div>
        <p>Cargando información del perfil...</p>
      </div>
    );
  }

  return (
    <div className="owner-profile">
      {/* Header del perfil */}
      <div className="profile-header">
        <div className="profile-avatar-section">
          <div className="avatar-container">
            <div className="avatar-placeholder">
              {ownerData?.first_name?.charAt(0) || ownerData?.phone_number?.slice(-2) || '?'}{ownerData?.last_name?.charAt(0) || ''}
            </div>
            <div className="online-indicator"></div>
          </div>
          <div className="profile-info">
            <h1>{ownerData?.first_name} {ownerData?.last_name}</h1>
            <p className="profile-role">
              <i className="fas fa-store"></i>
              Propietario de Estacionamiento
            </p>
            <p className="profile-email">
              <i className="fas fa-envelope"></i>
              {ownerData?.email}
            </p>
            <div className="profile-meta">
              <span className="meta-item">
                <i className="fas fa-calendar"></i>
                Registrado: {ownerData?.date_joined ? new Date(ownerData.date_joined).toLocaleDateString() : 'N/A'}
              </span>
              <span className={`status-badge ${ownerData?.is_active ? 'active' : 'inactive'}`}>
                <i className={`fas fa-${ownerData?.is_active ? 'check' : 'pause'}-circle`}></i>
                {ownerData?.is_active ? 'Activo' : 'Inactivo'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="profile-stats-grid">
          <div className="stat-card primary">
            <div className="stat-icon">
              <i className="fas fa-parking"></i>
            </div>
            <div className="stat-content">
              <h3>{parkingData?.length || 0}</h3>
              <p>Estacionamientos</p>
            </div>
          </div>
          
          <div className="stat-card secondary">
            <div className="stat-icon">
              <i className="fas fa-phone"></i>
            </div>
            <div className="stat-content">
              <h3>{ownerData?.phone_number || 'No registrado'}</h3>
              <p>Teléfono</p>
            </div>
          </div>
          
          <div className="stat-card success">
            <div className="stat-icon">
              <i className="fas fa-check-circle"></i>
            </div>
            <div className="stat-content">
              <h3>{parkingData?.filter(p => p.aprobado).length || 0}</h3>
              <p>Aprobados</p>
            </div>
          </div>
          
          <div className="stat-card warning">
            <div className="stat-icon">
              <i className="fas fa-clock"></i>
            </div>
            <div className="stat-content">
              <h3>{parkingData?.filter(p => !p.aprobado).length || 0}</h3>
              <p>Pendientes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navegación por pestañas */}
      <div className="profile-tabs-container">
        <div className="profile-tabs">
          <button 
            className={`tab-button ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            <i className="fas fa-user"></i>
            Información Personal
          </button>
          <button 
            className={`tab-button ${activeTab === 'parking' ? 'active' : ''}`}
            onClick={() => setActiveTab('parking')}
          >
            <i className="fas fa-parking"></i>
            Mis Estacionamientos
            {parkingData?.length > 0 && (
              <span className="tab-badge">{parkingData.length}</span>
            )}
          </button>
          <button 
            className={`tab-button ${activeTab === 'security' ? 'active' : ''}`}
            onClick={() => setActiveTab('security')}
          >
            <i className="fas fa-shield-alt"></i>
            Seguridad
          </button>
        </div>
      </div>

      {/* Contenido de las pestañas */}
      <div className="tab-content-wrapper">
        {activeTab === 'info' && (
          <div className="info-tab">
            <div className="section-header">
              <div className="section-title">
                <i className="fas fa-user-circle"></i>
                <h2>Información Personal</h2>
              </div>
              <button 
                className={`edit-btn ${editing ? 'cancel' : 'edit'}`}
                onClick={() => setEditing(!editing)}
              >
                <i className={`fas fa-${editing ? 'times' : 'edit'}`}></i>
                {editing ? 'Cancelar' : 'Editar Perfil'}
              </button>
            </div>

            {editing ? (
              <form onSubmit={updateOwnerProfile} className="profile-form">
                <div className="form-grid">
                  <div className="form-group">
                    <label>
                      <i className="fas fa-user"></i>
                      Nombre
                    </label>
                    <input
                      type="text"
                      name="first_name"
                      value={formData.first_name || ''}
                      onChange={handleInputChange}
                      required
                      placeholder="Ingresa tu nombre"
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <i className="fas fa-user"></i>
                      Apellido
                    </label>
                    <input
                      type="text"
                      name="last_name"
                      value={formData.last_name || ''}
                      onChange={handleInputChange}
                      required
                      placeholder="Ingresa tu apellido"
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <i className="fas fa-envelope"></i>
                      Email
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email || ''}
                      onChange={handleInputChange}
                      required
                      disabled
                      className="disabled-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      <i className="fas fa-phone"></i>
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      name="phone_number"
                      value={formData.phone_number || ''}
                      onChange={handleInputChange}
                      placeholder="+51 987 654 321"
                    />
                  </div>
                  <div className="form-group full-width">
                    <label>
                      <i className="fas fa-map-marker-alt"></i>
                      Dirección
                    </label>
                    <input
                      type="text"
                      name="address"
                      value={formData.address || ''}
                      onChange={handleInputChange}
                      placeholder="Ingresa tu dirección completa"
                    />
                  </div>
                </div>
                <div className="form-actions">
                  <button type="submit" className="save-btn">
                    <i className="fas fa-save"></i>
                    Guardar Cambios
                  </button>
                </div>
              </form>
            ) : (
              <div className="info-display">
                <div className="info-grid">
                  <div className="info-card">
                    <div className="info-icon">
                      <i className="fas fa-id-card"></i>
                    </div>
                    <div className="info-content">
                      <label>Nombre Completo</label>
                      <p>{ownerData?.first_name} {ownerData?.last_name}</p>
                    </div>
                  </div>
                  
                  <div className="info-card">
                    <div className="info-icon">
                      <i className="fas fa-envelope"></i>
                    </div>
                    <div className="info-content">
                      <label>Email</label>
                      <p>{ownerData?.email}</p>
                    </div>
                  </div>
                  
                  <div className="info-card">
                    <div className="info-icon">
                      <i className="fas fa-phone"></i>
                    </div>
                    <div className="info-content">
                      <label>Teléfono</label>
                      <p>{ownerData?.phone_number || 'No registrado'}</p>
                    </div>
                  </div>
                  
                  <div className="info-card">
                    <div className="info-icon">
                      <i className="fas fa-map-marker-alt"></i>
                    </div>
                    <div className="info-content">
                      <label>Dirección</label>
                      <p>{ownerData?.address || 'No registrada'}</p>
                    </div>
                  </div>
                  
                  <div className="info-card">
                    <div className="info-icon">
                      <i className="fas fa-calendar-plus"></i>
                    </div>
                    <div className="info-content">
                      <label>Fecha de Registro</label>
                      <p>{ownerData?.date_joined ? new Date(ownerData.date_joined).toLocaleDateString('es-ES', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      }) : 'N/A'}</p>
                    </div>
                  </div>
                  
                  <div className="info-card">
                    <div className="info-icon">
                      <i className="fas fa-user-shield"></i>
                    </div>
                    <div className="info-content">
                      <label>Estado de Cuenta</label>
                      <p className={`status ${ownerData?.is_active ? 'active' : 'inactive'}`}>
                        <i className={`fas fa-${ownerData?.is_active ? 'check' : 'pause'}-circle`}></i>
                        {ownerData?.is_active ? 'Activo' : 'Inactivo'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'parking' && (
          <div className="parking-tab">
            <div className="section-header">
              <div className="section-title">
                <i className="fas fa-parking"></i>
                <h2>Mis Estacionamientos</h2>
                {parkingData?.length > 0 && (
                  <span className="section-subtitle">
                    {parkingData.length} estacionamiento{parkingData.length !== 1 ? 's' : ''} registrado{parkingData.length !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
              <button 
                className="add-parking-btn"
                onClick={() => setShowParkingForm(true)}
              >
                <i className="fas fa-plus"></i>
                Agregar Estacionamiento
              </button>
            </div>
            
            {showParkingForm && (
              <div className="parking-form-modal">
                <div className="modal-content">
                  <div className="modal-header">
                    <h3>
                      <i className="fas fa-plus-circle"></i>
                      Nuevo Estacionamiento
                    </h3>
                    <button 
                      className="close-btn"
                      onClick={() => {
                        setShowParkingForm(false);
                        resetParkingForm();
                      }}
                    >
                      <i className="fas fa-times"></i>
                    </button>
                  </div>
                  
                  <form onSubmit={createParking} className="parking-form">
                    <div className="form-columns">
                      <div className="form-column">
                        <h4>Información Básica</h4>
                        
                        <div className="form-group">
                          <label>
                            <i className="fas fa-signature"></i>
                            Nombre del Estacionamiento *
                          </label>
                          <input
                            type="text"
                            name="nombre"
                            value={parkingForm.nombre}
                            onChange={handleParkingInputChange}
                            required
                            placeholder="Ej: Estacionamiento Central"
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>
                            <i className="fas fa-map-marker-alt"></i>
                            Dirección Completa *
                          </label>
                          <input
                            type="text"
                            name="direccion"
                            value={parkingForm.direccion}
                            onChange={handleParkingInputChange}
                            required
                            placeholder="Ej: Av. Principal #123, Ciudad"
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>
                            <i className="fas fa-map-pin"></i>
                            Coordenadas (Opcional)
                          </label>
                          <input
                            type="text"
                            name="coordenadas"
                            value={parkingForm.coordenadas}
                            onChange={handleParkingInputChange}
                            placeholder="Ej: 40.7128, -74.0060"
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>
                            <i className="fas fa-phone"></i>
                            Teléfono de Contacto *
                          </label>
                          <input
                            type="tel"
                            name="telefono"
                            value={parkingForm.telefono}
                            onChange={handleParkingInputChange}
                            required
                            placeholder="+51 987 654 321"
                          />
                        </div>
                        
                        <div className="form-group">
                          <label>
                            <i className="fas fa-align-left"></i>
                            Descripción
                          </label>
                          <textarea
                            name="descripcion"
                            value={parkingForm.descripcion}
                            onChange={handleParkingInputChange}
                            rows="3"
                            placeholder="Describe las características de tu estacionamiento..."
                          />
                        </div>
                      </div>
                      
                      <div className="form-column">
                        <h4>Configuración Operativa</h4>
                        
                        <div className="form-row">
                          <div className="form-group">
                            <label>
                              <i className="fas fa-clock"></i>
                              Horario Apertura
                            </label>
                            <input
                              type="time"
                              name="horario_apertura"
                              value={parkingForm.horario_apertura}
                              onChange={handleParkingInputChange}
                              placeholder="08:00"
                            />
                            <small className="form-help">Dejar vacío para 24 horas</small>
                          </div>
                          
                          <div className="form-group">
                            <label>
                              <i className="fas fa-clock"></i>
                              Horario Cierre
                            </label>
                            <input
                              type="time"
                              name="horario_cierre"
                              value={parkingForm.horario_cierre}
                              onChange={handleParkingInputChange}
                              placeholder="22:00"
                            />
                            <small className="form-help">Dejar vacío para 24 horas</small>
                          </div>
                        </div>
                        
                        <div className="form-group">
                          <label>
                            <i className="fas fa-shield-alt"></i>
                            Nivel de Seguridad *
                          </label>
                          <select
                            name="nivel_seguridad"
                            value={parkingForm.nivel_seguridad}
                            onChange={handleParkingInputChange}
                            required
                          >
                            {securityLevels.map(level => (
                              <option key={level} value={level}>
                                {level}
                              </option>
                            ))}
                          </select>
                        </div>
                        
                        <div className="form-group">
                          <label>
                            <i className="fas fa-money-bill-wave"></i>
                            Tarifa por Hora (S/) *
                          </label>
                          <input
                            type="number"
                            name="tarifa_hora"
                            value={parkingForm.tarifa_hora}
                            onChange={handleParkingInputChange}
                            required
                            min="0"
                            step="0.01"
                            placeholder="5.00"
                          />
                        </div>
                        
                        <div className="form-row">
                          <div className="form-group">
                            <label>
                              <i className="fas fa-car"></i>
                              Total de Plazas *
                            </label>
                            <input
                              type="number"
                              name="total_plazas"
                              value={parkingForm.total_plazas}
                              onChange={handleParkingInputChange}
                              required
                              min="1"
                              placeholder="50"
                            />
                          </div>
                          
                          <div className="form-group">
                            <label>
                              <i className="fas fa-car-side"></i>
                              Plazas Disponibles *
                            </label>
                            <input
                              type="number"
                              name="plazas_disponibles"
                              value={parkingForm.plazas_disponibles}
                              onChange={handleParkingInputChange}
                              required
                              min="0"
                              max={parkingForm.total_plazas || ''}
                              placeholder="45"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="services-section">
                      <h4>
                        <i className="fas fa-concierge-bell"></i>
                        Servicios Adicionales
                      </h4>
                      <div className="services-grid">
                        {servicesOptions.map(service => (
                          <label key={service} className="service-checkbox">
                            <input
                              type="checkbox"
                              value={service}
                              checked={parkingForm.servicios.includes(service)}
                              onChange={handleParkingInputChange}
                            />
                            <span className="checkmark"></span>
                            {service}
                          </label>
                        ))}
                      </div>
                    </div>
                    
                    <div className="form-actions">
                      <button 
                        type="button" 
                        className="cancel-btn"
                        onClick={() => {
                          setShowParkingForm(false);
                          resetParkingForm();
                        }}
                      >
                        <i className="fas fa-times"></i>
                        Cancelar
                      </button>
                      <button type="submit" className="submit-btn">
                        <i className="fas fa-plus-circle"></i>
                        Crear Estacionamiento
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            
            {parkingData?.length > 0 ? (
              <div className="parking-grid">
                {parkingData.map(parking => (
                  <div key={parking.id} className="parking-card">
                    <div className="parking-header">
                      <div className="parking-title">
                        <h3>{parking.nombre}</h3>
                        <div className="parking-meta">
                          <span className={`status ${parking.aprobado ? 'approved' : 'pending'}`}>
                            <i className={`fas fa-${parking.aprobado ? 'check' : 'clock'}`}></i>
                            {parking.aprobado ? 'Aprobado' : 'Pendiente'}
                          </span>
                          <span className={`status ${parking.activo ? 'active' : 'inactive'}`}>
                            <i className={`fas fa-${parking.activo ? 'play' : 'pause'}`}></i>
                            {parking.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </div>
                      </div>
                      <div className="parking-rating">
                        <div className="stars">
                          {'★'.repeat(Math.round(parking.rating_promedio || 0))}
                          {'☆'.repeat(5 - Math.round(parking.rating_promedio || 0))}
                        </div>
                        <span>({parking.total_reseñas || 0})</span>
                      </div>
                    </div>
                    
                    <div className="parking-info">
                      <div className="info-item">
                        <i className="fas fa-map-marker-alt"></i>
                        <span>{parking.direccion}</span>
                      </div>
                      <div className="info-item">
                        <i className="fas fa-car"></i>
                        <span>{parking.plazas_disponibles || 0}/{parking.total_plazas || 0} plazas disponibles</span>
                      </div>
                      <div className="info-item">
                        <i className="fas fa-money-bill-wave"></i>
                        <span>${parseFloat(parking.tarifa_hora || 0).toFixed(2)}/hora</span>
                      </div>
                      <div className="info-item">
                        <i className="fas fa-shield-alt"></i>
                        <span>Seguridad: {parking.nivel_seguridad || 'Estándar'}</span>
                      </div>
                      <div className="info-item">
                        <i className="fas fa-clock"></i>
                        <span>
                          Horario: {parking.horario_apertura ? formatTimeForDisplay(parking.horario_apertura) : '24'} - 
                          {parking.horario_cierre ? formatTimeForDisplay(parking.horario_cierre) : '24'} horas
                        </span>
                      </div>
                    </div>
                    
                    <div className="parking-actions">
                      <button className="action-btn edit">
                        <i className="fas fa-edit"></i>
                        Editar
                      </button>
                      <button className="action-btn view">
                        <i className="fas fa-eye"></i>
                        Ver Detalles
                      </button>
                      <button className="action-btn stats">
                        <i className="fas fa-chart-bar"></i>
                        Estadísticas
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">🚗</div>
                <h3>No tienes estacionamientos registrados</h3>
                <p>Comienza agregando tu primer estacionamiento para gestionar tus espacios de parking</p>
                <button 
                  className="add-parking-btn primary"
                  onClick={() => setShowParkingForm(true)}
                >
                  <i className="fas fa-plus"></i>
                  Agregar Primer Estacionamiento
                </button>
              </div>
            )}
          </div>
        )}

        {activeTab === 'security' && (
          <div className="security-tab">
            <div className="section-header">
              <div className="section-title">
                <i className="fas fa-shield-alt"></i>
                <h2>Seguridad y Cuenta</h2>
              </div>
            </div>
            
            <div className="security-sections">
              <div className="security-card">
                <div className="security-icon">
                  <i className="fas fa-key"></i>
                </div>
                <div className="security-content">
                  <h3>Cambiar Contraseña</h3>
                  <p>Actualiza tu contraseña regularmente para mantener tu cuenta segura</p>
                  <button className="security-btn primary">
                    <i className="fas fa-sync-alt"></i>
                    Cambiar Contraseña
                  </button>
                </div>
              </div>
              
              <div className="security-card">
                <div className="security-icon">
                  <i className="fas fa-desktop"></i>
                </div>
                <div className="security-content">
                  <h3>Sesión Actual</h3>
                  <p>Gestiona tu sesión actual y dispositivos conectados</p>
                  <button className="security-btn secondary">
                    <i className="fas fa-cog"></i>
                    Gestionar Sesión
                  </button>
                </div>
              </div>
              
              <div className="security-card warning">
                <div className="security-icon">
                  <i className="fas fa-exclamation-triangle"></i>
                </div>
                <div className="security-content">
                  <h3>Zona de Peligro</h3>
                  <p>Acciones que no se pueden deshacer. Procede con precaución.</p>
                  <button className="security-btn danger">
                    <i className="fas fa-user-slash"></i>
                    Desactivar Cuenta
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OwnerProfile;