import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import './Dashboard.css';

/* Disable exhaustive-deps warnings in this file for now -
  loadDashboardData and related helpers rely on several helpers
  and state; we intentionally keep the initial effect deps minimal.
  If you want stricter hook checks later, we can refactor into
  useCallback/useMemo for the helper functions. */
/* eslint-disable react-hooks/exhaustive-deps */

//  IMPORTACIONES POR ROL - ADMIN
import AdminHome from '../../sections/admin/AdminHome';
import AdminUsers from '../../sections/admin/AdminUsers';
import AdminParking from '../../sections/admin/AdminParking';
import AdminReports from '../../sections/admin/AdminReports';
import AdminFinance from '../../sections/admin/AdminFinance';
/*import AdminSystem from '../../sections/admin/AdminSystem';*/
import AccessDenied from '../AccessDenied';  

//  IMPORTACIONES POR ROL - OWNER
import OwnerHome from '../../sections/owner/OwnerHome';
import OwnerParking from '../../sections/owner/OwnerParking';
import OwnerReservations from '../../sections/owner/OwnerReservations';
import OwnerReports from '../../sections/owner/OwnerReports';
import OwnerProfile from '../../sections/owner/OwnerProfile';

function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [globalStats, setGlobalStats] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  const API_BASE = 'http://localhost:8000/api';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // OBTENER ENDPOINT SEGÚN ROL
  const getDashboardEndpoint = () => {
    const role = localStorage.getItem('user_role');
    console.log(`🎯 Cargando dashboard para: ${role}`);
    
    switch(role) {
      case 'admin':
        return '/users/admin/dashboard/stats/';
      case 'owner':
        return '/users/owner/dashboard/stats/';
      default:
        return '/users/client/dashboard/stats/';
    }
  };

  // PERMISOS ESPECÍFICOS POR ROL
  const getRolePermissions = () => {
    return {
      admin: {
        home: true,
        users: true,           // Gestión de usuarios
        parking: true,         // Gestión global estacionamientos
        reports: true,         // Reportes y analytics
        finance: true,         // Gestión financiera
        system: true,          // Configuración del sistema
        reservations: false,   // Owner-specific
        ownerProfile: false    // Owner-specific
      },
      owner: {
        home: true,
        users: false,          // Solo admin
        parking: true,         // Gestión de MI estacionamiento
        reports: true,         // Reportes locales
        finance: false,        // Solo admin
        system: false,         // Solo admin
        reservations: true,    // Gestión de reservas
        ownerProfile: true     // Perfil de negocio
      }
    };
  };

  const canAccessSection = (section) => {
    const role = localStorage.getItem('user_role');
    const permissions = getRolePermissions();
    return permissions[role]?.[section] || false;
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    console.log('=== 🚀 INICIANDO DASHBOARD CON ROLES ESPECÍFICOS ===');
    
    const userData = localStorage.getItem('user');
    const token = localStorage.getItem('access_token');
    const role = localStorage.getItem('user_role');
    
    console.log('📊 Estado inicial:', {
      usuario: userData ? '✅' : '❌',
      token: token ? '✅' : '❌', 
      rol: role || '❌ No definido'
    });

    if (userData && token && role) {
      const parsedUser = JSON.parse(userData);
      setUser(parsedUser);
      setUserRole(role);
      console.log(`👤 Usuario: ${parsedUser.username}, Rol: ${role}`);
      loadDashboardData();
    } else {
      console.log('❌ Faltan credenciales, redirigiendo a login...');
      navigate('/login');
    }
  }, [navigate]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const dashboardEndpoint = getDashboardEndpoint();
      console.log(`📊 Endpoint del dashboard: ${dashboardEndpoint}`);
      
      const response = await fetch(`${API_BASE}${dashboardEndpoint}`, {
        method: 'GET',
        headers: getAuthHeaders()
      });

      console.log('📡 Status respuesta dashboard:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Datos del dashboard recibidos:', data);
        setDashboardData(data);
        processStatsByRole(data);
        
      } else if (response.status === 401) {
        handleAuthError();
      } else if (response.status === 403) {
        handleAccessDenied();
      } else {
        await loadFallbackData();
      }
    } catch (error) {
      console.error('💥 Error crítico:', error);
      await loadFallbackData();
    } finally {
      setLoading(false);
    }
  };

  //  PROCESAR ESTADÍSTICAS ESPECÍFICAS POR ROL
  const processStatsByRole = (data) => {
    const role = localStorage.getItem('user_role');
    
    if (role === 'admin') {
      //  ESTADÍSTICAS PARA ADMINISTRADOR
      setGlobalStats({
        // Gestión de Usuarios
        totalUsers: data.total_users || 0,
        totalOwners: data.total_owners || 0,
        pendingApprovals: data.pending_approvals || 0,
        
        // Gestión Global de Estacionamientos
        totalParkings: data.total_parkings || 0,
        activeParkings: data.active_parkings || 0,
        pendingParkings: data.pending_parkings || 0,
        
        // Reportes y Analytics
        totalRevenue: data.total_revenue || 0,
        todayRevenue: data.today_revenue || 0,
        platformEarnings: data.platform_earnings || 0,
        
        // Reservas activas
        activeReservations: data.active_reservations || 0,
        completedToday: data.completed_today || 0,
        
        // Incidencias
        activeViolations: data.active_violations || 0,
        pendingComplaints: data.pending_complaints || 0
      });
    } else if (role === 'owner') {
      //  ESTADÍSTICAS PARA PROPIETARIO
      setGlobalStats({
        // Mi Estacionamiento
        totalSpots: data.total_spots || 0,
        availableSpots: data.available_spots || 0,
        occupancyRate: data.occupancy_rate || 0,
        
        // Control de Capacidad
        reservedSpots: data.reserved_spots || 0,
        occupiedSpots: data.occupied_spots || 0,
        
        // Gestión de Reservas
        activeReservations: data.active_reservations || 0,
        todayReservations: data.today_reservations || 0,
        pendingReservations: data.pending_reservations || 0,
        
        // Reportes Locales
        todayRevenue: data.today_revenue || 0,
        monthlyRevenue: data.monthly_revenue || 0,
        weeklyEarnings: data.weekly_earnings || 0,
        
        // Métricas de Negocio
        rating: data.average_rating || 0,
        totalReviews: data.total_reviews || 0
      });
    }
  };

  const loadFallbackData = async () => {
    try {
      const role = localStorage.getItem('user_role');
      let fallbackEndpoint = '/users/client/dashboard/stats/';
      
      if (role === 'admin') {
        fallbackEndpoint = '/users/admin/dashboard/stats/';
      } else if (role === 'owner') {
        fallbackEndpoint = '/users/owner/dashboard/stats/';
      }

      const response = await fetch(`${API_BASE}${fallbackEndpoint}`, {
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        const data = await response.json();
        setDashboardData(data);
        processStatsByRole(data);
      }
    } catch (error) {
      console.error('💥 Error cargando datos de respaldo:', error);
    }
  };

  const handleAuthError = () => {
    localStorage.clear();
    navigate('/login');
  };

  const handleAccessDenied = () => {
    navigate('/dashboard/home');
  };

  const handleLogout = () => {
    localStorage.clear();
    window.location.href = '/login';
  };

  //  COMPONENTE DE CARGA MEJORADO
  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="loading-spinner"></div>
        <div className="loading-text">
          <h3>Inicializando Panel {userRole === 'admin' ? 'Administrativo' : 'de Propietario'}</h3>
          <p>Cargando datos específicos para {user?.username}...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="dashboard-error">
        <div className="error-content">
          <h2>Error de Autenticación</h2>
          <p>No se pudo cargar la información del usuario</p>
          <button onClick={() => navigate('/login')} className="retry-btn">
            Volver al Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <Sidebar 
        isOpen={sidebarOpen} 
        currentPath={location.pathname}
        onNavigate={navigate}
        stats={globalStats}
        userRole={userRole}
        userData={user}
        canAccessSection={canAccessSection}
      />
      
      <div className={`dashboard-main ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
        <Header 
          user={user}
          userRole={userRole}
          dashboardData={dashboardData}
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)}
          onLogout={handleLogout}
          stats={globalStats}
        />
        
        {/*  CONTENEDOR CON SCROLL AGREGADO */}
        <div className="dashboard-content-scroll">
          <div className="dashboard-content">
            <Routes>
              {/*  RUTAS PARA ADMINISTRADOR */}
              {userRole === 'admin' && (
                <>
                  <Route path="/" element={<AdminHome stats={globalStats} user={user} />} />
                  <Route path="/home" element={<AdminHome stats={globalStats} user={user} />} />
                  <Route path="/users" element={<AdminUsers />} />
                  <Route path="/parking" element={<AdminParking />} />
                  <Route path="/reports" element={<AdminReports />} />
                  <Route path="/finance" element={<AdminFinance />} />
                </>
              )}

              {/*  RUTAS PARA PROPIETARIO */}
              {userRole === 'owner' && (
                <>
                  <Route path="/" element={<OwnerHome stats={globalStats} user={user} />} />
                  <Route path="/home" element={<OwnerHome stats={globalStats} user={user} />} />
                  <Route path="/parking" element={<OwnerParking />} />
                  <Route path="/reservations" element={<OwnerReservations />} />
                  <Route path="/reports" element={<OwnerReports />} />
                  <Route path="/profile" element={<OwnerProfile />} />
                </>
              )}

              {/* RUTA DE FALLBACK PARA ROLES NO RECONOCIDOS */}
              <Route path="*" element={
                <div className="access-denied">
                  <h2>Configuración de Rol Incorrecta</h2>
                  <p>Tu rol ({userRole}) no está configurado correctamente.</p>
                  <button onClick={handleLogout} className="logout-btn">
                    Cerrar Sesión
                  </button>
                </div>
              } />
            </Routes>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Dashboard;