
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from .models import Auction, Vehicle


# =====================================
# AUCTION CONFIGURATION
# =====================================

DEFAULT_AUCTION_DAYS = 7


# =====================================
# CREATE VEHICLE AUCTION
# =====================================

@transaction.atomic
def create_vehicle_auction(vehicle):
    """
    Create an auction for an approved, unsold vehicle.

    Rules:
    1. Pending or rejected vehicles cannot have new auctions.
    2. Sold vehicles cannot have new auctions.
    3. Existing live auction is reused.
    4. Expired auction is closed.
    5. A new auction is created after expiry.
    6. Previous auction records and bids are preserved.
    """

    # Lock and reload the vehicle inside the transaction.
    locked_vehicle = (
        Vehicle.objects
        .select_for_update()
        .get(pk=vehicle.pk)
    )

    if locked_vehicle.listing_status != 'APPROVED':
        return None

    if locked_vehicle.is_sold:
        return None

    now = timezone.now()

    # Get the latest auction for this vehicle.
    latest_auction = (
        Auction.objects
        .select_for_update()
        .filter(vehicle=locked_vehicle)
        .order_by('-id')
        .first()
    )

    # =====================================
    # EXISTING AUCTION CHECK
    # =====================================

    if latest_auction:

        # Existing auction has not expired.
        if latest_auction.end_time > now:

            # Reuse only if it is still active.
            if latest_auction.is_active:
                return latest_auction

            # Auction was manually closed before expiry.
            # Do not automatically reopen it.
            return None

        # =====================================
        # EXPIRED AUCTION
        # =====================================

        if latest_auction.is_active:
            latest_auction.is_active = False

            latest_auction.save(
                update_fields=['is_active']
            )

    # =====================================
    # CREATE NEW AUCTION
    # =====================================

    new_auction = Auction.objects.create(
        vehicle=locked_vehicle,
        base_price=locked_vehicle.price,
        current_price=locked_vehicle.price,
        end_time=now + timedelta(
            days=DEFAULT_AUCTION_DAYS
        ),
        is_active=True,
    )

    return new_auction


# =====================================
# CREATE MISSING / EXPIRED AUCTIONS
# =====================================

@transaction.atomic
def create_missing_vehicle_auctions():
    """
    Process all approved and unsold vehicles.

    - Vehicles without auctions get a new auction.
    - Vehicles with active auctions keep their existing auction.
    - Expired auctions are closed and a new auction is created.
    - Old bids and auction history are preserved.

    Returns the number of newly created auctions.
    """

    vehicles = (
        Vehicle.objects
        .filter(
            listing_status='APPROVED',
            is_sold=False,
        )
        .order_by('id')
    )

    created_count = 0

    for vehicle in vehicles:

        previous_count = Auction.objects.filter(
            vehicle=vehicle
        ).count()

        auction = create_vehicle_auction(vehicle)

        if auction:
            current_count = Auction.objects.filter(
                vehicle=vehicle
            ).count()

            if current_count > previous_count:
                created_count += 1

    return created_count
