import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/theme/app_theme.dart';
import '../models/user.dart';
import '../providers/auth_provider.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _phoneController = TextEditingController(text: '0911234567');
  final _otpController = TextEditingController(text: '123456');
  bool _otpSent = false;
  UserRole _selectedRole = UserRole.customer;

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

              // Role selection selector for demo
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
                        onTap: () => setState(() => _selectedRole = UserRole.customer),
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
                        onTap: () => setState(() => _selectedRole = UserRole.caregiver),
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
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: authState.isLoading
                      ? null
                      : () async {
                          final phoneNormalized = '+251${_phoneController.text.replaceFirst(RegExp(r'^0'), '').replaceAll(RegExp(r'^\+251'), '')}';
                          // Try password login first with demo default password
                          final ok = await ref.read(authProvider.notifier).loginWithPassword(phoneNormalized, 'Admin@Addis2026!');
                          if (!ok) {
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
                const SizedBox(height: 20),

                // Quick Demo Real Account Sign-In
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF9FAFB),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.border),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Text(
                        'Instant Production Sign-In (Real DB):',
                        style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: AppColors.textSecondary),
                      ),
                      const SizedBox(height: 8),
                      if (_selectedRole == UserRole.caregiver) ...[
                        OutlinedButton.icon(
                          icon: const Icon(Icons.medical_services_outlined, size: 16),
                          label: const Text('Sister Almaz (RN - Bole Base)', style: TextStyle(fontSize: 12)),
                          onPressed: () => ref.read(authProvider.notifier).loginWithPassword('+251911111111', 'Admin@Addis2026!'),
                        ),
                        const SizedBox(height: 6),
                        OutlinedButton.icon(
                          icon: const Icon(Icons.location_city_outlined, size: 16),
                          label: const Text('Dawit Kebede (Nurse - Yeka Base)', style: TextStyle(fontSize: 12)),
                          onPressed: () => ref.read(authProvider.notifier).loginWithPassword('+251911222222', 'Admin@Addis2026!'),
                        ),
                      ] else ...[
                        OutlinedButton.icon(
                          icon: const Icon(Icons.person_outline, size: 16),
                          label: const Text('Abebe Bikila (Customer - Bole)', style: TextStyle(fontSize: 12)),
                          onPressed: () => ref.read(authProvider.notifier).loginWithPassword('+251911555555', 'Admin@Addis2026!'),
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
                  style: const TextStyle(fontSize: 22, letterSpacing: 8, fontWeight: FontWeight.bold),
                  decoration: const InputDecoration(
                    counterText: '',
                    hintText: '123456',
                  ),
                ),
                const SizedBox(height: 20),
                ElevatedButton(
                  onPressed: authState.isLoading
                      ? null
                      : () async {
                          await ref.read(authProvider.notifier).verifyOtp(
                                _otpController.text,
                                role: _selectedRole,
                              );
                        },
                  child: authState.isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                        )
                      : Text(_selectedRole == UserRole.caregiver ? 'Sign In as Caregiver' : 'Sign In as Customer'),
                ),
                const SizedBox(height: 12),
                TextButton(
                  onPressed: () => setState(() => _otpSent = false),
                  child: const Text('Change Phone Number'),
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
