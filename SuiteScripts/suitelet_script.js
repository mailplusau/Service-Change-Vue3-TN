/**
 * @author Tim Nguyen
 * @description NetSuite-hosted Page - Service Change
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @created 17/06/2024
 */

import {serviceChange as serviceChangeFields, commReg as commRegFields, salesRecord as salesRecordFields, serviceFieldIds} from '@/utils/defaults.mjs';
import {VARS} from '@/utils/utils.mjs';

// These variables will be injected during upload. These can be changed under 'netsuite' of package.json
let htmlTemplateFilename/**/;
let clientScriptFilename/**/;

const defaultTitle = VARS.pageTitle;
const isoStringRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}$/; // ISO string without the timezone indicator (Z)

let NS_MODULES = {};

// eslint-disable-next-line no-undef
define(['N/ui/serverWidget', 'N/render', 'N/search', 'N/file', 'N/log', 'N/record', 'N/email', 'N/runtime', 'N/https', 'N/task', 'N/format', 'N/url'],
    (serverWidget, render, search, file, log, record, email, runtime, https, task, format, url) => {
        NS_MODULES = {serverWidget, render, search, file, log, record, email, runtime, https, task, format, url};

        const onRequest = ({request, response}) => {
            if (request.method === "GET") {

                if (!_.handleGETRequests(request.parameters['requestData'], response)){
                    // Render the page using either inline form or standalone page
                    if (request.parameters['standalone']) _.getStandalonePage(response)
                    else _.getInlineForm(response)
                }

            } else if (request.method === "POST") { // Request method should be POST (?)
                _.handlePOSTRequests(JSON.parse(request.body), response);
                // _writeResponseJson(response, {test: 'test response from post', params: request.parameters, body: request.body});
            } else log.debug({ title: "request method type", details: `method : ${request.method}` });

        }

        const _ = {
            // Render the htmlTemplateFile as a standalone page without any of NetSuite's baggage. However, this also means no
            // NetSuite module will be exposed to the Vue app. Thus, an api approach using Axios and structuring this Suitelet as
            // a http request handler will be necessary. For reference:
            // https://medium.com/@vladimir.aca/how-to-vuetify-your-suitelet-on-netsuite-part-2-axios-http-3e8e731ac07c
            getStandalonePage(response) {
                let {file} = NS_MODULES;

                // Get the id and url of our html template file
                const htmlFileData = this.getHtmlTemplate(htmlTemplateFilename);

                // Load the  html file and store it in htmlFile
                const htmlFile = file.load({id: htmlFileData[htmlTemplateFilename].id});

                response.write(htmlFile['getContents']());
            },
            // Render the page within a form element of NetSuite. This can cause conflict with NetSuite's stylesheets.
            getInlineForm(response) {
                let {serverWidget} = NS_MODULES;

                // Create a NetSuite form
                let form = serverWidget['createForm']({ title: defaultTitle });

                // Retrieve client script ID using its file name.
                form.clientScriptFileId = this.getHtmlTemplate(clientScriptFilename)[clientScriptFilename].id;

                response['writePage'](form);
            },
            // Search for the ID and URL of a given file name inside the NetSuite file cabinet
            getHtmlTemplate(htmlPageName) {
                let {search} = NS_MODULES;

                const htmlPageData = {};

                search.create({
                    type: 'file',
                    filters: ['name', 'is', htmlPageName],
                    columns: ['name', 'url']
                }).run().each(resultSet => {
                    htmlPageData[resultSet['getValue']({ name: 'name' })] = {
                        url: resultSet['getValue']({ name: 'url' }),
                        id: resultSet['id']
                    };
                    return true;
                });

                return htmlPageData;
            },
            handleGETRequests(request, response) {
                if (!request) return false;

                try {
                    let {operation, requestParams} = this.validateRequest('GET', request);

                    if (operation === 'getIframeContents') this.getIframeContents(response);
                    else getOperations[operation](response, requestParams);
                } catch (e) {
                    NS_MODULES.log.debug({title: "_handleGETRequests", details: `error: ${e}`});
                    this.handleError(request, e)
                    _writeResponseJson(response, {error: `${e}`})
                }

                return true;
            },
            handlePOSTRequests(request, response) {
                if (!request) return;

                let {operation, requestParams} = this.validateRequest('POST', request);
                try {

                    postOperations[operation](response, requestParams);
                } catch (e) {
                    NS_MODULES.log.debug({title: "_handlePOSTRequests", details: `error: ${e}`});
                    this.handleError(JSON.stringify(request), e)
                    _writeResponseJson(response, {error: `${e}`})
                }
            },
            getIframeContents(response) {
                const htmlFileData = this.getHtmlTemplate(htmlTemplateFilename);
                const htmlFile = NS_MODULES.file.load({ id: htmlFileData[htmlTemplateFilename].id });

                _writeResponseJson(response, htmlFile['getContents']());
            },
            validateRequest(method, request) {
                let {operation, requestParams} = method === 'POST' ? request : JSON.parse(request);
                if (!operation) throw 'No operation specified.';

                if (method === 'POST' && !postOperations[operation]) throw `POST operation [${operation}] is not supported.`;
                else if (method === 'GET' && !getOperations[operation] && operation !== 'getIframeContents')
                    throw `GET operation [${operation}] is not supported.`;

                return {operation, requestParams};
            },
            handleError(request, e) {
                try {
                    const currentScript = NS_MODULES.runtime['getCurrentScript']();
                    NS_MODULES.email['sendBulk'].promise({
                        author: 112209,
                        body: `User: ${JSON.stringify(NS_MODULES.runtime['getCurrentUser']())}<br><br>Incoming request data: ${request}<br><br>Stacktrace: ${e}`,
                        subject: `[ERROR][SCRIPT=${currentScript.id}][DEPLOY=${currentScript.deploymentId}]`,
                        recipients: ['tim.nguyen@mailplus.com.au'],
                        isInternalOnly: true
                    });
                    NS_MODULES.log.error('Error handled', `${e}`);
                } catch (error) { NS_MODULES.log.error('failed to handle error', `${error}`); }
            }
        }

        return {onRequest};
    });

