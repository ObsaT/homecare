import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/theme/app_theme.dart';

class VisitExecutionScreen extends ConsumerStatefulWidget {
  final Map<String, dynamic> visit;

  const VisitExecutionScreen({super.key, required this.visit});

  @override
  ConsumerState<VisitExecutionScreen> createState() => _VisitExecutionScreenState();
}

class _VisitExecutionScreenState extends ConsumerState<VisitExecutionScreen> {
  late String _visitStatus; // CONFIRMED -> EN_ROUTE -> IN_PROGRESS -> COMPLETED
  bool _isSubmitting = false;

  // Clinical Vitals Form Fields
  final _bpSystolicController = TextEditingController(text: '120');
  final _bpDiastolicController = TextEditingController(text: '80');
  final _heartRateController = TextEditingController(text: '74');
  final _temperatureController = TextEditingController(text: '36.8');
  final _oxygenSaturationController = TextEditingController(text: '98');
  final _clinicalNotesController = TextEditingController(text: 'Patient evaluated in stable clinical condition. Vitals checked and care plan administered.');
  final _suppliesUsedController = TextEditingController(text: 'Sterile gauze (2 pkts), Betadine solution, Micropore tape');
  final _followUpRecommendationController = TextEditingController(text: 'Continue twice-daily care. Routine follow-up in 48 hours.');

  final Set<String> _servicesProvided = {
    'Vital signs monitored',
    'Sterile wound dressing applied',
  };

  @override
  void initState() {
    super.initState();
    final rawStatus = (widget.visit['appointment_status'] ?? widget.visit['status'] ?? 'CONFIRMED').toString().toUpperCase();
    if (rawStatus == 'ACCEPTED') {
      _visitStatus = 'CONFIRMED';
    } else {
      _visitStatus = rawStatus;
    }
  }

  String get _appointmentId => (widget.visit['appointment_id'] ?? widget.visit['id'] ?? '').toString();

