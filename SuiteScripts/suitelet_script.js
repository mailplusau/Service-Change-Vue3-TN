/**
 * @author Tim Nguyen
 * @description NetSuite-hosted Page - Service Change
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @created 17/06/2024
 */

import {serviceChangeDefaults, serviceFieldIds, VARS} from '@/utils/utils.mjs';

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
            } else {
                log.debug({
                    title: "request method type",
                    details: `method : ${request.method}`,
                });
            }

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
                    htmlPageData[resultSet.getValue({ name: 'name' })] = {
                        url: resultSet.getValue({ name: 'url' }),
                        id: resultSet.id
                    };
                    return true;
                });

                return htmlPageData;
            },
            handleGETRequests(request, response) {
                if (!request) return false;

                let {log} = NS_MODULES;

                try {
                    let {operation, requestParams} = JSON.parse(request);

                    if (!operation) throw 'No operation specified.';

                    if (operation === 'getIframeContents') this.getIframeContents(response);
                    else if (!getOperations[operation]) throw `GET operation [${operation}] is not supported.`;
                    else getOperations[operation](response, requestParams);
                } catch (e) {
                    log.debug({title: "_handleGETRequests", details: `error: ${e}`});
                    _writeResponseJson(response, {error: `${e}`})
                }

                return true;
            },
            handlePOSTRequests({operation, requestParams}, response) {
                let {log} = NS_MODULES;

                try {
                    if (!operation) throw 'No operation specified.';

                    // _writeResponseJson(response, {source: '_handlePOSTRequests', operation, requestParams});
                    postOperations[operation](response, requestParams);
                } catch (e) {
                    log.debug({title: "_handlePOSTRequests", details: `error: ${e}`});
                    _writeResponseJson(response, {error: `${e}`})
                }
            },
            getIframeContents(response) {
                const htmlFileData = this.getHtmlTemplate(htmlTemplateFilename);
                const htmlFile = NS_MODULES.file.load({ id: htmlFileData[htmlTemplateFilename].id });

                _writeResponseJson(response, htmlFile['getContents']());
            }
        }

        return {onRequest};
    });

function _writeResponseJson(response, body) {
    response.write({ output: JSON.stringify(body) });
    response.addHeader({
        name: 'Content-Type',
        value: 'application/json; charset=utf-8'
    });
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
    'getCommencementRegister' : function (response, {commRegId, fieldIds}) {
        let {record} = NS_MODULES;
        let data = {};

        let commRegRecord = record.load({
            type: 'customrecord_commencement_register',
            id: commRegId,
        });

        for (let fieldId of fieldIds) {
            data[fieldId] = commRegRecord.getValue({fieldId});
            data[fieldId + '_text'] = commRegRecord.getText({fieldId});
        }

        _writeResponseJson(response, data);
    },
    'getCommRegFromSalesRecordId' : function (response, {salesRecordId, fieldIds}) {
        let {search} = NS_MODULES;
        let data = [];

        search.create({
            type: 'customrecord_commencement_register',
            filters: [
                ['custrecord_commreg_sales_record', 'is', salesRecordId], 'AND',
                ['custrecord_trial_status', 'anyof', [9, 10]], // Scheduled (9) or Quote (10)
            ],
            columns: fieldIds
        }).run().each(result => _processSavedSearchResults(data, result));

        _writeResponseJson(response, data); // return the first result
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
        let serviceChangeFields = {...serviceChangeDefaults};
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
    'createCommencementRegister' : function(response, {customerId, salesRecordId, saleTypeId, commRegStatus, commencementDate, trialEndDate, signupDate}) {
        let {record, runtime} = NS_MODULES;
        let userId = runtime['getCurrentUser']().id;
        let userRole = runtime['getCurrentUser']().role;
        let customerRecord = record.load({type: 'customer', id: customerId});
        let partnerId = parseInt(customerRecord.getValue({fieldId: 'partner'}));
        let partnerRecord = record.load({type: 'partner', id: partnerId});
        let state = partnerRecord.getValue({fieldId: 'location'});

        let commRegRecord = record.create({type: 'customrecord_commencement_register'});

        commRegRecord.setValue({fieldId: 'custrecord_date_entry', value: new Date(signupDate)});
        commRegRecord.setValue({fieldId: 'custrecord_comm_date', value: new Date(commencementDate)});
        commRegRecord.setValue({fieldId: 'custrecord_comm_date_signup', value: new Date(signupDate)});
        commRegRecord.setValue({fieldId: 'custrecord_customer', value: customerId});
        commRegRecord.setValue({fieldId: 'custrecord_salesrep', value: userId});
        commRegRecord.setValue({fieldId: 'custrecord_std_equiv', value: 1}); // Standard Equivalent
        commRegRecord.setValue({fieldId: 'custrecord_wkly_svcs', value: '5'}); // Weekly Services
        commRegRecord.setValue({fieldId: 'custrecord_in_out', value: 2}); // Inbound
        commRegRecord.setValue({fieldId: 'custrecord_state', value: state});
        commRegRecord.setValue({fieldId: 'custrecord_trial_status', value: commRegStatus}); // Quote (10) or Scheduled (9)
        commRegRecord.setValue({fieldId: 'custrecord_sale_type', value: saleTypeId});

        if (trialEndDate && isoStringRegex.test(trialEndDate))
            commRegRecord.setValue({fieldId: 'custrecord_trial_expiry', value: new Date(trialEndDate)});

        if (userRole !== 1000) commRegRecord.setValue({fieldId: 'custrecord_franchisee', value: partnerId});
        if (salesRecordId) commRegRecord.setValue({fieldId: 'custrecord_commreg_sales_record', value: salesRecordId});

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
    'updateTrialEndDate' : function (response, {commRegId, trialEndDate}) {
        if (!isoStringRegex.test(trialEndDate)) throw `Effective date [${trialEndDate}] is not a valid date`;
        if (!commRegId) throw `Commencement Register ID not specified`;

        trialEndDate = new Date(trialEndDate);
        let {record} = NS_MODULES;
        let serviceChanges = sharedFunctions.getServiceChangesByFilters([
            ["custrecord_servicechg_comm_reg", "is", commRegId],
            "AND",
            ["custrecord_servicechg_status", "anyof", [1, 4]], // Scheduled (1) or Quote (4)
            "AND",
            ["isinactive", "is", false],
        ]);

        serviceChanges.forEach(item => {
            record['submitFields']({type: 'customrecord_servicechg', id: item.internalid, values: {'custrecord_trial_end_date': trialEndDate}});
        });

        record['submitFields']({type: 'customrecord_commencement_register', id: commRegId, values: {'custrecord_trial_expiry': trialEndDate}});

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

        for (let key in serviceChangeDefaults) serviceChangeFieldIds.push(key);

        NS_MODULES.search.create({
            type: "customrecord_servicechg",
            filters,
            columns: serviceChangeFieldIds
        }).run().each(result => _processSavedSearchResults(data, result));

        return data;
    }
}

function _processSavedSearchResults(data, result) {
    let tmp = {};
    for (let column of result['columns']) {
        tmp[column.name] = result['getValue'](column);
        tmp[column.name + '_text'] = result['getText'](column);
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