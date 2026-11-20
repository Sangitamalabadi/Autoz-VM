
from decimal import Decimal

from django.db import transaction
from django.utils import timezone

from rest_framework import serializers

from .models import (
    Vehicle,
    VehicleImage,
    Company,
    Auction,
    Bid,
    Ticket,
)


# ==========================================
# COMPANY SERIALIZER
# ==========================================

class CompanySerializer(serializers.ModelSerializer):

    class Meta:
        model = Company
        fields = '__all__'


# ==========================================
# VEHICLE IMAGE SERIALIZER
# ==========================================
# ==========================================
# VEHICLE IMAGE SERIALIZER
# ==========================================

class VehicleImageSerializer(serializers.ModelSerializer):

    class Meta:
        model = VehicleImage  # ✅ Correct model

        fields = [
            'id',
            'image',
            'uploaded_at',
        ]

        read_only_fields = [
            'id',
            'uploaded_at',
        ]

# ==========================================
# VEHICLE SERIALIZER
# ==========================================

class VehicleSerializer(serializers.ModelSerializer):

    company_name = serializers.CharField(
        source='company.name',
        read_only=True
    )

    seller_username = serializers.CharField(
        source='seller.username',
        read_only=True,
        allow_null=True
    )

    additional_images = VehicleImageSerializer(
        many=True,
        read_only=True
    )

    class Meta:
        model = Vehicle

        fields = [
            'id',
            'title',
            'company',
            'company_name',
            'model_name',
            'price',
            'image',
            'additional_images',
            'year',
            'km_driven',
            'category',
            'description',
            'owner',

            # Pickup Location
            'street_address',
            'city',
            'state',
            'postal_code',
            'country',

            # Seller Information
            'seller',
            'seller_username',

            # Listing Status
            'listing_status',
            'rejection_reason',

            # Verification & Sale
            'is_verified',
            'is_sold',

            # Timestamps
            'created_at',
            'updated_at',
        ]

        read_only_fields = [
            'id',
            'seller',
            'seller_username',
            'listing_status',
            'rejection_reason',
            'is_verified',
            'is_sold',
            'created_at',
            'updated_at',
        ]


# ==========================================
# VEHICLE CREATE / UPDATE SERIALIZER
# ==========================================

class VehicleCreateSerializer(serializers.ModelSerializer):

    images = serializers.ListField(
        child=serializers.ImageField(),
        required=False,
        write_only=True,
        allow_empty=True,
    )

    class Meta:
        model = Vehicle

        fields = [
            'title',
            'company',
            'model_name',
            'price',
            'image',
            'images',
            'year',
            'km_driven',
            'category',
            'description',
            'owner',

            # Pickup Location
            'street_address',
            'city',
            'state',
            'postal_code',
            'country',
        ]

    # --------------------------------------
    # IMAGE COUNT VALIDATION
    # --------------------------------------

    def validate(self, attrs):

        main_image = attrs.get('image')
        additional_images = attrs.get('images', [])

        total_images = (
            (1 if main_image else 0)
            + len(additional_images)
        )

        # During update, existing main image may be retained.
        if self.instance:
            existing_main_image = bool(
                self.instance.image
            )

            if not main_image and existing_main_image:
                total_images = (
                    1 + len(additional_images)
                )

        if total_images > 15:
            raise serializers.ValidationError({
                'images': (
                    'You can upload a maximum of 15 images '
                    'including the main vehicle image.'
                )
            })

        if not self.instance and total_images < 1:
            raise serializers.ValidationError({
                'image': 'At least one vehicle image is required.'
            })

        return attrs

    # --------------------------------------
    # CREATE VEHICLE + GALLERY
    # --------------------------------------

    @transaction.atomic
    def create(self, validated_data):

        additional_images = validated_data.pop(
            'images',
            []
        )

        vehicle = Vehicle.objects.create(
            **validated_data
        )

        gallery_objects = [
            VehicleImage(
                vehicle=vehicle,
                image=image
            )
            for image in additional_images
        ]

        if gallery_objects:
            VehicleImage.objects.bulk_create(
                gallery_objects
            )

        return vehicle

    # --------------------------------------
    # UPDATE VEHICLE + GALLERY
    # --------------------------------------

    @transaction.atomic
    def update(self, instance, validated_data):

        additional_images = validated_data.pop(
            'images',
            None
        )

        # Update vehicle fields including location.
        for field, value in validated_data.items():
            setattr(instance, field, value)

        instance.save()

        # If new additional images are provided,
        # append them to the existing gallery.
        if additional_images:
            gallery_objects = [
                VehicleImage(
                    vehicle=instance,
                    image=image
                )
                for image in additional_images
            ]

            VehicleImage.objects.bulk_create(
                gallery_objects
            )

        return instance


