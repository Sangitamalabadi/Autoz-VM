from rest_framework import serializers
from .models import Vehicle, Company, Auction, Bid, Ticket

class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = '__all__'

class VehicleSerializer(serializers.ModelSerializer):
    company_name = serializers.CharField(source='company.name', read_only=True)
    class Meta:
        model = Vehicle
        fields = ['id', 'title', 'price', 'image', 'company', 'company_name', 'is_verified', 'is_sold', 'km_driven', 'year']

class AuctionSerializer(serializers.ModelSerializer):
    vehicle = VehicleSerializer(read_only=True)
    class Meta:
        model = Auction
        fields = '__all__'

class BidSerializer(serializers.ModelSerializer):
    class Meta:
        model = Bid
        fields = '__all__'

class TicketSerializer(serializers.ModelSerializer):
    class Meta:
        model = Ticket
        fields = '__all__'