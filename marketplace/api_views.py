import json
import logging
from decimal import Decimal

from django.contrib.auth import (
    authenticate,
    login,
    logout,
    get_user_model,
    password_validation,
)
from django.contrib.auth.models import Group
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.http import JsonResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.views.decorators.csrf import (
    ensure_csrf_cookie,
    csrf_protect,
)
from django.views.decorators.http import require_GET, require_POST
from django.middleware.csrf import get_token

from rest_framework import (
    generics,
    permissions,
    status,
    serializers,
    authentication,
)
from rest_framework.exceptions import ValidationError
from rest_framework.parsers import (
    MultiPartParser,
    FormParser,
    JSONParser,
)
from rest_framework.response import Response

from .models import (
    Vehicle,
    VehicleImage,
    Auction,
    Company,
    Ticket,
    Bid,
)

from .serializers import (
    VehicleSerializer,
    VehicleCreateSerializer,
    VehicleImageSerializer,
    AuctionSerializer,
    CompanySerializer,
    TicketSerializer,
    BidSerializer,
    AdminBidSerializer,
)


User = get_user_model()

logger = logging.getLogger(__name__)


# =====================================
# ROLE HELPERS
# =====================================

def is_seller(user):
    return (
        user.is_authenticated
        and user.groups.filter(name='Seller').exists()
    )


def is_buyer(user):
    return (
        user.is_authenticated
        and user.groups.filter(name='Buyer').exists()
    )


# =====================================
# REQUEST JSON HELPER
# =====================================

def get_request_data(request):

    try:
        data = json.loads(request.body or '{}')

        if not isinstance(data, dict):
            return None

        return data

    except (json.JSONDecodeError, UnicodeDecodeError):
        return None


# =====================================
# CSRF COOKIE API
# =====================================

@ensure_csrf_cookie
@require_GET
def csrf_cookie_api(request):

    csrf_token = get_token(request)

    return JsonResponse({
        'success': True,
        'detail': 'CSRF cookie initialized successfully.',
        'csrfToken': csrf_token,
    })


# =====================================
# SELLER LOGIN API
# =====================================

@csrf_protect
@require_POST
def seller_login_api(request):

    data = get_request_data(request)

    if data is None:
        return JsonResponse({
            'success': False,
            'message': 'Invalid request data.',
        }, status=400)

    username = data.get('username', '')
    password = data.get('password', '')

    if not isinstance(username, str):
        username = ''

    if not isinstance(password, str):
        password = ''

    username = username.strip()

    if not username or not password:
        return JsonResponse({
            'success': False,
            'message': 'Username and password are required.',
        }, status=400)

    user = authenticate(
        request,
        username=username,
        password=password,
    )

    if user is None:
        return JsonResponse({
            'success': False,
            'message': 'Invalid username or password.',
        }, status=401)

    if not is_seller(user):
        return JsonResponse({
            'success': False,
            'message': 'Only registered sellers can login here.',
        }, status=403)

    login(request, user)

    csrf_token = get_token(request)

    return JsonResponse({
        'success': True,
        'message': 'Seller login successful.',
        'csrfToken': csrf_token,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': 'Seller',
        },
    })


# =====================================
# SELLER LOGOUT API
# =====================================

@csrf_protect
@require_POST
def seller_logout_api(request):

    if not request.user.is_authenticated:
        return JsonResponse({
            'success': False,
            'message': 'You are not logged in.',
        }, status=401)

    if not is_seller(request.user):
        return JsonResponse({
            'success': False,
            'message': 'Seller access required.',
        }, status=403)

    logout(request)

    csrf_token = get_token(request)

    return JsonResponse({
        'success': True,
        'message': 'Seller logged out successfully.',
        'csrfToken': csrf_token,
    })


# =====================================
# CURRENT SELLER API
# =====================================

@require_GET
def seller_me_api(request):

    if not request.user.is_authenticated:
        return JsonResponse({
            'authenticated': False,
            'message': 'Please login first.',
        }, status=401)

    if not is_seller(request.user):
        return JsonResponse({
            'authenticated': False,
            'message': 'Seller access required.',
        }, status=403)

    return JsonResponse({
        'authenticated': True,
        'user': {
            'id': request.user.id,
            'username': request.user.username,
            'email': request.user.email,
            'role': 'Seller',
        },
    })


