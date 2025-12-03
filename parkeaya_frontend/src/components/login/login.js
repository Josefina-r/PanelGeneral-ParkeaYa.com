import React, { useState } from 'react';
import './login.css';

function Login() {
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Limpiar localStorage antes del login
    localStorage.clear();
    console.log('🔄 localStorage limpiado');

    try {
      console.log('🔐 Intentando login para panel admin...');
      console.log('URL:', 'http://127.0.0.1:8000/api/users/panel/login/');
      console.log('Credenciales:', { username: formData.username, password: '***' });

      const response = await fetch('http://127.0.0.1:8000/api/users/panel/login/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      console.log('📡 Response status:', response.status);

      const data = await response.json();
      console.log('📦 Response data COMPLETA:', data);

      if (response.ok) {
        
        const token = data.access;
        
        console.log('🔑 JWT Token encontrado:', token);
        console.log('👤 User data:', data.user);
        
        if (token) {
          // Determinar el rol del usuario
          const userRole = determineUserRole(data.user);
          
          // Guardar JWT token y información del usuario
          localStorage.setItem('access_token', token);
          localStorage.setItem('refresh_token', data.refresh || '');
          localStorage.setItem('user', JSON.stringify(data.user));
          localStorage.setItem('user_role', userRole);
          localStorage.setItem('user_id', data.user.id || data.user.user_id);
          localStorage.setItem('username', data.user.username);
          localStorage.setItem('email', data.user.email || '');
          localStorage.setItem('full_name', data.user.full_name || data.user.name || '');
          
          // VERIFICAR QUE SE GUARDÓ TODO
          console.log('💾 Verificando localStorage:');
          console.log('  access_token:', localStorage.getItem('access_token'));
          console.log('  user_role:', localStorage.getItem('user_role'));
          console.log('  user_id:', localStorage.getItem('user_id'));
          console.log('  username:', localStorage.getItem('username'));
          
          console.log(` Login exitoso! Rol: ${userRole}, redirigiendo...`);
          
          // Redirigir al dashboard
          window.location.href = '/dashboard';
        } else {
          const errorMsg = 'No se recibió token JWT en la respuesta';
          setError(errorMsg);
          console.error('❌', errorMsg);
        }
      } else {
  
        let errorMsg = 'Error en la autenticación';
        
        if (response.status === 401) {
          errorMsg = 'Credenciales incorrectas';
        } else if (response.status === 403) {
          errorMsg = 'No tienes permisos para acceder al panel administrativo';
        } else if (data.detail) {
          errorMsg = data.detail;
        } else if (data.error) {
          errorMsg = data.error;
        } else if (data.message) {
          errorMsg = data.message;
        }
        
        setError(errorMsg);
        console.error(' Error en login:', errorMsg);
      }
    } catch (error) {
      console.error('💥 Error de conexión:', error);
      setError('Error de conexión con el servidor. Verifica que el servidor esté ejecutándose.');
    } finally {
      setLoading(false);
    }
  };

  //  FUNCIÓN MEJORADA: Determinar rol específico (admin u owner)
  const determineUserRole = (userData) => {
    console.log('🔍 Analizando datos de usuario para determinar rol:', userData);
    
    // Verificar si el usuario es superadmin/staff (admin del sistema)
    if (userData.is_admin || userData.is_admin_general || userData.is_superuser || userData.is_staff) {
      console.log('🎯 Rol detectado: ADMIN');
      return 'admin';
    }

    // Verificar si es propietario de estacionamiento (owner)
    if (userData.is_owner || userData.rol === 'owner' || userData.role === 'owner' || userData.user_type === 'owner') {
      console.log('🎯 Rol detectado: OWNER (propietario)');
      return 'owner';
    }
    
    // Verificar si tiene relación con parking lots (es owner)
    if (userData.parking_lots && userData.parking_lots.length > 0) {
      console.log('🎯 Rol detectado: OWNER (tiene parking lots)');
      return 'owner';
    }
    
    // Si no cumple con los roles permitidos para el panel
    console.log(' Usuario no tiene rol válido para panel administrativo');
    return 'none';
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="brand-header">
          <h1 className="brand-name">Parkea Ya</h1>
          <p className="brand-tagline">Sistema de Gestión de Estacionamientos</p>
        </div>
        
        <div className="login-form">
          <h2>Panel Administrativo</h2>
          <p className="welcome-text">Acceso para Administradores y Propietarios</p>
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="username">Usuario</label>
              <input
                type="text"
                id="username"
                name="username"
                value={formData.username}
                onChange={handleChange}
                required
                placeholder="Ingresa tu usuario"
                disabled={loading}
                autoComplete="username"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder="Ingresa tu contraseña"
                disabled={loading}
                autoComplete="current-password"
              />
            </div>
            
            {error && (
              <div className="error-message">
                <strong>Error de autenticación:</strong> {error}
              </div>
            )}
            
            <button 
              type="submit" 
              className={`login-btn ${loading ? 'loading' : ''}`}
              disabled={loading}
            >
              {loading ? (
                <>
                  <span className="spinner"></span>
                  Verificando acceso...
                </>
              ) : (
                'Acceder al Panel'
              )}
            </button>

            {/* Información sobre roles permitidos */}
            <div className="roles-info">
              <div className="roles-header">Roles con acceso al panel:</div>
              <div className="roles-list">
                <div className="role-item">
                  <span className="role-badge admin">ADMIN</span>
                  <span className="role-desc">Administrador del sistema</span>
                </div>
                <div className="role-item">
                  <span className="role-badge owner">OWNER</span>
                  <span className="role-desc">Propietario de estacionamiento</span>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Login;