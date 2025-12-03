// Centraliza la URL base de la API para permitir cambiarla por variable de entorno
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:8000/api';

export default API_BASE;
