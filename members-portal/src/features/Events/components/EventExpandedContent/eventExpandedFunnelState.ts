import {
    DEFAULT_CERTIFICATE_ELIGIBLE_SORT,
    EMPTY_CERTIFICATE_ISSUE_DATE_RANGE,
    type CertificateEligibleFilter,
    type CertificateEligibleSortSpec,
    type CertificateIssueDateRange,
} from './certificateEligibleFilterUtils';
import {
    DEFAULT_REGISTRATION_SORT,
    EMPTY_REGISTRATION_SERVER_FILTERS,
    type RegistrationServerFilters,
} from './sections/RegistrationColumnFilterModal';
import type {
    RegistrationColumnFilter,
    RegistrationSortSpec,
} from './registrationTableFilterUtils';

/** Shared search + column/sort/server filters for Registrations and Tickets tabs. */
export interface RegistrationTableFunnelState {
    search: string;
    columnFilters: RegistrationColumnFilter[];
    sortSpec: RegistrationSortSpec;
    serverFilters: RegistrationServerFilters;
}

export interface CertificatesFunnelState {
    search: string;
    columnFilters: CertificateEligibleFilter[];
    sortSpec: CertificateEligibleSortSpec;
    issueDateRange: CertificateIssueDateRange;
}

export const EMPTY_REGISTRATION_TABLE_FUNNEL: RegistrationTableFunnelState = {
    search: '',
    columnFilters: [],
    sortSpec: DEFAULT_REGISTRATION_SORT,
    serverFilters: EMPTY_REGISTRATION_SERVER_FILTERS,
};

export const EMPTY_CERTIFICATES_FUNNEL: CertificatesFunnelState = {
    search: '',
    columnFilters: [],
    sortSpec: DEFAULT_CERTIFICATE_ELIGIBLE_SORT,
    issueDateRange: EMPTY_CERTIFICATE_ISSUE_DATE_RANGE,
};
