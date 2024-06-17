/**
 * @author Tim Nguyen
 * @description NetSuite-hosted Page - Service Change
 * @NApiVersion 2.1
 * @NScriptType ClientScript
 * @created 17/06/2024
 */

let modules = {};

const moduleNames = ['error', 'runtime', 'search', 'record', 'url', 'format', 'email', 'currentRecord'];

// eslint-disable-next-line no-undef
define(moduleNames.map(item => 'N/' + item), (...args) => {
        for (let [index, moduleName] of moduleNames.entries())
            modules[moduleName] = args[index];

        function pageInit() {
            console.log('Client script init.');
            document.querySelector('h1.uir-record-type').innerHTML = 'Loading page. Please wait...';

            let baseUrl = getCurrentNetSuiteUrl().split('?')[0];
            const params = new Proxy(new URLSearchParams(window.location.search), {
                get: (searchParams, prop) => searchParams.get(prop),
            });

            const paramsBuilder = new URLSearchParams({
                script: params['script'], deploy: params['deploy'],
                requestData: JSON.stringify({operation: 'getIframeContents'}),
            });

            fetch(baseUrl + '?' + paramsBuilder.toString(), {
                method: 'get'
            })
                .then(res => res.json())
                .then(jsonData => {
                    let iframe = document.createElement('iframe');
                    iframe.id = 'body';
                    iframe.srcdoc = jsonData;
                    iframe.style.setProperty('border', 'none');
                    document.querySelector('div#body').parentNode.insertBefore(iframe, null);
                    document.querySelector('div#body').remove();
                    setMPTheme();
                })
                .catch(err => {
                    console.log(err);
                });
        }

        return { pageInit };
    }
);

// eslint-disable-next-line no-unused-vars
function _getClientModules() {
    return modules;
}

function setMPTheme(pageTitle = '') {
    if (pageTitle) document.title = pageTitle;
}

function getCurrentNetSuiteUrl() {
    return location.href
}