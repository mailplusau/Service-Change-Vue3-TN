import { defineStore } from 'pinia';

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
};

const getters = {

};

const actions = {
    close() {
        this.maxWith = 500;
        this.title = '';
        this.body = '';
        this.busy = false;
        this.open = false;
        this.progress = -1;
        this.persistent = false;
        this.isError = false;
    },
    displayError(title, message, maxWith = 500) {
        this.maxWith = maxWith;
        this.title = title;
        this.body = message;
        this.busy = false;
        this.open = true;
        this.progress = -1;
        this.persistent = true;
        this.isError = true;
    },
    displayBusy(title, message, open = true, progress = -1, maxWith = 500) {
        this.maxWith = maxWith;
        this.title = title;
        this.body = message;
        this.busy = open;
        this.open = open;
        this.progress = progress;
        this.persistent = true;
        this.isError = false;
    },
    displayInfo(title, message, persistent = false, buttons = [], maxWith = 500) {
        this.maxWith = maxWith;
        this.title = title;
        this.body = message;
        this.busy = false;
        this.open = true;
        this.progress = -1;
        this.persistent = persistent;
        this.isError = false;
        this.buttons = buttons;
    },
};

export const useGlobalDialog = defineStore('global-dialog', {
    state: () => state,
    getters,
    actions,
});
