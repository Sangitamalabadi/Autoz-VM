
from django.db.models.signals import post_save
from django.dispatch import receiver

from .models import Vehicle
from .services import create_vehicle_auction


@receiver(post_save, sender=Vehicle)
def automatically_create_vehicle_auction(
    sender,
    instance,
    created,
    **kwargs
):
    """
    Create the first auction when a vehicle
    becomes approved and is not sold.

    Recurring auctions are handled separately
    by the scheduled auction renewal task.
    """

    if (
        instance.listing_status == 'APPROVED'
        and not instance.is_sold
    ):
        create_vehicle_auction(instance)
