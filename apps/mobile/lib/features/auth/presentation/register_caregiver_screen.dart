import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/auth_provider.dart';

class RegisterCaregiverScreen extends ConsumerStatefulWidget {
  const RegisterCaregiverScreen({super.key});

  @override
  ConsumerState<RegisterCaregiverScreen> createState() => _RegisterCaregiverScreenState();
}

class _RegisterCaregiverScreenState extends ConsumerState<RegisterCaregiverScreen> {
  final _formKey = GlobalKey<FormState>();

  int _currentStep = 1; // 1 = Profile, 2 = Telebirr Sample Payment

  // Step 1 Controllers
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController(text: '09');
  final _passwordController = TextEditingController();
  final _licenceController = TextEditingController(text: 'MOH/RN/');
  final _expController = TextEditingController(text: '3');

  String _selectedTitle = 'Registered Nurse (RN)';
  String _selectedQualification = 'BSc Nursing';
  String _selectedSubCity = 'Bole';
  bool _obscurePassword = true;

  // Step 2 Telebirr Controllers
  final _telebirrPhoneController = TextEditingController();
  final _telebirrRefController = TextEditingController();
  final _telebirrPinController = TextEditingController(text: '1234');

  double _registrationFeeEtb = 500.0;
  bool _isLoadingFee = true;
  bool _isProcessingPayment = false;

  final List<String> _titles = [
    'Registered Nurse (RN)',
    'Clinical Nurse',
    'Certified Senior Caregiver',
    'Physiotherapist',
    'Elderly Care Assistant',
    'Midwife / Neonatal Nurse',
  ];

  final List<String> _qualifications = [
    'BSc Nursing',
    'Diploma in Clinical Nursing',
    'Postgraduate Clinical Specialty',
    'Certified Caregiver Diploma',
    'BSc Physiotherapy',
  ];

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

  @override
  void initState() {
    super.initState();
    _fetchFee();
    _telebirrRefController.text = 'TB-${DateTime.now().millisecondsSinceEpoch.toString().substring(5)}';
  }

