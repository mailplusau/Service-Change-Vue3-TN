import { defineStore } from 'pinia';
import http from '@/utils/http.mjs';

const state = {
    id: null,
    role: null,
};

const getters = {
    isAdmin : state => [3, 1032].includes(state.role)
};

const actions = {
    async init() { // getCurrentUserDetails
        let {id, role} = await http.get('getCurrentUserDetails');

        this.id = parseInt(id);
        this.role = parseInt(role);
    }
};

export const useUserStore = defineStore('user', {
    state: () => state,
    getters,
    actions,
});
