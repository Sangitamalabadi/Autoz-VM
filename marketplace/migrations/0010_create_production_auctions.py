from datetime import timedelta

from django.db import migrations
from django.utils import timezone


def create_auctions(apps, schema_editor):
    Vehicle = apps.get_model('marketplace', 'Vehicle')
    Auction = apps.get_model('marketplace', 'Auction')

    now = timezone.now()

    vehicles = Vehicle.objects.filter(
        listing_status='APPROVED',
        is_sold=False
    )

    created_count = 0

    for vehicle in vehicles:

        existing_auction = Auction.objects.filter(
            vehicle=vehicle,
            is_active=True,
            end_time__gt=now
        ).exists()

        if existing_auction:
            continue

        Auction.objects.create(
            vehicle=vehicle,
            base_price=vehicle.price,
            current_price=vehicle.price,
            end_time=now + timedelta(days=7),
            is_active=True
        )

        created_count += 1

    print(f'Created {created_count} production auctions.')


class Migration(migrations.Migration):

    dependencies = [
        ('marketplace', '0009_add_production_vehicles'),
    ]

    operations = [
        migrations.RunPython(
            create_auctions,
            migrations.RunPython.noop
        ),
    ]