import { defineStore } from 'pinia';
import http from '@/utils/http.mjs';
import {useCustomerStore} from '@/stores/customer';
import {useCommRegStore} from '@/stores/comm-reg';
import {COMM_REG_STATUS, offsetDateObjectForNSDateField, SERVICE_CHANGE_STATUS, serviceChangeDefaults} from '@/utils/utils.mjs';
import {useUserStore} from '@/stores/user';
import {useMainStore} from '@/stores/main';
import {useDataStore} from '@/stores/data';
import {useGlobalDialog} from '@/stores/global-dialog';
import {serviceChanges, services} from '@/utils/testData';

const state = {
    data: {
        all: [],
        loading: true,
    },
    changes: {
        all: [],
        loading: false,
    },
    changeDialog: {
        defaults: {
            ...serviceChangeDefaults,

            serviceType: null,
            serviceDescription: ''
        },
        form: {},
        open: false,
        loading: false,
    },
    serviceTypesInUse: [],
    globalEffectiveDate: new Date(new Date().setDate(new Date().getDate() + 1)),
    globalTrialEndDate: null,

    serviceIdToCease: null,
};

state.changeDialog.form = {...state.changeDialog.defaults};
// state.data.all = [...services]
// state.changes.all = [...serviceChanges]

const getters = {
    serviceMarkedForCancellation : state => serviceId => {
        let serviceChange = _findServiceChangeByServiceId(state, serviceId);

        return !!serviceChange && serviceChange?.custrecord_servicechg_date_ceased
    }
};

const actions = {
    async init() {
        if (!useCustomerStore().id) return this.data.loading = false;

        await _fetchAllData(this);

        if (useCommRegStore().id) {
            this.globalEffectiveDate = _parseIsoDatetime(useCommRegStore().details.custrecord_comm_date, true);
            this.globalTrialEndDate = useCommRegStore().details.custrecord_trial_expiry ?
                _parseIsoDatetime(useCommRegStore().details.custrecord_trial_expiry, true) : null;
        } else if (useMainStore().extraParams.freeTrial)
            this.globalTrialEndDate = new Date((new Date(this.globalEffectiveDate.toISOString())).setDate(this.globalEffectiveDate.getDate() + 8));

        // Setting up some default values
        this.changeDialog.defaults.custrecord_servicechg_old_price = 0;
        this.changeDialog.defaults.custrecord_servicechg_old_zee = useCustomerStore().details.partner;
        this.changeDialog.defaults.custrecord_servicechg_comm_reg = useCommRegStore().id;
        this.changeDialog.defaults.custrecord_servicechg_type = useCommRegStore().texts['custrecord_sale_type'] || '';
        this.changeDialog.defaults.custrecord_servicechg_date_effective = this.globalEffectiveDate;
        this.changeDialog.defaults.custrecord_servicechg_created = useUserStore().id;
        this.changeDialog.defaults.custrecord_trial_end_date = this.globalTrialEndDate || '';
        this.changeDialog.defaults.custrecord_default_servicechg_record = '1'; // always make this the default service change cuz there will only be 1

        this.data.loading = false;
    },
    openServiceChangeDialog(serviceId = null) {
        _prepareServiceChangeForm(this, serviceId);

        this.changeDialog.open = true;
    },
    async handleEffectiveDateChanged() {
        useGlobalDialog().displayBusy('Processing', 'Applying new effective date. Please wait...');

        await http.post('updateEffectiveDate', {commRegId: useCommRegStore().id, dateEffective: offsetDateObjectForNSDateField(this.globalEffectiveDate)});
        useCommRegStore().details.custrecord_comm_date = this.globalEffectiveDate.toISOString();
        useCommRegStore().texts.custrecord_comm_date = this.globalEffectiveDate.toLocaleDateString();
        for (let serviceChange of this.changes.all) serviceChange['custrecord_servicechg_date_effective'] = this.globalEffectiveDate.toLocaleDateString();

        useGlobalDialog().close();
    },
    async handleTrialEndDateChanged() {
        useGlobalDialog().displayBusy('Processing', 'Applying new trial expiry date. Please wait...');

        await http.post('updateTrialEndDate', {commRegId: useCommRegStore().id, trialEndDate: offsetDateObjectForNSDateField(this.globalTrialEndDate)});
        useCommRegStore().details.custrecord_trial_expiry = this.globalTrialEndDate.toISOString();
        useCommRegStore().texts.custrecord_trial_expiry = this.globalTrialEndDate.toLocaleDateString();
        for (let serviceChange of this.changes.all) serviceChange['custrecord_trial_end_date'] = this.globalEffectiveDate.toLocaleDateString();

        useGlobalDialog().close();
    },
    async saveServiceChange() {
        useGlobalDialog().displayBusy('Processing', 'Saving Service Change...');

        await _saveServiceChange(this);

        await _fetchAllData(this);

        this.changeDialog.open = false;
        
        useGlobalDialog().close();
    },
    async cancelService() {
        let serviceId = parseInt(this.serviceIdToCease);
        let service = _findServiceById(this, serviceId);

        if (!service) return;

        useGlobalDialog().displayBusy('Processing', service.isinactive ? `Cancelling the creation of Service [${service.custrecord_service_text}]` : `Marking Service [${service.custrecord_service_text}] for Cancellation.`);
        
        if (service.isinactive) await http.post('cancelPendingService', {serviceId, commRegId: useCommRegStore().id})
        else {
            _prepareServiceChangeForm(this, serviceId);

            this.changeDialog.form['custrecord_servicechg_date_ceased'] = this.globalEffectiveDate;

            await _saveServiceChange(this);
        }

        await _fetchAllData(this);

        useGlobalDialog().close();

        this.serviceIdToCease = null;
    },
    async cancelChangesOfService(serviceId) {
        let service = _findServiceById(this, serviceId);

        if (!service) return;

        useGlobalDialog().displayBusy('Processing', `Removing all pending changes of Service [${service.custrecord_service_text}]. Please wait...`);

        await http.post('cancelChangesOfService', {serviceId, commRegId: useCommRegStore().id});

        await _fetchAllData(this);

        useGlobalDialog().close();
    }
};