# ==========================================
# BID SERIALIZER
# ==========================================

class BidSerializer(serializers.ModelSerializer):

    user = serializers.PrimaryKeyRelatedField(
        read_only=True
    )

    username = serializers.CharField(
        source='user.username',
        read_only=True,
        allow_null=True
    )

    # BUYER MY BIDS - VEHICLE DETAILS

    vehicle_title = serializers.CharField(
        source='auction.vehicle.title',
        read_only=True
    )

    vehicle_image = serializers.ImageField(
        source='auction.vehicle.image',
        read_only=True
    )

    # BUYER MY BIDS - VEHICLE ID

    vehicle_id = serializers.IntegerField(
        source='auction.vehicle.id',
        read_only=True
    )

    is_highest_bid = serializers.SerializerMethodField()

    is_outbid = serializers.SerializerMethodField()

    class Meta:
        model = Bid

        fields = [
            'id',
            'auction',
            'user',
            'username',
            'vehicle_title',
            'vehicle_image',
            'vehicle_id',
            'bidder_name',
            'bid_amount',
            'bid_time',
            'is_highest_bid',
            'is_outbid',
        ]

        read_only_fields = [
            'id',
            'user',
            'username',
            'vehicle_title',
            'vehicle_image',
            'vehicle_id',
            'bid_time',
            'is_highest_bid',
            'is_outbid',
        ]

        extra_kwargs = {
            'bidder_name': {
                'required': False,
                'allow_blank': True,
            }
        }

    def validate_bidder_name(self, value):
        return value.strip()

    def validate_bid_amount(self, value):

        if value <= Decimal('0.00'):
            raise serializers.ValidationError(
                'Bid amount must be greater than zero.'
            )

        return value

    def validate(self, attrs):

        auction = attrs.get('auction')
        bid_amount = attrs.get('bid_amount')

        if not auction:
            raise serializers.ValidationError({
                'auction': 'Auction is required.'
            })

        if auction.end_time <= timezone.now():
            raise serializers.ValidationError(
                'This auction has already closed.'
            )

        if not auction.is_active:
            raise serializers.ValidationError(
                'This auction is not active.'
            )

        if auction.vehicle.is_sold:
            raise serializers.ValidationError(
                'This vehicle has already been sold.'
            )

        vehicle_status = str(
            auction.vehicle.listing_status
        ).strip().upper()

        if vehicle_status != 'APPROVED':
            raise serializers.ValidationError(
                'This vehicle is not approved for auction.'
            )

        minimum_bid = (
            auction.current_price + Decimal('1000.00')
        )

        if bid_amount < minimum_bid:
            raise serializers.ValidationError({
                'bid_amount': (
                    f'Minimum bid amount is ${minimum_bid}. '
                    f'Current highest bid is '
                    f'${auction.current_price}.'
                )
            })

        return attrs

    def create(self, validated_data):

        request = self.context.get('request')

        authenticated_user = None

        if request and request.user.is_authenticated:
            authenticated_user = request.user

        bidder_name = validated_data.get(
            'bidder_name', ''
        ).strip()

        if authenticated_user:
            bidder_name = authenticated_user.username

        if not bidder_name:
            raise serializers.ValidationError({
                'bidder_name': 'Bidder name is required.'
            })

        validated_data['bidder_name'] = bidder_name
        validated_data['user'] = authenticated_user

        bid = Bid.objects.create(**validated_data)

        auction = bid.auction
        auction.current_price = bid.bid_amount

        auction.save(
            update_fields=['current_price']
        )

        return bid

    def get_is_highest_bid(self, obj):

        highest_bid = obj.auction.bids.order_by(
            '-bid_amount',
            '-bid_time',
            '-id'
        ).first()

        return (
            highest_bid is not None
            and highest_bid.id == obj.id
        )

    def get_is_outbid(self, obj):

        highest_bid = obj.auction.bids.order_by(
            '-bid_amount',
            '-bid_time',
            '-id'
        ).first()

        return (
            highest_bid is not None
            and highest_bid.id != obj.id
        )


