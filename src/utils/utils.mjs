const AUDollar = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'AUD',
});

const dateFormat = new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'long',
    timeZone: 'Australia/Sydney',
});

export const VARS = {
    pageTitle: 'Service Change v3',
}

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

export const commRegDefaults = {
    internalid: null,
    custrecord_date_entry: '',
    custrecord_comm_date: '',
    custrecord_comm_date_signup: '',
    custrecord_sale_type: '',
    custrecord_in_out: '',
    custrecord_scand_form: '',
    custrecord_customer: null,
    custrecord_salesrep: null,
    custrecord_franchisee: null,
    custrecord_trial_status: '11',
    custrecord_commreg_sales_record: null,
    custrecord_wkly_svcs: '5',
    custrecord_state: '',
    custrecord_finalised_by: '',
    custrecord_finalised_on: '',
    custrecord_trial_expiry: '',
    custrecord_bill_date: '',
};

export const customerDefaults = {
    entityid: '',
    companyname: '',
    vatregnumber: '',
    partner: '',
    entitystatus: '',

    custentity_cust_monthly_service_value: 0,
    custentity_monthly_extra_service_revenue: 0,
    custentity_monthly_reduc_service_revenue: 0,
};

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

export const serviceChangeDefaults = {
    internalid: null,
    custrecord_servicechg_service: '', // Associated service
    custrecord_servicechg_status: '', // Status
    custrecord_servicechg_comm_reg: '', // Associated comm reg
    custrecord_servicechg_type: '', // Service Change Type
    custrecord_default_servicechg_record: '1', // Default Service Change Record: Yes (1), No (2), Sometimes (3), Undecided (4)
    custrecord_servicechg_created: '', // Created By...

    custrecord_servicechg_date_effective: '', // Date - Effective
    custrecord_servicechg_date_ceased: '', // Date - Ceased
    custrecord_trial_end_date: '', // Trial End Date
    custrecord_servicechg_bill_date: '', // Billing Date

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

export function getWindowContext() {
    if (window.location.href.includes('app.netsuite.com')) return window;
    else return top;
}

export const rules = {
    email(value, fieldName = 'This field') {
        return !value || /.+@.+\..+/.test(value) || `${fieldName} must be a valid email`;
    },
    required(value, fieldName = 'This field') {
        return !!value || `${fieldName} is required`;
    },
    minLength(value, fieldName = 'This field', length) {
        return (value && value.length >= length) || `${fieldName} must be more than ${length} characters`;
    },
    minValue(value, fieldName = 'This field', min) {
        return !value || parseFloat(value) >= parseFloat(min) || `${fieldName} must be greater than ${parseFloat(min)}`;
    },
    abn(value, fieldName = 'This field') {
        if (!value) return true;

        let weights = [10, 1, 3, 5, 7, 9, 11, 13, 15, 17, 19],
            checksum = value.split('').map(Number).reduce(
                function(total, digit, index) {
                    if (!index) {
                        digit--;
                    }
                    return total + (digit * weights[index]);
                },
                0
            );

        return value.length === 11 || !(!checksum || checksum % 89 !== 0) || `${fieldName} must be a valid ABN`;
    },
    ausPhone(value, fieldName = 'This field') {
        let australiaPhoneFormat = /^(\+\d{2}[ -]{0,1}){0,1}(((\({0,1}[ -]{0,1})0{0,1}\){0,1}[2|3|7|8]{1}\){0,1}[ -]*(\d{4}[ -]{0,1}\d{4}))|(1[ -]{0,1}(300|800|900|902)[ -]{0,1}((\d{6})|(\d{3}[ -]{0,1}\d{3})))|(13[ -]{0,1}([\d -]{5})|((\({0,1}[ -]{0,1})0{0,1}\){0,1}4{1}[\d -]{8,10})))$/;
        return !value || australiaPhoneFormat.test(value) || `${fieldName} must be a valid phone number`;
    },

    validate(v, validationString, fieldName = 'This field') {
        let validations = validationString.split('|');

        for (let validation of validations) {
            if (validation === 'validate') continue;

            let terms = validation.split(':');
            let rule = terms.shift();
            terms = terms.length ? terms[0].split(',') : [];
            let result = rules[rule] ? rules[rule](v, fieldName || 'Field', ...terms) : null;

            if (typeof result === 'string') return result;
        }

        return true
    }
}

export function allowOnlyNumericalInput(evt) {
    if ((evt.key === 'a' || evt.key === 'c') && evt.ctrlKey) // allow select all and copy
        return true;

    // if (!/^[-+]?[0-9]*?[0-9]*$/.test(expect)) // Allow only 1 leading + sign and numbers
    if (!/^[0-9]*$/.test(evt.key) && evt.key.length === 1) // Allow only numbers, assuming evt.key is a string
        evt.preventDefault();
    else return true;
}

export function offsetDateObjectForNSDateField(dateObject) {
    if (Object.prototype.toString.call(dateObject) !== '[object Date]') return dateObject;

    return dateObject.getFullYear() + '-' + `${dateObject.getMonth() + 1}`.padStart(2, '0') + '-' + `${dateObject.getDate()}`.padStart(2, '0') + 'T00:00:00.000';
}

export function getNextWorkingDate(dateObject) {
    if (Object.prototype.toString.call(dateObject) !== '[object Date]') return null;

    let nextWorkingDate = new Date(dateObject.toISOString());
    nextWorkingDate.setDate(nextWorkingDate.getDate() + (dateObject.getDay() < 5 ? 1 : 8 - dateObject.getDay()));

    return nextWorkingDate;
}

export function waitMilliseconds(millis = 1000) {
    return new Promise(resolve => {
        setTimeout(() => resolve(), millis)
    })
}

export function formatPrice(price) {
    return AUDollar.format(price);
}

export function formatDate(date) {
    return dateFormat.format(date)
}

export function debounce(fn, wait){
    let timer;
    return function(...args){
        if(timer) {
            clearTimeout(timer); // clear any pre-existing timer
        }
        const context = this; // get the current context
        timer = setTimeout(()=>{
            fn.apply(context, args); // call the function if time expires
        }, wait);
    }
}