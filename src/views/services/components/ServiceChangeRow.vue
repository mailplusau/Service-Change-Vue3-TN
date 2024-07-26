<script setup>
import { defineProps, computed } from 'vue';
import {useServiceStore} from '@/stores/services';

const serviceStore = useServiceStore();
const props = defineProps({
    rowInfo: {
        type: Object,
        required: true
    },
});
const AUDollar = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'AUD',
});
const { index, columns, item } = props.rowInfo;
const freqTerms = ['mon', 'tue', 'wed', 'thu', 'fri', 'adhoc'];
const serviceChange = computed(() => {
    let i = serviceStore.changes.all.findIndex(serviceChange => parseInt(serviceChange['custrecord_servicechg_service']) === parseInt(item['internalid']));

    return i >= 0 ? serviceStore.changes.all[i] : null;
})

function formatCurrency(value) {
    return AUDollar.format(value);
}

const priceCell = computed(() => {
    let priceDifference = parseFloat(serviceChange.value['custrecord_servicechg_new_price']) - parseFloat(serviceChange.value['custrecord_servicechg_old_price'] + '');
    return {
        color: priceDifference !== 0 ? 'font-weight-bold' : '',
        icon: priceDifference > 0 ? 'mdi-arrow-up-thin' : (priceDifference < 0 ? 'mdi-arrow-down-thin' : null),
        iconColor: priceDifference > 0 ? 'green' : 'red'
    }
})

function cancelServiceChange() {
    serviceStore.cancelChangesOfService(item['internalid']);
}

</script>

<template>
    <tr class="service-expanded-info text-grey-darken-2" v-if="serviceChange?.['custrecord_servicechg_date_ceased']">
        <td class="pl-7" :colspan="columns.length - 1">
            <v-icon class="mr-2">mdi-subdirectory-arrow-right</v-icon>
            <v-chip label color="red-darken-4" size="x-small">
                Marked for cancellation
            </v-chip>
        </td>
        <td class="text-end">
            <v-menu location="start">
                <template v-slot:activator="{ props }">
                    <v-btn v-bind="props" color="red" variant="outlined" size="x-small">Cancel</v-btn>
                </template>

                <v-card class="bg-primary">
                    <v-card-item class="text-subtitle-2 pb-0">
                        Cancel all pending changes for this service?
                    </v-card-item>
                    <v-card-actions>
                        <v-spacer></v-spacer>
                        <v-btn class="text-none" size="small" color="red" variant="elevated">No</v-btn>
                        <v-btn class="text-none" size="small" color="green" variant="elevated" @click="cancelServiceChange">Yes</v-btn>
                        <v-spacer></v-spacer>
                    </v-card-actions>
                </v-card>
            </v-menu>
        </td>
    </tr>
    <tr class="service-expanded-info text-grey-darken-2" v-else-if="item['isinactive']">
        <td class="pl-7" :colspan="columns.length">
            <v-icon class="mr-2">mdi-subdirectory-arrow-right</v-icon>
            <v-chip label color="green-darken-4" size="x-small">
                Extra Service
            </v-chip>
        </td>
    </tr>
    <tr class="service-expanded-info text-grey-darken-2" v-else-if="!!serviceChange">
        <td class="pl-7">
            <v-icon class="mr-2">mdi-subdirectory-arrow-right</v-icon>
            <v-chip label color="primary" size="x-small">
                {{ serviceChange['custrecord_servicechg_type'] }}
            </v-chip>
        </td>

        <td :class="'text-center ' + priceCell.color" style="font-size: 0.9em">
            <v-icon v-show="!!priceCell.icon" :color="priceCell.iconColor" size="large">{{priceCell.icon}}</v-icon>
            {{ formatCurrency(serviceChange['custrecord_servicechg_new_price']) }}
        </td>

        <template v-for="(term) in freqTerms">
            <td :class="item[`custrecord_service_day_${term}`] === serviceChange['custrecord_servicechg_new_freq_text'].toLowerCase().split(',').includes(term) ? 'opacity-40 text-center' : 'text-center'">
                <v-icon v-if="serviceChange['custrecord_servicechg_new_freq_text'].toLowerCase().split(',').includes(term)" color="green" size="small">mdi-check</v-icon>
                <v-icon v-else color="red" size="small">mdi-close</v-icon>
            </td>
        </template>

        <td class="text-end">
            <v-menu location="start">
                <template v-slot:activator="{ props }">
                    <v-btn v-bind="props" color="red" variant="outlined" size="x-small">Cancel</v-btn>
                </template>

                <v-card class="bg-primary">
                    <v-card-item class="text-subtitle-2 pb-0">
                        Cancel all pending changes for this service?
                    </v-card-item>
                    <v-card-actions>
                        <v-spacer></v-spacer>
                        <v-btn class="text-none" size="small" color="red" variant="elevated">No</v-btn>
                        <v-btn class="text-none" size="small" color="green" variant="elevated" @click="cancelServiceChange">Yes</v-btn>
                        <v-spacer></v-spacer>
                    </v-card-actions>
                </v-card>
            </v-menu>
        </td>
    </tr>
<!--    <tr>-->
<!--        <td :colspan="columns.length">{{ item }}</td>-->
<!--    </tr>-->
</template>

<style scoped>
.service-expanded-info {
    background: #c7d9c6;
    box-shadow: grey 0 0 5px inset;
    font-size: 12px;
}
</style>