async function _fetchAllData(ctx) {
    if (!useCustomerStore().id) return;

    let {services, serviceChanges} = await http.get('getServicesAndServiceChanges', {
        customerId: useCustomerStore().id, commRegId: useCommRegStore().id
    });

    ctx.data.all = [...services];
    ctx.changes.all = [...serviceChanges];
    ctx.serviceTypesInUse = [...services.map(service => service.custrecord_service)]
}

function _findServiceById(ctx, serviceId) {
    let index = ctx.data.all.findIndex(item => parseInt(item.internalid) === parseInt(serviceId));

    return index >= 0 ? ctx.data.all[index] : null;
}

function _findServiceChangeByServiceId(ctx, serviceId) {
    let index = ctx.changes.all.findIndex(item => parseInt(item.custrecord_servicechg_service) === parseInt(serviceId));

    return index >= 0 ? ctx.changes.all[index] : null;
}

function _parseIsoDatetime(dateString, dateOnly = false) {
    console.log('dateString', dateString);
    let tmp = dateString.split(/[: T-]/).map(parseFloat);
    return dateOnly ?
        new Date(tmp[0], tmp[1] - 1, tmp[2], (new Date().getTimezoneOffset()/-60) + 1, 0, 0, 0) :
        new Date(tmp[0], tmp[1] - 1, tmp[2], tmp[3] || 0, tmp[4] || 0, tmp[5] || 0, 0);
}

