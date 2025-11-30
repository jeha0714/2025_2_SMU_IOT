from django.db import models
from django.utils import timezone

# 온도 센서 테이블
class TemperatureSensor(models.Model):
	reg_date = models.DateTimeField(editable=False)
	value = models.FloatField()
	def save(self, *args, **kwargs):
		if not self.id:
			self.reg_date = timezone.now()
		return super(TemperatureSensor, self).save(*args, **kwargs)

# 습도 센서 테이블
class HumiditySensor(models.Model):
	reg_date = models.DateTimeField(editable=False)
	value = models.FloatField()

	def save(self, *args, **kwargs):
		if not self.id:
			self.reg_date = timezone.now()
		return super(HumiditySensor, self).save(*args, **kwargs)

# 진동 센서 테이블
class VibratorSensor(models.Model):
	reg_date = models.DateTimeField(editable=False)
	value = models.BooleanField()

	def save(self, *args, **kwargs):
		if not self.id:
			self.reg_date = timezone.now()
		return super(VibratorSensor, self).save(*args, **kwargs)

# 근접 센서 테이블
class ProximitySensor(models.Model):
	reg_date = models.DateTimeField(editable=False)
	value = models.FloatField()

	def save(self, *args, **kwargs):
		if not self.id:
			self.reg_date = timezone.now()
		return super(ProximitySensor, self).save(*args, **kwargs)

# 먼지 센서 테이블
class DustSensor(models.Model):
	reg_date = models.DateTimeField(editable=False)
	value = models.FloatField()

	def save(self, *args, **kwargs):
		if not self.id:
			self.reg_date = timezone.now()
		return super(DustSensor, self).save(*args, **kwargs)

# 조도 센서 테이블
class LightSensor(models.Model):
	reg_date = models.DateTimeField(editable=False)
	value = models.FloatField()

	def save(self, *args, **kwargs):
		if not self.id:
			self.reg_date = timezone.now()
		return super(LightSensor, self).save(*args, **kwargs)

# 강우 센서 테이블
class RainSensor(models.Model):
	reg_date = models.DateTimeField(editable=False)
	value = models.FloatField()

	def save(self, *args, **kwargs):
		if not self.id:
			self.reg_date = timezone.now()
		return super(RainSensor, self).save(*args, **kwargs)

# 창문 제어 명령 테이블
class WindowCommand(models.Model):
	command = models.CharField(max_length=10)
	processed = models.BooleanField(default=False)
	created_at = models.DateTimeField(editable=False)

	def save(self, *args, **kwargs):
		if not self.id:
			self.created_at = timezone.now()
		return super(WindowCommand, self).save(*args, **kwargs)

# 방향 센서 테이블
class DirSensor(models.Model):
	reg_date = models.DateTimeField(editable=False)
	value = models.IntegerField()

	def save(self, *args, **kwargs):
		if not self.id:
			self.reg_date = timezone.now()
		return super(DirSensor, self).save(*args, **kwargs)


class BlindDirSensor(models.Model):
	reg_date = models.DateTimeField(editable=False)
	value = models.IntegerField()

	def save(self, *args, **kwargs):
		if not self.id:
			self.reg_date = timezone.now()
		return super(BlindDirSensor, self).save(*args, **kwargs)

# Create your models here.
