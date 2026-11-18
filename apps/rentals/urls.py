from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    VehicleViewSet,
    RentalViewSet,
    SavedVehicleViewSet,
    PropertyViewSet,
    RentalUnitViewSet,
    TenantAssignmentViewSet,
    RentalScheduleViewSet,
    RentObligationViewSet,
    PaymentRequestViewSet,
    PaymentReconciliationViewSet,
    RentReceiptViewSet,
    RentCalculatorView,
)

router = DefaultRouter()
router.register(r'vehicles', VehicleViewSet, basename='vehicle')
router.register(r'rentals', RentalViewSet, basename='rental')
router.register(r'saved', SavedVehicleViewSet, basename='saved-vehicle')

# PayarMove MVP 2: Property & Rental Schedule Management
router.register(r'properties', PropertyViewSet, basename='property')
router.register(r'units', RentalUnitViewSet, basename='rental-unit')
router.register(r'assignments', TenantAssignmentViewSet, basename='tenant-assignment')
router.register(r'schedules', RentalScheduleViewSet, basename='rental-schedule')
router.register(r'obligations', RentObligationViewSet, basename='rent-obligation')
router.register(r'payment-requests', PaymentRequestViewSet, basename='payment-request')
router.register(r'reconciliations', PaymentReconciliationViewSet, basename='payment-reconciliation')
router.register(r'receipts', RentReceiptViewSet, basename='rent-receipt')

urlpatterns = [
    path('calculator/', RentCalculatorView.as_view(), name='rent-calculator'),
    path('', include(router.urls)),
]
