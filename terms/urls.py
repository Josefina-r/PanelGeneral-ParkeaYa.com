from django.urls import path
from .views import TermsContentAPIView

urlpatterns = [
    # GET  /api/terms/?code=100
    # POST /api/terms/  { "code": 100 }
    path('', TermsContentAPIView.as_view(), name='terms-content'),
]
