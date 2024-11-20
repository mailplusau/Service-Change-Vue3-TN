/**
 * @author Tim Nguyen
 * @description NetSuite Experimentation - Service Change Processor.
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @created 05/08/2024
 *
 * Should be scheduled to run at 4AM AEST every day.
 */

import {COMM_REG_STATUS, commReg as commRegFields, SERVICE_CHANGE_STATUS, serviceChange as serviceChangeFields, serviceFieldIds} from '@/utils/defaults.mjs';

let NS_MODULES = {};

const internalId = 'InternalId'.toLowerCase();
const moduleNames = ['render', 'file', 'runtime', 'search', 'record', 'url', 'format', 'email', 'task', 'log', 'https'];

// eslint-disable-next-line no-undef
define(moduleNames.map(item => 'N/' + item), (...args) => {
    for (let [index, moduleName] of moduleNames.entries())
        NS_MODULES[moduleName] = args[index];


    function getInputData() {
        const judgementDay = 15;
        const today = utils.getToday();
        const shouldUpdateFinancialItems = today.getDate() >= judgementDay;
        let tasks = {};

        NS_MODULES.log.debug('getInputData', `today: ${today} | shouldUpdateFinancialItems: ${shouldUpdateFinancialItems}`);

        _.getScheduledCommRegs().forEach(scheduledCommReg => {
            tasks['ScheduledCommReg_' + scheduledCommReg['InternalId'.toLowerCase()]] = {
                scheduledCommReg,
                shouldUpdateFinancialItems
            }
        })

        _.getInTrialCommRegs().forEach(inTrialCommReg => {
            tasks['InTrialCommReg_' + inTrialCommReg[internalId]] = {
                inTrialCommReg,
                shouldUpdateFinancialItems
            }
        })

        _.getCustomersWithPendingFinancialItems(today, judgementDay).forEach(customerId => {
            tasks['PendingCustomer_' + customerId] = {
                customerToUpdateFinancialItems: customerId,
                shouldUpdateFinancialItems
            }
        })

        NS_MODULES.log.debug('getInputData', `today: ${today} | shouldUpdateFinancialItems: ${shouldUpdateFinancialItems} | tasks: ${JSON.stringify(tasks)}`);

        return tasks;
    }

    function reduce(ctx) {
        NS_MODULES.log.debug('reduce', `key: ${ctx.key} | value: ${ctx.values}`);
        const value = JSON.parse(ctx.values);

        if (ctx.key.includes('ScheduledCommReg')) {
            _.processScheduledCommReg(ctx, value['scheduledCommReg'], value['shouldUpdateFinancialItems'])
        } else if (ctx.key.includes('InTrialCommReg')) {
            _.processInTrialCommReg(ctx, value['inTrialCommReg'])
        } else if (ctx.key.includes('PendingCustomer')) {
            _.processPendingCustomer(value['customerToUpdateFinancialItems'], ctx)
        }
    }

    function summarize(ctx) {
        utils.handleErrorIfAny(ctx)
        _.reportFinancialItemsChanges(ctx);

        NS_MODULES.log.debug('summarize', 'done')
    }

    return {
        getInputData,
        reduce,
        summarize
    };
});

const utils = {
    getServiceChangesByFilters(filters) {
        let data = [];

        NS_MODULES.search.create({
            type: "customrecord_servicechg",
            filters,
            columns: Object.keys(serviceChangeFields)
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
            columns: Object.keys(commRegFields)
        }).run().each(result => this.processSavedSearchResults(data, result));

        return data;
    },

    getToday() {
        let today = new Date();
        today.setTime(today.getTime() + (18)*60*60*1000); // this should be today, so we add <whatever the timezone offset is> (18 in this case)

        return today;
    },
    formatCurrency(price) {
        let formatted = parseFloat(price).toFixed(2);
        return formatted === 'NaN' ? price : '$' + formatted;
    },

    processSavedSearchResults(data, result) {
        let obj = {};

        obj['internalid'] = result.id;
        for (let column of result['columns']) {
            obj[column.name + '_text'] = result['getText'](column);
            obj[column.name] = result['getValue'](column);
        }
        data.push(obj);

        return true;
    },
    
    handleErrorIfAny(summary) {
        let inputSummary = summary['inputSummary'];
        let mapSummary = summary['mapSummary'];
        let reduceSummary = summary['reduceSummary'];

        if (inputSummary.error)
            NS_MODULES.log.debug('INPUT_STAGE_FAILED', `${inputSummary.error}`)

        mapSummary.errors.iterator().each(function(key, value){
            NS_MODULES.log.debug(`MAP_STAGE_KEY_${key}_FAILED`, `Error was: ${JSON.parse(value + '').message}`)
            return true;
        });

        reduceSummary.errors.iterator().each(function(key, value){
            NS_MODULES.log.debug(`REDUCE_STAGE_KEY_${key}_FAILED`, `Error was: ${JSON.parse(value + '').message}`)
            return true;
        });
    }
}