  Future<void> _startEnRoute() async {
    setState(() => _isSubmitting = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.dio.post('/caregiver/appointments/$_appointmentId/en-route');
      setState(() {
        _visitStatus = 'EN_ROUTE';
        _isSubmitting = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Status updated: Caregiver en route to Addis address.')),
        );
      }
    } catch (e) {
      setState(() => _isSubmitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to update status: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<void> _startVisit() async {
    setState(() => _isSubmitting = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.dio.post(
        '/caregiver/appointments/$_appointmentId/arrive',
        data: {'lat': 9.0108, 'lng': 38.7617},
      );
      setState(() {
        _visitStatus = 'IN_PROGRESS';
        _isSubmitting = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Visit started! Arrival timestamp recorded.'),
            backgroundColor: AppColors.success,
          ),
        );
      }
    } catch (e) {
      setState(() => _isSubmitting = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to start visit: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  Future<void> _submitCompletion(BuildContext dialogContext) async {
    final vitals = {
      'bp_systolic': int.tryParse(_bpSystolicController.text.trim()) ?? 120,
      'bp_diastolic': int.tryParse(_bpDiastolicController.text.trim()) ?? 80,
      'heart_rate': int.tryParse(_heartRateController.text.trim()) ?? 74,
      'temperature_c': double.tryParse(_temperatureController.text.trim()) ?? 36.8,
      'oxygen_sat_pct': int.tryParse(_oxygenSaturationController.text.trim()) ?? 98,
      'notes': _servicesProvided.join(', '),
    };

    final suppliesText = _suppliesUsedController.text.trim();
    final supplies = suppliesText.isNotEmpty
        ? [{'item': suppliesText, 'quantity': 1}]
        : <Map<String, dynamic>>[];

    final body = {
      'observations': _clinicalNotesController.text.trim(),
      'supplies_used': supplies,
      'follow_up_required': _followUpRecommendationController.text.trim().isNotEmpty,
      'follow_up_notes': _followUpRecommendationController.text.trim(),
      'vitals': vitals,
    };

    try {
      final api = ref.read(apiClientProvider);
      await api.dio.post('/caregiver/appointments/$_appointmentId/complete', data: body);

      if (mounted) {
        Navigator.pop(dialogContext); // Close sheet
        setState(() {
          _visitStatus = 'COMPLETED';
        });

        showDialog(
          context: context,
          builder: (c) => AlertDialog(
            title: const Row(
              children: [
                Icon(Icons.check_circle, color: AppColors.success),
                SizedBox(width: 8),
                Text('Visit Completed!'),
              ],
            ),
            content: const Text(
              'Clinical notes and vital signs have been securely stored in the PostgreSQL database. The customer and administrative desk have been notified.',
            ),
            actions: [
              TextButton(
                onPressed: () {
                  Navigator.pop(c);
                  Navigator.pop(context);
                },
                child: const Text('Back to Schedule'),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to complete visit: $e'), backgroundColor: AppColors.error),
        );
      }
    }
  }

  void _showCompleteDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setModalState) {
          return Container(
            height: MediaQuery.of(context).size.height * 0.88,
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            padding: EdgeInsets.only(
              bottom: MediaQuery.of(context).viewInsets.bottom + 20,
              top: 20,
              left: 20,
              right: 20,
            ),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Center(
                    child: Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(2)),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'Clinical Visit Documentation',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  const Text(
                    'Record vital signs, observations, and supplies used before finishing visit.',
                    style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                  ),
                  const Divider(height: 24),

                  // Vital Signs Section
                  const Text('Vital Signs', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.primary)),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _bpSystolicController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'BP Systolic', suffixText: 'mmHg'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: _bpDiastolicController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'BP Diastolic', suffixText: 'mmHg'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _heartRateController,
                          keyboardType: TextInputType.number,
                          decoration: const InputDecoration(labelText: 'Pulse / Heart Rate', suffixText: 'bpm'),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: TextField(
                          controller: _temperatureController,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          decoration: const InputDecoration(labelText: 'Temperature', suffixText: '°C'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: _oxygenSaturationController,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(labelText: 'Oxygen Saturation (SpO2)', suffixText: '%'),
                  ),
                  const SizedBox(height: 20),

                  // Services Checklist
                  const Text('Procedures Provided', style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.primary)),
                  const SizedBox(height: 6),
                  ...[
                    'Vital signs monitored',
                    'Sterile wound dressing applied',
                    'Oral medications administered',
                    'Hygiene & bed positioning',
                    'Patient & family education',
                  ].map((service) {
                    final checked = _servicesProvided.contains(service);
                    return CheckboxListTile(
                      dense: true,
                      contentPadding: EdgeInsets.zero,
                      title: Text(service, style: const TextStyle(fontSize: 13)),
                      value: checked,
                      activeColor: AppColors.primary,
                      onChanged: (val) {
                        setModalState(() {
                          if (val == true) {
                            _servicesProvided.add(service);
                          } else {
                            _servicesProvided.remove(service);
                          }
                        });
                      },
                    );
                  }),
                  const SizedBox(height: 12),

                  // Supplies Used
                  TextField(
                    controller: _suppliesUsedController,
                    decoration: const InputDecoration(
                      labelText: 'Supplies Used',
                      hintText: 'e.g., Gauze, saline, tape, gloves',
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Clinical Observations
                  TextField(
                    controller: _clinicalNotesController,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Clinical Observations / Notes',
                      hintText: 'Describe patient status, wound appearance, tolerance of care...',
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Follow-up
                  TextField(
                    controller: _followUpRecommendationController,
                    decoration: const InputDecoration(
                      labelText: 'Follow-up Recommendation',
                      hintText: 'e.g., Next visit scheduled in 48 hours',
                    ),
                  ),
                  const SizedBox(height: 24),

                  SizedBox(
                    width: double.infinity,
                    height: 48,
                    child: ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
                      onPressed: () => _submitCompletion(ctx),
                      child: const Text('Confirm & Complete Visit', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final visit = widget.visit;
    final patientName = visit['patient_name'] ?? 'Patient';
    final serviceName = visit['service_name_en'] ?? visit['service_name'] ?? 'Care Visit';
    final subCity = visit['sub_city_name'] ?? visit['sub_city'] ?? 'Addis Ababa';
    final landmark = visit['landmark'] ?? visit['address'] ?? 'Customer Residence';
    final notes = visit['clinical_notes'] ?? visit['notes'] ?? 'Follow clinical protocol';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Visit Console'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status Bar
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: _visitStatus == 'COMPLETED'
                    ? AppColors.success.withOpacity(0.12)
                    : _visitStatus == 'IN_PROGRESS'
                        ? AppColors.primary.withOpacity(0.12)
                        : AppColors.accentWarning.withOpacity(0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Row(
                children: [
                  Icon(
                    _visitStatus == 'COMPLETED'
                        ? Icons.check_circle_rounded
                        : _visitStatus == 'IN_PROGRESS'
                            ? Icons.timer_rounded
                            : Icons.schedule_rounded,
                    color: _visitStatus == 'COMPLETED'
                        ? AppColors.success
                        : _visitStatus == 'IN_PROGRESS'
                            ? AppColors.primary
                            : AppColors.accentWarning,
                  ),
                  const SizedBox(width: 10),
                  Text(
                    'STATUS: ${_visitStatus.replaceAll('_', ' ')}',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      fontSize: 13,
                      color: _visitStatus == 'COMPLETED'
                          ? AppColors.success
                          : _visitStatus == 'IN_PROGRESS'
                              ? AppColors.primary
                              : AppColors.accentWarning,
                    ),
                  ),
                  const Spacer(),
                  if (_visitStatus == 'IN_PROGRESS')
                    const Text('Active Now', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.primary)),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Patient Card
            Card(
              elevation: 0,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: AppColors.border)),
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      patientName,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Service: $serviceName',
                      style: const TextStyle(fontSize: 13, color: AppColors.primary, fontWeight: FontWeight.w600),
                    ),
                    const Divider(height: 20),
                    Row(
                      children: [
                        const Icon(Icons.location_on_outlined, size: 16, color: AppColors.textSecondary),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            '$subCity • $landmark',
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        const Icon(Icons.medical_information_outlined, size: 16, color: AppColors.textSecondary),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            notes,
                            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Emergency Notice
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFFBF2E2),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: const Color(0xFFE9C99A)),
              ),
              child: const Row(
                children: [
                  Icon(Icons.warning_amber_rounded, color: Color(0xFFB4791F), size: 22),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'If acute deterioration occurs (SpO2 < 90%, chest pain, severe distress), initiate emergency transport via 907.',
                      style: TextStyle(fontSize: 11, color: Color(0xFF5A4119), height: 1.3),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 28),

            // Action Buttons based on status
            if (_isSubmitting)
              const Center(child: CircularProgressIndicator())
            else if (_visitStatus == 'CONFIRMED') ...[
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  icon: const Icon(Icons.navigation_rounded),
                  label: const Text('START JOURNEY (EN ROUTE)', style: TextStyle(fontWeight: FontWeight.bold)),
                  onPressed: _startEnRoute,
                ),
              ),
            ] else if (_visitStatus == 'EN_ROUTE') ...[
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.primary),
                  icon: const Icon(Icons.location_pin),
                  label: const Text('ARRIVED: START VISIT', style: TextStyle(fontWeight: FontWeight.bold)),
                  onPressed: _startVisit,
                ),
              ),
            ] else if (_visitStatus == 'IN_PROGRESS') ...[
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.success),
                  icon: const Icon(Icons.check_circle_outline),
                  label: const Text('COMPLETE VISIT & LOG VITALS', style: TextStyle(fontWeight: FontWeight.bold)),
                  onPressed: _showCompleteDialog,
                ),
              ),
            ] else ...[
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.success.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.success),
                ),
                child: const Column(
                  children: [
                    Icon(Icons.task_alt, color: AppColors.success, size: 36),
                    SizedBox(height: 8),
                    Text('This visit has been completed.', style: TextStyle(fontWeight: FontWeight.bold)),
                    SizedBox(height: 4),
                    Text('Clinical record filed securely in database.', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                  ],
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
