import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';

class MapLauncherService {
  /// Known center coordinates for Addis Ababa sub-cities
  static const Map<String, List<double>> subCityCoordinates = {
    'bole': [9.0016, 38.7852],
    'kirkos': [9.0118, 38.7516],
    'yeka': [9.0350, 38.8020],
    'arada': [9.0350, 38.7520],
    'lideta': [9.0100, 38.7350],
    'addis ketema': [9.0320, 38.7300],
    'nifas silk-lafto': [8.9750, 38.7350],
    'kolfe keranio': [9.0200, 38.7050],
    'gullele': [9.0600, 38.7400],
    'akaky kaliti': [8.9050, 38.7650],
    'lemi kura': [9.0250, 38.8350],
  };

  /// Resolves approximate coordinates for a sub-city name
  static List<double>? getSubCityCoords(String? subCityName) {
    if (subCityName == null || subCityName.isEmpty) return null;
    final normalized = subCityName.toLowerCase().replaceAll('sub-city', '').replaceAll('sub city', '').trim();
    for (final entry in subCityCoordinates.entries) {
      if (normalized.contains(entry.key) || entry.key.contains(normalized)) {
        return entry.value;
      }
    }
    return [9.0105, 38.7617]; // Addis Ababa central fallback
  }

  /// Calculates straight-line distance (km) using Haversine formula
  static double calculateDistanceKm(double lat1, double lon1, double lat2, double lon2) {
    const p = 0.017453292519943295; // Pi / 180
    final c = math.cos;
    final a = 0.5 -
        c((lat2 - lat1) * p) / 2 +
        c(lat1 * p) * c(lat2 * p) * (1 - c((lon2 - lon1) * p)) / 2;
    return 12742 * math.asin(math.sqrt(a)); // 2 * R * asin...
  }

  /// Estimates Addis Ababa driving time in minutes (accounting for urban traffic)
  static int estimateDrivingMinutes(double distanceKm) {
    // Average urban speed ~22 km/h + 5 mins buffer
    final mins = (distanceKm / 22 * 60).round() + 5;
    return mins < 8 ? 8 : mins;
  }

  /// Generates the Google Maps navigation URL
  static String buildGoogleMapsDirectionsUrl({
    double? destLat,
    double? destLng,
    String? destAddress,
    double? originLat,
    double? originLng,
    String? originAddress,
  }) {
    String destination;
    if (destLat != null && destLng != null && destLat != 0 && destLng != 0) {
      destination = '$destLat,$destLng';
    } else {
      final safeAddr = destAddress?.isNotEmpty == true ? destAddress! : 'Addis Ababa, Ethiopia';
      destination = Uri.encodeComponent('$safeAddr, Addis Ababa, Ethiopia');
    }

    var url = 'https://www.google.com/maps/dir/?api=1&destination=$destination&travelmode=driving';

    if (originLat != null && originLng != null && originLat != 0 && originLng != 0) {
      url += '&origin=$originLat,$originLng';
    } else if (originAddress != null && originAddress.isNotEmpty) {
      url += '&origin=${Uri.encodeComponent("$originAddress, Addis Ababa, Ethiopia")}';
    }

    return url;
  }

  /// Launches Google Maps Navigation with turn-by-turn driving directions
  static Future<bool> launchNavigation({
    double? destLat,
    double? destLng,
    String? destAddress,
    double? originLat,
    double? originLng,
    String? originAddress,
  }) async {
    final urlString = buildGoogleMapsDirectionsUrl(
      destLat: destLat,
      destLng: destLng,
      destAddress: destAddress,
      originLat: originLat,
      originLng: originLng,
      originAddress: originAddress,
    );

    debugPrint('Launching Google Maps navigation: $urlString');
    final uri = Uri.parse(urlString);

    try {
      final launched = await launchUrl(
        uri,
        mode: LaunchMode.externalApplication,
      );
      if (!launched) {
        return await launchUrl(uri, mode: LaunchMode.platformDefault);
      }
      return true;
    } catch (e) {
      debugPrint('Launch external failed: $e, trying platformDefault');
      try {
        return await launchUrl(uri, mode: LaunchMode.platformDefault);
      } catch (_) {
        return false;
      }
    }
  }
}
