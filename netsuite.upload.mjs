import parseImports from 'parse-imports'
import superagent from 'superagent';
import fs from 'fs';
import crypto from "crypto";
import path from 'path';
import OAuth from "oauth-1.0a";
import compareVersions from "compare-versions";
import url from "url";
import {} from 'dotenv/config'

// A roundabout way to use require() so that we can read package.json file
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const packageJson = require("./package.json");

// This is so that we can have __dirname like CommonJS
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BAD_VERSION_ERROR = {
    shortMsg: "You might need to update the vscodeExtensionRestlet.js RESTlet in NetSuite to the latest version."
};

let config = {
    authentication: process.env.VITE_NS_AUTHENTICATION,
    restlet: process.env.VITE_NS_RESTLET_URL,
    tempFolder: '',
    rootDirectory: '',
    netSuiteKey: process.env.VITE_NS_KEY,
    netSuiteSecret: process.env.VITE_NS_SECRET,
    consumerToken: process.env.VITE_NS_CONSUMER_TOKEN,
    consumerSecret: process.env.VITE_NS_CONSUMER_SECRET,
    realm: process.env.VITE_NS_REALM,
}


function getRelativePath(absFilePath) {
    let rootDirectory = config.rootDirectory;
    if (rootDirectory) {
        return path.join(rootDirectory, path.basename(absFilePath));
    } else {
        return path.join('SuiteScripts', path.basename(absFilePath));
    }
}

function getAuthHeader(method, data) {
    let nlAuth = config.authentication;
    let netSuiteOAuthKey = config.netSuiteKey;

    if (nlAuth && nlAuth.length > 0) {
        return config.authentication;
    }
    if (netSuiteOAuthKey && netSuiteOAuthKey.length > 0) {
        const opts = {
            consumer: {
                key: config.consumerToken,
                secret: config.consumerSecret
            },
            signature_method: 'HMAC-SHA256',
            realm: config.realm,
            hash_function: function (base_string, key) {
                return crypto.createHmac('sha256', key).update(base_string).digest('base64');
            }
        };

        const oauth = OAuth(opts);

        let token = {
            key: config.netSuiteKey,
            secret: config.netSuiteSecret
        };
        let restletUrl = config.restlet;
        let url_parts = url.parse(restletUrl, true);

        // Build up the data payload to sign.
        // qs will contain the script and deploy params.
        let qs = url_parts.query;
        let mergedData;
        if (method === 'GET' || method === 'DELETE') {
            // For GETs and DELETES, data ends up in the querystring.
            Object.assign(qs, data);
            mergedData = qs;
        } else {
            // for POSTs and DELETEs, the data isn't in the querystring
            // so we don't need it in the oauth signature.
            mergedData = qs;
        }
        let header = oauth.toHeader(oauth.authorize({
            method: method,
            url: restletUrl,
            data: mergedData
        }, token));

        return header.Authorization;
    }

    throw "No authentication method found in settings.json (user or workspace settings).";
}

function getRestletVersion(callback) {
    let data = {
        type: "version"
    };
    superagent.get(config.restlet)
        .set("Content-Type", "application/json")
        .set("Authorization", getAuthHeader('GET', data))
        .query(data)
        .end((err, res) => {
            callback(err, res);
        });
}

function doesRestletNeedUpdating(needsUpdating) {
    getRestletVersion((err, res) => {
        if (err || (compareVersions(res.body.restletVersion, "1.0.2") === -1)) {
            needsUpdating(true, err);
        } else {
            needsUpdating(false, err);
        }
    });
}

function postFile(filePath, content, callback) {
    postData('file', filePath, content, callback);
}

function postData(type, objectPath, content, callback) {
    doesRestletNeedUpdating(function (needsUpdating, err) {
        if (needsUpdating) {
            callback(BAD_VERSION_ERROR, err);
            return;
        }

        let relativeName = getRelativePath(objectPath);
        let data = {
            type: type,
            name: relativeName,
            content: content
        };
        superagent.post(config.restlet)
            .set("Content-Type", "application/json")
            .set("Authorization", getAuthHeader('POST', data))
            .send(data)
            .end((err, res) => {
                callback(err, res);
            });
    });
}

