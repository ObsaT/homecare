import 'package:flutter/material.dart';
import '../services/map_launcher_service.dart';
import '../theme/app_theme.dart';

class RouteMapCard extends StatelessWidget {
  final String originTitle;
  final String destinationTitle;
  final String? destinationLandmark;
  final double? destLat;
  final double? destLng;
  final double? originLat;
  final double? originLng;
  final String? originAddress;
  final bool compact;

  const RouteMapCard({
    super.key,
    required this.originTitle,
    required this.destinationTitle,
    this.destinationLandmark,
    this.destLat,
    this.destLng,
    this.originLat,
    this.originLng,
    this.originAddress,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    // Resolve coordinates if missing using sub-city names
    final effectiveDestLat = destLat ?? (MapLauncherService.getSubCityCoords(destinationTitle)?[0] ?? 9.0016);
    final effectiveDestLng = destLng ?? (MapLauncherService.getSubCityCoords(destinationTitle)?[1] ?? 38.7852);

    final effectiveOriginLat = originLat ?? (MapLauncherService.getSubCityCoords(originTitle)?[0] ?? 9.0105);
    final effectiveOriginLng = originLng ?? (MapLauncherService.getSubCityCoords(originTitle)?[1] ?? 38.7617);

    final distanceKm = MapLauncherService.calculateDistanceKm(
      effectiveOriginLat,
      effectiveOriginLng,
      effectiveDestLat,
      effectiveDestLng,
    );
    final travelMins = MapLauncherService.estimateDrivingMinutes(distanceKm);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.04),
            blurRadius: 10,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Visual Map Preview Header
          Container(
            height: compact ? 90 : 130,
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  const Color(0xFF1E293B),
                  const Color(0xFF0F172A),
                ],
              ),
            ),
            child: Stack(
              children: [
                // Stylized map grid pattern
                Positioned.fill(
                  child: CustomPaint(
                    painter: _MapGridPainter(),
                  ),
                ),

                // Live route trajectory line with badges
                Positioned.fill(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        // Caregiver Origin Pin
                        Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: const Color(0xFF10B981).withOpacity(0.2),
                                shape: BoxShape.circle,
                                border: Border.all(color: const Color(0xFF10B981), width: 2),
                              ),
                              child: const Icon(Icons.person_pin_circle_rounded, color: Color(0xFF10B981), size: 22),
                            ),
                            const SizedBox(height: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.black54,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                'You (Caregiver)',
                                style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),

                        // Animated connector path & estimated time
                        Expanded(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.center,
                                children: [
                                  const Icon(Icons.directions_car_rounded, color: Colors.amber, size: 14),
                                  const SizedBox(width: 4),
                                  Text(
                                    '${distanceKm.toStringAsFixed(1)} km • ~$travelMins min',
                                    style: const TextStyle(
                                      color: Colors.amber,
                                      fontSize: 11,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: 0.3,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Stack(
                                alignment: Alignment.center,
                                children: [
                                  Container(
                                    height: 3,
                                    margin: const EdgeInsets.symmetric(horizontal: 8),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(2),
                                      color: Colors.white24,
                                    ),
                                  ),
                                  Container(
                                    height: 3,
                                    margin: const EdgeInsets.symmetric(horizontal: 16),
                                    decoration: BoxDecoration(
                                      borderRadius: BorderRadius.circular(2),
                                      gradient: const LinearGradient(
                                        colors: [Color(0xFF10B981), Colors.amber, Color(0xFFEF4444)],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),

                        // Patient Destination Pin
                        Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Container(
                              padding: const EdgeInsets.all(6),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEF4444).withOpacity(0.2),
                                shape: BoxShape.circle,
                                border: Border.all(color: const Color(0xFFEF4444), width: 2),
                              ),
                              child: const Icon(Icons.location_on_rounded, color: Color(0xFFEF4444), size: 22),
                            ),
                            const SizedBox(height: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.black54,
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: const Text(
                                'Patient Home',
                                style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),

                // GPS Live Badge
                Positioned(
                  top: 8,
                  left: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.black45,
                      borderRadius: BorderRadius.circular(4),
                      border: Border.all(color: Colors.white12),
                    ),
                    child: Row(
                      children: [
                        Container(
                          width: 6,
                          height: 6,
                          decoration: const BoxDecoration(
                            color: Color(0xFF10B981),
                            shape: BoxShape.circle,
                          ),
                        ),
                        const SizedBox(width: 4),
                        const Text(
                          'Addis Ababa Navigation Ready',
                          style: TextStyle(color: Colors.white70, fontSize: 9, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Address Information & Google Maps Button
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Caregiver Start Point
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.trip_origin_rounded, size: 16, color: Color(0xFF10B981)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Caregiver Departure Point',
                            style: TextStyle(fontSize: 10, color: AppColors.textSecondary, fontWeight: FontWeight.bold),
                          ),
                          Text(
                            originTitle,
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const Padding(
                  padding: EdgeInsets.only(left: 7),
                  child: SizedBox(
                    height: 12,
                    child: VerticalDivider(thickness: 1.5, color: AppColors.border),
                  ),
                ),

                // Patient Destination Point
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Icon(Icons.location_on_rounded, size: 16, color: Color(0xFFEF4444)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Patient Destination Address',
                            style: TextStyle(fontSize: 10, color: AppColors.textSecondary, fontWeight: FontWeight.bold),
                          ),
                          Text(
                            destinationTitle,
                            style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                          ),
                          if (destinationLandmark != null && destinationLandmark!.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Text(
                              destinationLandmark!,
                              style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                // Google Maps Navigation Action Button
                SizedBox(
                  width: double.infinity,
                  height: 42,
                  child: ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF1A73E8), // Google Blue
                      foregroundColor: Colors.white,
                      elevation: 0,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    icon: const Icon(Icons.map_rounded, size: 18),
                    label: const Text(
                      'Navigate in Google Maps (GPS)',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, letterSpacing: 0.2),
                    ),
                    onPressed: () async {
                      final success = await MapLauncherService.launchNavigation(
                        destLat: effectiveDestLat,
                        destLng: effectiveDestLng,
                        destAddress: '$destinationTitle ${destinationLandmark ?? ""}',
                        originLat: effectiveOriginLat,
                        originLng: effectiveOriginLng,
                        originAddress: originTitle,
                      );
                      if (context.mounted && !success) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                            content: Text('Opening Google Maps in browser...'),
                            duration: Duration(seconds: 2),
                          ),
                        );
                      }
                    },
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MapGridPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white.withOpacity(0.04)
      ..strokeWidth = 1.0;

    const step = 24.0;
    for (double x = 0; x < size.width; x += step) {
      canvas.drawLine(Offset(x, 0), Offset(x, size.height), paint);
    }
    for (double y = 0; y < size.height; y += step) {
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
