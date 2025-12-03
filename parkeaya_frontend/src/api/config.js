// src/api/config.js
const ENV = process.env.NODE_ENV;

export const API_URLS = {
  spring: "http://localhost:8081/api",  // Panel local (Spring Boot)
  django: "http://localhost:8000/api",  // Panel general (Django)
};

export const BASE_URL =
  ENV === "production" ? API_URLS.django : API_URLS.django; // Cambia si deseas alternar
