from django.shortcuts import render, redirect, get_object_or_404
from rest_framework import viewsets, generics
from rest_framework.permissions import AllowAny
from.models import Vehicle, Auction, Bid, Company
from.serializers import VehicleSerializer, AuctionSerializer, BidSerializer
from django.db.models import Q, Count
from django.contrib.auth.models import User
from django.utils import timezone
from datetime import timedelta
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate, login, logout
import json

def home(request):
    query = request.GET.get('q', '')
    vehicles = Vehicle.objects.all().order_by('-id')
    if query:
        vehicles = vehicles.filter(Q(title__icontains=query) | Q(company__name__icontains=query) | Q(model_name__icontains=query) | Q(description__icontains=query))
    companies = Company.objects.annotate(vehicle_count=Count('vehicle')).order_by('-vehicle_count')[:8]
    return render(request, 'marketplace/home.html', {'vehicles': vehicles, 'query': query, 'companies': companies})

def add_vehicle(request):
    if request.method == 'POST':
        title = request.POST.get('title') or f"{request.POST.get('company')} {request.POST.get('model_name')}"
        company_name = request.POST.get('company', 'Other').strip() or "Other"
        model_name = request.POST.get('model_name', '')
        price = request.POST.get('price')
        year = request.POST.get('year')
        km_driven = request.POST.get('km_driven')
        description = request.POST.get('description', '')
        image = request.FILES.get('photo') or request.FILES.get('image')
        company_obj, created = Company.objects.get_or_create(name=company_name)
        if request.user.is_authenticated:
            owner = request.user
        else:
            owner = User.objects.first()
            if not owner:
                owner = User.objects.create_user(username='admin', password='admin123')
        vehicle = Vehicle.objects.create(title=title, company=company_obj, owner=owner, model_name=model_name, price=price, year=int(year) if year else 2020, km_driven=int(km_driven) if km_driven else 0, description=description, image=image, is_verified=True)
        Auction.objects.get_or_create(
            vehicle=vehicle,
            defaults={'base_price': vehicle.price, 'current_price': vehicle.price, 'end_time': timezone.now() + timedelta(days=7)}
        )
        return redirect('home')
    return render(request, 'marketplace/add.html')

def auction_page(request, id=None):
    if id:
        vehicle = get_object_or_404(Vehicle, id=id)
        auction, created = Auction.objects.get_or_create(
            vehicle=vehicle,
            defaults={'base_price': vehicle.price, 'current_price': vehicle.price, 'end_time': timezone.now() + timedelta(days=7)}
        )
        bids = Bid.objects.filter(auction=auction).order_by('-bid_amount')[:20]
        is_expired = auction.end_time < timezone.now()
        winner = bids.first() if is_expired and bids.exists() else None
        return render(request, 'marketplace/auction.html', {'vehicle': vehicle, 'auction': auction, 'bids': bids, 'winner': winner, 'is_expired': is_expired})
    else:
        auctions = Auction.objects.all().order_by('-id')
        return render(request, 'marketplace/auction.html', {'auctions': auctions})

def auction_detail(request, id):
    vehicle = get_object_or_404(Vehicle, id=id)
    auction, created = Auction.objects.get_or_create(
        vehicle=vehicle,
        defaults={'base_price': vehicle.price, 'current_price': vehicle.price, 'end_time': timezone.now() + timedelta(days=7)}
    )
    bids = Bid.objects.filter(auction=auction).order_by('-bid_amount')[:20]
    is_expired = auction.end_time < timezone.now()
    winner = bids.first() if is_expired and bids.exists() else None
    return render(request, 'marketplace/auction.html', {'vehicle': vehicle, 'auction': auction, 'bids': bids, 'winner': winner, 'is_expired': is_expired})

