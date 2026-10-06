import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/providers/auth_provider.dart';
import 'visit_execution_screen.dart';

class CaregiverHomeScreen extends ConsumerStatefulWidget {
  const CaregiverHomeScreen({super.key});

  @override
  ConsumerState<CaregiverHomeScreen> createState() => _CaregiverHomeScreenState();
}

class _CaregiverHomeScreenState extends ConsumerState<CaregiverHomeScreen> {
  bool _isAvailable = true;

  // Mock list of assignment offers and upcoming visits
  final List<Map<String, dynamic>> _offers = [
    {
      'id': 'OFFER-881',
      'appointment_id': 'APT-9102',
      'patient_name': 'W/ro Roman Bekele',
      'service_name': 'Wound Care & Dressing',
      'sub_city': 'Bole',
      'address': 'Bole Rwanda, House 412, behind Boston Day Spa',
      'scheduled_for': 'Today, 11:30 AM',
      'duration_hours': 2,
      'clinical_notes': 'Diabetic ulcer dressing change. Sterile technique required.',
    },
  ];

  final List<Map<String, dynamic>> _upcomingVisits = [
    {
      'id': 'APT-9041',
      'patient_name': 'Ato Kebede Michael',
      'age': 74,
      'service_name': 'Vital-sign Monitoring & Personal Care',
      'sub_city': 'Yeka',
      'address': 'Megenagna, near Marathon Building',
      'scheduled_for': 'Today, 2:00 PM',
      'status': 'CONFIRMED',
      'notes': 'Hypertension history, verify morning BP and blood glucose.',
    },
    {
      'id': 'APT-9048',
      'patient_name': 'Eskinder Tesfaye',
      'age': 62,
      'service_name': 'Post-Hospital Care',
      'sub_city': 'Kirkos',
      'address': 'Kazanchis, near UNECA',
      'scheduled_for': 'Tomorrow, 9:00 AM',
      'status': 'CONFIRMED',
      'notes': 'Mobility assistance following hip surgery.',
    },
  ];

  void _acceptOffer(int index) {
    final offer = _offers[index];
    setState(() {
      _offers.removeAt(index);
      _upcomingVisits.insert(0, {
        'id': offer['appointment_id'],
        'patient_name': offer['patient_name'],
        'age': 68,
        'service_name': offer['service_name'],
        'sub_city': offer['sub_city'],
        'address': offer['address'],
        'scheduled_for': offer['scheduled_for'],
        'status': 'CONFIRMED',
        'notes': offer['clinical_notes'],
      });
    });

    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Assignment accepted! Customer notified and visit locked.'),
        backgroundColor: AppColors.success,
      ),
    );
  }

  void _declineOffer(int index) {
    setState(() {
      _offers.removeAt(index);
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Assignment declined. Dispatch will reassign.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(authProvider).user;

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(user?.fullName ?? 'Sister Almaz (RN)', style: const TextStyle(fontSize: 16)),
            const Text('Addis Caregiver Network • Online', style: TextStyle(fontSize: 12, color: AppColors.primary)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded),
            onPressed: () => ref.read(authProvider.notifier).logout(),
          ),
        ],
      ),
      body: SingleChildScrollView(
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
                    onChanged: (val) {
                      setState(() => _isAvailable = val);
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(
                          content: Text(val ? 'Status updated: Available' : 'Status updated: Off-duty'),
                          duration: const Duration(seconds: 1),
                        ),
                      );
                    },
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
                  _buildStatItem('4.9 ★', 'Rating', AppColors.accentWarning),
                  _buildDivider(),
                  _buildStatItem('142', 'Completed', AppColors.primary),
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
                        child: const Text(
                          '10 km Radius',
                          style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.primary),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  const Text(
                    'Operating Base: Bole Sub-City (Primary Station)',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 6),
                  Row(
                    children: [
                      const Text('Assigned Areas: ', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                      Wrap(
                        spacing: 4,
                        children: ['Bole', 'Kirkos', 'Yeka'].map((area) {
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
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // New Assignment Offers Section
            if (_offers.isNotEmpty) ...[
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
                              offer['service_name'],
                              style: const TextStyle(color: AppColors.primary, fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                          ),
                          Text(
                            'Duration: ${offer['duration_hours']} hrs',
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        offer['patient_name'],
                        style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const Icon(Icons.location_on_outlined, size: 16, color: AppColors.textSecondary),
                          const SizedBox(width: 4),
                          Expanded(
                            child: Text(
                              '${offer['sub_city']} • ${offer['address']}',
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
                          Text(offer['scheduled_for'], style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF9FAFB),
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: AppColors.border),
                        ),
                        child: Text(
                          'Clinical Note: ${offer['clinical_notes']}',
                          style: const TextStyle(fontSize: 11, fontStyle: FontStyle.italic, color: AppColors.textSecondary),
                        ),
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
                              onPressed: () => _declineOffer(index),
                              child: const Text('DECLINE'),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: ElevatedButton(
                              style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                              onPressed: () => _acceptOffer(index),
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
            if (_upcomingVisits.isEmpty)
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
                    Text('No assigned visits for today', style: TextStyle(color: AppColors.textSecondary)),
                  ],
                ),
              )
            else
              ...List.generate(_upcomingVisits.length, (index) {
                final visit = _upcomingVisits[index];
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
                            Text(visit['service_name'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: AppColors.secondary.withOpacity(0.12),
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                visit['status'],
                                style: const TextStyle(color: AppColors.secondary, fontSize: 10, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          '${visit['patient_name']} (${visit['age']} yrs)',
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                        ),
                        const SizedBox(height: 4),
                        Text('${visit['sub_city']} • ${visit['address']}', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                        const SizedBox(height: 4),
                        Text(visit['scheduled_for'], style: const TextStyle(fontSize: 12, color: AppColors.primary, fontWeight: FontWeight.bold)),
                        const Divider(height: 20),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppColors.primary,
                              minimumSize: const Size(double.infinity, 38),
                            ),
                            icon: const Icon(Icons.arrow_forward_rounded, size: 18),
                            label: const Text('Open Visit Console'),
                            onPressed: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => VisitExecutionScreen(visit: visit),
                                ),
                              );
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
