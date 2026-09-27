from django.contrib import admin
from .models import Company, Vehicle, Auction, Bid

from .models import Vehicle, Auction, Bid, VehicleVerification
from .models import Ticket
admin.site.register(Ticket)
admin.site.register(Company)
admin.site.register(Vehicle)
admin.site.register(Auction)
admin.site.register(Bid)


@admin.register(VehicleVerification)
class VerificationAdmin(admin.ModelAdmin):
    list_display = ('vehicle', 'engine_check', 'paper_check', 'is_verified')
    list_filter = ('is_verified',)