# =====================================
# BUYER REGISTRATION API
# =====================================

@csrf_protect
@require_POST
def buyer_register_api(request):

    data = get_request_data(request)

    if data is None:
        return JsonResponse({
            'success': False,
            'message': 'Invalid request data.',
        }, status=400)

    username = data.get('username', '')
    email = data.get('email', '')
    password = data.get('password', '')
    confirm_password = data.get('confirm_password', '')

    if not all(
        isinstance(value, str)
        for value in [
            username,
            email,
            password,
            confirm_password,
        ]
    ):
        return JsonResponse({
            'success': False,
            'message': 'All fields must contain valid text.',
        }, status=400)

    username = username.strip()
    email = email.strip().lower()

    if not username or not email or not password or not confirm_password:
        return JsonResponse({
            'success': False,
            'message': 'All fields are required.',
        }, status=400)

    if password != confirm_password:
        return JsonResponse({
            'success': False,
            'message': 'Passwords do not match.',
        }, status=400)

    if len(username) < 3:
        return JsonResponse({
            'success': False,
            'message': 'Username must contain at least 3 characters.',
        }, status=400)

    if User.objects.filter(username__iexact=username).exists():
        return JsonResponse({
            'success': False,
            'message': 'This username is already registered.',
        }, status=400)

    if User.objects.filter(email__iexact=email).exists():
        return JsonResponse({
            'success': False,
            'message': 'This email is already registered.',
        }, status=400)

    try:
        with transaction.atomic():

            user = User(
                username=username,
                email=email,
            )

            password_validation.validate_password(
                password,
                user=user,
            )

            user.set_password(password)
            user.save()

            buyer_group, _ = Group.objects.get_or_create(
                name='Buyer',
            )

            user.groups.add(buyer_group)

        return JsonResponse({
            'success': True,
            'message': 'Buyer account created successfully. Please login.',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': 'Buyer',
            },
        }, status=201)

    except DjangoValidationError as error:
        return JsonResponse({
            'success': False,
            'message': 'Password validation failed.',
            'errors': error.messages,
        }, status=400)

    except Exception:
        return JsonResponse({
            'success': False,
            'message': 'Unable to create Buyer account. Please try again.',
        }, status=500)


# =====================================
# SELLER REGISTRATION API
# =====================================

@csrf_protect
@require_POST
def seller_register_api(request):

    data = get_request_data(request)

    if data is None:
        return JsonResponse({
            'success': False,
            'message': 'Invalid request data.',
        }, status=400)

    username = data.get('username', '')
    email = data.get('email', '')
    password = data.get('password', '')
    confirm_password = data.get('confirm_password', '')

    if not all(
        isinstance(value, str)
        for value in [
            username,
            email,
            password,
            confirm_password,
        ]
    ):
        return JsonResponse({
            'success': False,
            'message': 'All fields must contain valid text.',
        }, status=400)

    username = username.strip()
    email = email.strip().lower()

    if not username or not email or not password or not confirm_password:
        return JsonResponse({
            'success': False,
            'message': 'All fields are required.',
        }, status=400)

    if len(username) < 3:
        return JsonResponse({
            'success': False,
            'message': 'Username must contain at least 3 characters.',
        }, status=400)

    if password != confirm_password:
        return JsonResponse({
            'success': False,
            'message': 'Passwords do not match.',
        }, status=400)

    if User.objects.filter(username__iexact=username).exists():
        return JsonResponse({
            'success': False,
            'message': 'This username is already registered.',
        }, status=400)

    if User.objects.filter(email__iexact=email).exists():
        return JsonResponse({
            'success': False,
            'message': 'This email is already registered.',
        }, status=400)

    try:
        with transaction.atomic():

            user = User(
                username=username,
                email=email,
            )

            password_validation.validate_password(
                password,
                user=user,
            )

            user.set_password(password)
            user.save()

            seller_group, _ = Group.objects.get_or_create(
                name='Seller',
            )

            user.groups.add(seller_group)

        return JsonResponse({
            'success': True,
            'message': 'Seller account created successfully. Please login.',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'role': 'Seller',
            },
        }, status=201)

    except DjangoValidationError as error:
        return JsonResponse({
            'success': False,
            'message': 'Password validation failed.',
            'errors': error.messages,
        }, status=400)

    except Exception:
        return JsonResponse({
            'success': False,
            'message': 'Unable to create Seller account. Please try again.',
        }, status=500)