function _writeResponseJson(response, body) {
    response['addHeader']({name: 'Content-Type', value: 'application/json; charset=utf-8'});
    response.write({ output: JSON.stringify(body) });
}

const getOperations = {
    'getCurrentUserDetails' : function (response) {
        _writeResponseJson(response, {
            id: NS_MODULES.runtime['getCurrentUser']().id,
            role: NS_MODULES.runtime['getCurrentUser']().role,
        });
    },
    'getSelectOptions' : function (response, {id, type, valueColumnName, textColumnName}) {
        let {search} = NS_MODULES;
        let data = [];

        search.create({
            id, type,
            filters: ['isinactive', 'is', false],
            columns: [{name: valueColumnName}, {name: textColumnName}]
        }).run().each(result => {
            data.push({value: result['getValue'](valueColumnName), title: result['getValue'](textColumnName)});
            return true;
        });

        _writeResponseJson(response, data);
    },
    'getServiceTypes' : function (response) {
        let {search} = NS_MODULES;
        let data = [];

        let searchResult = search.create({
            type: 'customrecord_service_type',
            filters: [
                {name: 'custrecord_service_type_category', operator: 'anyof', values: [1]},
            ],
            columns: [
                {name: 'internalid'},
                {name: 'custrecord_service_type_ns_item_array'},
                {name: 'name'}
            ]
        }).run();

        searchResult.each(item => {
            data.push({value: item['getValue']('internalid'), title: item['getValue']('name')})

            return true;
        });

        _writeResponseJson(response, data);
    },
    'getSalesRecord' : function (response, {salesRecordId}) {
        let salesRecord = NS_MODULES.record.load({type: 'customrecord_sales', id: salesRecordId});
        let tmp = {};

        for (let fieldId in salesRecordFields) {
            tmp[fieldId] = salesRecord.getValue({fieldId});
            tmp[fieldId + '_text'] = salesRecord.getText({fieldId});
        }

        _writeResponseJson(response, tmp);
    },
    'getCommencementRegister' : function (response, {commRegId}) {
        let {record} = NS_MODULES;
        let data = {};

        let commRegRecord = record.load({
            type: 'customrecord_commencement_register',
            id: commRegId,
        });

        for (let fieldId in commRegFields) {
            data[fieldId] = commRegRecord.getValue({fieldId});
            data[fieldId + '_text'] = commRegRecord.getText({fieldId});
        }

        _writeResponseJson(response, data);
    },
    'getCommRegBySalesRecordId' : function (response, {salesRecordId}) {
        _writeResponseJson(response, sharedFunctions.getCommRegsByFilters([
            ['custrecord_commreg_sales_record', 'is', salesRecordId]
        ]));
    },
    'getCustomerDetails': function (response, {customerId, fieldIds}) {
        if (!customerId) throw `Invalid Customer ID: ${customerId}`;

        _writeResponseJson(response, sharedFunctions.getCustomerData(customerId, fieldIds));
    },
    'getServicesAndServiceChanges' : function (response, {customerId, commRegId}) {
        let serviceChanges = commRegId ? sharedFunctions.getServiceChangesByFilters([
            ["custrecord_servicechg_comm_reg", "is", commRegId],
            "AND",
            ["isinactive", "is", false],
            "AND",
            ["custrecord_servicechg_status", "anyof", [1, 4]], // Scheduled (1) or Quote (4)
        ]) : [];

        let services = sharedFunctions.getServicesByFilters([
            ["custrecord_service_customer", "is", customerId],
            "AND",
            [
                ["isinactive", "is", false],
                "OR",
                ["internalid", "anyof", serviceChanges.length ? serviceChanges.map(item => item.custrecord_servicechg_service) : '-1']
            ],
            "AND",
            ["custrecord_service_category", "is", 1], // Service Category: Services (1)
        ]);


        _writeResponseJson(response, {services, serviceChanges});
    },
    'getScriptUrl' : function (response, {scriptId, deploymentId, params, returnExternalUrl = false}) {
        _writeResponseJson(response, NS_MODULES.url['resolveScript']({scriptId, deploymentId, params, returnExternalUrl}));
    },
    'getFranchiseeOfCustomer' : function (response, {customerId, fieldIds}) {
        let partner = {};
        try {
            let result = NS_MODULES.search['lookupFields']({
                type: 'customer',
                id: customerId,
                columns: ['partner']
            });
            let partnerRecord = NS_MODULES.record.load({type: 'partner', id: result.partner ? result.partner[0].value : ''})
            for (let fieldId of fieldIds) {
                partner[fieldId] = partnerRecord['getValue']({fieldId});
                partner[fieldId + '_text'] = partnerRecord['getText']({fieldId});
            }

        } catch (e) {
            //
        }
        _writeResponseJson(response, partner);
    },
}

