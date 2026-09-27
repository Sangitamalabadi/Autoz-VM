from django.db import models
from django.contrib.auth.models import User

class Company(models.Model):
    name = models.CharField(max_length=100)
    def __str__(self):
        return self.name

class Vehicle(models.Model):
    CATEGORY = [('Car','Car'),('Bike','Bike'),('Truck','Truck')]
    
    OWNER_CHOICES = [
        ('1st Owner', '1st Owner'),
        ('2nd Owner', '2nd Owner'),
        ('3rd Owner', '3rd Owner'),
        ('Single Owner', 'Single Owner - USA Clean Title'),
        ('2 Owners', '2 Owners - US'),
    ]

    title = models.CharField(max_length=200)
    company = models.ForeignKey(Company, on_delete=models.CASCADE)
    model_name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=10, decimal_places=2)
    year = models.IntegerField()
    km_driven = models.IntegerField()
    category = models.CharField(max_length=20, choices=CATEGORY)
    description = models.TextField()
    image = models.ImageField(upload_to='vehicles/')
    # owner chya jagi ata dropdown yeil
    owner = models.CharField(max_length=50, choices=OWNER_CHOICES, default='1st Owner')
    is_verified = models.BooleanField(default=False)
    is_sold = models.BooleanField(default=False)
    
    @property
    def company_name(self):
        return self.company.name

    def __str__(self):
        return self.title

class Auction(models.Model):
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE)
    base_price = models.DecimalField(max_digits=10, decimal_places=2)
    current_price = models.DecimalField(max_digits=10, decimal_places=2)
    end_time = models.DateTimeField()
    is_active = models.BooleanField(default=True)

class Bid(models.Model):
    auction = models.ForeignKey(Auction, on_delete=models.CASCADE, related_name='bids')
    bidder_name = models.CharField(max_length=100)
    bid_amount = models.DecimalField(max_digits=10, decimal_places=2)
    bid_time = models.DateTimeField(auto_now_add=True)

class VehicleVerification(models.Model):
    vehicle = models.OneToOneField(Vehicle, on_delete=models.CASCADE, related_name='verification')
    engine_check = models.BooleanField(default=True, verbose_name="Engine OK?")
    paper_check = models.BooleanField(default=True, verbose_name="Papers OK?")
    accident_history = models.BooleanField(default=False, verbose_name="Accident?")
    odometer_verified = models.BooleanField(default=True)
    is_verified = models.BooleanField(default=True)
    
    def __str__(self):
        return f"{self.vehicle.title} - {'Verified' if self.is_verified else 'Pending'}"

class Ticket(models.Model):
    ISSUE_CHOICES = [
        ('FRAUD', 'Fraud / Fake Vehicle'),
        ('PAYMENT', 'Payment Issue'),
        ('VEHICLE', 'Vehicle Not As Described'),
        ('OTHER', 'Other'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True)
    vehicle = models.ForeignKey(Vehicle, on_delete=models.CASCADE)
    issue_type = models.CharField(max_length=20, choices=ISSUE_CHOICES)
    message = models.TextField()
    status = models.CharField(max_length=20, default='OPEN', choices=[('OPEN','Open'),('SOLVED','Solved')])
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Ticket #{self.id} - {self.vehicle.title} - {self.status}"