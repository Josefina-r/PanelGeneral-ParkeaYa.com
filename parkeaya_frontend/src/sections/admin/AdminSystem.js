// SystemSettings.jsx
import React, { useState, useEffect } from 'react';
import './AdminSystem.css';

const SystemSettings = () => {
  const [settings, setSettings] = useState({
    // Configuración General
    siteName: 'Parkeaya',
    siteDescription: 'Sistema de Reserva de Estacionamientos',
    contactEmail: 'admin@parkeaya.com',
    supportPhone: '+57 1 2345678',
    
    // Configuración de Negocio
    commissionRate: 30,
    minimumReservationTime: 1, // horas
    maximumReservationTime: 24, // horas
    cancellationPolicy: 'flexible', // flexible, moderate, strict
    
    // Configuración de Pagos
    paymentMethods: ['credit_card', 'debit_card', 'pse', 'cash'],
    currency: 'COP',
    taxRate: 19,
    
    // Configuración de Notificaciones
    emailNotifications: true,
    smsNotifications: false,
    pushNotifications: true,
    
    // Configuración de Seguridad
    sessionTimeout: 60, // minutos
    maxLoginAttempts: 5,
    requireEmailVerification: true,
    
    // Configuración Técnica
    maintenanceMode: false,
    apiRateLimit: 100, // requests por minuto
    cacheEnabled: true
  });

  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // Cargar configuración actual
  useEffect(() => {
    loadCurrentSettings();
  }, []);

  const loadCurrentSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings/', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });
      const data = await response.json();
      setSettings(data);
    } catch (error) {
      console.error('Error cargando configuración:', error);
    }
  };

  const handleSaveSettings = async () => {
    setLoading(true);
    setSaveStatus('saving');
    
    try {
      const response = await fetch('/api/admin/settings/', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify(settings)
      });

      if (response.ok) {
        setSaveStatus('success');
        setTimeout(() => setSaveStatus(''), 3000);
      } else {
        throw new Error('Error guardando configuración');
      }
    } catch (error) {
      setSaveStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const handleResetToDefaults = () => {
    if (window.confirm('¿Estás seguro de restaurar la configuración por defecto?')) {
      setSettings({
        ...settings,
        commissionRate: 30,
        minimumReservationTime: 1,
        maximumReservationTime: 24,
        cancellationPolicy: 'flexible'
      });
    }
  };

  return (
    <div className="system-settings">
      <div className="settings-header">
        <h1>Configuración del Sistema</h1>
        <p>Gestiona la configuración general de la plataforma</p>
      </div>

      <div className="settings-tabs">
        <button className="tab-active">General</button>
        <button>Pagos</button>
        <button>Notificaciones</button>
        <button>Seguridad</button>
        <button>Avanzado</button>
      </div>

      <div className="settings-content">
        
        {/* SECCIÓN GENERAL */}
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
            <label>Descripción</label>
            <textarea
              value={settings.siteDescription}
              onChange={(e) => setSettings({...settings, siteDescription: e.target.value})}
              rows="3"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Email de Contacto</label>
              <input
                type="email"
                value={settings.contactEmail}
                onChange={(e) => setSettings({...settings, contactEmail: e.target.value})}
              />
            </div>
            <div className="form-group">
              <label>Teléfono de Soporte</label>
              <input
                type="text"
                value={settings.supportPhone}
                onChange={(e) => setSettings({...settings, supportPhone: e.target.value})}
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN DE NEGOCIO */}
        <div className="settings-section">
          <h2>Configuración de Negocio</h2>
          
          <div className="form-row">
            <div className="form-group">
              <label>Comisión de la Plataforma (%)</label>
              <input
                type="number"
                min="0"
                max="50"
                value={settings.commissionRate}
                onChange={(e) => setSettings({...settings, commissionRate: parseInt(e.target.value)})}
              />
              <small>Porcentaje que gana la plataforma por cada reserva</small>
            </div>

            <div className="form-group">
              <label>Política de Cancelación</label>
              <select
                value={settings.cancellationPolicy}
                onChange={(e) => setSettings({...settings, cancellationPolicy: e.target.value})}
              >
                <option value="flexible">Flexible (Reembolso completo)</option>
                <option value="moderate">Moderada (Reembolso 50%)</option>
                <option value="strict">Estricta (Sin reembolso)</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Tiempo Mínimo de Reserva (horas)</label>
              <input
                type="number"
                min="1"
                value={settings.minimumReservationTime}
                onChange={(e) => setSettings({...settings, minimumReservationTime: parseInt(e.target.value)})}
              />
            </div>
            <div className="form-group">
              <label>Tiempo Máximo de Reserva (horas)</label>
              <input
                type="number"
                min="1"
                max="168"
                value={settings.maximumReservationTime}
                onChange={(e) => setSettings({...settings, maximumReservationTime: parseInt(e.target.value)})}
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN DE PAGOS */}
        <div className="settings-section">
          <h2>Configuración de Pagos</h2>
          
          <div className="form-group">
            <label>Métodos de Pago Habilitados</label>
            <div className="checkbox-group">
              <label>
                <input type="checkbox" checked={settings.paymentMethods.includes('credit_card')} 
                  onChange={(e) => {
                    const methods = e.target.checked 
                      ? [...settings.paymentMethods, 'credit_card']
                      : settings.paymentMethods.filter(m => m !== 'credit_card');
                    setSettings({...settings, paymentMethods: methods});
                  }}
                />
                Tarjeta de Crédito
              </label>
              <label>
                <input type="checkbox" checked={settings.paymentMethods.includes('debit_card')} 
                  onChange={(e) => {
                    const methods = e.target.checked 
                      ? [...settings.paymentMethods, 'debit_card']
                      : settings.paymentMethods.filter(m => m !== 'debit_card');
                    setSettings({...settings, paymentMethods: methods});
                  }}
                />
                Tarjeta Débito
              </label>
              <label>
                <input type="checkbox" checked={settings.paymentMethods.includes('pse')} 
                  onChange={(e) => {
                    const methods = e.target.checked 
                      ? [...settings.paymentMethods, 'pse']
                      : settings.paymentMethods.filter(m => m !== 'pse');
                    setSettings({...settings, paymentMethods: methods});
                  }}
                />
                PSE
              </label>
              <label>
                <input type="checkbox" checked={settings.paymentMethods.includes('cash')} 
                  onChange={(e) => {
                    const methods = e.target.checked 
                      ? [...settings.paymentMethods, 'cash']
                      : settings.paymentMethods.filter(m => m !== 'cash');
                    setSettings({...settings, paymentMethods: methods});
                  }}
                />
                Efectivo
              </label>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Moneda Principal</label>
              <select
                value={settings.currency}
                onChange={(e) => setSettings({...settings, currency: e.target.value})}
              >
                <option value="COP">Peso Colombiano (COP)</option>
                <option value="USD">Dólar Americano (USD)</option>
              </select>
            </div>
            <div className="form-group">
              <label>IVA (%)</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={settings.taxRate}
                onChange={(e) => setSettings({...settings, taxRate: parseFloat(e.target.value)})}
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN DE NOTIFICACIONES */}
        <div className="settings-section">
          <h2>Configuración de Notificaciones</h2>
          
          <div className="toggle-group">
            <label className="toggle-item">
              <span>Notificaciones por Email</span>
              <input
                type="checkbox"
                checked={settings.emailNotifications}
                onChange={(e) => setSettings({...settings, emailNotifications: e.target.checked})}
              />
              <span className="toggle-slider"></span>
            </label>
            
            <label className="toggle-item">
              <span>Notificaciones SMS</span>
              <input
                type="checkbox"
                checked={settings.smsNotifications}
                onChange={(e) => setSettings({...settings, smsNotifications: e.target.checked})}
              />
              <span className="toggle-slider"></span>
            </label>
            
            <label className="toggle-item">
              <span>Notificaciones Push</span>
              <input
                type="checkbox"
                checked={settings.pushNotifications}
                onChange={(e) => setSettings({...settings, pushNotifications: e.target.checked})}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        {/* SECCIÓN DE SEGURIDAD */}
        <div className="settings-section">
          <h2>Configuración de Seguridad</h2>
          
          <div className="form-row">
            <div className="form-group">
              <label>Tiempo de Expiración de Sesión (minutos)</label>
              <input
                type="number"
                min="5"
                max="480"
                value={settings.sessionTimeout}
                onChange={(e) => setSettings({...settings, sessionTimeout: parseInt(e.target.value)})}
              />
            </div>
            <div className="form-group">
              <label>Máximo de Intentos de Login</label>
              <input
                type="number"
                min="1"
                max="10"
                value={settings.maxLoginAttempts}
                onChange={(e) => setSettings({...settings, maxLoginAttempts: parseInt(e.target.value)})}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="toggle-item">
              <span>Requerir Verificación de Email</span>
              <input
                type="checkbox"
                checked={settings.requireEmailVerification}
                onChange={(e) => setSettings({...settings, requireEmailVerification: e.target.checked})}
              />
              <span className="toggle-slider"></span>
            </label>
          </div>
        </div>

        {/* SECCIÓN AVANZADA */}
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
            <small>Cuando está activo, solo los administradores pueden acceder al sitio</small>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Límite de API Requests (por minuto)</label>
              <input
                type="number"
                min="10"
                max="1000"
                value={settings.apiRateLimit}
                onChange={(e) => setSettings({...settings, apiRateLimit: parseInt(e.target.value)})}
              />
            </div>
            <div className="form-group">
              <label className="toggle-item">
                <span>Cache Habilitado</span>
                <input
                  type="checkbox"
                  checked={settings.cacheEnabled}
                  onChange={(e) => setSettings({...settings, cacheEnabled: e.target.checked})}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
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
          
          <button 
            className="btn-secondary"
            onClick={handleResetToDefaults}
          >
            Restablecer Valores por Defecto
          </button>

          {saveStatus === 'success' && (
            <span className="save-status success">✓ Configuración guardada</span>
          )}
          {saveStatus === 'error' && (
            <span className="save-status error">✗ Error guardando configuración</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;