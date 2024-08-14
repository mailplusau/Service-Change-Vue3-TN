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
            // approximate Australian/Sydney local time (not accounted for DST so DO NOT use within 2 hours before or after midnight of local time)
            const financialItemsReports = [];
            const judgementDay = 15;
            let today = new Date();
            today.setTime(today.getTime() + (18 + 24)*60*60*1000); // this should be tomorrow so 24 + <whatever the timezone offset is>
            let customersToUpdateFinancialItems = [];
            let shouldUpdateFinancialItems = today.getDate() >= judgementDay;

            _processScheduledCommRegs(context, customersToUpdateFinancialItems, shouldUpdateFinancialItems);
            _processInTrialCommRegs(context, customersToUpdateFinancialItems, shouldUpdateFinancialItems);
            _findCustomersWithPendingFinancialItems(context, customersToUpdateFinancialItems, today, judgementDay);
            _updateFinancialItemsOfCustomer([...new Set(customersToUpdateFinancialItems)], financialItemsReports);
            _reportFinancialItemsChanges(today, financialItemsReports);

        } catch (e) { utils.handleError(e); }
    }

    return { execute };
});

function _processInTrialCommRegs(context, customersToUpdateFinancialItems) {
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

            // Update the associated service to the correct price
            NS_MODULES.record['submitFields']({
                type: 'customrecord_service', id: scheduledServiceChange['custrecord_servicechg_service'],
                values: {
                    custrecord_service_price: scheduledServiceChange['custrecord_servicechg_new_price'],
                }
            });
        });

        customersToUpdateFinancialItems.push(inTrialCommReg['custrecord_customer'])
    });
}

