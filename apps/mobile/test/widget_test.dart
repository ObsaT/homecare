import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:homecare_mobile/main.dart';
import 'package:homecare_mobile/core/network/api_client.dart';
import 'package:homecare_mobile/core/services/audio_notification_service.dart';
import 'package:homecare_mobile/core/services/map_launcher_service.dart';
import 'package:homecare_mobile/core/services/realtime_events_service.dart';
import 'package:homecare_mobile/features/auth/models/user.dart';

void main() {
  group('Mobile App Smoke & Unit Tests', () {
    testWidgets('HomeCareApp renders login screen and branding', (WidgetTester tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: HomeCareApp(),
        ),
      );

      // Verify branding and subtitles
      expect(find.text('Home Care Addis'), findsOneWidget);
      expect(find.text('Customer Mode'), findsOneWidget);
      expect(find.text('Caregiver / Nurse'), findsOneWidget);
      expect(find.text('Sign In With Account'), findsOneWidget);
    });

    testWidgets('Login screen toggles between customer and caregiver role modes', (WidgetTester tester) async {
      await tester.pumpWidget(
        const ProviderScope(
          child: HomeCareApp(),
        ),
      );

      // Tap Caregiver mode toggle
      await tester.tap(find.text('Caregiver / Nurse'));
      await tester.pumpAndSettle();

      expect(find.text('Caregiver / Nurse'), findsOneWidget);

      // Tap Customer mode toggle
      await tester.tap(find.text('Customer Mode'));
      await tester.pumpAndSettle();

      expect(find.text('Customer Mode'), findsOneWidget);
    });

    test('ApiClient initializes with standard base URL and authorization support', () {
      final client = ApiClient(baseUrl: 'http://localhost:3000/api/v1');
      expect(client.dio.options.baseUrl, 'http://localhost:3000/api/v1');

      client.setToken('test-jwt-token');
      // Token is saved internally
      expect(client.dio.interceptors.isNotEmpty, isTrue);
    });

    test('AppUser model serializes and deserializes correctly', () {
      final json = {
        'id': 'usr-12345',
        'full_name': 'Sister Almaz Hailu',
        'phone_e164': '+251911223344',
        'role': 'CAREGIVER',
      };

      final user = AppUser.fromJson(json);
      expect(user.id, 'usr-12345');
      expect(user.fullName, 'Sister Almaz Hailu');
      expect(user.phone, '+251911223344');
      expect(user.role, UserRole.caregiver);

      final customerJson = {
        'id': 'usr-999',
        'full_name': 'Dawit Haile',
        'phone_e164': '+251911999999',
        'role': 'CUSTOMER',
      };
      final customer = AppUser.fromJson(customerJson);
      expect(customer.role, UserRole.customer);
    });

    test('AudioNotificationService methods invoke safely across platforms', () {
      expect(() => AudioNotificationService.playChime(), returnsNormally);
      expect(() => AudioNotificationService.requestNotificationPermission(), returnsNormally);
      expect(
        () => AudioNotificationService.showNotification(
          title: 'Test Dispatch Alert',
          body: 'Care request for patient in Bole',
        ),
        returnsNormally,
      );
    });

    test('RealtimeEventsService connects and handles lifecycle cleanly', () {
      final client = ApiClient(baseUrl: 'http://localhost:3000/api/v1');
      client.setToken('jwt-caregiver-sample');
      expect(client.token, 'jwt-caregiver-sample');
      expect(client.baseUrl, 'http://localhost:3000/api/v1');

      final realtime = RealtimeEventsService(client);
      expect(() => realtime.connect(), returnsNormally);
      expect(() => realtime.disconnect(), returnsNormally);
      expect(() => realtime.dispose(), returnsNormally);
    });

    test('MapLauncherService builds valid Google Maps navigation URLs and calculations', () {
      final url = MapLauncherService.buildGoogleMapsDirectionsUrl(
        destLat: 9.0016,
        destLng: 38.7852,
        originLat: 9.0105,
        originLng: 38.7617,
      );
      expect(url, contains('https://www.google.com/maps/dir/?api=1'));
      expect(url, contains('destination=9.0016,38.7852'));
      expect(url, contains('origin=9.0105,38.7617'));
      expect(url, contains('travelmode=driving'));

      // Test distance calculation between Bole and central Addis
      final distance = MapLauncherService.calculateDistanceKm(9.0105, 38.7617, 9.0016, 38.7852);
      expect(distance, greaterThan(1.0));
      expect(distance, lessThan(10.0));

      final driveTime = MapLauncherService.estimateDrivingMinutes(distance);
      expect(driveTime, greaterThanOrEqualTo(8));

      // Test sub-city coordinates resolution
      final boleCoords = MapLauncherService.getSubCityCoords('Bole Sub-City');
      expect(boleCoords, isNotNull);
      expect(boleCoords![0], closeTo(9.0016, 0.01));
    });
  });
}
