from django.http import HttpResponse
from .models import (
    TemperatureSensor as Temp,
    HumiditySensor as Humi,
    VibratorSensor as Vib,
    ProximitySensor as Prox,
    DustSensor as Dust,
    LightSensor as Light,
    RainSensor as Rain,
    DirSensor as Dir,
    BlindDirSensor as BDir,
    WindowCommand as WinCmd,
)
from django.shortcuts import render
from django.core import serializers
from django.http import JsonResponse
import random
import json

def index(request):
    sensor_value_list = Temp.objects.all().order_by('-reg_date').values()[:5]
    context = {
        'sensor_value_list': sensor_value_list,
    }
    return render(request, 'sensor/index.html', context)

def getTemp(request, cnt):
    results = list(Temp.objects.all().order_by('-reg_date').values())[:cnt][::-1]
    return JsonResponse(results, safe=False)

def getHumi(request, cnt):
    results = list(Humi.objects.all().order_by('-reg_date').values())[:cnt][::-1]
    return JsonResponse(results, safe=False)

def getVib(request, cnt):
    results = list(Vib.objects.all().order_by('-reg_date').values())[:cnt][::-1]
    return JsonResponse(results, safe=False)

def getProx(request, cnt):
    results = list(Prox.objects.all().order_by('-reg_date').values())[:cnt][::-1]
    return JsonResponse(results, safe=False)

def getDust(request, cnt):
    results = list(Dust.objects.all().order_by('-reg_date').values())[:cnt][::-1]
    return JsonResponse(results, safe=False)

def getLight(request, cnt):
    results = list(Light.objects.all().order_by('-reg_date').values())[:cnt][::-1]
    return JsonResponse(results, safe=False)

def getRain(request, cnt):
    results = list(Rain.objects.all().order_by('-reg_date').values())[:cnt][::-1]
    return JsonResponse(results, safe=False)

def getDir(request, cnt):
    return getWDir(request, cnt)

def getWDir(request, cnt):
    results = list(Dir.objects.all().order_by('-reg_date').values())[:cnt][::-1]
    return JsonResponse(results, safe=False)

def getBDir(request, cnt):
    results = list(BDir.objects.all().order_by('-reg_date').values())[:cnt][::-1]
    return JsonResponse(results, safe=False)

def setTemp(request):
    try:
        Temp.objects.create(value = request.POST['value'])
        return JsonResponse({"message": "OK"}, status=200)
    except KeyError:
        return JsonResponse({"message": "KEY_ERROR"}, status=400)

def setHumi(request):
    try:
        Humi.objects.create(value = request.POST['value'])
        return JsonResponse({"message": "OK"}, status=200)
    except KeyError:
        return JsonResponse({"message": "KEY_ERROR"}, status=400)

def setVib(request):
    try:
        Vib.objects.create(value = request.POST['value'])
        return JsonResponse({"message": "OK"}, status=200)
    except KeyError:
        return JsonResponse({"message": "KEY_ERROR"}, status=400)

def setProx(request):
    try:
        Prox.objects.create(value = request.POST['value'])
        return JsonResponse({"message": "OK"}, status=200)
    except KeyError:
        return JsonResponse({"message": "KEY_ERROR"}, status=400)

def setDust(request):
    try:
        Dust.objects.create(value = request.POST['value'])
        return JsonResponse({"message": "OK"}, status=200)
    except KeyError:
        return JsonResponse({"message": "KEY_ERROR"}, status=400)

def setLight(request):
    try:
        Light.objects.create(value = request.POST['value'])
        return JsonResponse({"message": "OK"}, status=200)
    except KeyError:
        return JsonResponse({"message": "KEY_ERROR"}, status=400)

def setRain(request):
    try:
        Rain.objects.create(value = request.POST['value'])
        return JsonResponse({"message": "OK"}, status=200)
    except KeyError:
        return JsonResponse({"message": "KEY_ERROR"}, status=400)

def setDir(request):
    return setWDir(request)

def setWDir(request):
    try:
        Dir.objects.create(value = request.POST['value'])
        return JsonResponse({"message": "OK"}, status=200)
    except KeyError:
        return JsonResponse({"message": "KEY_ERROR"}, status=400)

def setBDir(request):
    try:
        BDir.objects.create(value = request.POST['value'])
        return JsonResponse({"message": "OK"}, status=200)
    except KeyError:
        return JsonResponse({"message": "KEY_ERROR"}, status=400)

ALLOWED_COMMANDS = {"OPEN", "CLOSE", "UP", "DOWN"}


def setWindowCommand(request):
    command = request.POST.get('command')
    if not command and request.body:
        try:
            payload = json.loads(request.body.decode('utf-8'))
            command = payload.get('command')
        except json.JSONDecodeError:
            command = None
    if not command:
        return JsonResponse({"message": "KEY_ERROR"}, status=400)
    command = command.upper()
    if command not in ALLOWED_COMMANDS:
        return JsonResponse({"message": "INVALID_COMMAND"}, status=400)
    WinCmd.objects.create(command=command)
    return JsonResponse({"message": "QUEUED", "command": command}, status=200)

def getNextCommand(request):
    cmd = WinCmd.objects.filter(processed=False).order_by('created_at').first()
    if cmd:
        cmd.processed = True
        cmd.save(update_fields=['processed'])
        return JsonResponse({"command": cmd.command})
    return JsonResponse({"command": "ACK"})

# Create your views here.
