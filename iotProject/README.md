# iotProject 환경 변수 설정

1. `.env.example` 파일을 `.env`로 복사합니다.
   ```bash
   cp .env.example .env
   ```
2. 새로 생성된 `.env` 파일에 OpenAI 키 값을 입력합니다.
   ```ini
   OPENAI_API_KEY=sk-...
   ```
3. Django 서버를 실행하면 `iotProject/settings.py`가 자동으로 `.env`를 읽어 환경 변수를 로드합니다. 다른 방법으로 실행하고 싶다면 셸에서 직접 `OPENAI_API_KEY`를 export 해도 됩니다.

> 주의: `.env` 파일에는 민감한 값이 포함되므로 버전 관리에 포함시키지 마세요.