# ==========================================
# ADMIN ALL BIDS SERIALIZER
# ==========================================

class AdminBidSerializer(BidSerializer):

    auction_id = serializers.IntegerField(
        source='auction.id',
        read_only=True
    )

    vehicle_title = serializers.CharField(
        source='auction.vehicle.title',
        read_only=True
    )

    company_name = serializers.CharField(
        source='auction.vehicle.company.name',
        read_only=True
    )

    class Meta(BidSerializer.Meta):

        fields = BidSerializer.Meta.fields + [
            'auction_id',
            'vehicle_title',
            'company_name',
        ]

        read_only_fields = fields


# ==========================================
# AUCTION SERIALIZER
# ==========================================

class AuctionSerializer(serializers.ModelSerializer):

    vehicle = VehicleSerializer(read_only=True)

    bids = BidSerializer(
        many=True,
        read_only=True
    )

    bid_count = serializers.SerializerMethodField()

    is_expired = serializers.SerializerMethodField()

    is_closed = serializers.SerializerMethodField()

    highest_bidder = serializers.SerializerMethodField()

    highest_bidder_user_id = serializers.SerializerMethodField()

    class Meta:
        model = Auction

        fields = [
            'id',
            'vehicle',
            'base_price',
            'current_price',
            'end_time',
            'is_active',
            'is_expired',
            'is_closed',
            'bid_count',
            'highest_bidder',
            'highest_bidder_user_id',
            'bids',
        ]

    def get_bid_count(self, obj):
        return obj.bids.count()

    def get_is_expired(self, obj):
        return obj.end_time <= timezone.now()

    def get_is_closed(self, obj):

        return (
            not obj.is_active
            or obj.end_time <= timezone.now()
            or obj.vehicle.is_sold
        )

    def get_highest_bidder(self, obj):

        highest_bid = obj.bids.select_related(
            'user'
        ).order_by(
            '-bid_amount',
            '-bid_time',
            '-id'
        ).first()

        if highest_bid:

            if highest_bid.user:
                return highest_bid.user.username

            return highest_bid.bidder_name

        return None

    def get_highest_bidder_user_id(self, obj):

        highest_bid = obj.bids.order_by(
            '-bid_amount',
            '-bid_time',
            '-id'
        ).first()

        if highest_bid and highest_bid.user_id:
            return highest_bid.user_id

        return None


# ==========================================
# TICKET SERIALIZER
# ==========================================

class TicketSerializer(serializers.ModelSerializer):

    vehicle_title = serializers.CharField(
        source='vehicle.title',
        read_only=True
    )

    class Meta:
        model = Ticket

        fields = [
            'id',
            'user',
            'vehicle',
            'vehicle_title',
            'issue_type',
            'message',
            'status',
            'created_at',
        ]

        read_only_fields = [
            'id',
            'user',
            'status',
            'created_at',
        ]

    def validate_message(self, value):

        value = value.strip()

        if not value:
            raise serializers.ValidationError(
                'Please provide a description of the issue.'
            )

        return value
