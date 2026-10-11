import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/localization/app_localizations.dart';
import '../../../core/services/map_launcher_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/route_map_card.dart';
import '../providers/auth_provider.dart';

class RegisterCustomerScreen extends ConsumerStatefulWidget {
  const RegisterCustomerScreen({super.key});

  @override
  ConsumerState<RegisterCustomerScreen> createState() => _RegisterCustomerScreenState();
}

class _RegisterCustomerScreenState extends ConsumerState<RegisterCustomerScreen> {
  final _formKey = GlobalKey<FormState>();

  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _woredaController = TextEditingController();
  final _houseController = TextEditingController();
  final _landmarkController = TextEditingController();
  final _emergencyNameController = TextEditingController();
  final _emergencyPhoneController = TextEditingController();
  final _emergencyRelController = TextEditingController();

  String _selectedSubCity = 'Bole';
  bool _agreedToTerms = true;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  // Google Route place verification & auto-register state
  Timer? _placeDebounce;
  bool _isVerifyingPlace = false;
  VerifiedPlaceResult? _verifiedPlace;
  bool _autoRegisterOnRouteMatch = true;
  bool _launchGoogleMapsOnRegister = false;
  bool _hasTriggeredAutoSubmit = false;

  String? _validateAlphanumericPassword(String? value, AppLanguage lang) {
    final v = value ?? '';
    if (v.length < 6) {
      return AppStrings.tr(lang, 'password_min_error');
    }
    final hasLetter = RegExp(r'[A-Za-z]').hasMatch(v);
    final hasNumber = RegExp(r'[0-9]').hasMatch(v);
    if (!hasLetter || !hasNumber) {
      return AppStrings.tr(lang, 'password_alpha_error');
    }
    return null;
  }