@csrf_exempt
def place_bid_simple(request):
    if request.method == 'POST':
        try:
            data = json.loads(request.body)
            auction_id = data.get('auction')
            bid_amount = data.get('bid_amount')
            bidder_name = data.get('bidder_name', 'USA Buyer')
            if request.user.is_authenticated:
                bidder_name = request.user.username
            auction = get_object_or_404(Auction, id=auction_id)
            if int(bid_amount) <= int(auction.current_price):
                # FIXED - $ USA
                return JsonResponse({'error': f'Your bid must be higher than ${auction.current_price}. Minimum required is ${int(auction.current_price)+1000}.'}, status=400)
            bid = Bid.objects.create(auction=auction, bidder_name=bidder_name, bid_amount=bid_amount)
            auction.current_price = bid_amount
            auction.save()
            return JsonResponse({'id': bid.id, 'success': True, 'new_price': str(auction.current_price)})
        except Exception as e:
            import traceback
            traceback.print_exc()
            return JsonResponse({'error': str(e)}, status=400)
    return JsonResponse({'error': 'Invalid request method'}, status=400)

def company_page(request, name):
    company = get_object_or_404(Company, name__icontains=name)
    vehicles = Vehicle.objects.filter(company=company).order_by('-id')
    auctions = Auction.objects.filter(vehicle__company=company).order_by('-current_price')
    total_vehicles = vehicles.count()
    highest_bid = auctions.first().current_price if auctions.exists() else 0
    return render(request, 'marketplace/company.html', {'company': company, 'vehicles': vehicles, 'auctions': auctions, 'total_vehicles': total_vehicles, 'highest_bid': highest_bid})

def login_page(request):
    if request.method == 'POST':
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)
        if user:
            login(request, user)
            return redirect('home')
        else:
            if not User.objects.filter(username=username).exists():
                user = User.objects.create_user(username=username, password=password)
                login(request, user)
                return redirect('home')
    return render(request, 'marketplace/login.html')
def my_bids(request):
    bids = Bid.objects.select_related('auction__vehicle__company').order_by('-bid_time')
    return render(request, 'marketplace/my-bids.html', {'bids': bids})

def logout_user(request):
    logout(request)
    return redirect('home')

def place_bid(request):
    return place_bid_simple(request)

def company_vehicles(request, name):
    return company_page(request, name)

def login_view(request):
    return login_page(request)

def logout_view(request):
    return logout_user(request)

class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all().order_by('-id')
    serializer_class = VehicleSerializer
    permission_classes = [AllowAny]

class AuctionList(generics.ListCreateAPIView):
    queryset = Auction.objects.all()
    serializer_class = AuctionSerializer
    permission_classes = [AllowAny]

class BidCreate(generics.CreateAPIView):
    queryset = Bid.objects.all()
    serializer_class = BidSerializer
    permission_classes = [AllowAny]
    authentication_classes = []
    def perform_create(self, serializer):
        bidder_name = self.request.data.get('bidder_name', 'USA Buyer')
        auction_id = self.request.data.get('auction')
        bid_amount = self.request.data.get('bid_amount')
        auction_obj = get_object_or_404(Auction, id=auction_id) if auction_id else None
        if auction_obj and int(bid_amount) <= int(auction_obj.current_price):
            from rest_framework.exceptions import ValidationError
            raise ValidationError(f"Bid must be higher than ${auction_obj.current_price}") # FIXED - $
        bid = serializer.save(bidder_name=bidder_name, auction=auction_obj)
        if bid.auction:
            bid.auction.current_price = bid.bid_amount
            bid.auction.save()
def auction_detail(request, id):
    auction = get_object_or_404(Auction, id=id)
    
    if request.method == 'POST':
        bid_amount = request.POST.get('bid_amount')
        if bid_amount:
            Bid.objects.create(
                auction=auction,
                bid_amount=bid_amount,
                bidder_name=request.user.username if request.user.is_authenticated else "Guest USA",
            )
            auction.current_price = bid_amount
            auction.save()
            return redirect('my-bids')  # direct my-bids var

    return render(request, 'marketplace/auction_detail.html', {'auction': auction})