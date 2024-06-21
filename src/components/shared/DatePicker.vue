<script setup>
import {ref, defineModel, onMounted, computed, onBeforeMount, watch} from "vue";
const model = defineModel({
    required: true,
});
const props = defineProps({
    readonly: {
        type: Boolean,
        default: false,
    },
    title: {
        type: String,
        default: 'Select a date'
    }
})
const dialogOpen = ref(false);
const selectedDate = ref();

const dateFormat = new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'full',
    timeZone: 'Australia/Sydney',
});

function update() {
    model.value = selectedDate.value;
    dialogOpen.value = false;
}

watch(dialogOpen, (val) => {
    if (val) selectedDate.value = model.value;
})

const displayDate = computed(() => dateFormat.format(model.value))
</script>

<template>
    <v-dialog width="unset" v-model="dialogOpen">
        <template v-slot:activator="{ props: activatorProps }">
            <slot name="activator" :activatorProps="activatorProps" :displayDate="displayDate" :readonly="props.readonly"></slot>
        </template>

        <template v-slot:default="{ isActive }">
            <v-date-picker v-model="selectedDate" class="bg-background" color="primary" :title="title">
                <template v-slot:actions>
                    <v-btn @click="dialogOpen = false">cancel</v-btn>
                    <v-btn variant="elevated" color="green" @click="update">apply change</v-btn>
                </template>
            </v-date-picker>
        </template>
    </v-dialog>
</template>

<style scoped>

</style>