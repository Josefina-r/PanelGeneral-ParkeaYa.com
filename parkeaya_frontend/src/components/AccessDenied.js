import React from 'react';
import { useNavigate } from 'react-router-dom';
import './AccessDenied.css';

const AccessDenied = () => {
  const navigate = useNavigate();

  return (
    <div className="access-denied">
      <h2>Acceso Denegado</h2>
      <p>No tienes permiso para acceder a esta sección.</p>
      <button onClick={() => navigate('/dashboard/home')} className="back-btn">
        Volver al Inicio
      </button>
    </div>
  );
};

export default AccessDenied;
