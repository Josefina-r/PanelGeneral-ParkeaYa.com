/*import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock,
  faCheckCircle,
  faBan,
  faMapMarkerAlt,
  faParking,
  faDollarSign,
  faExclamationTriangle
} from "@fortawesome/free-solid-svg-icons";
import { BASE_URL } from '../../api/config';
import "./Parking.css";

function Parking() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [estacionamientos, setEstacionamientos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("solicitudes");

  const token = localStorage.getItem("access_token");

  useEffect(() => {
    fetchSolicitudes();
    fetchEstacionamientos();
  }, []);

  const fetchSolicitudes = async () => {
    try {
      setError(null);
      console.log("🔍 Fetching solicitudes from:", `${BASE_URL}/parking/approval-requests/pendientes/`);
      
      const response = await fetch(`${BASE_URL}/parking/approval-requests/pendientes/`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("📡 Response status:", response.status);
      
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("No autorizado. Por favor, inicia sesión.");
        }
        if (response.status === 403) {
          throw new Error("No tienes permisos para ver solicitudes.");
        }
        if (response.status === 404) {
          throw new Error("Endpoint no encontrado. Verifica la URL.");
        }
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("📦 Data received:", data);
      setSolicitudes(data);
    } catch (error) {
      console.error("❌ Error al cargar solicitudes:", error);
      setError(error.message);
      setSolicitudes([]);
    }
  };

  const fetchEstacionamientos = async () => {
    try {
      // ✅ URL CORREGIDA - usa solo /parking/
      console.log("🔍 Fetching estacionamientos from:", `${BASE_URL}/parking/`);
      
      const response = await fetch(`${BASE_URL}/parking/`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("📡 Response status:", response.status);

      if (!response.ok) {
        throw new Error(`Error ${response.status} al cargar estacionamientos`);
      }

      const data = await response.json();
      console.log("📦 Estacionamientos data:", data);
      
      // Filtrar solo los aprobados en el frontend
      const estacionamientosAprobados = data.results ? 
        data.results.filter(e => e.aprobado === true) : 
        data.filter(e => e.aprobado === true);
      
      setEstacionamientos(estacionamientosAprobados);
    } catch (error) {
      console.error("Error al obtener estacionamientos:", error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (solicitudId) => {
    if (!window.confirm("¿Aprobar este estacionamiento?")) return;

    try {
      const response = await fetch(`${BASE_URL}/parking/approval-requests/${solicitudId}/aprobar/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        alert("✅ Solicitud aprobada correctamente.");
        fetchSolicitudes();
        fetchEstacionamientos();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || "No se pudo aprobar."}`);
      }
    } catch (error) {
      console.error("Error al aprobar:", error);
      alert("Error al aprobar la solicitud.");
    }
  };

  const handleReject = async (solicitudId) => {
    const motivo = prompt("Ingrese motivo de rechazo:");
    if (!motivo) return;

    try {
      const response = await fetch(`${BASE_URL}/parking/approval-requests/${solicitudId}/rechazar/`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ motivo }),
      });

      if (response.ok) {
        alert("🚫 Solicitud rechazada.");
        fetchSolicitudes();
      } else {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || "No se pudo rechazar."}`);
      }
    } catch (error) {
      console.error("Error al rechazar:", error);
      alert("Error al rechazar la solicitud.");
    }
  };

  const handleBlock = async (id) => {
    try {
      // ✅ URL CORREGIDA
      const response = await fetch(`${BASE_URL}/parking/${id}/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ activo: false }),
      });

      if (response.ok) {
        alert("🚫 Estacionamiento bloqueado.");
        fetchEstacionamientos();
      } else {
        alert("Error al bloquear el estacionamiento.");
      }
    } catch (error) {
      console.error("Error al bloquear:", error);
      alert("Error al bloquear el estacionamiento.");
    }
  };

  const handleUnblock = async (id) => {
    try {
      // ✅ URL CORREGIDA
      const response = await fetch(`${BASE_URL}/parking/${id}/`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ activo: true }),
      });

      if (response.ok) {
        alert("✅ Estacionamiento desbloqueado.");
        fetchEstacionamientos();
      } else {
        alert("Error al desbloquear el estacionamiento.");
      }
    } catch (error) {
      console.error("Error al desbloquear:", error);
      alert("Error al desbloquear el estacionamiento.");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar este estacionamiento permanentemente?")) return;

    try {
      // ✅ URL CORREGIDA
      const response = await fetch(`${BASE_URL}/parking/${id}/`, {
        method: "DELETE",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        alert("🗑 Estacionamiento eliminado.");
        fetchEstacionamientos();
      } else {
        alert("Error al eliminar el estacionamiento.");
      }
    } catch (error) {
      console.error("Error al eliminar:", error);
      alert("Error al eliminar el estacionamiento.");
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <FontAwesomeIcon icon={faClock} spin /> Cargando datos...
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-message">
        <FontAwesomeIcon icon={faExclamationTriangle} /> 
        <h3>Error</h3>
        <p>{error}</p>
        <button onClick={() => {
          setError(null);
          setLoading(true);
          fetchSolicitudes();
          fetchEstacionamientos();
        }}>Reintentar</button>
      </div>
    );
  }

  return (
    <div className="parking-management">
      <h2><FontAwesomeIcon icon={faParking} /> Gestión de Estacionamientos</h2>
      
      <div className="tabs-navigation">
        <button 
          onClick={() => setActiveTab("solicitudes")} 
          className={activeTab === "solicitudes" ? "active" : ""}
        >
          <FontAwesomeIcon icon={faClock} /> Solicitudes Pendientes ({solicitudes.length})
        </button>
        <button 
          onClick={() => setActiveTab("estacionamientos")} 
          className={activeTab === "estacionamientos" ? "active" : ""}
        >
          <FontAwesomeIcon icon={faCheckCircle} /> Estacionamientos Aprobados ({estacionamientos.length})
        </button>
      </div>

      {activeTab === "solicitudes" ? (
        <div className="solicitudes-container">
          {solicitudes.length === 0 ? (
            <div className="empty-state">
              <FontAwesomeIcon icon={faCheckCircle} size="2x" />
              <p>No hay solicitudes pendientes</p>
            </div>
          ) : (
            solicitudes.map((solicitud) => (
              <div key={solicitud.id} className="solicitud-card">
                <div className="solicitud-header">
                  <h4>{solicitud.nombre || solicitud.nombre_estacionamiento}</h4>
                  <span className="badge pending">Pendiente</span>
                </div>
                <div className="solicitud-details">
                  <p><FontAwesomeIcon icon={faMapMarkerAlt} /> {solicitud.direccion}</p>
                  <p><FontAwesomeIcon icon={faDollarSign} /> ${solicitud.tarifa_hora}/hora</p>
                  {solicitud.descripcion && <p>{solicitud.descripcion}</p>}
                </div>
                <div className="solicitud-actions">
                  <button className="btn-approve" onClick={() => handleApprove(solicitud.id)}>
                    <FontAwesomeIcon icon={faCheckCircle} /> Aprobar
                  </button>
                  <button className="btn-reject" onClick={() => handleReject(solicitud.id)}>
                    <FontAwesomeIcon icon={faBan} /> Rechazar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="estacionamientos-container">
          {estacionamientos.length === 0 ? (
            <div className="empty-state">
              <FontAwesomeIcon icon={faParking} size="2x" />
              <p>No hay estacionamientos aprobados</p>
            </div>
          ) : (
            estacionamientos.map((estacionamiento) => (
              <div key={estacionamiento.id} className="estacionamiento-card">
                <div className="estacionamiento-header">
                  <h4>{estacionamiento.nombre}</h4>
                  <span className={`badge ${estacionamiento.activo ? 'active' : 'blocked'}`}>
                    {estacionamiento.activo ? 'Activo' : 'Bloqueado'}
                  </span>
                </div>
                <div className="estacionamiento-details">
                  <p><FontAwesomeIcon icon={faMapMarkerAlt} /> {estacionamiento.direccion}</p>
                  <p><FontAwesomeIcon icon={faDollarSign} /> ${estacionamiento.tarifa_hora}/hora</p>
                  <p>Plazas: {estacionamiento.plazas_disponibles || 0}/{estacionamiento.total_plazas || 0}</p>
                </div>
                <div className="estacionamiento-actions">
                  {estacionamiento.activo ? (
                    <button className="btn-warning" onClick={() => handleBlock(estacionamiento.id)}>
                      <FontAwesomeIcon icon={faBan} /> Bloquear
                    </button>
                  ) : (
                    <button className="btn-success" onClick={() => handleUnblock(estacionamiento.id)}>
                      <FontAwesomeIcon icon={faCheckCircle} /> Desbloquear
                    </button>
                  )}
                  <button className="btn-danger" onClick={() => handleDelete(estacionamiento.id)}>
                    <FontAwesomeIcon icon={faBan} /> Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default Parking; */