<script setup>
import {computed} from 'vue';
import ServiceChangeRow from '@/views/services/components/ServiceChangeRow.vue';
import {useServiceStore} from '@/stores/services';
import ServiceChangeDialog from '@/views/services/components/ServiceChangeDialog.vue';
import DatePicker from '@/components/shared/DatePicker.vue';
import ServiceCancellationDialog from '@/views/services/components/ServiceCancellationDialog.vue';
import {useMainStore} from '@/stores/main';
import ServiceFinalisationDialog from '@/views/services/components/ServiceFinalisationDialog.vue';
import {useUserStore} from '@/stores/user';
import {useCommRegStore} from '@/stores/comm-reg';
import {formatDate} from '../../utils/utils.mjs';

const userStore = useUserStore();
const serviceStore = useServiceStore();
const mainStore = useMainStore();
const commRegStore = useCommRegStore();
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

function closeParentDialog() {
    if (parent['closeServiceAndPriceDialog']) parent['closeServiceAndPriceDialog']();
}

const dataLoading = computed(() => serviceStore.data.loading)
const minEffectiveDate = computed(() => userStore.isAdmin ? '' : (new Date()).toISOString())
const minTrialExpiryDate = computed(() => {
    if (userStore.isAdmin || Object.prototype.toString.call(serviceStore.globalTrialEndDate) !== '[object Date]') return '';

    let minDate = new Date(serviceStore.globalTrialEndDate['toISOString']())
    minDate.setDate(minDate.getDate() + 5);

    return minDate.toISOString();
})
</script>

<template>
    <v-container fluid>
        <v-row justify="center">
            <v-col xl="6" lg="8" md="10" cols="12">

                <v-toolbar class="elevation-5 bg-primary" density="compact" :extended="!!serviceStore.globalTrialEndDate">
                    <span class="ml-4 mr-1">Effective Date:</span>
                    <span v-if="dataLoading" class="cursor-pointer text-secondary">--/--/--</span>
                    <DatePicker v-else v-model="serviceStore.globalEffectiveDate" readonly title="Global Effective Date"
                                @date-changed="serviceStore.handleEffectiveDateChanged()" :min="minEffectiveDate">
                        <template v-slot:activator="{ activatorProps, displayDate, readonly }">
                            <span v-bind="activatorProps" class="cursor-pointer text-secondary" title="Click to edit">{{ displayDate }}
                                <v-icon size="x-small" class="mb-1">mdi-pencil</v-icon>
                            </span>
                        </template>
                    </DatePicker>

                    <v-spacer></v-spacer>

                    <v-btn @click="serviceStore.openServiceChangeDialog()" class="mr-2" :disabled="dataLoading"
                           color="green" size="small" variant="elevated">Add Service</v-btn>

                    <v-btn v-if="mainStore.standaloneMode" @click="closeParentDialog" class="mr-2" :disabled="dataLoading"
                           color="green" size="small" variant="elevated">Done & Close</v-btn>

                    <ServiceFinalisationDialog v-else>
                        <template v-slot:activator="{ activatorProps }">
                            <v-btn v-bind="activatorProps" class="mr-2" color="green" size="small" variant="elevated" :disabled="dataLoading">
                                Proceed <v-icon>mdi-chevron-right</v-icon>
                            </v-btn>
                        </template>
                    </ServiceFinalisationDialog>

                    <template v-slot:extension v-if="!!serviceStore.globalTrialEndDate">
                        <span class="ml-4 mr-1">Trial Expiry Date:</span>
                        <DatePicker v-model="serviceStore.globalTrialEndDate" readonly title="Trial Expiry Date" :disabled="dataLoading"
                                    @date-changed="serviceStore.handleTrialEndDateChanged()" :min="minTrialExpiryDate">
                            <template v-slot:activator="{ activatorProps, displayDate, readonly }">
                                <span v-bind="activatorProps" class="cursor-pointer text-secondary" title="Click to edit">{{ displayDate }}
                                    <v-icon size="x-small" class="mb-1">mdi-pencil</v-icon>
                                </span>
                            </template>
                        </DatePicker>

                        <v-divider vertical class="ml-5"></v-divider>

                        <span class="ml-4 mr-1">Billing Date:</span>
                        <span class="text-secondary">
                            {{ commRegStore.details.custrecord_bill_date ? formatDate(new Date(commRegStore.details.custrecord_bill_date)) : 'Commencement Register not created' }}
                        </span>
                    </template>
                </v-toolbar>

                <v-data-table class="elevation-5 bg-background" hide-default-footer
                              item-value="internalid" hover density="compact"
                              :headers="headers"
                              :items="serviceStore.data.all"
                              :items-per-page="-1"
                              :cell-props="{ class: 'cell-text-size' }"
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
                        <v-btn icon="mdi-pencil" size="x-small" variant="text" class="ml-1" color="primary"
                               v-if="!serviceStore.serviceMarkedForCancellation(item.internalid)"
                               @click="serviceStore.openServiceChangeDialog(item.internalid)"></v-btn>
                        <v-btn icon="mdi-trash-can" size="x-small" variant="text" class="ml-1" color="red"
                               v-if="!serviceStore.serviceMarkedForCancellation(item.internalid)"
                               @click="serviceStore.serviceIdToCease = item.internalid"></v-btn>
                    </template>

                </v-data-table>

            </v-col>
        </v-row>

        <v-row v-if="userStore.isMe">
            <p>Comm Reg ID: [{{commRegStore.id}}]</p>
        </v-row>

        <ServiceChangeDialog />
        <ServiceCancellationDialog />
    </v-container>
</template>

<style scoped>

</style>