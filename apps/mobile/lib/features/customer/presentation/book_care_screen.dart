import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import 'request_tracking_screen.dart';

class BookCareScreen extends ConsumerStatefulWidget {
  final String? preselectedService;

  const BookCareScreen({super.key, this.preselectedService});

  @override
  ConsumerState<BookCareScreen> createState() => _BookCareScreenState();
}

class _BookCareScreenState extends ConsumerState<BookCareScreen> {
  int _currentStep = 0;

  // Form Fields
  late String _selectedService;
  final _patientNameController = TextEditingController(text: 'Kebede Michael');
  final _patientAgeController = TextEditingController(text: '72');
  String _patientGender = 'MALE';
  String _mobility = 'NEEDS_ASSISTANCE';
  final _careNeedsController = TextEditingController(text: 'Dressing change on left knee wound');

  DateTime _selectedDate = DateTime.now().add(const Duration(days: 1));
  TimeOfDay _selectedTime = const TimeOfDay(hour: 10, minute: 0);
  int _durationMinutes = 60;

  String _selectedSubCity = 'Bole';
  final _addressController = TextEditingController(text: 'Bole Atlas, near Edna Mall');
  final _landmarkController = TextEditingController(text: 'Behind Atlas Hotel');

  final _emergencyNameController = TextEditingController(text: 'Aster Kebede');
  final _emergencyPhoneController = TextEditingController(text: '+251911223344');

  bool _submitting = false;

  final List<String> subCities = [
    'Addis Ketema',
    'Akaki Kality',
    'Arada',
    'Bole',
    'Gullele',
    'Kirkos',
    'Kolfe Keranio',
    'Lideta',
    'Nifas Silk-Lafto',
    'Yeka',
    'Lemi Kura',
  ];

  @override
  void initState() {
    super.initState();
    _selectedService = widget.preselectedService ?? 'WOUND_CARE';
  }

  int get estimatedCostSantim {
    if (_selectedService == 'NURSING' || _selectedService == 'ELDERLY' || _selectedService == 'POST_HOSPITAL') {
      return (_durationMinutes / 60).ceil() * 50000;
    }
    return 50000;
  }

