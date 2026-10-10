import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../network/api_client.dart';
import '../services/audio_notification_service.dart';
import '../services/realtime_events_service.dart';
import '../theme/app_theme.dart';

class VisitChatBottomSheet extends ConsumerStatefulWidget {
  final String? appointmentId;
  final String? requestId;
  final String reference;
  final String counterpartName;
  final bool isCaregiver;

  const VisitChatBottomSheet({
    super.key,
    this.appointmentId,
    this.requestId,
    required this.reference,
    required this.counterpartName,
    required this.isCaregiver,
  });

  static Future<void> show(
    BuildContext context, {
    String? appointmentId,
    String? requestId,
    required String reference,
    required String counterpartName,
    required bool isCaregiver,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => VisitChatBottomSheet(
        appointmentId: appointmentId,
        requestId: requestId,
        reference: reference,
        counterpartName: counterpartName,
        isCaregiver: isCaregiver,
      ),
    );
  }

  @override
  ConsumerState<VisitChatBottomSheet> createState() => _VisitChatBottomSheetState();
}

class _VisitChatBottomSheetState extends ConsumerState<VisitChatBottomSheet> {
  final TextEditingController _msgController = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  List<Map<String, dynamic>> _messages = [];
  bool _loading = true;
  bool _sending = false;
  StreamSubscription<Map<String, dynamic>>? _wsSub;

  List<String> get _quickChips => widget.isCaregiver
      ? [
          'On the way, 10 min ETA 🚗',
          'Delayed in Addis traffic 🚦',
          'Arrived outside residence 🚪',
          'Visit proceeding smoothly 🩺',
        ]
      : [
          'Gate is unlocked / open 🚪',
          'Please call when at door 📞',
          'Patient is resting 🛌',
          'What is your current ETA? ⏱️',
        ];

  @override
  void initState() {
    super.initState();
    _fetchMessages();
    _initWsListener();
  }

