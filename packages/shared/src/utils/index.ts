/**
 * Datetime conventions:
 * - API/DB instants: UTC ISO strings
 * - Browser display: viewer local timezone (omit timeZone in Intl)
 * - Public SSR: format after client mount only; use dual formatters for abroad events
 * - Event forms: wall-clock in event.timezone via eventDateTimeLocal helpers
 * - Sessions: startDateTime/endDateTime UTC instants
 * - Emails/server logs: event timezone with explicit venue label
 */
export { CLUB_TIMEZONE, CLUB_TIMEZONE_LABEL } from "./constants";
export {
    fromDateTimeLocalValue,
    isDateTimeLocalValue,
    toDateTimeLocalValue,
} from "./datetimeLocal";
export {
    fromEventDateTimeLocalValue,
    toEventDateTimeLocalValue,
} from "./eventDateTimeLocal";
export {
    fromDateInputValue,
    toDateInputValue,
    toLocalDayKey,
} from "./dateInput";
export {
    COMMON_EVENT_TIMEZONES,
    combineEventLocalDateTime,
    extractEventLocalTime,
    getTimezoneLabel,
    isValidIanaTimezone,
    toEventDayString,
} from "./eventLocal";
export {
    formatDate,
    formatDateCompact,
    formatDateRange,
    formatDateTime,
    formatDateTimeInClubTimezone,
    formatDateWithWeekday,
    formatEventDateRange,
    formatEventDateRangeInClubTimezone,
    formatEventDateRangeInTimezone,
    formatMonthShort,
    formatMonthYear,
    formatRegistrationDeadline,
    formatTime,
} from "./formatInstant";
export {
    formatSessionRange,
    formatSessionRangeInClubTimezone,
    formatSessionRangeInTimezone,
} from "./formatSession";
export {
    formatEventDateRangeDual,
    formatSessionRangeDual,
} from "./formatDual";
export {
    combineClubLocalDateTime,
    extractClubLocalTime,
    toClubDayString,
} from "./clubLocal";
export { COMMON_EMAIL_DOMAINS, matchEmailDomainSuggestions } from "./emailDomains";
export {
    isTitleLayoutField,
    normalizeTemplateLayout,
    parseTemplateLayoutWording,
    type TemplateLayoutStaticText,
    type TemplateLayoutWording,
} from "./certificateLayoutWording";
export {
    DEFAULT_TICKET_ACCENT,
    DEFAULT_TICKET_PALETTE,
    deriveTicketPalette,
    normalizeHex,
    type TicketPalette,
    type TicketPaletteShade,
} from "./ticketDesign";
export {
    formatDurationMinutes,
    getSegmentDuration,
    sumSegmentDurations,
    type SegmentDurationResult,
    type SessionAttendanceSegmentInput,
} from "./sessionAttendanceDuration";