  void _submitBooking() async {
    setState(() => _submitting = true);
    await Future.delayed(const Duration(seconds: 1)); // simulated network roundtrip
    setState(() => _submitting = false);

    if (!mounted) return;
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) => RequestTrackingScreen(
          reference: 'REQ-2026-${100000 + DateTime.now().millisecond * 800}',
          serviceName: _selectedService.replaceAll('_', ' '),
          status: 'SUBMITTED',
          caregiverName: null,
          scheduledTime: '${_selectedDate.year}-${_selectedDate.month}-${_selectedDate.day} at ${_selectedTime.format(context)}',
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Request Home Care'),
      ),
      body: Stepper(
        type: StepperType.horizontal,
        currentStep: _currentStep,
        onStepContinue: () {
          if (_currentStep < 4) {
            setState(() => _currentStep++);
          } else {
            _submitBooking();
          }
        },
        onStepCancel: () {
          if (_currentStep > 0) {
            setState(() => _currentStep--);
          } else {
            Navigator.pop(context);
          }
        },
        controlsBuilder: (context, details) {
          return Padding(
            padding: const EdgeInsets.only(top: 24.0),
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    onPressed: _submitting ? null : details.onStepContinue,
                    child: _submitting
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : Text(_currentStep == 4 ? 'REQUEST CARE (${estimatedCostSantim ~/ 100} ETB)' : 'Continue'),
                  ),
                ),
                if (_currentStep > 0) ...[
                  const SizedBox(width: 12),
                  OutlinedButton(
                    onPressed: details.onStepCancel,
                    child: const Text('Back'),
                  ),
                ],
              ],
            ),
          );
        },
        steps: [
          // Step 1: Care Type
          Step(
            title: const Text('Service'),
            isActive: _currentStep >= 0,
            content: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Choose Required Service', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _selectedService,
                  decoration: const InputDecoration(labelText: 'Type of Care'),
                  items: const [
                    DropdownMenuItem(value: 'NURSING', child: Text('Nursing Care (የነርሲንግ ክብካቤ)')),
                    DropdownMenuItem(value: 'ELDERLY', child: Text('Elderly Care (የአረጋውያን ክብካቤ)')),
                    DropdownMenuItem(value: 'POST_HOSPITAL', child: Text('Post-Hospital Care (ከሆስፒታል መልስ)')),
                    DropdownMenuItem(value: 'WOUND_CARE', child: Text('Wound Care & Dressing (የቁስል እጥበት)')),
                    DropdownMenuItem(value: 'MEDICATION', child: Text('Medication Support (የመድሃኒት ክትትል)')),
                    DropdownMenuItem(value: 'PERSONAL_CARE', child: Text('Personal Care (የግል ንጽህና)')),
                    DropdownMenuItem(value: 'FEEDING', child: Text('Feeding Assistance (የምግብ ድጋፍ)')),
                    DropdownMenuItem(value: 'VITALS', child: Text('Vital-Sign Monitoring (ምልክቶች ክትትል)')),
                    DropdownMenuItem(value: 'PHYSIOTHERAPY', child: Text('Physiotherapy (የፊዚዮቴራፒ)')),
                    DropdownMenuItem(value: 'OTHER', child: Text('Other Specialized Request')),
                  ],
                  onChanged: (val) => setState(() => _selectedService = val!),
                ),
              ],
            ),
          ),

          // Step 2: Patient Info
          Step(
            title: const Text('Patient'),
            isActive: _currentStep >= 1,
            content: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Patient Information', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 12),
                TextField(
                  controller: _patientNameController,
                  decoration: const InputDecoration(labelText: 'Patient Full Name'),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _patientAgeController,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(labelText: 'Age (Years)'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: DropdownButtonFormField<String>(
                        value: _patientGender,
                        decoration: const InputDecoration(labelText: 'Gender'),
                        items: const [
                          DropdownMenuItem(value: 'MALE', child: Text('Male')),
                          DropdownMenuItem(value: 'FEMALE', child: Text('Female')),
                          DropdownMenuItem(value: 'OTHER', child: Text('Other')),
                        ],
                        onChanged: (v) => setState(() => _patientGender = v!),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _mobility,
                  decoration: const InputDecoration(labelText: 'Mobility Status'),
                  items: const [
                    DropdownMenuItem(value: 'INDEPENDENT', child: Text('Independent')),
                    DropdownMenuItem(value: 'NEEDS_ASSISTANCE', child: Text('Needs Assistance')),
                    DropdownMenuItem(value: 'WALKING_AID', child: Text('Walking Aid (Cane/Walker)')),
                    DropdownMenuItem(value: 'WHEELCHAIR', child: Text('Wheelchair Bound')),
                    DropdownMenuItem(value: 'BEDBOUND', child: Text('Bedbound')),
                  ],
                  onChanged: (v) => setState(() => _mobility = v!),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _careNeedsController,
                  maxLines: 2,
                  decoration: const InputDecoration(labelText: 'Medical Needs & Precautions'),
                ),
              ],
            ),
          ),

          // Step 3: Appointment
          Step(
            title: const Text('Schedule'),
            isActive: _currentStep >= 2,
            content: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Appointment Time & Duration', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 12),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.calendar_month, color: AppColors.primary),
                  title: Text('Date: ${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}'),
                  trailing: const Text('Select', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
                  onTap: () async {
                    final d = await showDatePicker(
                      context: context,
                      initialDate: _selectedDate,
                      firstDate: DateTime.now(),
                      lastDate: DateTime.now().add(const Duration(days: 90)),
                    );
                    if (d != null) setState(() => _selectedDate = d);
                  },
                ),
                ListTile(
                  contentPadding: EdgeInsets.zero,
                  leading: const Icon(Icons.access_time_rounded, color: AppColors.primary),
                  title: Text('Time: ${_selectedTime.format(context)}'),
                  trailing: const Text('Select', style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold)),
                  onTap: () async {
                    final t = await showTimePicker(context: context, initialTime: _selectedTime);
                    if (t != null) setState(() => _selectedTime = t);
                  },
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<int>(
                  value: _durationMinutes,
                  decoration: const InputDecoration(labelText: 'Estimated Duration'),
                  items: const [
                    DropdownMenuItem(value: 60, child: Text('1 hour')),
                    DropdownMenuItem(value: 120, child: Text('2 hours')),
                    DropdownMenuItem(value: 240, child: Text('4 hours (Half Day)')),
                    DropdownMenuItem(value: 480, child: Text('8 hours (Full Day)')),
                  ],
                  onChanged: (v) => setState(() => _durationMinutes = v!),
                ),
              ],
            ),
          ),

          // Step 4: Location
          Step(
            title: const Text('Location'),
            isActive: _currentStep >= 3,
            content: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Addis Ababa Address', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: _selectedSubCity,
                  decoration: const InputDecoration(labelText: 'Sub-City (ክፍለ ከተማ)'),
                  items: subCities.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                  onChanged: (v) => setState(() => _selectedSubCity = v!),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _addressController,
                  decoration: const InputDecoration(labelText: 'Address / Area'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _landmarkController,
                  decoration: const InputDecoration(labelText: 'Nearby Landmark (ታዋቂ ቦታ)'),
                ),
              ],
            ),
          ),

          // Step 5: Emergency & Review
          Step(
            title: const Text('Confirm'),
            isActive: _currentStep >= 4,
            content: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Emergency Contact', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                const SizedBox(height: 12),
                TextField(
                  controller: _emergencyNameController,
                  decoration: const InputDecoration(labelText: 'Contact Name'),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _emergencyPhoneController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(labelText: 'Contact Phone Number'),
                ),
                const SizedBox(height: 20),

                // Price Summary Card
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.06),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.primary.withOpacity(0.2)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Estimated Service Cost', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                          Text('Pay after visit via Telebirr or CBE', style: TextStyle(fontSize: 11, color: AppColors.textTertiary)),
                        ],
                      ),
                      Text(
                        '${estimatedCostSantim ~/ 100} ETB',
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.primary),
                      ),
                    ],
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
