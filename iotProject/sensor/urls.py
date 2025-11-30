from django.urls import path

from . import views

urlpatterns = [
    path('', views.index, name='index'),
    path('getTemp/<int:cnt>', views.getTemp, name='getTemp'),
    path('getHumi/<int:cnt>', views.getHumi, name='getHumi'),
    path('getVib/<int:cnt>', views.getVib, name='getVib'),
    path('getProx/<int:cnt>', views.getProx, name='getProx'),
    path('getDust/<int:cnt>', views.getDust, name='getDust'),
    path('getLight/<int:cnt>', views.getLight, name='getLight'),
    path('getRain/<int:cnt>', views.getRain, name='getRain'),
    path('getDir/<int:cnt>', views.getDir, name='getDir'),
    path('getWDir/<int:cnt>', views.getWDir, name='getWDir'),
    path('getBDir/<int:cnt>', views.getBDir, name='getBDir'),
    path('getNextCommand', views.getNextCommand, name='getNextCommand'),

    path('setTemp', views.setTemp, name='setTemp'),
    path('setHumi', views.setHumi, name='setHumi'),
    path('setVib', views.setVib, name='setVib'),
    path('setProx', views.setProx, name='setProx'),
    path('setDust', views.setDust, name='setDust'),
    path('setLight', views.setLight, name='setLight'),
    path('setRain', views.setRain, name='setRain'),
    path('setWindowCommand', views.setWindowCommand, name='setWindowCommand'),
    path('setDir', views.setDir, name='setDir'),
    path('setWDir', views.setWDir, name='setWDir'),
    path('setBDir', views.setBDir, name='setBDir'),
]
