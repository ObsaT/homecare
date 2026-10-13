import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/services/audio_notification_service.dart';
import '../../../core/services/realtime_events_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/visit_chat_bottom_sheet.dart';
import '../../auth/providers/auth_provider.dart';
import 'review_visit_screen.dart';

class RequestTrackingScreen extends ConsumerStatefulWidget {
  final String? requestId;
  final String? appointmentId;
  final String reference;
  final String serviceName;
  final String status;
  final String? caregiverName;
  final String scheduledTime;

  const RequestTrackingScreen({
    super.key,
    this.requestId,
    this.appointmentId,
    required this.reference,
    required this.serviceName,
    required this.status,
    this.caregiverName,
    required this.scheduledTime,
  });

  @override
  ConsumerState<RequestTrackingScreen> createState() => _RequestTrackingScreenState();
}

class _RequestTrackingScreenState extends ConsumerState<RequestTrackingScreen> {
  late String _currentStatus;
  String? _caregiverName;
  Map<String, dynamic>? _requestDetail;
  StreamSubscription<Map<String, dynamic>>? _realtimeSubscription;

  final List<Map<String, String>> _statusSteps = const [
    {'key': 'SUBMITTED', 'title': 'Requested', 'desc': 'Request received by Admin Desk'},
    {'key': 'UNDER_REVIEW', 'title': 'Admin Reviewing', 'desc': 'Admin checking available caregivers'},
    {'key': 'ASSIGNED', 'title': 'Offer Sent', 'desc': 'Offer sent to matched caregiver'},
    {'key': 'ACCEPTED', 'title': 'Caregiver Accepted', 'desc': 'Caregiver accepted; awaiting final admin dispatch'},
    {'key': 'CONFIRMED', 'title': 'Admin Dispatched', 'desc': 'Visit approved & officially dispatched'},
    {'key': 'EN_ROUTE', 'title': 'Caregiver Arriving', 'desc': 'Caregiver on their way to your address'},
    {'key': 'IN_PROGRESS', 'title': 'In Progress', 'desc': 'Caregiver on site providing clinical care'},
    {'key': 'COMPLETED', 'title': 'Completed', 'desc': 'Visit finished with clinical observations recorded'},
  ];

