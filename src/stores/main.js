import { defineStore } from 'pinia';
import http from "@/utils/http.mjs";
import { useGlobalDialog } from "@/stores/global-dialog";
import { VARS, getWindowContext } from "@/utils/utils.mjs";
import {useUserStore} from '@/stores/user';
import {useCommRegStore} from '@/stores/comm-reg';
import {useCustomerStore} from '@/stores/customer';
import {useSalesRecordStore} from '@/stores/sales-record';
import {useServiceStore} from '@/stores/services';
import {useDataStore} from '@/stores/data';

getWindowContext().document.title = `${VARS.pageTitle} - NetSuite Australia (Mail Plus Pty Ltd)`

const state = {
    pageTitle: VARS.pageTitle,

    standaloneMode: false,
    isAdmin: false,
    extraParams: {
        scriptId: null,
        deployId: null,
        sendEmail: false,
        closedWon: false,
        freeTrial: false,
        suspects: false,
        oppWithValue: false,
        dateEffective: null,
    },
};

const getters = {

};

const actions = {
    async init() {
        await _readUrlParams(this);

        await Promise.allSettled([
            useUserStore().init(),
            useSalesRecordStore().init(),
            useCustomerStore().init(),
            useDataStore().init(),
        ]);

        await useCommRegStore().init();
        await useServiceStore().init();

        _updateFormTitleAndHeader(this);
    },
};

async function _readUrlParams(ctx) {
    let currentUrl = getWindowContext().location.href;
    let [, queryString] = currentUrl.split('?');

    const params = new Proxy(new URLSearchParams(`?${queryString}`), {
        get: (searchParams, prop) => searchParams.get(prop),
    });

    ctx.standaloneMode = !!params['standalone'];

    let weirdParams = params['custparam_params'] ? JSON.parse(params['custparam_params']) : {};
    let salesRep = params['salesrep'] || weirdParams['salesrep'] === 'T';

    let paramCustomerId = (!params['salesrep'] ? weirdParams['custid'] : params['custid']) || null;
    let paramSalesRecordId = (!params['salesrep'] ? weirdParams['salesrecordid'] : params['salesrecordid']) || null;
    let paramCommRegId = (!params['salesrep'] ? weirdParams['commreg'] : params['commreg']) || null;

    try {
        if (!paramCustomerId) {
            console.log('Missing parameters')
            useGlobalDialog().displayError('Missing parameters', 'Please check that the url contains all necessary parameters.')
            return;
        }

        let {customerId, salesRecordId, commRegId} = await http.post('verifyParameters', {
            customerId: paramCustomerId, salesRecordId: paramSalesRecordId, commRegId: paramCommRegId
        });

        useCommRegStore().id = commRegId;
        useCustomerStore().id = customerId;
        useSalesRecordStore().id = salesRecordId;
        ctx.isAdmin = !!salesRep;

        ctx.extraParams.scriptId = (!params['salesrep'] ? weirdParams['customid'] : params['customid']) || null;
        ctx.extraParams.deployId = (!params['salesrep'] ? weirdParams['customdeploy'] : params['customdeploy']) || null;
        ctx.extraParams.suspects = (!params['salesrep'] ? weirdParams['suspects'] === 'T' : params['suspects'] === 'T') || null;
        ctx.extraParams.sendEmail = (!params['sendemail'] ? weirdParams['sendemail'] === 'T' : params['sendemail'] === 'T') || false;
        ctx.extraParams.closedWon = (!params['salesrep'] ? weirdParams['closedwon'] === 'T' : params['closedwon'] === 'T') || false;
        ctx.extraParams.oppWithValue = (!params['salesrep'] ? weirdParams['oppwithvalue'] === 'T' : params['oppwithvalue'] === 'T') || false;
        ctx.extraParams.freeTrial = (!params['salesrep'] ? weirdParams['free_trial'] === 'T' : params['free_trial'] === 'T') || false;
        ctx.extraParams.dateEffective = weirdParams['date'] || null;
    } catch (e) { console.error(e); }
}

function _updateFormTitleAndHeader(ctx) {
    let title, header;
    const customerStore = useCustomerStore();

    header = 'Add / Edit Service : ';

    header += '<a target="_blank" href="/app/common/entity/custjob.nl?id=' + customerStore.id + '">' + customerStore.details.entityid + '</a> ';

    header += customerStore.details.companyname;

    title = 'Add / Edit Service : ' + customerStore.details.entityid + ' ' + customerStore.details.companyname + ' - NetSuite Australia (Mail Plus Pty Ltd)';

    ctx.pageTitle = header;

    if (getWindowContext().setMPTheme) getWindowContext().setMPTheme(title);
}

export const useMainStore = defineStore('main', {
    state: () => state,
    getters,
    actions,
});
