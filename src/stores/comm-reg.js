import {defineStore} from 'pinia';
import {commRegDefaults, offsetDateObjectForNSDateField} from '@/utils/utils.mjs';
import http from '@/utils/http.mjs';
import {useSalesRecordStore} from '@/stores/sales-record';
import {useCustomerStore} from '@/stores/customer';
import {useGlobalDialog} from '@/stores/global-dialog';

const state = {
    id: null,
    details: {...commRegDefaults},
    texts: {},
    loading: false,
};

const getters = {

};

const actions = {
    async init() {
        this.loading = true;

        await _getCommencementRegister(this);

        this.loading = false;
    },
    async createNewCommReg(saleTypeId, commRegStatus, commencementDate, trialEndDate, billingStartDate) {
        if (this.id || !useCustomerStore().id || !useSalesRecordStore().id) return;
        this.loading = true;

        this.id = await http.post('createCommencementRegister', {
            customerId: useCustomerStore().id,
            salesRecordId: useSalesRecordStore().id,
            saleTypeId,
            commRegStatus,
            commencementDate,
            trialEndDate,
            billingStartDate,
            signupDate: offsetDateObjectForNSDateField(new Date()),
        });

        await _getCommencementRegister(this);
        this.loading = false;
    }
};

async function _getCommencementRegister(ctx) {
    if (!useCustomerStore().id || !useSalesRecordStore().id) return;

    let fieldIds = [];
    for (let fieldId in ctx.details) fieldIds.push(fieldId);
    fieldIds = fieldIds.map(fieldId => (fieldId === 'internalid' && !!ctx.id) ? 'id' : fieldId)

    if (!ctx.id) {
        const commRegs = await http.get('getCommRegsByCustomerId', { customerId: useCustomerStore().id });

        if (commRegs.length > 1) {
            useGlobalDialog().displayError('Error', 'There are more than one Commencement Register with the status of either Waiting T&C, In Trial or Scheduled', 500, true);
            return;
        } else if (commRegs.length === 1) ctx.id = commRegs[0]['internalid'];
    }

    if (!ctx.id) return ctx.loading = false;

    let data = await http.get('getCommencementRegister', { commRegId: ctx.id, fieldIds });

    for (let fieldId in ctx.details) {
        ctx.details[fieldId] = data[fieldId];
        ctx.texts[fieldId] = data[fieldId + '_text'];
    }
}

export const useCommRegStore = defineStore('comm-reg', {
    state: () => state,
    getters,
    actions,
});