function _processScheduledCommRegs(context, customersToUpdateFinancialItems, shouldUpdateFinancialItems) {
    utils.getCommRegsByFilters([ // get all scheduled comm regs with effective date being tomorrow
        ['custrecord_trial_status', 'is', COMM_REG_STATUS.Scheduled], // Scheduled (9)
        'AND',
        ['custrecord_comm_date', 'on', 'tomorrow'],
        'AND',
        ['custrecord_franchisee', 'is', 779884] // TODO: test with franchisee TEST - NSW
    ]).forEach(scheduledCommReg => { // for each scheduled comm regs

        let hasPreviouslySignedCommRegs = false;
        let isFreeTrial = !!scheduledCommReg['custrecord_trial_expiry'];

        // Find all Signed comm reg of the customer that the scheduled comm reg is associated to apply Changed (7) status to them
        utils.getCommRegsByFilters([
            ['custrecord_trial_status', 'anyof', COMM_REG_STATUS.Signed, COMM_REG_STATUS.Changed],
            'AND',
            ['custrecord_customer', 'is', scheduledCommReg['custrecord_customer']]
        ]).forEach(signedOrChangedCommReg => {

            // Make the current Active comm reg Changed (7)
            NS_MODULES.record['submitFields']({
                type: 'customrecord_commencement_register', id: signedOrChangedCommReg['internalid'],
                values: { custrecord_trial_status: COMM_REG_STATUS.Changed, }
            });
            hasPreviouslySignedCommRegs = true;
        });

        // Make the current Scheduled comm reg In Trial (1) or Signed (2)
        NS_MODULES.record['submitFields']({
            type: 'customrecord_commencement_register', id: scheduledCommReg['internalid'],
            values: { custrecord_trial_status: isFreeTrial ? COMM_REG_STATUS.In_Trial : COMM_REG_STATUS.Signed, }
        });

        // Find all service changes of Scheduled Comm Regs and execute them
        utils.getServiceChangesByFilters([
            ['custrecord_servicechg_status', 'is', SERVICE_CHANGE_STATUS.Scheduled], // Scheduled (1)
            'AND',
            ['custrecord_servicechg_comm_reg', 'is', scheduledCommReg['internalid']]
        ]).forEach(scheduledServiceChange => {

            // Make all previously active service changes of affected service Ceased (3)
            utils.getServiceChangesByFilters([
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

        if (isFreeTrial || !hasPreviouslySignedCommRegs || (hasPreviouslySignedCommRegs && shouldUpdateFinancialItems))
            customersToUpdateFinancialItems.push(scheduledCommReg['custrecord_customer']);
    })
}

function _findCustomersWithPendingFinancialItems(context, customersToUpdateFinancialItems, today, judgementDay) {
    if (today.getDate() !== judgementDay) return; // this should only run on judgement day

    utils.getCommRegsByFilters([
        ['custrecord_customer.status', 'anyOf'.toLowerCase(), '13'], // only Signed (13) customer
        'AND',
        ['custrecord_comm_date', 'within', `1/${today.getMonth() + 1}/${today.getFullYear()}`, `${judgementDay}/${today.getMonth() + 1}/${today.getFullYear()}`],
        'AND',
        ['custrecord_trial_status','anyOf'.toLowerCase(), '2'], // comm reg is Signed (2)
        'AND',
        ['custrecord_franchisee', 'anyOf'.toLowerCase(), '779884'] // TODO: test with franchisee TEST - NSW
    ], ['CUSTRECORD_CUSTOMER.entitystatus']).forEach(signedCommReg => {

        const changedCommRegs = utils.getCommRegsByFilters([ // get changed comm regs from the associated customer
            ['custrecord_trial_status', 'is', COMM_REG_STATUS.Changed],
            'AND',
            ['custrecord_customer', 'is', signedCommReg['custrecord_customer']]
        ]);

        if (changedCommRegs.length) // if this customer has other comm regs with Changed () status, we add it to the to-update list
            customersToUpdateFinancialItems.push(signedCommReg['custrecord_customer']);
    });
}

function _updateFinancialItemsOfCustomer(customerIds, financialItemsReports) {
    for (let customerId of customerIds) {
        try {
            const sublistId = 'itemPricing'.toLowerCase();
            const customerRecord = NS_MODULES.record.load({type: 'customer', id: customerId, isDynamic: true});
            const report = {
                customer: {
                    id: customerId,
                    entityId: customerRecord.getValue({fieldId: 'entityId'.toLowerCase()}),
                    companyName: customerRecord.getValue({fieldId: 'companyName'.toLowerCase()}),
                },
                services: []
            }

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

                report.services.push({
                    name: service['custrecord_service_text'],
                    price: service['custrecord_service_price'],
                    frequency: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Adhoc']
                        .map((item, index) => service['custrecord_service_day_' + item.toLowerCase()] ? item : null)
                        .filter(item => item).join(', ')
                })

                customerRecord['commitLine']({sublistId});
            });

            financialItemsReports.push(report);

            // Save customer record
            customerRecord.save({ignoreMandatoryFields: true});
        } catch (e) { utils.handleError(e, `Failed to update financial items for customer id ${customerId}`); }
    }
}

function _reportFinancialItemsChanges(today, financialItemsReports = []) {
    let content = '';
    let emailHtml = `<h3>Report for effective date: ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}</h3>`;
    emailHtml += financialItemsReports.length ? `<p>The following customers have had their Financial Items updated:</p>` : '<p>No update to financial items of any customer.</p>';

    for (let report of financialItemsReports) {
        const customerRecord = NS_MODULES.record.load({type: 'customer', id: report.customer.id});
        let pricingNotes = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}\n`;
        content += `<tr><td colspan="3"><b>${report.customer.entityId} ${report.customer.companyName} (ID: ${report.customer.id})</b></td></tr>`;

        for (let service of report.services) {
            pricingNotes += ` ${service.name} - @$${service.price} - ${service.frequency}\n`;
            content += `<tr><td>${service.name}</td><td>Price: $${service.price}</td><td>Frequency: ${service.frequency}</td></tr>`;
        }

        pricingNotes = pricingNotes + '\n' + customerRecord.getValue({fieldId: 'custentity_customer_pricing_notes'});
        content += `<tr><td colspan="3"><br></td></tr>`;

        try {
            NS_MODULES.record['submitFields']({type: 'customer', id: report.customer.id, values: {'custentity_customer_pricing_notes': pricingNotes}});
        } catch (e) { utils.handleError(e, `Failed to save Price Notes for customer ID ${report.customer.id}<br>Price Notes: ${pricingNotes}`) }
    }

    emailHtml += `<table>${content}</table>`

    NS_MODULES.email.send({
        author: 112209,
        subject: `[Financial Items Update][${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}]`,
        body: emailHtml,
        recipients: [
            import.meta.env.VITE_NS_USER_1732844_EMAIL,
            import.meta.env.VITE_NS_USER_409635_EMAIL,
        ],
        isInternalOnly: true
    })
}

const utils = {
    getServiceChangesByFilters(filters, additionalColumns = []) {
        let data = [];

        NS_MODULES.search.create({
            type: 'customrecord_servicechg',
            filters,
            columns: [...Object.keys(serviceChangeDefaults), ...additionalColumns]
        }).run().each(result => this.processSavedSearchResults(data, result));

        return data;
    },
    getServicesByFilters(filters, additionalColumns = []) {
        let data = [];

        NS_MODULES.search.create({
            type: 'customrecord_service',
            filters,
            columns: [...serviceFieldIds, ...additionalColumns]
        }).run().each(result => this.processSavedSearchResults(data, result));

        return data;
    },
    getCommRegsByFilters(filters, additionalColumns = []) {
        let data = [];

        NS_MODULES.search.create({
            type: 'customrecord_commencement_register',
            filters,
            columns: [...Object.keys(commRegDefaults), ...additionalColumns]
        }).run().each(result => this.processSavedSearchResults(data, result));

        return data;
    },

    processSavedSearchResults(data, result) {
        let obj = {};

        for (let column of result['columns']) {
            let columnName = [...(column.join ? [column.join] : []), column.name].join('.');
            obj[columnName] = result['getValue'](column);
            obj[columnName + '_text'] = result['getText'](column);
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
    },

    handleError(e, msg = '') {
        const currentScript = NS_MODULES.runtime['getCurrentScript']();
        NS_MODULES.log.debug({title: '_handleGETRequests', details: `error: ${e}`});
        NS_MODULES.email['sendBulk'].promise({
            author: 112209,
            body: (msg ? `Message: ${msg}<br>` : '') + `Stacktrace: ${e}`,
            subject: `[SCRIPT=${currentScript.id}][DEPLOY=${currentScript.deploymentId}]`,
            recipients: [import.meta.env.VITE_NS_USER_1732844_EMAIL],
            isInternalOnly: true
        });
    }
}