# =====================================
# BUYER LOGIN API
# =====================================

@csrf_protect
@require_POST
def buyer_login_api(request):

    data = get_request_data(request)

    if data is None:
        return JsonResponse({
            'success': False,
            'message': 'Invalid request data.',
        }, status=400)

    username = data.get('username', '')
    password = data.get('password', '')

    if not isinstance(username, str):
        username = ''

    if not isinstance(password, str):
        password = ''

    username = username.strip()

    if not username or not password:
        return JsonResponse({
            'success': False,
            'message': 'Username and password are required.',
        }, status=400)

    user = authenticate(
        request,
        username=username,
        password=password,
    )

    if user is None:
        return JsonResponse({
            'success': False,
            'message': 'Invalid username or password.',
        }, status=401)

    if not is_buyer(user):
        return JsonResponse({
            'success': False,
            'message': 'Only registered buyers can login here.',
        }, status=403)

    login(request, user)

    csrf_token = get_token(request)

    return JsonResponse({
        'success': True,
        'message': 'Buyer login successful.',
        'csrfToken': csrf_token,
        'user': {
            'id': user.id,
            'username': user.username,
            'email': user.email,
            'role': 'Buyer',
        },
    })


# =====================================
# BUYER LOGOUT API
# =====================================

@csrf_protect
@require_POST
def buyer_logout_api(request):

    if not request.user.is_authenticated:
        return JsonResponse({
            'success': False,
            'message': 'You are not logged in.',
        }, status=401)

    if not is_buyer(request.user):
        return JsonResponse({
            'success': False,
            'message': 'Buyer access required.',
        }, status=403)

    logout(request)

    csrf_token = get_token(request)

    return JsonResponse({
        'success': True,
        'message': 'Buyer logged out successfully.',
        'csrfToken': csrf_token,
    })


# =====================================
# CURRENT BUYER API
# =====================================

@require_GET
def buyer_me_api(request):

    if not request.user.is_authenticated:
        return JsonResponse({
            'authenticated': False,
            'message': 'Please login first.',
        }, status=401)

    if not is_buyer(request.user):
        return JsonResponse({
            'authenticated': False,
            'message': 'Buyer access required.',
        }, status=403)

    return JsonResponse({
        'authenticated': True,
        'user': {
            'id': request.user.id,
            'username': request.user.username,
            'email': request.user.email,
            'role': 'Buyer',
        },
    })


# =====================================
# SELLER PERMISSION
# =====================================

class IsSeller(permissions.BasePermission):

    message = 'Only registered sellers can access this API.'

    def has_permission(self, request, view):
        return is_seller(request.user)


# =====================================
# BUYER PERMISSION
# =====================================

class IsBuyer(permissions.BasePermission):

    message = 'Only registered buyers can access this API.'

    def has_permission(self, request, view):
        return is_buyer(request.user)


# =====================================
# SELLER VEHICLE UPDATE SERIALIZER
# =====================================

class SellerVehicleUpdateSerializer(VehicleCreateSerializer):

    def validate(self, attrs):

        additional_images = attrs.get('images', [])

        existing_additional_count = (
            self.instance.additional_images.count()
            if self.instance
            else 0
        )

        has_main_image = bool(
            attrs.get('image')
            or (
                self.instance
                and self.instance.image
            )
        )

        total_images = (
            (1 if has_main_image else 0)
            + existing_additional_count
            + len(additional_images)
        )

        if total_images > 15:
            raise serializers.ValidationError({
                'images': (
                    'Maximum 15 images are allowed, '
                    'including the main vehicle image.'
                )
            })

        return attrs

    @transaction.atomic
    def update(self, instance, validated_data):

        additional_images = validated_data.pop(
            'images',
            []
        )

        for field, value in validated_data.items():
            setattr(instance, field, value)

        # Any seller edit requires admin reapproval.
        instance.listing_status = 'PENDING'
        instance.rejection_reason = ''

        instance.save()

        gallery_objects = [
            VehicleImage(
                vehicle=instance,
                image=image,
            )
            for image in additional_images
        ]

        if gallery_objects:
            VehicleImage.objects.bulk_create(
                gallery_objects
            )

        return instance


