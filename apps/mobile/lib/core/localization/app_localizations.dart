import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../theme/app_theme.dart';

enum AppLanguage {
  en('en', 'English', 'EN'),
  am('am', 'አማርኛ', 'አማ'),
  om('om', 'Afaan Oromoo', 'OM');

  final String code;
  final String label;
  final String shortCode;
  const AppLanguage(this.code, this.label, this.shortCode);

  static AppLanguage fromCode(String? code) {
    switch (code?.toLowerCase()) {
      case 'am':
        return AppLanguage.am;
      case 'om':
        return AppLanguage.om;
      default:
        return AppLanguage.en;
    }
  }
}

class LanguageNotifier extends StateNotifier<AppLanguage> {
  LanguageNotifier() : super(AppLanguage.en) {
    _loadLanguage();
  }

  Future<void> _loadLanguage() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString('hc_app_language');
      if (saved != null) {
        state = AppLanguage.fromCode(saved);
      }
    } catch (_) {}
  }

  Future<void> setLanguage(AppLanguage lang) async {
    state = lang;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('hc_app_language', lang.code);
    } catch (_) {}
  }
}

final languageProvider = StateNotifierProvider<LanguageNotifier, AppLanguage>((ref) {
  return LanguageNotifier();
});

class AppStrings {
  static const Map<String, Map<AppLanguage, String>> _translations = {
    // Branding & General
    'app_name': {
      AppLanguage.en: 'Pillar Home Care',
      AppLanguage.am: 'ፒላር የቤት ለቤት ህክምና ክብካቤ',
      AppLanguage.om: 'Pillar Kunuunsa Mana Keessaa',
    },
    'app_subtitle': {
      AppLanguage.en: 'Professional in-home clinical care & nurse visits',
      AppLanguage.am: 'ሙያዊ የቤት ለቤት የህክምና እና የነርስ አገልግሎት',
      AppLanguage.om: 'Tajaajila yaala mana keessaa fi kunuunsa narsii ogummaa qabu',
    },
    'language_label': {
      AppLanguage.en: 'Language',
      AppLanguage.am: 'ቋንቋ',
      AppLanguage.om: 'Afaan',
    },
    'select_language': {
      AppLanguage.en: 'Preferred Language',
      AppLanguage.am: 'ተመራጭ ቋንቋ',
      AppLanguage.om: 'Afaan Filatamaa',
    },
    'target_market_footer': {
      AppLanguage.en: 'Target market: Addis Ababa • In-Home Health Care',
      AppLanguage.am: 'አገልግሎት አድራሻ፦ አዲስ አበባ • የቤት ለቤት ጤና ክብካቤ',
      AppLanguage.om: 'Iddoo tajaajilaa: Finfinnee • Kunuunsa Fayyaa Manaa',
    },

    // Login Screen
    'customer_mode': {
      AppLanguage.en: 'Customer Mode',
      AppLanguage.am: 'የደንበኛ / ታካሚ',
      AppLanguage.om: 'Maamila / Dhukkubsataa',
    },
    'caregiver_mode': {
      AppLanguage.en: 'Caregiver / Nurse',
      AppLanguage.am: 'ነርስ / ተንከባካቢ',
      AppLanguage.om: 'Narsii / Kunuunsaa',
    },
    'enter_phone': {
      AppLanguage.en: 'Enter Phone Number',
      AppLanguage.am: 'ስልክ ቁጥር ያስገቡ',
      AppLanguage.om: 'Lakkoofsa Bilbilaa Galchaa',
    },
    'password': {
      AppLanguage.en: 'Password',
      AppLanguage.am: 'የይለፍ ቃል (Password)',
      AppLanguage.om: 'Jecha Darbii (Password)',
    },
    'enter_password_hint': {
      AppLanguage.en: 'Enter your password',
      AppLanguage.am: 'የይለፍ ቃልዎን ያስገቡ',
      AppLanguage.om: 'Jecha darbii keessan galchaa',
    },
    'sign_in_btn': {
      AppLanguage.en: 'Sign In With Account',
      AppLanguage.am: 'ወደ መለያዎ ይግቡ',
      AppLanguage.om: 'Herrega Keessaniin Seenaa',
    },
    'register_caregiver_btn': {
      AppLanguage.en: 'Register Caregiver',
      AppLanguage.am: 'እንደ ነርስ / ተንከባካቢ ይመዝገቡ',
      AppLanguage.om: 'Akka Narsii / Kunuunsaatti Galmaa\'aa',
    },
    'register_customer_btn': {
      AppLanguage.en: 'New Patient? Register Customer Account',
      AppLanguage.am: 'አዲስ ደንበኛ ነዎት? እዚህ ይመዝገቡ',
      AppLanguage.om: 'Maamila Haaraa? Herrega Maamilaa Banadhaa',
    },
    'enter_otp': {
      AppLanguage.en: 'Enter 6-Digit Verification Code',
      AppLanguage.am: 'ባለ 6 አሃዝ የማረጋገጫ ኮድ ያስገቡ',
      AppLanguage.om: 'Koodii Mirkaneessaa Dijitii 6 Galchaa',
    },
    'verify_enter_btn': {
      AppLanguage.en: 'Verify & Enter App',
      AppLanguage.am: 'አረጋግጥ እና ግባ',
      AppLanguage.om: 'Mirkaneessiitii Seeni',
    },
    'back_to_password': {
      AppLanguage.en: 'Back to Password Login',
      AppLanguage.am: 'ወደ የይለፍ ቃል መግቢያ ተመለስ',
      AppLanguage.om: 'Gara Seensa Jecha Darbiitti Deebi\'i',
    },
    'forgot_password_link': {
      AppLanguage.en: 'Forgot Password?',
      AppLanguage.am: 'የይለፍ ቃል ረሱ?',
      AppLanguage.om: 'Jecha Darbii Dagattanii?',
    },
    'forgot_password_title': {
      AppLanguage.en: 'Forgot & Reset Password',
      AppLanguage.am: 'የይለፍ ቃል መቀየሪያ',
      AppLanguage.om: 'Jecha Darbii Haaromsuu',
    },
    'forgot_password_subtitle': {
      AppLanguage.en: 'Enter your registered phone number to receive a 6-digit verification code and set a new alphanumeric password.',
      AppLanguage.am: 'የተመዘገቡበትን ስልክ ቁጥር ያስገቡ እና ባለ 6 አሃዝ ማረጋገጫ ኮድ በመጠቀም አዲስ የይለፍ ቃል ያስገቡ።',
      AppLanguage.om: 'Lakkoofsa bilbilaa galmaa\'e galchuun koodii dijitii 6 fudhadhaa jecha darbii haaraa galchaa.',
    },
    'send_reset_code_btn': {
      AppLanguage.en: 'Send Verification Code',
      AppLanguage.am: 'የማረጋገጫ ኮድ ላክ',
      AppLanguage.om: 'Koodii Mirkaneessaa Ergi',
    },
    'new_password_label': {
      AppLanguage.en: 'New Password (Alphanumeric) *',
      AppLanguage.am: 'አዲስ የይለፍ ቃል (ፊደል እና ቁጥር) *',
      AppLanguage.om: 'Jecha Darbii Haaraa (Qubee fi Lakkoofsa) *',
    },
    'confirm_new_password_label': {
      AppLanguage.en: 'Confirm New Password *',
      AppLanguage.am: 'አዲሱን የይለፍ ቃል ያረጋግጡ *',
      AppLanguage.om: 'Jecha Darbii Haaraa Mirkaneessaa *',
    },
    'reset_password_btn': {
      AppLanguage.en: 'Reset Password & Sign In',
      AppLanguage.am: 'የይለፍ ቃል ቀይር እና ግባ',
      AppLanguage.om: 'Jecha Darbii Haaromsiitii Seeni',
    },

    // Customer Registration
    'customer_reg_title': {
      AppLanguage.en: 'Customer / Patient Registration',
      AppLanguage.am: 'የደንበኛ / ታካሚ ምዝገባ',
      AppLanguage.om: 'Galmee Maamilaa / Dhukkubsataa',
    },
    'customer_reg_banner': {
      AppLanguage.en: 'Create a patient account with Pillar Home Care to request verified nurse visits & elderly home care across Addis Ababa.',
      AppLanguage.am: 'በአዲስ አበባ የተረጋገጡ ነርሶችን እና የአረጋውያን የቤት ለቤት ክብካቤ ለማግኘት የፒላር ሆም ኬር መለያ ይክፈቱ።',
      AppLanguage.om: 'Finfinnee keessatti tajaajila narsii mirkanaa\'ee fi kunuunsa maanguddootaa argachuuf herrega Pillar Home Care banadhaa.',
    },
    'personal_info': {
      AppLanguage.en: 'Personal Information',
      AppLanguage.am: 'የግል መረጃ',
      AppLanguage.om: 'Odeeffannoo Dhuunfaa',
    },
    'full_name': {
      AppLanguage.en: 'Full Name *',
      AppLanguage.am: 'ሙሉ ስም *',
      AppLanguage.om: 'Maqaa Guutuu *',
    },
    'full_name_hint': {
      AppLanguage.en: 'Enter full name',
      AppLanguage.am: 'ሙሉ ስም ያስገቡ',
      AppLanguage.om: 'Maqaa guutuu galchaa',
    },
    'full_name_error': {
      AppLanguage.en: 'Please enter your full name',
      AppLanguage.am: 'እባክዎ ሙሉ ስምዎን ያስገቡ',
      AppLanguage.om: 'Maaloo maqaa guutuu keessan galchaa',
    },
    'phone_ethiopia': {
      AppLanguage.en: 'Phone Number (Ethiopia) *',
      AppLanguage.am: 'ስልክ ቁጥር (ኢትዮጵያ) *',
      AppLanguage.om: 'Lakkoofsa Bilbilaa (Itoophiyaa) *',
    },
    'phone_error': {
      AppLanguage.en: 'Please enter a valid phone number',
      AppLanguage.am: 'እባክዎ ትክክለኛ ስልክ ቁጥር ያስገቡ',
      AppLanguage.om: 'Maaloo lakkoofsa bilbilaa sirrii galchaa',
    },
    'password_alphanumeric_label': {
      AppLanguage.en: 'Password (Alphanumeric) *',
      AppLanguage.am: 'የይለፍ ቃል (ፊደል እና ቁጥር) *',
      AppLanguage.om: 'Jecha Darbii (Qubee fi Lakkoofsa) *',
    },
    'password_alphanumeric_hint': {
      AppLanguage.en: 'Letters & numbers (e.g. Care2026)',
      AppLanguage.am: 'ፊደላትና ቁጥሮች (ምሳሌ፦ Care2026)',
      AppLanguage.om: 'Qubee fi lakkoofsa (fkn. Care2026)',
    },
    'password_alphanumeric_helper': {
      AppLanguage.en: 'Must contain at least 6 characters with both letters and numbers',
      AppLanguage.am: 'ቢያንስ 6 ሆሄያት ሆኖ ፊደላት (A-Z) እና ቁጥሮች (0-9) መያዝ አለበት',
      AppLanguage.om: 'Yoo xiqqaate arfii 6 ta\'ee qubee (A-Z) fi lakkoofsa (0-9) of keessaa qabaachuu qaba',
    },
    'password_min_error': {
      AppLanguage.en: 'Password must be at least 6 characters and alphanumeric (letters & numbers)',
      AppLanguage.am: 'የይለፍ ቃል ቢያንስ 6 ሆሄያት ሆኖ ፊደላትና ቁጥሮችን ያካተተ መሆን አለበት',
      AppLanguage.om: 'Jechi darbii yoo xiqqaate arfii 6 ta\'ee qubee fi lakkoofsa of keessaa qabaachuu qaba',
    },
    'password_alpha_error': {
      AppLanguage.en: 'Password must be alphanumeric (contain both letters and numbers)',
      AppLanguage.am: 'የይለፍ ቃል ፊደላት (A-Z) እና ቁጥሮች (0-9) በአንድነት መያዝ አለበት',
      AppLanguage.om: 'Jechi darbii qubee (A-Z) fi lakkoofsa (0-9) waliin qabaachuu qaba',
    },
    'confirm_password_label': {
      AppLanguage.en: 'Confirm Password *',
      AppLanguage.am: 'የይለፍ ቃል ያረጋግጡ *',
      AppLanguage.om: 'Jecha Darbii Mirkaneessaa *',
    },
    'confirm_password_hint': {
      AppLanguage.en: 'Re-enter your password',
      AppLanguage.am: 'የይለፍ ቃልዎን በድጋሚ ያስገቡ',
      AppLanguage.om: 'Jecha darbii keessan irra deebi\'aa galchaa',
    },
    'confirm_password_empty': {
      AppLanguage.en: 'Please confirm your password',
      AppLanguage.am: 'እባክዎ የይለፍ ቃልዎን በድጋሚ ያስገቡ',
      AppLanguage.om: 'Maaloo jecha darbii keessan mirkaneessaa',
    },
    'confirm_password_mismatch': {
      AppLanguage.en: 'Passwords do not match',
      AppLanguage.am: 'ያስገቡት የይለፍ ቃል አይመሳሰልም',
      AppLanguage.om: 'Jechi darbii galchitan wal hin fakkaatu',
    },
    'home_address_section': {
      AppLanguage.en: 'Home Address in Addis Ababa',
      AppLanguage.am: 'የመኖሪያ አድራሻ (አዲስ አበባ)',
      AppLanguage.om: 'Teessoo Manaa (Finfinnee)',
    },
    'sub_city_label': {
      AppLanguage.en: 'Sub-City *',
      AppLanguage.am: 'ክፍለ ከተማ *',
      AppLanguage.om: 'Kutaa Magaalaa *',
    },
    'woreda_label': {
      AppLanguage.en: 'Woreda',
      AppLanguage.am: 'ወረዳ',
      AppLanguage.om: 'Aanaa (Woreda)',
    },
    'house_no_label': {
      AppLanguage.en: 'House No.',
      AppLanguage.am: 'የቤት ቁጥር',
      AppLanguage.om: 'Lakk. Manaa',
    },
    'landmark_label': {
      AppLanguage.en: 'Landmark / Specific Directions',
      AppLanguage.am: 'ልዩ ምልክት / አቅጣጫ',
      AppLanguage.om: 'Mallattoo Addaa / Kallattii',
    },
    'landmark_hint': {
      AppLanguage.en: 'e.g. Near Edna Mall or Behind Medhanialem Church',
      AppLanguage.am: 'ምሳሌ፦ ኤድና ሞል አጠገብ ወይም መድኃኔዓለም ጀርባ',
      AppLanguage.om: 'fkn. Edna Mall bira ykn Waldaa Medhanialem duuba',
    },
    'emergency_contact_section': {
      AppLanguage.en: 'Emergency Family Contact',
      AppLanguage.am: 'የአደጋ ጊዜ ተጠሪ (ቤተሰብ)',
      AppLanguage.om: 'Waamamaa Yeroo Ariifachiisaa (Maatii)',
    },
    'contact_name_label': {
      AppLanguage.en: 'Contact Name',
      AppLanguage.am: 'የተጠሪ ስም',
      AppLanguage.om: 'Maqaa Waamamaa',
    },
    'contact_phone_label': {
      AppLanguage.en: 'Contact Phone',
      AppLanguage.am: 'የተጠሪ ስልክ',
      AppLanguage.om: 'Bilbila Waamamaa',
    },
    'relationship_label': {
      AppLanguage.en: 'Relationship',
      AppLanguage.am: 'ዝምድና',
      AppLanguage.om: 'Firooma',
    },
    'terms_agreement': {
      AppLanguage.en: 'I agree to the Pillar Home Care Terms of Service, Privacy Policy, and medical health record processing.',
      AppLanguage.am: 'በፒላር የቤት ለቤት ህክምና ክብካቤ የአገልግሎት ውል እና የህክምና መረጃ አያያዝ መመሪያ እስማማለሁ።',
      AppLanguage.om: 'Waliigaltee Tajaajilaa fi Imaammata Iccitii Pillar Home Care irratti walii nan gala.',
    },
    'create_customer_btn': {
      AppLanguage.en: 'Create Customer Account',
      AppLanguage.am: 'የደንበኛ መለያ ፍጠር',
      AppLanguage.om: 'Herrega Maamilaa Bani',
    },

    // Caregiver Registration
    'caregiver_reg_title': {
      AppLanguage.en: 'Caregiver Clinical Onboarding',
      AppLanguage.am: 'የነርስ / ተንከባካቢ የሙያ ምዝገባ',
      AppLanguage.om: 'Galmee Ogummaa Narsii / Kunuunsaa',
    },
    'caregiver_join_banner': {
      AppLanguage.en: 'Join Pillar Home Care Network',
      AppLanguage.am: 'የፒላር ሆም ኬር ባለሙያዎች መረብን ይቀላቀሉ',
      AppLanguage.om: 'Toora Ogeeyyii Pillar Home Caretti Makamaa',
    },
    'personal_credentials_section': {
      AppLanguage.en: 'Personal & Account Credentials',
      AppLanguage.am: 'የግል እና የመለያ መረጃ',
      AppLanguage.om: 'Odeeffannoo Dhuunfaa fi Herregaa',
    },
    'full_name_medical_id': {
      AppLanguage.en: 'Full Name (as on Medical ID) *',
      AppLanguage.am: 'ሙሉ ስም (በሙያ መታወቂያው ላይ እንዳለው) *',
      AppLanguage.om: 'Maqaa Guutuu (Waraqaa Eenyummaa Ogummaa irratti) *',
    },
    'clinical_qualifications_section': {
      AppLanguage.en: 'Clinical Qualifications & Scope',
      AppLanguage.am: 'የሙያ ደረጃ እና የስራ ልምድ',
      AppLanguage.om: 'Sadarkaa Ogummaa fi Muuxannoo',
    },
    'professional_title_label': {
      AppLanguage.en: 'Professional Title *',
      AppLanguage.am: 'የሙያ ማዕረግ *',
      AppLanguage.om: 'Gosa Ogummaa *',
    },
    'highest_qualification_label': {
      AppLanguage.en: 'Highest Qualification *',
      AppLanguage.am: 'የትምህርት ደረጃ *',
      AppLanguage.om: 'Sadarkaa Barnootaa *',
    },
    'moh_license_label': {
      AppLanguage.en: 'MOH License Number',
      AppLanguage.am: 'የጤና ጥበቃ ፈቃድ ቁጥር (MOH)',
      AppLanguage.om: 'Lakk. Hayyama Ogummaa (MOH)',
    },
    'years_exp_label': {
      AppLanguage.en: 'Years Exp.',
      AppLanguage.am: 'የስራ ልምድ (ዓመት)',
      AppLanguage.om: 'Muuxannoo (Waggaa)',
    },
    'base_sub_city_label': {
      AppLanguage.en: 'Primary Base Sub-City *',
      AppLanguage.am: 'ዋና የስራ ክፍለ ከተማ *',
      AppLanguage.om: 'Kutaa Magaalaa Hojiin Irratti Hojjetamu *',
    },
    'continue_telebirr_btn': {
      AppLanguage.en: 'Continue to Telebirr Sandbox',
      AppLanguage.am: 'ወደ ቴሌብር ክፍያ ቀጥል',
      AppLanguage.om: 'Gara Kaffaltii Telebirriitti Itti Fufi',
    },

    // Customer Home Screen
    'greeting_prefix': {
      AppLanguage.en: 'Selam',
      AppLanguage.am: 'ሰላም',
      AppLanguage.om: 'Akkam',
    },
    'addis_ababa_ethiopia': {
      AppLanguage.en: 'Addis Ababa, Ethiopia',
      AppLanguage.am: 'አዲስ አበባ፣ ኢትዮጵያ',
      AppLanguage.om: 'Finfinnee, Itoophiyaa',
    },
    'emergency_disclaimer': {
      AppLanguage.en: 'For medical emergencies, call 907 / 911 or visit the nearest hospital emergency room immediately.',
      AppLanguage.am: 'ለድንገተኛ የህክምና እርዳታ ወዲያውኑ ወደ 907 / 911 ይደውሉ ወይም በአቅራቢያዎ ወደሚገኝ ሆስፒታል ይሂዱ።',
      AppLanguage.om: 'Balaa fayyaa tasaa yoo mudate battalumatti 907 / 911 bilbilaa ykn hospitaala dhihoo jiru deemaa.',
    },
    'need_care_title': {
      AppLanguage.en: 'Need Care at Home?',
      AppLanguage.am: 'የቤት ለቤት ህክምና ይፈልጋሉ?',
      AppLanguage.om: 'Kunuunsa Mana Keessaa Barbaadduu?',
    },
    'need_care_subtitle': {
      AppLanguage.en: 'Certified nurses and caregivers dispatched directly to your address.',
      AppLanguage.am: 'የተመሰከረላቸው ነርሶች እና ተንከባካቢዎች በቀጥታ ወደ መኖሪያ ቤትዎ ይላካሉ።',
      AppLanguage.om: 'Narsiwwanii fi kunuunsitootni mirkanaa\'an kallattiin gara mana keessaniitti ni ergamu.',
    },
    'request_care_now_btn': {
      AppLanguage.en: 'Request Care Now',
      AppLanguage.am: 'አሁኑኑ አገልግሎት ይጠይቁ',
      AppLanguage.om: 'Amma Tajaajila Gaafadhaa',
    },
    'active_visit_status': {
      AppLanguage.en: 'Active Visit Status',
      AppLanguage.am: 'የቀጠሮ እና ክብካቤ ሁኔታ',
      AppLanguage.om: 'Haala Beellama Kunuunsaa',
    },
    'no_active_visits': {
      AppLanguage.en: 'No Active Care Visits',
      AppLanguage.am: 'ምንም ንቁ የክብካቤ ቀጠሮ የለም',
      AppLanguage.om: 'Beellamni Kunuunsaa Si\'aayinaan Jiru Hin Jiru',
    },
    'no_active_visits_sub': {
      AppLanguage.en: 'Your booked home care visits will appear here in real time.',
      AppLanguage.am: 'የጠየቋቸው የቤት ለቤት ክብካቤ ቀጠሮዎች እዚህ በቀጥታ ይታያሉ።',
      AppLanguage.om: 'Beellamni kunuunsa mana keessaa qabattan asirratti kallattiin mul\'ata.',
    },
    'our_care_services': {
      AppLanguage.en: 'Our Care Services',
      AppLanguage.am: 'የምንሰጣቸው የክብካቤ አገልግሎቶች',
      AppLanguage.om: 'Tajaajila Kunuunsaa Keenya',
    },

    // Caregiver Home Screen
    'available_for_dispatch': {
      AppLanguage.en: 'Available for Dispatch',
      AppLanguage.am: 'ለስራ ዝግጁ (Available)',
      AppLanguage.om: 'Hojiif Qophii (Available)',
    },
    'off_duty_unavailable': {
      AppLanguage.en: 'Off-Duty / Unavailable',
      AppLanguage.am: 'ከስራ ውጪ (Off-Duty)',
      AppLanguage.om: 'Boqonnaa Irra (Off-Duty)',
    },
    'dispatch_coverage_zone': {
      AppLanguage.en: 'Dispatch Coverage Zone',
      AppLanguage.am: 'የስራ ስምሪት ክልል',
      AppLanguage.om: 'Naannoo Tajaajila Bobba\'iinsaa',
    },
  };

