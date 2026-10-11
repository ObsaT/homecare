import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/localization/app_localizations.dart';
import '../../../core/theme/app_theme.dart';
import '../providers/auth_provider.dart';

class ForgotPasswordScreen extends ConsumerStatefulWidget {
  final String? initialPhone;

  const ForgotPasswordScreen({super.key, this.initialPhone});

  @override
  ConsumerState<ForgotPasswordScreen> createState() => _ForgotPasswordScreenState();
}

class _ForgotPasswordScreenState extends ConsumerState<ForgotPasswordScreen> {
  final _formKey = GlobalKey<FormState>();

  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  int _step = 1; // 1 = Request Code, 2 = Verify & Set New Password
  bool _isRequestingCode = false;
  bool _obscureNewPassword = true;
  bool _obscureConfirmPassword = true;

  String? _challengeId;
  String? _accountName;
  String? _accountRole;
  String? _sandboxOtpCode;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    if (widget.initialPhone != null && widget.initialPhone!.trim().isNotEmpty) {
      _phoneController.text = widget.initialPhone!.trim();
    }
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _otpController.dispose();
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _unfocusSafely() async {
    FocusManager.instance.primaryFocus?.unfocus();
    try {
      await SystemChannels.textInput.invokeMethod('TextInput.hide');
      await SystemChannels.textInput.invokeMethod('TextInput.clearClient');
    } catch (_) {}
    await Future.delayed(const Duration(milliseconds: 90));
  }

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

  Future<void> _requestCode() async {
    final rawPhone = _phoneController.text.trim();
    if (rawPhone.length < 9) {
      setState(() => _errorMessage = 'Please enter a valid 9-digit Ethiopian mobile number.');
      return;
    }

    await _unfocusSafely();
    if (!mounted) return;

    setState(() {
      _isRequestingCode = true;
      _errorMessage = null;
    });

    final res = await ref.read(authProvider.notifier).requestPasswordReset(rawPhone);
    if (!mounted) return;

    if (res['success'] == true) {
      final code = res['sandbox_otp_code']?.toString();
      setState(() {
        _isRequestingCode = false;
        _step = 2;
        _challengeId = res['challenge_id']?.toString();
        _accountName = res['account_name']?.toString();
        _accountRole = res['role']?.toString();
        _sandboxOtpCode = code;
        if (code != null && code.isNotEmpty) {
          _otpController.text = code;
        }
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          backgroundColor: AppColors.primary,
          content: Text(res['message']?.toString() ?? 'Verification code sent!'),
        ),
      );
    } else {
      setState(() {
        _isRequestingCode = false;
        _errorMessage = res['message']?.toString() ?? 'Could not send reset code.';
      });
    }
  }