# =====================================
# VEHICLE LIST API
# =====================================

class VehicleListAPI(generics.ListAPIView):

    serializer_class = VehicleSerializer

    permission_classes = [
        permissions.AllowAny,
    ]

    def get_queryset(self):

        return Vehicle.objects.select_related(
            'company',
            'seller',
        ).prefetch_related(
            'additional_images',
        ).filter(
            listing_status='APPROVED',
            is_sold=False,
        ).order_by('-id')


# =====================================
# SINGLE VEHICLE DETAILS API
# =====================================

class VehicleDetailAPI(generics.RetrieveAPIView):

    serializer_class = VehicleSerializer

    lookup_field = 'pk'

    permission_classes = [
        permissions.AllowAny,
    ]

    def get_queryset(self):

        return Vehicle.objects.select_related(
            'company',
            'seller',
        ).prefetch_related(
            'additional_images',
        ).filter(
            listing_status='APPROVED',
        )


# =====================================
# SELLER CREATE VEHICLE API
# =====================================

class VehicleCreateAPI(generics.CreateAPIView):

    queryset = Vehicle.objects.all()

    serializer_class = VehicleCreateSerializer

    permission_classes = [
        permissions.IsAuthenticated,
        IsSeller,
    ]

    parser_classes = [
        MultiPartParser,
        FormParser,
        JSONParser,
    ]

    def perform_create(self, serializer):

        serializer.save(
            seller=self.request.user,
            listing_status='PENDING',
            is_verified=False,
            is_sold=False,
        )


# =====================================
# SELLER MY LISTINGS API
# =====================================

class SellerVehicleListAPI(generics.ListAPIView):

    serializer_class = VehicleSerializer

    permission_classes = [
        permissions.IsAuthenticated,
        IsSeller,
    ]

    def get_queryset(self):

        return Vehicle.objects.select_related(
            'company',
            'seller',
        ).prefetch_related(
            'additional_images',
        ).filter(
            seller=self.request.user,
        ).order_by('-created_at')


# =====================================
# SELLER UPDATE VEHICLE API
# =====================================

class SellerVehicleUpdateAPI(generics.UpdateAPIView):

    serializer_class = SellerVehicleUpdateSerializer

    permission_classes = [
        permissions.IsAuthenticated,
        IsSeller,
    ]

    parser_classes = [
        MultiPartParser,
        FormParser,
        JSONParser,
    ]

    http_method_names = [
        'put',
        'patch',
        'head',
        'options',
    ]

    def get_queryset(self):

        return Vehicle.objects.filter(
            seller=self.request.user,
        )

    def get_object(self):

        vehicle = super().get_object()

        # Do not allow edits after bids have been placed.
        has_bids = Bid.objects.filter(
            auction__vehicle=vehicle,
        ).exists()

        if has_bids:
            raise ValidationError({
                'detail': (
                    'This vehicle cannot be edited because '
                    'its auction already has bid history.'
                )
            })

        return vehicle

    def perform_update(self, serializer):
        serializer.save()


# =====================================
# SELLER DELETE VEHICLE API
# =====================================

class SellerVehicleDeleteAPI(generics.DestroyAPIView):

    permission_classes = [
        permissions.IsAuthenticated,
        IsSeller,
    ]

    def get_queryset(self):

        return Vehicle.objects.filter(
            seller=self.request.user,
        )

    def perform_destroy(self, instance):

        # Protect auction and bid history.
        if Auction.objects.filter(
            vehicle=instance
        ).exists():

            raise ValidationError({
                'detail': (
                    'This vehicle cannot be deleted because '
                    'an auction record exists. '
                    'Auction history must be preserved.'
                )
            })

        # Only pending or rejected listings can be deleted.
        if instance.listing_status not in [
            'PENDING',
            'REJECTED',
        ]:

            raise ValidationError({
                'detail': (
                    'Only pending or rejected vehicles '
                    'can be deleted by the seller.'
                )
            })

        instance.delete()


# =====================================
# SELLER ADD GALLERY IMAGES API
# =====================================