const postOperations = {
    'verifyParameters' : function (response, {customerId, salesRecordId, commRegId}) {
        customerId = parseInt(customerId);

        if (salesRecordId) {
            let associatedCustomerId = NS_MODULES.search['lookupFields']({
                type: 'customrecord_sales',
                id: salesRecordId,
                columns: ['custrecord_sales_customer']
            })['custrecord_sales_customer']?.[0]?.value;

            if (parseInt(associatedCustomerId) !== customerId)
                throw `IDs mismatched. Sales record #${salesRecordId} does not belong to customer #${customerId}.`;

            salesRecordId = parseInt(salesRecordId);
        }

        if (commRegId) {
            let associatedSalesRecordId = NS_MODULES.search['lookupFields']({
                type: 'customrecord_commencement_register',
                id: commRegId,
                columns: ['custrecord_commreg_sales_record']
            })['custrecord_commreg_sales_record']?.[0]?.value;

            if (parseInt(associatedSalesRecordId) !== salesRecordId)
                throw `IDs mismatched. Commencement Register #${commRegId} does not belong to sales record #${salesRecordId}.`;

            commRegId = parseInt(commRegId);
        }

        _writeResponseJson(response, { customerId, salesRecordId, commRegId });
    },
    'saveService' : function(response, {serviceId, serviceData}) {
        let serviceRecord = serviceId ?
            NS_MODULES.record.load({type: 'customrecord_service', id: serviceId, isDynamic: true}) :
            NS_MODULES.record.create({type: 'customrecord_service', isDynamic: true});

        for (let key in serviceData) serviceRecord.setValue({fieldId: key, value: serviceData[key]});

        _writeResponseJson(response, serviceRecord.save({ignoreMandatoryFields: true}));
    },
    'cancelPendingService' : function(response, {serviceId, commRegId}) {
        let {record} = NS_MODULES;
        let serviceRecord = record.load({type: 'customrecord_service', id: serviceId});
        let serviceChanges = sharedFunctions.getServiceChangesByFilters([
            ["custrecord_servicechg_service", "is", serviceId],
            "AND",
            ["custrecord_servicechg_comm_reg", "is", commRegId],
        ]);

        if (serviceRecord.getValue({fieldId: 'isinactive'})) {
            // service is inactive, means this is a new service pending creation, we can just delete the service and its service change
            for (let serviceChange of serviceChanges)
                record.delete({type: 'customrecord_servicechg', id: serviceChange.internalid});

            record.delete({type: 'customrecord_service', id: serviceId});

            _writeResponseJson(response, `Pending service ID ${serviceId} has been removed.`);
        } else _writeResponseJson(response, `Pending service ID ${serviceId} was not removed because it is active.`);
    },
    'cancelChangesOfService' : function(response, {serviceId, commRegId}) {
        let serviceChanges = sharedFunctions.getServiceChangesByFilters([
            ["custrecord_servicechg_service", "is", serviceId],
            "AND",
            ["custrecord_servicechg_comm_reg", "is", commRegId],
        ]);

        for (let serviceChange of serviceChanges)
            NS_MODULES.record.delete({type: 'customrecord_servicechg', id: serviceChange.internalid});

        _writeResponseJson(response, `Changes for service ID ${serviceId} has been cancelled.`);
    },
    'saveServiceChange' : function(response, {serviceChangeData}) {
        let {record, search} = NS_MODULES;
        let needInactiveBypass = false;

        // Save the service change record
        let serviceChangeRecord = serviceChangeData.internalid ?
            record.load({type: 'customrecord_servicechg', id: serviceChangeData.internalid, isDynamic: true}) :
            record.create({type: 'customrecord_servicechg', isDynamic: true});

        // check if we need to temporarily set the service record to active
        needInactiveBypass = search['lookupFields']({type: 'customrecord_service', id: serviceChangeData['custrecord_servicechg_service'], columns: ['isinactive']})['isinactive'];
        record['submitFields']({type: 'customrecord_service', id: serviceChangeData['custrecord_servicechg_service'], values: {'isinactive': false}});

        delete serviceChangeFields.internalid;

        for (let key in serviceChangeFields)
            if (['custrecord_servicechg_old_freq', 'custrecord_servicechg_new_freq'].includes(key))
                serviceChangeRecord.setValue({fieldId: key, value: serviceChangeData[key] ? serviceChangeData[key].split(',') : []});
            else
                serviceChangeRecord.setValue({
                    fieldId: key,
                    value: isoStringRegex.test(serviceChangeData[key]) ? new Date(serviceChangeData[key]) : serviceChangeData[key]
                });

        let serviceChangeId = serviceChangeRecord.save({ignoreMandatoryFields: true})

        if (needInactiveBypass) // set the service record back to inactive
            record['submitFields']({type: 'customrecord_service', id: serviceChangeData['custrecord_servicechg_service'], values: {'isinactive': true}});

        _writeResponseJson(response, serviceChangeId);
    },
    'createCommencementRegister' : function(response, {commRegData}) {
        let {record} = NS_MODULES;

        let commRegRecord = record.create({type: 'customrecord_commencement_register'});

        for (let fieldId in commRegData) {
            let value = commRegData[fieldId];
            if (isoStringRegex.test(commRegData[fieldId]) && ['date', 'datetimetz'].includes(commRegRecord['getField']({fieldId})?.type))
                value = new Date(commRegData[fieldId]);

            commRegRecord.setValue({fieldId, value});
        }

        let commRegId = commRegRecord.save({ignoreMandatoryFields: true});

        _writeResponseJson(response, commRegId); // return the first result
    },
    'updateServiceRatesOfCustomer' : function (response, {customerId, commRegId}) {
        let {monthlyServiceRate, monthlyExtraServiceRate, monthlyReducedServiceRate} = _calculateServiceRates(customerId, commRegId);

        NS_MODULES.record['submitFields']({
            type: 'customer', id: customerId,
            values: {
                'custentity_cust_monthly_service_value': monthlyServiceRate,
                'custentity_monthly_extra_service_revenue': monthlyExtraServiceRate,
                'custentity_monthly_reduc_service_revenue': monthlyReducedServiceRate,
            }
        });

        _writeResponseJson(response, { monthlyServiceRate, monthlyExtraServiceRate, monthlyReducedServiceRate });
    },
    'updateEffectiveDate' : function (response, {commRegId, dateEffective}) {
        if (!isoStringRegex.test(dateEffective)) throw `Effective date [${dateEffective}] is not a valid date`;
        if (!commRegId) throw `Commencement Register ID not specified`;

        dateEffective = new Date(dateEffective);
        let {record} = NS_MODULES;
        let serviceChanges = sharedFunctions.getServiceChangesByFilters([
            ["custrecord_servicechg_comm_reg", "is", commRegId],
            "AND",
            ["custrecord_servicechg_status", "anyof", [1, 4]], // Scheduled (1) or Quote (4)
            "AND",
            ["isinactive", "is", false],
        ]);

        serviceChanges.forEach(item => {
            record['submitFields']({type: 'customrecord_servicechg', id: item.internalid, values: {'custrecord_servicechg_date_effective': dateEffective}});
        });

        record['submitFields']({type: 'customrecord_commencement_register', id: commRegId, values: {'custrecord_comm_date': dateEffective}});

        _writeResponseJson(response, `Effective date has been set to ${dateEffective}`);
    },
    'updateTrialEndDate' : function (response, {commRegId, trialEndDate, billingStartDate}) {
        if (!isoStringRegex.test(trialEndDate)) throw `Trial expiry date [${trialEndDate}] is not a valid date`;
        if (!isoStringRegex.test(billingStartDate)) throw `Billing start date [${billingStartDate}] is not a valid date`;
        if (!commRegId) throw `Commencement Register ID not specified`;

        trialEndDate = new Date(trialEndDate);
        billingStartDate = new Date(billingStartDate);
        let {record} = NS_MODULES;
        let serviceChanges = sharedFunctions.getServiceChangesByFilters([
            ["custrecord_servicechg_comm_reg", "is", commRegId],
            "AND",
            ["custrecord_servicechg_status", "anyof", [1, 4]], // Scheduled (1) or Quote (4)
            "AND",
            ["isinactive", "is", false],
        ]);

        serviceChanges.forEach(item => {
            record['submitFields']({type: 'customrecord_servicechg', id: item.internalid, values: {
                'custrecord_trial_end_date': trialEndDate,
                'custrecord_servicechg_bill_date': billingStartDate
            }});
        });

        record['submitFields']({type: 'customrecord_commencement_register', id: commRegId, values: {
            'custrecord_trial_expiry': trialEndDate,
            'custrecord_bill_date': billingStartDate,
        }});

        _writeResponseJson(response, `Trial end date has been set to ${trialEndDate}`);
    }
};

