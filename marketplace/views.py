
from decimal import Decimal, InvalidOperation
import json
import traceback

from datetime import timedelta

from django.shortcuts import render, redirect, get_object_or_404
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from django.db import transaction
from django.db.models import Q, Count
from django.utils import timezone
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt

from rest_framework import viewsets, generics, status
from rest_framework.permissions import AllowAny
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response

from .models import Vehicle, Auction, Bid, Company
from .serializers import (
    VehicleSerializer,
    AuctionSerializer,
    BidSerializer,
)


# ==========================================
# COMMON AUCTION SETTINGS
# ==========================================

BID_INCREMENT = Decimal("1000.00")


def get_live_auctions():
    """
    Return all active auctions which have not expired.
    Each auction is linked with its vehicle.
    """

    return (
        Auction.objects
        .filter(
            is_active=True,
            end_time__gt=timezone.now()
        )
        .select_related(
            'vehicle',
            'vehicle__company'
        )
        .order_by('-id')
    )


def create_vehicle_auction(vehicle):
    """
    Automatically create an auction for a vehicle
    if an auction does not already exist.
    """

    auction, created = Auction.objects.get_or_create(
        vehicle=vehicle,
        defaults={
            'base_price': vehicle.price,
            'current_price': vehicle.price,
            'end_time': timezone.now() + timedelta(days=7),
            'is_active': True,
        }
    )

    return auction


def process_bid(auction_id, bid_amount, bidder_name):
    """
    Safely process a bid and update auction current price.
    """

    try:
        amount = Decimal(str(bid_amount))
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError("Please enter a valid bid amount.")

    if not amount.is_finite() or amount <= 0:
        raise ValueError("Bid amount must be greater than zero.")

    with transaction.atomic():

        auction = get_object_or_404(
            Auction.objects.select_for_update(),
            id=auction_id
        )

        if not auction.is_active:
            raise ValueError("This auction is not active.")

        if auction.end_time <= timezone.now():
            raise ValueError("This auction has expired.")

        minimum_bid = (
            Decimal(str(auction.current_price))
            + BID_INCREMENT
        )

        if amount < minimum_bid:
            raise ValueError(
                f"Minimum bid amount is ${minimum_bid:,.2f}."
            )

        bid = Bid.objects.create(
            auction=auction,
            bid_amount=amount,
            bidder_name=bidder_name
        )

        auction.current_price = amount
        auction.save(update_fields=['current_price'])

    return bid, auction


# ==========================================
# HOME PAGE
# ==========================================

def home(request):

    query = request.GET.get('q', '').strip()

    vehicles = Vehicle.objects.all().order_by('-id')

    if query:
        vehicles = vehicles.filter(
            Q(title__icontains=query)
            | Q(company__name__icontains=query)
            | Q(model_name__icontains=query)
            | Q(description__icontains=query)
        )

    companies = Company.objects.annotate(
        vehicle_count=Count('vehicles')
    ).order_by('-vehicle_count')[:8]

    return render(
        request,
        'marketplace/home.html',
        {
            'vehicles': vehicles,
            'query': query,
            'companies': companies,
        }
    )


# ==========================================
# ADD VEHICLE
# ==========================================

