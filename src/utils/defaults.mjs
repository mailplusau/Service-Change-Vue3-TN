export const COMM_REG_STATUS = {
    Cancelled: 3,
    Changed: 7,
    In_Trial: 1,
    Quote: 10,
    Scheduled: 9,
    Signed: 2,
    Trial_Complete: 8,
    Waiting_TNC: 11,
};

export const SERVICE_CHANGE_STATUS = {
    Active: 2,
    Ceased: 3,
    Inactive: 6,
    Lead: 5,
    Quote: 4,
    Scheduled: 1,
}

export const customer = {
    basic: {
        entityid: '',
        companyname: '',
        vatregnumber: '',
        partner: '',
        entitystatus: '',

        custentity_cust_monthly_service_value: 0,
        custentity_monthly_extra_service_revenue: 0,
        custentity_monthly_reduc_service_revenue: 0,
    },

    miscInfo: {
        custentity_invoice_method: null, // Invoice method
        custentity_accounts_cc_email: null, // Account CC email
        custentity_mpex_po: null, // MPEX PO
        custentity11: null, // Customer PO number
        custentity_mpex_invoicing_cycle: null, // Invoice cycle ID
        terms: null, // Term(?)
        custentity_finance_terms: null, // Customer's Term
        custentity_customer_pricing_notes: '', // Pricing Notes
        custentity_portal_cc_payment: '', // Portal Credit Card Payment
    },

    mpProducts: {
        custentity_mpex_customer: '', // is MPEX Customer
        custentity_exp_mpex_weekly_usage: null, // MPEX Expected Usage
        custentity_form_mpex_usage_per_week: null, // MPEX Weekly Usage
    },

    surveyInfo: {
        custentity_category_multisite: null, // is Multisite
        custentity_category_multisite_link: '', // Multisite Link
        custentity_ap_mail_parcel: null, // is Using Mail/Parcel/Satchel Regularly
        custentity_customer_express_post: null, // is Using Express Post
        custentity_customer_local_couriers: null, // is Using Local Couriers
        custentity_customer_po_box: null, // is Using PO Box
        custentity_customer_bank_visit: null, // is Using Bank Visit
        custentity_lead_type: null, // Lead Type or Classify Lead
    },

    lpoCampaign: {
        custentity_lpo_parent_account: null, // Parent Customer
        companyname: '',
        custentity_invoice_method: null, // Email (2) or LPO (10)
        custentity_invoice_by_email: true, // Invoice By Email
        custentity18: true, // Exclude From Batch Printing
        custentity_exclude_debtor: false, // Exclude From Debtor Campaign
        custentity_fin_consolidated: false, // Consolidated Invoices

        entitystatus: '6',

        custentity_previous_carrier: null, // Account Type
        custentity_lpo_account_status: null, // Account Status
        custentity_lpo_date_last_sales_activity: null, // Last sales activity date
        custentity_lpo_notes: '', // Note

        custentity_mypost_business_number: null, //
        custentity_lpo_profile_assigned: null, //
        custentity_lpo_lead_priority: null,
        custentity_lpo_account_type_linked: null,

        custentity_lpo_comms_to_customer: null,
        custentity_cust_lpo_pre_auth: null,
    }
};

export const franchisee = {
    companyname: null, // Franchisee name
    custentity3: null, // Main contact name
    email: null, // Franchisee email
    custentity2: null, // Main contact phone
    custentity_abn_franchiserecord: null, // Franchise ABN
    custentity_zee_mp_std_activated: '', // Standard Pricing activated
    location: '', // State (NSW, VIC, etc...)
}

export const contact = {
    internalid: null,
    salutation: '',
    firstname: '',
    lastname: '',
    phone: '',
    email: '',
    contactrole: '',
    title: '',
    company: null, // internal id of customer record
    entityid: '',
    custentity_connect_admin: 2,
    custentity_connect_user: 2,
};

export const address = { // address fields and default values
    addr1: '',
    addr2: '',
    city: '',
    state: '',
    zip: '',
    country: 'AU',
    addressee: '', // company name
    custrecord_address_lat: '',
    custrecord_address_lon: '',
    custrecord_address_ncl: '',
};

export const addressSublist = { // address sublist fields and default values
    internalid: null,
    label: '',
    defaultshipping: false,
    defaultbilling: false,
    isresidential: false,
}