const sharedFunctions = {
    getCustomerData(customerId, fieldIds) {
        let {record} = NS_MODULES;
        let data = {};

        let customerRecord = record.load({
            type: record.Type.CUSTOMER,
            id: customerId,
        });

        for (let fieldId of fieldIds) {
            data[fieldId] = customerRecord.getValue({fieldId});
            data[fieldId + '_text'] = customerRecord.getText({fieldId});
        }

        return data;
    },

    getServicesByFilters(filters) {
        let data = [];

        NS_MODULES.search.create({
            type: "customrecord_service",
            filters,
            columns: serviceFieldIds
        }).run().each(result => _processSavedSearchResults(data, result));

        return data;
    },
    getServiceChangesByFilters(filters) {
        let serviceChangeFieldIds = [];
        let data = [];

        for (let key in serviceChangeFields) serviceChangeFieldIds.push(key);

        NS_MODULES.search.create({
            type: "customrecord_servicechg",
            filters,
            columns: serviceChangeFieldIds
        }).run().each(result => _processSavedSearchResults(data, result));

        return data;
    },
    getCommRegsByFilters(filters, additionalColumns = []) {
        let data = [];

        NS_MODULES.search.create({
            type: "customrecord_commencement_register",
            filters,
            columns: [...Object.keys(commRegFields), ...additionalColumns]
        }).run().each(result => _processSavedSearchResults(data, result));

        return data;
    }
}

