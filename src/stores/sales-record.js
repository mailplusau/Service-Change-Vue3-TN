import { defineStore } from 'pinia';
import http from '@/utils/http.mjs';
import {useGlobalDialog} from '@/stores/global-dialog';
import {useCustomerStore} from '@/stores/customer';
import {salesRecord as salesRecordFields} from '@/utils/defaults.mjs';

const state = {
    id: null,
    details: {...salesRecordFields},
    texts: {},
};

const getters = {

};

const actions = {
    async init() {
        if (!this.id) return;

        let tentativeSalesRecordId = this.id;
        this.id = null;
        let data = await http.get('getSalesRecord', {salesRecordId: tentativeSalesRecordId});

        if (data['custrecord_sales_completed'])
            return useGlobalDialog().displayError('Error',
                `Sales Record #${tentativeSalesRecordId} is already marked as Completed.`, 400, true);

        if (parseInt(data['custrecord_sales_customer']) !== parseInt(useCustomerStore().id))
            return useGlobalDialog().displayError('Error',
                `Sales Record #${tentativeSalesRecordId} does not belong to Customer #${useCustomerStore().id}.`, 450, true);

        this.id = tentativeSalesRecordId;

        for (let fieldId in salesRecordFields) {
            this.details[fieldId] = data[fieldId];
            this.texts[fieldId] = data[fieldId + '_text'];
        }
    }
};

export const useSalesRecordStore = defineStore('sales-record', {
    state: () => state,
    getters,
    actions,
});
