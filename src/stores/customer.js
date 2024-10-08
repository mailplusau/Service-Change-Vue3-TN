import { defineStore } from 'pinia';
import http from '@/utils/http.mjs';
import { customer as customerFields } from '@/utils/defaults.mjs';

const state = {
    id: null,
    details: {...customerFields.basic},
    texts: {},
    loading: false,
};

const getters = {
    status : state => parseInt(state.details.entitystatus),
    isSigned : state => parseInt(state.details.entitystatus) === 13,
};

const actions = {
    async init() {
        if (!this.id) return;
        this.loading = true;

        let fieldIds = [];
        for (let fieldId in this.details) fieldIds.push(fieldId);

        let data = await http.get('getCustomerDetails', {
            customerId: this.id,
            fieldIds,
        });

        for (let fieldId in this.details) {
            this.details[fieldId] = data[fieldId];
            this.texts[fieldId] = data[fieldId + '_text'];
        }

        this.loading = false;
    }
};

export const useCustomerStore = defineStore('customer', {
    state: () => state,
    getters,
    actions,
});
