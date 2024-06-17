/**
 * @author Tim Nguyen
 * @description NetSuite-hosted Page - Service Change
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @created 17/06/2024
 */

import {VARS} from '@/utils/utils.mjs';

// These variables will be injected during upload. These can be changed under 'netsuite' of package.json
let htmlTemplateFilename/**/;
let clientScriptFilename/**/;

const defaultTitle = VARS.pageTitle;

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

}

const postOperations = {
    'verifyParameters' : function (response, {customerId, salesRecordId = null} = {}) {
        let {record, runtime} = NS_MODULES;

        if (salesRecordId) {
            let salesRecord = record.load({type: 'customrecord_sales', id: salesRecordId, isDynamic: true});

            if (parseInt(salesRecord.getValue({fieldId: 'custrecord_sales_customer'})) === parseInt(customerId))
                _writeResponseJson(response, {
                    customerId: parseInt(customerId),
                    salesRecordId: parseInt(salesRecordId),
                    userId: runtime['getCurrentUser']().id,
                    userRole: runtime['getCurrentUser']().role,
                });
            else _writeResponseJson(response, {error: `IDs mismatched. Sales record #${salesRecordId} does not belong to customer #${customerId}.`});
        } else _writeResponseJson(response, {
            customerId: parseInt(customerId),
            salesRecordId: null,
            userId: runtime['getCurrentUser']().id,
            userRole: runtime['getCurrentUser']().role,
        });
    },
};