async function _saveServiceChange(ctx) {
    let serviceChangeData = JSON.parse(JSON.stringify(ctx.changeDialog.form));
    let isQuote = useMainStore().extraParams.sendEmail && !useMainStore().extraParams.closedWon;

    if (!useCommRegStore().id) { // create a comm reg
        await useCommRegStore().createNewCommReg(
            useDataStore().serviceChangeTypes.filter(item => item.title === serviceChangeData['custrecord_servicechg_type'])[0].value,
            isQuote ? COMM_REG_STATUS.Quote : COMM_REG_STATUS.Scheduled,
            offsetDateObjectForNSDateField(ctx.globalEffectiveDate), offsetDateObjectForNSDateField(ctx.globalTrialEndDate));

        serviceChangeData['custrecord_servicechg_comm_reg'] = useCommRegStore().id;
    }

    serviceChangeData['custrecord_servicechg_status'] = isQuote ? SERVICE_CHANGE_STATUS.Quote : SERVICE_CHANGE_STATUS.Scheduled;

    // service change data has no associated service id or service is still inactive, we create/update the service
    let service = _findServiceById(ctx, serviceChangeData['custrecord_servicechg_service']);
    if (!serviceChangeData['custrecord_servicechg_service'] || service?.isinactive) {
        let serviceData = {
            isinactive: true,
            custrecord_service: service?.custrecord_service || serviceChangeData['serviceType'],
            name: service?.name || useDataStore().serviceTypes.filter(item => item.value === serviceChangeData['serviceType'])[0].title,
            custrecord_service_customer: service?.custrecord_service_customer || useCustomerStore().id,
            custrecord_service_comm_reg: service?.custrecord_service_comm_reg || useCommRegStore().id,

            custrecord_service_price: serviceChangeData['custrecord_servicechg_new_price'],
            custrecord_service_description: serviceChangeData['serviceDescription'],
        };

        ['mon', 'tue', 'wed', 'thu', 'fri', 'adhoc'].forEach((item, index) => {
            serviceData['custrecord_service_day_' + item] = serviceChangeData.custrecord_servicechg_new_freq.split(',').includes((index + 1) + '');
        });

        serviceChangeData['custrecord_servicechg_service'] = await http.post('saveService', {
            serviceId: service?.internalid, serviceData
        });

        serviceChangeData['custrecord_servicechg_date_effective'] = offsetDateObjectForNSDateField(ctx.changeDialog.form['custrecord_servicechg_date_effective'])
        serviceChangeData['custrecord_servicechg_date_ceased'] = offsetDateObjectForNSDateField(ctx.changeDialog.form['custrecord_servicechg_date_ceased'])
        serviceChangeData['custrecord_trial_end_date'] = offsetDateObjectForNSDateField(ctx.changeDialog.form['custrecord_trial_end_date'])
    }

    await http.post('saveServiceChange', {serviceChangeData});

    await http.post('updateServiceRatesOfCustomer', {customerId: useCustomerStore().id, commRegId: useCommRegStore().id});
}

function _prepareServiceChangeForm(ctx, serviceId = null) {
    ctx.changeDialog.form = {
        ...ctx.changeDialog.defaults,
        custrecord_servicechg_type: 'Extra Service',
        custrecord_servicechg_date_effective: ctx.globalEffectiveDate,
        custrecord_trial_end_date: ctx.globalTrialEndDate || '',
    };

    if (serviceId) {
        serviceId = parseInt(serviceId);

        let service = _findServiceById(ctx, serviceId);
        let serviceChange = _findServiceChangeByServiceId(ctx, serviceId);

        if (service) {
            if (serviceChange) for (let key in ctx.changeDialog.defaults) ctx.changeDialog.form[key] = serviceChange[key];
            else {
                let freqArray = ['mon', 'tue', 'wed', 'thu', 'fri', 'adhoc']
                    .map((item, index) => service['custrecord_service_day_' + item] ? (index + 1) : 0)
                    .filter(item => item);

                ctx.changeDialog.form = {
                    ...ctx.changeDialog.form, ...{
                        custrecord_servicechg_type: '',
                        custrecord_servicechg_service: service.internalid, // Associated service ID
                        custrecord_default_servicechg_record: '', // existing service but no service change found, meaning it was created previously in the past, so this service change record is not a default one, we leave it empty
                        custrecord_servicechg_old_price: service.custrecord_service_price,
                        custrecord_servicechg_old_freq: freqArray.join(','),
                        custrecord_servicechg_new_freq: freqArray.join(','),
                    }
                };
            }

            ctx.changeDialog.form['serviceType'] = service['custrecord_service'];
            ctx.changeDialog.form['serviceDescription'] = service['custrecord_service_description'];
            ctx.changeDialog.form['custrecord_servicechg_date_effective'] = ctx.globalEffectiveDate;
        }
    }
}

export const useServiceStore = defineStore('services', {
    state: () => state,
    getters,
    actions,
});
