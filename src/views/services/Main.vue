<script setup>
import {computed, ref} from 'vue';
import ServiceChangeRow from '@/views/services/components/ServiceChangeRow.vue';
import {useServiceStore} from '@/stores/services';
import ServiceChangeDialog from '@/views/services/components/ServiceChangeDialog.vue';
import DatePicker from '@/components/shared/DatePicker.vue';

const serviceStore = useServiceStore();
const AUDollar = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'AUD',
});

const expanded = computed(() => [...serviceStore.data.all.map(item => item.internalid)])
const freqTerms = ['mon', 'tue', 'wed', 'thu', 'fri', 'adhoc'];
const headers = [
    {value: 'custrecord_service_text', title: 'Service', sortable: false, align: 'start'},
    {value: 'custrecord_service_price', title: 'Price', sortable: false, align: 'center'},

    {value: 'custrecord_service_day_mon', title: 'MON', sortable: false, align: 'center'},
    {value: 'custrecord_service_day_tue', title: 'TUE', sortable: false, align: 'center'},
    {value: 'custrecord_service_day_wed', title: 'WED', sortable: false, align: 'center'},
    {value: 'custrecord_service_day_thu', title: 'THU', sortable: false, align: 'center'},
    {value: 'custrecord_service_day_fri', title: 'FRI', sortable: false, align: 'center'},
    {value: 'custrecord_service_day_adhoc', title: 'Adhoc', sortable: false, align: 'center'},

    {value: 'actions', title: '', sortable: false, align: 'end'},
]

function formatCurrency(value) {
    return AUDollar.format(value);
}
</script>

<template>
    <v-container fluid>
        <v-row justify="center">
            <v-col cols="12">

                <v-toolbar class="elevation-5 bg-primary" density="compact">
                    <v-toolbar-title style="flex: none" class="text-subtitle-1">
                        Effective Date:
                        <DatePicker v-model="serviceStore.globalEffectiveDate" readonly title="Global Effective Date"
                                    @date-changed="serviceStore.handleEffectiveDateChanged()">
                            <template v-slot:activator="{ activatorProps, displayDate, readonly }">
                                <span v-bind="activatorProps" class="cursor-pointer text-secondary">{{ displayDate }}</span>
                            </template>
                        </DatePicker>
                    </v-toolbar-title>

                    <v-divider vertical class="ml-5"></v-divider>

                    <v-toolbar-title style="flex: none" class="text-subtitle-1" v-if="false">
                        Trial Expiry Date:
                        <DatePicker v-model="serviceStore.globalTrialEndDate" readonly title="Trial Expiry Date"
                                    @date-changed="serviceStore.handleTrialEndDateChanged()">
                            <template v-slot:activator="{ activatorProps, displayDate, readonly }">
                                <span v-bind="activatorProps" class="cursor-pointer text-secondary">{{ displayDate }}</span>
                            </template>
                        </DatePicker>
                    </v-toolbar-title>

                    <v-spacer></v-spacer>

                    <v-btn @click="serviceStore.openServiceChangeDialog()" class="mr-2"
                           color="green" size="small" variant="elevated">Add Service</v-btn>
                </v-toolbar>

                <v-data-table
                    class="elevation-5 bg-background"
                    :headers="headers"
                    :items="serviceStore.data.all"
                    :items-per-page="-1"
                    hide-default-footer
                    item-value="internalid"
                    :cell-props="{ class: 'cell-text-size' }"
                    hover density="compact"
                    :loading="serviceStore.data.loading"
                    v-model:expanded="expanded">

                    <template v-slot:[`item.custrecord_service_text`]="{ item }">
                        <b class="primary-text">{{ item.custrecord_service_text }}</b>
                    </template>

                    <template v-slot:[`item.custrecord_service_price`]="{ item }">
                        {{ formatCurrency(item.custrecord_service_price) }}
                    </template>

                    <template v-for="term in freqTerms" v-slot:[`item.custrecord_service_day_${term}`]="{ item }">
                        <v-icon :color="item[`custrecord_service_day_${term}`] ? 'green' : 'red'" size="small">
                            {{ item[`custrecord_service_day_${term}`] ? 'mdi-check' : 'mdi-close'}}
                        </v-icon>
                    </template>

                    <template v-slot:expanded-row="rowInfo">
                        <ServiceChangeRow :row-info="rowInfo" />
                    </template>

                    <template v-slot:[`item.actions`]="{ item }">
                        <v-btn icon="mdi-pencil" size="x-small" variant="text" class="mx-1" color="primary"
                               @click="serviceStore.openServiceChangeDialog(item.internalid)"></v-btn>
                        <v-btn icon="mdi-trash-can" size="x-small" variant="text" class="mx-1" color="red"
                               @click="serviceStore.serviceIdToCease = item.internalid"></v-btn>
                    </template>

                </v-data-table>

            </v-col>
        </v-row>

        <ServiceChangeDialog />
    </v-container>
</template>

<style scoped>

</style>