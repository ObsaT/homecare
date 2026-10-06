import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';
import 'review_visit_screen.dart';

class RequestTrackingScreen extends StatefulWidget {
  final String reference;
  final String serviceName;
  final String status;
  final String? caregiverName;
  final String scheduledTime;

  const RequestTrackingScreen({
    super.key,
    required this.reference,
    required this.serviceName,
    required this.status,
    this.caregiverName,
    required this.scheduledTime,
  });

  @override
  State<RequestTrackingScreen> createState() => _RequestTrackingScreenState();
}

class _RequestTrackingScreenState extends State<RequestTrackingScreen> {
  late String _currentStatus;

  final List<Map<String, String>> _statusSteps = const [
    {'key': 'SUBMITTED', 'title': 'Requested', 'desc': 'Request received by Addis Ababa dispatch'},
    {'key': 'UNDER_REVIEW', 'title': 'Under Review', 'desc': 'Clinical coordinator verifying requirements'},
    {'key': 'ASSIGNED', 'title': 'Caregiver Assigned', 'desc': 'Certified nurse or caregiver matched'},
    {'key': 'CONFIRMED', 'title': 'Confirmed', 'desc': 'Visit accepted and locked on calendar'},
    {'key': 'EN_ROUTE', 'title': 'Caregiver Arriving', 'desc': 'Caregiver on their way to your address'},
    {'key': 'IN_PROGRESS', 'title': 'In Progress', 'desc': 'Caregiver on site providing clinical care'},
    {'key': 'COMPLETED', 'title': 'Completed', 'desc': 'Visit finished with clinical observations recorded'},
  ];

  @override
  void initState() {
    super.initState();
    _currentStatus = widget.status;
  }

  int get _stepIndex {
    switch (_currentStatus) {
      case 'SUBMITTED':
      case 'REQUESTED':
        return 0;
      case 'UNDER_REVIEW':
        return 1;
      case 'ASSIGNED':
      case 'OFFERED':
        return 2;
      case 'CONFIRMED':
        return 3;
      case 'EN_ROUTE':
        return 4;
      case 'IN_PROGRESS':
        return 5;
      case 'COMPLETED':
        return 6;
      default:
        return 0;
    }
  }

  Color _getStatusColor() {
    switch (_currentStatus) {
      case 'COMPLETED':
        return AppColors.success;
      case 'IN_PROGRESS':
      case 'EN_ROUTE':
        return AppColors.primary;
      case 'CONFIRMED':
      case 'ASSIGNED':
        return AppColors.secondary;
      case 'CANCELLED':
      case 'UNABLE_TO_FULFILL':
        return AppColors.error;
      default:
        return AppColors.accentWarning;
    }
  }

