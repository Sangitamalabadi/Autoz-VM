from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse

from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)


# --------------------------------------------------
# BACKEND STATUS
# --------------------------------------------------

def backend_status(request):
    return JsonResponse({
        "project": "AutoZ",
        "service": "Backend API",
        "status": "running",
        "message": "AutoZ backend is live and operational.",
        "api": "/api/",
        "admin": "/admin/",
        "documentation": "/api/docs/",
    })


# --------------------------------------------------
# URL CONFIGURATION
# --------------------------------------------------

urlpatterns = [

    # Backend root status
    path('', backend_status, name='backend-status'),

    # Django Admin
    path('admin/', admin.site.urls),

    # Marketplace routes and APIs
    path('', include('marketplace.urls')),

    # Swagger Schema
    path(
        'api/schema/',
        SpectacularAPIView.as_view(),
        name='schema',
    ),

    # Swagger Documentation
    path(
        'api/docs/',
        SpectacularSwaggerView.as_view(url_name='schema'),
        name='swagger-ui',
    ),

    # ReDoc Documentation
    path(
        'api/redoc/',
        SpectacularRedocView.as_view(url_name='schema'),
        name='redoc',
    ),
]


# --------------------------------------------------
# MEDIA FILES - DEVELOPMENT
# --------------------------------------------------

if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )