import os
import json
from django.http import JsonResponse, HttpResponseBadRequest
from django.shortcuts import render
from django.views.decorators.http import require_POST
from django.views.decorators.csrf import csrf_exempt
from openai import OpenAI

# .env에 있는 OPENAI_API_KEY 사용
OPENAI_KEY = os.getenv("OPENAI_API_KEY")
client = OpenAI(api_key=OPENAI_KEY)

def index(request):
    # 개발용 페이지 (React 개발 시 여기는 사용 안함)
    return render(request, 'chatapp/index.html')

@csrf_exempt   # 개발 환경에서는 편의를 위해 사용 (배포 시 제거)
@require_POST
def chat_api(request):

    if request.content_type != "application/json":
        return JsonResponse({'error': 'Content-Type must be application/json'}, status=400)

    try:
        data = json.loads(request.body.decode("utf-8"))
        prompt = data.get("prompt")
    except:
        return HttpResponseBadRequest("Invalid JSON")

    if not prompt:
        return JsonResponse({'error': 'prompt required'}, status=400)

    if not OPENAI_KEY:
        return JsonResponse({'error': 'OpenAI API key not found'}, status=500)

    try:
        # OpenAI 호출
        response = client.responses.create(
            model="gpt-4o-mini",
            input=f"사용자 요청: {prompt}"
        )

        # output_text attribute 우선
        if hasattr(response, "output_text") and response.output_text:
            output = response.output_text
        else:
            # 안전한 파싱
            output = str(response)

        return JsonResponse({'response': output})

    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)