def add_vehicle(request):

    if request.method == 'POST':

        title = request.POST.get('title') or (
            f"{request.POST.get('company', '')} "
            f"{request.POST.get('model_name', '')}"
        )

        company_name = (
            request.POST.get('company', 'Other').strip()
            or 'Other'
        )

        model_name = request.POST.get('model_name', '')
        price = request.POST.get('price')
        year = request.POST.get('year')
        km_driven = request.POST.get('km_driven')
        description = request.POST.get('description', '')

        image = (
            request.FILES.get('photo')
            or request.FILES.get('image')
        )

        try:
            vehicle_price = Decimal(str(price))

            if vehicle_price <= 0:
                raise ValueError()

            company_obj, created = Company.objects.get_or_create(
                name=company_name
            )

            if request.user.is_authenticated:
                owner = request.user
            else:
                owner = User.objects.first()

            if not owner:
                return render(
                    request,
                    'marketplace/add.html',
                    {
                        'error': 'An owner account is required.'
                    }
                )

            with transaction.atomic():

                vehicle = Vehicle.objects.create(
                    title=title,
                    company=company_obj,
                    owner=owner,
                    model_name=model_name,
                    price=vehicle_price,
                    year=int(year) if year else 2020,
                    km_driven=int(km_driven) if km_driven else 0,
                    description=description,
                    image=image,
                    is_verified=True
                )

                create_vehicle_auction(vehicle)

            return redirect('home')

        except (ValueError, InvalidOperation, TypeError):
            return render(
                request,
                'marketplace/add.html',
                {
                    'error': 'Please enter valid vehicle details.'
                }
            )

    return render(request, 'marketplace/add.html')


# ==========================================
# AUCTION PAGE
# ==========================================

def auction_page(request, id=None):

    if id:

        vehicle = get_object_or_404(
            Vehicle,
            id=id
        )

        auction = create_vehicle_auction(vehicle)

        bids = Bid.objects.filter(
            auction=auction
        ).order_by('-bid_amount')[:20]

        is_expired = (
            auction.end_time <= timezone.now()
        )

        winner = (
            bids.first()
            if is_expired and bids.exists()
            else None
        )

        return render(
            request,
            'marketplace/auction.html',
            {
                'vehicle': vehicle,
                'auction': auction,
                'bids': bids,
                'winner': winner,
                'is_expired': is_expired,
            }
        )

    auctions = get_live_auctions()

    return render(
        request,
        'marketplace/auction.html',
        {
            'auctions': auctions
        }
    )


# ==========================================
# AUCTION DETAIL
# ==========================================

def auction_detail(request, id):

    auction = get_object_or_404(
        Auction.objects.select_related('vehicle'),
        id=id
    )

    if request.method == 'POST':

        bid_amount = request.POST.get('bid_amount')

        if bid_amount:

            bidder_name = (
                request.user.username
                if request.user.is_authenticated
                else 'Guest USA'
            )

            try:
                process_bid(
                    auction.id,
                    bid_amount,
                    bidder_name
                )

                return redirect('my-bids')

            except ValueError as error:
                return render(
                    request,
                    'marketplace/auction_detail.html',
                    {
                        'auction': auction,
                        'bids': Bid.objects.filter(
                            auction=auction
                        ).order_by('-bid_amount')[:20],
                        'is_expired': (
                            auction.end_time <= timezone.now()
                        ),
                        'error': str(error),
                    }
                )

    bids = Bid.objects.filter(
        auction=auction
    ).order_by('-bid_amount')[:20]

    is_expired = (
        auction.end_time <= timezone.now()
    )

    winner = (
        bids.first()
        if is_expired and bids.exists()
        else None
    )

    return render(
        request,
        'marketplace/auction_detail.html',
        {
            'auction': auction,
            'bids': bids,
            'is_expired': is_expired,
            'winner': winner,
        }
    )


# ==========================================
# PLACE BID API
# ==========================================

@csrf_exempt
def place_bid_simple(request):

    if request.method != 'POST':
        return JsonResponse(
            {'error': 'Invalid request method'},
            status=405
        )

    try:

        data = json.loads(request.body)

        auction_id = data.get('auction')
        bid_amount = data.get('bid_amount')

        bidder_name = data.get(
            'bidder_name',
            'USA Buyer'
        )

        if request.user.is_authenticated:
            bidder_name = request.user.username

        if not auction_id or bid_amount is None:
            return JsonResponse(
                {'error': 'Auction ID and bid amount are required.'},
                status=400
            )

        bid, auction = process_bid(
            auction_id,
            bid_amount,
            bidder_name
        )

        return JsonResponse(
            {
                'success': True,
                'id': bid.id,
                'auction_id': auction.id,
                'new_price': str(auction.current_price),
                'minimum_next_bid': str(
                    auction.current_price + BID_INCREMENT
                ),
                'message': 'Bid placed successfully.'
            },
            status=201
        )

    except Auction.DoesNotExist:
        return JsonResponse(
            {'error': 'Auction not found.'},
            status=404
        )

    except ValueError as error:
        return JsonResponse(
            {'error': str(error)},
            status=400
        )

    except Exception as error:

        traceback.print_exc()

        return JsonResponse(
            {'error': str(error)},
            status=400
        )


