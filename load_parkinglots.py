import os
import django
from datetime import time

# Configura Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'parkeaya.settings')  # 👈 cambia 'yourproject' por el nombre de tu proyecto
django.setup()

from django.contrib.auth import get_user_model
from parking.models import ParkingLot   

User = get_user_model()

dueno = User.objects.first()
if not dueno:
    raise Exception("❌ No existe un usuario en la base de datos. Crea uno antes de ejecutar el script.")

data = [
    {
        "nombre": "Cochera Cámara de Comercio",
        "direccion": "Av. España 123, Trujillo",
        "precio_hora": 3.00,
        "total_plazas": 15,
        "plazas_disponibles": 10,
        "nivel_seguridad": 2,
        "descripcion": "Estacionamiento techado cerca a la Cámara de Comercio.",
        "latitud": -8.108750,
        "longitud": -79.026620,
        "horario_apertura": time(7, 0),
        "horario_cierre": time(22, 0)
    },
    {
        "nombre": "Cochera Centro Histórico",
        "direccion": "Jr. Pizarro 321, Trujillo",
        "precio_hora": 2.50,
        "total_plazas": 12,
        "plazas_disponibles": 8,
        "nivel_seguridad": 1,
        "descripcion": "Cochera céntrica a pocos metros de la Plaza de Armas.",
        "latitud": -8.113280,
        "longitud": -79.030430,
        "horario_apertura": time(8, 0),
        "horario_cierre": time(21, 0)
    },
    {
        "nombre": "Cochera Perú (Jr. Gamarra 461)",
        "direccion": "Jr. Gamarra 461, Trujillo",
        "precio_hora": 3.00,
        "total_plazas": 14,
        "plazas_disponibles": 12,
        "nivel_seguridad": 2,
        "descripcion": "Buena opción cerca al centro histórico.",
        "latitud": -8.109100,
        "longitud": -79.027000,
        "horario_apertura": time(7, 0),
        "horario_cierre": time(23, 0)
    },
    {
        "nombre": "Estacionamiento Real Plaza",
        "direccion": "Av. César Vallejo 1345, Trujillo",
        "precio_hora": 4.00,
        "total_plazas": 100,
        "plazas_disponibles": 50,
        "nivel_seguridad": 3,
        "descripcion": "Amplio estacionamiento del centro comercial Real Plaza.",
        "latitud": -8.121250,
        "longitud": -79.029200,
        "horario_apertura": time(9, 0),
        "horario_cierre": time(22, 0)
    },
    {
        "nombre": "Estacionamiento Mall Plaza",
        "direccion": "Av. América Oeste 1256, Trujillo",
        "precio_hora": 4.00,
        "total_plazas": 120,
        "plazas_disponibles": 60,
        "nivel_seguridad": 3,
        "descripcion": "Estacionamiento techado y vigilado del Mall Plaza.",
        "latitud": -8.115750,
        "longitud": -79.035600,
        "horario_apertura": time(9, 0),
        "horario_cierre": time(23, 0)
    }
]

for entry in data:
    obj, created = ParkingLot.objects.get_or_create(
        dueno=dueno,
        nombre=entry["nombre"],
        defaults=entry
    )
    if created:
        print(f"✅ Insertado: {entry['nombre']}")
    else:
        print(f"⚠️ Ya existía: {entry['nombre']}")

print("🎉 Carga terminada")