export const salesRecord = {
    custrecord_sales_customer: null, // customer
    custrecord_sales_campaign: null,
    custrecord_sales_assigned: null, // sales rep assigned

    custrecord_sales_outcome: 2,
    custrecord_sales_completed: false,
    custrecord_sales_inuse: false,
    custrecord_sales_commreg: null,
    custrecord_sales_completedate: '',
}

export const commReg = {
    custrecord_date_entry: new Date(),
    custrecord_comm_date: '',
    custrecord_comm_date_signup: '',
    custrecord_sale_type: '',
    custrecord_in_out: '',
    custrecord_scand_form: '',
    custrecord_customer: null,
    custrecord_salesrep: null,
    custrecord_franchisee: null,
    custrecord_trial_status: '11', // Waiting T&C (11)
    custrecord_commreg_sales_record: null,
    custrecord_wkly_svcs: '5',
    custrecord_state: '',
    custrecord_finalised_by: '',
    custrecord_finalised_on: '',
    custrecord_trial_expiry: '',
    custrecord_bill_date: '',
}

export const ncLocation = {
    name: '',
    internalid: '',
    custrecord_ap_lodgement_addr1: '',
    custrecord_ap_lodgement_addr2: '',
    custrecord_ap_lodgement_lat: '',
    custrecord_ap_lodgement_long: '',
    custrecord_ap_lodgement_postcode: '',
    custrecord_ap_lodgement_site_phone: '',
    custrecord_ap_lodgement_site_state: '', // getText for this one
    custrecord_ap_lodgement_suburb: '',
    custrecord_ap_lodgement_supply: false,
    custrecord_ncl_monthly_fee: '',
    custrecord_ncl_site_access_code: '',
    custrecord_noncust_location_type: '', // getText for this one too
}

export const serviceFieldIds = [
    "internalid",
    "name",
    "isinactive",
    "custrecord_service_day_adhoc",
    "custrecord_service_day_fri",
    "custrecord_service_day_mon",
    "custrecord_service_day_thu",
    "custrecord_service_day_tue",
    "custrecord_service_day_wed",
    "custrecord_service_gst",
    "custrecord_service",
    "custrecord_service_price",
    "custrecord_service_package",
    "custrecord_service_category",
    "custrecord_service_customer",
    "custrecord_service_franchisee",
    "custrecord_service_ns_item",
    "custrecord_service_comm_reg",
    "custrecord_service_description",
    "custrecord_service_day_freq_cycle",
    "custrecord_service_run_scheduled",
    "custrecord_service_prem_id",
    "custrecord_service_classification",
    "custrecord_service_delete_note",
    "custrecord_service_date_reviewed",
    "custrecord_service_date_last_price_upd",
    "custrecord_show_on_app",
    "custrecord_multiple_operators"
];

export const serviceChange = {
    internalid: null,
    custrecord_servicechg_service: '', // Associated service
    custrecord_servicechg_status: '', // Status
    custrecord_servicechg_comm_reg: '', // Associated comm reg
    custrecord_servicechg_type: '', // Service Change Type
    custrecord_default_servicechg_record: '1', // Default Service Change Record: Yes (1), No (2), Sometimes (3), Undecided (4)
    custrecord_servicechg_created: '', // Created By...

    custrecord_servicechg_date_effective: '', // Date - Effective
    custrecord_servicechg_date_ceased: '', // Date - Ceased
    custrecord_trial_end_date: '', //Trial End Date

    custrecord_servicechg_old_price: 0, // Old Price
    custrecord_servicechg_old_freq: '', // Old Frequency
    custrecord_servicechg_old_zee: '', // Old Franchisee
    custrecord_servicechg_new_price: '', // New Price
    custrecord_servicechg_new_freq: '', // New Frequency
    custrecord_servicechg_new_zee: '', // New Franchisee

    custrecord_servicechg_cancellation_date: '', // Service Cancellation Date
    custrecord_servicechg_cancellation_not: '', // Service Cancellation Notice
    custrecord_servicechg_cancellation_reas: '', // Service Cancellation Reason
    custrecord_servicechg_cancellation_comp: '', // Service Cancellation Competitor
}

export const userNote = {
    //entity: null, // Customer ID that this belongs to (for use with record.load() Or record.create())
    company: null, // Customer ID that this belongs to (for use in saved searches)
    notedate: new Date(), // Date Create
    author: null, // Author of this note
    direction: '1', // Incoming (1)
    notetype: '7', // Note (7)
    note: '',
    title: '',
}