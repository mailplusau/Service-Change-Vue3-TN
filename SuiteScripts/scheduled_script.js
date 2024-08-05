/**
 * @author Tim Nguyen
 * @description NetSuite Experimentation - Scheduled Service Change.
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @created 04/07/2024
 */

import {commRegDefaults, serviceChangeDefaults, serviceFieldIds, COMM_REG_STATUS, SERVICE_CHANGE_STATUS} from '@/utils/utils.mjs';

let NS_MODULES = {};

const moduleNames = ['render', 'file', 'runtime', 'search', 'record', 'url', 'format', 'email', 'task', 'log'];

// eslint-disable-next-line no-undef
define(moduleNames.map(item => 'N/' + item), (...args) => {
    for (let [index, moduleName] of moduleNames.entries()) NS_MODULES[moduleName] = args[index];

    function execute(context) {
        try {
            _processScheduledCommRegs(context);
            _processInTrialCommRegs(context);
        } catch (e) {
            const currentScript = NS_MODULES.runtime['getCurrentScript']();
            NS_MODULES.log.debug({title: "_handleGETRequests", details: `error: ${e}`});
            NS_MODULES.email['sendBulk'].promise({
                author: 112209,
                body: `Stacktrace: ${e}`,
                subject: `[SCRIPT=${currentScript.id}][DEPLOY=${currentScript.deploymentId}]`,
                recipients: ['tim.nguyen@mailplus.com.au'],
                isInternalOnly: true
            });
        }
    }

    return { execute };
});

function _processInTrialCommRegs() {
    utils.getCommRegsByFilters([ // get all In Trial comm regs with billing date being tomorrow
        ['custrecord_trial_status', 'is', COMM_REG_STATUS.In_Trial], // Scheduled (9)
        'AND',
        ['custrecord_bill_date', 'on', 'tomorrow'],
        'AND',
        ['custrecord_franchisee', 'is', 779884] // TODO: test with franchisee TEST - NSW
    ]).forEach(inTrialCommReg => {

        // Make the current In-Trial comm reg Signed (2)
        NS_MODULES.record['submitFields']({
            type: 'customrecord_commencement_register', id: inTrialCommReg['internalid'],
            values: { custrecord_trial_status: COMM_REG_STATUS.Signed, }
        });

        // Find all service changes of In-Trial Comm Regs and apply the correct price
        utils.getServiceChangesByFilters([ // get active service changes
            ['custrecord_servicechg_status', 'is', SERVICE_CHANGE_STATUS.Active], // Active (2)
            'AND',
            ['custrecord_servicechg_comm_reg', 'is', inTrialCommReg['internalid']]
        ]).forEach(scheduledServiceChange => {

            // Update the associated service (set the price to 0 if this is a free trial)
            NS_MODULES.record['submitFields']({
                type: 'customrecord_service', id: scheduledServiceChange['custrecord_servicechg_service'],
                values: {
                    custrecord_service_price: scheduledServiceChange['custrecord_servicechg_new_price'],
                }
            });
        });

        _updateFinancialItemsOfCustomer(inTrialCommReg['custrecord_customer']);
    });
}

function _processScheduledCommRegs() {
    utils.getCommRegsByFilters([ // get all scheduled comm regs with effective date being tomorrow
        ['custrecord_trial_status', 'is', COMM_REG_STATUS.Scheduled], // Scheduled (9)
        'AND',
        ['custrecord_comm_date', 'on', 'tomorrow'],
        'AND',
        ['custrecord_franchisee', 'is', 779884] // TODO: test with franchisee TEST - NSW
    ]).forEach(scheduledCommReg => { // for each scheduled comm regs

        let isFreeTrial = !!scheduledCommReg['custrecord_trial_expiry'];

        // Find all Signed comm reg of the customer that the scheduled comm reg is associated to apply Changed (7) status to them
        utils.getCommRegsByFilters([ // get signed comm regs from the associated customer
            ['custrecord_trial_status', 'is', COMM_REG_STATUS.Signed],
            'AND',
            ['custrecord_customer', 'is', scheduledCommReg['custrecord_customer']]
        ]).forEach(signedCommReg => {

            // Make the current Active comm reg Changed (7)
            NS_MODULES.record['submitFields']({
                type: 'customrecord_commencement_register', id: signedCommReg['internalid'],
                values: { custrecord_trial_status: COMM_REG_STATUS.Changed, }
            });
        });

        // Make the current Scheduled comm reg In Trial (1) or Signed (2)
        NS_MODULES.record['submitFields']({
            type: 'customrecord_commencement_register', id: scheduledCommReg['internalid'],
            values: { custrecord_trial_status: isFreeTrial ? COMM_REG_STATUS.In_Trial : COMM_REG_STATUS.Signed, }
        });

        // Find all service changes of Scheduled Comm Regs and execute them
        utils.getServiceChangesByFilters([ // get scheduled service changes
            ['custrecord_servicechg_status', 'is', SERVICE_CHANGE_STATUS.Scheduled], // Scheduled (1)
            'AND',
            ['custrecord_servicechg_comm_reg', 'is', scheduledCommReg['internalid']]
        ]).forEach(scheduledServiceChange => {

            // Make all previously active service changes of affected service Ceased (3)
            utils.getServiceChangesByFilters([ // get scheduled service changes
                ['custrecord_servicechg_status', 'is', SERVICE_CHANGE_STATUS.Active], // Active (2)
                'AND',
                ['custrecord_servicechg_service', 'is', scheduledServiceChange['custrecord_servicechg_service']]
            ]).forEach(activeServiceChange => {
                NS_MODULES.record['submitFields']({
                    type: 'customrecord_servicechg', id: activeServiceChange['internalid'],
                    values: { custrecord_servicechg_status: SERVICE_CHANGE_STATUS.Ceased, /* Ceased (3) */ }
                });
            });

            // Apply service change to the associated service
            utils.applyServiceChange(scheduledServiceChange, isFreeTrial)
        });

        _updateFinancialItemsOfCustomer(scheduledCommReg['custrecord_customer']);
    })
}

