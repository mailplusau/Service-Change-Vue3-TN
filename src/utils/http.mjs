import superagent from "superagent";
import { useGlobalDialog} from "@/stores/global-dialog.js";

/**
 * @param {Object} options - An object containing various options.
 * @param {string} options.script - The NetSuite ID of the script record.
 * @param {string} options.deploy - The NetSuite ID of the deployment record.
 * @returns {{essentialParams: {script: string, deploy: string}, baseUrl: string, postEndpoint: string}}
 * @private
 */
function _getURL(options) {
    let currentUrl = parent["getCurrentNetSuiteUrl"] ? parent.getCurrentNetSuiteUrl() : window.location.href;
    let [baseUrl, queryString] = currentUrl.split("?");
    const params = new Proxy(new URLSearchParams(`?${queryString}`), {
        get: (searchParams, prop) => searchParams.get(prop)
    });

    let essentialParams = { script: options?.script || params["script"], deploy: options?.deploy || params["deploy"] };
    let postEndpoint = baseUrl + "?" + new URLSearchParams(essentialParams).toString();

    return { baseUrl, essentialParams, postEndpoint };
}

export default {
    /**
     * @param {string} operation - The name of the method to call
     * @param {Object} [requestParams] - An object containing parameters for the method
     * @param {Object} [options={}] - An object containing various options.
     * @param {string} [options.script] - The NetSuite ID of the script record.
     * @param {string} [options.deploy] - The NetSuite ID of the deployment record.
     * @param {boolean} [options.noErrorPopup] - A flag that stops error from being displayed in a popup.
     */
    async get(operation, requestParams, options) {
        let { baseUrl, essentialParams } = _getURL(options);

        return new Promise((resolve, reject) => {
            superagent.get(baseUrl)
                .set("Content-Type", "application/json")
                .query({ ...essentialParams, requestData: JSON.stringify({ operation, requestParams }) })
                .end((err, res) => {
                    _handle(err, res, reject, resolve, options?.noErrorPopup);
                });
        });
    },
    /**
     * @param {string} operation - The name of the method to call
     * @param {Object} [requestParams] - An object containing parameters for the method
     * @param {Object} [options={}] - An object containing various options.
     * @param {string} [options.script] - The NetSuite ID of the script record.
     * @param {string} [options.deploy] - The NetSuite ID of the deployment record.
     * @param {boolean} [options.noErrorPopup] - A flag that stops error from being displayed in a popup.
     */
    async post(operation, requestParams, options) {
        let { postEndpoint } = _getURL(options);

        return new Promise((resolve, reject) => {
            superagent.post(postEndpoint)
                .set("Content-Type", "application/json")
                .set("Accept", "json")
                .send({ operation, requestParams })
                .end((err, res) => {
                    _handle(err, res, reject, resolve, options?.noErrorPopup);
                });
        });
    },
    /**
     * @param {string} url - The url of the endpoint
     * @param {Object} [params] - The search queries for this GET call
     * @param {Object} [options={}] - An object containing various options.
     * @param {boolean} [options.noErrorPopup] - A flag that stops error from being displayed in a popup.
     */
    rawGet(url, params, options) {
        return new Promise((resolve, reject) => {
            superagent.get(url)
                .set("Content-Type", "application/json")
                .query(params)
                .end((err, res) => {
                    _handle(err, res, reject, resolve, options?.noErrorPopup);
                });
        });
    }
};

/**
 * @param err
 * @param res
 * @param reject
 * @param resolve
 * @param {boolean} [noErrorPopup=false]
 * @private
 */
function _handle(err, res, reject, resolve, noErrorPopup = false) {
    let errorMessage = err || (res.body?.error || null);
    const globalDialog = useGlobalDialog();

    if (errorMessage) {
        if (!noErrorPopup) globalDialog.displayError("An error occurred", errorMessage);

        reject(errorMessage);
    } else resolve(res.body);
}