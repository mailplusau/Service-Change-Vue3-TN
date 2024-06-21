import { defineStore } from 'pinia';
import http from '@/utils/http.mjs';
import {useCustomerStore} from '@/stores/customer';
import {useCommRegStore} from '@/stores/comm-reg';
import {COMM_REG_STATUS, SERVICE_CHANGE_STATUS, serviceChangeDefaults} from '@/utils/utils.mjs';
import {useUserStore} from '@/stores/user';
import {useMainStore} from '@/stores/main';
import {useDataStore} from '@/stores/data';
import {useGlobalDialog} from '@/stores/global-dialog';

const state = {
    data: {
        all: [],
        loading: false,
    },
    changes: {
        all: [],
        loading: false,
    },
    changeDialog: {
        defaults: {
            ...serviceChangeDefaults,

            isNewService: true,
            serviceType: null,
            serviceDescription: ''
        },
        form: {},
        open: false,
        loading: false,
    },
    serviceTypesInUse: [],
    globalEffectiveDate: new Date(),
    globalTrialEndDate: null,
};

state.changeDialog.form = {...state.changeDialog.defaults};

const getters = {

};

const actions = {
    async init() {
        if (!useCustomerStore().id) return;
        this.data.loading = true;

        await _fetchAllData(this);

        // Setting up some default values
        if (useCommRegStore().id) this.globalEffectiveDate = new Date(useCommRegStore().details.custrecord_comm_date)
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
        this.changeDialog.form = {
            ...this.changeDialog.defaults,
            custrecord_servicechg_date_effective: this.globalEffectiveDate,
            custrecord_trial_end_date: this.globalTrialEndDate || '',
        };

        if (serviceId) {
            serviceId = parseInt(serviceId);

            let service = _findServiceById(this, serviceId);
            let serviceChange = _findServiceChangeByServiceId(this, serviceId);

            if (service) {
                if (serviceChange) for (let key in this.changeDialog.defaults) this.changeDialog.form[key] = serviceChange[key];
                else {
                    let freqArray = ['mon', 'tue', 'wed', 'thu', 'fri', 'adhoc']
                        .map((item, index) => service['custrecord_service_day_' + item] ? (index + 1) : 0)
                        .filter(item => item);

                    this.changeDialog.form = {
                        ...this.changeDialog.form, ...{
                            custrecord_servicechg_service: service.internalid, // Associated service ID
                            custrecord_default_servicechg_record: '1', // Default Service Change Record: Yes (1), No (2), Sometimes (3), Undecided (4)
                            custrecord_servicechg_old_freq: freqArray.join(','),
                            custrecord_servicechg_new_freq: freqArray.join(','),
                        }
                    };
                }

                this.changeDialog.form['isNewService'] = !!service['isinactive'];
                this.changeDialog.form['serviceType'] = service['custrecord_service'];
                this.changeDialog.form['serviceDescription'] = service['custrecord_service_description'];
                this.changeDialog.form['custrecord_servicechg_date_effective'] = this.globalEffectiveDate;
            }
        }

        this.changeDialog.open = true;
    },
    async saveServiceChange() {
        useGlobalDialog().displayBusy('Processing', 'Saving Service Change...');

        let serviceChangeData = JSON.parse(JSON.stringify(this.changeDialog.form));
        let isQuote = useMainStore().extraParams.sendEmail && !useMainStore().extraParams.closedWon;

        if (!useCommRegStore().id) { // create a comm reg
            await useCommRegStore().createNewCommReg(
                useDataStore().serviceChangeTypes.filter(item => item.title === serviceChangeData['custrecord_servicechg_type'])[0].value,
                isQuote ? COMM_REG_STATUS.Quote : COMM_REG_STATUS.Scheduled,
                this.globalEffectiveDate, this.globalTrialEndDate);

            serviceChangeData['custrecord_servicechg_comm_reg'] = useCommRegStore().id;
        }

        serviceChangeData['custrecord_servicechg_status'] = isQuote ? SERVICE_CHANGE_STATUS.Quote : SERVICE_CHANGE_STATUS.Scheduled;

        // service change data has no associated service id or service is still inactive, we create/update the service
        let service = _findServiceById(this, serviceChangeData['custrecord_servicechg_service']);
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
        }

        await http.post('saveServiceChange', {serviceChangeData});

        await _fetchAllData(this);

        this.changeDialog.open = false;
        useGlobalDialog().close();
    }
};

async function _fetchAllData(ctx) {
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

export const useServiceStore = defineStore('services', {
    state: () => state,
    getters,
    actions,
});
