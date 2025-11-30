from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from .serializer import SensorDataSerializer

class SensorAPI(APIView):
    def post(self, request):
        # 받은 데이터 JSON에서 type 이라는 키를 sensor_type으로 바꿔줌
        data = request.data.copy()
        data['sensor_type'] = data.pop('type', None)

        serializer = SensorDataSerializer(data=data)

        if serializer.is_valid():
            serializer.save()
            return Response(
                {"message": "OK", "data": serializer.data},
                status=status.HTTP_201_CREATED
            )

        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
