import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/localization/app_localizations.dart';
import '../../../core/network/api_client.dart';
import '../../../core/services/audio_notification_service.dart';
import '../../../core/services/map_launcher_service.dart';
import '../../../core/services/realtime_events_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/route_map_card.dart';
import '../../auth/providers/auth_provider.dart';
import 'book_care_screen.dart';
import 'request_tracking_screen.dart';

class CustomerHomeScreen extends ConsumerStatefulWidget {
  const CustomerHomeScreen({super.key});

  @override
  ConsumerState<CustomerHomeScreen> createState() => _CustomerHomeScreenState();
}

class _CustomerHomeScreenState extends ConsumerState<CustomerHomeScreen> {
  List<Map<String, dynamic>> _myRequests = [];
  bool _loadingRequests = true;
  StreamSubscription<Map<String, dynamic>>? _realtimeSubscription;

  String? _savedSubCity;
  String? _savedLandmark;
  double? _savedLat;
  double? _savedLng;

  final List<Map<String, dynamic>> services = const [
    {
      'code': 'NURSING',
      'name': 'Nursing Care',
      'name_am': 'የነርሲንግ ክብካቤ',
      'name_om': 'Kunuunsa Narsii',
      'icon': Icons.medical_services_outlined,
      'duration': '2–8 hours',
    },
    {
      'code': 'ELDERLY',
      'name': 'Elderly Care',
      'name_am': 'የአረጋውያን ክብካቤ',
      'name_om': 'Kunuunsa Maanguddootaa',
      'icon': Icons.elderly_outlined,
      'duration': '4–12 hours',
    },
    {
      'code': 'POST_HOSPITAL',
      'name': 'Post-Hospital Care',
      'name_am': 'ከሆስፒታል መልስ',
      'name_om': 'Kunuunsa Hospitaala Boodaa',
      'icon': Icons.local_hospital_outlined,
      'duration': '4–24 hours',
    },
    {
      'code': 'WOUND_CARE',
      'name': 'Wound Care & Dressing',
      'name_am': 'የቁስል እጥበትና ማሰር',
      'name_om': 'Madaa Qulqulleessuu fi Hidhuu',
      'icon': Icons.healing_outlined,
      'duration': '1–2 hours',
    },
    {
      'code': 'MEDICATION',
      'name': 'Medication Support',
      'name_am': 'የመድሃኒት ክትትል',
      'name_om': 'Hordoffii Qorichaa',
      'icon': Icons.medication_outlined,
      'duration': '1–2 hours',
    },
    {
      'code': 'PERSONAL_CARE',
      'name': 'Personal Care',
      'name_am': 'የግል ንጽህና ክብካቤ',
      'name_om': 'Qulqullina Dhuunfaa',
      'icon': Icons.clean_hands_outlined,
      'duration': '2–4 hours',
    },
    {
      'code': 'FEEDING',
      'name': 'Feeding Assistance',
      'name_am': 'የምግብ ድጋፍ',
      'name_om': 'Deeggarsa Nyaataa',
      'icon': Icons.restaurant_outlined,
      'duration': '1–2 hours',
    },
    {
      'code': 'VITALS',
      'name': 'Vital Signs Monitoring',
      'name_am': 'የጤና ሁኔታ ክትትል',
      'name_om': 'Hordoffii Mallattoo Fayyaa',
      'icon': Icons.favorite_border_rounded,
      'duration': '1–3 hours',
    },
    {
      'code': 'PHYSIOTHERAPY',
      'name': 'Physiotherapy',
      'name_am': 'የፊዚዮቴራፒ አገልግሎት',
      'name_om': 'Tajaajila Fiiziyooteraappii',
      'icon': Icons.accessibility_new_outlined,
      'duration': '1–2 hours',
    },
    {
      'code': 'OTHER',
      'name': 'Specialized Care',
      'name_am': 'ሌሎች ልዩ ፍላጎቶች',
      'name_om': 'Kunuunsa Addaa Biroo',
      'icon': Icons.more_horiz_rounded,
      'duration': 'Custom review',
    },
  ];

