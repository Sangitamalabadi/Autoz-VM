
import os
import json
import secrets

from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.core.validators import validate_email

from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)


# --------------------------------------------------
# TEMPORARY PROTECTED ADMIN CREATION ENDPOINT
# Remove after creating production admin.
# --------------------------------------------------

@csrf_exempt
def temporary_admin_create(request):

    if request.method != "POST":
        return JsonResponse(
            {"error": "POST method required"},
            status=405,
        )

    token = request.headers.get("X-Admin-Reset-Token", "")
    expected = os.environ.get("ADMIN_RESET_TOKEN", "")

    if not expected or not secrets.compare_digest(token, expected):
        return JsonResponse(
            {"error": "Unauthorized"},
            status=401,
        )

    try:
        data = json.loads(request.body)

        username = data.get("username", "").strip()
        email = data.get("email", "").strip()
        password = data.get("password", "")

        if not username or not email or not password:
            return JsonResponse(
                {"error": "Username, email and password are required"},
                status=400,
            )

        validate_email(email)

        User = get_user_model()

        if User.objects.filter(username=username).exists():
            return JsonResponse(
                {"error": "Username already exists"},
                status=409,
            )

        if User.objects.filter(email=email).exists():
            return JsonResponse(
                {"error": "Email already exists"},
                status=409,
            )

        temporary_user = User(username=username, email=email)

        validate_password(password, temporary_user)

        user = User.objects.create_superuser(
            username=username,
            email=email,
            password=password,
        )

        return JsonResponse(
            {
                "success": True,
                "message": "Superuser created successfully",
                "username": user.username,
            },
            status=201,
        )

    except ValidationError as error:
        return JsonResponse(
            {"error": error.messages},
            status=400,
        )

    except json.JSONDecodeError:
        return JsonResponse(
            {"error": "Invalid JSON request"},
            status=400,
        )

    except Exception:
        return JsonResponse(
            {"error": "Admin creation failed"},
            status=500,
        )


# --------------------------------------------------
# URL CONFIGURATION
# --------------------------------------------------

urlpatterns = [
    path('admin/', admin.site.urls),

    # TEMPORARY ROUTE — remove after admin creation
    path(
        'api/temporary-admin-create/',
        temporary_admin_create,
        name='temporary-admin-create',
    ),

    path('', include('marketplace.urls')),

    # Swagger Docs
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path(
        'api/docs/',
        SpectacularSwaggerView.as_view(url_name='schema'),
        name='swagger-ui',
    ),
    path(
        'api/redoc/',
        SpectacularRedocView.as_view(url_name='schema'),
        name='redoc',
    ),
]

if settings.DEBUG:
    urlpatterns += static(
        settings.MEDIA_URL,
        document_root=settings.MEDIA_ROOT,
    )
