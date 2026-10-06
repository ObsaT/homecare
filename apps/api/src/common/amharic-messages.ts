import { type ErrorCode } from '@homecare/contracts'

/**
 * Amharic messages for the error envelope's `message_am` field.
 *
 * `message_am` is always populated, even when the request locale is English, because a value that
 * is sometimes `undefined` gets skipped by clients and then rendered as "undefined" on a screen a
 * customer's daughter is looking at. A correct Amharic string is better than an absent one.
 *
 * Copy must be reviewed by a fluent speaker and a clinician before launch
 * (docs/16-open-questions.md, launch gate "Amharic reviewed by a fluent speaker").
 */
export const AmharicMessages: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'ከተወሰኑ መስክሮች ላይ ስህተት አለ። እባክዎ ግርገሙን ይረጋግጡ።',
  UNAUTHENTICATED: 'ማስረጃ ትክክል አይደለም። እባክዎ ይግቡ ያለ ይመለሱ።',
  FORBIDDEN: 'ይህን መረጃ ለመፈቀስ የልት ፈቃድ የለዎትም።',
  NOT_FOUND: 'የተጠየቀው መረጃ አልተገኘም።',
  CONFLICT: 'ሁኔታው ተቀይሯል። እባክዎ እንደገና ይሞክሩ።',
  INVALID_STATE_TRANSITION: 'ይህ ለዚህ ደረጃ የሚደረግ ለውጥ አይደለም።',
  RATE_LIMITED: 'በጣም ብዙ ጥያቄዎች ተልኳል። እባክዎ ከጥቂት በኋላ ይሞክሩ።',
  LICENSE_EXPIRED: 'ፈቃዱ ያበቃል። እባክዎ አገልግሎቱን ወስድ ያስቀምጡ።',
  PHI_ACCESS_DENIED: 'የጤና መረጃ ማየት በፈቃድ አልተወጣም።',
  PAYLOAD_TOO_LARGE: 'ፋይሉ በጣም ትልቅ ነው።',
  INTERNAL_ERROR: 'በድጋፍ ላይ ችግር ተከስቷል። ከድጋፍ ጋር ሲናግሩ ከታች ያለውን ቁጥር ይጠቀሙ።',
  ACCOUNT_PENDING: 'መለያዎ አልተጸደቀም። ጸድቆ ከመቀጠላቸው በኋላ አገልግሎቱን መጠቀም ይችላሉ።',
  TOKEN_REUSE_DETECTED: 'የደህንነት ምላሽ ተለይቷል። እባክዎ እንደገና ይግቡ።',
  APPOINTMENT_ALREADY_ASSIGNED: 'ይህ ጉዞ በአለመቀነጣበት ወዲያው ለሌላ የአገልግሎት ሰጪ ተመድቧል።',
  OTP_INVALID: 'የማረጋገጫ ኮድ ትክክል አይደለም።',
  OTP_LOCKED: 'በጣም ብዙ ሞክሮች በመጣጣት ቁጥሩ ተዘግቷል። ከጊዜ ያለፍ ይጠብቁ።',
}

/**
 * Looks up the Amharic message for a code, falling back to the generic internal-error string.
 *
 * The fallback matters: an unmapped code must still produce a present, non-empty `message_am`
 * rather than `undefined`, because a client that skips empty translations renders a blank or
 * literal "undefined" string on a screen a customer's family is looking at.
 */
export function amharicMessageFor(code: string): string {
  const table = AmharicMessages as Record<string, string>
  return table[code] ?? AmharicMessages.INTERNAL_ERROR
}