class SellerVehicleImageUploadAPI(generics.GenericAPIView):

    serializer_class = VehicleImageSerializer

    permission_classes = [
        permissions.IsAuthenticated,
        IsSeller,
    ]

    parser_classes = [
        MultiPartParser,
        FormParser,
    ]

    def get_vehicle(self):

        return get_object_or_404(
            Vehicle,
            pk=self.kwargs['pk'],
            seller=self.request.user,
        )

    def post(self, request, *args, **kwargs):

        vehicle = self.get_vehicle()

        # =====================================
        # BID HISTORY PROTECTION
        # =====================================

        if Bid.objects.filter(
            auction__vehicle=vehicle
        ).exists():

            raise ValidationError({
                'detail': (
                    'Images cannot be changed because '
                    'this vehicle already has bid history.'
                )
            })

        # =====================================
        # GET UPLOADED IMAGES
        # =====================================

        images = request.FILES.getlist('images')

        if not images:

            single_image = request.FILES.get('image')

            if single_image:
                images = [single_image]

        if not images:

            raise ValidationError({
                'images': 'Please select at least one image.'
            })

        # =====================================
        # IMAGE COUNT VALIDATION
        # =====================================

        current_count = (
            (1 if vehicle.image else 0)
            + vehicle.additional_images.count()
        )

        if current_count + len(images) > 15:

            raise ValidationError({
                'images': (
                    f'You can upload only '
                    f'{max(0, 15 - current_count)} more image(s). '
                    'The maximum is 15 including the main image.'
                )
            })

        # =====================================
        # PREPARE IMAGE OBJECTS
        # =====================================

        image_objects = [
            VehicleImage(
                vehicle=vehicle,
                image=image,
            )
            for image in images
        ]

        # =====================================
        # SAVE IMAGES + DIAGNOSTIC LOGGING
        # =====================================

        try:

            with transaction.atomic():

                # Save gallery images
                VehicleImage.objects.bulk_create(
                    image_objects
                )

                # Require admin reapproval if approved
                if vehicle.listing_status == 'APPROVED':

                    vehicle.listing_status = 'PENDING'
                    vehicle.rejection_reason = ''

                    vehicle.save(
                        update_fields=[
                            'listing_status',
                            'rejection_reason',
                            'updated_at',
                        ]
                    )

            # =====================================
            # FETCH SAVED IMAGES
            # =====================================

            saved_images = VehicleImage.objects.filter(
                vehicle=vehicle
            ).order_by('-id')[:len(images)]

            # =====================================
            # SERIALIZE RESPONSE
            # =====================================

            serializer = self.get_serializer(
                saved_images,
                many=True,
            )

            response_data = {
                'success': True,
                'message': 'Vehicle images uploaded successfully.',
                'count': len(images),
                'images': serializer.data,
                'listing_status': vehicle.listing_status,
            }

            # =====================================
            # SUCCESS LOG
            # =====================================

            logger.info(
                'Vehicle gallery upload successful. '
                'Vehicle ID: %s, Images uploaded: %s',
                vehicle.pk,
                len(images),
            )

            return Response(
                response_data,
                status=status.HTTP_201_CREATED,
            )

        # =====================================
        # ERROR LOG - FULL TRACEBACK
        # =====================================

        except Exception:

            logger.exception(
                'Vehicle gallery image upload failed. '
                'Vehicle ID: %s, Number of images: %s',
                vehicle.pk,
                len(images),
            )

            raise


# =====================================
# SELLER DELETE GALLERY IMAGE API
# =====================================

class SellerVehicleImageDeleteAPI(generics.DestroyAPIView):

    permission_classes = [
        permissions.IsAuthenticated,
        IsSeller,
    ]

    def get_object(self):

        vehicle = get_object_or_404(
            Vehicle,
            pk=self.kwargs['pk'],
            seller=self.request.user,
        )

        if Bid.objects.filter(
            auction__vehicle=vehicle
        ).exists():

            raise ValidationError({
                'detail': (
                    'Images cannot be deleted because '
                    'this vehicle already has bid history.'
                )
            })

        return get_object_or_404(
            VehicleImage,
            pk=self.kwargs['image_id'],
            vehicle=vehicle,
        )

    def perform_destroy(self, instance):

        vehicle = instance.vehicle

        instance.delete()

        if vehicle.listing_status == 'APPROVED':
            vehicle.listing_status = 'PENDING'
            vehicle.rejection_reason = ''

            vehicle.save(
                update_fields=[
                    'listing_status',
                    'rejection_reason',
                    'updated_at',
                ]
            )


