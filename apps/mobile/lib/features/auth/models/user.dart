enum UserRole { customer, caregiver, admin, unknown }

class AppUser {
  final String id;
  final String phone;
  final String fullName;
  final UserRole role;
  final bool isAvailable;

  AppUser({
    required this.id,
    required this.phone,
    required this.fullName,
    required this.role,
    this.isAvailable = false,
  });

  factory AppUser.fromJson(Map<String, dynamic> json) {
    UserRole parsedRole = UserRole.customer;
    final r = json['role']?.toString().toUpperCase();
    if (r == 'CAREGIVER') {
      parsedRole = UserRole.caregiver;
    } else if (r == 'ADMIN') {
      parsedRole = UserRole.admin;
    }

    return AppUser(
      id: json['id'] ?? '',
      phone: json['phone_e164'] ?? json['phone'] ?? '',
      fullName: json['full_name'] ?? 'User',
      role: parsedRole,
      isAvailable: json['is_available'] ?? false,
    );
  }
}
