import React, { useState, useEffect, useCallback } from 'react';
import './AdminUsers.css';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    rol: 'all',
    status: 'all',
    search: ''
  });
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [solicitudMap, setSolicitudMap] = useState({}); // cache: userId -> solicitudId
  const [actionLoading, setActionLoading] = useState(null);
  const [showParkingModal, setShowParkingModal] = useState(false);
  const [parkingList, setParkingList] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ username: '', email: '', password: '', rol: 'client' });
  const [activeTab, setActiveTab] = useState('usuarios'); // Nueva pestaña
  const [solicitudes, setSolicitudes] = useState([]); // Solicitudes de acceso
  const [solicitudesLoading, setSolicitudesLoading] = useState(false);

  const API_BASE = 'http://localhost:8000/api';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // Selección de usuarios
  const toggleUserSelection = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(filteredUsers.map(user => user.id));
    }
  };

  // Filtrar usuarios según los filtros aplicados
  const filteredUsers = users.filter(user => {
    const matchesRole = filters.rol === 'all' || user.rol === filters.rol || user.user_type === filters.rol || user.role === filters.rol;
    const matchesStatus = filters.status === 'all' || 
      (filters.status === 'active' && user.is_active) ||
      (filters.status === 'inactive' && !user.is_active) ||
      (filters.status === 'pending' && user.document_status === 'pending');
    const matchesSearch = filters.search === '' || 
      user.username.toLowerCase().includes(filters.search.toLowerCase()) ||
      user.email.toLowerCase().includes(filters.search.toLowerCase()) ||
      `${user.first_name} ${user.last_name}`.toLowerCase().includes(filters.search.toLowerCase());
    return matchesRole && matchesStatus && matchesSearch;
  });

  const getRoleBadge = (rol) => {
    const roles = {
      admin: { label: 'Administrador', class: 'badge-admin' },
      owner: { label: 'Propietario', class: 'badge-owner' },
      client: { label: 'Cliente', class: 'badge-client' }
    };
    return roles[rol] || { label: rol, class: 'badge-default' };
  };

  const getStatusBadge = (user) => {
    if (!user.is_active) return { label: 'Inactivo', class: 'status-inactive' };
    if (user.rol === 'owner' && user.document_status === 'pending') return { label: 'Pendiente', class: 'status-pending' };
    if (user.is_verified) return { label: 'Verificado', class: 'status-active' };
    return { label: 'Activo', class: 'status-active' };
  };

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('🔄 Cargando usuarios desde API...');

      const token = localStorage.getItem('access_token');
      const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      };

      // Endpoint para obtener todos los usuarios (admin)
      const response = await fetch(`${API_BASE}/users/admin/users/`, {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      console.log('📊 Response status usuarios:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Usuarios cargados:', data);

        
        if (Array.isArray(data)) {
          setUsers(data);
        }
        // Si devuelve un objeto con results (DRF)
        else if (data.results) {
          setUsers(data.results);
        }
        // Si tiene otra estructura
        else {
          setUsers(data.users || data.data || []);
        }
      } else {
        setError(`Error ${response.status} al cargar usuarios`);
        // Eliminados los datos mock
        setUsers([]);
      }
    } catch (error) {
      console.error('💥 Error cargando usuarios:', error);
      setError('Error de conexión con el servidor');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [API_BASE]);

  const fetchUserParkings = async (userId) => {
    try {
      setParkingList([]);
      setShowParkingModal(true);
      const res = await fetch(`${API_BASE}/parking/parkings/?dueno=${userId}`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        // try results or array
        const parks = data.results || data || [];
        setParkingList(parks);
      } else {
        setParkingList([]);
      }
    } catch (err) {
      console.error('Error fetching parkings for user', err);
      setParkingList([]);
    }
  };

  // Cargar solicitudes de acceso
  const loadSolicitudes = useCallback(async () => {
    try {
      setSolicitudesLoading(true);
      const res = await fetch(`${API_BASE}/users/solicitudes/owner/`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (res.ok) {
        const data = await res.json();
        const items = Array.isArray(data) ? data : (data.results || []);
        // Filtrar solo solicitudes pendientes
        const pendientes = items.filter(s => s.estado === 'pendiente');
        setSolicitudes(pendientes);
      }
    } catch (err) {
      console.error('Error cargando solicitudes:', err);
      setSolicitudes([]);
    } finally {
      setSolicitudesLoading(false);
    }
  }, [API_BASE]);

  // Aprobar solicitud
  const aprobarSolicitud = async (solicitudId, solicitud) => {
    try {
      setActionLoading(solicitudId);
      const res = await fetch(`${API_BASE}/users/solicitudes/owner/${solicitudId}/revisar/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ estado: 'aprobado' })
      });
      if (res.ok) {
        alert(' Solicitud aprobada');
        // Recargar solicitudes
        loadSolicitudes();
      } else {
        alert(' Error al aprobar solicitud');
      }
    } catch (err) {
      console.error('Error aprobando solicitud:', err);
      alert('Error al aprobar solicitud');
    } finally {
      setActionLoading(null);
    }
  };

  // Rechazar solicitud
  const rechazarSolicitud = async (solicitudId, comentarios) => {
    try {
      setActionLoading(solicitudId);
      const res = await fetch(`${API_BASE}/users/solicitudes/owner/${solicitudId}/revisar/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ 
          estado: 'rechazado',
          comentarios_rechazo: comentarios
        })
      });
      if (res.ok) {
        alert('❌ Solicitud rechazada');
        loadSolicitudes();
      } else {
        alert('Error al rechazar solicitud');
      }
    } catch (err) {
      console.error('Error rechazando solicitud:', err);
      alert('Error al rechazar solicitud');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCreateUser = async () => {
    try {
      setActionLoading('create');
      const res = await fetch(`${API_BASE}/users/admin/users/`, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(createForm)
      });
      if (res.ok) {
        alert('Usuario creado');
        setShowCreateModal(false);
        setCreateForm({ username: '', email: '', password: '', rol: 'client' });
        await loadUsers();
      } else {
        let err = '';
        try { err = JSON.stringify(await res.json()); } catch(e) { err = await res.text(); }
        alert('Error creando usuario: ' + err);
      }
    } catch (err) {
      console.error('Error creando usuario', err);
      alert('Error creando usuario');
    } finally {
      setActionLoading(null);
    }
  };

  // Cargar usuarios inicialmente y cuando cambian filtros
  useEffect(() => {
    loadUsers();
  }, [loadUsers, filters.rol, filters.status]);

  const handleUserAction = async (userId, action) => {
    try {
      setActionLoading(userId);
      // Primero recuperar el objeto usuario para este id
      const user = users.find(u => u.id === userId);

      // Si es una solicitud pendiente de owner, usar el endpoint de solicitudes
      if (user && user.rol === 'owner' && user.document_status === 'pending' && (action === 'approve' || action === 'reject')) {
        // Obtener solicitudId (cache o fetch)
        const solicitudId = await getSolicitudIdForUser(user);
        if (!solicitudId) {
          alert('No se encontró la solicitud asociada al usuario');
          setActionLoading(null);
          return;
        }

        if (action === 'approve') {
          await revisarSolicitud(solicitudId, 'aprobada');
        } else {
          // pedir motivo de rechazo
          const motivo = prompt('Ingrese motivo de rechazo (opcional):', 'Documentación incompleta');
          await revisarSolicitud(solicitudId, 'rechazada', motivo || '');
        }

        await loadUsers();
        setSelectedUsers([]);
        setActionLoading(null);
        return;
      }

      // Mapear acciones a PATCH sobre el recurso de usuario (AdminUserViewSet soporta PATCH/PUT)
      const endpoint = `${API_BASE}/users/admin/users/${userId}/`;
      let body = {};

      switch(action) {
        case 'activate':
          body = { is_active: true, activo: true };
          break;
        case 'deactivate':
          body = { is_active: false, activo: false };
          break;
        default:
          setActionLoading(null);
          return;
      }

      const response = await fetch(endpoint, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(body)
      });

      if (response.ok) {
        await loadUsers();
        setSelectedUsers([]);
      } else {
        let errText = '';
        try { errText = JSON.stringify(await response.json()); } catch(e) { errText = await response.text(); }
        alert(`Error al ${action} usuario: ${response.status} ${errText}`);
      }
    } catch (error) {
      console.error(`Error en acción ${action}:`, error);
      alert('Error al procesar la acción');
    } finally {
      setActionLoading(null);
    }
  };

  // Busca y cachea la solicitud asociada a un usuario (por email)
  const getSolicitudIdForUser = async (user) => {
    // usar cache
    if (solicitudMap[user.id]) return solicitudMap[user.id];

    try {
      // El backend lista solicitudes por estado; pedimos las pendientes y filtramos por email
      const res = await fetch(`${API_BASE}/users/solicitudes/owner/?estado=pendiente`, {
        method: 'GET',
        headers: getAuthHeaders(),
        credentials: 'include'
      });
      if (!res.ok) return null;
      const data = await res.json();
      const items = Array.isArray(data) ? data : (data.results || data);
      if (!items || items.length === 0) return null;
      const solicitud = items.find(s => (s.email || '').toLowerCase() === (user.email || '').toLowerCase());
      if (!solicitud) return null;
      const id = solicitud.id || solicitud.solicitud_id || solicitud.pk;
      if (id) {
        setSolicitudMap(prev => ({ ...prev, [user.id]: id }));
        return id;
      }
      return null;
    } catch (err) {
      console.error('Error obteniendo solicitud para usuario', err);
      return null;
    }
  };

  // Llama al endpoint de revisar solicitud (PUT/PATCH)
  const revisarSolicitud = async (solicitudId, estado, comentarios = '') => {
    try {
      setActionLoading(solicitudId);
      const endpoint = `${API_BASE}/users/solicitudes/owner/${solicitudId}/revisar/`;
      const body = { estado };
      if (comentarios) body.comentarios_rechazo = comentarios;

      // Backend espera POST para revisar (según implementation en views.py)
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        let errText = '';
        try { errText = JSON.stringify(await res.json()); } catch(e) { errText = await res.text(); }
        alert(`Error al actualizar solicitud: ${res.status} ${errText}`);
      } else {
        alert(`Solicitud ${estado}`);
      }
    } catch (err) {
      console.error('Error revisando solicitud', err);
      alert('Error revisando la solicitud');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkAction = async (action) => {
    if (selectedUsers.length === 0) {
      alert('Selecciona al menos un usuario');
      return;
    }
    
    try {
      setActionLoading('bulk');
      
      
      console.log(`Acción ${action} para usuarios:`, selectedUsers);

      // Ejecutar PATCH por cada usuario (no hay endpoint bulk en backend actualmente)
      for (const uid of selectedUsers) {
        await handleUserAction(uid, action);
      }
      alert(`${action} aplicado a ${selectedUsers.length} usuarios`);
      setSelectedUsers([]);
      setActionLoading(null);
    } catch (error) {
      console.error('Error en acción masiva:', error);
      setActionLoading(null);
    }
  };

  return (
    <div className="admin-users">
      {/*  HEADER */}
      <div className="admin-users-header">
        <div className="header-content">
          <h1>Gestión de Usuarios</h1>
          <p>Administra todos los usuarios de la plataforma</p>
        </div>
        <div className="header-actions">
          <button onClick={() => setShowCreateModal(true)} className="btn-create">
            <i className="fas fa-user-plus"></i>
            Crear un usuario
          </button>
          <button onClick={loadUsers} className="refresh-btn">
          <i className="fas fa-sync"></i>
          Actualizar
          </button>
        </div>
      </div>

      {/* PESTAÑAS */}
      <div className="admin-tabs">
        <button 
          className={`tab-button ${activeTab === 'usuarios' ? 'active' : ''}`}
          onClick={() => setActiveTab('usuarios')}
        >
          <i className="fas fa-users"></i> Usuarios
        </button>
        <button 
          className={`tab-button ${activeTab === 'solicitudes' ? 'active' : ''}`}
          onClick={() => { setActiveTab('solicitudes'); loadSolicitudes(); }}
        >
          <i className="fas fa-file-alt"></i> Solicitudes de Acceso
          {solicitudes.length > 0 && <span className="badge">{solicitudes.length}</span>}
        </button>
      </div>

      {/*  RESUMEN ESTADÍSTICAS - Solo usuarios */}
      {activeTab === 'usuarios' && (
      <div>
        <div className="users-stats">
          <div className="stat-card">
            <div className="stat-value">{users.length}</div>
            <div className="stat-label">Total Usuarios</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{users.filter(u => u.rol === 'owner').length}</div>
            <div className="stat-label">Propietarios</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{users.filter(u => u.rol  === 'client').length}</div>
            <div className="stat-label">Clientes</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {users.filter(u => (u.rol === 'owner' || u.role === 'owner') && u.document_status === 'pending').length}
            </div>
            <div className="stat-label">Pendientes Aprobación</div>
          </div>
        </div>

        {/*  FILTROS Y ACCIONES - Solo usuarios */}
        <div className="users-controls">
        <div className="filters-section">
          <div className="filter-group">
            <label>Filtrar por Rol:</label>
            <select 
              value={filters.rol} 
              onChange={(e) => setFilters(prev => ({ ...prev, rol: e.target.value }))}
            >
              <option value="all">Todos los roles</option>
              <option value="admin">Administradores</option>
              <option value="owner">Propietarios</option>
              <option value="client">Clientes</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Filtrar por Estado:</label>
            <select 
              value={filters.status} 
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
              <option value="pending">Pendientes</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Buscar:</label>
            <input 
              type="text" 
              placeholder="Nombre, email o usuario..."
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>
        </div>

        {/*  ACCIONES MASIVAS */}
        {selectedUsers.length > 0 && (
          <div className="bulk-actions">
            <span>{selectedUsers.length} usuarios seleccionados</span>
            <div className="bulk-buttons">
              <button 
                className="btn-activate"
                onClick={() => handleBulkAction('activate')}
                disabled={actionLoading === 'bulk'}
              >
                {actionLoading === 'bulk' ? 'Procesando...' : 'Activar Seleccionados'}
              </button>
              <button 
                className="btn-deactivate"
                onClick={() => handleBulkAction('deactivate')}
                disabled={actionLoading === 'bulk'}
              >
                {actionLoading === 'bulk' ? 'Procesando...' : 'Desactivar Seleccionados'}
              </button>
            </div>
          </div>
        )}
        </div>

        <div className="users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>
                <input 
                  type="checkbox" 
                  checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Fecha Registro</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map(user => {
              const roleBadge = getRoleBadge(user.rol);
              const statusBadge = getStatusBadge(user);
              
              return (
                <tr key={user.id} className={!user.is_active ? 'user-inactive' : ''}>
                  <td>
                    <input 
                      type="checkbox" 
                      checked={selectedUsers.includes(user.id)}
                      onChange={() => toggleUserSelection(user.id)}
                    />
                  </td>
                  <td>
                    <div className="user-username">
                      <strong>{user.username}</strong>
                      {user.phone_number && (
                        <small>{user.phone_number}</small>
                      )}
                    </div>
                  </td>
                  <td>
                    {user.first_name} {user.last_name}
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`role-badge ${roleBadge.class}`}>
                      {roleBadge.label}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${statusBadge.class}`}>
                      {statusBadge.label}
                    </span>
                  </td>
                  <td>
                    {new Date(user.date_joined).toLocaleDateString()}
                  </td>
                  <td>
                    <div className="user-actions">
                      {/* Acciones para owners pendientes */}
                      {user.rol === 'owner' && user.document_status === 'pending' && (
                        <>
                          <button 
                            className="action-btn btn-approve"
                            onClick={() => handleUserAction(user.id, 'approve')}
                            disabled={actionLoading === user.id}
                          >
                            {actionLoading === user.id ? '...' : 'Aprobar'}
                          </button>
                          <button 
                            className="action-btn btn-reject"
                            onClick={() => handleUserAction(user.id, 'reject')}
                            disabled={actionLoading === user.id}
                          >
                            {actionLoading === user.id ? '...' : 'Rechazar'}
                          </button>
                          <button
                            className="action-btn btn-view-parks"
                            onClick={() => fetchUserParkings(user.id)}
                          >Ver Parkings
                          </button>
                        </>
                      )}
                      
                      {/* Acciones de activación/desactivación */}
                      {user.is_active ? (
                        <button 
                          className="action-btn btn-deactivate"
                          onClick={() => handleUserAction(user.id, 'deactivate')}
                          disabled={actionLoading === user.id}
                        >
                          {actionLoading === user.id ? '...' : 'Desactivar'}
                        </button>
                      ) : (
                        <button 
                            className="action-btn btn-activate"
                          onClick={() => handleUserAction(user.id, 'activate')}
                          disabled={actionLoading === user.id}
                        >
                          {actionLoading === user.id ? '...' : 'Activar'}
                        </button>
                      )}
                      
                      <button className="btn-view">
                        <i className="fas fa-eye"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>

        {/* Modal: Parkings del usuario */}
        {showParkingModal && (
          <div className="modal-overlay" onClick={() => setShowParkingModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Parkings del Usuario</h3>
              <button className="modal-close" onClick={() => setShowParkingModal(false)}>Cerrar</button>
              <div className="modal-content">
                {parkingList.length === 0 ? (
                  <p>No se encontraron parkings para este usuario.</p>
                ) : (
                  <ul className="parking-list">
                    {parkingList.map(p => (
                      <li key={p.id} className="parking-item">
                        <strong>{p.nombre}</strong>
                        <div>{p.direccion}</div>
                        <div>Tarifa: S/ {p.tarifa_hora}</div>
                        <div>Plazas: {p.plazas_disponibles}/{p.total_plazas}</div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal: Crear usuario */}
        {showCreateModal && (
          <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3>Crear Usuario</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>Cerrar</button>
              <div className="modal-content create-user-form">
                <label>Username</label>
                <input value={createForm.username} onChange={(e) => setCreateForm(prev => ({...prev, username: e.target.value}))} />
                <label>Email</label>
                <input value={createForm.email} onChange={(e) => setCreateForm(prev => ({...prev, email: e.target.value}))} />
                <label>Password</label>
                <input type="password" value={createForm.password} onChange={(e) => setCreateForm(prev => ({...prev, password: e.target.value}))} />
                <label>Rol</label>
                <select value={createForm.rol} onChange={(e) => setCreateForm(prev => ({...prev, rol: e.target.value}))}>
                  <option value="client">Cliente</option>
                  <option value="owner">Propietario</option>
                  <option value="admin">Administrador</option>
                </select>
                <div className="create-actions">
                  <button className="btn-primary" onClick={handleCreateUser} disabled={actionLoading === 'create'}>{actionLoading === 'create' ? 'Creando...' : 'Crear'}</button>
                  <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>Cancelar</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {filteredUsers.length === 0 && (
          <div className="no-users">
            <i className="fas fa-users-slash"></i>
            <p>No se encontraron usuarios con los filtros aplicados</p>
          </div>
        )}
      </div>
      )}

      {/* SECCIÓN DE SOLICITUDES DE ACCESO */}
      {activeTab === 'solicitudes' && (
        <div className="solicitudes-section">
        <div className="solicitudes-header">
          <h2>Solicitudes de Acceso Pendientes</h2>
          <button onClick={loadSolicitudes} className="refresh-btn">
            <i className="fas fa-sync"></i> Actualizar
          </button>
        </div>

        {solicitudesLoading ? (
          <div className="loading">Cargando solicitudes...</div>
        ) : solicitudes.length === 0 ? (
          <div className="no-solicitudes">
            <i className="fas fa-inbox"></i>
            <p>No hay solicitudes de acceso pendientes</p>
          </div>
        ) : (
          <div className="solicitudes-table-container">
            <table className="solicitudes-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>Empresa</th>
                  <th>Ciudad</th>
                  <th>Mensaje</th>
                  <th>Fecha Solicitud</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {solicitudes.map(sol => (
                  <tr key={sol.id}>
                    <td><strong>{sol.nombre}</strong></td>
                    <td>{sol.email}</td>
                    <td>{sol.telefono}</td>
                    <td>{sol.empresa}</td>
                    <td>{sol.ciudad || '-'}</td>
                    <td className="mensaje-cell">
                      <div className="mensaje-preview">{sol.mensaje}</div>
                    </td>
                    <td>{new Date(sol.fecha_solicitud).toLocaleDateString()}</td>
                    <td>
                      <div className="action-buttons">
                        <button 
                          className="btn-approve"
                          onClick={() => aprobarSolicitud(sol.id, sol)}
                          disabled={actionLoading === sol.id}
                        >
                          {actionLoading === sol.id ? '...' : '✓ Aprobar'}
                        </button>
                        <button 
                          className="btn-reject"
                          onClick={() => rechazarSolicitud(sol.id, 'Solicitud rechazada')}
                          disabled={actionLoading === sol.id}
                        >
                          {actionLoading === sol.id ? '...' : '✗ Rechazar'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  );
};

export default AdminUsers;