  @override
  void initState() {
    super.initState();
    _currentStatus = widget.status;
    _caregiverName = widget.caregiverName;
    _fetchDetail();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _initRealtimeListener();
    });
  }

  @override
  void dispose() {
    _realtimeSubscription?.cancel();
    super.dispose();
  }

  Future<void> _fetchDetail() async {
    if (widget.requestId == null || widget.requestId!.isEmpty) return;
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.dio.get('/requests/${widget.requestId}');
      final data = res.data is Map && res.data['data'] != null ? res.data['data'] : res.data;
      if (data is Map && mounted) {
        setState(() {
          _requestDetail = Map<String, dynamic>.from(data);
          if (_requestDetail?['status'] != null) {
            _currentStatus = _requestDetail?['status'].toString() ?? _currentStatus;
          }
          if (_requestDetail?['caregiver_name'] != null) {
            _caregiverName = _requestDetail?['caregiver_name'].toString();
          }
        });
      }
    } catch (_) {}
  }

  void _initRealtimeListener() {
    try {
      final realtime = ref.read(realtimeEventsServiceProvider);
      _realtimeSubscription?.cancel();
      _realtimeSubscription = realtime.stream.listen((event) {
        final type = event['type']?.toString();
        final data = event['data'] is Map ? Map<String, dynamic>.from(event['data'] as Map) : <String, dynamic>{};

        final eventReqId = data['request_id']?.toString();
        final eventApptId = data['appointment_id']?.toString();
        final eventRef = data['reference']?.toString();

        final matches = (widget.requestId != null && widget.requestId == eventReqId) ||
            (widget.appointmentId != null && widget.appointmentId == eventApptId) ||
            (widget.reference.isNotEmpty && widget.reference == eventRef);

        if (matches) {
          if (type == 'VISIT_STATUS_CHANGED' || type == 'OFFER_ACCEPTED' || type == 'VISIT_COMPLETED') {
            final newStatus = data['status']?.toString();
            final cgName = data['caregiver_name']?.toString();
            _fetchDetail();
            if (newStatus != null && mounted) {
              setState(() {
                _currentStatus = newStatus;
                if (cgName != null && cgName.isNotEmpty) {
                  _caregiverName = cgName;
                }
              });
              AudioNotificationService.playChime();
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('Visit status updated: $newStatus'),
                  backgroundColor: AppColors.primary,
                  behavior: SnackBarBehavior.floating,
                ),
              );
            }
          } else if (type == 'QUOTE_UPDATED' || type == 'PAYMENT_CONFIRMED') {
            _fetchDetail();
            AudioNotificationService.playChime();
          } else if (type == 'CHAT_MESSAGE') {
            AudioNotificationService.playChime();
            final sender = data['sender_name'] ?? 'Caregiver';
            final text = data['content'] ?? '';
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('💬 $sender: "$text"'),
                  backgroundColor: AppColors.primary,
                  behavior: SnackBarBehavior.floating,
                  action: SnackBarAction(
                    label: 'REPLY',
                    textColor: Colors.white,
                    onPressed: () {
                      VisitChatBottomSheet.show(
                        context,
                        appointmentId: widget.appointmentId,
                        requestId: widget.requestId,
                        reference: widget.reference,
                        counterpartName: _caregiverName ?? widget.caregiverName ?? 'Assigned Caregiver',
                        isCaregiver: false,
                      );
                    },
                  ),
                ),
              );
            }
          } else if (type == 'EMERGENCY_SOS') {
            AudioNotificationService.playSosAlarm();
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('🚨 EMERGENCY ALERT: ${data['content']}'),
                  backgroundColor: AppColors.error,
                  duration: const Duration(seconds: 6),
                  behavior: SnackBarBehavior.floating,
                ),
              );
            }
          } else if (type == 'BROADCAST_ANNOUNCEMENT') {
            AudioNotificationService.playChime();
            if (mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: Text('📢 ADVISORY: ${data['content']}'),
                  backgroundColor: Colors.amber.shade900,
                  behavior: SnackBarBehavior.floating,
                ),
              );
            }
          } else if (type == 'REQUEST_CANCELLED') {
            if (mounted) {
              setState(() => _currentStatus = 'CANCELLED');
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('This care request was cancelled.'),
                  backgroundColor: AppColors.error,
                  behavior: SnackBarBehavior.floating,
                ),
              );
            }
          }
        }
      });
    } catch (_) {}
  }

  Future<void> _showTelebirrSandboxModal(double amountEtb, String? invoiceId, String? invoiceNumber) async {
    final userPhone = ref.read(authProvider).user?.phone ?? '';
    final phoneCtrl = TextEditingController(text: userPhone);
    final pinCtrl = TextEditingController(text: '1234');
    bool isSubmitting = false;
    String? errorMsg;

    final order = await ref.read(authProvider.notifier).createTelebirrSandboxOrder(
          amountEtb: amountEtb,
          phone: userPhone,
          purpose: 'CUSTOMER_INVOICE',
          invoiceId: invoiceId,
          requestId: widget.requestId,
          title: 'Home Care Invoice ${invoiceNumber ?? widget.reference}',
        );

    if (!mounted) return;

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (ctx, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF0072BC), Color(0xFF005A96)],
                      ),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Column(
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: const Text(
                                'telebirr',
                                style: TextStyle(
                                  fontWeight: FontWeight.w900,
                                  color: Color(0xFF0072BC),
                                  fontSize: 15,
                                ),
                              ),
                            ),
                            const Text(
                              'SANDBOX (*127#)',
                              style: TextStyle(color: Colors.white70, fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          'ETB ${amountEtb.toStringAsFixed(2)}',
                          style: const TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Order: ${order['merch_order_id'] ?? ''} • Shortcode: 884210',
                          style: const TextStyle(color: Colors.white70, fontSize: 11, fontFamily: 'monospace'),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Wrap(
                    spacing: 8,
                    children: [
                      ActionChip(
                        label: const Text('Approve (1234)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                        onPressed: () => setModalState(() {
                          pinCtrl.text = '1234';
                          errorMsg = null;
                        }),
                      ),
                      ActionChip(
                        label: const Text('Low Balance (0000)', style: TextStyle(fontSize: 11)),
                        onPressed: () => setModalState(() => pinCtrl.text = '0000'),
                      ),
                      ActionChip(
                        label: const Text('Cancel (9999)', style: TextStyle(fontSize: 11)),
                        onPressed: () => setModalState(() => pinCtrl.text = '9999'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (errorMsg != null) ...[
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: Colors.red.shade50,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(errorMsg ?? '', style: TextStyle(color: Colors.red.shade800, fontSize: 12)),
                    ),
                    const SizedBox(height: 10),
                  ],
                  TextField(
                    controller: phoneCtrl,
                    decoration: const InputDecoration(
                      labelText: 'Telebirr Mobile Number',
                      prefixIcon: Icon(Icons.phone_android_rounded),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextField(
                    controller: pinCtrl,
                    obscureText: true,
                    maxLength: 4,
                    keyboardType: TextInputType.number,
                    decoration: const InputDecoration(
                      labelText: 'Telebirr Sandbox PIN (1234 = Approve)',
                      counterText: '',
                      prefixIcon: Icon(Icons.lock_rounded),
                    ),
                  ),
                  const SizedBox(height: 14),
                  ElevatedButton.icon(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF0072BC),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    icon: const Icon(Icons.check_circle_outline, color: Colors.white),
                    label: Text(
                      isSubmitting ? 'Authorizing...' : 'Authorize ETB ${amountEtb.toStringAsFixed(0)} via Telebirr',
                      style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                    ),
                    onPressed: isSubmitting
                        ? null
                        : () async {
                            setModalState(() {
                              isSubmitting = true;
                              errorMsg = null;
                            });
                            try {
                              final res = await ref.read(authProvider.notifier).authorizeTelebirrSandboxOrder(
                                    prepayId: order['prepay_id']?.toString(),
                                    merchOrderId: order['merch_order_id']?.toString(),
                                    telebirrPhone: phoneCtrl.text.trim(),
                                    pin: pinCtrl.text.trim(),
                                    amountEtb: amountEtb,
                                    purpose: 'CUSTOMER_INVOICE',
                                    invoiceId: invoiceId,
                                    requestId: widget.requestId,
                                  );
                              if (ctx.mounted) Navigator.of(ctx).pop();
                              await _fetchDetail();
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    backgroundColor: const Color(0xFF0072BC),
                                    content: Text(
                                      'Telebirr Receipt ${res['receipt_number'] ?? ''} verified! Invoice marked PAID.',
                                    ),
                                  ),
                                );
                              }
                            } catch (e) {
                              String msg = 'Telebirr Sandbox declined transaction.';
                              try {
                                final dynamic errObj = e;
                                final resp = errObj.response?.data;
                                if (resp is Map) {
                                  msg = resp['message']?.toString() ?? resp['error']?['message']?.toString() ?? msg;
                                }
                              } catch (_) {}
                              setModalState(() {
                                isSubmitting = false;
                                errorMsg = msg;
                              });
                            }
                          },
                  ),
                ],
              ),
            );
          },
        );
      },
    );
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
      case 'ACCEPTED':
        return 3;
      case 'CONFIRMED':
        return 4;
      case 'EN_ROUTE':
        return 5;
      case 'IN_PROGRESS':
        return 6;
      case 'COMPLETED':
        return 7;
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
      case 'ACCEPTED':
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
    final caregiverName = _caregiverName ?? widget.caregiverName ?? 'Assigned Nurse / Caregiver';

    final totalSantim = num.tryParse(
          (_requestDetail?['total_santim'] ?? _requestDetail?['price_santim'] ?? 100000).toString(),
        ) ??
        100000;
    final paidSantim = num.tryParse((_requestDetail?['paid_santim'] ?? 0).toString()) ?? 0;
    final discountSantim = num.tryParse((_requestDetail?['discount_santim'] ?? 0).toString()) ?? 0;
    final surchargeSantim = num.tryParse((_requestDetail?['surcharge_santim'] ?? 0).toString()) ?? 0;
    final invoiceStatus = _requestDetail?['invoice_status']?.toString() ?? 'ISSUED';
    final invoiceNumber = _requestDetail?['invoice_number']?.toString();
    final invoiceId = _requestDetail?['invoice_id']?.toString();
    final invoiceNotes = _requestDetail?['invoice_notes']?.toString();
    final totalEtb = (totalSantim / 100).toDouble();
    final remainingEtb = ((totalSantim - paidSantim) > 0 ? (totalSantim - paidSantim) / 100 : totalEtb).toDouble();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Visit Tracking & Payment'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'Refresh Status & Invoice',
            onPressed: _fetchDetail,
          ),
          // Prototype state cycler so stakeholders can test every phase
          PopupMenuButton<String>(
            icon: const Icon(Icons.tune_rounded),
            tooltip: 'Simulate Status',
            onSelected: (val) => setState(() => _currentStatus = val),
            itemBuilder: (ctx) => [
              const PopupMenuItem(value: 'SUBMITTED', child: Text('1. Requested')),
              const PopupMenuItem(value: 'UNDER_REVIEW', child: Text('2. Admin Reviewing')),
              const PopupMenuItem(value: 'ASSIGNED', child: Text('3. Offer Sent to Caregiver')),
              const PopupMenuItem(value: 'ACCEPTED', child: Text('4. Caregiver Accepted (Awaiting Dispatch)')),
              const PopupMenuItem(value: 'CONFIRMED', child: Text('5. Admin Dispatched')),
              const PopupMenuItem(value: 'EN_ROUTE', child: Text('6. Caregiver Arriving')),
              const PopupMenuItem(value: 'IN_PROGRESS', child: Text('7. In Progress')),
              const PopupMenuItem(value: 'COMPLETED', child: Text('8. Completed')),
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
            const SizedBox(height: 16),

            // Service Quote / Invoice & Telebirr Sandbox Checkout Card
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF0072BC).withOpacity(0.35)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.receipt_long_rounded, size: 18, color: Color(0xFF0072BC)),
                          const SizedBox(width: 6),
                          Text(
                            invoiceNumber ?? 'Service Billing & Quote',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: invoiceStatus == 'PAID'
                              ? AppColors.success.withOpacity(0.15)
                              : const Color(0xFF0072BC).withOpacity(0.12),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          invoiceStatus,
                          style: TextStyle(
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                            color: invoiceStatus == 'PAID' ? AppColors.success : const Color(0xFF0072BC),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total Visit Fee:', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                      Text(
                        'ETB ${totalEtb.toStringAsFixed(2)}',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                      ),
                    ],
                  ),
                  if (discountSantim > 0) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Discount Applied: -ETB ${(discountSantim / 100).toStringAsFixed(0)}',
                      style: const TextStyle(fontSize: 11, color: AppColors.success, fontWeight: FontWeight.w600),
                    ),
                  ],
                  if (surchargeSantim > 0) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Clinical/Urgent Surcharge: +ETB ${(surchargeSantim / 100).toStringAsFixed(0)}',
                      style: const TextStyle(fontSize: 11, color: AppColors.accentWarning, fontWeight: FontWeight.w600),
                    ),
                  ],
                  if (invoiceNotes != null && invoiceNotes.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      'Finance Note: $invoiceNotes',
                      style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                    ),
                  ],
                  if (invoiceStatus != 'PAID' && invoiceStatus != 'VOID') ...[
                    const SizedBox(height: 12),
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        style: ElevatedButton.styleFrom(
                          backgroundColor: const Color(0xFF0072BC),
                          padding: const EdgeInsets.symmetric(vertical: 12),
                        ),
                        icon: const Icon(Icons.payments_outlined, color: Colors.white, size: 18),
                        label: Text(
                          'Pay ETB ${remainingEtb.toStringAsFixed(0)} with telebirr Sandbox',
                          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                        onPressed: () => _showTelebirrSandboxModal(remainingEtb, invoiceId, invoiceNumber),
                      ),
                    ),
                  ],
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
                      child: const Text('RN', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(caregiverName, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                          const SizedBox(height: 2),
                          const Text('Licensed Clinical Nurse • Verified', style: TextStyle(fontSize: 11, color: AppColors.textSecondary)),
                          const SizedBox(height: 4),
                          const Row(
                            children: [
                              Icon(Icons.star_rounded, size: 14, color: AppColors.accentWarning),
                              SizedBox(width: 2),
                              Text('4.9 ★ Verified', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                            ],
                          ),
                        ],
                      ),
                    ),
                    Row(
                      children: [
                        IconButton.filled(
                          icon: const Icon(Icons.chat_bubble_rounded, size: 18),
                          style: IconButton.styleFrom(backgroundColor: AppColors.secondary),
                          tooltip: 'In-Visit Chat & Quick Updates',
                          onPressed: () {
                            VisitChatBottomSheet.show(
                              context,
                              appointmentId: widget.appointmentId,
                              requestId: widget.requestId,
                              reference: widget.reference,
                              counterpartName: caregiverName,
                              isCaregiver: false,
                            );
                          },
                        ),
                        const SizedBox(width: 8),
                        IconButton.filled(
                          icon: const Icon(Icons.phone_rounded, size: 18),
                          style: IconButton.styleFrom(backgroundColor: AppColors.primary),
                          tooltip: 'Call Caregiver',
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(content: Text('Dialing caregiver phone...')),
                            );
                          },
                        ),
                      ],
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
                                step['title'] ?? '',
                                style: TextStyle(
                                  fontWeight: isCurrent ? FontWeight.bold : FontWeight.w500,
                                  fontSize: 13,
                                  color: isCurrent || isDone ? AppColors.textPrimary : AppColors.textSecondary,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                step['desc'] ?? '',
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
                          appointmentId: widget.appointmentId ?? widget.reference,
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
      floatingActionButton: FloatingActionButton.extended(
        backgroundColor: AppColors.secondary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.forum_rounded, size: 20),
        label: const Text('Live Comms & SOS', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
        onPressed: () {
          VisitChatBottomSheet.show(
            context,
            appointmentId: widget.appointmentId,
            requestId: widget.requestId,
            reference: widget.reference,
            counterpartName: caregiverName,
            isCaregiver: false,
          );
        },
      ),
    );
  }
}
