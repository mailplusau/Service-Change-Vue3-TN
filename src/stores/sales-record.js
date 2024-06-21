import { defineStore } from 'pinia';

const state = {
    id: null,
};

const getters = {

};

const actions = {
    async init() {

    }
};

export const useSalesRecordStore = defineStore('sales-record', {
    state: () => state,
    getters,
    actions,
});