  @override
  void dispose() {
    _wsSub?.cancel();
    _msgController.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _initWsListener() {
    try {
      final ws = ref.read(realtimeEventsServiceProvider);
      _wsSub = ws.stream.listen((event) {
        final type = event['type']?.toString();
        final data = event['data'] is Map ? Map<String, dynamic>.from(event['data'] as Map) : <String, dynamic>{};

        final targetId = widget.appointmentId ?? widget.requestId ?? widget.reference;
        final eventAppt = data['appointment_id']?.toString();
        final eventReq = data['request_id']?.toString();
        final eventRef = data['reference']?.toString();

        if (targetId == eventAppt || targetId == eventReq || targetId == eventRef) {
          if (type == 'CHAT_MESSAGE' || type == 'EMERGENCY_SOS') {
            if (mounted) {
              setState(() {
                _messages.add(data);
              });
              AudioNotificationService.playChime();
              _scrollToBottom();
            }
          }
        }
      });
    } catch (_) {}
  }

  Future<void> _fetchMessages() async {
    final targetId = widget.appointmentId ?? widget.requestId ?? widget.reference;
    try {
      final api = ref.read(apiClientProvider);
      final res = await api.dio.get('/comms/appointments/$targetId/messages');
      final list = res.data['data'] as List?;
      if (list != null && mounted) {
        setState(() {
          _messages = list.map((e) => Map<String, dynamic>.from(e as Map)).toList();
          _loading = false;
        });
        _scrollToBottom();
      } else if (mounted) {
        setState(() => _loading = false);
      }
    } catch (_) {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent + 60,
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeOut,
        );
      }
    });
  }

  Future<void> _sendMessage({String? customContent, String? msgType}) async {
    final text = customContent ?? _msgController.text.trim();
    if (text.isEmpty) return;

    if (customContent == null) {
      _msgController.clear();
    }

    setState(() => _sending = true);
    try {
      final api = ref.read(apiClientProvider);
      await api.dio.post('/comms/messages', data: {
        'appointment_id': widget.appointmentId,
        'request_id': widget.requestId,
        'content': text,
        'message_type': msgType ?? 'CHAT',
        'metadata': {
          'reference': widget.reference,
          'sender_client': widget.isCaregiver ? 'CAREGIVER_APP' : 'CUSTOMER_APP',
        },
      });
      _fetchMessages();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to send message: $e'), backgroundColor: AppColors.error),
        );
      }
    } finally {
      if (mounted) setState(() => _sending = false);
    }
  }

  void _confirmEmergencySos() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(Icons.warning_amber_rounded, color: AppColors.error, size: 28),
            SizedBox(width: 8),
            Text('Trigger Emergency SOS?', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          ],
        ),
        content: const Text(
          'This will immediately transmit a high-priority alert with your coordinates to the 24/7 Addis Ababa clinical dispatch desk and notify all supervisors.',
          style: TextStyle(fontSize: 13, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel', style: TextStyle(color: AppColors.textSecondary)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.error,
              foregroundColor: Colors.white,
            ),
            onPressed: () {
              Navigator.pop(ctx);
              AudioNotificationService.playSosAlarm();
              _sendMessage(
                customContent: '🚨 URGENT: Clinical emergency assistance requested on-site for ${widget.reference}!',
                msgType: 'EMERGENCY_SOS',
              );
            },
            child: const Text('YES, SEND SOS ALARM', style: TextStyle(fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      child: Column(
        children: [
          // Drag Handle
          const SizedBox(height: 10),
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: Colors.grey.shade300,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 10),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 4.0),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: AppColors.primaryLight,
                  radius: 20,
                  child: Icon(
                    widget.isCaregiver ? Icons.person_rounded : Icons.medical_services_rounded,
                    color: AppColors.primary,
                    size: 22,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        widget.counterpartName,
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        '${widget.reference} • Live In-Visit Channel',
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 11),
                      ),
                    ],
                  ),
                ),
                // Emergency SOS Button
                TextButton.icon(
                  style: TextButton.styleFrom(
                    backgroundColor: AppColors.error.withOpacity(0.1),
                    foregroundColor: AppColors.error,
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  icon: const Icon(Icons.emergency_rounded, size: 18),
                  label: const Text('SOS', style: TextStyle(fontWeight: FontWeight.w900, fontSize: 12)),
                  onPressed: _confirmEmergencySos,
                ),
                IconButton(
                  icon: const Icon(Icons.close_rounded),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),
          const Divider(height: 1),

          // Quick Chips Scroll
          Container(
            height: 44,
            padding: const EdgeInsets.symmetric(vertical: 4),
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              scrollDirection: Axis.horizontal,
              itemCount: _quickChips.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (ctx, i) {
                final chip = _quickChips[i];
                return ActionChip(
                  label: Text(chip, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w600)),
                  backgroundColor: Colors.grey.shade100,
                  side: BorderSide(color: Colors.grey.shade300),
                  onPressed: () => _sendMessage(customContent: chip),
                );
              },
            ),
          ),
          const Divider(height: 1),

          // Chat Messages List
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _messages.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.chat_bubble_outline_rounded, size: 40, color: Colors.grey.shade300),
                            const SizedBox(height: 8),
                            const Text(
                              'Secure In-Visit Communications Active',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.textPrimary),
                            ),
                            const SizedBox(height: 4),
                            const Text(
                              'Send arrival updates, questions, or tap quick chips above.',
                              style: TextStyle(color: AppColors.textSecondary, fontSize: 11),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        controller: _scrollController,
                        padding: const EdgeInsets.all(16),
                        itemCount: _messages.length,
                        itemBuilder: (ctx, i) {
                          final msg = _messages[i];
                          final role = msg['sender_role']?.toString() ?? 'USER';
                          final isMe = (widget.isCaregiver && role == 'CAREGIVER') || (!widget.isCaregiver && role == 'CUSTOMER');
                          final isSos = msg['message_type'] == 'EMERGENCY_SOS';
                          final content = msg['content']?.toString() ?? '';
                          final senderName = msg['sender_name']?.toString() ?? role;
                          final timeStr = msg['created_at'] != null
                              ? DateTime.tryParse(msg['created_at'].toString())?.toLocal().toString().substring(11, 16) ?? ''
                              : '';

                          return Align(
                            alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
                            child: Container(
                              margin: const EdgeInsets.only(bottom: 10),
                              constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.78),
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                color: isSos
                                    ? AppColors.error
                                    : isMe
                                        ? AppColors.primary
                                        : Colors.grey.shade100,
                                borderRadius: BorderRadius.circular(16).copyWith(
                                  bottomRight: isMe ? const Radius.circular(2) : const Radius.circular(16),
                                  bottomLeft: !isMe ? const Radius.circular(2) : const Radius.circular(16),
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
                                children: [
                                  if (!isMe)
                                    Padding(
                                      padding: const EdgeInsets.only(bottom: 2.0),
                                      child: Text(
                                        '$senderName • $role',
                                        style: TextStyle(
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                          color: isSos ? Colors.white70 : AppColors.primary,
                                        ),
                                      ),
                                    ),
                                  Text(
                                    content,
                                    style: TextStyle(
                                      fontSize: 13,
                                      color: (isMe || isSos) ? Colors.white : AppColors.textPrimary,
                                      fontWeight: isSos ? FontWeight.bold : FontWeight.normal,
                                    ),
                                  ),
                                  if (timeStr.isNotEmpty)
                                    Padding(
                                      padding: const EdgeInsets.only(top: 4.0),
                                      child: Text(
                                        timeStr,
                                        style: TextStyle(
                                          fontSize: 9,
                                          color: (isMe || isSos) ? Colors.white70 : AppColors.textTertiary,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
          ),

          // Message Input Field
          Container(
            padding: EdgeInsets.fromLTRB(16, 8, 16, MediaQuery.of(context).viewInsets.bottom + 12),
            decoration: BoxDecoration(
              color: Colors.white,
              border: Border(top: BorderSide(color: Colors.grey.shade200)),
            ),
            child: Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _msgController,
                    textInputAction: TextInputAction.send,
                    onSubmitted: (_) => _sendMessage(),
                    decoration: InputDecoration(
                      hintText: 'Type a message to ${widget.counterpartName}...',
                      hintStyle: const TextStyle(fontSize: 12),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide(color: Colors.grey.shade300),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(24),
                        borderSide: BorderSide(color: Colors.grey.shade300),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                IconButton.filled(
                  icon: _sending
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.send_rounded, size: 18),
                  style: IconButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                  ),
                  onPressed: _sending ? null : () => _sendMessage(),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