function _updateFinancialItemsOfCustomer(customerId) {
    const sublistId = 'itemPricing'.toLowerCase();
    const customerRecord = NS_MODULES.record.load({type: 'customer', id: customerId, isDynamic: true});

    // Wipe financial tab (going backward because line numbers are just array indexes)
    const lineCount = customerRecord['getLineCount']({sublistId});
    for (let line = lineCount - 1; line >= 0; line--) customerRecord['removeLine']({sublistId, line});

    // Re-populate financial tab using only active services
    utils.getServicesByFilters([
        ['isinactive', 'is', false],
        'AND',
        ['custrecord_service_category', 'is', 1], // We take records under the Category: Services (1) only
        'AND',
        ['custrecord_service_customer', 'is', customerId]
    ]).forEach(service => {
        customerRecord['selectNewLine']({sublistId});
        customerRecord['setCurrentSublistValue']({sublistId, fieldId: 'item', value: service['custrecord_service_ns_item']});
        customerRecord['setCurrentSublistValue']({sublistId, fieldId: 'level', value: -1});
        customerRecord['setCurrentSublistValue']({sublistId, fieldId: 'price', value: service['custrecord_service_price']});

        customerRecord['commitLine']({sublistId});
    })

    // Save customer record
    customerRecord.save({ignoreMandatoryFields: true});
}

const utils = {
    getServiceChangesByFilters(filters) {
        let data = [];

        NS_MODULES.search.create({
            type: "customrecord_servicechg",
            filters,
            columns: Object.keys(serviceChangeDefaults)
        }).run().each(result => this.processSavedSearchResults(data, result));

        return data;
    },
    getServicesByFilters(filters) {
        let data = [];

        NS_MODULES.search.create({
            type: "customrecord_service",
            filters,
            columns: serviceFieldIds
        }).run().each(result => this.processSavedSearchResults(data, result));

        return data;
    },
    getCommRegsByFilters(filters) {
        let data = [];

        NS_MODULES.search.create({
            type: "customrecord_commencement_register",
            filters,
            columns: Object.keys(commRegDefaults)
        }).run().each(result => this.processSavedSearchResults(data, result));

        return data;
    },

    processSavedSearchResults(data, result) {
        let obj = {};

        for (let column of result['columns']) {
            obj[column.name] = result['getValue'](column);
            obj[column.name + '_text'] = result['getText'](column);
        }
        data.push(obj);

        return true;
    },
    applyServiceChange(scheduledServiceChange, isFreeTrial) {
        // Update the service change record itself
        NS_MODULES.record['submitFields']({
            type: 'customrecord_servicechg', id: scheduledServiceChange['internalid'],
            values: {
                custrecord_servicechg_status: !!scheduledServiceChange['custrecord_servicechg_date_ceased'] ? SERVICE_CHANGE_STATUS.Ceased : SERVICE_CHANGE_STATUS.Active, // Ceased (3) or Active (2)
                custrecord_servicechg_cancellation_date: scheduledServiceChange['custrecord_servicechg_date_ceased'] || scheduledServiceChange['custrecord_servicechg_cancellation_date']
            }
        });

        let frequencyFields = {};
        ['mon', 'tue', 'wed', 'thu', 'fri', 'adhoc'].forEach((item, index) => {
            frequencyFields['custrecord_service_day_' + item] = scheduledServiceChange.custrecord_servicechg_new_freq.split(',').includes(`${index + 1}`);
        });

        // Update the associated service (set the price to 0 if this is a free trial)
        NS_MODULES.record['submitFields']({
            type: 'customrecord_service', id: scheduledServiceChange['custrecord_servicechg_service'],
            values: {
                isinactive: !!scheduledServiceChange['custrecord_servicechg_date_ceased'],
                custrecord_service_price: isFreeTrial ? 0 : scheduledServiceChange['custrecord_servicechg_new_price'],
                ...frequencyFields,
            }
        });
    }
}

// let scheduledServiceChanges = utils.getServiceChangesByFilters([
//     ["custrecord_servicechg_status","anyof","1"], // Scheduled (1)
//     "AND",
//     [["custrecord_servicechg_date_effective","on","tomorrow"],"OR",["custrecord_servicechg_date_effective","onorbefore","today"]],
//     "AND",
//     ["custrecord_servicechg_service.custrecord_service_franchisee","noneof","6","780481","425904","519165","779884","626844","640430","640431","640434","626428","626845","656644","656643"],
//     "AND",
//     ["custrecord_servicechg_service.custrecord_service_customer","noneof","@NONE@"]
// ]);
