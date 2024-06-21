import { defineStore } from 'pinia';
import http from '@/utils/http.mjs';

const state = {
    id: null,
    role: null,
};

const getters = {

};

const actions = {
    async init() { // getCurrentUserDetails
        let {id, role} = await http.get('getCurrentUserDetails');

        this.id = id;
        this.role = role;
    }
};

export const useUserStore = defineStore('user', {
    state: () => state,
    getters,
    actions,
});
