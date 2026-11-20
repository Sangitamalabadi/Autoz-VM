from django.db import models
from django.contrib.auth.models import User
from django.core.validators import MinValueValidator, MaxValueValidator


# =====================================
# COMPANY MODEL
# =====================================

class Company(models.Model):

    name = models.CharField(
        max_length=100,
        unique=True
    )

    def __str__(self):
        return self.name


# =====================================
# VEHICLE MODEL
# =====================================

class Vehicle(models.Model):

    CATEGORY = [
        ('Car', 'Car'),
        ('Bike', 'Bike'),
        ('Truck', 'Truck'),
    ]

    OWNER_CHOICES = [
        ('1st Owner', '1st Owner'),
        ('2nd Owner', '2nd Owner'),
        ('3rd Owner', '3rd Owner'),
        ('Single Owner', 'Single Owner - USA Clean Title'),
        ('2 Owners', '2 Owners - US'),
    ]

    LISTING_STATUS = [
        ('PENDING', 'Pending Approval'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
    ]

    # =====================================
    # BASIC VEHICLE INFORMATION
    # =====================================

    title = models.CharField(
        max_length=200
    )

    company = models.ForeignKey(
        Company,
        on_delete=models.PROTECT,
        related_name='vehicles'
    )

    model_name = models.CharField(
        max_length=100
    )

    price = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0.01)]
    )

    year = models.IntegerField(
        validators=[
            MinValueValidator(1900),
            MaxValueValidator(2100)
        ]
    )

    # Retained for existing database compatibility.
    # Frontend converts kilometers into miles for display.
    km_driven = models.IntegerField(
        validators=[MinValueValidator(0)]
    )

    category = models.CharField(
        max_length=20,
        choices=CATEGORY
    )

    description = models.TextField()

    # =====================================
    # VEHICLE PICKUP LOCATION
    # =====================================

    street_address = models.CharField(
        max_length=255,
        blank=True,
        default=''
    )

    city = models.CharField(
        max_length=100,
        blank=True,
        default=''
    )

    state = models.CharField(
        max_length=100,
        blank=True,
        default=''
    )

    postal_code = models.CharField(
        max_length=20,
        blank=True,
        default=''
    )

    country = models.CharField(
        max_length=100,
        blank=True,
        default=''
    )

    # =====================================
    # VEHICLE IMAGE
    # =====================================

    image = models.ImageField(
        upload_to='vehicles/gallery/',
        max_length=500
    )

    # =====================================
    # VEHICLE OWNERSHIP
    # =====================================

    owner = models.CharField(
        max_length=50,
        choices=OWNER_CHOICES,
        default='1st Owner'
    )

    # =====================================
    # SELLER INFORMATION
    # =====================================

    seller = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='vehicle_listings'
    )

    # =====================================
    # ADMIN LISTING APPROVAL
    # =====================================

    listing_status = models.CharField(
        max_length=20,
        choices=LISTING_STATUS,
        default='PENDING'
    )

    rejection_reason = models.TextField(
        blank=True,
        default=''
    )

    # =====================================
    # VEHICLE VERIFICATION
    # =====================================

    is_verified = models.BooleanField(
        default=False
    )

    # =====================================
    # VEHICLE SALE STATUS
    # =====================================

    is_sold = models.BooleanField(
        default=False
    )

    # =====================================
    # TIMESTAMPS
    # =====================================

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    updated_at = models.DateTimeField(
        auto_now=True
    )

    # =====================================
    # HELPER PROPERTY
    # =====================================

    @property
    def company_name(self):
        return self.company.name

    def __str__(self):
        return self.title


# =====================================
# ADDITIONAL VEHICLE IMAGE GALLERY
# =====================================

class VehicleImage(models.Model):

    vehicle = models.ForeignKey(
        Vehicle,
        on_delete=models.CASCADE,
        related_name='additional_images'
    )

    image = models.ImageField(
        upload_to='vehicles/gallery/',
        max_length=500
    )

    uploaded_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"Image - {self.vehicle.title}"


# =====================================
# AUCTION MODEL
# =====================================

class Auction(models.Model):

    vehicle = models.ForeignKey(
        Vehicle,
        on_delete=models.CASCADE,
        related_name='auctions'
    )

    base_price = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    current_price = models.DecimalField(
        max_digits=10,
        decimal_places=2
    )

    end_time = models.DateTimeField()

    is_active = models.BooleanField(
        default=True
    )

    def __str__(self):
        return f"Auction - {self.vehicle.title}"


# =====================================
# BID MODEL
# =====================================

class Bid(models.Model):

    auction = models.ForeignKey(
        Auction,
        on_delete=models.CASCADE,
        related_name='bids'
    )

    # Actual Buyer account associated with the bid.
    # Nullable to preserve old bid records and support guest bids.
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='vehicle_bids'
    )

    # Display name (also supports guest bidding).
    bidder_name = models.CharField(
        max_length=100
    )

    bid_amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[
            MinValueValidator(0.01)
        ]
    )

    bid_time = models.DateTimeField(
        auto_now_add=True
    )

    @property
    def is_highest_bid(self):
        return not self.auction.bids.filter(
            bid_amount__gt=self.bid_amount
        ).exists()

    @property
    def is_outbid(self):
        return self.auction.bids.filter(
            bid_amount__gt=self.bid_amount
        ).exists()

    def __str__(self):
        return f"{self.bidder_name} - ${self.bid_amount}"


# =====================================
# VEHICLE VERIFICATION MODEL
# =====================================

class VehicleVerification(models.Model):

    vehicle = models.OneToOneField(
        Vehicle,
        on_delete=models.CASCADE,
        related_name='verification'
    )

    engine_check = models.BooleanField(
        default=True,
        verbose_name="Engine OK?"
    )

    paper_check = models.BooleanField(
        default=True,
        verbose_name="Papers OK?"
    )

    accident_history = models.BooleanField(
        default=False,
        verbose_name="Accident?"
    )

    odometer_verified = models.BooleanField(
        default=True
    )

    is_verified = models.BooleanField(
        default=True
    )

    def __str__(self):
        status = 'Verified' if self.is_verified else 'Pending'
        return f"{self.vehicle.title} - {status}"


# =====================================
# SUPPORT TICKET MODEL
# =====================================

class Ticket(models.Model):

    ISSUE_CHOICES = [
        ('FRAUD', 'Fraud / Fake Vehicle'),
        ('PAYMENT', 'Payment Issue'),
        ('VEHICLE', 'Vehicle Not As Described'),
        ('OTHER', 'Other'),
    ]

    STATUS_CHOICES = [
        ('OPEN', 'Open'),
        ('SOLVED', 'Solved'),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        null=True,
        blank=True
    )

    vehicle = models.ForeignKey(
        Vehicle,
        on_delete=models.CASCADE
    )

    issue_type = models.CharField(
        max_length=20,
        choices=ISSUE_CHOICES
    )

    message = models.TextField()

    status = models.CharField(
        max_length=20,
        default='OPEN',
        choices=STATUS_CHOICES
    )

    created_at = models.DateTimeField(
        auto_now_add=True
    )

    def __str__(self):
        return f"Ticket #{self.id} - {self.vehicle.title} - {self.status}"