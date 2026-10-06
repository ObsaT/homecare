import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';
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

  final List<Map<String, dynamic>> services = const [
    {
      'code': 'NURSING',
      'name': 'Nursing Care',
      'name_am': 'የነርሲንግ ክብካቤ',
      'icon': Icons.medical_services_outlined,
      'duration': '2–8 hours',
    },
    {
      'code': 'ELDERLY',
      'name': 'Elderly Care',
      'name_am': 'የአረጋውያን ክብካቤ',
      'icon': Icons.elderly_outlined,
      'duration': '4–12 hours',
    },
    {
      'code': 'POST_HOSPITAL',
      'name': 'Post-Hospital Care',
      'name_am': 'ከሆስፒታል መልስ',
      'icon': Icons.local_hospital_outlined,
      'duration': '4–24 hours',
    },
    {
      'code': 'WOUND_CARE',
      'name': 'Wound Care & Dressing',
      'name_am': 'የቁስል እጥበትና ማሰር',
      'icon': Icons.healing_outlined,
      'duration': '1–2 hours',
    },
    {
      'code': 'MEDICATION',
      'name': 'Medication Support',
      'name_am': 'የመድሃኒት ክትትል',
      'icon': Icons.medication_outlined,
      'duration': '1–2 hours',
    },
    {
      'code': 'PERSONAL_CARE',
      'name': 'Personal Care',
      'name_am': 'የግል ንጽህና ክብካቤ',
      'icon': Icons.clean_hands_outlined,
      'duration': '2–4 hours',
    },
    {
      'code': 'FEEDING',
      'name': 'Feeding Assistance',
      'name_am': 'የምግብ ድጋፍ',
      'icon': Icons.restaurant_outlined,
      'duration': '1–2 hours',
    },
    {
      'code': 'VITALS',
      'name': 'Vital Signs Monitoring',
      'name_am': 'የጤና ሁኔታ ክትትል',
      'icon': Icons.favorite_border_rounded,
      'duration': '1–3 hours',
    },
    {
      'code': 'PHYSIOTHERAPY',
      'name': 'Physiotherapy',
      'name_am': 'የፊዚዮቴራፒ አገልግሎት',
      'icon': Icons.accessibility_new_outlined,
      'duration': '1–2 hours',
    },
    {
      'code': 'OTHER',
      'name': 'Specialized Care',
      'name_am': 'ሌሎች ልዩ ፍላጎቶች',
      'icon': Icons.more_horiz_rounded,
      'duration': 'Custom review',
    },
  ];

  @override
  void initState() {
    super.initState();
    _fetchRequests();
  }

  Future<void> _fetchRequests() async {
    setState(() => _loadingRequests = true);
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

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Selam, ${user?.fullName ?? "Customer"}', style: const TextStyle(fontSize: 16)),
            const Text('Addis Ababa, Ethiopia', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
          ],
        ),
        actions: [
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
                child: const Row(
                  children: [
                    Icon(Icons.emergency_outlined, color: Color(0xFFB4791F), size: 24),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        'For medical emergencies, call 907 / 911 or visit the nearest hospital emergency room immediately.',
                        style: TextStyle(fontSize: 11, color: Color(0xFF5A4119), height: 1.3),
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
                          const Text(
                            'Need Care at Home?',
                            style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                          const SizedBox(height: 4),
                          const Text(
                            'Certified nurses and caregivers dispatched directly to your address.',
                            style: TextStyle(color: Colors.white70, fontSize: 12),
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
                            child: const Text('Request Care Now', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 12),
                    const Icon(Icons.home_work_rounded, color: Colors.white24, size: 70),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Active / Upcoming Visit Card (Live Production DB)
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Active Visit Status', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
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
                        const Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('No Active Care Visits', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                              SizedBox(height: 2),
                              Text('Your booked home care visits will appear here in real time.', style: TextStyle(color: AppColors.textSecondary, fontSize: 11)),
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
                              reference: ref,
                              serviceName: service,
                              status: status,
                              caregiverName: caregiver,
                              scheduledTime: time,
                            ),
                          ),
                        );
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
            const Text('Our Care Services', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
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
                return InkWell(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => BookCareScreen(preselectedService: s['code']),
                      ),
                    );
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
                          s['name'] as String,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary),
                        ),
                        Text(
                          s['name_am'] as String,
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
