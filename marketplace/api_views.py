from rest_framework import generics, permissions
from .models import Vehicle, Auction, Company, Ticket, Bid
from .serializers import VehicleSerializer, AuctionSerializer, CompanySerializer, TicketSerializer, BidSerializer

# COMPANY LEVEL API
class VehicleListAPI(generics.ListAPIView):
    queryset = Vehicle.objects.all().order_by('-id')
    serializer_class = VehicleSerializer

class AuctionListAPI(generics.ListAPIView):
    queryset = Auction.objects.all().order_by('-id')
    serializer_class = AuctionSerializer

class CompanyListAPI(generics.ListAPIView):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer

class TicketCreateAPI(generics.CreateAPIView):
    queryset = Ticket.objects.all()
    serializer_class = TicketSerializer
    permission_classes = [permissions.AllowAny]

class BidCreateAPI(generics.CreateAPIView):
    queryset = Bid.objects.all()
    serializer_class = BidSerializer