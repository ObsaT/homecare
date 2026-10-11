import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
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

  int _currentStep = 1; // 1 = Profile, 2 = Telebirr Sandbox Checkout

  // Step 1 Controllers
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _licenceController = TextEditingController();
  final _expController = TextEditingController();

  String _selectedTitle = 'Registered Nurse (RN)';
  String _selectedQualification = 'BSc Nursing';
  String _selectedSubCity = 'Bole';
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;
  bool _isCheckingPhone = false;
  String? _profileStepError;

  static String? _validateAlphanumericPassword(String? value) {
    final v = value ?? '';
    if (v.length < 6) {
      return 'Password must be at least 6 characters and alphanumeric (letters & numbers)';
    }
    final hasLetter = RegExp(r'[A-Za-z]').hasMatch(v);
    final hasNumber = RegExp(r'[0-9]').hasMatch(v);
    if (!hasLetter || !hasNumber) {
      return 'Password must be alphanumeric (contain both letters and numbers)';
    }
    return null;
  }

  // Step 2 Telebirr Sandbox State & Controllers
  final _telebirrPhoneController = TextEditingController();
  final _telebirrRefController = TextEditingController();
  final _telebirrPinController = TextEditingController(text: '1234');

  double _registrationFeeEtb = 500.0;
  bool _isLoadingFee = true;
  bool _isCreatingSandboxOrder = false;
  bool _isProcessingPayment = false;

  String? _sandboxPrepayId;
  String? _sandboxMerchOrderId;
  String? _sandboxUssdPrompt;
  String? _sandboxReceiptNumber;
  String? _sandboxSignature;
  String? _sandboxError;

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
        _registrationFeeEtb = (feeData['fee_etb'] as num?)?.toDouble() ?? 500.0;
        _isLoadingFee = false;
      });
    }
  }

  /// Prevents Flutter Web's TextInput DOM activeElement null-check race when swapping steps or routes.
  Future<void> _unfocusSafely() async {
    FocusManager.instance.primaryFocus?.unfocus();
    try {
      await SystemChannels.textInput.invokeMethod('TextInput.hide');
      await SystemChannels.textInput.invokeMethod('TextInput.clearClient');
    } catch (_) {}
    await Future.delayed(const Duration(milliseconds: 90));
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _licenceController.dispose();
    _expController.dispose();
    _telebirrPhoneController.dispose();
    _telebirrRefController.dispose();
    _telebirrPinController.dispose();
    super.dispose();
  }

  Future<void> _proceedToPayment() async {
    if (_formKey.currentState?.validate() != true) return;
    await _unfocusSafely();
    if (!mounted) return;

    final phone = _phoneController.text.trim();
    final licence = _licenceController.text.trim();

    setState(() {
      _isCheckingPhone = true;
      _profileStepError = null;
    });

    final availability = await ref
        .read(authProvider.notifier)
        .checkPhoneAvailability(phone, licenceNumber: licence);

    if (!mounted) return;

    if (availability['available'] != true) {
      final errMsg = availability['message']?.toString() ??
          'This phone number is already registered. Please sign in or use a different phone number.';
      setState(() {
        _isCheckingPhone = false;
        _profileStepError = errMsg;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(backgroundColor: Colors.red.shade700, content: Text(errMsg)),
      );
      return;
    }

    _telebirrPhoneController.text = phone;
    setState(() {
      _isCheckingPhone = false;
      _currentStep = 2;
      _isCreatingSandboxOrder = true;
      _sandboxError = null;
    });

    final order = await ref.read(authProvider.notifier).createTelebirrSandboxOrder(
          amountEtb: _registrationFeeEtb,
          phone: phone,
          purpose: 'CAREGIVER_REGISTRATION',
          title: 'Caregiver Onboarding & License Verification Fee',
        );

    if (mounted) {
      setState(() {
        _sandboxPrepayId = order['prepay_id']?.toString();
        _sandboxMerchOrderId = order['merch_order_id']?.toString();
        _sandboxUssdPrompt = order['ussd_prompt']?.toString();
        _isCreatingSandboxOrder = false;
      });
    }
  }

  Future<void> _backToStep1() async {
    await _unfocusSafely();
    if (!mounted) return;
    setState(() {
      _currentStep = 1;
      _sandboxError = null;
    });
  }

  Future<void> _submitWithTelebirr() async {
    await _unfocusSafely();
    if (!mounted) return;

    setState(() {
      _isProcessingPayment = true;
      _sandboxError = null;
    });

    final authNotifier = ref.read(authProvider.notifier);

    try {
      // 1. Authorize payment against the Telebirr Sandbox Engine
      final authRes = await authNotifier.authorizeTelebirrSandboxOrder(
        prepayId: _sandboxPrepayId,
        merchOrderId: _sandboxMerchOrderId,
        telebirrPhone: _telebirrPhoneController.text.trim(),
        pin: _telebirrPinController.text.trim(),
        amountEtb: _registrationFeeEtb,
        purpose: 'CAREGIVER_REGISTRATION',
      );

      final receiptNo = authRes['receipt_number']?.toString() ?? _telebirrRefController.text.trim();
      final signature = authRes['signature']?.toString();

      if (mounted) {
        setState(() {
          _sandboxReceiptNumber = receiptNo;
          _sandboxSignature = signature;
          _telebirrRefController.text = receiptNo;
        });
      }

      // 2. Register Caregiver with deferAuthTransition: true so we pop this screen cleanly before swapping root home
      final success = await authNotifier.registerCaregiver(
        fullName: _nameController.text.trim(),
        phone: _phoneController.text.trim(),
        password: _passwordController.text.trim(),
        professionalTitle: _selectedTitle,
        qualificationLevel: _selectedQualification,
        licenceNumber: _licenceController.text.trim(),
        yearsExperience: int.tryParse(_expController.text.trim()) ?? 2,
        subCity: _selectedSubCity,
        telebirrPhone: _telebirrPhoneController.text.trim(),
        telebirrReference: receiptNo,
        deferAuthTransition: true,
      );

      if (!mounted) return;
      setState(() => _isProcessingPayment = false);

      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            backgroundColor: const Color(0xFF0072BC),
            content: Text(
              'Telebirr Sandbox Receipt $receiptNo verified! Registered as $_selectedTitle.',
            ),
          ),
        );
        if (Navigator.of(context).canPop()) {
          Navigator.of(context).pop();
        }
        await Future.delayed(const Duration(milliseconds: 60));
        authNotifier.completeDeferredAuthTransition();
      } else {
        final err = ref.read(authProvider).errorMessage ?? 'Registration failed';
        setState(() => _sandboxError = err);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(backgroundColor: Colors.red.shade700, content: Text(err)),
        );
      }
    } catch (e) {
      if (!mounted) return;
      String msg = 'Telebirr Sandbox declined transaction.';
      try {
        final dynamic errObj = e;
        final respData = errObj.response?.data;
        if (respData is Map) {
          msg = respData['message']?.toString() ??
              respData['error']?['message']?.toString() ??
              msg;
        }
      } catch (_) {}
      setState(() {
        _isProcessingPayment = false;
        _sandboxError = msg;
      });
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(backgroundColor: Colors.red.shade700, content: Text(msg)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(_currentStep == 1 ? 'Caregiver Clinical Onboarding' : 'telebirr Sandbox Checkout'),
        elevation: 0,
        backgroundColor: _currentStep == 2 ? const Color(0xFF0072BC) : null,
        foregroundColor: _currentStep == 2 ? Colors.white : null,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: _currentStep == 1
              ? KeyedSubtree(
                  key: const ValueKey('caregiver_step_1_profile'),
                  child: _buildProfileStep(authState),
                )
              : KeyedSubtree(
                  key: const ValueKey('caregiver_step_2_telebirr'),
                  child: _buildTelebirrStep(authState),
                ),
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
                            : 'Standard onboarding fee: ETB ${_registrationFeeEtb.toStringAsFixed(0)} via Telebirr Sandbox',
                        style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          if (_profileStepError != null) ...[
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
                      _profileStepError!,
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.red.shade800),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],

          const Text(
            'Personal & Account Credentials',
            style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
          ),
          const SizedBox(height: 12),

          TextFormField(
            controller: _nameController,
            decoration: const InputDecoration(
              labelText: 'Full Name (as on Medical ID) *',
              hintText: 'Enter full name',
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
              hintText: '09XXXXXXXX',
              prefixIcon: Icon(Icons.phone_outlined),
            ),
            validator: (v) => v == null || v.trim().length < 9 ? 'Please enter a valid phone number' : null,
          ),
          const SizedBox(height: 14),

          TextFormField(
            controller: _passwordController,
            obscureText: _obscurePassword,
            autovalidateMode: AutovalidateMode.onUserInteraction,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: 'Account Password (Alphanumeric) *',
              hintText: 'Letters & numbers (e.g. Nurse2026)',
              helperText: 'Must contain at least 6 characters with both letters and numbers',
              helperMaxLines: 2,
              errorMaxLines: 2,
              prefixIcon: const Icon(Icons.lock_outline),
              suffixIcon: IconButton(
                icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility),
                onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
              ),
            ),
            validator: _validateAlphanumericPassword,
          ),
          const SizedBox(height: 14),

          TextFormField(
            controller: _confirmPasswordController,
            obscureText: _obscureConfirmPassword,
            autovalidateMode: AutovalidateMode.onUserInteraction,
            onChanged: (_) => setState(() {}),
            decoration: InputDecoration(
              labelText: 'Confirm Password *',
              hintText: 'Re-enter your password',
              errorMaxLines: 2,
              prefixIcon: const Icon(Icons.lock_reset_outlined),
              suffixIcon: IconButton(
                icon: Icon(_obscureConfirmPassword ? Icons.visibility_off : Icons.visibility),
                onPressed: () => setState(() => _obscureConfirmPassword = !_obscureConfirmPassword),
              ),
            ),
            validator: (v) {
              if (v == null || v.isEmpty) {
                return 'Please confirm your password';
              }
              if (v != _passwordController.text) {
                return 'Passwords do not match';
              }
              return _validateAlphanumericPassword(v);
            },
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
                    hintText: 'e.g. MOH/RN/44120',
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
                    hintText: 'e.g. 3',
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
            onPressed: _isCheckingPhone ? null : _proceedToPayment,
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0072BC),
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
            child: _isCheckingPhone
                ? const Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      ),
                      SizedBox(width: 10),
                      Text(
                        'Checking Phone & License...',
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                    ],
                  )
                : Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Text(
                        'Continue to Telebirr Sandbox',
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
                      'ETHIO TELECOM SANDBOX (*127#)',
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
              if (_sandboxMerchOrderId != null) ...[
                const SizedBox(height: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    'Order: $_sandboxMerchOrderId • Prepay: ${_sandboxPrepayId ?? ""}',
                    style: const TextStyle(fontSize: 10, fontFamily: 'monospace', color: Colors.white),
                  ),
                ),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Simulated USSD Push Terminal Card
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFF0F172A),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: const Color(0xFF334155)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.phonelink_ring_rounded, size: 16, color: Color(0xFF38BDF8)),
                  const SizedBox(width: 8),
                  const Text(
                    'USSD Push / H5 Sandbox Prompt',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF38BDF8)),
                  ),
                  const Spacer(),
                  if (_isCreatingSandboxOrder)
                    const SizedBox(
                      width: 12,
                      height: 12,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF38BDF8)),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                _sandboxUssdPrompt ??
                    'USSD Push (*127#): Confirm payment of ETB ${_registrationFeeEtb.toStringAsFixed(2)} to Addis Home Care (884210). Enter Telebirr PIN:',
                style: const TextStyle(fontSize: 11, color: Colors.white70, fontFamily: 'monospace', height: 1.4),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        if (_sandboxError != null) ...[
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
                    _sandboxError ?? '',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.red.shade800),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
        ],

        // Quick Sandbox Test Scenario Selector
        const Text(
          '1-Tap Sandbox Test Scenarios:',
          style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 8),
        Wrap(
          spacing: 8,
          runSpacing: 8,
          children: [
            ActionChip(
              avatar: const Icon(Icons.check_circle, size: 16, color: Colors.green),
              label: const Text('Approve (PIN 1234)', style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
              backgroundColor: _telebirrPinController.text == '1234' ? Colors.green.shade50 : null,
              onPressed: () => setState(() {
                _telebirrPinController.text = '1234';
                _sandboxError = null;
              }),
            ),
            ActionChip(
              avatar: const Icon(Icons.money_off_csred_rounded, size: 16, color: Colors.orange),
              label: const Text('Low Balance (PIN 0000)', style: TextStyle(fontSize: 11)),
              backgroundColor: _telebirrPinController.text == '0000' ? Colors.orange.shade50 : null,
              onPressed: () => setState(() => _telebirrPinController.text = '0000'),
            ),
            ActionChip(
              avatar: const Icon(Icons.cancel_outlined, size: 16, color: Colors.red),
              label: const Text('User Cancel (PIN 9999)', style: TextStyle(fontSize: 11)),
              backgroundColor: _telebirrPinController.text == '9999' ? Colors.red.shade50 : null,
              onPressed: () => setState(() => _telebirrPinController.text = '9999'),
            ),
          ],
        ),
        const SizedBox(height: 18),

        // Telebirr payment inputs
        const Text(
          'Telebirr Wallet & PIN Authorization',
          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
        ),
        const SizedBox(height: 12),

        TextField(
          controller: _telebirrPhoneController,
          keyboardType: TextInputType.phone,
          decoration: const InputDecoration(
            labelText: 'Telebirr Mobile Number',
            hintText: '0911223344',
            prefixIcon: Icon(Icons.phone_android_rounded, color: Color(0xFF0072BC)),
          ),
        ),
        const SizedBox(height: 14),

        TextField(
          controller: _telebirrPinController,
          obscureText: true,
          keyboardType: TextInputType.number,
          maxLength: 4,
          decoration: const InputDecoration(
            labelText: 'Telebirr Sandbox PIN (1234 = Approve, 0000 = Decline)',
            hintText: '1234',
            counterText: '',
            prefixIcon: Icon(Icons.lock_rounded, color: Color(0xFF0072BC)),
          ),
        ),
        const SizedBox(height: 14),

        TextField(
          controller: _telebirrRefController,
          readOnly: true,
          decoration: const InputDecoration(
            labelText: 'Telebirr Receipt / Reference (Auto-Generated)',
            prefixIcon: Icon(Icons.receipt_long_rounded, color: Color(0xFF0072BC)),
          ),
        ),
        const SizedBox(height: 18),

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
                    Text('Authorizing Telebirr Sandbox...', style: TextStyle(color: Colors.white)),
                  ],
                )
              : Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.check_circle_outline, color: Colors.white),
                    const SizedBox(width: 8),
                    Text(
                      'Authorize ETB ${_registrationFeeEtb.toStringAsFixed(0)} & Complete Registration',
                      style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: Colors.white),
                    ),
                  ],
                ),
        ),
        const SizedBox(height: 12),

        TextButton.icon(
          icon: const Icon(Icons.arrow_back),
          label: const Text('Back to Edit Profile'),
          onPressed: _backToStep1,
        ),
      ],
    );
  }
}
