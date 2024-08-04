import { defineStore } from 'pinia';
import {waitMilliseconds} from '@/utils/utils.mjs';

let fakeProgressInterval;
let elapsedTime = 0;

const state = {
    maxWith: 500,
    open: false,
    title: 'Default title',
    body: 'This is a global modal that will deliver notification on global level.',
    busy: false,
    progress: -1,
    persistent: true,
    isError: false,
    buttons: [],
    hideButtons: false,
    showProgressPercent: false,
};

const getters = {

};

const actions = {
    async close(waitBeforeClose = 500, completeMessage = '') {
        if (fakeProgressInterval) {
            clearInterval(fakeProgressInterval);
            fakeProgressInterval = null;
            elapsedTime = 0;
            this.progress = 100;
            this.body = completeMessage || this.body;

            await waitMilliseconds(waitBeforeClose);
        }

        this.open = false;
        await waitMilliseconds(200);
        _resetDialog(this);
    },
    completeProgress(completeMessage = '', persistent = false) {
        if (fakeProgressInterval) {
            clearInterval(fakeProgressInterval);
            fakeProgressInterval = null;
            elapsedTime = 0;
            this.progress = 100;
            this.body = completeMessage || this.body;
        }

        this.persistent = persistent;
        this.hideButtons = false;
    },
    displayError(title, message, maxWith = 500) {
        this.stopFakeProgress();
        this.maxWith = maxWith;
        this.title = title;
        this.body = message;
        this.busy = false;
        this.open = true;
        this.progress = -1;
        this.persistent = true;
        this.isError = true;
        this.hideButtons = false;
    },
    displayBusy(title, message, maxWith = 500) {
        this.stopFakeProgress();
        this.maxWith = maxWith;
        this.title = title;
        this.body = message;
        this.busy = true;
        this.open = true;
        this.progress = -1;
        this.persistent = true;
        this.isError = false;
        this.hideButtons = true;
    },
    displayInfo(title, message, persistent = false, buttons = [], maxWith = 500) {
        this.stopFakeProgress();
        this.maxWith = maxWith;
        this.title = title;
        this.body = message;
        this.open = true;
        this.busy = false;
        this.progress = -1;
        this.persistent = persistent;
        this.isError = false;
        this.buttons = buttons;
        this.hideButtons = false;
    },
    displayProgress(title, message, progress = -1, showProgressPercent = false, maxWith = 500, timeStep = 500, interval = 100) {
        this.displayBusy(title, message, maxWith);
        this.progress = progress;
        this.showProgressPercent = showProgressPercent;
        this.hideButtons = true;

        if (progress < 0) {
            fakeProgressInterval = setInterval(() => {
                elapsedTime += timeStep;
                this.progress = Math.atan(elapsedTime / 3e3) / (Math.PI / 2) * 100;
            }, interval);
        }
    },
    stopFakeProgress() {
        if (fakeProgressInterval) {
            clearInterval(fakeProgressInterval);
            fakeProgressInterval = null;
            elapsedTime = 0;
        }
    }
};

function _resetDialog(ctx) {
    ctx.maxWith = 500;
    ctx.title = '';
    ctx.body = '';
    ctx.busy = false;
    ctx.progress = -1;
    ctx.persistent = false;
    ctx.isError = false;
    ctx.hideButtons = false;
}

export const useGlobalDialog = defineStore('global-dialog', {
    state: () => state,
    getters,
    actions,
});
