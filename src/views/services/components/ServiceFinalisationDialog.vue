<script setup>
import {computed, ref} from 'vue';
import {useMainStore} from '@/stores/main';
import {useGlobalDialog} from '@/stores/global-dialog';
import {getWindowContext} from '@/utils/utils.mjs';
import http from '@/utils/http.mjs';
import {useCustomerStore} from '@/stores/customer';
import {useSalesRecordStore} from '@/stores/sales-record';

const baseUrl = 'https://' + import.meta.env.VITE_NS_REALM + '.app.netsuite.com';
const globalDialog = useGlobalDialog();
const dialogOpen = ref(false);
const nextPageToProceed = computed(() => {
    return 'Finalisation Page';
})

async function goToNextPage() {
    globalDialog.displayBusy('Redirecting', `Moving to <b>${nextPageToProceed.value}</b>. Please wait...`)

    getWindowContext().location.href = baseUrl + await http.get('getScriptUrl', {
        scriptId: 'customscript_sl_finalise_page_tn_v2_vue',
        deploymentId: 'customdeploy_sl_finalise_page_tn_v2_vue',
        params: {
            recid: useCustomerStore().id,
            sales_record_id: useSalesRecordStore().id,
        }
    });

    globalDialog.close();
}
</script>

<template>
    <v-dialog v-model="dialogOpen" width="400">
        <template v-slot:activator="{ props: activatorProps }">
            <slot name="activator" :activatorProps="activatorProps"></slot>
        </template>

        <v-card class="bg-background">
            <v-card-title>
                Ready to proceed?
            </v-card-title>

            <v-card-text>
                If you are ready to continue with the process, this dialog will take you to <b class="text-red">{{ nextPageToProceed }}</b>.
            </v-card-text>

            <v-card-actions>
                <v-btn class="mx-3" @click="dialogOpen = false" variant="text">
                    Cancel
                </v-btn>

                <v-spacer></v-spacer>

                <v-btn color="success darken-1" variant="elevated" class="mx-3" @click="goToNextPage">
                    Proceed
                </v-btn>
            </v-card-actions>

        </v-card>
    </v-dialog>
</template>

<style scoped>

</style>