
from django.urls import path

from . import views

from .api_views import (
    # =====================================
    # AUTHENTICATION APIs
    # =====================================
    csrf_cookie_api,
    admin_login_api,
    seller_register_api,
    seller_login_api,
    seller_logout_api,
    seller_me_api,

    # =====================================
    # BUYER AUTHENTICATION APIs
    # =====================================
    buyer_register_api,
    buyer_login_api,
    buyer_logout_api,
    buyer_me_api,

    # =====================================
    # VEHICLE APIs
    # =====================================
    VehicleListAPI,
    VehicleDetailAPI,
    VehicleCreateAPI,
    SellerVehicleListAPI,
    SellerVehicleUpdateAPI,
    SellerVehicleDeleteAPI,
    SellerVehicleImageUploadAPI,
    SellerVehicleImageDeleteAPI,

    # =====================================
    # AUCTION APIs
    # =====================================
    AuctionListAPI,
    AuctionDetailAPI,
    AuctionBidHistoryAPI,

    # =====================================
    # COMPANY API
    # =====================================
    CompanyListAPI,

    # =====================================
    # TICKET API
    # =====================================
    TicketCreateAPI,

    # =====================================
    # BID APIs
    # =====================================
    BidCreateAPI,
    BuyerMyBidsAPI,
    AdminBidListAPI,
)


urlpatterns = [

    # =====================================
    # EXISTING DJANGO HTML ROUTES
    # =====================================

    path(
        '',
        views.home,
        name='home'
    ),

    path(
        'auctions/',
        views.auction_page,
        name='auctions'
    ),

    path(
        'auctions/<int:id>/',
        views.auction_page,
        name='auction-page-detail'
    ),

    path(
        'place-bid/',
        views.place_bid_simple,
        name='place-bid'
    ),

    path(
        'my-bids/',
        views.my_bids,
        name='my-bids'
    ),

    path(
        'add/',
        views.add_vehicle,
        name='add-vehicle'
    ),

    path(
        'company/<str:name>/',
        views.company_page,
        name='company-vehicles'
    ),

    path(
        'login/',
        views.login_page,
        name='login'
    ),

    path(
        'logout/',
        views.logout_user,
        name='logout'
    ),

    path(
        'auction/<int:id>/',
        views.auction_detail,
        name='auction-detail'
    ),


    # =====================================
    # COMMON AUTHENTICATION API
    # =====================================

    path(
        'api/auth/csrf/',
        csrf_cookie_api,
        name='api-auth-csrf'
    ),


    # =====================================
    # ADMIN AUTHENTICATION API
    # =====================================

    path(
        'api/admin/login/',
        admin_login_api,
        name='api-admin-login'
    ),


    # =====================================
    # SELLER AUTHENTICATION APIs
    # =====================================
    # Seller Registration
    path(
        'api/seller/register/',
        seller_register_api,
        name='api-seller-register'
    ),

    path(
        'api/auth/login/',
        seller_login_api,
        name='api-auth-login'
    ),

    path(
        'api/auth/logout/',
        seller_logout_api,
        name='api-auth-logout'
    ),

    path(
        'api/auth/me/',
        seller_me_api,
        name='api-auth-me'
    ),


    # =====================================
    # BUYER AUTHENTICATION APIs
    # =====================================

    path(
        'api/buyer/register/',
        buyer_register_api,
        name='api-buyer-register'
    ),

    path(
        'api/buyer/login/',
        buyer_login_api,
        name='api-buyer-login'
    ),

    path(
        'api/buyer/logout/',
        buyer_logout_api,
        name='api-buyer-logout'
    ),

    path(
        'api/buyer/me/',
        buyer_me_api,
        name='api-buyer-me'
    ),


    # =====================================
    # PUBLIC VEHICLE APIs
    # =====================================

    path(
        'api/vehicles/',
        VehicleListAPI.as_view(),
        name='api-vehicles'
    ),

    path(
        'api/vehicles/<int:pk>/',
        VehicleDetailAPI.as_view(),
        name='api-vehicle-detail'
    ),


    # =====================================
    # SELLER VEHICLE MANAGEMENT APIs
    # =====================================

    # Create new vehicle
    path(
        'api/vehicles/create/',
        VehicleCreateAPI.as_view(),
        name='api-vehicle-create'
    ),

    # View seller's own vehicles
    path(
        'api/vehicles/my-listings/',
        SellerVehicleListAPI.as_view(),
        name='api-seller-vehicles'
    ),

    # Update seller's vehicle
    path(
        'api/vehicles/<int:pk>/update/',
        SellerVehicleUpdateAPI.as_view(),
        name='api-seller-vehicle-update'
    ),

    # Delete seller's vehicle
    path(
        'api/vehicles/<int:pk>/delete/',
        SellerVehicleDeleteAPI.as_view(),
        name='api-seller-vehicle-delete'
    ),

    # Upload multiple additional vehicle images
    path(
        'api/vehicles/<int:pk>/images/',
        SellerVehicleImageUploadAPI.as_view(),
        name='api-seller-vehicle-images'
    ),

    # Delete a particular gallery image
    path(
        'api/vehicles/<int:pk>/images/<int:image_id>/delete/',
        SellerVehicleImageDeleteAPI.as_view(),
        name='api-seller-vehicle-image-delete'
    ),


    # =====================================
    # AUCTION APIs
    # =====================================

    path(
        'api/auctions/',
        AuctionListAPI.as_view(),
        name='api-auctions'
    ),

    path(
        'api/auctions/<int:pk>/',
        AuctionDetailAPI.as_view(),
        name='api-auction-detail'
    ),

    path(
        'api/auctions/<int:auction_id>/bids/',
        AuctionBidHistoryAPI.as_view(),
        name='api-auction-bid-history'
    ),


    # =====================================
    # COMPANY API
    # =====================================

    path(
        'api/companies/',
        CompanyListAPI.as_view(),
        name='api-companies'
    ),


    # =====================================
    # SUPPORT TICKET API
    # =====================================

    path(
        'api/tickets/',
        TicketCreateAPI.as_view(),
        name='api-tickets'
    ),


    # =====================================
    # BUYER - MY BIDS API
    # =====================================

    path(
        'api/bids/my-bids/',
        BuyerMyBidsAPI.as_view(),
        name='api-buyer-my-bids'
    ),


    # =====================================
    # BID CREATION API
    # =====================================

    path(
        'api/bids/',
        BidCreateAPI.as_view(),
        name='api-bids'
    ),


    # =====================================
    # ADMIN - ALL BIDS API
    # =====================================

    path(
        'api/admin/bids/',
        AdminBidListAPI.as_view(),
        name='api-admin-bids'
    ),

]
