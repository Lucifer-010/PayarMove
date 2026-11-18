import datetime
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.utils import timezone
from apps.authentication.models import User, WalletAccount, HostApplication
from apps.kyc.models import KYCRecord
from apps.rentals.models import Vehicle, Rental
from apps.escrow.models import SmartContractEscrow
from apps.payouts.models import HostPayout

class Command(BaseCommand):
    help = 'Populate the PayarMove database with comprehensive test data (users, vehicles, rentals, escrow, payouts)'

    def handle(self, *args, **options):
        self.stdout.write(self.style.NOTICE('Starting PayarMove database seeding...'))

        # 1. Create Test Users
        # Renter
        renter_user, created = User.objects.get_or_create(
            email='renter@payarmove.com',
            defaults={
                'username': 'renter',
                'role': User.Role.RENTER,
                'kyc_tier': User.KYCTier.TIER2,
                'phone_number': '+254711223344',
                'primary_stellar_address': 'GC2R34KLSLB2UMOOTPAJ7PGJUHVPYVP77DR27DZCD5CWRD3K7MQOEKLT',
            }
        )
        renter_user.primary_stellar_address = 'GC2R34KLSLB2UMOOTPAJ7PGJUHVPYVP77DR27DZCD5CWRD3K7MQOEKLT'
        renter_user.kyc_tier = User.KYCTier.TIER2
        renter_user.set_password('Password123!')
        renter_user.save()
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created test renter: {renter_user.email}'))

        # Host
        host_user, created = User.objects.get_or_create(
            email='host@payarmove.com',
            defaults={
                'username': 'marcus_host',
                'role': User.Role.HOST,
                'kyc_tier': User.KYCTier.TIER2,
                'phone_number': '+254722334455',
                'primary_stellar_address': 'GAPSKIPMRDLTFEKHV6VQKKMDUUIX2I56YVURD62KIYJ6Y6EJSOTP2ZWK',
            }
        )
        host_user.primary_stellar_address = 'GAPSKIPMRDLTFEKHV6VQKKMDUUIX2I56YVURD62KIYJ6Y6EJSOTP2ZWK'
        host_user.kyc_tier = User.KYCTier.TIER2
        host_user.set_password('Password123!')
        host_user.save()
        HostApplication.objects.get_or_create(
            user=host_user,
            defaults={
                'full_name': 'Marcus Host',
                'email': host_user.email,
                'phone_number': host_user.phone_number or '+254722334455',
                'payout_stellar_address': host_user.primary_stellar_address,
                'agreed_terms': True,
                'status': HostApplication.Status.APPROVED
            }
        )
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created test host: {host_user.email}'))

        # Admin
        admin_user, created = User.objects.get_or_create(
            email='admin@payarmove.com',
            defaults={
                'username': 'admin',
                'role': User.Role.ADMIN,
                'is_staff': True,
                'is_superuser': True,
                'phone_number': '+254700000000',
            }
        )
        admin_user.set_password('Password123!')
        admin_user.is_staff = True
        admin_user.is_superuser = True
        admin_user.save()
        if created:
            self.stdout.write(self.style.SUCCESS(f'Created test admin: {admin_user.email}'))

        # 2. Wallets
        WalletAccount.objects.update_or_create(
            user=renter_user,
            defaults={
                'public_key': 'GC2R34KLSLB2UMOOTPAJ7PGJUHVPYVP77DR27DZCD5CWRD3K7MQOEKLT',
                'wallet_type': WalletAccount.WalletType.FREIGHTER,
                'is_primary': True,
            }
        )
        WalletAccount.objects.update_or_create(
            user=host_user,
            defaults={
                'public_key': 'GAPSKIPMRDLTFEKHV6VQKKMDUUIX2I56YVURD62KIYJ6Y6EJSOTP2ZWK',
                'wallet_type': WalletAccount.WalletType.FREIGHTER,
                'is_primary': True,
            }
        )

        # 3. KYC Records
        KYCRecord.objects.get_or_create(
            user=renter_user,
            document_type=KYCRecord.DocumentType.DRIVERS_LICENSE,
            defaults={
                'document_number': 'DL-8921820',
                'status': KYCRecord.Status.APPROVED,
                'reviewed_by': admin_user,
                'reviewed_at': timezone.now(),
            }
        )
        KYCRecord.objects.get_or_create(
            user=host_user,
            document_type=KYCRecord.DocumentType.VEHICLE_LOGBOOK,
            defaults={
                'document_number': 'LOG-4419201',
                'status': KYCRecord.Status.APPROVED,
                'reviewed_by': admin_user,
                'reviewed_at': timezone.now(),
            }
        )

        # 4. Vehicles
        vehicles_data = [
            {
                'make_model': 'Mercedes-Benz G-Class G63 AMG',
                'registration_number': 'KDA 892X',
                'location': 'Westlands, Nairobi, Kenya',
                'category': 'SUV',
                'year': 2024,
                'seats': 5,
                'doors': 4,
                'transmission': 'Automatic',
                'fuel_type': 'Gasoline (V8 Twin-Turbo)',
                'rating': Decimal('5.00'),
                'reviews_count': 16,
                'trips_count': 32,
                'daily_rate_usdc': Decimal('300.0000000'),
                'hourly_rate_usdc': Decimal('25.0000000'),
                'deposit_amount_usdc': Decimal('500.0000000'),
                'pickup_instructions': 'Instant keyless unlock via Stellar Soroban smart lock code after escrow funding. Pick up from Westlands secure underground parking lot.',
                'image_url': '/cars/gwagon.jpg',
                'images': ['/cars/gwagon.jpg', '/cars/mercedes_gle.jpg', '/cars/porsche_macan.jpg'],
                'features': ['Stellar Micro-Payment Unlock', 'Burmester Surround Sound', 'GPS Geo-fencing', 'Adaptive Cruise Control', 'Verified Insurance'],
                'rules': ['No smoking or pets inside vehicle', 'Return with matching fuel tank', '200 miles/day limit included ($0.50/mile after)'],
            },
            {
                'make_model': 'Mercedes-Benz GLE 450 Coupe',
                'registration_number': 'KDB 412Y',
                'location': 'Kilimani, Nairobi, Kenya',
                'category': 'SUV',
                'year': 2024,
                'seats': 5,
                'doors': 4,
                'transmission': 'Automatic',
                'fuel_type': 'Hybrid',
                'rating': Decimal('4.95'),
                'reviews_count': 12,
                'trips_count': 22,
                'daily_rate_usdc': Decimal('180.0000000'),
                'hourly_rate_usdc': Decimal('18.0000000'),
                'deposit_amount_usdc': Decimal('300.0000000'),
                'pickup_instructions': 'Parked at Yaya Centre VIP Level 2. Host keyless passcode provided upon smart contract transaction broadcast.',
                'image_url': '/cars/mercedes_gle.jpg',
                'images': ['/cars/mercedes_gle.jpg', '/cars/gwagon.jpg', '/cars/porsche_macan.jpg'],
                'features': ['Panoramic Sunroof', 'MBUX Augmented Reality Navigation', 'Apple CarPlay & Android Auto', 'Stellar Escrow Unlock'],
                'rules': ['No aggressive off-roading', 'Return clean', 'Speed monitored via telemetry'],
            },
            {
                'make_model': 'Porsche Macan GTS',
                'registration_number': 'KDC 773Z',
                'location': 'Karen, Nairobi, Kenya',
                'category': 'SUV',
                'year': 2024,
                'seats': 5,
                'doors': 4,
                'transmission': 'Automatic PDK',
                'fuel_type': 'Gasoline',
                'rating': Decimal('4.98'),
                'reviews_count': 19,
                'trips_count': 38,
                'daily_rate_usdc': Decimal('220.0000000'),
                'hourly_rate_usdc': Decimal('22.0000000'),
                'deposit_amount_usdc': Decimal('350.0000000'),
                'pickup_instructions': 'The Hub Karen designated mobility bay 4. Key in smart safe box unlocked with escrow authorization.',
                'image_url': '/cars/porsche_macan.jpg',
                'images': ['/cars/porsche_macan.jpg', '/cars/bmw_x5.jpg', '/cars/rangerover_sport.jpg'],
                'features': ['Sport Chrono Package', 'Bose Audio System', 'Air Suspension with PASM', 'Keyless Remote Entry'],
                'rules': ['Premium 98 fuel only (receipt required)', 'No track use', 'Maintain clean interior'],
            },
            {
                'make_model': 'Jeep Wrangler Rubicon 4xe',
                'registration_number': 'KDD 104W',
                'location': 'Lavington, Nairobi, Kenya',
                'category': 'SUV',
                'year': 2024,
                'seats': 5,
                'doors': 4,
                'transmission': 'Automatic',
                'fuel_type': 'Plug-in Hybrid',
                'rating': Decimal('4.92'),
                'reviews_count': 15,
                'trips_count': 26,
                'daily_rate_usdc': Decimal('150.0000000'),
                'hourly_rate_usdc': Decimal('15.0000000'),
                'deposit_amount_usdc': Decimal('250.0000000'),
                'pickup_instructions': 'Lavington Mall designated parking. Charging cable in rear compartment. Bluetooth smart lock enabled.',
                'image_url': '/cars/jeep_wrangler.jpg',
                'images': ['/cars/jeep_wrangler.jpg', '/cars/rangerover_sport.jpg', '/cars/gwagon.jpg'],
                'features': ['Removable Freedom Top', 'TrailCam Off-Road Camera', 'Alpine 9-Speaker Audio', 'Rock-Trac 4x4 System'],
                'rules': ['Wash after muddy terrain', 'No rock crawling without host notice', 'Strictly no smoking'],
            },
            {
                'make_model': 'BMW X5 xDrive40i',
                'registration_number': 'KDE 551V',
                'location': 'Gigiri, Nairobi, Kenya',
                'category': 'SUV',
                'year': 2024,
                'seats': 5,
                'doors': 4,
                'transmission': 'Steptronic Automatic',
                'fuel_type': 'Gasoline Mild Hybrid',
                'rating': Decimal('4.96'),
                'reviews_count': 21,
                'trips_count': 40,
                'daily_rate_usdc': Decimal('190.0000000'),
                'hourly_rate_usdc': Decimal('19.0000000'),
                'deposit_amount_usdc': Decimal('300.0000000'),
                'pickup_instructions': 'Village Market parking slot P-14. QR verification code provided upon rental confirmation.',
                'image_url': '/cars/bmw_x5.jpg',
                'images': ['/cars/bmw_x5.jpg', '/cars/mercedes_gle.jpg', '/cars/rangerover_sport.jpg'],
                'features': ['BMW Curved Display with iDrive 8.5', 'Harman Kardon Surround Sound', 'Parking Assistant Plus', 'Wireless Phone Charger'],
                'rules': ['No food inside car', 'Clean return required', 'Late return fee: $35/hour'],
            },
            {
                'make_model': 'Range Rover Sport Dynamic',
                'registration_number': 'KDF 909T',
                'location': 'Muthaiga, Nairobi, Kenya',
                'category': 'Luxury',
                'year': 2024,
                'seats': 5,
                'doors': 4,
                'transmission': 'Automatic',
                'fuel_type': 'Gasoline',
                'rating': Decimal('5.00'),
                'reviews_count': 18,
                'trips_count': 35,
                'daily_rate_usdc': Decimal('320.0000000'),
                'hourly_rate_usdc': Decimal('28.0000000'),
                'deposit_amount_usdc': Decimal('600.0000000'),
                'pickup_instructions': 'Muthaiga Country Club gate 2 reception. Concierge hand-off with digital biometric check.',
                'image_url': '/cars/rangerover_sport.jpg',
                'images': ['/cars/rangerover_sport.jpg', '/cars/gwagon.jpg', '/cars/bmw_x5.jpg'],
                'features': ['Meridian 3D Surround Sound', 'Dynamic Air Suspension with eHorizon', 'Pixel LED Headlights', 'Cabin Air Purification Pro'],
                'rules': ['Chauffeur or verified TIER2 driver only', 'No smoking', 'Pre-inspection video logged'],
            },
        ]

        created_vehicles = []
        for v in vehicles_data:
            vehicle, created = Vehicle.objects.update_or_create(
                registration_number=v['registration_number'],
                defaults={
                    'host': host_user,
                    'make_model': v['make_model'],
                    'location': v['location'],
                    'category': v['category'],
                    'year': v['year'],
                    'seats': v['seats'],
                    'doors': v['doors'],
                    'transmission': v['transmission'],
                    'fuel_type': v['fuel_type'],
                    'rating': v['rating'],
                    'reviews_count': v['reviews_count'],
                    'trips_count': v['trips_count'],
                    'daily_rate_usdc': v['daily_rate_usdc'],
                    'hourly_rate_usdc': v['hourly_rate_usdc'],
                    'deposit_amount_usdc': v['deposit_amount_usdc'],
                    'pickup_instructions': v['pickup_instructions'],
                    'image_url': v['image_url'],
                    'images': v['images'],
                    'features': v['features'],
                    'rules': v['rules'],
                    'is_active': True,
                }
            )
            created_vehicles.append(vehicle)

        self.stdout.write(self.style.SUCCESS(f'Populated {len(created_vehicles)} vehicles in database.'))

        # 5. Rentals
        today = datetime.date.today()
        # Rental 1: Active
        r1, _ = Rental.objects.get_or_create(
            rental_code='PM-8921',
            defaults={
                'vehicle': created_vehicles[0],
                'renter': renter_user,
                'host': host_user,
                'start_date': today - datetime.timedelta(days=1),
                'end_date': today + datetime.timedelta(days=2),
                'total_days': 3,
                'rental_amount_usdc': Decimal('900.0000000'),
                'deposit_amount_usdc': Decimal('500.0000000'),
                'total_due_usdc': Decimal('1400.0000000'),
                'status': Rental.Status.ACTIVE,
            }
        )

        # Rental 2: Completed
        r2, _ = Rental.objects.get_or_create(
            rental_code='PM-4412',
            defaults={
                'vehicle': created_vehicles[1],
                'renter': renter_user,
                'host': host_user,
                'start_date': today - datetime.timedelta(days=7),
                'end_date': today - datetime.timedelta(days=4),
                'total_days': 3,
                'rental_amount_usdc': Decimal('540.0000000'),
                'deposit_amount_usdc': Decimal('300.0000000'),
                'total_due_usdc': Decimal('840.0000000'),
                'status': Rental.Status.COMPLETED,
            }
        )

        # Rental 3: Awaiting Payment
        r3, _ = Rental.objects.get_or_create(
            rental_code='PM-1094',
            defaults={
                'vehicle': created_vehicles[2],
                'renter': renter_user,
                'host': host_user,
                'start_date': today + datetime.timedelta(days=1),
                'end_date': today + datetime.timedelta(days=3),
                'total_days': 2,
                'rental_amount_usdc': Decimal('440.0000000'),
                'deposit_amount_usdc': Decimal('350.0000000'),
                'total_due_usdc': Decimal('790.0000000'),
                'status': Rental.Status.AWAITING_PAYMENT,
            }
        )

        # 6. Escrow records
        SmartContractEscrow.objects.get_or_create(
            rental=r1,
            defaults={
                'contract_id': 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
                'agreement_symbol': 'PM8921',
                'token_address': 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
                'total_locked_usdc': Decimal('1400.0000000'),
                'rental_fee_usdc': Decimal('900.0000000'),
                'deposit_fee_usdc': Decimal('500.0000000'),
                'status': SmartContractEscrow.OnChainStatus.FUNDED,
                'deposit_tx_hash': '4f9b8a8292cbb3e85e1358b532924151e2bc682390a72ad481b7e6840742d8d8',
                'funded_at': timezone.now() - datetime.timedelta(days=1),
            }
        )

        SmartContractEscrow.objects.get_or_create(
            rental=r2,
            defaults={
                'contract_id': 'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC',
                'agreement_symbol': 'PM4412',
                'token_address': 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5',
                'total_locked_usdc': Decimal('840.0000000'),
                'rental_fee_usdc': Decimal('540.0000000'),
                'deposit_fee_usdc': Decimal('300.0000000'),
                'status': SmartContractEscrow.OnChainStatus.COMPLETED,
                'deposit_tx_hash': '3c1b8a8292cbb3e85e1358b532924151e2bc682390a72ad481b7e6840742a77a',
                'settlement_tx_hash': '7e9b8a8292cbb3e85e1358b532924151e2bc682390a72ad481b7e6840742b88b',
                'funded_at': timezone.now() - datetime.timedelta(days=7),
                'settled_at': timezone.now() - datetime.timedelta(days=4),
            }
        )

        # 7. Host Payouts
        HostPayout.objects.get_or_create(
            rental=r2,
            host=host_user,
            defaults={
                'gross_rental_usdc': Decimal('540.0000000'),
                'platform_fee_usdc': Decimal('54.0000000'),
                'net_payout_usdc': Decimal('486.0000000'),
                'status': HostPayout.Status.COMPLETED,
                'tx_hash': '9a8b8a8292cbb3e85e1358b532924151e2bc682390a72ad481b7e6840742c99c',
                'settled_at': timezone.now() - datetime.timedelta(days=4),
            }
        )

        self.stdout.write(self.style.SUCCESS('Successfully populated PayarMove database!'))
        self.stdout.write(self.style.SUCCESS('Test Credentials:'))
        self.stdout.write(self.style.SUCCESS('  - Renter:   renter@payarmove.com / Password123! (Tier 2 Verified)'))
        self.stdout.write(self.style.SUCCESS('  - Host:     host@payarmove.com / Password123! (Tier 2 Verified)'))
        self.stdout.write(self.style.SUCCESS('  - Landlord: landlord@payarmove.com / Password123! (Tier 2 Verified)'))
        self.stdout.write(self.style.SUCCESS('  - Tenant:   tenant1@payarmove.com / Password123! (Tier 2 Verified)'))
        self.stdout.write(self.style.SUCCESS('  - Admin:    admin@payarmove.com / Password123!'))

        # =====================================================================
        # 8. PayarMove MVP 2: Seed Properties, Units, Leases & Stellar Rent Data
        # =====================================================================
        self.stdout.write(self.style.NOTICE('Seeding MVP 2 Property Management & Rental Schedules...'))

        from apps.rentals.models import (
            Property,
            RentalUnit,
            TenantAssignment,
            RentalSchedule,
            RentObligation,
            PaymentRequest,
            RentPayment,
            RentReceipt,
            StellarReconciliationCursor,
        )

        # Landlord user
        landlord_user, _ = User.objects.get_or_create(
            email='landlord@payarmove.com',
            defaults={
                'username': 'landlord_sarah',
                'first_name': 'Sarah',
                'last_name': 'Jenkins',
                'role': User.Role.LANDLORD,
                'kyc_tier': User.KYCTier.TIER2,
                'phone_number': '+254733445566',
                'primary_stellar_address': 'GAPSKIPMRDLTFEKHV6VQKKMDUUIX2I56YVURD62KIYJ6Y6EJSOTP2ZWK',
            }
        )
        landlord_user.set_password('Password123!')
        landlord_user.role = User.Role.LANDLORD
        landlord_user.save()

        # Tenants A, B, C, D from project_mvp2.txt spec
        tenants_data = [
            ('tenant1@payarmove.com', 'Alex Tenant A', 'GC2R34KLSLB2UMOOTPAJ7PGJUHVPYVP77DR27DZCD5CWRD3K7MQOEKLT'),
            ('tenant2@payarmove.com', 'Brian Tenant B', 'GA2C5RFPE6GCKMY3US5HHS6UG2HN4MOGGIZ3UPISGNWSWGLOEINTB7EZ'),
            ('tenant3@payarmove.com', 'Claire Tenant C', 'GDA4K7XN6H5X6D6A6P5S6K6I6P6M6R6D6L6T6F6E6K6H6V66VQKKMDUU'),
            ('tenant4@payarmove.com', 'David Tenant D', 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5'),
        ]
        tenant_objs = []
        for t_email, t_name, t_addr in tenants_data:
            t_user, _ = User.objects.get_or_create(
                email=t_email,
                defaults={
                    'username': t_email.split('@')[0],
                    'first_name': t_name,
                    'role': User.Role.TENANT,
                    'kyc_tier': User.KYCTier.TIER2,
                    'phone_number': '+254788990011',
                    'primary_stellar_address': t_addr,
                }
            )
            t_user.set_password('Password123!')
            t_user.role = User.Role.TENANT
            t_user.save()
            tenant_objs.append(t_user)

        # Properties
        prop1, _ = Property.objects.get_or_create(
            name='Sunset Heights Luxury Apartments',
            landlord=landlord_user,
            defaults={
                'property_type': Property.PropertyType.APARTMENT,
                'address': 'Plot 44, General Mathenge Drive, Westlands',
                'city': 'Nairobi',
                'state_province': 'Nairobi County',
                'postal_code': '00100',
                'country': 'Kenya',
                'description': 'Modern upscale residential complex featuring panoramic city views, solar backup, and high-speed fiber.',
                'receiving_wallet': 'GAPSKIPMRDLTFEKHV6VQKKMDUUIX2I56YVURD62KIYJ6Y6EJSOTP2ZWK',
                'image_url': 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
                'images': [
                    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
                    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80'
                ]
            }
        )

        prop2, _ = Property.objects.get_or_create(
            name='Kilimani Palm Residences',
            landlord=landlord_user,
            defaults={
                'property_type': Property.PropertyType.APARTMENT,
                'address': 'Argwings Kodhek Road, Kilimani',
                'city': 'Nairobi',
                'state_province': 'Nairobi County',
                'country': 'Kenya',
                'description': 'Spacious executive apartments with 24/7 biometric security and swimming pool.',
                'receiving_wallet': 'GAPSKIPMRDLTFEKHV6VQKKMDUUIX2I56YVURD62KIYJ6Y6EJSOTP2ZWK',
                'image_url': 'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?auto=format&fit=crop&w=1200&q=80',
                'images': [
                    'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?auto=format&fit=crop&w=1200&q=80'
                ]
            }
        )

        prop3, _ = Property.objects.get_or_create(
            name='Riverside Green Heights',
            landlord=landlord_user,
            defaults={
                'property_type': Property.PropertyType.APARTMENT,
                'address': 'Riverside Drive, Westlands',
                'city': 'Nairobi',
                'state_province': 'Nairobi County',
                'country': 'Kenya',
                'description': 'Boutique riverfront luxury living with rooftop infinity pool, fitness center, solar water heating, and high-speed fiber internet.',
                'receiving_wallet': 'GAPSKIPMRDLTFEKHV6VQKKMDUUIX2I56YVURD62KIYJ6Y6EJSOTP2ZWK',
                'image_url': 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
                'images': [
                    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1200&q=80',
                    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80'
                ]
            }
        )

        prop4, _ = Property.objects.get_or_create(
            name='Kileleshwa Parkview Suites',
            landlord=landlord_user,
            defaults={
                'property_type': Property.PropertyType.APARTMENT,
                'address': 'Muringa Road, Kileleshwa',
                'city': 'Nairobi',
                'state_province': 'Nairobi County',
                'country': 'Kenya',
                'description': 'Peaceful residential suites overlooking Nairobi Arboretum with backup generator, borehole water, and dedicated EV charging stations.',
                'receiving_wallet': 'GAPSKIPMRDLTFEKHV6VQKKMDUUIX2I56YVURD62KIYJ6Y6EJSOTP2ZWK',
                'image_url': 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80',
                'images': [
                    'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1200&q=80'
                ]
            }
        )

        prop5, _ = Property.objects.get_or_create(
            name='Karen Pinehurst Residences',
            landlord=landlord_user,
            defaults={
                'property_type': Property.PropertyType.VILLA,
                'address': 'Mbagathi Ridge, Karen',
                'city': 'Nairobi',
                'state_province': 'Nairobi County',
                'country': 'Kenya',
                'description': 'Exclusive gated luxury villas surrounded by lush indigenous forest, featuring private gardens, smart security, and bespoke finishes.',
                'receiving_wallet': 'GAPSKIPMRDLTFEKHV6VQKKMDUUIX2I56YVURD62KIYJ6Y6EJSOTP2ZWK',
                'image_url': 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
                'images': [
                    'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80',
                    'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1200&q=80'
                ]
            }
        )

        # Rental Units for Prop 1
        unit_1a, _ = RentalUnit.objects.get_or_create(
            property=prop1,
            unit_number='Unit 1A',
            defaults={
                'floor': '1st Floor',
                'bedrooms': 2,
                'bathrooms': Decimal('2.0'),
                'square_feet': 1100,
                'rent_amount_usdc': Decimal('300.0000000'),
                'deposit_amount_usdc': Decimal('300.0000000'),
                'is_occupied': True,
                'current_tenant': tenant_objs[0]
            }
        )
        unit_1b, _ = RentalUnit.objects.get_or_create(
            property=prop1,
            unit_number='Unit 1B',
            defaults={
                'floor': '1st Floor',
                'bedrooms': 2,
                'bathrooms': Decimal('2.0'),
                'square_feet': 1100,
                'rent_amount_usdc': Decimal('300.0000000'),
                'deposit_amount_usdc': Decimal('300.0000000'),
                'is_occupied': True,
                'current_tenant': tenant_objs[1]
            }
        )
        unit_2a, _ = RentalUnit.objects.get_or_create(
            property=prop1,
            unit_number='Unit 2A',
            defaults={
                'floor': '2nd Floor',
                'bedrooms': 3,
                'bathrooms': Decimal('2.5'),
                'square_feet': 1450,
                'rent_amount_usdc': Decimal('300.0000000'),
                'deposit_amount_usdc': Decimal('300.0000000'),
                'is_occupied': True,
                'current_tenant': tenant_objs[2]
            }
        )
        unit_2b, _ = RentalUnit.objects.get_or_create(
            property=prop1,
            unit_number='Unit 2B',
            defaults={
                'floor': '2nd Floor',
                'bedrooms': 1,
                'bathrooms': Decimal('1.0'),
                'square_feet': 750,
                'rent_amount_usdc': Decimal('150.0000000'),
                'deposit_amount_usdc': Decimal('150.0000000'),
                'is_occupied': True,
                'current_tenant': tenant_objs[3]
            }
        )

        # Available Units for Prop 2 (Kilimani Palm Residences)
        RentalUnit.objects.get_or_create(
            property=prop2,
            unit_number='Flat 101',
            defaults={
                'floor': '1st Floor',
                'bedrooms': 2,
                'bathrooms': Decimal('2.0'),
                'square_feet': 1200,
                'rent_amount_usdc': Decimal('450.0000000'),
                'deposit_amount_usdc': Decimal('450.0000000'),
                'is_occupied': False,
            }
        )
        RentalUnit.objects.get_or_create(
            property=prop2,
            unit_number='Flat 102',
            defaults={
                'floor': '1st Floor',
                'bedrooms': 1,
                'bathrooms': Decimal('1.0'),
                'square_feet': 800,
                'rent_amount_usdc': Decimal('320.0000000'),
                'deposit_amount_usdc': Decimal('320.0000000'),
                'is_occupied': False,
            }
        )
        RentalUnit.objects.get_or_create(
            property=prop2,
            unit_number='Penthouse 3A',
            defaults={
                'floor': '3rd Floor',
                'bedrooms': 3,
                'bathrooms': Decimal('3.0'),
                'square_feet': 1800,
                'rent_amount_usdc': Decimal('750.0000000'),
                'deposit_amount_usdc': Decimal('750.0000000'),
                'is_occupied': False,
            }
        )

        # Available Units for Prop 3 (Riverside Green Heights)
        RentalUnit.objects.get_or_create(
            property=prop3,
            unit_number='Suite 201',
            defaults={
                'floor': '2nd Floor',
                'bedrooms': 2,
                'bathrooms': Decimal('2.0'),
                'square_feet': 1250,
                'rent_amount_usdc': Decimal('520.0000000'),
                'deposit_amount_usdc': Decimal('520.0000000'),
                'is_occupied': False,
            }
        )
        RentalUnit.objects.get_or_create(
            property=prop3,
            unit_number='Executive Suite 4B',
            defaults={
                'floor': '4th Floor',
                'bedrooms': 3,
                'bathrooms': Decimal('2.5'),
                'square_feet': 1600,
                'rent_amount_usdc': Decimal('680.0000000'),
                'deposit_amount_usdc': Decimal('680.0000000'),
                'is_occupied': False,
            }
        )

        # Available Units for Prop 4 (Kileleshwa Parkview Suites)
        RentalUnit.objects.get_or_create(
            property=prop4,
            unit_number='Unit A1',
            defaults={
                'floor': 'Ground Floor',
                'bedrooms': 1,
                'bathrooms': Decimal('1.0'),
                'square_feet': 720,
                'rent_amount_usdc': Decimal('280.0000000'),
                'deposit_amount_usdc': Decimal('280.0000000'),
                'is_occupied': False,
            }
        )
        RentalUnit.objects.get_or_create(
            property=prop4,
            unit_number='Unit B2',
            defaults={
                'floor': '2nd Floor',
                'bedrooms': 2,
                'bathrooms': Decimal('2.0'),
                'square_feet': 1150,
                'rent_amount_usdc': Decimal('420.0000000'),
                'deposit_amount_usdc': Decimal('420.0000000'),
                'is_occupied': False,
            }
        )

        # Available Units for Prop 5 (Karen Pinehurst Residences)
        RentalUnit.objects.get_or_create(
            property=prop5,
            unit_number='Villa 1',
            defaults={
                'floor': 'Two Stories',
                'bedrooms': 4,
                'bathrooms': Decimal('4.5'),
                'square_feet': 3200,
                'rent_amount_usdc': Decimal('950.0000000'),
                'deposit_amount_usdc': Decimal('950.0000000'),
                'is_occupied': False,
            }
        )

        today = timezone.localdate()
        first_of_month = today.replace(day=1)
        prev_month = (first_of_month - datetime.timedelta(days=1)).replace(day=1)
        next_month = (first_of_month + datetime.timedelta(days=32)).replace(day=1)

        # Assignments & Rental Schedules
        # Tenant A: Fully Paid (0 USDC outstanding)
        asg_a, _ = TenantAssignment.objects.get_or_create(
            property=prop1,
            unit=unit_1a,
            tenant=tenant_objs[0],
            defaults={
                'landlord': landlord_user,
                'rent_amount_usdc': Decimal('300.0000000'),
                'deposit_amount_usdc': Decimal('300.0000000'),
                'payment_frequency': TenantAssignment.PaymentFrequency.MONTHLY,
                'billing_day_of_month': 1,
                'start_date': prev_month,
                'receiving_wallet': prop1.receiving_wallet,
                'status': TenantAssignment.Status.ACTIVE
            }
        )
        sch_a, _ = RentalSchedule.objects.get_or_create(
            assignment=asg_a,
            defaults={
                'property': prop1,
                'unit': unit_1a,
                'landlord': landlord_user,
                'tenant': tenant_objs[0],
                'rent_amount_usdc': Decimal('300.0000000'),
                'first_payment_date': prev_month,
                'start_date': prev_month,
                'receiving_wallet': prop1.receiving_wallet,
                'is_active': True
            }
        )
        obl_a = RentObligation.objects.filter(schedule=sch_a, period_start_date=prev_month).first()
        if not obl_a:
            obl_a = RentObligation.objects.create(
                schedule=sch_a,
                assignment=asg_a,
                property=prop1,
                unit=unit_1a,
                landlord=landlord_user,
                tenant=tenant_objs[0],
                period_start_date=prev_month,
                period_end_date=first_of_month - datetime.timedelta(days=1),
                due_date=prev_month + datetime.timedelta(days=4),
                amount_due_usdc=Decimal('300.0000000'),
                amount_paid_usdc=Decimal('300.0000000'),
                outstanding_balance_usdc=Decimal('0.0000000'),
                asset_code='USDC',
                receiving_wallet=prop1.receiving_wallet,
                payment_memo='PM-TENANT-A-PAID',
                status=RentObligation.Status.PAID
            )
        obl_a.status = RentObligation.Status.PAID
        obl_a.amount_paid_usdc = Decimal('300.0000000')
        obl_a.outstanding_balance_usdc = Decimal('0.0000000')
        obl_a.save()

        # Seed verified payment & receipt for Tenant A
        pay_a, _ = RentPayment.objects.get_or_create(
            stellar_op_id='op_seed_stellar_a_001',
            defaults={
                'obligation': obl_a,
                'tenant': tenant_objs[0],
                'payer_stellar_address': tenant_objs[0].primary_stellar_address,
                'receiving_stellar_address': prop1.receiving_wallet,
                'amount': Decimal('300.0000000'),
                'asset_code': 'USDC',
                'stellar_tx_hash': '7c8b8a8292cbb3e85e1358b532924151e2bc682390a72ad481b7e6840742e11a',
                'ledger_sequence': 4892110,
                'ledger_closed_at': timezone.now() - datetime.timedelta(days=15),
                'memo': 'PM-TENANT-A-PAID',
                'reconciliation_status': RentPayment.ReconciliationStatus.CONFIRMED,
                'balance_after_payment': Decimal('0.0000000'),
                'review_notes': 'Full rent obligation settled on Stellar Testnet.'
            }
        )
        RentReceipt.objects.get_or_create(
            payment=pay_a,
            defaults={
                'obligation': obl_a,
                'tenant': tenant_objs[0],
                'property_name': prop1.name,
                'unit_number': unit_1a.unit_number,
                'rental_period': obl_a.rental_period_display,
                'amount_paid': Decimal('300.0000000'),
                'asset_code': 'USDC',
                'payment_date': pay_a.ledger_closed_at,
                'stellar_tx_hash': pay_a.stellar_tx_hash,
                'stellar_op_id': pay_a.stellar_op_id,
                'outstanding_balance_after': Decimal('0.0000000'),
                'verification_status': 'CONFIRMED_ON_STELLAR_TESTNET',
                'stellar_explorer_url': pay_a.stellar_explorer_url,
                'notes': pay_a.review_notes
            }
        )

        # Tenant B: Partially Paid (100 USDC outstanding, 200 paid of 300)
        asg_b, _ = TenantAssignment.objects.get_or_create(
            property=prop1,
            unit=unit_1b,
            tenant=tenant_objs[1],
            defaults={
                'landlord': landlord_user,
                'rent_amount_usdc': Decimal('300.0000000'),
                'deposit_amount_usdc': Decimal('300.0000000'),
                'payment_frequency': TenantAssignment.PaymentFrequency.MONTHLY,
                'billing_day_of_month': 1,
                'start_date': first_of_month,
                'receiving_wallet': prop1.receiving_wallet,
                'status': TenantAssignment.Status.ACTIVE
            }
        )
        sch_b, _ = RentalSchedule.objects.get_or_create(
            assignment=asg_b,
            defaults={
                'property': prop1,
                'unit': unit_1b,
                'landlord': landlord_user,
                'tenant': tenant_objs[1],
                'rent_amount_usdc': Decimal('300.0000000'),
                'first_payment_date': first_of_month,
                'start_date': first_of_month,
                'receiving_wallet': prop1.receiving_wallet,
                'is_active': True
            }
        )
        obl_b = RentObligation.objects.filter(schedule=sch_b, period_start_date=first_of_month).first()
        if not obl_b:
            obl_b = RentObligation.objects.create(
                schedule=sch_b,
                assignment=asg_b,
                property=prop1,
                unit=unit_1b,
                landlord=landlord_user,
                tenant=tenant_objs[1],
                period_start_date=first_of_month,
                period_end_date=next_month - datetime.timedelta(days=1),
                due_date=first_of_month + datetime.timedelta(days=10),
                amount_due_usdc=Decimal('300.0000000'),
                amount_paid_usdc=Decimal('200.0000000'),
                outstanding_balance_usdc=Decimal('100.0000000'),
                asset_code='USDC',
                receiving_wallet=prop1.receiving_wallet,
                payment_memo='PM-TENANT-B-PART',
                status=RentObligation.Status.PARTIALLY_PAID
            )
        obl_b.status = RentObligation.Status.PARTIALLY_PAID
        obl_b.amount_paid_usdc = Decimal('200.0000000')
        obl_b.outstanding_balance_usdc = Decimal('100.0000000')
        obl_b.save()

        # Payments for Tenant B (2 partial payments of 100 each)
        pay_b1, _ = RentPayment.objects.get_or_create(
            stellar_op_id='op_seed_stellar_b_001',
            defaults={
                'obligation': obl_b,
                'tenant': tenant_objs[1],
                'payer_stellar_address': tenant_objs[1].primary_stellar_address,
                'receiving_stellar_address': prop1.receiving_wallet,
                'amount': Decimal('100.0000000'),
                'asset_code': 'USDC',
                'stellar_tx_hash': '6b7a8a8292cbb3e85e1358b532924151e2bc682390a72ad481b7e6840742f22b',
                'ledger_sequence': 4893120,
                'ledger_closed_at': timezone.now() - datetime.timedelta(days=5),
                'memo': 'PM-TENANT-B-PART',
                'reconciliation_status': RentPayment.ReconciliationStatus.PARTIAL,
                'balance_after_payment': Decimal('200.0000000'),
                'review_notes': 'First partial payment of 100 USDC credited.'
            }
        )
        RentReceipt.objects.get_or_create(
            payment=pay_b1,
            defaults={
                'obligation': obl_b,
                'tenant': tenant_objs[1],
                'property_name': prop1.name,
                'unit_number': unit_1b.unit_number,
                'rental_period': obl_b.rental_period_display,
                'amount_paid': Decimal('100.0000000'),
                'asset_code': 'USDC',
                'payment_date': pay_b1.ledger_closed_at,
                'stellar_tx_hash': pay_b1.stellar_tx_hash,
                'stellar_op_id': pay_b1.stellar_op_id,
                'outstanding_balance_after': Decimal('200.0000000'),
                'verification_status': 'CONFIRMED_ON_STELLAR_TESTNET',
                'stellar_explorer_url': pay_b1.stellar_explorer_url,
                'notes': pay_b1.review_notes
            }
        )

        pay_b2, _ = RentPayment.objects.get_or_create(
            stellar_op_id='op_seed_stellar_b_002',
            defaults={
                'obligation': obl_b,
                'tenant': tenant_objs[1],
                'payer_stellar_address': tenant_objs[1].primary_stellar_address,
                'receiving_stellar_address': prop1.receiving_wallet,
                'amount': Decimal('100.0000000'),
                'asset_code': 'USDC',
                'stellar_tx_hash': '5a6b8a8292cbb3e85e1358b532924151e2bc682390a72ad481b7e6840742g33c',
                'ledger_sequence': 4893950,
                'ledger_closed_at': timezone.now() - datetime.timedelta(days=2),
                'memo': 'PM-TENANT-B-PART',
                'reconciliation_status': RentPayment.ReconciliationStatus.PARTIAL,
                'balance_after_payment': Decimal('100.0000000'),
                'review_notes': 'Second partial payment of 100 USDC credited. Remaining balance: 100 USDC.'
            }
        )
        RentReceipt.objects.get_or_create(
            payment=pay_b2,
            defaults={
                'obligation': obl_b,
                'tenant': tenant_objs[1],
                'property_name': prop1.name,
                'unit_number': unit_1b.unit_number,
                'rental_period': obl_b.rental_period_display,
                'amount_paid': Decimal('100.0000000'),
                'asset_code': 'USDC',
                'payment_date': pay_b2.ledger_closed_at,
                'stellar_tx_hash': pay_b2.stellar_tx_hash,
                'stellar_op_id': pay_b2.stellar_op_id,
                'outstanding_balance_after': Decimal('100.0000000'),
                'verification_status': 'CONFIRMED_ON_STELLAR_TESTNET',
                'stellar_explorer_url': pay_b2.stellar_explorer_url,
                'notes': pay_b2.review_notes
            }
        )

        # Tenant C: Overdue (300 USDC outstanding, due date passed with 0 paid)
        asg_c, _ = TenantAssignment.objects.get_or_create(
            property=prop1,
            unit=unit_2a,
            tenant=tenant_objs[2],
            defaults={
                'landlord': landlord_user,
                'rent_amount_usdc': Decimal('300.0000000'),
                'deposit_amount_usdc': Decimal('300.0000000'),
                'payment_frequency': TenantAssignment.PaymentFrequency.MONTHLY,
                'billing_day_of_month': 1,
                'start_date': prev_month,
                'receiving_wallet': prop1.receiving_wallet,
                'status': TenantAssignment.Status.ACTIVE
            }
        )
        sch_c, _ = RentalSchedule.objects.get_or_create(
            assignment=asg_c,
            defaults={
                'property': prop1,
                'unit': unit_2a,
                'landlord': landlord_user,
                'tenant': tenant_objs[2],
                'rent_amount_usdc': Decimal('300.0000000'),
                'first_payment_date': prev_month,
                'start_date': prev_month,
                'receiving_wallet': prop1.receiving_wallet,
                'is_active': True
            }
        )
        obl_c = RentObligation.objects.filter(schedule=sch_c, period_start_date=prev_month).first()
        if not obl_c:
            obl_c = RentObligation.objects.create(
                schedule=sch_c,
                assignment=asg_c,
                property=prop1,
                unit=unit_2a,
                landlord=landlord_user,
                tenant=tenant_objs[2],
                period_start_date=prev_month,
                period_end_date=first_of_month - datetime.timedelta(days=1),
                due_date=prev_month + datetime.timedelta(days=5),
                amount_due_usdc=Decimal('300.0000000'),
                amount_paid_usdc=Decimal('0.0000000'),
                outstanding_balance_usdc=Decimal('300.0000000'),
                asset_code='USDC',
                receiving_wallet=prop1.receiving_wallet,
                payment_memo='PM-TENANT-C-ODUE',
                status=RentObligation.Status.OVERDUE
            )
        obl_c.status = RentObligation.Status.OVERDUE
        obl_c.amount_paid_usdc = Decimal('0.0000000')
        obl_c.outstanding_balance_usdc = Decimal('300.0000000')
        obl_c.save()

        # Tenant D: Upcoming (150 USDC outstanding, due date in the future)
        asg_d, _ = TenantAssignment.objects.get_or_create(
            property=prop1,
            unit=unit_2b,
            tenant=tenant_objs[3],
            defaults={
                'landlord': landlord_user,
                'rent_amount_usdc': Decimal('150.0000000'),
                'deposit_amount_usdc': Decimal('150.0000000'),
                'payment_frequency': TenantAssignment.PaymentFrequency.MONTHLY,
                'billing_day_of_month': 1,
                'start_date': next_month,
                'receiving_wallet': prop1.receiving_wallet,
                'status': TenantAssignment.Status.ACTIVE
            }
        )
        sch_d, _ = RentalSchedule.objects.get_or_create(
            assignment=asg_d,
            defaults={
                'property': prop1,
                'unit': unit_2b,
                'landlord': landlord_user,
                'tenant': tenant_objs[3],
                'rent_amount_usdc': Decimal('150.0000000'),
                'first_payment_date': next_month,
                'start_date': next_month,
                'receiving_wallet': prop1.receiving_wallet,
                'is_active': True
            }
        )
        obl_d = RentObligation.objects.filter(schedule=sch_d, period_start_date=next_month).first()
        if not obl_d:
            obl_d = RentObligation.objects.create(
                schedule=sch_d,
                assignment=asg_d,
                property=prop1,
                unit=unit_2b,
                landlord=landlord_user,
                tenant=tenant_objs[3],
                period_start_date=next_month,
                period_end_date=(next_month + datetime.timedelta(days=32)).replace(day=1) - datetime.timedelta(days=1),
                due_date=next_month + datetime.timedelta(days=5),
                amount_due_usdc=Decimal('150.0000000'),
                amount_paid_usdc=Decimal('0.0000000'),
                outstanding_balance_usdc=Decimal('150.0000000'),
                asset_code='USDC',
                receiving_wallet=prop1.receiving_wallet,
                payment_memo='PM-TENANT-D-UPCM',
                status=RentObligation.Status.UPCOMING
            )
        obl_d.status = RentObligation.Status.UPCOMING
        obl_d.save()

        # Initialize Reconciliation Cursor
        StellarReconciliationCursor.objects.get_or_create(
            wallet_address=prop1.receiving_wallet,
            defaults={'last_paging_token': 'now'}
        )

        self.stdout.write(self.style.SUCCESS('Successfully seeded MVP 2 Property Management & Stellar Reconciliation Data!'))
        self.stdout.write(self.style.SUCCESS(f'  - Landlord: landlord@payarmove.com'))
        self.stdout.write(self.style.SUCCESS(f'  - Tenant A (Paid, 0 outstanding): tenant1@payarmove.com'))
        self.stdout.write(self.style.SUCCESS(f'  - Tenant B (Partially Paid, 100 outstanding): tenant2@payarmove.com'))
        self.stdout.write(self.style.SUCCESS(f'  - Tenant C (Overdue, 300 outstanding): tenant3@payarmove.com'))
        self.stdout.write(self.style.SUCCESS(f'  - Tenant D (Upcoming, 150 outstanding): tenant4@payarmove.com'))