  @override
  void initState() {
    super.initState();
    _loadSavedLocation();
    _fetchRequests();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      AudioNotificationService.requestNotificationPermission();
      _initRealtimeListener();
    });
  }

  Future<void> _loadSavedLocation() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      if (mounted) {
        setState(() {
          _savedSubCity = prefs.getString('hc_customer_sub_city');
          _savedLandmark = prefs.getString('hc_customer_landmark');
          _savedLat = prefs.getDouble('hc_customer_lat');
          _savedLng = prefs.getDouble('hc_customer_lng');
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _realtimeSubscription?.cancel();
    super.dispose();
  }

  void _initRealtimeListener() {
    try {
      final realtime = ref.read(realtimeEventsServiceProvider);
      realtime.connect();
      _realtimeSubscription?.cancel();
      _realtimeSubscription = realtime.stream.listen((event) {
        _handleRealtimeEvent(event);
      });
    } catch (_) {}
  }

  void _handleRealtimeEvent(Map<String, dynamic> event) {
    final type = event['type']?.toString();
    final data = event['data'] is Map ? Map<String, dynamic>.from(event['data'] as Map) : <String, dynamic>{};

    if (type == 'VISIT_STATUS_CHANGED' ||
        type == 'OFFER_ACCEPTED' ||
        type == 'QUOTE_UPDATED' ||
        type == 'PAYMENT_CONFIRMED' ||
        type == 'REQUEST_CANCELLED') {
      AudioNotificationService.playChime();
      _fetchRequests();

      if (mounted) {
        String title = 'Care Visit Update';
        String msg = data['message']?.toString() ?? 'Status updated for your home care visit.';
        if (type == 'VISIT_STATUS_CHANGED') {
          final status = data['status']?.toString() ?? 'UPDATED';
          if (status == 'CONFIRMED') {
            title = '🎉 Caregiver Confirmed!';
            msg = '${data['caregiver_name'] ?? 'Your caregiver'} has accepted your care visit.';
          } else if (status == 'EN_ROUTE') {
            title = '🚗 Caregiver On The Way!';
            msg = '${data['caregiver_name'] ?? 'Your caregiver'} is travelling to your location.';
          } else if (status == 'IN_PROGRESS') {
            title = '🩺 Visit Started';
            msg = 'Caregiver has arrived and started the session.';
          } else if (status == 'COMPLETED') {
            title = '✅ Visit Completed';
            msg = 'Your care session has been completed. Review is now open.';
          }
        } else if (type == 'QUOTE_UPDATED') {
          title = '📋 Custom Quote Updated';
          msg = 'Admin updated the service quote to ETB ${(num.tryParse(data['quote_price_santim']?.toString() ?? '0') ?? 0) / 100}.';
        } else if (type == 'PAYMENT_CONFIRMED') {
          title = '💳 Payment Verified';
          msg = 'Your payment of ETB ${data['amount_etb'] ?? ''} has been verified.';
        } else if (type == 'REQUEST_CANCELLED') {
          title = 'Request Cancelled';
          msg = 'Your request has been cancelled.';
        }

        AudioNotificationService.showNotification(title: title, body: msg);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Row(
              children: [
                const Icon(Icons.notifications_active_rounded, color: Colors.white, size: 20),
                const SizedBox(width: 8),
                Expanded(child: Text('$title: $msg')),
              ],
            ),
            backgroundColor: AppColors.primary,
            behavior: SnackBarBehavior.floating,
            duration: const Duration(seconds: 4),
          ),
        );
      }
    }
  }

  Future<void> _fetchRequests() async {
    setState(() => _loadingRequests = true);
    await _loadSavedLocation();
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.dio.get('/requests');
      final data = res.data['data'] as List?;
      if (data != null) {
        setState(() {
          _myRequests = data.map((item) => Map<String, dynamic>.from(item as Map)).toList();
          _loadingRequests = false;
        });
      } else {
        setState(() => _loadingRequests = false);
      }
    } catch (_) {
      setState(() => _loadingRequests = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final lang = ref.watch(languageProvider);
    String tr(String key) => AppStrings.tr(lang, key);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('${tr('greeting_prefix')}, ${user?.fullName ?? "Customer"}', style: const TextStyle(fontSize: 16)),
            Text(tr('addis_ababa_ethiopia'), style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ],
        ),
        actions: [
          const LanguageDropdownChip(),
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh Requests',
            onPressed: _fetchRequests,
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            onPressed: () => ref.read(authProvider.notifier).logout(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetchRequests,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Emergency Medical Disclaimer Card (Spec Requirement 9)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFFBF2E2),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE9C99A)),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.emergency_outlined, color: Color(0xFFB4791F), size: 24),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        tr('emergency_disclaimer'),
                        style: const TextStyle(fontSize: 11, color: Color(0xFF5A4119), height: 1.3),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Hero Booking CTA
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [AppColors.primary, AppColors.primaryHover],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            tr('need_care_title'),
                            style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            tr('need_care_subtitle'),
                            style: const TextStyle(color: Colors.white70, fontSize: 12),
                          ),
                          const SizedBox(height: 16),
                          ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.white,
                              foregroundColor: AppColors.primary,
                              minimumSize: const Size(140, 36),
                              padding: const EdgeInsets.symmetric(horizontal: 16),
                            ),
                            onPressed: () async {
                              await Navigator.push(
                                context,
                                MaterialPageRoute(builder: (_) => const BookCareScreen()),
                              );
                              _fetchRequests();
                            },
                            child: Text(tr('request_care_now_btn'), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Icon(Icons.home_work_rounded, color: Colors.white24, size: 70),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Registered Patient Google Route Card (if registered with location)
              if (_savedLandmark != null && _savedLandmark!.isNotEmpty) ...[
                RouteMapCard(
                  originTitle: MapLauncherService.dispatchHubTitle,
                  destinationTitle: '${_savedSubCity ?? "Bole"}, Addis Ababa',
                  destinationLandmark: _savedLandmark,
                  originLat: MapLauncherService.dispatchHubLat,
                  originLng: MapLauncherService.dispatchHubLng,
                  destLat: _savedLat,
                  destLng: _savedLng,
                  compact: true,
                ),
                const SizedBox(height: 20),
              ],

              // Active / Upcoming Visit Card (Live Production DB)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(tr('active_visit_status'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                  if (_myRequests.isNotEmpty)
                    Text(
                      '${_myRequests.length} Active',
                      style: const TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.bold),
                    ),
                ],
              ),
              const SizedBox(height: 8),

              if (_loadingRequests)
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 24.0),
                  child: Center(child: CircularProgressIndicator()),
                )
              else if (_myRequests.isEmpty)
                Card(
                  child: Padding(
                    padding: const EdgeInsets.all(16.0),
                    child: Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(10),
                          decoration: BoxDecoration(
                            color: Colors.grey.shade100,
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.calendar_today_outlined, color: AppColors.textSecondary),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(tr('no_active_visits'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                              const SizedBox(height: 2),
                              Text(tr('no_active_visits_sub'), style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else
                ..._myRequests.map((req) {
                  final ref = req['reference'] ?? 'REQ';
                  final service = req['service_name_en'] ?? req['service_code'] ?? 'Home Care';
                  final status = req['status'] ?? 'SUBMITTED';
                  final caregiver = req['caregiver_name'];
                  final time = req['preferred_time'] ?? '10:00 AM';

                  return Container(
                    margin: const EdgeInsets.only(bottom: 10),
                    child: GestureDetector(
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(
                            builder: (_) => RequestTrackingScreen(
                              requestId: req['id']?.toString(),
                              appointmentId: req['appointment_id']?.toString(),
                              reference: ref,
                              serviceName: service,
                              status: status,
                              caregiverName: caregiver,
                              scheduledTime: time,
                            ),
                          ),
                        ).then((_) => _fetchRequests());
                      },
                      child: Card(
                        child: Padding(
                          padding: const EdgeInsets.all(14.0),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(10),
                                decoration: BoxDecoration(
                                  color: status == 'COMPLETED'
                                      ? AppColors.success.withOpacity(0.1)
                                      : AppColors.primary.withOpacity(0.1),
                                  shape: BoxShape.circle,
                                ),
                                child: Icon(
                                  status == 'COMPLETED' ? Icons.check_circle : Icons.medical_services_rounded,
                                  color: status == 'COMPLETED' ? AppColors.success : AppColors.primary,
                                ),
                              ),
                              const SizedBox(width: 14),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text('$service', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                                        const Spacer(),
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                          decoration: BoxDecoration(
                                            color: AppColors.primaryLight,
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            status,
                                            style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.primary),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 3),
                                    Text(
                                      caregiver != null ? 'Nurse: $caregiver' : 'Awaiting caregiver assignment',
                                      style: TextStyle(
                                        color: caregiver != null ? AppColors.primary : AppColors.accentWarning,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                    const SizedBox(height: 2),
                                    Text('$ref • Scheduled: $time', style: const TextStyle(color: AppColors.textSecondary, fontSize: 11)),
                                  ],
                                ),
                              ),
                              const Icon(Icons.chevron_right_rounded, color: AppColors.textTertiary),
                            ],
                          ),
                        ),
                      ),
                    ),
                  );
                }),
              const SizedBox(height: 24),

              // Services Grid
              Text(tr('our_care_services'), style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
              const SizedBox(height: 12),
              GridView.builder(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  childAspectRatio: 1.35,
                  crossAxisSpacing: 12,
                  mainAxisSpacing: 12,
                ),
                itemCount: services.length,
                itemBuilder: (context, index) {
                  final s = services[index];
                  final primaryTitle = lang == AppLanguage.am
                      ? (s['name_am'] as String)
                      : lang == AppLanguage.om
                          ? (s['name_om'] as String)
                          : (s['name'] as String);
                  final secondaryTitle = lang == AppLanguage.en
                      ? '${s['name_am']} • ${s['name_om']}'
                      : (s['name'] as String);

                  return InkWell(
                    onTap: () async {
                      await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => BookCareScreen(preselectedService: s['code']),
                        ),
                      );
                      _fetchRequests();
                    },
                    borderRadius: BorderRadius.circular(16),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: AppColors.borderSubtle),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Icon(s['icon'] as IconData, color: AppColors.primary, size: 26),
                          const Spacer(),
                          Text(
                            primaryTitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary),
                          ),
                          Text(
                            secondaryTitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            s['duration'] as String,
                            style: const TextStyle(fontSize: 10, color: AppColors.accent, fontWeight: FontWeight.w600),
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}