  Future<void> _submitReset() async {
    if (_formKey.currentState?.validate() != true) return;
    await _unfocusSafely();
    if (!mounted) return;

    setState(() => _errorMessage = null);

    final authNotifier = ref.read(authProvider.notifier);
    final success = await authNotifier.confirmPasswordReset(
      phone: _phoneController.text.trim(),
      challengeId: _challengeId,
      otpCode: _otpController.text.trim(),
      newPassword: _newPasswordController.text.trim(),
      confirmPassword: _confirmPasswordController.text.trim(),
      deferAuthTransition: true,
    );

    if (!mounted) return;

    if (success) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          backgroundColor: AppColors.primary,
          content: Text('Password reset successfully! Welcome back to Pillar Home Care.'),
        ),
      );
      if (Navigator.of(context).canPop()) {
        Navigator.of(context).pop();
      }
      await Future.delayed(const Duration(milliseconds: 60));
      authNotifier.completeDeferredAuthTransition();
    } else {
      setState(() {
        _errorMessage = ref.read(authProvider).errorMessage ?? 'Password reset failed.';
      });
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
        title: Text(tr('forgot_password_title')),
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
                const LanguageSelectorBar(),
                const SizedBox(height: 18),

                // Info Banner
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withOpacity(0.08),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: AppColors.primary.withOpacity(0.2)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.lock_reset_rounded, color: AppColors.primary, size: 28),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          tr('forgot_password_subtitle'),
                          style: const TextStyle(fontSize: 12, color: AppColors.textPrimary, height: 1.35),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 18),

                if (_errorMessage != null) ...[
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
                            _errorMessage!,
                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: Colors.red.shade800),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                ],

                // Phone Number Field
                Text(
                  tr('enter_phone'),
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                ),
                const SizedBox(height: 8),
                TextFormField(
                  controller: _phoneController,
                  enabled: _step == 1,
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
                    hintText: '9XXXXXXXX',
                  ),
                  validator: (v) => v == null || v.trim().length < 9 ? tr('phone_error') : null,
                ),
                const SizedBox(height: 18),

                if (_step == 1) ...[
                  ElevatedButton.icon(
                    onPressed: _isRequestingCode ? null : _requestCode,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    icon: _isRequestingCode
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : const Icon(Icons.sms_outlined, size: 18),
                    label: Text(
                      tr('send_reset_code_btn'),
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                  ),
                ] else ...[
                  // Step 2: Account Verified & SMS Code + New Password
                  if (_accountName != null) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: const Color(0xFF10B981).withOpacity(0.35)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.verified_user_rounded, color: Color(0xFF059669), size: 20),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              'Account Found: $_accountName (${_accountRole ?? "USER"})',
                              style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Color(0xFF065F46)),
                            ),
                          ),
                          TextButton(
                            onPressed: () => setState(() {
                              _step = 1;
                              _errorMessage = null;
                            }),
                            child: const Text('Change Phone', style: TextStyle(fontSize: 11)),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],

                  if (_sandboxOtpCode != null && _sandboxOtpCode!.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0F172A),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF334155)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.sms_rounded, color: Color(0xFF38BDF8), size: 20),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                const Text(
                                  'Pillar Home Care SMS Gateway (Sandbox)',
                                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: Color(0xFF38BDF8)),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Your 6-digit password reset code is: $_sandboxOtpCode',
                                  style: const TextStyle(fontSize: 12, fontFamily: 'monospace', color: Colors.white),
                                ),
                              ],
                            ),
                          ),
                          ActionChip(
                            label: const Text('Auto-Filled', style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold)),
                            onPressed: () => setState(() => _otpController.text = _sandboxOtpCode!),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  Text(
                    tr('enter_otp'),
                    style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                  ),
                  const SizedBox(height: 8),
                  TextFormField(
                    controller: _otpController,
                    keyboardType: TextInputType.number,
                    maxLength: 6,
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 20, letterSpacing: 8, fontWeight: FontWeight.bold),
                    decoration: const InputDecoration(
                      hintText: '123456',
                      counterText: '',
                      prefixIcon: Icon(Icons.pin_outlined),
                    ),
                    validator: (v) => v == null || v.trim().length != 6 ? 'Enter 6-digit verification code' : null,
                  ),
                  const SizedBox(height: 16),

                  TextFormField(
                    controller: _newPasswordController,
                    obscureText: _obscureNewPassword,
                    autovalidateMode: AutovalidateMode.onUserInteraction,
                    onChanged: (_) => setState(() {}),
                    decoration: InputDecoration(
                      labelText: tr('new_password_label'),
                      hintText: tr('password_alphanumeric_hint'),
                      helperText: tr('password_alphanumeric_helper'),
                      helperMaxLines: 2,
                      errorMaxLines: 2,
                      prefixIcon: const Icon(Icons.lock_outline),
                      suffixIcon: IconButton(
                        icon: Icon(_obscureNewPassword ? Icons.visibility_off : Icons.visibility),
                        onPressed: () => setState(() => _obscureNewPassword = !_obscureNewPassword),
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
                      labelText: tr('confirm_new_password_label'),
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
                      if (v != _newPasswordController.text) {
                        return tr('confirm_password_mismatch');
                      }
                      return _validateAlphanumericPassword(v, lang);
                    },
                  ),
                  const SizedBox(height: 24),

                  ElevatedButton.icon(
                    onPressed: authState.isLoading ? null : _submitReset,
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    icon: authState.isLoading
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : const Icon(Icons.check_circle_outline_rounded, size: 18),
                    label: Text(
                      tr('reset_password_btn'),
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(height: 10),
                  TextButton.icon(
                    onPressed: _isRequestingCode ? null : _requestCode,
                    icon: const Icon(Icons.refresh_rounded, size: 16),
                    label: const Text('Resend 6-Digit Verification Code'),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