const _ = {
    getScheduledCommRegs() {
        return utils.getCommRegsByFilters([ // get all scheduled comm regs with effective date on or before tomorrow that has T&C Agreement
            ['custrecord_trial_status', 'anyOf'.toLowerCase(), COMM_REG_STATUS.Scheduled], // Scheduled (9)
            'AND',
            ['custrecord_comm_date', 'onOrBefore'.toLowerCase(), 'today'],
            'AND',
            ['custrecord_tnc_agreement_date', 'isNotEmpty'.toLowerCase(), ''],
            'AND',
            ['custrecord_customer.entitystatus', 'anyOf'.toLowerCase(), [13, 32, 71, 66]], // Signed (13), Free Trial (32), Free Trial - Pending (71) and To be Finalised (66)
        ]);
    },
    getInTrialCommRegs() {
        return utils.getCommRegsByFilters([ // get all In Trial comm regs with billing date being tomorrow
            ['custrecord_trial_status', 'anyOf'.toLowerCase(), COMM_REG_STATUS.In_Trial], // Scheduled (9)
            'AND',
            ['custrecord_bill_date', 'on', 'tomorrow'],
        ]);
    },
    getCustomersWithPendingFinancialItems(today, judgementDay) {
        if (today.getDate() !== judgementDay) return []; // this should only run on judgement day
        
        const customerIds = [];
        
        utils.getCommRegsByFilters([
            ['custrecord_customer.status', 'anyOf'.toLowerCase(), '13'], // only Signed (13) customer
            'AND',
            ['custrecord_comm_date', 'within', `1/${today.getMonth() + 1}/${today.getFullYear()}`, `${judgementDay}/${today.getMonth() + 1}/${today.getFullYear()}`],
            'AND',
            ['custrecord_trial_status','anyOf'.toLowerCase(), COMM_REG_STATUS.Signed], // comm reg is Signed (2)
        ], ['CUSTRECORD_CUSTOMER.entitystatus']).forEach(signedCommReg => {

            const changedCommRegs = utils.getCommRegsByFilters([ // get changed comm regs from the associated customer
                ['custrecord_trial_status', 'is', COMM_REG_STATUS.Changed],
                'AND',
                ['custrecord_customer', 'is', signedCommReg['custrecord_customer']]
            ]);

            if (changedCommRegs.length) // if this customer has other comm regs with Changed (7) status, we add it to the to-update list
                customerIds.push(signedCommReg['custrecord_customer'])
        });
        
        return customerIds;
    },

    processScheduledCommReg(ctx, scheduledCommReg, shouldUpdateFinancialItems) {
        let isFreeTrial = !!scheduledCommReg['custrecord_trial_expiry'];
        let hasPreviouslySignedCommRegs;

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

        this.informFranchiseeOfFreeTrialCustomer(scheduledCommReg);

        // Make the current Scheduled comm reg In Trial (1) or Signed (2)
        NS_MODULES.record['submitFields']({
            type: 'customrecord_commencement_register', id: scheduledCommReg['internalid'],
            values: { custrecord_trial_status: isFreeTrial ? COMM_REG_STATUS.In_Trial : COMM_REG_STATUS.Signed, }
        });

        // Find all service changes of Scheduled Comm Regs and execute them
        utils.getServiceChangesByFilters([
            ['custrecord_servicechg_status', 'anyOf'.toLowerCase(), SERVICE_CHANGE_STATUS.Scheduled, SERVICE_CHANGE_STATUS.Quote], // Scheduled (1) or Quote (4)
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
            this.applyServiceChange(scheduledServiceChange, isFreeTrial)
        });

        if (isFreeTrial || !hasPreviouslySignedCommRegs || (hasPreviouslySignedCommRegs && shouldUpdateFinancialItems))
            this.processPendingCustomer(scheduledCommReg['custrecord_customer'], ctx)
    },
    processInTrialCommReg(ctx, inTrialCommReg) {
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

        // Make the current In-Trial comm reg Signed (2)
        NS_MODULES.record['submitFields']({
            type: 'customrecord_commencement_register', id: inTrialCommReg['internalid'],
            values: { custrecord_trial_status: COMM_REG_STATUS.Signed, }
        });

        this.processPendingCustomer(inTrialCommReg['custrecord_customer'], ctx)
    },
    processPendingCustomer(customerId, ctx) {
        const customerRecord = NS_MODULES.record.load({type: 'customer', id: customerId, isDynamic: true});
        const sublistId = 'itemPricing'.toLowerCase();

        const report = {
            customer: {
                id: customerId,
                entityId: customerRecord.getValue({fieldId: `entityId`.toLowerCase()}),
                companyName: customerRecord.getValue({fieldId: `companyName`.toLowerCase()}),
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
            customerRecord['setCurrentSublistValue']({sublistId, fieldId: 'level', value: -1});
            customerRecord['setCurrentSublistValue']({sublistId, fieldId: 'price', value: service['custrecord_service_price']});
            customerRecord['setCurrentSublistValue']({sublistId, fieldId: 'item', value: service['custrecord_service_ns_item']});

            let freqArray = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Adhoc']
                .map(item => service['custrecord_service_day_' + item.toLowerCase()] ? item : null)
                .filter(item => item);

            const freqString = freqArray.length ? (freqArray.length === 5 ? 'Daily' : freqArray.join(', ')) : 'Adhoc';

            report.services.push({
                price: service['custrecord_service_price'],
                name: service['custrecord_service_text'],
                frequency: freqString
            })

            customerRecord['commitLine']({sublistId});
        });

        ctx.write({key: 'CustomerReport_' + customerId, value: report });

        // Save customer record
        customerRecord.save({ignoreMandatoryFields: true});
    },
    applyServiceChange(scheduledServiceChange, isFreeTrial) {
        let frequencyFields = {};

        NS_MODULES.record['submitFields']({// Update the service change record itself
            type: 'customrecord_servicechg', id: scheduledServiceChange['internalid'],
            values: {
                custrecord_servicechg_status: !!scheduledServiceChange['custrecord_servicechg_date_ceased'] ? SERVICE_CHANGE_STATUS.Ceased : SERVICE_CHANGE_STATUS.Active, // Ceased (3) or Active (2)
                custrecord_servicechg_cancellation_date: scheduledServiceChange['custrecord_servicechg_date_ceased'] || scheduledServiceChange['custrecord_servicechg_cancellation_date']
            }
        });

        ['mon', 'tue', 'wed', 'thu', 'fri', 'adhoc'].forEach((item, index) => {
            frequencyFields['custrecord_service_day_' + item] = scheduledServiceChange.custrecord_servicechg_new_freq.split(',').includes(`${index + 1}`);
        });

        NS_MODULES.record['submitFields']({ // Update the associated service (set the price to 0 if this is a free trial)
            type: 'customrecord_service', id: scheduledServiceChange['custrecord_servicechg_service'],
            values: {
                ...frequencyFields,
                isinactive: !!scheduledServiceChange['custrecord_servicechg_date_ceased'],
                custrecord_service_price: isFreeTrial ? 0 : scheduledServiceChange['custrecord_servicechg_new_price'],
            }
        });
    },

    informFranchiseeOfFreeTrialCustomer(scheduledCommReg) {
        if (!scheduledCommReg['custrecord_trial_expiry']) return; // only run if free trial

        try {
            let {search, record, https, url, email, format, file} = NS_MODULES;
            let commReg = record.load({type: 'customrecord_commencement_register', id: scheduledCommReg['internalid']});
            let salesRecord = record.load({type: 'customrecord_sales', id: scheduledCommReg['custrecord_commreg_sales_record']});
            let salesRecordValues = search['lookupFields']({
                type: 'customrecord_sales',
                id: scheduledCommReg['custrecord_commreg_sales_record'],
                columns: ['custrecord_sales_campaign', 'custrecord_sales_assigned.internalid', 'custrecord_sales_assigned.email']
            })
            let customerId = scheduledCommReg['custrecord_customer'];
            let attachments = [];
            let franchiseeEmail = search['lookupFields']({
                type: 'customer',
                id: customerId,
                columns: ['partner.email']
            })['partner.email'];
            let billingStartDate = null;
            let trialExpiryDate = commReg.getValue({fieldId: 'custrecord_trial_expiry'});

            if (trialExpiryDate) {
                billingStartDate = new Date(trialExpiryDate.toISOString());
                billingStartDate.setDate(billingStartDate.getDate() + 1);
            }

            if (scheduledCommReg['custrecord_scand_form']) attachments.push(file.load({id: scheduledCommReg['custrecord_scand_form']}))

            search.create({
                type: "contact",
                filters:
                    [
                        ["isinactive", "is", "F"], 'AND',
                        ["company", "is", customerId], 'AND',
                        ['email', 'isnotempty', '']
                    ],
                columns: ['internalid']
            }).run().each(resultSet => {
                // LPO Campaign (69)
                let templateId = parseInt(salesRecordValues['custrecord_sales_campaign'][0]['value']) === 69 ? 201 : 150;
                let emailTemplateRecord = record.load({type: 'customrecord_camp_comm_template', id: templateId})
                let httpsGetResult = https.get({url: url.format({
                        domain: 'https://1048144.extforms.netsuite.com/app/site/hosting/scriptlet.nl',
                        params: {
                            script: 395,
                            deploy: 1,
                            compid: 1048144,
                            'ns-at': 'AAEJ7tMQgAVHkxJsbXgGwQQm4xn968o7JJ9-Ym7oanOzCSkWO78',
                            rectype: 'customer',
                            template: templateId,
                            recid: customerId,
                            salesrep: salesRecord?.getValue({fieldId: 'custrecord_sales_assigned'}),
                            dear: null,
                            contactid: resultSet['id'],
                            userid: salesRecordValues['custrecord_sales_assigned.internalid'][0]['value'],
                            commdate: format.format({type: 'date', value: commReg.getValue({fieldId: 'custrecord_comm_date'})}),
                            commreg: commReg.getValue({fieldId: 'internalid'}),
                            trialenddate: trialExpiryDate ? format.format({type: 'date', value: commReg.getValue({fieldId: 'custrecord_trial_expiry'})}) : '',
                            billingstartdate: billingStartDate ? format.format({type: 'date', value: billingStartDate}) : '',
                        }
                    })});
                let emailHtml = httpsGetResult.body;

                email.send({
                    author: salesRecordValues['custrecord_sales_assigned.internalid'][0]['value'],
                    subject: emailTemplateRecord.getValue({fieldId: 'custrecord_camp_comm_subject'}),
                    body: emailHtml,
                    recipients: [franchiseeEmail],
                    cc: [
                        salesRecordValues['custrecord_sales_assigned.email'],
                        ...(parseInt(salesRecordValues['custrecord_sales_campaign'][0]['value']) === 69 ? ['kerry.oneill@mailplus.com.au'] : [])
                    ],
                    bcc: ['tim.nguyen@mailplus.com.au'],
                    attachments,
                    relatedRecords: {'entityId': customerId},
                    isInternalOnly: true
                });
            })
        } catch (e) { utils.handleError(e); }
    },

    reportFinancialItemsChanges(summaryContext) {
        const today = utils.getToday();
        const financialItemsReports = [];
        
        summaryContext.output.iterator().each(function(key, value) {
            if (`${key}`.includes('CustomerReport')) financialItemsReports.push(JSON.parse(`${value}`))
            
            return true;
        });

        let emailContent = '';
        let emailHtml = `<h3>Report for effective date: ${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}</h3>`;
        emailHtml += financialItemsReports.length ? `<p>The following customers have had their Financial Items updated:</p>` : '<p>No update to financial items of any customer.</p>';

        for (let report of financialItemsReports) {
            const customerRecord = NS_MODULES.record.load({type: 'customer', id: report.customer.id});
            let pricingNotes = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}\n`;
            emailContent += `<tr><td colspan="3"><b><u>${report.customer.entityId} ${report.customer.companyName} (ID: ${report.customer.id})</u></b></td></tr>`;

            for (let service of report.services) {
                pricingNotes += ` ${service.name} - @${utils.formatCurrency(service.price)} - ${service.frequency}\n`;
                emailContent += `<tr><td>${service.name}</td><td>Price: ${utils.formatCurrency(service.price)}</td><td>Frequency: ${service.frequency}</td></tr>`;
            }

            emailContent += `<tr><td colspan="3"><br></td></tr>`;
            pricingNotes = pricingNotes + '\n' + customerRecord.getValue({fieldId: 'custentity_customer_pricing_notes'});

            try {
                NS_MODULES.record['submitFields']({type: 'customer', id: report.customer.id, values: {'custentity_customer_pricing_notes': pricingNotes}});
            } catch (e) { utils.handleError(e, `Failed to save Price Notes for customer ID ${report.customer.id}<br>Price Notes: ${pricingNotes}`) }
        }

        emailHtml += `<table>${emailContent}</table>`

        NS_MODULES.email.send({
            author: 112209,
            subject: `[Financial Items Update][${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}]`,
            body: emailHtml,
            recipients: [
                import.meta.env.VITE_NS_USER_1732844_EMAIL,
                import.meta.env.VITE_NS_USER_409635_EMAIL,
                import.meta.env.VITE_NS_USER_1552795_EMAIL,
                import.meta.env.VITE_NS_USER_772595_EMAIL,
            ],
            isInternalOnly: true
        })
    }
}