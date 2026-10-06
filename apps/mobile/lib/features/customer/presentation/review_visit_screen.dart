import 'package:flutter/material.dart';
import '../../../core/theme/app_theme.dart';

class ReviewVisitScreen extends StatefulWidget {
  final String appointmentId;
  final String caregiverName;
  final String serviceName;

  const ReviewVisitScreen({
    super.key,
    required this.appointmentId,
    required this.caregiverName,
    required this.serviceName,
  });

  @override
  State<ReviewVisitScreen> createState() => _ReviewVisitScreenState();
}

class _ReviewVisitScreenState extends State<ReviewVisitScreen> {
  int _overallRating = 5;
  int _professionalismRating = 5;
  int _punctualityRating = 5;
  int _qualityRating = 5;
  final _commentController = TextEditingController();
  bool _submitting = false;

  void _submit() async {
    setState(() => _submitting = true);
    await Future.delayed(const Duration(milliseconds: 900));
    setState(() => _submitting = false);

    if (!mounted) return;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        title: const Row(
          children: [
            Icon(Icons.check_circle, color: AppColors.success),
            SizedBox(width: 8),
            Text('Ameseginalehu!'),
          ],
        ),
        content: const Text(
          'Thank you for your valuable feedback. It helps us maintain exceptional quality standards across Addis Ababa.',
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.pop(ctx); // Close dialog
              Navigator.pop(context); // Go back from review screen
            },
            child: const Text('Return to Home'),
          ),
        ],
      ),
    );
  }

  Widget _buildStarRow(String label, int currentRating, void Function(int) onSelect) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 4),
        Row(
          children: List.generate(5, (index) {
            final star = index + 1;
            return GestureDetector(
              onTap: () => onSelect(star),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 4.0),
                child: Icon(
                  star <= currentRating ? Icons.star_rounded : Icons.star_outline_rounded,
                  color: star <= currentRating ? AppColors.accentWarning : AppColors.border,
                  size: 32,
                ),
              ),
            );
          }),
        ),
        const SizedBox(height: 14),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Review Visit Experience'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 26,
                    backgroundColor: AppColors.primaryLight,
                    child: const Icon(Icons.person, color: AppColors.primary, size: 28),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          widget.caregiverName,
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          widget.serviceName,
                          style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'How was your care visit?',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 4),
            const Text(
              'Please rate each aspect to help us evaluate quality and improve care.',
              style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 20),

            _buildStarRow('Overall Experience', _overallRating, (val) => setState(() => _overallRating = val)),
            _buildStarRow('Caregiver Professionalism', _professionalismRating, (val) => setState(() => _professionalismRating = val)),
            _buildStarRow('Punctuality & Arrival Time', _punctualityRating, (val) => setState(() => _punctualityRating = val)),
            _buildStarRow('Quality of Clinical / Home Service', _qualityRating, (val) => setState(() => _qualityRating = val)),

            const SizedBox(height: 8),
            const Text(
              'Detailed Comments & Feedback',
              style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
            ),
            const SizedBox(height: 6),
            TextField(
              controller: _commentController,
              maxLines: 4,
              decoration: const InputDecoration(
                hintText: 'Share what you liked or how we can improve our service...',
              ),
            ),
            const SizedBox(height: 28),

            SizedBox(
              width: double.infinity,
              height: 48,
              child: ElevatedButton(
                onPressed: _submitting ? null : _submit,
                child: _submitting
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                    : const Text('Submit Review', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
