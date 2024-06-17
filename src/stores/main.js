import { defineStore } from 'pinia';
import http from "@/utils/http.mjs";
import { useGlobalDialog } from "@/stores/global-dialog";
import { VARS, getWindowContext } from "@/utils/utils.mjs";

const baseUrl = 'https://' + import.meta.env.VITE_NS_REALM + '.app.netsuite.com';
getWindowContext().document.title = `${VARS.pageTitle} - NetSuite Australia (Mail Plus Pty Ltd)`

const state = {
    callCenterMode: false,
    pageTitle: VARS.pageTitle
};

const getters = {

};

const actions = {
    async init() {

        await _readUrlParams(this);
    },
};

async function _readUrlParams(ctx) {
    console.log('_readUrlParams', ctx);
}

export const useMainStore = defineStore('main', {
    state: () => state,
    getters,
    actions,
});
