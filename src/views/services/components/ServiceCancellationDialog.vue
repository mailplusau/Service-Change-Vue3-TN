<script setup>
import { computed } from 'vue';
import {useServiceStore} from '@/stores/services';
import {formatPrice, goToCustomerRecord} from '@/utils/utils.mjs';

const serviceStore = useServiceStore();
const service = computed(() => {
    let i = serviceStore.data.all.findIndex(item => parseInt(item['internalid']) === parseInt(serviceStore.serviceIdToCease));

    return i >= 0 ? serviceStore.data.all[i] : null;
});

const dialogOpen = computed({
    get() {
        return !!serviceStore.serviceIdToCease;
    },
    set(newValue) {
        if (!newValue) serviceStore.serviceIdToCease = null;
    }
});

const frequencyText = computed(() => {
    if (!service.value) return 'no service';

    let freqArray = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Adhoc']
        .map(item => service.value['custrecord_service_day_' + item.toLowerCase()] ? item : null)
        .filter(item => item);

    return freqArray.join(', ')
})

</script>

<template>
    <v-dialog v-model="dialogOpen" width="500">
        <v-card class="bg-background">
            <v-container>
                <v-row justify="center">
                    <v-col cols="auto"><v-icon size="x-large" color="red">mdi-alert-outline</v-icon></v-col>
                    <v-col cols="12">
                        <p v-if="service && service['isinactive']">The following service will be <b class="text-red">immediately removed</b> because it is a new service pending effective date:</p>
                        <p v-else>The following service will be <b class="text-red">cancelled</b> on effective date:</p>
                        <ul v-if="service" class="ml-5 my-2 text-body-2">
                            <li>Name: <b class="">{{service.custrecord_service_text}}</b></li>
                            <li>Price: <b class="">{{ formatPrice(service.custrecord_service_price) }}</b></li>
                            <li>
                                Customer: <a class="text-blue cursor-pointer font-weight-bold" @click="goToCustomerRecord(service.custrecord_service_customer)">
                                {{service.custrecord_service_customer_text}} <v-icon size="small">mdi-open-in-new</v-icon></a>
                            </li>
                            <li>Frequency: <b class="">{{frequencyText}}</b></li>
                            <li>Description: <span>{{service.custrecord_service_description}}</span></li>
                        </ul>
                        <p class="text-subtitle-1">Do you wish to proceed?</p>
                    </v-col>
                    <v-col cols="auto">
                        <v-btn size="small" variant="outlined" @click="dialogOpen = false">Abort</v-btn>
                    </v-col>
                    <v-col cols="auto">
                        <v-btn size="small" variant="elevated" color="red" @click="serviceStore.cancelService()">cancel this service</v-btn>
                    </v-col>
                </v-row>
            </v-container>
        </v-card>
    </v-dialog>
</template>

<style scoped>

</style>