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
    "반드시 2문장 이내의 간결한 한국어로 답변하고, 위험 상황에서는 주의 메시지를 우선 전달하세요. "
    "항상 다음 JSON 형식만 반환하세요: {\"reply\": \"한국어 답변\", \"actions\": [{\"device\": \"WINDOW|BLIND\", \"command\": \"OPEN|CLOSE|UP|DOWN\"}]}"
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


def _parse_voice_payload(raw_text):
    if not raw_text:
        return None
    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        start = raw_text.find('{')
        end = raw_text.rfind('}')
        if start == -1 or end == -1 or end <= start:
            return None
        candidate = raw_text[start : end + 1]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            return None


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
            input=[
                {
                    "role": "system",
                    "content": [
                        {
                            "type": "input_text",
                            "text": VOICE_SYSTEM_PROMPT,
                        }
                    ],
                },
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_text",
                            "text": message,
                        }
                    ],
                },
            ],
        )

        raw_response = getattr(response, "output_text", None)
        if not raw_response:
            # responses.create 가 chunk 를 반환할 때 대비
            chunks = []
            for output in getattr(response, "output", []) or []:
                for content in getattr(output, "content", []) or []:
                    text_value = getattr(content, "text", None)
                    if text_value:
                        chunks.append(text_value)
            raw_response = "".join(chunks)

        parsed = _parse_voice_payload(raw_response)
        if not parsed:
            parsed = {"reply": raw_response or "응답을 해석할 수 없었습니다.", "actions": []}

        reply_text = (parsed.get("reply") or "").strip()
        actions = parsed.get("actions") if isinstance(parsed.get("actions"), list) else []

        queued_actions = []
        for action in actions:
            if not isinstance(action, dict):
                continue
            device = str(action.get("device", "")).upper()
            command = str(action.get("command", "")).upper()

            normalized = None
            if device == "WINDOW" and command in {"OPEN", "CLOSE"}:
                normalized = command
            elif device == "BLIND" and command in {"UP", "DOWN"}:
                normalized = command

            if normalized and normalized in ALLOWED_COMMANDS:
                WinCmd.objects.create(command=normalized)
                queued_actions.append({"device": device, "command": normalized})

        return JsonResponse(
            {
                "reply": reply_text or "요청을 처리했습니다.",
                "received": message,
                "actionsQueued": queued_actions,
            }
        )
    except Exception as exc:
        return JsonResponse(
            {"message": "OPENAI_REQUEST_FAILED", "detail": str(exc)},
            status=500,
        )

# Create your views here.
