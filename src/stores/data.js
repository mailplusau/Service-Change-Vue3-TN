import { defineStore } from 'pinia';
import http from '@/utils/http.mjs';

const state = {
    serviceChangeTypes: [],
    serviceTypes: [],
};

const getters = {

};

const actions = {
    async init() {
        await Promise.allSettled([
            this.getServiceChangeTypes(),
            this.getServiceTypes(),
        ])
    },
    async getServiceChangeTypes() {
        await _fetchDataForHtmlSelect(this.serviceChangeTypes,
            null, 'customlist_sale_type', 'internalId', 'name');
    },
    async getServiceTypes() {
        let data = await http.get('getServiceTypes');

        this.serviceTypes = [...data];
    }
};

async function _fetchDataForHtmlSelect(stateObject, id, type, valueColumnName, textColumnName) {
    stateObject.splice(0);

    let data = await http.get('getSelectOptions', {
        id, type, valueColumnName, textColumnName
    });

    data.forEach(item => { stateObject.push(item); });
}

export const useDataStore = defineStore('data', {
    state: () => state,
    getters,
    actions,
});