function hasNetSuiteError(customMsg, err, response) {
    if (err) {
        let get = function (obj, key) {
            return key.split('.').reduce(function (o, x) {
                return (typeof o == 'undefined' || o === null) ? o : o[x];
            }, obj);
        };

        let errorDetails;
        if (response && get(response, 'status') === 403) { // Forbidden. Bad Auth.
            errorDetails = [
                'AUTHENTICATION FAILED!',
                'HTTP Status: 403',
                'HTTP Error: ' + get(response, 'message'),
                'Local Stack:',
                get(response, 'stack')
            ];
        } else if (err.shortMsg) {
            // We passed in a simple, short message which is all we need to display.
            errorDetails = [err.shortMsg];

        } else if (response && response.body && response.body.error) {
            // The body of the response may contain a JSON object containing a NetSuite-specific
            // message. We'll parse and display that in addition to the HTTP message.
            try {

                let nsErrorObj = JSON.parse(response.body.error.message);

                if (nsErrorObj.name === 'SSS_MISSING_REQD_ARGUMENT') {
                    customMsg += ' NetSuite N/file module does not allow storing an empty file.';
                }

                errorDetails = [
                    'NetSuite Error Details:',
                    get(nsErrorObj, 'type'),
                    get(nsErrorObj, 'name'),
                    get(nsErrorObj, 'message'),
                    get(nsErrorObj, 'code'),
                    'Remote Stack:',
                    get(nsErrorObj, 'stack'),
                    'HTTP Status: ' + get(err, 'status'),
                    'HTTP Error: ' + get(err, 'message'),
                    'Local Stack:',
                    get(err, 'stack')
                ];
            } catch (e) {
                // Response body error does not contain a JSON message.
                errorDetails = [
                    'NetSuite Error Details:',
                    'NS Error: ' + get(response.body.error, 'code'),
                    'NS Message: ' + get(response.body.error, 'message'),
                    'HTTP Status: ' + get(err, 'status'),
                    'HTTP Error: ' + get(err, 'message'),
                    'Local Stack:',
                    get(err, 'stack')
                ];
            }
        } else {
            errorDetails = [
                'Unknown Error:',
                'HTTP Status: ' + get(err, 'status'),
                'HTTP Error: ' + get(err, 'message'),
                'Local Stack:',
                get(err, 'stack')
            ];
        }

        // Pre-pend the customMsg and our own message.
        errorDetails.unshift(customMsg);
        errorDetails.push('Use Help…Toggle Developer Tools and choose the Console tab for a better formatted error message.');
        console.log(errorDetails.join('\n'));

        return true;
    }
    return false;
}

function injectEnvVariables(fileContent) {
    for (let prop in process.env) {
        if (Object.prototype.hasOwnProperty.call(process.env, prop) && prop.indexOf('VITE_') > -1) {
            fileContent = fileContent.replaceAll(`import.meta.env.${prop}`, `"${process.env[prop]}"`)
        }
    }

    return fileContent;
}

function replaceBetween(original, start, end, what) {
    return original.substring(0, start) + what + original.substring(end);
}

function resolveFilename(filePath, fileContent) {
    const nameTransformationTable = {
        "suitelet_script.js": packageJson.netsuite['suiteletFilename']
            || `mp_sl_${packageJson.netsuite.projectName}_${packageJson.netsuite.suffixName}.js`,
        "client_script.js": packageJson.netsuite['clientFilename']
            || `mp_cl_${packageJson.netsuite.projectName}_${packageJson.netsuite.suffixName}.js`,
        "scheduled_script.js": packageJson.netsuite['scheduledScriptName']
            || `mp_sc_${packageJson.netsuite.projectName}_${packageJson.netsuite.suffixName}.js`,
        "mare_script.js": packageJson.netsuite['mapReduceScriptName']
            || `mp_mr_${packageJson.netsuite.projectName}_${packageJson.netsuite.suffixName}.js`,
    };

    const variableTransformationTable = {
        "var htmlTemplateFilename;": `var htmlTemplateFilename = '${getHtmlFilename()}';`,
        "var clientScriptFilename;": `var clientScriptFilename = '${nameTransformationTable['client_script.js']}';`
    };

    for (let filename in nameTransformationTable) filePath = filePath.replace(filename, nameTransformationTable[filename]);
    for (let variable in variableTransformationTable) fileContent = fileContent.replace(variable, variableTransformationTable[variable]);

    return {filePath, fileContent};
}

function getHtmlFilename() {
    return packageJson.netsuite['htmlFilename'] || `mp_cl_${packageJson.netsuite.projectName}_${packageJson.netsuite.suffixName}.html`
}

(async () => {
    let filePathLocal;
    if (!process.argv[2]) filePathLocal = path.resolve(__dirname, 'dist/index.html');
    else filePathLocal = path.resolve(__dirname, process.argv[2]);

    if (fs.existsSync(filePathLocal)) {
        let fileContent = fs.readFileSync(filePathLocal, 'utf8');

        if (process.argv.includes('resolve:dependencies')) {
            const result = require("esbuild").buildSync({
                entryPoints: [filePathLocal],
                target: [`node16`],
                platform: 'node',
                format: 'esm',
                bundle: true,
                write: false,
                alias: {
                    '@': './src',
                },
            })

            fileContent = fileContent.substring(0, fileContent.indexOf(' */') + 5) + '\r\n' + result['outputFiles'][0].text;
            fileContent = injectEnvVariables(fileContent);
        }

        let filePathNetSuite = filePathLocal;

        if (!process.argv[2]) // no file name argument, we're uploading the index.html file
            filePathNetSuite = filePathNetSuite.replace('index.html', getHtmlFilename());

        if (process.argv.includes('resolve:filenames')) {
            let tmp = resolveFilename(filePathLocal, fileContent);
            filePathNetSuite = tmp.filePath;
            fileContent = tmp.fileContent;
        }

        postFile(filePathNetSuite, fileContent, function (err, res) {
            console.log('Uploading file ' + filePathNetSuite + ' to NetSuite cabinet...');
            if (hasNetSuiteError('ERROR uploading file.', err, res)) return;

            console.info('Upload successful!');
        });
    } else console.log('File does not exist', filePathLocal);
})();