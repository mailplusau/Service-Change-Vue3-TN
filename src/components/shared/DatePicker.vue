<script setup>
import {ref, defineModel, computed, watch, defineEmits} from "vue";
const model = defineModel({
    required: true,
});
const emit = defineEmits(['dateChanged']);
const props = defineProps({
    readonly: {
        type: Boolean,
        default: false,
    },
    title: {
        type: String,
        default: 'Select a date'
    },
    disabled: {
        type: Boolean,
        default: false,
    }
})
const dialogOpen = ref(false);
const selectedDate = ref();

const dateFormat = new Intl.DateTimeFormat('en-AU', {
    dateStyle: 'long',
    timeZone: 'Australia/Sydney',
});

function update() {
    dialogOpen.value = false;
    if (model.value === selectedDate.value) return;
    model.value = selectedDate.value;
    emit('dateChanged', selectedDate.value);
}

watch(dialogOpen, (val) => {
    if (val) selectedDate.value = model.value;
})

const displayDate = computed(() => dateFormat.format(model.value))
</script>

<template>
    <v-dialog width="unset" v-model="dialogOpen">
        <template v-slot:activator="{ props: activatorProps }">
            <slot name="activator" :activatorProps="props.disabled ? null : activatorProps" :displayDate="displayDate" :readonly="props.readonly"></slot>
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