import {defineStore} from 'pinia';
import {isoTestString, offsetDateObjectForNSDateField, readFileAsBase64} from '@/utils/utils.mjs';
import {COMM_REG_STATUS} from '@/utils/defaults.mjs';
import http from '@/utils/http.mjs';
import {useSalesRecordStore} from '@/stores/sales-record';
import {useCustomerStore} from '@/stores/customer';
import {useGlobalDialog} from '@/stores/global-dialog';
import {commReg as commRegFields} from '@/utils/defaults.mjs';
import {useFranchiseeStore} from '@/stores/franchisee';
import {useUserStore} from '@/stores/user';
import {useServiceStore} from '@/stores/services';

const dateFields = ['custrecord_comm_date', 'custrecord_date_entry', 'custrecord_comm_date_signup', 'custrecord_finalised_on', 'custrecord_proposed_effective_date'];

const state = {
    id: null,
    details: {...commRegFields},
    texts: {...commRegFields},
    loading: false,

    form: {
        data: {...commRegFields},
        busy: false,
        disabled: false,
        attachedFile: null,
        attachedFilePreview: null,
    },
};

const getters = {

};

const actions = {
    async init() {
        this.loading = true;

        await _getCommencementRegister(this);
        this.resetForm();

        this.loading = false;
    },
    async createNewCommReg(saleTypeId, commRegStatus, commencementDate, trialEndDate, billingStartDate) {
        if (this.id || !useCustomerStore().id || !useSalesRecordStore().id) return;
        this.loading = true;

        let commRegData = {...this.form.data};
        commRegData['custrecord_sale_type'] = saleTypeId;
        commRegData['custrecord_comm_date'] = commencementDate;
        commRegData['custrecord_trial_status'] = commRegStatus;
        commRegData['custrecord_trial_expiry'] = trialEndDate;
        commRegData['custrecord_bill_date'] = billingStartDate;

        for (let fieldId of dateFields)
            commRegData[fieldId] = offsetDateObjectForNSDateField(commRegData[fieldId]) || commRegData[fieldId];

        const {commRegId} = await http.post('saveOrCreateCommencementRegister', {commRegData});

        this.id = commRegId;
        await _getCommencementRegister(this);
        this.resetForm();
        this.loading = false;
    },
    async saveCommReg() {
        let commRegData = {};
        const dateStr = (new Date()).toISOString().split('T')[0];
        const seed = (new Date()).getTime();
        const entityId = useCustomerStore().details.entityid;

        for (let fieldId of Object.keys(commRegFields))
            commRegData[fieldId] = dateFields.includes(fieldId) ? offsetDateObjectForNSDateField(this.form.data[fieldId]) : this.form.data[fieldId];

        const fileContent = this.form.attachedFile ? await readFileAsBase64(this.form.attachedFile) : null;

        const {commRegId} = await http.post('saveOrCreateCommencementRegister', {
            commRegId: this.id, commRegData, fileContent, fileName: `scf_${dateStr}_${entityId}_${seed}.pdf`
        });

        this.id = commRegId;

        await _getCommencementRegister(this);
        this.resetForm();
    },
    async generatePreviewUrl() {
        this.form.attachedFilePreview = null;

        if (this.form.attachedFile)
            this.form.attachedFilePreview = URL.createObjectURL(this.form.attachedFile)
        else if (this.details.custrecord_scand_form) {
            try {
                let {fileURL} = await http.get('getFileURLById', {
                    fileId: this.details.custrecord_scand_form
                });
                this.form.attachedFilePreview = fileURL;
            } catch (e) { console.error(e); }
        }
    },
    resetForm() {
        this.form.data = {...this.details};
        _prepareFormData(this);
    },
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
        ctx.details[fieldId] = isoTestString.test(data[fieldId]) ? new Date(data[fieldId]) : data[fieldId];
        ctx.texts[fieldId] = data[fieldId + '_text'];
    }
}

function _prepareFormData(ctx) {
    ctx.form.data['custrecord_customer'] = useCustomerStore().id;
    ctx.form.data['custrecord_commreg_sales_record'] = useSalesRecordStore().id;
    ctx.form.data['custrecord_salesrep'] = ctx.form.data['custrecord_salesrep'] || useSalesRecordStore().details.custrecord_sales_assigned || useUserStore().id;

    ctx.form.data['custrecord_state'] = ctx.form.data['custrecord_state'] || useFranchiseeStore().details.location;
    ctx.form.data['custrecord_franchisee'] = ctx.form.data['custrecord_franchisee'] || useFranchiseeStore().id;
    ctx.form.data['custrecord_date_entry'] = ctx.form.data['custrecord_date_entry'] || new Date();
    ctx.form.data['custrecord_comm_date_signup'] = ctx.form.data['custrecord_comm_date_signup'] || new Date();

    ctx.form.data['custrecord_comm_date'] = ctx.form.data['custrecord_comm_date'] || useServiceStore().globalEffectiveDate;
    ctx.form.data['custrecord_trial_expiry'] = ctx.form.data['custrecord_trial_expiry'] || useServiceStore().globalTrialEndDate;
}

export const useCommRegStore = defineStore('comm-reg', {
    state: () => state,
    getters,
    actions,
});
