from django.urls import path
from .views import (
    AdminDashboardView,
    HostDashboardView,
    LandlordDashboardView,
    TenantDashboardView,
)

urlpatterns = [
    path('admin/summary/', AdminDashboardView.as_view(), name='dashboard-admin-summary'),
    path('host/summary/', HostDashboardView.as_view(), name='dashboard-host-summary'),
    path('landlord/', LandlordDashboardView.as_view(), name='dashboard-landlord'),
    path('landlord/summary/', LandlordDashboardView.as_view(), name='dashboard-landlord-summary'),
    path('tenant/', TenantDashboardView.as_view(), name='dashboard-tenant'),
    path('tenant/summary/', TenantDashboardView.as_view(), name='dashboard-tenant-summary'),
]
