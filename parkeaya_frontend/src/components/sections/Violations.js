import React, { useState, useEffect } from 'react';
import './Violations.css';

function Violations() {
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all',
    search: ''
  });

  const API_BASE = 'http://localhost:8000/api';

  const getAuthHeaders = () => {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  useEffect(() => {
    loadViolations();
  }, [filters]);

  const loadViolations = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        status: filters.status !== 'all' ? filters.status : '',
        type: filters.type !== 'all' ? filters.type : '',
        search: filters.search
      });

      const response = await fetch(`${API_BASE}/violations-api/violations/?${params}`, {
        headers: getAuthHeaders()
      });

      if (!response.ok) {
        throw new Error(`Error ${response.status} al cargar infracciones`);
      }

      const data = await response.json();
      setViolations(data.results || []);
    } catch (error) {
      console.error('Error cargando infracciones:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (violationId, newStatus) => {
    try {
      const response = await fetch(`${API_BASE}/violations-api/violations/${violationId}/status/`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify({ status: newStatus })
      });

      if (!response.ok) {
        throw new Error('Error al actualizar el estado');
      }

      await loadViolations();
    } catch (error) {
      console.error('Error:', error);
      alert('Error al actualizar el estado de la infracción');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="violations-loading">
        <div className="loading-spinner"></div>
        <p>Cargando infracciones...</p>
      </div>
    );
  }

  return (
    <div className="violations-container">
      <div className="violations-header">
        <h2>Gestión de Infracciones</h2>
        <div className="filters">
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
          >
            <option value="all">Todos los estados</option>
            <option value="pending">Pendientes</option>
            <option value="in_review">En revisión</option>
            <option value="resolved">Resueltas</option>
            <option value="dismissed">Desestimadas</option>
          </select>
          <select
            value={filters.type}
            onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value }))}
          >
            <option value="all">Todos los tipos</option>
            <option value="parking_rules">Reglas de estacionamiento</option>
            <option value="payment">Pagos</option>
            <option value="behavior">Comportamiento</option>
            <option value="other">Otros</option>
          </select>
          <input
            type="text"
            placeholder="Buscar por ID o descripción..."
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
          />
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="violations-list">
        {violations.length === 0 ? (
          <div className="no-violations">
            <p>No se encontraron infracciones que coincidan con los filtros.</p>
          </div>
        ) : (
          violations.map(violation => (
            <div key={violation.id} className={`violation-card status-${violation.status}`}>
              <div className="violation-header">
                <h3>#{violation.id} - {violation.title}</h3>
                <span className={`status-badge ${violation.status}`}>
                  {violation.status}
                </span>
              </div>
              <div className="violation-details">
                <p><strong>Tipo:</strong> {violation.type}</p>
                <p><strong>Fecha:</strong> {formatDate(violation.created_at)}</p>
                <p><strong>Reportado por:</strong> {violation.reported_by}</p>
                <p><strong>Ubicación:</strong> {violation.location}</p>
                <p className="violation-description">{violation.description}</p>
              </div>
              <div className="violation-actions">
                {violation.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleStatusChange(violation.id, 'in_review')}
                      className="btn-review"
                    >
                      Revisar
                    </button>
                    <button
                      onClick={() => handleStatusChange(violation.id, 'dismissed')}
                      className="btn-dismiss"
                    >
                      Desestimar
                    </button>
                  </>
                )}
                {violation.status === 'in_review' && (
                  <>
                    <button
                      onClick={() => handleStatusChange(violation.id, 'resolved')}
                      className="btn-resolve"
                    >
                      Marcar como resuelto
                    </button>
                    <button
                      onClick={() => handleStatusChange(violation.id, 'dismissed')}
                      className="btn-dismiss"
                    >
                      Desestimar
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Violations;