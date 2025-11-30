from django.db import models

class SensorData(models.Model):
    sensor_type = models.CharField(max_length=50)
    value = models.CharField(max_length=100)
    timestamp = models.BigIntegerField()

    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.sensor_type}: {self.value}"
