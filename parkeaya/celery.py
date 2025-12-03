from __future__ import absolute_import, unicode_literals
import os
from celery import Celery
from celery.schedules import crontab

# Configurar settings de Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'parkeaya.settings')

app = Celery('parkeaya')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()

# Configurar tareas periódicas
app.conf.beat_schedule = {
    'cancel-unused-reservations': {
        'task': 'reservations.tasks.cancel_unused_reservations',
        'schedule': crontab(minute='*/5'),  
    },
    'cleanup-expired-reservations': {
        'task': 'reservations.tasks.cleanup_expired_reservations',
        'schedule': crontab(minute='*/10'),  
    },
}