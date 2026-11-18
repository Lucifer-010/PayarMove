from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

urlpatterns = [
    path('admin/', admin.site.urls),

    # OpenAPI 3.0 Documentation Endpoints
    path('api/v1/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/v1/docs/', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    path('api/v1/redoc/', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),

    # PayarMove API Services
    path('api/v1/auth/', include('apps.authentication.urls')),
    path('api/v1/kyc/', include('apps.kyc.urls')),
    path('api/v1/rentals/', include('apps.rentals.urls')),
    path('api/v1/escrow/', include('apps.escrow.urls')),
    path('api/v1/payouts/', include('apps.payouts.urls')),
    path('api/v1/dashboard/', include('apps.dashboard.urls')),
]

from django.views.static import serve
from django.urls import re_path

urlpatterns += [
    re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
]
