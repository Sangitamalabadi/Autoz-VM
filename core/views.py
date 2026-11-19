
import logging

from django.http import JsonResponse

logger = logging.getLogger("django.security.csrf")


def csrf_failure(request, reason=""):
    origin = request.headers.get("Origin", "")
    referer = request.headers.get("Referer", "")

    csrf_cookie_present = bool(request.COOKIES.get("csrftoken"))
    csrf_header_present = bool(request.headers.get("X-CSRFToken"))

    logger.warning(
        "CSRF FAILURE | reason=%s | path=%s | method=%s | "
        "origin=%s | referer=%s | csrf_cookie_present=%s | "
        "csrf_header_present=%s",
        reason,
        request.path,
        request.method,
        origin,
        referer,
        csrf_cookie_present,
        csrf_header_present,
    )

    return JsonResponse(
        {
            "success": False,
            "error": "CSRF verification failed.",
            "reason": reason,
        },
        status=403,
    )
