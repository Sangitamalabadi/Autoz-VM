
from django.contrib import admin
from django.utils.html import format_html

from .models import (
    Company,
    Vehicle,
    VehicleImage,
    Auction,
    Bid,
    VehicleVerification,
    Ticket,
)

from .services import create_vehicle_auction


# =====================================
# COMPANY ADMIN
# =====================================

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):

    list_display = ('id', 'name')
    search_fields = ('name',)
    ordering = ('name',)


# =====================================
# VEHICLE IMAGE INLINE
# =====================================

class VehicleImageInline(admin.TabularInline):

    model = VehicleImage
    extra = 1

    fields = ('image', 'image_preview', 'uploaded_at')

    readonly_fields = ('image_preview', 'uploaded_at')

    def image_preview(self, obj):

        if obj and obj.image:
            return format_html(
                '<img src="{}" width="100" height="70" '
                'style="object-fit:cover;border-radius:6px;" />',
                obj.image.url
            )

        return "No Image"

    image_preview.short_description = "Preview"


# =====================================
# VEHICLE ADMIN
# =====================================

@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):

    list_display = (
        'id',
        'title',
        'company',
        'model_name',
        'seller',
        'price',
        'year',
        'listing_status',
        'auction_status',
        'is_verified',
        'is_sold',
        'created_at',
    )

    list_filter = (
        'listing_status',
        'category',
        'company',
        'is_verified',
        'is_sold',
        'created_at',
    )

    search_fields = (
        'title',
        'model_name',
        'company__name',
        'seller__username',
        'description',
    )

    ordering = ('-created_at',)
    list_per_page = 25

    inlines = [VehicleImageInline]

    readonly_fields = (
        'created_at',
        'updated_at',
        'main_image_preview',
    )

    fieldsets = (
        ('Vehicle Information', {
            'fields': (
                'title',
                'company',
                'model_name',
                'category',
                'year',
                'price',
                'km_driven',
                'owner',
                'description',
                'image',
                'main_image_preview',
            )
        }),

        ('Seller Information', {
            'fields': ('seller',)
        }),

        ('Approval & Verification', {
            'fields': (
                'listing_status',
                'rejection_reason',
                'is_verified',
                'is_sold',
            )
        }),

        ('Timestamps', {
            'fields': (
                'created_at',
                'updated_at',
            )
        }),
    )

    actions = (
        'approve_selected_vehicles',
        'reject_selected_vehicles',
    )

    @admin.display(description='Main Image')
    def main_image_preview(self, obj):

        if obj and obj.image:
            return format_html(
                '<img src="{}" width="160" height="110" '
                'style="object-fit:cover;border-radius:8px;" />',
                obj.image.url
            )

        return "No Image"

    @admin.display(description='Auction Status')
    def auction_status(self, obj):

        auction = obj.auctions.order_by('-id').first()

        if auction is None:
            return "No Auction"

        if not auction.is_active:
            return "Inactive"

        from django.utils import timezone

        if auction.end_time <= timezone.now():
            return "Expired"

        return "Live"

    # =================================
    # APPROVE VEHICLES + CREATE AUCTIONS
    # =================================

    @admin.action(
        description='Approve selected vehicles and create auctions'
    )
    def approve_selected_vehicles(self, request, queryset):

        approved_count = 0
        auction_count = 0

        for vehicle in queryset:

            vehicle.listing_status = 'APPROVED'
            vehicle.rejection_reason = ''

            vehicle.save(
                update_fields=[
                    'listing_status',
                    'rejection_reason',
                    'updated_at',
                ]
            )

            approved_count += 1

            auction = create_vehicle_auction(vehicle)

            if auction:
                auction_count += 1

        self.message_user(
            request,
            (
                f'{approved_count} vehicle(s) approved successfully. '
                f'{auction_count} auction(s) available or created.'
            )
        )

    # =================================
    # REJECT VEHICLES
    # =================================

    @admin.action(description='Reject selected vehicles')
    def reject_selected_vehicles(self, request, queryset):

        updated = queryset.update(
            listing_status='REJECTED'
        )

        self.message_user(
            request,
            f'{updated} vehicle(s) rejected successfully.'
        )


# =====================================
# VEHICLE IMAGE ADMIN
# =====================================

@admin.register(VehicleImage)
class VehicleImageAdmin(admin.ModelAdmin):

    list_display = (
        'id',
        'vehicle',
        'image_preview',
        'uploaded_at',
    )

    search_fields = (
        'vehicle__title',
        'vehicle__company__name',
    )

    list_filter = ('uploaded_at',)

    readonly_fields = (
        'image_preview',
        'uploaded_at',
    )

    @admin.display(description='Image Preview')
    def image_preview(self, obj):

        if obj and obj.image:
            return format_html(
                '<img src="{}" width="120" height="80" '
                'style="object-fit:cover;border-radius:6px;" />',
                obj.image.url
            )

        return "No Image"


# =====================================
# AUCTION ADMIN
# =====================================

@admin.register(Auction)
class AuctionAdmin(admin.ModelAdmin):

    list_display = (
        'id',
        'vehicle',
        'base_price',
        'current_price',
        'end_time',
        'is_active',
        'total_bids',
    )

    list_filter = (
        'is_active',
        'end_time',
    )

    search_fields = (
        'vehicle__title',
        'vehicle__company__name',
    )

    ordering = ('-id',)

    @admin.display(description='Total Bids')
    def total_bids(self, obj):
        return obj.bids.count()


# =====================================
# BID ADMIN
# =====================================

@admin.register(Bid)
class BidAdmin(admin.ModelAdmin):

    list_display = (
        'id',
        'auction',
        'user',
        'bidder_name',
        'bid_amount',
        'bid_time',
    )

    list_filter = ('bid_time',)

    search_fields = (
        'bidder_name',
        'user__username',
        'auction__vehicle__title',
    )

    ordering = ('-bid_time',)

    readonly_fields = ('bid_time',)


# =====================================
# VEHICLE VERIFICATION ADMIN
# =====================================

@admin.register(VehicleVerification)
class VerificationAdmin(admin.ModelAdmin):

    list_display = (
        'vehicle',
        'engine_check',
        'paper_check',
        'accident_history',
        'odometer_verified',
        'is_verified',
    )

    list_filter = (
        'is_verified',
        'accident_history',
        'engine_check',
        'paper_check',
    )

    search_fields = (
        'vehicle__title',
        'vehicle__company__name',
    )


# =====================================
# SUPPORT TICKET ADMIN
# =====================================

@admin.register(Ticket)
class TicketAdmin(admin.ModelAdmin):

    list_display = (
        'id',
        'user',
        'vehicle',
        'issue_type',
        'status',
        'created_at',
    )

    list_filter = (
        'issue_type',
        'status',
        'created_at',
    )

    search_fields = (
        'vehicle__title',
        'user__username',
        'message',
    )

    ordering = ('-created_at',)
