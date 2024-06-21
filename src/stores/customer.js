import { defineStore } from 'pinia';
import http from '@/utils/http.mjs';
import { customerDefaults } from '@/utils/utils.mjs';

const state = {
    id: null,
    details: {...customerDefaults},
    texts: {},
    loading: false,
};

const getters = {

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
