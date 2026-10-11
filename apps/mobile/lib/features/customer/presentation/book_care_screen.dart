import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/localization/app_localizations.dart';
import '../../../core/network/api_client.dart';
import '../../../core/services/map_launcher_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/route_map_card.dart';
import '../../auth/providers/auth_provider.dart';
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
  final _patientNameController = TextEditingController();
  final _patientAgeController = TextEditingController();
  String _patientGender = 'MALE';
  String _mobility = 'NEEDS_ASSISTANCE';
  final _careNeedsController = TextEditingController();

  DateTime _selectedDate = DateTime.now().add(const Duration(days: 1));
  TimeOfDay _selectedTime = const TimeOfDay(hour: 10, minute: 0);
  int _durationMinutes = 60;

  String _selectedSubCity = 'Bole';
  final _addressController = TextEditingController();
  final _landmarkController = TextEditingController();

  final _emergencyNameController = TextEditingController();
  final _emergencyPhoneController = TextEditingController();

  bool _submitting = false;

  // Google Route place verification & auto-register state
  Timer? _placeDebounce;
  bool _isVerifyingPlace = false;
  VerifiedPlaceResult? _verifiedPlace;
  bool _autoRegisterOnRouteMatch = true;
  bool _launchGoogleMapsOnSubmit = false;

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

  final List<String> _popularAddisPlaces = const [
    'Edna Mall, Bole',
    'Megenagna Square',
    'CMC / St. Michael',
    'Kazanchis / ECA',
    'Sarbet / Old Airport',
    'Mexico Square',
    '4 Kilo / Arat Kilo',
    'Piassa / Giorgis',
    'Gerji / Imperial',
    'Ayat Roundabout',
    'Jemo / Mekanisa',
    '22 Mazoria / Hayahulet',
  ];

  @override
  void initState() {
    super.initState();
    _selectedService = widget.preselectedService ?? 'WOUND_CARE';
    _loadSavedCustomerLocation();
  }

  Future<void> _loadSavedCustomerLocation() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedSubCity = prefs.getString('hc_customer_sub_city');
      final savedLandmark = prefs.getString('hc_customer_landmark');
      final userName = ref.read(authProvider).user?.fullName;
      if (userName != null && userName.isNotEmpty && _patientNameController.text.isEmpty) {
        _patientNameController.text = userName;
      }
      if (savedSubCity != null && subCities.contains(savedSubCity)) {
        setState(() => _selectedSubCity = savedSubCity);
      }
      if (savedLandmark != null && savedLandmark.isNotEmpty) {
        _landmarkController.text = savedLandmark;
        _addressController.text = savedLandmark;
        await _verifyPlaceOnRoute(savedLandmark, triggerAutoSubmit: false);
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _placeDebounce?.cancel();
    _patientNameController.dispose();
    _patientAgeController.dispose();
    _careNeedsController.dispose();
    _addressController.dispose();
    _landmarkController.dispose();
    _emergencyNameController.dispose();
    _emergencyPhoneController.dispose();
    super.dispose();
  }

  void _onPlaceChanged(String value) {
    _placeDebounce?.cancel();
    if (value.trim().length < 2) {
      setState(() {
        _verifiedPlace = null;
        _isVerifyingPlace = false;
      });
      return;
    }
    setState(() => _isVerifyingPlace = true);
    _placeDebounce = Timer(const Duration(milliseconds: 500), () {
      _verifyPlaceOnRoute(value.trim(), triggerAutoSubmit: false);
    });
  }

  Future<void> _verifyPlaceOnRoute(String query, {bool triggerAutoSubmit = false}) async {
    if (!mounted || query.trim().length < 2) return;
    setState(() => _isVerifyingPlace = true);

    final result = await MapLauncherService.verifyPlaceOnGoogleRoute(
      query.trim(),
      fallbackSubCity: _selectedSubCity,
    );

    if (!mounted) return;
    setState(() {
      _isVerifyingPlace = false;
      _verifiedPlace = result;
      if (result != null && subCities.contains(result.subCity)) {
        _selectedSubCity = result.subCity;
      }
      if (result != null && _addressController.text.trim().isEmpty) {
        _addressController.text = result.placeName;
      }
    });

    if (result != null && result.exists && triggerAutoSubmit && _autoRegisterOnRouteMatch && !_submitting) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: const Color(0xFF059669),
          duration: const Duration(seconds: 2),
          content: Text(
            '✅ Google Route verified: ${result.placeName} (${result.distanceKm.toStringAsFixed(1)} km). Auto-registering care visit & navigating...',
          ),
        ),
      );
      await Future.delayed(const Duration(milliseconds: 300));
      if (mounted) {
        _submitBooking(openGoogleMaps: _launchGoogleMapsOnSubmit);
      }
    }
  }

  int get estimatedCostSantim {
    if (_selectedService == 'NURSING' || _selectedService == 'ELDERLY' || _selectedService == 'POST_HOSPITAL') {
      return (_durationMinutes / 60).ceil() * 50000;
    }
    return 50000;
  }

  Future<void> _submitBooking({bool openGoogleMaps = false}) async {
    final authState = ref.read(authProvider);
    if (!authState.isAuthenticated || authState.token == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Please sign in with a registered customer account before booking.'),
          backgroundColor: AppColors.error,
        ),
      );
      return;
    }

    setState(() => _submitting = true);
    final api = ref.read(apiClientProvider);

    // Ensure location is geocoded on Google Route before submitting
    final rawPlace = _landmarkController.text.trim().isNotEmpty
        ? _landmarkController.text.trim()
        : _addressController.text.trim();
    if (_verifiedPlace == null && rawPlace.isNotEmpty) {
      final verified = await MapLauncherService.verifyPlaceOnGoogleRoute(
        rawPlace,
        fallbackSubCity: _selectedSubCity,
      );
      if (verified != null && mounted) {
        setState(() {
          _verifiedPlace = verified;
          if (subCities.contains(verified.subCity)) {
            _selectedSubCity = verified.subCity;
          }
        });
      }
    }

    final subCityMap = {
      'Addis Ketema': '11111111-1111-4111-8111-111111111101',
      'Akaki Kality': '11111111-1111-4111-8111-111111111102',
      'Arada': '11111111-1111-4111-8111-111111111103',
      'Bole': '11111111-1111-4111-8111-111111111104',
      'Gullele': '11111111-1111-4111-8111-111111111105',
      'Kirkos': '11111111-1111-4111-8111-111111111106',
      'Kolfe Keranio': '11111111-1111-4111-8111-111111111107',
      'Lideta': '11111111-1111-4111-8111-111111111108',
      'Nifas Silk-Lafto': '11111111-1111-4111-8111-111111111109',
      'Yeka': '11111111-1111-4111-8111-111111111110',
      'Lemi Kura': '11111111-1111-4111-8111-111111111111',
    };

    final subCityId = subCityMap[_selectedSubCity] ?? '11111111-1111-4111-8111-111111111104';
    final fallbackCoords = MapLauncherService.getSubCityCoords(_selectedSubCity) ?? [9.0016, 38.7852];
    final effectiveLat = _verifiedPlace?.lat ?? fallbackCoords[0];
    final effectiveLng = _verifiedPlace?.lng ?? fallbackCoords[1];
    final effectiveLandmark = _verifiedPlace?.placeName ??
        (_landmarkController.text.trim().isNotEmpty ? _landmarkController.text.trim() : '$_selectedSubCity Residence');
    final effectiveAddress = _addressController.text.trim().isNotEmpty
        ? _addressController.text.trim()
        : effectiveLandmark;

    final dateStr = '${_selectedDate.year}-${_selectedDate.month.toString().padLeft(2, '0')}-${_selectedDate.day.toString().padLeft(2, '0')}';
    final timeStr = '${_selectedTime.hour.toString().padLeft(2, '0')}:${_selectedTime.minute.toString().padLeft(2, '0')}';

    try {
      final res = await api.dio.post('/requests', data: {
        'service_code': _selectedService,
        'patient_name': _patientNameController.text.trim().isNotEmpty
            ? _patientNameController.text.trim()
            : (authState.user?.fullName ?? 'Patient'),
        'patient_age': int.tryParse(_patientAgeController.text) ?? 60,
        'patient_gender': _patientGender,
        'mobility': _mobility,
        'sub_city_id': subCityId,
        'address': effectiveAddress,
        'landmark': effectiveLandmark,
        'latitude': effectiveLat,
        'longitude': effectiveLng,
        'emergency_contact_name': _emergencyNameController.text.trim().isNotEmpty
            ? _emergencyNameController.text.trim()
            : (authState.user?.fullName ?? 'Family Contact'),
        'emergency_contact_phone': _emergencyPhoneController.text.trim().isNotEmpty
            ? _emergencyPhoneController.text.trim()
            : (authState.user?.phone ?? '+251911000000'),
        'scheduled_date': dateStr,
        'scheduled_time': timeStr,
        'duration_minutes': _durationMinutes,
        'notes': _careNeedsController.text.trim().isNotEmpty ? _careNeedsController.text.trim() : null,
      });

      try {
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('hc_customer_sub_city', _selectedSubCity);
        await prefs.setString('hc_customer_landmark', effectiveLandmark);
        await prefs.setDouble('hc_customer_lat', effectiveLat);
        await prefs.setDouble('hc_customer_lng', effectiveLng);
      } catch (_) {}

      setState(() => _submitting = false);
      if (!mounted) return;

      if (openGoogleMaps || _launchGoogleMapsOnSubmit) {
        await MapLauncherService.launchNavigation(
          destLat: effectiveLat,
          destLng: effectiveLng,
          destAddress: '$effectiveLandmark, $_selectedSubCity, Addis Ababa',
          originLat: MapLauncherService.dispatchHubLat,
          originLng: MapLauncherService.dispatchHubLng,
          originAddress: MapLauncherService.dispatchHubTitle,
        );
      }

      if (!mounted) return;
      final data = res.data['data'] ?? {};
      final reference = (data['reference'] ?? 'REQ-2026-948199').toString();
      final status = (data['status'] ?? 'SUBMITTED').toString();
      final requestId = data['id']?.toString();
      final appointmentId = data['appointment'] is Map ? data['appointment']['id']?.toString() : null;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Care request $reference registered with Google Route ($effectiveLandmark)!'),
          backgroundColor: AppColors.success,
        ),
      );

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => RequestTrackingScreen(
            requestId: requestId,
            appointmentId: appointmentId,
            reference: reference,
            serviceName: _selectedService.replaceAll('_', ' '),
            status: status,
            caregiverName: null,
            scheduledTime: '$dateStr at $timeStr',
          ),
        ),
      );
    } catch (e) {
      setState(() => _submitting = false);
      if (!mounted) return;
      if (e.toString().contains('401') || e.toString().contains('Unauthorized')) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Session expired or unauthorized (401). Please sign in with your customer account.'),
            backgroundColor: AppColors.error,
          ),
        );
        ref.read(authProvider.notifier).logout();
        Navigator.pop(context);
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('Error submitting booking: $e'),
          backgroundColor: AppColors.error,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Request Home Care'),
        actions: const [
          LanguageDropdownChip(),
          SizedBox(width: 8),
        ],
      ),
      body: Stepper(
        type: StepperType.horizontal,
        currentStep: _currentStep,
        onStepContinue: () {
          if (_currentStep == 3 && _verifiedPlace != null && _autoRegisterOnRouteMatch) {
            _submitBooking(openGoogleMaps: _launchGoogleMapsOnSubmit);
            return;
          }
          if (_currentStep < 4) {
            setState(() => _currentStep++);
          } else {
            _submitBooking(openGoogleMaps: _launchGoogleMapsOnSubmit);
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
          final isAutoRouteReady = _currentStep == 3 && _verifiedPlace != null && _autoRegisterOnRouteMatch;
          return Padding(
            padding: const EdgeInsets.only(top: 24.0),
            child: Row(
              children: [
                Expanded(
                  child: ElevatedButton(
                    style: isAutoRouteReady
                        ? ElevatedButton.styleFrom(backgroundColor: const Color(0xFF059669))
                        : null,
                    onPressed: _submitting ? null : details.onStepContinue,
                    child: _submitting
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : Text(
                            isAutoRouteReady
                                ? 'REGISTER & NAVIGATE ROUTE (${estimatedCostSantim ~/ 100} ETB)'
                                : (_currentStep == 4 ? 'REQUEST CARE (${estimatedCostSantim ~/ 100} ETB)' : 'Continue'),
                          ),
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
                  onChanged: (val) {
                    if (val != null) setState(() => _selectedService = val);
                  },
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
                        onChanged: (v) {
                          if (v != null) setState(() => _patientGender = v);
                        },
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
                  onChanged: (v) {
                    if (v != null) setState(() => _mobility = v);
                  },
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
                  onChanged: (v) {
                    if (v != null) setState(() => _durationMinutes = v);
                  },
                ),
              ],
            ),
          ),

          // Step 4: Location with Google Route Auto-Verification & Auto-Navigate
          Step(
            title: const Text('Location'),
            isActive: _currentStep >= 3,
            content: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const Icon(Icons.route_rounded, color: Color(0xFF1A73E8), size: 20),
                    const SizedBox(width: 6),
                    const Expanded(
                      child: Text(
                        'Patient Location & Google Route',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                    ),
                    if (_isVerifyingPlace)
                      const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF1A73E8)),
                      )
                    else if (_verifiedPlace != null)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFFECFDF5),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFF10B981).withOpacity(0.4)),
                        ),
                        child: const Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.verified_rounded, size: 13, color: Color(0xFF059669)),
                            SizedBox(width: 4),
                            Text(
                              'Route Found',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF065F46)),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 10),

                TextField(
                  controller: _landmarkController,
                  onChanged: _onPlaceChanged,
                  onSubmitted: (v) => _verifyPlaceOnRoute(v, triggerAutoSubmit: true),
                  decoration: InputDecoration(
                    labelText: 'Nearby Landmark / Google Route Place (ታዋቂ ቦታ) *',
                    hintText: 'e.g. Edna Mall, Megenagna, CMC, Sarbet, 4 Kilo...',
                    helperText: 'Enter or select your place — if it exists in Google Route, it registers & navigates automatically.',
                    helperMaxLines: 2,
                    prefixIcon: const Icon(Icons.location_searching_rounded, color: Color(0xFF1A73E8)),
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.travel_explore_rounded, color: Color(0xFF1A73E8)),
                      tooltip: 'Check Google Route & Auto-Register',
                      onPressed: () => _verifyPlaceOnRoute(_landmarkController.text, triggerAutoSubmit: true),
                    ),
                  ),
                ),
                const SizedBox(height: 10),

                // Quick Select Addis Ababa Google Route Chips
                const Text(
                  '1-Tap Addis Ababa Google Route Places:',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 6),
                Wrap(
                  spacing: 6,
                  runSpacing: 6,
                  children: _popularAddisPlaces.map((place) {
                    final isSelected = _landmarkController.text.trim().toLowerCase() == place.toLowerCase();
                    return ActionChip(
                      avatar: Icon(
                        isSelected ? Icons.check_circle_rounded : Icons.place_outlined,
                        size: 15,
                        color: isSelected ? Colors.white : const Color(0xFF1A73E8),
                      ),
                      label: Text(
                        place,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                          color: isSelected ? Colors.white : AppColors.textPrimary,
                        ),
                      ),
                      backgroundColor: isSelected ? const Color(0xFF1A73E8) : const Color(0xFFEFF6FF),
                      onPressed: () {
                        _landmarkController.text = place;
                        _addressController.text = place;
                        _verifyPlaceOnRoute(place, triggerAutoSubmit: _autoRegisterOnRouteMatch);
                      },
                    );
                  }).toList(),
                ),
                const SizedBox(height: 12),

                // Auto-register & navigate toggle
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  decoration: BoxDecoration(
                    color: const Color(0xFFEFF6FF),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF1A73E8).withOpacity(0.25)),
                  ),
                  child: Column(
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.bolt_rounded, color: Color(0xFF1A73E8), size: 20),
                          const SizedBox(width: 8),
                          const Expanded(
                            child: Text(
                              'Auto-register & navigate when place exists in Google Route',
                              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Color(0xFF1E3A8A)),
                            ),
                          ),
                          Switch(
                            value: _autoRegisterOnRouteMatch,
                            activeColor: const Color(0xFF1A73E8),
                            onChanged: (v) => setState(() => _autoRegisterOnRouteMatch = v),
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          const Icon(Icons.navigation_outlined, color: Color(0xFF059669), size: 18),
                          const SizedBox(width: 8),
                          const Expanded(
                            child: Text(
                              'Open external Google Maps GPS turn-by-turn directions on submit',
                              style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                            ),
                          ),
                          Checkbox(
                            value: _launchGoogleMapsOnSubmit,
                            activeColor: const Color(0xFF059669),
                            onChanged: (v) => setState(() => _launchGoogleMapsOnSubmit = v ?? false),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 12),

                if (_verifiedPlace != null) ...[
                  RouteMapCard(
                    originTitle: MapLauncherService.dispatchHubTitle,
                    destinationTitle: '${_verifiedPlace!.subCity}, Addis Ababa',
                    destinationLandmark: _verifiedPlace!.placeName,
                    originLat: MapLauncherService.dispatchHubLat,
                    originLng: MapLauncherService.dispatchHubLng,
                    destLat: _verifiedPlace!.lat,
                    destLng: _verifiedPlace!.lng,
                    compact: true,
                  ),
                  const SizedBox(height: 12),
                ],

                DropdownButtonFormField<String>(
                  value: _selectedSubCity,
                  decoration: const InputDecoration(labelText: 'Sub-City (ክፍለ ከተማ)'),
                  items: subCities.map((c) => DropdownMenuItem(value: c, child: Text(c))).toList(),
                  onChanged: (v) {
                    if (v != null) setState(() => _selectedSubCity = v);
                  },
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _addressController,
                  decoration: const InputDecoration(labelText: 'House No. / Specific Street'),
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
