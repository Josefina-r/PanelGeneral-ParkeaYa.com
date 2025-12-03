import React, { useState, useEffect } from 'react';
import './AdminSystem.css';

const SystemSettings = () => {
  const [settings, setSettings] = useState({
    siteName: 'Parkeaya',
    contactEmail: 'admin@parkeaya.com',
    commissionRate: 30,
    currency: 'PEN',
    maintenanceMode: false
  });

  const [platformStats, setPlatformStats] = useState(null);
  const [pendingParkings, setPendingParkings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  const API_BASE = 'http://localhost:8000/api';

  useEffect(() => {
    loadAdminData();
  }, []);

  const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
  });

  const loadAdminData = async () => {
    setLoading(true);
    try {
      // Cargar estadísticas de la plataforma
      const analyticsRes = await fetch(`${API_BASE}/analytics/admin/dashboard/`, { 
        headers: getAuthHeaders() 
      });
      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json();
        setPlatformStats(analyticsData);
      }

      // Cargar parkings pendientes
      const pendingRes = await fetch(`${API_BASE}/parking/admin/pending-parkings/`, { 
        headers: getAuthHeaders() 
      });
      if (pendingRes.ok) {
        const pending = await pendingRes.json();
        setPendingParkings(pending.results || pending || []);
      }

    } catch (error) {
      console.error('Error cargando datos:', error);
      setSaveStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const approveParking = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/parking/parkings/${id}/approve/`, { 
        method: 'POST', 
        headers: getAuthHeaders() 
      });
      if (res.ok) {
        await loadAdminData();
      }
    } catch (error) {
      console.error('Error aprobando parking:', error);
    }
  };

  const rejectParking = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/parking/parkings/${id}/reject/`, { 
        method: 'POST', 
        headers: getAuthHeaders() 
      });
      if (res.ok) {
        await loadAdminData();
      }
    } catch (error) {
      console.error('Error rechazando parking:', error);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    setSaveStatus('saving');
    
    try {
      const res = await fetch(`${API_BASE}/admin/settings/`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify(settings)
      });

      if (res.ok) {
        setSaveStatus('success');
      } else {
        setSaveStatus('error');
      }
    } catch (error) {
      setSaveStatus('error');
    } finally {
      setLoading(false);
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  return (
    <div className="system-settings">
      <div className="settings-header">
        <h1>Configuración del Sistema</h1>
        <p>Gestiona la configuración general de la plataforma</p>
      </div>

      <div className="settings-content">
        
        {/* CONFIGURACIÓN GENERAL */}
        <div className="settings-section">
          <h2>Configuración General</h2>
          
          <div className="form-group">
            <label>Nombre del Sitio</label>
            <input
              type="text"
              value={settings.siteName}
              onChange={(e) => setSettings({...settings, siteName: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label>Email de Contacto</label>
            <input
              type="email"
              value={settings.contactEmail}
              onChange={(e) => setSettings({...settings, contactEmail: e.target.value})}
            />
          </div>

          <div className="form-group">
            <label>Comisión de la Plataforma (%)</label>
            <input
              type="number"
              min="0"
              max="50"
              value={settings.commissionRate}
              onChange={(e) => setSettings({...settings, commissionRate: parseInt(e.target.value)})}
            />
          </div>
        </div>

        {/* CONFIGURACIÓN AVANZADA */}
        <div className="settings-section">
          <h2>Configuración Avanzada</h2>
          
          <div className="form-group">
            <label className="toggle-item">
              <span>Modo Mantenimiento</span>
              <input
                type="checkbox"
                checked={settings.maintenanceMode}
                onChange={(e) => setSettings({...settings, maintenanceMode: e.target.checked})}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        {/* RESUMEN RÁPIDO */}
        <div className="settings-section">
          <h2>Resumen de la Plataforma</h2>
          <div className="summary-grid">
            <div className="summary-card">
              <h3>Total Reservas</h3>
              <p>{platformStats?.total_reservations || '0'}</p>
            </div>
            <div className="summary-card">
              <h3>Ingresos Totales</h3>
              <p>S/ {platformStats?.total_revenue || '0'}</p>
            </div>
            <div className="summary-card">
              <h3>Parkings Activos</h3>
              <p>{platformStats?.active_parkings || '0'}</p>
            </div>
            <div className="summary-card">
              <h3>Parkings Pendientes</h3>
              <p>{pendingParkings.length}</p>
            </div>
          </div>
        </div>

        {/* PARKINGS PENDIENTES */}
        <div className="settings-section">
          <h2>Aprobación de Parkings</h2>
          {pendingParkings.length === 0 ? (
            <p>No hay parkings pendientes de aprobación.</p>
          ) : (
            <div className="pending-list">
              {pendingParkings.map(parking => (
                <div key={parking.id} className="pending-item">
                  <div className="parking-info">
                    <strong>{parking.nombre}</strong>
                    <span>{parking.direccion}</span>
                    <small>Propietario: {parking.propietario?.username || 'N/A'}</small>
                  </div>
                  <div className="pending-actions">
                    <button 
                      onClick={() => approveParking(parking.id)} 
                      className="btn-approve"
                    >
                      Aprobar
                    </button>
                    <button 
                      onClick={() => rejectParking(parking.id)} 
                      className="btn-reject"
                    >
                      Rechazar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div className="settings-actions">
          <button 
            className="btn-primary"
            onClick={handleSaveSettings}
            disabled={loading}
          >
            {loading ? 'Guardando...' : 'Guardar Configuración'}
          </button>

          {saveStatus === 'success' && (
            <span className="save-status success">✓ Configuración guardada</span>
          )}
          {saveStatus === 'error' && (
            <span className="save-status error">✗ Error al guardar</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;