  static String tr(AppLanguage lang, String key) {
    final entry = _translations[key];
    if (entry == null) return key;
    return entry[lang] ?? entry[AppLanguage.en] ?? key;
  }
}

/// 3-option segmented Language Selector Bar (`English` | `አማርኛ` | `Afaan Oromoo`)
class LanguageSelectorBar extends ConsumerWidget {
  const LanguageSelectorBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentLang = ref.watch(languageProvider);

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.surfaceSunken,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: AppColors.borderSubtle),
      ),
      child: Row(
        children: AppLanguage.values.map((lang) {
          final isSelected = currentLang == lang;
          return Expanded(
            child: GestureDetector(
              onTap: () => ref.read(languageProvider.notifier).setLanguage(lang),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
                decoration: BoxDecoration(
                  color: isSelected ? AppColors.primary : Colors.transparent,
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.language_rounded,
                      size: 13,
                      color: isSelected ? Colors.white : AppColors.textSecondary,
                    ),
                    const SizedBox(width: 4),
                    Flexible(
                      child: Text(
                        lang.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 11.5,
                          fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                          color: isSelected ? Colors.white : AppColors.textSecondary,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

/// Compact AppBar Language Popup Menu Chip
class LanguageDropdownChip extends ConsumerWidget {
  final Color? foregroundColor;
  const LanguageDropdownChip({super.key, this.foregroundColor});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final currentLang = ref.watch(languageProvider);
    final fg = foregroundColor ?? AppColors.primary;

    return PopupMenuButton<AppLanguage>(
      tooltip: 'Change Language (English / አማርኛ / Afaan Oromoo)',
      onSelected: (lang) => ref.read(languageProvider.notifier).setLanguage(lang),
      itemBuilder: (context) => AppLanguage.values.map((lang) {
        final isSelected = lang == currentLang;
        return PopupMenuItem<AppLanguage>(
          value: lang,
          child: Row(
            children: [
              Icon(
                isSelected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
                size: 18,
                color: isSelected ? AppColors.primary : AppColors.textSecondary,
              ),
              const SizedBox(width: 8),
              Text(
                lang.label,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                  color: isSelected ? AppColors.primary : AppColors.textPrimary,
                ),
              ),
            ],
          ),
        );
      }).toList(),
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
        decoration: BoxDecoration(
          color: fg.withOpacity(0.1),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: fg.withOpacity(0.3)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.translate_rounded, size: 14, color: fg),
            const SizedBox(width: 4),
            Text(
              currentLang.shortCode,
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: fg),
            ),
            Icon(Icons.arrow_drop_down_rounded, size: 16, color: fg),
          ],
        ),
      ),
    );
  }
}
