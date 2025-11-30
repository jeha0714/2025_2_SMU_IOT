from django.urls import path
from .views import SensorAPI

urlpatterns = [
    path('sensor/', SensorAPI.as_view(), name='sensor_api'),
]
