import os
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
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from openai import OpenAI
import random
import json

OPENAI_KEY = os.getenv("OPENAI_API_KEY")
openai_client = OpenAI(api_key=OPENAI_KEY) if OPENAI_KEY else None
VOICE_SYSTEM_PROMPT = (
    "당신은 스마트 창문과 블라인드를 제어하는 친절한 가정용 비서입니다. "
    "반드시 2문장 이내의 간결한 한국어로 답변하고, 위험 상황에서는 주의 메시지를 우선 전달하세요."
)

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


def _extract_voice_message(request):
    message = request.POST.get('message') or request.POST.get('text')
    if (not message) and request.body:
        try:
            payload = json.loads(request.body.decode('utf-8'))
            if isinstance(payload, dict):
                message = payload.get('message') or payload.get('text')
        except (json.JSONDecodeError, UnicodeDecodeError):
            message = None
    return message


@csrf_exempt
@require_POST
def voiceAssistant(request):
    message = _extract_voice_message(request)
    if not message:
        return JsonResponse({"message": "MESSAGE_REQUIRED"}, status=400)
    if not openai_client:
        return JsonResponse({"message": "OPENAI_KEY_MISSING"}, status=500)

    try:
        response = openai_client.responses.create(
            model="gpt-4o-mini",
            input=f"{VOICE_SYSTEM_PROMPT}\n사용자 요청: {message}",
        )
        reply_text = getattr(response, "output_text", None)
        if not reply_text:
            reply_text = str(response)
        return JsonResponse(
            {
                "reply": reply_text.strip(),
                "received": message,
            }
        )
    except Exception as exc:
        return JsonResponse(
            {"message": "OPENAI_REQUEST_FAILED", "detail": str(exc)},
            status=500,
        )

# Create your views here.
