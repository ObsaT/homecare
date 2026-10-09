import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../models/user.dart';
import '../providers/auth_provider.dart';
import 'register_customer_screen.dart';
import 'register_caregiver_screen.dart';


class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _phoneController = TextEditingController(text: '0911555555');
  final _passwordController = TextEditingController(text: 'Admin@Addis2026!');
  final _otpController = TextEditingController(text: '123456');
  bool _otpSent = false;
  bool _obscurePassword = true;
  UserRole _selectedRole = UserRole.customer;

  void _onRoleChanged(UserRole role) {
    setState(() {
      _selectedRole = role;
      if (role == UserRole.caregiver) {
        _phoneController.text = '0911111111';
      } else {
        _phoneController.text = '0911555555';
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authProvider);

    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 32.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 16),
              // App Logo / Icon
              Center(
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: const Icon(
                    Icons.health_and_safety_rounded,
                    size: 40,
                    color: Colors.white,
                  ),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Home Care Addis',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                ),
              ),
              const SizedBox(height: 6),
              const Text(
                'Professional in-home clinical care & nurse visits',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 24),

              // Role selection selector
              Container(
                decoration: BoxDecoration(
                  color: AppColors.surfaceSunken,
                  borderRadius: BorderRadius.circular(12),
                ),
                padding: const EdgeInsets.all(4),
                child: Row(
                  children: [
                    Expanded(
                      child: GestureDetector(
                        onTap: () => _onRoleChanged(UserRole.customer),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: _selectedRole == UserRole.customer ? Colors.white : Colors.transparent,
                            borderRadius: BorderRadius.circular(10),
                            boxShadow: _selectedRole == UserRole.customer
                                ? [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4)]
                                : null,
                          ),
                          child: Text(
                            'Customer Mode',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: _selectedRole == UserRole.customer ? FontWeight.bold : FontWeight.normal,
                              color: _selectedRole == UserRole.customer ? AppColors.primary : AppColors.textSecondary,
                            ),
                          ),
                        ),
                      ),
                    ),
                    Expanded(
                      child: GestureDetector(
                        onTap: () => _onRoleChanged(UserRole.caregiver),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 10),
                          decoration: BoxDecoration(
                            color: _selectedRole == UserRole.caregiver ? Colors.white : Colors.transparent,
                            borderRadius: BorderRadius.circular(10),
                            boxShadow: _selectedRole == UserRole.caregiver
                                ? [BoxShadow(color: Colors.black.withOpacity(0.05), blurRadius: 4)]
                                : null,
                          ),
                          child: Text(
                            'Caregiver / Nurse',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: _selectedRole == UserRole.caregiver ? FontWeight.bold : FontWeight.normal,
                              color: _selectedRole == UserRole.caregiver ? AppColors.primary : AppColors.textSecondary,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              if (authState.errorMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.errorLight,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: AppColors.error.withOpacity(0.3)),
                  ),
                  child: Text(
                    authState.errorMessage!,
                    style: const TextStyle(color: AppColors.error, fontSize: 12, fontWeight: FontWeight.w600),
                    textAlign: TextAlign.center,
                  ),
                ),
                const SizedBox(height: 16),
              ],

              if (!_otpSent) ...[
                const Text(
                  'Enter Phone Number',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  decoration: const InputDecoration(
                    prefixIcon: Padding(
                      padding: EdgeInsets.symmetric(horizontal: 14),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text('+251', style: TextStyle(fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                          SizedBox(width: 8),
                          VerticalDivider(width: 1, thickness: 1, indent: 14, endIndent: 14),
                        ],
                      ),
                    ),
                    hintText: '911555555',
                  ),
                ),
                const SizedBox(height: 14),
                const Text(
                  'Password',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _passwordController,
                  obscureText: _obscurePassword,
                  decoration: InputDecoration(
                    prefixIcon: const Icon(Icons.lock_outline_rounded, size: 20),
                    suffixIcon: IconButton(
                      icon: Icon(_obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined, size: 20),
                      onPressed: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                    hintText: 'Admin@Addis2026!',
                  ),
                ),
                const SizedBox(height: 18),
                ElevatedButton(
                  onPressed: authState.isLoading
                      ? null
                      : () async {
                          final phoneDigits = _phoneController.text.trim().replaceFirst(RegExp(r'^0'), '').replaceAll(RegExp(r'^\+251'), '');
                          final phoneNormalized = '+251$phoneDigits';
                          final pwd = _passwordController.text.trim();

                          final ok = await ref.read(authProvider.notifier).loginWithPassword(phoneNormalized, pwd);
                          if (!ok) {
                            // If credentials didn't match, give option to request OTP
                            final otpSuccess = await ref.read(authProvider.notifier).requestOtp(phoneNormalized);
                            if (otpSuccess) setState(() => _otpSent = true);
                          }
                        },
                  child: authState.isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text('Sign In With Account'),
                ),
                const SizedBox(height: 12),
                if (_selectedRole == UserRole.caregiver) ...[
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: Color(0xFF0072BC), width: 1.5),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    icon: const Icon(Icons.person_add_alt_1_rounded, size: 18, color: Color(0xFF0072BC)),
                    label: const Text(
                      'Register Caregiver',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF0072BC)),
                    ),
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const RegisterCaregiverScreen()),
                      );
                    },
                  ),
                ] else ...[
                  OutlinedButton.icon(
                    style: OutlinedButton.styleFrom(
                      side: const BorderSide(color: AppColors.primary, width: 1.5),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    icon: const Icon(Icons.person_add_outlined, size: 18, color: AppColors.primary),
                    label: const Text(
                      'New Patient? Register Customer Account',
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.primary),
                    ),
                    onPressed: () {
                      Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const RegisterCustomerScreen()),
                      );
                    },
                  ),
                ],
                const SizedBox(height: 20),


                // Quick Production One-Tap Sign In
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF9FAFB),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Row(
                        children: [
                          Icon(Icons.flash_on_rounded, size: 16, color: AppColors.primary),
                          SizedBox(width: 6),
                          Text(
                            '1-Tap Production Sign-In (Real DB):',
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      if (_selectedRole == UserRole.caregiver) ...[
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                          ),
                          icon: const Icon(Icons.medical_services_outlined, size: 18),
                          label: const Text('Sister Almaz Hailu (RN - Bole)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                          onPressed: () => ref.read(authProvider.notifier).loginWithPassword('+251911111111', 'Admin@Addis2026!'),
                        ),
                        const SizedBox(height: 8),
                        OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                          ),
                          icon: const Icon(Icons.location_city_outlined, size: 18),
                          label: const Text('Dawit Kebede (Nurse - Yeka)', style: TextStyle(fontSize: 13)),
                          onPressed: () => ref.read(authProvider.notifier).loginWithPassword('+251911222222', 'Admin@Addis2026!'),
                        ),
                      ] else ...[
                        ElevatedButton.icon(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                          ),
                          icon: const Icon(Icons.person_outline, size: 18),
                          label: const Text('Abebe Bikila (Customer - Bole)', style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold)),
                          onPressed: () => ref.read(authProvider.notifier).loginWithPassword('+251911555555', 'Admin@Addis2026!'),
                        ),
                        const SizedBox(height: 8),
                        OutlinedButton.icon(
                          style: OutlinedButton.styleFrom(
                            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
                          ),
                          icon: const Icon(Icons.person_outline, size: 18),
                          label: const Text('Sara Bekele (Customer - Yeka)', style: TextStyle(fontSize: 13)),
                          onPressed: () => ref.read(authProvider.notifier).loginWithPassword('+251911666666', 'Admin@Addis2026!'),
                        ),
                      ],
                    ],
                  ),
                ),
              ] else ...[
                const Text(
                  'Enter 6-Digit Verification Code',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 8),
                TextField(
                  controller: _otpController,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  textAlign: TextAlign.center,
                  style: const TextStyle(fontSize: 20, letterSpacing: 8, fontWeight: FontWeight.bold),
                  decoration: const InputDecoration(
                    hintText: '123456',
                    counterText: '',
                  ),
                ),
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: authState.isLoading
                      ? null
                      : () => ref.read(authProvider.notifier).verifyOtp(_otpController.text, role: _selectedRole),
                  child: authState.isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : const Text('Verify & Enter App'),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => setState(() => _otpSent = false),
                  child: const Text('Back to Password Login'),
                ),
              ],
              const SizedBox(height: 24),
              const Text(
                'Target market: Addis Ababa • In-Home Health Care',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11, color: AppColors.textTertiary),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
