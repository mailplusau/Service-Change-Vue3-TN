import { defineStore } from 'pinia';
import http from '@/utils/http.mjs';

const state = {
    id: 1732844,
    role: null,
};

const getters = {
    isAdmin : state => [3, 1032].includes(state.role),
    isMe : state => state.id === 1732844,
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
