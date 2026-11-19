
from django.core.management.base import BaseCommand
from django.utils import timezone

from marketplace.services import create_missing_vehicle_auctions


class Command(BaseCommand):
    help = (
        'Automatically create auctions for approved unsold vehicles '
        'and renew expired auctions.'
    )

    def handle(self, *args, **options):

        self.stdout.write(
            self.style.NOTICE(
                f'[{timezone.now()}] Starting auction renewal...'
            )
        )

        try:
            created_count = create_missing_vehicle_auctions()

            self.stdout.write(
                self.style.SUCCESS(
                    f'Successfully created {created_count} new auction(s).'
                )
            )

        except Exception as error:
            self.stderr.write(
                self.style.ERROR(
                    f'Auction renewal failed: {error}'
                )
            )
            raise

        self.stdout.write(
            self.style.SUCCESS('Auction renewal process completed.')
        )