  @override
  Widget build(BuildContext context) {
    final statusColor = _getStatusColor();
    final caregiverName = widget.caregiverName ?? 'Sister Almaz Hailu (RN)';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Visit Tracking'),
        actions: [
          // Prototype state cycler so stakeholders can test every phase
          PopupMenuButton<String>(
            icon: const Icon(Icons.tune_rounded),
            tooltip: 'Simulate Status',
            onSelected: (val) => setState(() => _currentStatus = val),
            itemBuilder: (ctx) => [
              const PopupMenuItem(value: 'SUBMITTED', child: Text('1. Requested')),
              const PopupMenuItem(value: 'UNDER_REVIEW', child: Text('2. Under Review')),
              const PopupMenuItem(value: 'ASSIGNED', child: Text('3. Caregiver Assigned')),
              const PopupMenuItem(value: 'CONFIRMED', child: Text('4. Confirmed')),
              const PopupMenuItem(value: 'EN_ROUTE', child: Text('5. Caregiver Arriving')),
              const PopupMenuItem(value: 'IN_PROGRESS', child: Text('6. In Progress')),
              const PopupMenuItem(value: 'COMPLETED', child: Text('7. Completed')),
            ],
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Status Header Card
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
                boxShadow: [
                  BoxShadow(color: Colors.black.withOpacity(0.04), blurRadius: 8, offset: const Offset(0, 2)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(widget.reference, style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textSecondary)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(
                          color: statusColor.withOpacity(0.12),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          _currentStatus.replaceAll('_', ' '),
                          style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.bold),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    widget.serviceName,
                    style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      const Icon(Icons.schedule_rounded, size: 14, color: AppColors.textSecondary),
                      const SizedBox(width: 4),
                      Text(widget.scheduledTime, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Caregiver Card (Shown when assigned or beyond)
            if (_stepIndex >= 2) ...[
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.primaryLight.withOpacity(0.4),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: AppColors.primary.withOpacity(0.2)),
                ),
                child: Row(
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: AppColors.primary,
                      child: const Text('AH', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(caregiverName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                          const SizedBox(height: 2),
                          const Text('Licensed Registered Nurse • 6 yrs exp', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                          const SizedBox(height: 4),
                          const Row(
                            children: [
                              Icon(Icons.star_rounded, size: 14, color: AppColors.accentWarning),
                              SizedBox(width: 2),
                              Text('4.9 (42 visits)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ],
                      ),
                    ),
                    IconButton.filled(
                      icon: const Icon(Icons.phone_rounded, size: 20),
                      style: IconButton.styleFrom(backgroundColor: AppColors.primary),
                      onPressed: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Dialing caregiver phone: +251 91 100 0001')),
                        );
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ],

            // Visual Tracking Progress
            const Text('Visit Progress', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: AppColors.border),
              ),
              child: ListView.separated(
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: _statusSteps.length,
                separatorBuilder: (ctx, i) => Container(
                  margin: const EdgeInsets.only(left: 13),
                  height: 18,
                  width: 2,
                  color: i < _stepIndex ? AppColors.primary : AppColors.border,
                ),
                itemBuilder: (ctx, i) {
                  final step = _statusSteps[i];
                  final isDone = i < _stepIndex;
                  final isCurrent = i == _stepIndex;

                  return Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: isDone
                              ? AppColors.primary
                              : isCurrent
                                  ? AppColors.primaryLight
                                  : AppColors.surface,
                          border: Border.all(
                            color: isDone || isCurrent ? AppColors.primary : AppColors.border,
                            width: 2,
                          ),
                        ),
                        child: Center(
                          child: isDone
                              ? const Icon(Icons.check, size: 16, color: Colors.white)
                              : isCurrent
                                  ? Container(width: 8, height: 8, decoration: const BoxDecoration(shape: BoxShape.circle, color: AppColors.primary))
                                  : null,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Padding(
                          padding: const EdgeInsets.only(top: 2),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                step['title']!,
                                style: TextStyle(
                                  fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
                                  fontSize: 13,
                                  color: isCurrent || isDone ? AppColors.textPrimary : AppColors.textSecondary,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                step['desc']!,
                                style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  );
                },
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
                  Icon(Icons.info_outline, color: Color(0xFFB4791F), size: 20),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'If patient requires urgent trauma or ICU medical care, call Addis emergency 907 or proceed to hospital.',
                      style: TextStyle(fontSize: 11, color: Color(0xFF5A4119), height: 1.3),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Completion Action Button
            if (_currentStatus == 'COMPLETED') ...[
              SizedBox(
                width: double.infinity,
                height: 48,
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.secondary,
                  ),
                  icon: const Icon(Icons.rate_review_outlined),
                  label: const Text('Rate Your Caregiver & Visit', style: TextStyle(fontWeight: FontWeight.bold)),
                  onPressed: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ReviewVisitScreen(
                          appointmentId: widget.reference,
                          caregiverName: caregiverName,
                          serviceName: widget.serviceName,
                        ),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Need Help button
            OutlinedButton(
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(double.infinity, 44),
              ),
              onPressed: () {
                showModalBottomSheet(
                  context: context,
                  builder: (ctx) => Padding(
                    padding: const EdgeInsets.all(20),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Dispatch Office Support', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 8),
                        const Text('Our dispatch desk is active 24/7 in Addis Ababa to support care coordinators and families.'),
                        const SizedBox(height: 16),
                        ListTile(
                          leading: const Icon(Icons.call, color: AppColors.primary),
                          title: const Text('+251 11 661 0000'),
                          subtitle: const Text('Addis Care Coordinator Hotline'),
                          onTap: () => Navigator.pop(ctx),
                        ),
                        ListTile(
                          leading: const Icon(Icons.payment, color: AppColors.primary),
                          title: const Text('Telebirr / CBE Birr Help'),
                          subtitle: const Text('Assistance with invoice confirmation'),
                          onTap: () => Navigator.pop(ctx),
                        ),
                      ],
                    ),
                  ),
                );
              },
              child: const Text('Contact Support / Dispatch Desk'),
            ),
          ],
        ),
      ),
    );
  }
}