# ==========================================
# COMPANY PAGE
# ==========================================

def company_page(request, name):

    company = get_object_or_404(
        Company,
        name__icontains=name
    )

    vehicles = Vehicle.objects.filter(
        company=company
    ).order_by('-id')

    auctions = Auction.objects.filter(
        vehicle__company=company
    ).select_related(
        'vehicle'
    ).order_by('-current_price')

    total_vehicles = vehicles.count()

    highest_bid = (
        auctions.first().current_price
        if auctions.exists()
        else 0
    )

    return render(
        request,
        'marketplace/company.html',
        {
            'company': company,
            'vehicles': vehicles,
            'auctions': auctions,
            'total_vehicles': total_vehicles,
            'highest_bid': highest_bid,
        }
    )


# ==========================================
# LOGIN
# ==========================================

def login_page(request):

    if request.method == 'POST':

        username = request.POST.get('username')
        password = request.POST.get('password')

        user = authenticate(
            request,
            username=username,
            password=password
        )

        if user:
            login(request, user)
            return redirect('home')

    return render(
        request,
        'marketplace/login.html'
    )


# ==========================================
# MY BIDS
# ==========================================

def my_bids(request):

    bids = Bid.objects.select_related(
        'auction__vehicle__company'
    ).order_by('-bid_time')

    return render(
        request,
        'marketplace/my-bids.html',
        {
            'bids': bids
        }
    )


# ==========================================
# LOGOUT
# ==========================================

def logout_user(request):

    logout(request)

    return redirect('home')


# ==========================================
# URL COMPATIBILITY FUNCTIONS
# ==========================================

def place_bid(request):
    return place_bid_simple(request)


def company_vehicles(request, name):
    return company_page(request, name)


def login_view(request):
    return login_page(request)


def logout_view(request):
    return logout_user(request)


# ==========================================
# VEHICLE API VIEWSET
# ==========================================

class VehicleViewSet(viewsets.ModelViewSet):

    queryset = Vehicle.objects.all().order_by('-id')

    serializer_class = VehicleSerializer

    permission_classes = [AllowAny]


# ==========================================
# LIVE AUCTION LIST API
# ==========================================

class AuctionList(generics.ListCreateAPIView):

    serializer_class = AuctionSerializer

    permission_classes = [AllowAny]

    def get_queryset(self):

        return get_live_auctions()

    def create(self, request, *args, **kwargs):

        serializer = self.get_serializer(
            data=request.data
        )

        serializer.is_valid(raise_exception=True)

        auction = serializer.save()

        return Response(
            self.get_serializer(auction).data,
            status=status.HTTP_201_CREATED
        )


# ==========================================
# BID CREATE API
# ==========================================

class BidCreate(generics.CreateAPIView):

    queryset = Bid.objects.all()

    serializer_class = BidSerializer

    permission_classes = [AllowAny]

    authentication_classes = []

    def perform_create(self, serializer):

        auction_id = self.request.data.get('auction')

        bid_amount = self.request.data.get('bid_amount')

        bidder_name = self.request.data.get(
            'bidder_name',
            'USA Buyer'
        )

        if not auction_id:
            raise ValidationError(
                {'auction': 'Auction ID is required.'}
            )

        try:

            bid, auction = process_bid(
                auction_id,
                bid_amount,
                bidder_name
            )

        except ValueError as error:
            raise ValidationError(str(error))

        self.created_bid = bid

    def create(self, request, *args, **kwargs):

        self.perform_create(
            self.get_serializer()
        )

        serializer = self.get_serializer(
            self.created_bid
        )

        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED
        )