  final List<String> _subCities = [
    'Bole',
    'Yeka',
    'Kirkos',
    'Arada',
    'Addis Ketema',
    'Lemi Kura',
    'Lideta',
    'Gullele',
    'Nifas Silk-Lafto',
    'Kolfe Keranio',
    'Akaki Kality',
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
  void dispose() {
    _placeDebounce?.cancel();
    _nameController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _woredaController.dispose();
    _houseController.dispose();
    _landmarkController.dispose();
    _emergencyNameController.dispose();
    _emergencyPhoneController.dispose();
    _emergencyRelController.dispose();
    super.dispose();
  }

  void _onLandmarkChanged(String value) {
    _placeDebounce?.cancel();
    if (value.trim().length < 2) {
      setState(() {
        _verifiedPlace = null;
        _isVerifyingPlace = false;
      });
      return;
    }
    setState(() => _isVerifyingPlace = true);
    _placeDebounce = Timer(const Duration(milliseconds: 450), () {
      _verifyPlaceAndMaybeAutoRegister(value.trim());
    });
  }

  bool _areRequiredCredentialsReady() {
    final nameOk = _nameController.text.trim().length >= 2;
    final phoneOk = _phoneController.text.trim().length >= 9;
    final pwd = _passwordController.text;
    final confirmPwd = _confirmPasswordController.text;
    final pwdOk = pwd.length >= 6 &&
        RegExp(r'[A-Za-z]').hasMatch(pwd) &&
        RegExp(r'[0-9]').hasMatch(pwd) &&
        pwd == confirmPwd;
    return nameOk && phoneOk && pwdOk && _agreedToTerms;
  }

  Future<void> _verifyPlaceAndMaybeAutoRegister(String query, {bool forceAutoSubmit = false}) async {
    if (!mounted) return;
    setState(() => _isVerifyingPlace = true);

    final result = await MapLauncherService.verifyPlaceOnGoogleRoute(
      query,
      fallbackSubCity: _selectedSubCity,
    );

    if (!mounted) return;
    setState(() {
      _isVerifyingPlace = false;
      _verifiedPlace = result;
      if (result != null && _subCities.contains(result.subCity)) {
        _selectedSubCity = result.subCity;
      }
    });

    if (result != null && result.exists) {
      final shouldAutoSubmit =
          (forceAutoSubmit || _autoRegisterOnRouteMatch) &&
          !_hasTriggeredAutoSubmit &&
          !ref.read(authProvider).isLoading &&
          _areRequiredCredentialsReady();

      if (shouldAutoSubmit) {
        _hasTriggeredAutoSubmit = true;
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF059669),
            duration: const Duration(seconds: 2),
            content: Row(
              children: [
                const Icon(Icons.where_to_vote_rounded, color: Colors.white, size: 20),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'Google Route verified: ${result.placeName} (${result.distanceKm.toStringAsFixed(1)} km). Auto-registering & navigating...',
                  ),
                ),
              ],
            ),
          ),
        );
        await Future.delayed(const Duration(milliseconds: 350));
        if (mounted) {
          await _submit(openMapsAfter: _launchGoogleMapsOnRegister);
        }
      }
    }
  }

  Future<void> _submit({bool openMapsAfter = false}) async {
    if (_formKey.currentState?.validate() != true) {
      _hasTriggeredAutoSubmit = false;
      return;
    }
    if (!_agreedToTerms) {
      _hasTriggeredAutoSubmit = false;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please accept terms and health data processing')),
      );
      return;
    }

    FocusManager.instance.primaryFocus?.unfocus();
    try {
      await SystemChannels.textInput.invokeMethod('TextInput.hide');
      await SystemChannels.textInput.invokeMethod('TextInput.clearClient');
    } catch (_) {}
    await Future.delayed(const Duration(milliseconds: 90));
    if (!mounted) return;

    // Ensure place is resolved on Google Route if user typed a landmark
    if (_verifiedPlace == null && _landmarkController.text.trim().isNotEmpty) {
      final verified = await MapLauncherService.verifyPlaceOnGoogleRoute(
        _landmarkController.text.trim(),
        fallbackSubCity: _selectedSubCity,
      );
      if (verified != null && mounted) {
        setState(() {
          _verifiedPlace = verified;
          if (_subCities.contains(verified.subCity)) {
            _selectedSubCity = verified.subCity;
          }
        });
      }
    }

    final fallbackCoords = MapLauncherService.getSubCityCoords(_selectedSubCity) ?? [9.0016, 38.7852];
    final effectiveLat = _verifiedPlace?.lat ?? fallbackCoords[0];
    final effectiveLng = _verifiedPlace?.lng ?? fallbackCoords[1];
    final effectiveLandmark = _verifiedPlace?.placeName ??
        (_landmarkController.text.trim().isNotEmpty
            ? _landmarkController.text.trim()
            : '$_selectedSubCity Sub-City');

    final lang = ref.read(languageProvider);
    final authNotifier = ref.read(authProvider.notifier);
    final success = await authNotifier.registerCustomer(
      fullName: _nameController.text.trim(),
      phone: _phoneController.text.trim(),
      password: _passwordController.text.trim(),
      subCity: _selectedSubCity,
      woreda: _woredaController.text.trim(),
      houseNumber: _houseController.text.trim(),
      landmark: effectiveLandmark,
      latitude: effectiveLat,
      longitude: effectiveLng,
      emergencyName: _emergencyNameController.text.trim(),
      emergencyPhone: _emergencyPhoneController.text.trim(),
      emergencyRel: _emergencyRelController.text.trim(),
      preferredLanguage: lang.code,
      deferAuthTransition: true,
    );

    if (success && mounted) {
      if (openMapsAfter || _launchGoogleMapsOnRegister) {
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
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.primary,
          content: Text(
            'Account & Google Route ($effectiveLandmark) registered! Welcome to Pillar Home Care.',
          ),
        ),
      );
      if (Navigator.of(context).canPop()) {
        Navigator.of(context).pop();
      }
      await Future.delayed(const Duration(milliseconds: 60));
      authNotifier.completeDeferredAuthTransition();
    } else if (mounted) {
      _hasTriggeredAutoSubmit = false;
      final err = ref.read(authProvider).errorMessage ?? 'Registration failed';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(backgroundColor: Colors.red.shade700, content: Text(err)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);
    final lang = ref.watch(languageProvider);
    String tr(String key) => AppStrings.tr(lang, key);

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(tr('customer_reg_title')),
        elevation: 0,
        actions: const [
          LanguageDropdownChip(),
          SizedBox(width: 8),
        ],
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Language Selector Bar
                Text(
                  tr('select_language'),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textSecondary),
                ),
                const SizedBox(height: 6),
                const LanguageSelectorBar(),
                const SizedBox(height: 16),

                // Header badge
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.primary.withOpacity(0.2)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.person_add_alt_1_rounded, color: AppColors.primary, size: 24),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          tr('customer_reg_banner'),
                          style: const TextStyle(fontSize: 12, color: AppColors.textPrimary, height: 1.3),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),

                if (authState.errorMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red.shade50,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: Colors.red.shade200),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.error_outline_rounded, color: Colors.red.shade700, size: 20),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            authState.errorMessage!,
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.red.shade800),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // Personal Details Section
                Text(
                  tr('personal_info'),
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 10),

                TextFormField(
                  controller: _nameController,
                  decoration: InputDecoration(
                    labelText: tr('full_name'),
                    hintText: tr('full_name_hint'),
                    prefixIcon: const Icon(Icons.person_outline),
                  ),
                  validator: (v) => v == null || v.trim().length < 2 ? tr('full_name_error') : null,
                ),
                const SizedBox(height: 14),

                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: InputDecoration(
                    labelText: tr('phone_ethiopia'),
                    hintText: '09XXXXXXXX',
                    prefixIcon: const Icon(Icons.phone_outlined),
                  ),
                  validator: (v) => v == null || v.trim().length < 9 ? tr('phone_error') : null,
                ),
                const SizedBox(height: 14),

                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  autovalidateMode: AutovalidateMode.onUserInteraction,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    labelText: tr('password_alphanumeric_label'),
                    hintText: tr('password_alphanumeric_hint'),
                    helperText: tr('password_alphanumeric_helper'),
                    helperMaxLines: 2,
                    errorMaxLines: 2,
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                  ),
                  validator: (v) => _validateAlphanumericPassword(v, lang),
                ),
                const SizedBox(height: 14),

                TextFormField(
                  controller: _confirmPasswordController,
                  obscureText: _obscureConfirmPassword,
                  autovalidateMode: AutovalidateMode.onUserInteraction,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    labelText: tr('confirm_password_label'),
                    hintText: tr('confirm_password_hint'),
                    errorMaxLines: 2,
                    prefixIcon: const Icon(Icons.lock_reset_outlined),
                    suffixIcon: IconButton(
                      icon: Icon(_obscureConfirmPassword ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
                    ),
                  ),
                  validator: (v) {
                    if (v == null || v.isEmpty) {
                      return tr('confirm_password_empty');
                    }
                    if (v != _passwordController.text) {
                      return tr('confirm_password_mismatch');
                    }
                    return _validateAlphanumericPassword(v, lang);
                  },
                ),
                const SizedBox(height: 22),

                // Addis Ababa Residence & Google Route Auto-Verification
                Row(
                  children: [
                    const Icon(Icons.route_rounded, color: Color(0xFF1A73E8), size: 18),
                    const SizedBox(width: 6),
                    Expanded(
                      child: Text(
                        tr('home_address_section'),
                        style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
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
                              'Google Route Verified',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Color(0xFF065F46)),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),

                // Search / Enter Place on Google Route
                TextFormField(
                  controller: _landmarkController,
                  onChanged: _onLandmarkChanged,
                  onFieldSubmitted: (v) => _verifyPlaceAndMaybeAutoRegister(v.trim(), forceAutoSubmit: true),
                  decoration: InputDecoration(
                    labelText: '${tr('landmark_label')} (Google Route Search) *',
                    hintText: tr('landmark_hint'),
                    helperText: 'Type your neighborhood or landmark — if found on Google Route, sub-city & GPS route lock automatically.',
                    helperMaxLines: 2,
                    prefixIcon: const Icon(Icons.location_searching_rounded, color: Color(0xFF1A73E8)),
                    suffixIcon: IconButton(
                      tooltip: 'Verify Place on Google Route',
                      icon: const Icon(Icons.travel_explore_rounded, color: Color(0xFF1A73E8)),
                      onPressed: () => _verifyPlaceAndMaybeAutoRegister(
                        _landmarkController.text.trim(),
                        forceAutoSubmit: false,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 10),

                // 1-Tap Verified Addis Ababa Google Route Places
                const Text(
                  'Quick Select Verified Addis Ababa Route Locations:',
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
                        _verifyPlaceAndMaybeAutoRegister(place);
                      },
                    );
                  }).toList(),
                ),
                const SizedBox(height: 12),

                // Auto-register & navigate toggle card
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
                              'Automatically register & navigate when place exists in Google Route',
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
                              'Also launch turn-by-turn Google Maps GPS route upon registration',
                              style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                            ),
                          ),
                          Checkbox(
                            value: _launchGoogleMapsOnRegister,
                            activeColor: const Color(0xFF059669),
                            onChanged: (v) => setState(() => _launchGoogleMapsOnRegister = v ?? false),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 14),

                // Live Verified Google Route Preview Card when place exists
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
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF059669),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                      ),
                      icon: const Icon(Icons.bolt_rounded, size: 18),
                      label: Text(
                        'Place Verified (${_verifiedPlace!.placeName}) • Register & Navigate Now',
                        style: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.bold),
                      ),
                      onPressed: authState.isLoading ? null : () => _submit(openMapsAfter: true),
                    ),
                  ),
                  const SizedBox(height: 14),
                ],

                DropdownButtonFormField<String>(
                  value: _selectedSubCity,
                  decoration: InputDecoration(
                    labelText: tr('sub_city_label'),
                    prefixIcon: const Icon(Icons.location_city_outlined),
                  ),
                  items: _subCities.map((sc) {
                    return DropdownMenuItem(value: sc, child: Text(sc));
                  }).toList(),
                  onChanged: (val) {
                    if (val != null) setState(() => _selectedSubCity = val);
                  },
                ),
                const SizedBox(height: 14),

                Row(
                  children: [
                    Expanded(
                      child: TextFormField(
                        controller: _woredaController,
                        decoration: InputDecoration(
                          labelText: tr('woreda_label'),
                          hintText: '03',
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _houseController,
                        decoration: InputDecoration(
                          labelText: tr('house_no_label'),
                          hintText: '402',
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 22),

                // Emergency Contact
                Text(
                  tr('emergency_contact_section'),
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 10),

                TextFormField(
                  controller: _emergencyNameController,
                  decoration: InputDecoration(
                    labelText: tr('contact_name_label'),
                    hintText: tr('full_name_hint'),
                    prefixIcon: const Icon(Icons.contact_phone_outlined),
                  ),
                ),
                const SizedBox(height: 14),

                Row(
                  children: [
                    Expanded(
                      flex: 3,
                      child: TextFormField(
                        controller: _emergencyPhoneController,
                        keyboardType: TextInputType.phone,
                        decoration: InputDecoration(
                          labelText: tr('contact_phone_label'),
                          hintText: '0911000000',
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: TextFormField(
                        controller: _emergencyRelController,
                        decoration: InputDecoration(
                          labelText: tr('relationship_label'),
                          hintText: 'Spouse / Child',
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),

                // Agreement checkbox
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Checkbox(
                      value: _agreedToTerms,
                      activeColor: AppColors.primary,
                      onChanged: (v) => setState(() => _agreedToTerms = v ?? false),
                    ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.only(top: 8.0),
                        child: Text(
                          tr('terms_agreement'),
                          style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                ElevatedButton(
                  onPressed: authState.isLoading ? null : () => _submit(openMapsAfter: _launchGoogleMapsOnRegister),
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: authState.isLoading
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : Text(tr('create_customer_btn'), style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                ),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
