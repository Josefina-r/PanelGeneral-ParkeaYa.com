# vehicles/urls.py
from django.urls import path
from . import views

urlpatterns = [
    # Listar y crear vehículos del usuario
    path('vehicles/', views.UserVehicleListCreateView.as_view(), name='user-vehicles-list-create'),
    
    # Operaciones CRUD en vehículo específico
    path('vehicles/<int:pk>/', views.UserVehicleDetailView.as_view(), name='user-vehicle-detail'),
    
    # Obtener vehículo por ID (alternativa)
    path('vehicles/by-id/<int:vehicle_id>/', views.UserVehicleByIdView.as_view(), name='user-vehicle-by-id'),
    
    # Listar todos los vehículos (con opción de mostrar inactivos)
    path('vehicles/all/', views.AllUserVehiclesView.as_view(), name='all-user-vehicles'),
]