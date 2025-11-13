import React, { useState, useEffect, useCallback } from 'react';
import './AdminUsers.css';

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    role: 'all',
    status: 'all',
    search: ''
  });
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [actionLoading, setActionLoading] = useState(null);

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
    const matchesRole = filters.role === 'all' || user.role === filters.role || user.user_type === filters.role;
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

  const getRoleBadge = (role) => {
    const roles = {
      admin: { label: 'Administrador', class: 'badge-admin' },
      owner: { label: 'Propietario', class: 'badge-owner' },
      client: { label: 'Cliente', class: 'badge-client' }
    };
    return roles[role] || { label: role, class: 'badge-default' };
  };

  const getStatusBadge = (user) => {
    if (!user.is_active) return { label: 'Inactivo', class: 'status-inactive' };
    if (user.role === 'owner' && user.document_status === 'pending') return { label: 'Pendiente', class: 'status-pending' };
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
        headers
      });

      console.log('📊 Response status usuarios:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Usuarios cargados:', data);

        // Si la API devuelve un array directamente
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

  // Cargar usuarios inicialmente y cuando cambian filtros
  useEffect(() => {
    loadUsers();
  }, [loadUsers, filters.role, filters.status]);

  const handleUserAction = async (userId, action) => {
    try {
      setActionLoading(userId);
      
      let endpoint = '';
      let method = 'POST';
      
      switch(action) {
        case 'approve':
          endpoint = `${API_BASE}/users/admin/users/${userId}/approve/`;
          break;
        case 'reject':
          endpoint = `${API_BASE}/users/admin/users/${userId}/reject/`;
          break;
        case 'activate':
          endpoint = `${API_BASE}/users/admin/users/${userId}/activate/`;
          break;
        case 'deactivate':
          endpoint = `${API_BASE}/users/admin/users/${userId}/deactivate/`;
          break;
        default:
          return;
      }
      
      const response = await fetch(endpoint, {
        method: method,
        headers: getAuthHeaders()
      });
      
      if (response.ok) {
        // Recargar la lista de usuarios
        await loadUsers();
        setSelectedUsers([]);
      } else {
        alert(`Error al ${action} usuario`);
      }
    } catch (error) {
      console.error(`Error en acción ${action}:`, error);
      alert('Error al procesar la acción');
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
      
      // Aquí iría la lógica para acciones masivas
      console.log(`Acción ${action} para usuarios:`, selectedUsers);
      
      // Simulamos éxito
      setTimeout(() => {
        alert(`${action} aplicado a ${selectedUsers.length} usuarios`);
        setSelectedUsers([]);
        setActionLoading(null);
      }, 1000);
    } catch (error) {
      console.error('Error en acción masiva:', error);
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="admin-users-loading">
        <div className="loading-spinner"></div>
        <p>Cargando gestión de usuarios...</p>
      </div>
    );
  }

  return (
    <div className="admin-users">
      {/*  HEADER */}
      <div className="admin-users-header">
        <div className="header-content">
          <h1>Gestión de Usuarios</h1>
          <p>Administra todos los usuarios de la plataforma</p>
        </div>
        <button onClick={loadUsers} className="refresh-btn">
          <i className="fas fa-sync"></i>
          Actualizar
        </button>
      </div>

      {/*  RESUMEN ESTADÍSTICAS */}
      <div className="users-stats">
        <div className="stat-card">
          <div className="stat-value">{users.length}</div>
          <div className="stat-label">Total Usuarios</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{users.filter(u => u.role === 'owner').length}</div>
          <div className="stat-label">Propietarios</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{users.filter(u => u.role === 'client').length}</div>
          <div className="stat-label">Clientes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">
            {users.filter(u => u.role === 'owner' && u.document_status === 'pending').length}
          </div>
          <div className="stat-label">Pendientes Aprobación</div>
        </div>
      </div>

      {/*  FILTROS Y ACCIONES */}
      <div className="users-controls">
        <div className="filters-section">
          <div className="filter-group">
            <label>Filtrar por Rol:</label>
            <select 
              value={filters.role} 
              onChange={(e) => setFilters(prev => ({ ...prev, role: e.target.value }))}
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

      {/*  TABLA DE USUARIOS */}
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
              const roleBadge = getRoleBadge(user.role);
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
                      {user.role === 'owner' && user.document_status === 'pending' && (
                        <>
                          <button 
                            className="btn-approve"
                            onClick={() => handleUserAction(user.id, 'approve')}
                            disabled={actionLoading === user.id}
                          >
                            {actionLoading === user.id ? '...' : 'Aprobar'}
                          </button>
                          <button 
                            className="btn-reject"
                            onClick={() => handleUserAction(user.id, 'reject')}
                            disabled={actionLoading === user.id}
                          >
                            {actionLoading === user.id ? '...' : 'Rechazar'}
                          </button>
                        </>
                      )}
                      
                      {/* Acciones de activación/desactivación */}
                      {user.is_active ? (
                        <button 
                          className="btn-deactivate"
                          onClick={() => handleUserAction(user.id, 'deactivate')}
                          disabled={actionLoading === user.id}
                        >
                          {actionLoading === user.id ? '...' : 'Desactivar'}
                        </button>
                      ) : (
                        <button 
                          className="btn-activate"
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

        {filteredUsers.length === 0 && (
          <div className="no-users">
            <i className="fas fa-users-slash"></i>
            <p>No se encontraron usuarios con los filtros aplicados</p>
          </div>
        )}
      </div>

      
    </div>
  );
};

export default AdminUsers;