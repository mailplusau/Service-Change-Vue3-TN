import { defineStore } from 'pinia';
import {franchisee as franchiseeDetails} from '@/utils/defaults.mjs';
import {useCustomerStore} from '@/stores/customer';
import http from '@/utils/http.mjs';

const state = {
    id: null,
    details: { ...franchiseeDetails },
    texts: {},
};

const getters = {

};

const actions = {
    async init() {
        if (!useCustomerStore().id) return;

        let data = await http.get('getFranchiseeOfCustomer', {customerId: useCustomerStore().id});

        this.id = data['id'];
        for (let fieldId of Object.keys(franchiseeDetails)) {
            this.details[fieldId] = data[fieldId];
            this.texts[fieldId] = data[fieldId + '_text'];
        }
    },
};


export const useFranchiseeStore = defineStore('franchisee', {
    state: () => state,
    getters,
    actions,
});