function _processSavedSearchResults(data, result) {
    let tmp = {};
    tmp['internalid'] = result.id;
    for (let column of result['columns']) {
        let columnName = [...(column.join ? [column.join] : []), column.name].join('.');
        tmp[columnName] = result['getValue'](column);
        tmp[columnName + '_text'] = result['getText'](column);
    }
    data.push(tmp);

    return true;
}

function _calculateServiceRates(customerId, commRegId) {
    let serviceChanges = sharedFunctions.getServiceChangesByFilters([
        ["custrecord_servicechg_comm_reg", "is", commRegId],
        "AND",
        ["custrecord_servicechg_status", "anyof", [1, 4]], // Scheduled (1) or Quote (4)
        "AND",
        ["isinactive", "is", false],
    ]);
    let assignedServices = sharedFunctions.getServicesByFilters([
        ["custrecord_service_customer", "is", customerId],
        "AND",
        ["custrecord_service_category", "is", 1], // Service Category: Services (1)
        "AND",
        [
            ["isinactive", "is", false],
            "OR",
            ["internalid", "anyof", serviceChanges.map(item => item.custrecord_servicechg_service)]
        ],
    ]);
    let monthlyServiceRate = 0.0, monthlyExtraServiceRate = 0.0, monthlyReducedServiceRate = 0.0;
    let freqTerms = ['mon', 'tue', 'wed', 'thu', 'fri', 'adhoc'];

    [...serviceChanges, ...assignedServices].forEach(item => {
        let weeklyServiceRate = 0, weeklyExtraServiceRate = 0, weeklyReducedServiceRate = 0;
        let newPrice = parseFloat(item['custrecord_servicechg_new_price']) || parseFloat(item['custrecord_service_price']) || 0;

        freqTerms.forEach(term => {
            if (item['custrecord_service_day_' + term]) {
                weeklyServiceRate += newPrice;

                weeklyExtraServiceRate += ['Extra Service', 'Increase of Frequency'].includes(item['custrecord_servicechg_type']) ?
                    newPrice : 0;

                weeklyReducedServiceRate += ['Reduction of Service', 'Price Decrease', 'Decrease of Frequency'].includes(item['custrecord_servicechg_type']) ?
                    newPrice : 0;
            }
        });

        let monthlyRateServices = [30, 31, 32, 33, 34, 35, 36, 37, 38]; // Fixed Charge (30) and all NeoPost Packages

        // If this service type is Fixed Charge (30), we keep the rates as is
        // because Fixed Charge service's price is monthly rate instead of weekly rate.
        monthlyServiceRate += (monthlyRateServices.includes(parseInt(item['custrecord_service'])) || item['custrecord_service_day_adhoc'])
            ? newPrice : weeklyServiceRate * 4.25;
        monthlyExtraServiceRate += (monthlyRateServices.includes(parseInt(item['custrecord_service'])) && weeklyExtraServiceRate > 0)
            ? newPrice : weeklyExtraServiceRate * 4.25;
        monthlyReducedServiceRate += (monthlyRateServices.includes(parseInt(item['custrecord_service'])) && weeklyReducedServiceRate > 0)
            ? newPrice : weeklyReducedServiceRate * 4.25;
    })

    return {monthlyServiceRate, monthlyExtraServiceRate, monthlyReducedServiceRate};
}