# =====================================
# AUCTION LIST API
# =====================================

class AuctionListAPI(generics.ListAPIView):

    serializer_class = AuctionSerializer

    permission_classes = [
        permissions.AllowAny,
    ]

    def get_queryset(self):

        return Auction.objects.select_related(
            'vehicle',
            'vehicle__company',
            'vehicle__seller',
        ).prefetch_related(
            'bids',
            'bids__user',
            'vehicle__additional_images',
        ).filter(
            vehicle__listing_status='APPROVED',
            vehicle__is_sold=False,
        ).order_by('-id')


# =====================================
# SINGLE AUCTION DETAIL API
# =====================================

class AuctionDetailAPI(generics.RetrieveAPIView):

    serializer_class = AuctionSerializer

    lookup_field = 'pk'

    permission_classes = [
        permissions.AllowAny,
    ]

    def get_queryset(self):

        return Auction.objects.select_related(
            'vehicle',
            'vehicle__company',
            'vehicle__seller',
        ).prefetch_related(
            'bids',
            'bids__user',
            'vehicle__additional_images',
        ).filter(
            vehicle__listing_status='APPROVED',
        )


# =====================================
# AUCTION BID HISTORY API
# =====================================

class AuctionBidHistoryAPI(generics.ListAPIView):

    serializer_class = BidSerializer

    permission_classes = [
        permissions.AllowAny,
    ]

    def get_queryset(self):

        auction_id = self.kwargs.get('auction_id')

        auction = get_object_or_404(
            Auction.objects.select_related('vehicle'),
            pk=auction_id,
            vehicle__listing_status='APPROVED',
        )

        return Bid.objects.select_related(
            'user',
            'auction',
            'auction__vehicle',
            'auction__vehicle__company',
        ).filter(
            auction=auction,
        ).order_by(
            '-bid_amount',
            '-bid_time',
            '-id',
        )


# =====================================
# BUYER - MY BIDS API
# =====================================

class BuyerMyBidsAPI(generics.ListAPIView):

    serializer_class = BidSerializer

    permission_classes = [
        permissions.IsAuthenticated,
        IsBuyer,
    ]

    def get_queryset(self):

        return Bid.objects.select_related(
            'user',
            'auction',
            'auction__vehicle',
            'auction__vehicle__company',
        ).filter(
            user=self.request.user,
        ).order_by(
            '-bid_time',
            '-id',
        )


# =====================================
# ADMIN LOGIN API
# =====================================

@csrf_protect
@require_POST
def admin_login_api(request):

    data = get_request_data(request)

    if data is None:
        return JsonResponse({
            'success': False,
            'message': 'Invalid request data.',
        }, status=400)

    username = data.get('username', '')
    password = data.get('password', '')

    if not isinstance(username, str) or not isinstance(password, str):
        return JsonResponse({
            'success': False,
            'message': 'Invalid credentials format.',
        }, status=400)

    username = username.strip()

    if not username or not password:
        return JsonResponse({
            'success': False,
            'message': 'Username and password are required.',
        }, status=400)

    user = authenticate(
        request,
        username=username,
        password=password,
    )

    if user is None:
        return JsonResponse({
            'success': False,
            'message': 'Invalid username or password.',
        }, status=401)

    if not user.is_staff:
        return JsonResponse({
            'success': False,
            'message': 'Admin access is restricted.',
        }, status=403)

    login(request, user)

    csrf_token = get_token(request)

    return JsonResponse({
        'success': True,
        'message': 'Admin login successful.',
        'csrfToken': csrf_token,
        'user': {
            'id': user.id,
            'username': user.username,
            'is_staff': user.is_staff,
            'is_superuser': user.is_superuser,
        },
    })


# =====================================
# ADMIN - ALL BIDS API
# =====================================