  Future<void> _fetchFee() async {
    final feeData = await ref.read(authProvider.notifier).getRegistrationFee();
    if (mounted) {
      setState(() {
        _registrationFeeEtb = feeData['fee_etb'] as double? ?? 500.0;
        _isLoadingFee = false;
      });
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _licenceController.dispose();
    _expController.dispose();
    _telebirrPhoneController.dispose();
    _telebirrRefController.dispose();
    _telebirrPinController.dispose();
    super.dispose();
  }

  void _proceedToPayment() {
    if (!_formKey.currentState!.validate()) return;
    _telebirrPhoneController.text = _phoneController.text.trim();
    setState(() {
      _currentStep = 2;
    });
  }

  Future<void> _submitWithTelebirr() async {
    setState(() => _isProcessingPayment = true);

    // Simulated short Telebirr processing delay
    await Future.delayed(const Duration(milliseconds: 1200));

    final success = await ref.read(authProvider.notifier).registerCaregiver(
          fullName: _nameController.text.trim(),
          phone: _phoneController.text.trim(),
          password: _passwordController.text.trim(),
          professionalTitle: _selectedTitle,
          qualificationLevel: _selectedQualification,
          licenceNumber: _licenceController.text.trim(),
          yearsExperience: int.tryParse(_expController.text.trim()) ?? 2,
          subCity: _selectedSubCity,
          telebirrPhone: _telebirrPhoneController.text.trim(),
          telebirrReference: _telebirrRefController.text.trim(),
        );

    setState(() => _isProcessingPayment = false);

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: const Color(0xFF0072BC),
          content: Text(
            'Telebirr payment confirmed! Registered as $_selectedTitle. Welcome!',
          ),
        ),
      );
      Navigator.of(context).pop();
    } else if (mounted) {
      final err = ref.read(authProvider).errorMessage ?? 'Registration failed';
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(backgroundColor: Colors.red.shade700, content: Text(err)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(_currentStep == 1 ? 'Caregiver Clinical Onboarding' : 'telebirr Checkout'),
        elevation: 0,
        backgroundColor: _currentStep == 2 ? const Color(0xFF0072BC) : null,
        foregroundColor: _currentStep == 2 ? Colors.white : null,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: _currentStep == 1 ? _buildProfileStep(authState) : _buildTelebirrStep(authState),
        ),
      ),
    );
  }

  Widget _buildProfileStep(AuthState authState) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Header alert
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: const Color(0xFF0072BC).withOpacity(0.08),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF0072BC).withOpacity(0.2)),
            ),
            child: Row(
              children: [
                const Icon(Icons.verified_user_rounded, color: Color(0xFF0072BC), size: 28),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text(
                        'Join Addis Ababa Caregiver Network',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0072BC)),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        _isLoadingFee
                          ? 'Registration fee is loading...'
                          : 'Standard onboarding fee: ETB ${_registrationFeeEtb.toStringAsFixed(0)} via Telebirr',
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 22),

          const Text(
            'Personal & Account Credentials',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 12),

          TextFormField(
            controller: _nameController,
            decoration: const InputDecoration(
              labelText: 'Full Name (as on Medical ID) *',
              hintText: 'Sister Almaz Hailu',
              prefixIcon: Icon(Icons.person_outline),
            ),
            validator: (v) => v == null || v.trim().length < 2 ? 'Please enter your full name' : null,
          ),
          const SizedBox(height: 14),

          TextFormField(
            controller: _phoneController,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              labelText: 'Phone Number *',
              hintText: '0911223344',
              prefixIcon: Icon(Icons.phone_outlined),
            ),
            validator: (v) => v == null || v.trim().length < 9 ? 'Please enter a valid phone number' : null,
          ),
          const SizedBox(height: 14),

          TextFormField(
            controller: _passwordController,
            obscureText: _obscurePassword,
            decoration: InputDecoration(
              labelText: 'Account Password *',
              hintText: '••••••••',
              prefixIcon: const Icon(Icons.lock_outline),
              suffixIcon: IconButton(
                icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility),
                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
              ),
            ),
            validator: (v) => v == null || v.length < 6 ? 'Password must be at least 6 characters' : null,
          ),
          const SizedBox(height: 24),

          const Text(
            'Clinical Qualifications & Scope',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 12),

          DropdownButtonFormField<String>(
            value: _selectedTitle,
            decoration: const InputDecoration(
              labelText: 'Professional Title *',
              prefixIcon: Icon(Icons.medical_services_outlined),
            ),
            items: _titles.map((t) => DropdownMenuItem(value: t, child: Text(t))).toList(),
            onChanged: (val) {
              if (val != null) setState(() => _selectedTitle = val);
            },
          ),
          const SizedBox(height: 14),

          DropdownButtonFormField<String>(
            value: _selectedQualification,
            decoration: const InputDecoration(
              labelText: 'Highest Qualification *',
              prefixIcon: Icon(Icons.school_outlined),
            ),
            items: _qualifications.map((q) => DropdownMenuItem(value: q, child: Text(q))).toList(),
            onChanged: (val) {
              if (val != null) setState(() => _selectedQualification = val);
            },
          ),
          const SizedBox(height: 14),

          Row(
            children: [
              Expanded(
                flex: 3,
                child: TextFormField(
                  controller: _licenceController,
                  decoration: const InputDecoration(
                    labelText: 'MOH License Number',
                    hintText: 'MOH/RN/44120',
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: TextFormField(
                  controller: _expController,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(
                    labelText: 'Years Exp.',
                    hintText: '3',
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          DropdownButtonFormField<String>(
            value: _selectedSubCity,
            decoration: const InputDecoration(
              labelText: 'Primary Base Sub-City *',
              prefixIcon: Icon(Icons.location_on_outlined),
            ),
            items: _subCities.map((sc) => DropdownMenuItem(value: sc, child: Text(sc))).toList(),
            onChanged: (val) {
              if (val != null) setState(() => _selectedSubCity = val);
            },
          ),
          const SizedBox(height: 28),

          ElevatedButton(
            onPressed: _proceedToPayment,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0072BC),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Text(
                  'Continue to Telebirr Payment',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const SizedBox(width: 8),
                Text(
                  '(ETB ${_registrationFeeEtb.toStringAsFixed(0)})',
                  style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Colors.white70),
                ),
                const SizedBox(width: 6),
                const Icon(Icons.arrow_forward_rounded, size: 18, color: Colors.white),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],
      ),
    );
  }

  Widget _buildTelebirrStep(AuthState authState) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // Telebirr Official Brand Header Banner
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF0072BC), Color(0xFF005A96)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(16),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0072BC).withOpacity(0.3),
                blurRadius: 10,
                offset: const Offset(0, 4),
              ),
            ],
          ),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: const Text(
                      'telebirr',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF0072BC),
                        letterSpacing: -0.5,
                      ),
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text(
                      'SAMPLE CHECKOUT',
                      style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const Text(
                'Registration & Clinical Vetting Fee',
                style: TextStyle(fontSize: 13, color: Colors.white70),
              ),
              const SizedBox(height: 4),
              Text(
                'ETB ${_registrationFeeEtb.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.bold,
                  color: Colors.white,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Merchant: Addis Home Care Health Network (Shortcode: 884210)',
                style: TextStyle(fontSize: 11, color: Colors.white60),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Telebirr payment inputs
        const Text(
          'Confirm Telebirr Mobile Account',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 12),

        TextField(
          controller: _telebirrPhoneController,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(
            labelText: 'Telebirr Phone Number',
            hintText: '0911223344',
            prefixIcon: Icon(Icons.phone_android_rounded, color: Color(0xFF0072BC)),
          ),
        ),
        const SizedBox(height: 14),

        TextField(
          controller: _telebirrRefController,
          decoration: const InputDecoration(
            labelText: 'Sample Transaction Reference',
            hintText: 'TB-REG-XXXXXX',
            prefixIcon: Icon(Icons.receipt_long_rounded, color: Color(0xFF0072BC)),
          ),
        ),
        const SizedBox(height: 14),

        TextField(
          controller: _telebirrPinController,
          obscureText: true,
          keyboardType: TextInputType.number,
          maxLength: 4,
          decoration: const InputDecoration(
            labelText: 'Telebirr PIN (Sample: 1234)',
            hintText: '••••',
            counterText: '',
            prefixIcon: Icon(Icons.lock_rounded, color: Color(0xFF0072BC)),
          ),
        ),
        const SizedBox(height: 16),

        // Sample notice
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: Colors.amber.shade50,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.amber.shade200),
          ),
          child: Row(
            children: [
              Icon(Icons.info_outline, size: 20, color: Colors.amber.shade900),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Telebirr Sample Mode: Simulates instant payment confirmation, records the transaction in Addis Home Care admin billing, and activates your caregiver profile.',
                  style: TextStyle(fontSize: 11, color: Colors.amber.shade900, height: 1.3),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        ElevatedButton(
          onPressed: (_isProcessingPayment || authState.isLoading) ? null : _submitWithTelebirr,
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF0072BC),
            padding: const EdgeInsets.symmetric(vertical: 15),
            elevation: 2,
          ),
          child: _isProcessingPayment || authState.isLoading
              ? const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                    ),
                    SizedBox(width: 12),
                    Text('Simulating Telebirr Payment...', style: TextStyle(color: Colors.white)),
                  ],
                )
              : Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.check_circle_outline, color: Colors.white),
                    const SizedBox(width: 8),
                    Text(
                      'Pay ETB ${_registrationFeeEtb.toStringAsFixed(0)} & Complete Registration',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                  ],
                ),
        ),
        const SizedBox(height: 12),

        TextButton.icon(
          icon: const Icon(Icons.arrow_back),
          label: const Text('Back to Edit Profile'),
          onPressed: () => setState(() => _currentStep = 1),
        ),
      ],
    );
  }
}
