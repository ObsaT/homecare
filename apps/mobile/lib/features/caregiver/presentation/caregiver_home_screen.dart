import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import 'visit_execution_screen.dart';

class CaregiverHomeScreen extends ConsumerStatefulWidget {
  const CaregiverHomeScreen({super.key});

  @override
  ConsumerState<CaregiverHomeScreen> createState() => _CaregiverHomeScreenState();
}

class _CaregiverHomeScreenState extends ConsumerState<CaregiverHomeScreen> {
  bool _isLoading = true;
  bool _isAvailable = true;
  Map<String, dynamic>? _profile;
  List<Map<String, dynamic>> _offers = [];
  List<Map<String, dynamic>> _upcomingVisits = [];

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    final api = ref.read(apiClientProvider);
    try {
      final profileRes = await api.dio.get('/caregiver/profile');
      final offersRes = await api.dio.get('/caregiver/offers');
      final apptsRes = await api.dio.get('/caregiver/appointments');

      if (mounted) {
        setState(() {
          final profileData = profileRes.data is Map && profileRes.data['data'] != null
              ? profileRes.data['data']
              : profileRes.data;
          _profile = Map<String, dynamic>.from(profileData as Map);
          _isAvailable = _profile?['is_available'] == true;

          final rawOffers = (offersRes.data is Map ? offersRes.data['data'] : offersRes.data) as List? ?? [];
          _offers = rawOffers.map((o) => Map<String, dynamic>.from(o as Map)).toList();

          final rawAppts = (apptsRes.data is Map ? apptsRes.data['data'] : apptsRes.data) as List? ?? [];
          _upcomingVisits = rawAppts.map((a) => Map<String, dynamic>.from(a as Map)).toList();

          _isLoading = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _toggleAvailability(bool val) async {
    setState(() => _isAvailable = val);
    try {
      final api = ref.read(apiClientProvider);
      await api.dio.patch('/caregiver/availability', data: {'is_available': val});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(val ? 'Status updated: Available for dispatch' : 'Status updated: Off-duty'),
            duration: const Duration(seconds: 2),
          ),
        );
      }
    } catch (e) {
      setState(() => _isAvailable = !val);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update status: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<void> _acceptOffer(String appointmentId) async {
    try {
      final api = ref.read(apiClientProvider);
      await api.dio.post('/caregiver/offers/$appointmentId/accept');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Assignment accepted! Customer notified and visit locked.'),
            backgroundColor: AppColors.success,
          ),
        );
      }
      await _fetchData();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to accept offer: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<void> _declineOffer(String appointmentId) async {
    try {
      final api = ref.read(apiClientProvider);
      await api.dio.post('/caregiver/offers/$appointmentId/decline', data: {'reason': 'Caregiver unavailable'});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Assignment declined. Dispatch will reassign.')),
        );
      }
      await _fetchData();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to decline offer: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;
    final ratingAvg = _profile?['rating_avg'] != null ? '${_profile!['rating_avg']} ★' : '4.9 ★';
    final completedCount = _profile?['completed_visits'] != null ? '${_profile!['completed_visits']}' : '0';
    final homeSubCity = _profile?['home_sub_city'] ?? 'Bole Sub-City';
    final radiusKm = _profile?['notification_radius_km'] ?? 10;
    final coverageList = _profile?['coverage_sub_cities'] as List? ?? [];

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(user?.fullName ?? _profile?['full_name'] ?? 'Caregiver Portal', style: const TextStyle(fontSize: 16)),
            Text(
              '${_profile?['professional_title'] ?? 'Registered Nurse'} • Addis Ababa',
              style: const TextStyle(fontSize: 12, color: AppColors.primary),
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh Feed',
            onPressed: _fetchData,
          ),
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            tooltip: 'Sign Out',
            onPressed: () => ref.read(authProvider.notifier).logout(),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _fetchData,
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Duty / Availability Status Banner
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: _isAvailable ? AppColors.surface : const Color(0xFFF3F4F6),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: _isAvailable ? AppColors.primary.withOpacity(0.3) : AppColors.border,
                  ),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 20,
                      backgroundColor: _isAvailable ? AppColors.primaryLight : AppColors.border,
                      child: Icon(
                        _isAvailable ? Icons.medical_services_rounded : Icons.bedtime_outlined,
                        color: _isAvailable ? AppColors.primary : AppColors.textSecondary,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _isAvailable ? 'Available for Dispatch' : 'Off-Duty / Unavailable',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                          Text(
                            _isAvailable ? 'Receiving visit offers in Addis Ababa' : 'No new assignment dispatches',
                            style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                    ),
                    Switch(
                      value: _isAvailable,
                      activeColor: AppColors.primary,
                      onChanged: _toggleAvailability,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),

              // Profile & Stats Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.border),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildStatItem(ratingAvg, 'Rating', AppColors.accentWarning),
                    _buildDivider(),
                    _buildStatItem(completedCount, 'Completed', AppColors.primary),
                    _buildDivider(),
                    _buildStatItem('100%', 'Punctuality', AppColors.success),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              // Operating Zone & Coverage Area Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.primary.withOpacity(0.2)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        const Icon(Icons.location_on, color: AppColors.primary, size: 20),
                        const SizedBox(width: 8),
                        const Text(
                          'Dispatch Coverage Zone',
                          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                        const Spacer(),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.primaryLight,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            '$radiusKm km Radius',
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Operating Base: $homeSubCity (Primary Station)',
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                    ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        const Text('Assigned Areas: ', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                        Expanded(
                          child: Wrap(
                            spacing: 4,
                            runSpacing: 4,
                            children: coverageList.isNotEmpty
                                ? coverageList.map((area) {
                                    final name = area is Map ? area['name_en'] ?? '' : area.toString();
                                    return Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF3F4F6),
                                        borderRadius: BorderRadius.circular(6),
                                        border: Border.all(color: AppColors.border),
                                      ),
                                      child: Text(
                                        name,
                                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                                      ),
                                    );
                                  }).toList()
                                : ['Bole', 'Kirkos', 'Yeka'].map((area) {
                                    return Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                      decoration: BoxDecoration(
                                        color: const Color(0xFFF3F4F6),
                                        borderRadius: BorderRadius.circular(6),
                                        border: Border.all(color: AppColors.border),
                                      ),
                                      child: Text(
                                        area,
                                        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                                      ),
                                    );
                                  }).toList(),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // New Assignment Offers Section
              if (_isLoading)
                const Center(
                  child: Padding(
                    padding: EdgeInsets.all(24.0),
                    child: CircularProgressIndicator(),
                  ),
                )
              else if (_offers.isNotEmpty) ...[
                Row(
                  children: [
                    const Text('New Assignment Offers', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.error,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '${_offers.length} Pending',
                        style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                ...List.generate(_offers.length, (index) {
                  final offer = _offers[index];
                  final appointmentId = offer['appointment_id']?.toString() ?? '';
                  final serviceName = offer['service_name_en'] ?? offer['service_name'] ?? 'Care Visit';
                  final patientName = offer['patient_name'] ?? 'Addis Patient';
                  final subCity = offer['sub_city_name'] ?? offer['sub_city'] ?? 'Addis Ababa';
                  final landmark = offer['landmark'] ?? offer['address'] ?? 'Customer Residence';
                  final scheduled = offer['scheduled_start'] != null
                      ? DateTime.tryParse(offer['scheduled_start'].toString())?.toLocal().toString().substring(0, 16) ?? offer['scheduled_start'].toString()
                      : 'Immediate / Scheduled';
                  final duration = offer['duration_minutes'] != null ? '${(offer['duration_minutes'] / 60).toStringAsFixed(1)} hrs' : '2 hrs';

                  return Container(
                    margin: const EdgeInsets.only(bottom: 16),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.primary, width: 1.5),
                      boxShadow: [
                        BoxShadow(color: AppColors.primary.withOpacity(0.08), blurRadius: 10, offset: const Offset(0, 4)),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: AppColors.primaryLight,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                serviceName,
                                style: const TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.bold),
                              ),
                            ),
                            Text(
                              'Duration: $duration',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          patientName,
                          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: [
                            const Icon(Icons.location_on_outlined, size: 16, color: AppColors.textSecondary),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                '$subCity • $landmark',
                                style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(Icons.schedule, size: 16, color: AppColors.textSecondary),
                            const SizedBox(width: 4),
                            Text(scheduled, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                          ],
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: OutlinedButton(
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: AppColors.error,
                                  side: const BorderSide(color: AppColors.error),
                                ),
                                onPressed: () => _declineOffer(appointmentId),
                                child: const Text('DECLINE'),
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: ElevatedButton(
                                style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                                onPressed: () => _acceptOffer(appointmentId),
                                child: const Text('ACCEPT'),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                }),
              ],

              // Today's Visits / Active Schedule
              const Text("Assigned Visits", style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              const SizedBox(height: 12),
              if (!_isLoading && _upcomingVisits.isEmpty)
                Container(
                  padding: const EdgeInsets.all(24),
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: const Column(
                    children: [
                      Icon(Icons.event_available_rounded, size: 40, color: AppColors.textSecondary),
                      SizedBox(height: 8),
                      Text('No assigned visits currently', style: TextStyle(color: AppColors.textSecondary)),
                    ],
                  ),
                )
              else if (!_isLoading)
                ...List.generate(_upcomingVisits.length, (index) {
                  final visit = _upcomingVisits[index];
                  final serviceName = visit['service_name_en'] ?? visit['service_name'] ?? 'Care Visit';
                  final status = visit['appointment_status'] ?? visit['status'] ?? 'CONFIRMED';
                  final patientName = visit['patient_name'] ?? 'Patient';
                  final patientAge = visit['patient_age'] != null ? ' (${visit['patient_age']} yrs)' : '';
                  final subCity = visit['sub_city_name'] ?? visit['sub_city'] ?? 'Addis Ababa';
                  final landmark = visit['landmark'] ?? visit['address'] ?? 'Customer Residence';
                  final scheduled = visit['scheduled_start'] != null
                      ? DateTime.tryParse(visit['scheduled_start'].toString())?.toLocal().toString().substring(0, 16) ?? visit['scheduled_start'].toString()
                      : 'Scheduled Visit';

                  return Card(
                    margin: const EdgeInsets.only(bottom: 12),
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                      side: const BorderSide(color: AppColors.border),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(14),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(serviceName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: status == 'COMPLETED'
                                      ? AppColors.success.withOpacity(0.12)
                                      : status == 'IN_PROGRESS' || status == 'EN_ROUTE'
                                          ? AppColors.primary.withOpacity(0.12)
                                          : AppColors.secondary.withOpacity(0.12),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  status.toString().replaceAll('_', ' '),
                                  style: TextStyle(
                                    color: status == 'COMPLETED'
                                        ? AppColors.success
                                        : status == 'IN_PROGRESS' || status == 'EN_ROUTE'
                                            ? AppColors.primary
                                            : AppColors.secondary,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            '$patientName$patientAge',
                            style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                          ),
                          const SizedBox(height: 4),
                          Text('$subCity • $landmark', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                          const SizedBox(height: 4),
                          Text(scheduled, style: const TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.bold)),
                          const Divider(height: 20),
                          SizedBox(
                            width: double.infinity,
                            child: ElevatedButton.icon(
                              style: ElevatedButton.styleFrom(
                                backgroundColor: status == 'COMPLETED' ? AppColors.surface : AppColors.primary,
                                foregroundColor: status == 'COMPLETED' ? AppColors.textPrimary : Colors.white,
                                side: status == 'COMPLETED' ? const BorderSide(color: AppColors.border) : null,
                                minimumSize: const Size(double.infinity, 38),
                              ),
                              icon: Icon(
                                status == 'COMPLETED' ? Icons.check_circle_outline : Icons.arrow_forward_rounded,
                                size: 18,
                              ),
                              label: Text(status == 'COMPLETED' ? 'Review Clinical Record' : 'Open Visit Console'),
                              onPressed: () async {
                                await Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => VisitExecutionScreen(visit: visit),
                                  ),
                                );
                                _fetchData();
                              },
                            ),
                          ),
                        ],
                      ),
                    ),
                  );
                }),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildStatItem(String val, String label, Color color) {
    return Column(
      children: [
        Text(val, style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: color)),
        const SizedBox(height: 2),
        Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
      ],
    );
  }

  Widget _buildDivider() {
    return Container(height: 28, width: 1, color: AppColors.border);
  }
}