class AdminBidListAPI(generics.ListAPIView):

    serializer_class = AdminBidSerializer

    authentication_classes = [
        authentication.SessionAuthentication,
    ]

    permission_classes = [
        permissions.IsAuthenticated,
        permissions.IsAdminUser,
    ]

    def get_queryset(self):

        return Bid.objects.select_related(
            'user',
            'auction',
            'auction__vehicle',
            'auction__vehicle__company',
        ).order_by(
            '-bid_time',
            '-id',
        )

    def list(self, request, *args, **kwargs):

        if not request.user.is_authenticated:
            return Response(
                {
                    'success': False,
                    'message': 'Please login through Django Admin.',
                },
                status=status.HTTP_401_UNAUTHORIZED,
            )

        if not request.user.is_staff:
            return Response(
                {
                    'success': False,
                    'message': (
                        'Admin access required. '
                        'Only staff users can view all auction bids.'
                    ),
                },
                status=status.HTTP_403_FORBIDDEN,
            )

        return super().list(
            request,
            *args,
            **kwargs,
        )


# =====================================
# COMPANY LIST API
# =====================================

class CompanyListAPI(generics.ListAPIView):

    queryset = Company.objects.all().order_by('name')

    serializer_class = CompanySerializer

    permission_classes = [
        permissions.AllowAny,
    ]


# =====================================
# SUPPORT TICKET API
# =====================================

class TicketCreateAPI(generics.CreateAPIView):

    queryset = Ticket.objects.all()

    serializer_class = TicketSerializer

    permission_classes = [
        permissions.AllowAny,
    ]

    def perform_create(self, serializer):

        user = (
            self.request.user
            if self.request.user.is_authenticated
            else None
        )

        serializer.save(user=user)


# =====================================
# BID CREATION API
# =====================================

class BidCreateAPI(generics.CreateAPIView):

    queryset = Bid.objects.select_related(
        'auction',
        'auction__vehicle',
        'user',
    )

    serializer_class = BidSerializer

    permission_classes = [
        permissions.AllowAny,
    ]

    def create(self, request, *args, **kwargs):

        authenticated_user = (
            request.user
            if request.user.is_authenticated
            else None
        )

        if authenticated_user:

            if is_seller(authenticated_user):
                raise ValidationError({
                    'user': 'Sellers cannot place bids.',
                })

            if not is_buyer(authenticated_user):
                raise ValidationError({
                    'user': 'Only registered buyers can place bids.',
                })

        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(
            raise_exception=True
        )

        auction_id = serializer.validated_data['auction'].pk
        bid_amount = serializer.validated_data['bid_amount']

        with transaction.atomic():

            locked_auction = get_object_or_404(
                Auction.objects.select_for_update().select_related(
                    'vehicle',
                ),
                pk=auction_id,
            )

            if not locked_auction.is_active:
                raise ValidationError({
                    'auction': 'This auction is not active.',
                })

            if locked_auction.end_time <= timezone.now():
                raise ValidationError({
                    'auction': 'This auction has already closed.',
                })

            if locked_auction.vehicle.is_sold:
                raise ValidationError({
                    'auction': 'This vehicle has already been sold.',
                })

            if locked_auction.vehicle.listing_status != 'APPROVED':
                raise ValidationError({
                    'auction': 'This vehicle is not approved for bidding.',
                })

            if authenticated_user:
                bidder_name = authenticated_user.username
            else:
                bidder_name = serializer.validated_data.get(
                    'bidder_name',
                    ''
                ).strip()

            if not bidder_name:
                raise ValidationError({
                    'bidder_name': 'Bidder name is required.',
                })

            minimum_bid = (
                locked_auction.current_price
                + Decimal('1000.00')
            )

            if bid_amount < minimum_bid:
                raise ValidationError({
                    'bid_amount': (
                        f'Minimum bid is ${minimum_bid}. '
                        f'Current highest bid is '
                        f'${locked_auction.current_price}.'
                    ),
                })

            bid = Bid.objects.create(
                auction=locked_auction,
                user=authenticated_user,
                bidder_name=bidder_name,
                bid_amount=bid_amount,
            )

            locked_auction.current_price = bid_amount

            locked_auction.save(
                update_fields=['current_price'],
            )

        bid = Bid.objects.select_related(
            'user',
            'auction',
            'auction__vehicle',
            'auction__vehicle__company',
        ).get(
            pk=bid.pk,
        )

        output_serializer = self.get_serializer(bid)

        headers = self.get_success_headers(
            output_serializer.data,
        )

        return Response(
            output_serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )