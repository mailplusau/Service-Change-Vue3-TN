import {defineStore} from 'pinia';
import {offsetDateObjectForNSDateField} from '@/utils/utils.mjs';
import {COMM_REG_STATUS} from '@/utils/defaults.mjs';
import http from '@/utils/http.mjs';
import {useSalesRecordStore} from '@/stores/sales-record';
import {useCustomerStore} from '@/stores/customer';
import {useGlobalDialog} from '@/stores/global-dialog';
import {commReg as commRegFields} from '@/utils/defaults.mjs';
import {useFranchiseeStore} from '@/stores/franchisee';

const state = {
    id: null,
    details: {...commRegFields},
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

        let commRegData = {...this.details};
        commRegData['custrecord_customer'] = useCustomerStore().id;
        commRegData['custrecord_commreg_sales_record'] = useSalesRecordStore().id;
        commRegData['custrecord_salesrep'] = useSalesRecordStore().details.custrecord_sales_assigned;

        commRegData['custrecord_sale_type'] = saleTypeId;
        commRegData['custrecord_state'] = useFranchiseeStore().details.location;
        commRegData['custrecord_franchisee'] = useFranchiseeStore().id;
        commRegData['custrecord_comm_date'] = commencementDate;
        commRegData['custrecord_trial_status'] = commRegStatus;
        commRegData['custrecord_trial_expiry'] = trialEndDate;
        commRegData['custrecord_bill_date'] = billingStartDate;
        commRegData['custrecord_date_entry'] = offsetDateObjectForNSDateField(new Date());
        commRegData['custrecord_comm_date_signup'] = offsetDateObjectForNSDateField(new Date());

        this.id = await http.post('createCommencementRegister', {commRegData});

        await _getCommencementRegister(this);
        this.loading = false;
    }
};

async function _getCommencementRegister(ctx) {
    if (!useCustomerStore().id || !useSalesRecordStore().id) return;

    if (!ctx.id) { // query and verify that there's a workable Commencement Register associated with the Sales Record
        const commRegs = await http.get('getCommRegBySalesRecordId', { salesRecordId: useSalesRecordStore().id });

        if (commRegs.length > 1)
            return useGlobalDialog().displayError('Error',
                `There are more than one Commencement Registers associated with Sales Record #${useSalesRecordStore().id}.`, 400, true);

        if (commRegs.length === 1 && [COMM_REG_STATUS.Quote, COMM_REG_STATUS.Waiting_TNC, COMM_REG_STATUS.Scheduled].includes(parseInt(commRegs[0]['custrecord_trial_status'])))
            ctx.id = commRegs[0]['internalid'];
        else if (commRegs.length === 1)
            return useGlobalDialog().displayError('Error',
                `This Commencement Register is neither Quote, Scheduled nor Awaiting T&C Agreement.`, 400, true);
    }

    if (!ctx.id) return ctx.loading = false;

    let data = await http.get('getCommencementRegister', { commRegId: ctx.id, fieldIds: Object.keys(commRegFields) });

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
