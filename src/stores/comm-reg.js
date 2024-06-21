import {defineStore} from 'pinia';
import {commRegDefaults} from '@/utils/utils.mjs';
import http from '@/utils/http.mjs';
import {useSalesRecordStore} from '@/stores/sales-record';
import {useCustomerStore} from '@/stores/customer';

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
    async createNewCommReg(saleTypeId, commRegStatus, commencementDate, trialEndDate) {
        if (this.id) return;
        this.loading = true;

        this.id = await http.post('createCommencementRegister', {
            customerId: useCustomerStore().id,
            salesRecordId: useSalesRecordStore().id,
            saleTypeId,
            commRegStatus,
            commencementDate,
            trialEndDate
        });

        await _getCommencementRegister(this);
        this.loading = false;
    }
};

async function _getCommencementRegister(ctx) {
    let fieldIds = [];
    for (let fieldId in ctx.details) fieldIds.push(fieldId);

    let data = !!ctx.id ?
        await http.get('getCommencementRegister', { commRegId: ctx.id, fieldIds }) :
        await http.get('getCommRegFromSalesRecordId', { salesRecordId: useSalesRecordStore().id, fieldIds });

    if (!data['id']) return ctx.loading = false;
    if (!ctx.id) ctx.id = data['id'];

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
