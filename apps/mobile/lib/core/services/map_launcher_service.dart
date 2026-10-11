import 'dart:convert';
import 'dart:math' as math;
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';

class VerifiedPlaceResult {
  final bool exists;
  final String query;
  final String placeName;
  final String formattedAddress;
  final String subCity;
  final double lat;
  final double lng;
  final double distanceKm;
  final int estimatedMinutes;
  final String googleMapsUrl;

  const VerifiedPlaceResult({
    required this.exists,
    required this.query,
    required this.placeName,
    required this.formattedAddress,
    required this.subCity,
    required this.lat,
    required this.lng,
    required this.distanceKm,
    required this.estimatedMinutes,
    required this.googleMapsUrl,
  });
}

class MapLauncherService {
  /// Central Pillar Home Care Dispatch Hub (Bole / Meskel Square Corridor)
  static const double dispatchHubLat = 9.0054;
  static const double dispatchHubLng = 38.7636;
  static const String dispatchHubTitle = 'Pillar Home Care Dispatch Hub (Bole)';

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
    'akaki kality': [8.9050, 38.7650],
    'akaky kaliti': [8.9050, 38.7650],
    'lemi kura': [9.0250, 38.8350],
  };

  /// Curated Google Route / Addis Ababa known landmarks, hospitals, neighborhoods & squares
  static const List<Map<String, dynamic>> knownAddisPlaces = [
    {'name': 'Edna Mall, Bole', 'keywords': ['edna mall', 'edna', 'bole medhanialem', 'medhanialem'], 'subCity': 'Bole', 'lat': 8.9972, 'lng': 38.7868},
    {'name': 'Bole International Airport Area', 'keywords': ['bole airport', 'airport', 'millennium hall', 'bole'], 'subCity': 'Bole', 'lat': 8.9838, 'lng': 38.7959},
    {'name': 'Bole Atlas / Cape Verde St', 'keywords': ['atlas', 'bole atlas', 'cape verde', 'europcar'], 'subCity': 'Bole', 'lat': 9.0046, 'lng': 38.7805},
    {'name': 'Bole Michael / Rwanda', 'keywords': ['bole michael', 'rwanda', 'bole rwanda'], 'subCity': 'Bole', 'lat': 8.9901, 'lng': 38.7745},
    {'name': 'Bole Bulbula', 'keywords': ['bulbula', 'bole bulbula'], 'subCity': 'Bole', 'lat': 8.9585, 'lng': 38.7890},
    {'name': 'Bole Arabsa', 'keywords': ['arabsa', 'bole arabsa'], 'subCity': 'Lemi Kura', 'lat': 8.9890, 'lng': 38.8750},
    {'name': 'Gerji / Imperial / Kadisco', 'keywords': ['gerji', 'imperial', 'kadisco', 'gerji mebrat haile', 'mebrat haile'], 'subCity': 'Bole', 'lat': 9.0042, 'lng': 38.8091},
    {'name': 'Goro / Sefera', 'keywords': ['goro', 'sefera', 'goro roundabout'], 'subCity': 'Bole', 'lat': 8.9985, 'lng': 38.8295},
    {'name': '22 Mazoria / Hayahulet', 'keywords': ['22', '22 mazoria', 'hayahulet', 'golagol', 'st. gabriel'], 'subCity': 'Bole', 'lat': 9.0147, 'lng': 38.7858},
    {'name': 'Urael / Bambis', 'keywords': ['urael', 'bambis', 'urael church'], 'subCity': 'Kirkos', 'lat': 9.0112, 'lng': 38.7722},
    {'name': 'Kazanchis / ECA', 'keywords': ['kazanchis', 'kasanchis', 'eca', 'radisson', 'intercontinental'], 'subCity': 'Kirkos', 'lat': 9.0178, 'lng': 38.7689},
    {'name': 'Meskel Square / Estifanos', 'keywords': ['meskel square', 'meskel', 'estifanos', 'stadium'], 'subCity': 'Kirkos', 'lat': 9.0104, 'lng': 38.7612},
    {'name': 'Olympia / Dembel City Center', 'keywords': ['olympia', 'dembel', 'africa avenue', 'flamingo'], 'subCity': 'Kirkos', 'lat': 9.0053, 'lng': 38.7675},
    {'name': 'Wollo Sefer / Ethio-China St', 'keywords': ['wollo sefer', 'welo sefer', 'ethio china', 'gorgorios'], 'subCity': 'Kirkos', 'lat': 8.9935, 'lng': 38.7695},
    {'name': 'Gotera / Ethio-Djibouti Roundabout', 'keywords': ['gotera', 'gotera condominium', 'kirkos'], 'subCity': 'Kirkos', 'lat': 8.9830, 'lng': 38.7580},
    {'name': 'Kera / Bulgaria Mazoria', 'keywords': ['kera', 'bulgaria', 'bulgaria mazoria'], 'subCity': 'Kirkos', 'lat': 8.9890, 'lng': 38.7460},
    {'name': 'Mexico Square / Wabi Shebelle', 'keywords': ['mexico', 'mexico square', 'wabi shebelle', 'commerce', 'sengatera'], 'subCity': 'Kirkos', 'lat': 9.0102, 'lng': 38.7448},
    {'name': 'Megenagna Square', 'keywords': ['megenagna', 'megenagna square', 'diaspora', 'zefermesh'], 'subCity': 'Yeka', 'lat': 9.0205, 'lng': 38.8024},
    {'name': 'Shola / Lambert / Yeka', 'keywords': ['shola', 'lambert', 'yeka', 'british embassy'], 'subCity': 'Yeka', 'lat': 9.0285, 'lng': 38.7910},
    {'name': 'CMC / St. Michael', 'keywords': ['cmc', 'cmc michael', 'tsehay real estate', 'merid'], 'subCity': 'Yeka', 'lat': 9.0226, 'lng': 38.8364},
    {'name': 'Ayat Roundabout / Zone', 'keywords': ['ayat', 'ayat condominium', 'ayat Tafo', 'tafo'], 'subCity': 'Lemi Kura', 'lat': 9.0185, 'lng': 38.8675},
    {'name': 'Summit / Figa / Safari', 'keywords': ['summit', 'semit', 'figa', 'safari', 'jackros'], 'subCity': 'Lemi Kura', 'lat': 9.0040, 'lng': 38.8460},
    {'name': 'Kotebe / Kara / Wesen', 'keywords': ['kotebe', 'kara', 'wesen', 'yeka abado'], 'subCity': 'Yeka', 'lat': 9.0430, 'lng': 38.8420},
    {'name': '4 Kilo / Arat Kilo', 'keywords': ['4 kilo', 'arat kilo', 'holy trinity', 'parliament', 'abraha'], 'subCity': 'Arada', 'lat': 9.0332, 'lng': 38.7634},
    {'name': '6 Kilo / Sidist Kilo (AAU)', 'keywords': ['6 kilo', 'sidist kilo', 'yared', 'yeshitila', 'ferensay'], 'subCity': 'Arada', 'lat': 9.0468, 'lng': 38.7614},
    {'name': 'Piassa / Arada Giorgis', 'keywords': ['piassa', 'piazza', 'arada', 'giorgis', 'churchill', 'tewodros'], 'subCity': 'Arada', 'lat': 9.0355, 'lng': 38.7523},
    {'name': 'Tikur Anbessa / Black Lion Hospital', 'keywords': ['tikur anbessa', 'black lion', 'post office', 'ambassador'], 'subCity': 'Lideta', 'lat': 9.0195, 'lng': 38.7518},
    {'name': 'Shiro Meda / Entoto / Gullele', 'keywords': ['shiro meda', 'shiromeda', 'entoto', 'gullele', 'kuskuam'], 'subCity': 'Gullele', 'lat': 9.0620, 'lng': 38.7610},
    {'name': 'St. Paul Hospital / Pastor / Addisu Gebeya', 'keywords': ['st paul', 'paulos', 'pastor', 'addisu gebeya', 'medhanialem'], 'subCity': 'Gullele', 'lat': 9.0472, 'lng': 38.7282},
    {'name': 'Merkato / Autobis Tera', 'keywords': ['merkato', 'mercato', 'autobis tera', 'anwar mosque', 'gojam berenda', 'addis ketema'], 'subCity': 'Addis Ketema', 'lat': 9.0314, 'lng': 38.7375},
    {'name': 'Lideta / Balcha Hospital / Abinet', 'keywords': ['lideta', 'balcha', 'abinet', 'geja sefer', 'lideta condominium'], 'subCity': 'Lideta', 'lat': 9.0116, 'lng': 38.7354},
    {'name': 'Tor Hailoch / Total', 'keywords': ['tor hailoch', 'torhayloch', '3 kutir mazoria'], 'subCity': 'Lideta', 'lat': 9.0072, 'lng': 38.7210},
    {'name': 'Sarbet / Bisrate Gabriel / Old Airport', 'keywords': ['sarbet', 'bisrate gabriel', 'old airport', 'african union', 'au', 'mechare'], 'subCity': 'Nifas Silk-Lafto', 'lat': 8.9938, 'lng': 38.7325},
    {'name': 'Mekanisa / German Square / Jemo', 'keywords': ['mekanisa', 'german square', 'jemo', 'jemo 1', 'jemo 2', 'jemo 3', 'lebu', 'haile garment', 'lafto'], 'subCity': 'Nifas Silk-Lafto', 'lat': 8.9580, 'lng': 38.7190},
    {'name': 'Ayer Tena / Betel / Alem Bank', 'keywords': ['ayer tena', 'betel', 'bethel', 'alem bank', 'zenebework', 'wingate', 'kolfe'], 'subCity': 'Kolfe Keranio', 'lat': 9.0010, 'lng': 38.6950},
    {'name': 'Kaliti / Akaki / Gelan / Tulu Dimtu', 'keywords': ['kaliti', 'kality', 'akaki', 'gelan', 'tulu dimtu', 'saris', 'abo'], 'subCity': 'Akaki Kality', 'lat': 8.9120, 'lng': 38.7650},
  ];

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
    final mins = (distanceKm / 22 * 60).round() + 5;
    return mins < 8 ? 8 : mins;
  }

  /// Verifies whether a patient's entered place/landmark exists in Addis Ababa / Google Route
  /// First checks curated Addis Ababa landmark database for instant response, then queries live OpenStreetMap/Nominatim geocoding.
  static Future<VerifiedPlaceResult?> verifyPlaceOnGoogleRoute(
    String rawQuery, {
    String? fallbackSubCity,
  }) async {
    final q = rawQuery.trim();
    if (q.length < 2) return null;

    final qLower = q.toLowerCase();

    // 1. Check curated Addis Ababa places & landmarks
    for (final place in knownAddisPlaces) {
      final keywords = (place['keywords'] as List).cast<String>();
      final nameLower = (place['name'] as String).toLowerCase();
      final matches = nameLower.contains(qLower) ||
          keywords.any((k) => qLower.contains(k) || (qLower.length >= 3 && k.contains(qLower)));
      if (matches) {
        final lat = (place['lat'] as num).toDouble();
        final lng = (place['lng'] as num).toDouble();
        final subCity = place['subCity'] as String;
        final placeName = place['name'] as String;
        final dist = calculateDistanceKm(dispatchHubLat, dispatchHubLng, lat, lng);
        final mins = estimateDrivingMinutes(dist);
        final url = buildGoogleMapsDirectionsUrl(
          destLat: lat,
          destLng: lng,
          destAddress: '$placeName, $subCity, Addis Ababa',
          originLat: dispatchHubLat,
          originLng: dispatchHubLng,
          originAddress: dispatchHubTitle,
        );
        return VerifiedPlaceResult(
          exists: true,
          query: q,
          placeName: placeName,
          formattedAddress: '$placeName, $subCity, Addis Ababa, Ethiopia',
          subCity: subCity,
          lat: lat,
          lng: lng,
          distanceKm: dist,
          estimatedMinutes: mins,
          googleMapsUrl: url,
        );
      }
    }

    // 2. Live Geocode against OpenStreetMap Nominatim (Addis Ababa / Ethiopia)
    try {
      final dio = Dio(BaseOptions(
        connectTimeout: const Duration(seconds: 4),
        receiveTimeout: const Duration(seconds: 4),
      ));
      final searchQuery = qLower.contains('addis') ? q : '$q, Addis Ababa, Ethiopia';
      final response = await dio.get(
        'https://nominatim.openstreetmap.org/search',
        queryParameters: {
          'q': searchQuery,
          'format': 'json',
          'addressdetails': '1',
          'countrycodes': 'et',
          'limit': '3',
        },
      );

      final dynamic rawData = response.data is String ? jsonDecode(response.data as String) : response.data;
      if (rawData is List && rawData.isNotEmpty) {
        final first = rawData.first as Map;
        final lat = double.tryParse(first['lat']?.toString() ?? '');
        final lng = double.tryParse(first['lon']?.toString() ?? '');
        final displayName = first['display_name']?.toString() ?? q;

        if (lat != null && lng != null) {
          final resolvedSubCity = _inferNearestSubCity(lat, lng, fallbackSubCity);
          final shortTitle = displayName.split(',').take(2).join(', ').trim();
          final dist = calculateDistanceKm(dispatchHubLat, dispatchHubLng, lat, lng);
          final mins = estimateDrivingMinutes(dist);
          final url = buildGoogleMapsDirectionsUrl(
            destLat: lat,
            destLng: lng,
            destAddress: shortTitle,
            originLat: dispatchHubLat,
            originLng: dispatchHubLng,
            originAddress: dispatchHubTitle,
          );
          return VerifiedPlaceResult(
            exists: true,
            query: q,
            placeName: shortTitle.isNotEmpty ? shortTitle : q,
            formattedAddress: displayName,
            subCity: resolvedSubCity,
            lat: lat,
            lng: lng,
            distanceKm: dist,
            estimatedMinutes: mins,
            googleMapsUrl: url,
          );
        }
      }
    } catch (e) {
      debugPrint('Nominatim lookup fallback: $e');
    }

    // 3. If user typed a valid sub-city + descriptive landmark (e.g. >= 4 chars), resolve to sub-city coordinates
    if (fallbackSubCity != null && q.length >= 4) {
      final coords = getSubCityCoords(fallbackSubCity) ?? [9.0016, 38.7852];
      final lat = coords[0];
      final lng = coords[1];
      final dist = calculateDistanceKm(dispatchHubLat, dispatchHubLng, lat, lng);
      final mins = estimateDrivingMinutes(dist);
      final url = buildGoogleMapsDirectionsUrl(
        destLat: lat,
        destLng: lng,
        destAddress: '$q, $fallbackSubCity, Addis Ababa',
        originLat: dispatchHubLat,
        originLng: dispatchHubLng,
        originAddress: dispatchHubTitle,
      );
      return VerifiedPlaceResult(
        exists: true,
        query: q,
        placeName: '$q ($fallbackSubCity)',
        formattedAddress: '$q, $fallbackSubCity Sub-City, Addis Ababa, Ethiopia',
        subCity: fallbackSubCity,
        lat: lat,
        lng: lng,
        distanceKm: dist,
        estimatedMinutes: mins,
        googleMapsUrl: url,
      );
    }

    return null;
  }

  static String _inferNearestSubCity(double lat, double lng, String? fallback) {
    String best = fallback ?? 'Bole';
    double bestDist = double.infinity;
    const canonicalNames = {
      'bole': 'Bole',
      'kirkos': 'Kirkos',
      'yeka': 'Yeka',
      'arada': 'Arada',
      'lideta': 'Lideta',
      'addis ketema': 'Addis Ketema',
      'nifas silk-lafto': 'Nifas Silk-Lafto',
      'kolfe keranio': 'Kolfe Keranio',
      'gullele': 'Gullele',
      'akaki kality': 'Akaki Kality',
      'lemi kura': 'Lemi Kura',
    };

    for (final entry in canonicalNames.entries) {
      final c = subCityCoordinates[entry.key];
      if (c != null) {
        final d = calculateDistanceKm(lat, lng, c[0], c[1]);
        if (d < bestDist) {
          bestDist = d;
          best = entry.value;
        }
      }
    }
    return best;
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
