from django.urls import path
from . import views
from .api_views import VehicleListAPI, AuctionListAPI, CompanyListAPI, TicketCreateAPI, BidCreateAPI
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('', views.home, name='home'),
    
    path('auctions/', views.auction_page, name='auctions'),
path('auctions/<int:id>/', views.auction_page, name='auction-detail'),
    path('place-bid/', views.place_bid_simple, name='place-bid'),
    path('my-bids/', views.my_bids, name='my-bids'),
    path('add/', views.add_vehicle, name='add-vehicle'),
    path('company/<str:name>/', views.company_page, name='company-vehicles'),
    path('login/', views.login_page, name='login'),
    path('logout/', views.logout_user, name='logout'),

    # Company Level APIs
    path('api/vehicles/', VehicleListAPI.as_view(), name='api-vehicles'),
    path('api/auctions/', AuctionListAPI.as_view(), name='api-auctions'),
    path('api/companies/', CompanyListAPI.as_view(), name='api-companies'),
    path('api/tickets/', TicketCreateAPI.as_view(), name='api-tickets'),
    path('api/bids/', BidCreateAPI.as_view(), name='api-bids'),
   path('auction/<int:id>/', views.auction_detail, name='auction-detail'),
]
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)