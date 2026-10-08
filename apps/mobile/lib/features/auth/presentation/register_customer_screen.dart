import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/auth_provider.dart';

class RegisterCustomerScreen extends ConsumerStatefulWidget {
  const RegisterCustomerScreen({super.key});

  @override
  ConsumerState<RegisterCustomerScreen> createState() => _RegisterCustomerScreenState();
}

class _RegisterCustomerScreenState extends ConsumerState<RegisterCustomerScreen> {
  final _formKey = GlobalKey<FormState>();

  final _nameController = TextEditingController();
  final _phoneController = TextEditingController(text: '09');
  final _passwordController = TextEditingController();
  final _woredaController = TextEditingController(text: '02');
  final _houseController = TextEditingController(text: 'House 204');
  final _landmarkController = TextEditingController();
  final _emergencyNameController = TextEditingController();
  final _emergencyPhoneController = TextEditingController(text: '09');
  final _emergencyRelController = TextEditingController(text: 'Family');

  String _selectedSubCity = 'Bole';
  bool _agreedToTerms = true;
  bool _obscurePassword = true;

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
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _passwordController.dispose();
    _woredaController.dispose();
    _houseController.dispose();
    _landmarkController.dispose();
    _emergencyNameController.dispose();
    _emergencyPhoneController.dispose();
    _emergencyRelController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    if (!_agreedToTerms) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please accept terms and health data processing')),
      );
      return;
    }

    final success = await ref.read(authProvider.notifier).registerCustomer(
          fullName: _nameController.text.trim(),
          phone: _phoneController.text.trim(),
          password: _passwordController.text.trim(),
          subCity: _selectedSubCity,
          woreda: _woredaController.text.trim(),
          houseNumber: _houseController.text.trim(),
          landmark: _landmarkController.text.trim(),
          emergencyName: _emergencyNameController.text.trim(),
          emergencyPhone: _emergencyPhoneController.text.trim(),
          emergencyRel: _emergencyRelController.text.trim(),
        );

    if (success && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: AppColors.primary,
          content: Text('Account created successfully! Welcome to Home Care Addis.'),
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
        title: const Text('Customer / Patient Registration'),
        elevation: 0,
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Form(
            key: _formKey,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header badge
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.primary.withOpacity(0.2)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.person_add_alt_1_rounded, color: AppColors.primary, size: 24),
                      SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Create a patient account to request verified nurse visits & elderly home care across Addis Ababa.',
                          style: TextStyle(fontSize: 12, color: AppColors.textPrimary, height: 1.3),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Personal Details Section
                const Text(
                  'Personal Information',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 10),

                TextFormField(
                  controller: _nameController,
                  decoration: const InputDecoration(
                    labelText: 'Full Name *',
                    hintText: 'Abebe Bikila',
                    prefixIcon: Icon(Icons.person_outline),
                  ),
                  validator: (v) => v == null || v.trim().length < 2 ? 'Please enter your full name' : null,
                ),
                const SizedBox(height: 14),

                TextFormField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    labelText: 'Phone Number (Ethiopia) *',
                    hintText: '0911555555',
                    prefixIcon: Icon(Icons.phone_outlined),
                  ),
                  validator: (v) => v == null || v.trim().length < 9 ? 'Please enter a valid phone number' : null,
                ),
                const SizedBox(height: 14),

                TextFormField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  decoration: InputDecoration(
                    labelText: 'Password *',
                    hintText: '••••••••',
                    prefixIcon: const Icon(Icons.lock_outline),
                    suffixIcon: IconButton(
                      icon: Icon(_obscurePassword ? Icons.visibility_off : Icons.visibility),
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                  ),
                  validator: (v) => v == null || v.length < 6 ? 'Password must be at least 6 characters' : null,
                ),
                const SizedBox(height: 22),

                // Addis Ababa Residence
                const Text(
                  'Home Address in Addis Ababa',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 10),

                DropdownButtonFormField<String>(
                  value: _selectedSubCity,
                  decoration: const InputDecoration(
                    labelText: 'Sub-City *',
                    prefixIcon: Icon(Icons.location_city_outlined),
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
                        decoration: const InputDecoration(
                          labelText: 'Woreda',
                          hintText: '03',
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextFormField(
                        controller: _houseController,
                        decoration: const InputDecoration(
                          labelText: 'House No.',
                          hintText: '402',
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 14),

                TextFormField(
                  controller: _landmarkController,
                  decoration: const InputDecoration(
                    labelText: 'Landmark / Specific Directions',
                    hintText: 'e.g. Near Edna Mall or Behind Medhanialem Church',
                    prefixIcon: Icon(Icons.map_outlined),
                  ),
                ),
                const SizedBox(height: 22),

                // Emergency Contact
                const Text(
                  'Emergency Family Contact',
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 10),

                TextFormField(
                  controller: _emergencyNameController,
                  decoration: const InputDecoration(
                    labelText: 'Contact Name',
                    hintText: 'Family Member Name',
                    prefixIcon: Icon(Icons.contact_phone_outlined),
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
                        decoration: const InputDecoration(
                          labelText: 'Contact Phone',
                          hintText: '0911000000',
                        ),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: TextFormField(
                        controller: _emergencyRelController,
                        decoration: const InputDecoration(
                          labelText: 'Relationship',
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
                    const Expanded(
                      child: Padding(
                        padding: EdgeInsets.only(top: 8.0),
                        child: Text(
                          'I agree to the Home Care Addis Terms of Service, Privacy Policy, and medical health record processing.',
                          style: TextStyle(fontSize: 12, color: AppColors.textSecondary),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 24),

                ElevatedButton(
                  onPressed: authState.isLoading ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: authState.isLoading
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text('Create Customer Account', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
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
